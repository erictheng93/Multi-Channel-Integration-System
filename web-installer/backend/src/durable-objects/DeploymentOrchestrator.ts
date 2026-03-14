/**
 * DeploymentOrchestrator Durable Object
 *
 * Core orchestrator for CRM deployment process
 * Manages state, progress tracking, and SSE broadcasting
 */

import { CloudflareAPI } from '../services/CloudflareAPI';
import { MigrationRunner } from '../services/MigrationRunner';
import { ConfigGenerator } from '../services/ConfigGenerator';
import { RollbackService } from '../services/RollbackService';
import { WorkerBundleService } from '../services/WorkerBundleService';
import { FrontendBundleService } from '../services/FrontendBundleService';
import { DURABLE_OBJECT_CLASS_NAMES } from '../constants/durable-objects';
import {
  DEPLOYMENT_STEPS,
  type DeploymentConfig,
  type DeploymentState,
  type DeploymentStep,
  type DeploymentStatus,
  type DeploymentLog,
  type DeploymentError,
  type CloudflareResources,
  type AdminCredentials
} from '../types/deployment';

// Cloudflare Worker environment type
interface Env {
  DEPLOYMENT_ORCHESTRATOR: DurableObjectNamespace;
}

/**
 * Check if a Cloudflare API error indicates the resource already exists.
 * Centralizes fragile string matching so it's maintained in one place.
 */
function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error &&
    (error.message.includes('already exists') || error.message.includes('already taken'));
}

export class DeploymentOrchestrator implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private deploymentState: DeploymentState | null = null;

  // Services
  private api!: CloudflareAPI;
  private migrationRunner!: MigrationRunner;
  private configGenerator!: ConfigGenerator;
  private rollbackService!: RollbackService;
  private workerBundleService!: WorkerBundleService;
  private frontendBundleService!: FrontendBundleService;

  // Generated secrets
  private generatedSecrets!: { jwtSecret: string; encryptionKey: string };

  // Prepared frontend assets
  private frontendAssets!: Map<string, string>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.initializeServices(env);
  }

  /**
   * Initialize all services
   */
  private initializeServices(env: Env): void {
    // Services will be initialized when deployment starts
    // with the actual OAuth token from the request
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Start deployment
      if (path === '/deploy' && request.method === 'POST') {
        const config: DeploymentConfig = await request.json();
        return await this.startDeployment(config);
      }

      // Get deployment status
      if (path === '/status' && request.method === 'GET') {
        return await this.getStatus();
      }

      // Cancel deployment
      if (path === '/cancel' && request.method === 'POST') {
        return await this.cancelDeployment();
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Start deployment process
   */
  private async startDeployment(config: DeploymentConfig): Promise<Response> {
    // Initialize services with OAuth token
    this.api = new CloudflareAPI({
      accountId: config.accountId,
      apiToken: config.oauthToken
    });

    this.migrationRunner = new MigrationRunner(this.api);
    this.configGenerator = new ConfigGenerator();
    this.rollbackService = new RollbackService(this.api);
    this.workerBundleService = new WorkerBundleService();
    this.frontendBundleService = new FrontendBundleService();

    // Generate secure secrets for the deployment
    this.generatedSecrets = this.workerBundleService.generateSecrets();

    // Initialize deployment state
    const deploymentId = crypto.randomUUID();
    this.deploymentState = {
      deploymentId,
      config,
      status: 'pending' as DeploymentStatus,
      currentStep: 'initialize' as DeploymentStep,
      currentStepProgress: 0,
      totalProgress: 0,
      resources: {},
      logs: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Persist state
    await this.state.storage.put('deploymentState', this.deploymentState);

    // Start deployment in background
    this.executeDeployment().catch(async (error) => {
      await this.handleDeploymentError(error);
    });

    return new Response(
      JSON.stringify({
        success: true,
        deploymentId,
        message: 'Deployment started'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Execute deployment steps
   */
  private async executeDeployment(): Promise<void> {
    if (!this.deploymentState) return;

    try {
      this.deploymentState.status = 'in_progress';
      await this.updateState();

      // Execute each step in order
      await this.runStep('initialize', () => this.stepInitialize());
      await this.runStep('create_d1', () => this.stepCreateD1());
      await this.runStep('create_kv_session', () => this.stepCreateKVSession());
      await this.runStep('create_kv_cache', () => this.stepCreateKVCache());
      await this.runStep('create_r2', () => this.stepCreateR2());
      await this.runStep('create_queue', () => this.stepCreateQueue());
      await this.runStep('run_migrations', () => this.stepRunMigrations());
      await this.runStep('generate_config', () => this.stepGenerateConfig());
      await this.runStep('deploy_worker', () => this.stepDeployWorker());
      await this.runStep('build_frontend', () => this.stepBuildFrontend());
      await this.runStep('deploy_pages', () => this.stepDeployPages());

      // Optional: Custom domain
      if (this.deploymentState.config.customDomain) {
        await this.runStep('configure_domain', () => this.stepConfigureDomain());
      }

      await this.runStep('create_admin', () => this.stepCreateAdmin());

    } catch (error) {
      // Provisioning failed — rollback all created resources
      await this.handleDeploymentError(error);
      return;
    }

    // === VERIFICATION PHASE (no rollback — resources are fully deployed) ===
    try {
      await this.runStep('verify_health', () => this.stepVerifyHealth());
    } catch {
      // Health check failure is non-fatal — worker may still be propagating
      this.log('warning', 'Health check did not pass — worker may still be propagating globally.');
    }

    try {
      await this.runStep('complete', () => this.stepComplete());
    } catch {
      // Complete step is non-fatal
    }

    // Deployment successful regardless of health check
    this.deploymentState.status = 'completed';
    this.deploymentState.completedAt = Date.now();
    await this.updateState();
  }

  /**
   * Run a single deployment step with error handling and retries
   */
  private async runStep(
    stepName: DeploymentStep,
    stepFunction: () => Promise<void>
  ): Promise<void> {
    if (!this.deploymentState) return;

    const stepConfig = (DEPLOYMENT_STEPS as any)[stepName];
    let retryCount = 0;
    let lastError: Error | null = null;

    this.deploymentState.currentStep = stepName;
    this.deploymentState.currentStepProgress = 0;
    await this.updateState();

    this.log('info', `Starting step: ${stepConfig.description}`);

    while (retryCount <= (stepConfig.maxRetries || 0)) {
      try {
        // Execute step with timeout
        await this.withTimeout(stepFunction(), stepConfig.timeout);

        // Step completed successfully
        this.deploymentState.currentStepProgress = 100;
        this.updateTotalProgress(stepName);
        await this.updateState();

        this.log('success', `Completed step: ${stepConfig.description}`);

        return; // Success - exit function

      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (stepConfig.retryable && retryCount <= (stepConfig.maxRetries || 0)) {
          this.log('warning', `Step ${stepName} failed, retrying (${retryCount}/${stepConfig.maxRetries}): ${lastError.message}`);
          await this.sleep(1000 * retryCount); // Exponential backoff
        } else {
          // Max retries exceeded or step not retryable
          throw lastError;
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  /**
   * Update total progress based on completed steps
   */
  private updateTotalProgress(completedStep: DeploymentStep): void {
    if (!this.deploymentState) return;

    let totalProgress = 0;

    // Sum up weights of all steps up to and including the completed step
    for (const [stepName, stepConfig] of Object.entries(DEPLOYMENT_STEPS)) {
      totalProgress += (stepConfig as { weight: number }).weight;
      if (stepName === completedStep) break;
    }

    this.deploymentState.totalProgress = Math.min(totalProgress, 100);
  }

  /**
   * Handle deployment error
   */
  private async handleDeploymentError(error: unknown): Promise<void> {
    if (!this.deploymentState) return;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const deploymentError: DeploymentError = {
      code: 'DEPLOYMENT_FAILED',
      message: errorMessage,
      step: this.deploymentState.currentStep,
      recoverable: false
    };

    this.deploymentState.status = 'rolling_back';
    this.deploymentState.error = deploymentError;
    await this.updateState();

    this.log('error', `Deployment failed: ${errorMessage}`);

    // Execute rollback
    try {
      await this.rollbackService.rollback(this.deploymentState.resources);
      this.log('success', 'Rollback completed successfully');
    } catch (rollbackError) {
      this.log('error', `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown'}`);
    }


    this.deploymentState.status = 'failed';
    await this.updateState();
  }

  /**
   * Get deployment status
   *
   * Maps internal state to the API response contract expected by the frontend.
   * Notably, adminCredentials → credentials (frontend DeploymentStatusResponse type).
   */
  private async getStatus(): Promise<Response> {
    const state = this.deploymentState || await this.state.storage.get<DeploymentState>('deploymentState');

    if (!state) {
      return new Response(
        JSON.stringify({ error: 'No deployment found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build response matching frontend DeploymentStatusResponse contract.
    // Omit sensitive fields to avoid credential leakage on every 3s poll.
    // - config: contains oauthToken, adminPassword
    // - adminCredentials: contains admin password (mapped to 'credentials' key below)
    const { config: _config, adminCredentials: _creds, ...safeState } = state;
    const response = {
      ...safeState,
      // Map internal adminCredentials → credentials (frontend expects this key)
      // Only include credentials when deployment is completed
      credentials: state.status === 'completed' ? state.adminCredentials ?? undefined : undefined
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Cancel deployment
   */
  private async cancelDeployment(): Promise<Response> {
    if (!this.deploymentState) {
      return new Response(
        JSON.stringify({ error: 'No active deployment' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initiate rollback
    this.deploymentState.status = 'rolling_back';
    await this.updateState();

    await this.rollbackService.rollback(this.deploymentState.resources);

    this.deploymentState.status = 'failed';
    await this.updateState();

    return new Response(
      JSON.stringify({ success: true, message: 'Deployment cancelled' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Log a message
   */
  private log(level: DeploymentLog['level'], message: string, details?: Record<string, unknown>): void {
    if (!this.deploymentState) return;

    const logEntry: DeploymentLog = {
      timestamp: Date.now(),
      level,
      message,
      step: this.deploymentState.currentStep,
      details
    };

    this.deploymentState.logs.push(logEntry);
  }

  /**
   * Update and persist state
   */
  private async updateState(): Promise<void> {
    if (!this.deploymentState) return;

    this.deploymentState.updatedAt = Date.now();
    await this.state.storage.put('deploymentState', this.deploymentState);
  }

  /**
   * Helper: Sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Execute with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  // ========================================
  // DEPLOYMENT STEPS IMPLEMENTATION
  // ========================================

  private async stepInitialize(): Promise<void> {
    if (!this.deploymentState) return;
    this.log('info', 'Initializing deployment...');
    await this.sleep(1000); // Simulate initialization
  }

  private async stepCreateD1(): Promise<void> {
    if (!this.deploymentState) return;
    const dbName = `${this.deploymentState.config.projectName}-db`;
    try {
      const db = await this.api.createD1Database(dbName);
      this.deploymentState.resources.d1DatabaseId = db.uuid;
      this.log('success', `Created D1 database: ${db.uuid}`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        this.log('info', `D1 database '${dbName}' already exists, reusing...`);
        const databases = await this.api.listD1Databases();
        const existing = databases.find((d: { name: string }) => d.name === dbName);
        if (existing) {
          this.deploymentState.resources.d1DatabaseId = existing.uuid;
          this.log('success', `Reusing existing D1 database: ${existing.uuid}`);
          return;
        }
      }
      throw error;
    }
  }

  private async stepCreateKVSession(): Promise<void> {
    if (!this.deploymentState) return;
    const kvName = `${this.deploymentState.config.projectName}-session-kv`;
    try {
      const kv = await this.api.createKVNamespace(kvName);
      this.deploymentState.resources.kvSessionNamespaceId = kv.id;
      this.log('success', `Created KV namespace (session): ${kv.id}`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        this.log('info', `KV namespace '${kvName}' already exists, reusing...`);
        const namespaces = await this.api.listKVNamespaces();
        const existing = namespaces.find((n: { title: string }) => n.title === kvName);
        if (existing) {
          this.deploymentState.resources.kvSessionNamespaceId = existing.id;
          this.log('success', `Reusing existing KV namespace (session): ${existing.id}`);
          return;
        }
      }
      throw error;
    }
  }

  private async stepCreateKVCache(): Promise<void> {
    if (!this.deploymentState) return;
    const kvName = `${this.deploymentState.config.projectName}-cache-kv`;
    try {
      const kv = await this.api.createKVNamespace(kvName);
      this.deploymentState.resources.kvCacheNamespaceId = kv.id;
      this.log('success', `Created KV namespace (cache): ${kv.id}`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        this.log('info', `KV namespace '${kvName}' already exists, reusing...`);
        const namespaces = await this.api.listKVNamespaces();
        const existing = namespaces.find((n: { title: string }) => n.title === kvName);
        if (existing) {
          this.deploymentState.resources.kvCacheNamespaceId = existing.id;
          this.log('success', `Reusing existing KV namespace (cache): ${existing.id}`);
          return;
        }
      }
      throw error;
    }
  }

  private async stepCreateR2(): Promise<void> {
    if (!this.deploymentState) return;
    const bucketName = `${this.deploymentState.config.projectName}-files`;
    try {
      const bucket = await this.api.createR2Bucket(bucketName);
      this.deploymentState.resources.r2BucketName = bucket.name;
      this.log('success', `Created R2 bucket: ${bucket.name}`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        this.log('info', `R2 bucket '${bucketName}' already exists, reusing...`);
        this.deploymentState.resources.r2BucketName = bucketName;
        this.log('success', `Reusing existing R2 bucket: ${bucketName}`);
        return;
      }
      throw error;
    }
  }

  private async stepCreateQueue(): Promise<void> {
    if (!this.deploymentState) return;
    const queueName = `${this.deploymentState.config.projectName}-queue`;
    try {
      const queue = await this.api.createQueue(queueName);
      this.deploymentState.resources.queueId = queue.queue_id;
      this.deploymentState.resources.queueName = queue.queue_name;
      this.log('success', `Created queue: ${queue.queue_name} (ID: ${queue.queue_id})`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        this.log('info', `Queue '${queueName}' already exists, reusing...`);
        const queues = await this.api.listQueues();
        const existing = queues.find((q: { queue_name: string }) => q.queue_name === queueName);
        if (existing) {
          this.deploymentState.resources.queueId = existing.queue_id;
          this.deploymentState.resources.queueName = existing.queue_name;
          this.log('success', `Reusing existing queue: ${existing.queue_name} (ID: ${existing.queue_id})`);
          return;
        }
      }
      throw error;
    }
  }

  private async stepRunMigrations(): Promise<void> {
    if (!this.deploymentState) return;
    if (!this.deploymentState.resources.d1DatabaseId) {
      throw new Error('D1 database not created');
    }
    await this.migrationRunner.runAllMigrations(this.deploymentState.resources.d1DatabaseId);
    this.log('success', 'Database migrations completed');
  }

  private async stepGenerateConfig(): Promise<void> {
    if (!this.deploymentState) return;
    const config = this.configGenerator.generateWranglerConfig(
      this.deploymentState.config.projectName,
      this.deploymentState.resources,
      this.deploymentState.config  // Phase 1: Pass user configuration
    );
    this.log('success', 'Generated wrangler.toml configuration');
    // Config would be used in deploy_worker step
  }

  private async stepDeployWorker(): Promise<void> {
    if (!this.deploymentState) return;

    const workerName = `${this.deploymentState.config.projectName}-worker`;
    const projectName = this.deploymentState.config.projectName;

    // Get bundled Worker script
    const workerScript = this.workerBundleService.getBundledWorkerScript();

    // Generate bindings for the Worker
    const bindings = this.workerBundleService.generateBindings(
      this.deploymentState.resources,
      projectName
    );

    this.log('info', `Deploying Worker with ${bindings.length} bindings...`);

    // Check if Worker already exists to determine if we need migrations
    const existingWorker = await this.api.workerExists(workerName);

    // Durable Object migrations — only include on FRESH deployment
    // Re-deployments must omit migrations to avoid "Cannot apply migration" conflict
    let migrations: { steps: { tag: string; new_sqlite_classes: string[] }[] } | undefined;

    if (!existingWorker) {
      this.log('info', 'Fresh deployment detected — including DO migrations...');
      migrations = {
        steps: [
          {
            tag: 'v1',
            new_sqlite_classes: DURABLE_OBJECT_CLASS_NAMES
          }
        ]
      };
    } else {
      this.log('info', 'Existing Worker detected — skipping DO migrations to avoid conflict...');
    }

    // Deploy the Worker using Cloudflare API
    // If migration tag precondition fails (stale DO state from previous deploy),
    // retry without migrations since they're already applied at the account level
    let worker;
    try {
      worker = await this.api.deployWorker({
        name: workerName,
        script: workerScript,
        bindings,
        compatibility_date: '2024-01-01',
        compatibility_flags: ['nodejs_compat'],
        migrations
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (migrations && errMsg.includes('migration tag precondition failed')) {
        this.log('warning', 'DO migrations already exist at account level — retrying without migrations...');
        worker = await this.api.deployWorker({
          name: workerName,
          script: workerScript,
          bindings,
          compatibility_date: '2024-01-01',
          compatibility_flags: ['nodejs_compat'],
          migrations: undefined
        });
      } else {
        throw err;
      }
    }

    this.deploymentState.resources.workerId = workerName;

    // Fetch actual workers subdomain (not accountId) for correct URL
    try {
      const subdomain = await this.api.getWorkersSubdomain();
      this.deploymentState.resources.workerUrl = `https://${workerName}.${subdomain}.workers.dev`;
    } catch {
      // Fallback: URL without subdomain (may not resolve but deployment continues)
      this.deploymentState.resources.workerUrl = `https://${workerName}.workers.dev`;
    }

    // Enable workers.dev route so the worker is publicly accessible
    this.log('info', 'Enabling workers.dev subdomain route...');
    await this.api.enableWorkersDevRoute(workerName);

    this.log('success', `Deployed Worker: ${workerName} (etag: ${worker.etag})`);
  }

  private async stepBuildFrontend(): Promise<void> {
    if (!this.deploymentState) return;

    this.log('info', 'Preparing frontend assets...');

    const projectName = this.deploymentState.config.projectName;
    const config = this.deploymentState.config;
    const resources = this.deploymentState.resources;

    // Phase 1: Smart URL derivation from user configuration
    const backendUrl = config.backendUrl ||
      (config.customDomain ? `https://api.${config.customDomain}` : '') ||
      resources.workerUrl ||
      `https://${projectName}-worker.workers.dev`;

    const frontendUrl = config.frontendUrl ||
      (config.customDomain ? `https://${config.customDomain}` : '') ||
      resources.pagesUrl ||
      `https://${projectName}.pages.dev`;

    // Generate frontend assets with user configuration
    this.frontendAssets = this.frontendBundleService.getBundledAssets({
      apiBaseUrl: backendUrl,
      wsBaseUrl: backendUrl.replace('https://', 'wss://'),
      appUrl: frontendUrl,
      projectName
    });

    this.log('success', `Frontend assets prepared: ${this.frontendAssets.size} files`);
  }

  private async stepDeployPages(): Promise<void> {
    if (!this.deploymentState) return;

    const projectName = this.deploymentState.config.projectName;
    const config = this.deploymentState.config;

    // Create or reuse Pages project
    this.log('info', 'Creating Pages project...');
    let pages: { id: string; name: string; subdomain: string };
    try {
      pages = await this.api.createPagesProject(projectName);
      this.log('info', `Pages project created: ${pages.name}`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        this.log('info', `Pages project '${projectName}' already exists, reusing...`);
        const existing = await this.api.getPagesProject(projectName);
        if (existing) {
          pages = existing;
          this.log('success', `Reusing existing Pages project: ${existing.name}`);
        } else {
          throw new Error(`Pages project '${projectName}' reported as existing but could not be fetched`);
        }
      } else {
        throw error;
      }
    }

    this.deploymentState.resources.pagesProjectId = pages.id;
    this.deploymentState.resources.pagesProjectName = pages.name;
    // pages.subdomain from CF API already includes ".pages.dev" (e.g. "mcis-ey7.pages.dev")
    const pagesHost = pages.subdomain.endsWith('.pages.dev')
      ? pages.subdomain
      : `${pages.subdomain}.pages.dev`;
    this.deploymentState.resources.pagesUrl = `https://${pagesHost}`;

    // Deploy frontend assets
    if (this.frontendAssets && this.frontendAssets.size > 0) {
      this.log('info', 'Uploading frontend assets...');

      const deployment = await this.api.deployPagesDirectUpload(
        projectName,
        this.frontendAssets
      );

      this.log('success', `Deployed to Pages: ${pages.subdomain}.pages.dev (deployment: ${deployment.id})`);
    } else {
      this.log('warning', 'No frontend assets to deploy');
    }

    // Set Pages environment variables for dynamic CSP
    // These are used by _middleware.ts to generate CSP headers dynamically
    this.log('info', 'Setting Pages environment variables for dynamic CSP...');

    const backendUrl = config.backendUrl ||
      (config.customDomain ? `https://api.${config.customDomain}` : '') ||
      this.deploymentState.resources.workerUrl ||
      `https://${projectName}-worker.workers.dev`;

    const pagesEnvVars: Record<string, string> = {
      BACKEND_URL: backendUrl
    };

    // Add storage URL if configured
    if (config.r2PublicUrl) {
      pagesEnvVars['STORAGE_URL'] = config.r2PublicUrl;
    }

    // Add custom domains if configured
    if (config.customDomain) {
      // Allow both the custom domain and common subdomains
      const customDomains = [
        `https://${config.customDomain}`,
        `https://api.${config.customDomain}`,
        `wss://${config.customDomain}`,
        `wss://api.${config.customDomain}`
      ].join(',');
      pagesEnvVars['CUSTOM_DOMAINS'] = customDomains;
    }

    await this.api.setPagesEnvironmentVariables(projectName, pagesEnvVars);
    this.log('success', `Pages environment variables configured: ${Object.keys(pagesEnvVars).join(', ')}`);
  }

  private async stepConfigureDomain(): Promise<void> {
    if (!this.deploymentState) return;

    const customDomain = this.deploymentState.config.customDomain;
    if (!customDomain) {
      this.log('info', 'No custom domain configured, skipping...');
      return;
    }

    const pagesProjectName = this.deploymentState.resources.pagesProjectName;
    if (!pagesProjectName) {
      throw new Error('Pages project not created yet');
    }

    this.log('info', `Configuring custom domain: ${customDomain}...`);

    try {
      const domain = await this.api.addCustomDomain(pagesProjectName, customDomain);
      this.log('success', `Custom domain configured: ${customDomain} (SSL: ${domain.ssl.status})`);

      // Update the Pages URL to use custom domain
      this.deploymentState.resources.pagesUrl = `https://${customDomain}`;
    } catch (error) {
      // Custom domain may require DNS configuration
      this.log('warning', `Custom domain setup initiated. DNS configuration may be required: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async stepCreateAdmin(): Promise<void> {
    if (!this.deploymentState) return;
    if (!this.deploymentState.resources.d1DatabaseId) {
      throw new Error('D1 database not available');
    }

    const password = this.deploymentState.config.adminPassword || this.configGenerator.generateAdminPassword();
    const adminEmail = this.deploymentState.config.adminEmail;

    try {
      // Create admin user using MigrationRunner (handles password hashing internally)
      const result = await this.migrationRunner.createAdminUser(
        this.deploymentState.resources.d1DatabaseId,
        adminEmail,
        password,
        'System Administrator'
      );

      const credentials: AdminCredentials = {
        username: result.username,
        password,
        email: adminEmail
      };

      this.deploymentState.adminCredentials = credentials;
      this.log('success', `Created admin user: ${result.username} (ID: ${result.userId})`);
    } catch (error) {
      // Handle duplicate admin user on re-deployment (UNIQUE constraint on email)
      if (isAlreadyExistsError(error) || (error instanceof Error && error.message.includes('UNIQUE constraint'))) {
        this.log('info', `Admin user '${adminEmail}' already exists, reusing credentials...`);

        // Return credentials with the provided password — user chose this password
        const credentials: AdminCredentials = {
          username: 'admin',
          password,
          email: adminEmail
        };

        this.deploymentState.adminCredentials = credentials;
        this.log('success', `Reusing existing admin user: ${adminEmail}`);
        return;
      }
      throw error;
    }
  }

  private async stepVerifyHealth(): Promise<void> {
    if (!this.deploymentState) return;
    if (!this.deploymentState.resources.workerUrl) {
      throw new Error('Worker URL not available');
    }

    // Retry health check with delay — newly deployed workers need time to propagate globally
    const maxRetries = 5;
    const delayMs = 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log('info', `Health check attempt ${attempt}/${maxRetries}...`);
      const isHealthy = await this.api.healthCheck(this.deploymentState.resources.workerUrl);
      if (isHealthy) {
        this.log('success', 'Health check passed');
        return;
      }
      if (attempt < maxRetries) {
        this.log('info', `Worker not ready yet, retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // If all retries fail, log warning but don't block deployment
    this.log('warning', 'Health check did not pass after retries — worker may still be propagating. Deployment will continue.');
  }

  private async stepComplete(): Promise<void> {
    if (!this.deploymentState) return;
    this.log('success', ' Deployment completed successfully!');
  }
}
