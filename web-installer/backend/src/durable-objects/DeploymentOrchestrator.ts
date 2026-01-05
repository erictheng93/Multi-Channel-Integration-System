/**
 * DeploymentOrchestrator Durable Object
 *
 * Core orchestrator for CRM deployment process
 * Manages state, progress tracking, and SSE broadcasting
 */

import { CloudflareAPI } from '../services/CloudflareAPI';
import { MigrationRunner } from '../services/MigrationRunner';
import { ConfigGenerator } from '../services/ConfigGenerator';
import { EmailService } from '../services/EmailService';
import { RollbackService } from '../services/RollbackService';
import { WorkerBundleService } from '../services/WorkerBundleService';
import { FrontendBundleService } from '../services/FrontendBundleService';
import {
  DEPLOYMENT_STEPS,
  type DeploymentConfig,
  type DeploymentState,
  type DeploymentStep,
  type DeploymentStatus,
  type DeploymentLog,
  type DeploymentError,
  type CloudflareResources,
  type AdminCredentials,
  type SSEEvent
} from '../types/deployment';

// Cloudflare Worker environment type
interface Env {
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
  DEPLOYMENT_ORCHESTRATOR: DurableObjectNamespace;
}

export class DeploymentOrchestrator implements DurableObject {
  private state: DurableObjectState;
  private deploymentState: DeploymentState | null = null;
  private sseClients: Set<ReadableStreamDefaultController> = new Set();

  // Services
  private api!: CloudflareAPI;
  private migrationRunner!: MigrationRunner;
  private configGenerator!: ConfigGenerator;
  private emailService!: EmailService;
  private rollbackService!: RollbackService;
  private workerBundleService!: WorkerBundleService;
  private frontendBundleService!: FrontendBundleService;

  // Generated secrets
  private generatedSecrets!: { jwtSecret: string; encryptionKey: string };

  // Prepared frontend assets
  private frontendAssets!: Map<string, string>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
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

      // SSE stream for real-time updates
      if (path === '/events' && request.method === 'GET') {
        return await this.handleSSE();
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
    this.emailService = new EmailService({
      apiKey: process.env.RESEND_API_KEY || '',
      fromEmail: process.env.FROM_EMAIL || 'installer@crm.com'
    });
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
      await this.runStep('send_email', () => this.stepSendEmail());
      await this.runStep('verify_health', () => this.stepVerifyHealth());
      await this.runStep('complete', () => this.stepComplete());

      // Deployment successful
      this.deploymentState.status = 'completed';
      this.deploymentState.completedAt = Date.now();
      await this.updateState();

      this.broadcastSSE({
        type: 'complete',
        data: {
          deploymentId: this.deploymentState.deploymentId,
          resources: this.deploymentState.resources,
          credentials: (this.deploymentState as any).adminCredentials,
          urls: {
            frontend: this.deploymentState.resources.pagesUrl || '',
            backend: this.deploymentState.resources.workerUrl || ''
          }
        }
      });

    } catch (error) {
      await this.handleDeploymentError(error);
    }
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

        this.broadcastSSE({
          type: 'progress',
          data: {
            step: stepName,
            stepProgress: 100,
            totalProgress: this.deploymentState.totalProgress,
            message: `Completed: ${stepConfig.description}`
          }
        });

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

    this.broadcastSSE({
      type: 'error',
      data: {
        error: deploymentError,
        rollbackInitiated: true
      }
    });

    // Execute rollback
    try {
      await this.rollbackService.rollback(this.deploymentState.resources);
      this.log('success', 'Rollback completed successfully');
    } catch (rollbackError) {
      this.log('error', `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown'}`);
    }

    // Send failure email
    try {
      await this.emailService.sendDeploymentFailureEmail(
        this.deploymentState.config.adminEmail,
        this.deploymentState.config.projectName,
        errorMessage
      );
    } catch (emailError) {
      this.log('warning', `Failed to send error email: ${emailError instanceof Error ? emailError.message : 'Unknown'}`);
    }

    this.deploymentState.status = 'failed';
    await this.updateState();
  }

  /**
   * Get deployment status
   */
  private async getStatus(): Promise<Response> {
    const state = this.deploymentState || await this.state.storage.get<DeploymentState>('deploymentState');

    if (!state) {
      return new Response(
        JSON.stringify({ error: 'No deployment found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(state),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle Server-Sent Events connection
   */
  private async handleSSE(): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Add client to broadcast list
    const controller = readable.getReader() as any;
    this.sseClients.add(controller);

    // Send initial state
    if (this.deploymentState) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({
          type: 'status',
          data: this.deploymentState
        })}\n\n`)
      );
    }

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }

  /**
   * Broadcast SSE event to all connected clients
   */
  private broadcastSSE(event: SSEEvent): void {
    const encoder = new TextEncoder();
    const data = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

    this.sseClients.forEach((controller) => {
      try {
        (controller as any).enqueue(data);
      } catch {
        this.sseClients.delete(controller);
      }
    });
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

    // Broadcast log to SSE clients
    this.broadcastSSE({
      type: 'log',
      data: {
        timestamp: logEntry.timestamp,
        level,
        message,
        step: this.deploymentState.currentStep
      }
    });
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
    const db = await this.api.createD1Database(dbName);
    this.deploymentState.resources.d1DatabaseId = db.uuid;
    this.log('success', `Created D1 database: ${db.uuid}`);
  }

  private async stepCreateKVSession(): Promise<void> {
    if (!this.deploymentState) return;
    const kvName = `${this.deploymentState.config.projectName}-session-kv`;
    const kv = await this.api.createKVNamespace(kvName);
    this.deploymentState.resources.kvSessionNamespaceId = kv.id;
    this.log('success', `Created KV namespace (session): ${kv.id}`);
  }

  private async stepCreateKVCache(): Promise<void> {
    if (!this.deploymentState) return;
    const kvName = `${this.deploymentState.config.projectName}-cache-kv`;
    const kv = await this.api.createKVNamespace(kvName);
    this.deploymentState.resources.kvCacheNamespaceId = kv.id;
    this.log('success', `Created KV namespace (cache): ${kv.id}`);
  }

  private async stepCreateR2(): Promise<void> {
    if (!this.deploymentState) return;
    const bucketName = `${this.deploymentState.config.projectName}-files`;
    const bucket = await this.api.createR2Bucket(bucketName);
    this.deploymentState.resources.r2BucketName = bucket.name;
    this.log('success', `Created R2 bucket: ${bucket.name}`);
  }

  private async stepCreateQueue(): Promise<void> {
    if (!this.deploymentState) return;
    const queueName = `${this.deploymentState.config.projectName}-queue`;
    const queue = await this.api.createQueue(queueName);
    this.deploymentState.resources.queueId = queue.queue_id;
    this.deploymentState.resources.queueName = queue.queue_name;
    this.log('success', `Created queue: ${queue.queue_name} (ID: ${queue.queue_id})`);
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

    // Deploy the Worker using Cloudflare API
    const worker = await this.api.deployWorker({
      name: workerName,
      script: workerScript,
      bindings,
      compatibility_date: '2024-01-01',
      compatibility_flags: ['nodejs_compat']
    });

    this.deploymentState.resources.workerId = workerName;
    this.deploymentState.resources.workerUrl = `https://${workerName}.${this.deploymentState.config.accountId}.workers.dev`;

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

    // Create Pages project
    this.log('info', 'Creating Pages project...');
    const pages = await this.api.createPagesProject(projectName);

    this.deploymentState.resources.pagesProjectId = pages.id;
    this.deploymentState.resources.pagesProjectName = pages.name;
    this.deploymentState.resources.pagesUrl = `https://${pages.subdomain}.pages.dev`;

    this.log('info', `Pages project created: ${pages.name}`);

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

    const password = this.configGenerator.generateAdminPassword();
    const adminEmail = this.deploymentState.config.adminEmail;

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

    (this.deploymentState as any).adminCredentials = credentials;
    this.log('success', `Created admin user: ${result.username} (ID: ${result.userId})`);
  }

  private async stepSendEmail(): Promise<void> {
    if (!this.deploymentState) return;
    const credentials = (this.deploymentState as any).adminCredentials as AdminCredentials;

    await this.emailService.sendDeploymentSuccessEmail(
      this.deploymentState.config.adminEmail,
      this.deploymentState.config.projectName,
      credentials,
      this.deploymentState.resources
    );

    this.log('success', 'Sent deployment success email');
  }

  private async stepVerifyHealth(): Promise<void> {
    if (!this.deploymentState) return;
    if (!this.deploymentState.resources.workerUrl) {
      throw new Error('Worker URL not available');
    }

    const isHealthy = await this.api.healthCheck(this.deploymentState.resources.workerUrl);
    if (!isHealthy) {
      throw new Error('Health check failed');
    }

    this.log('success', 'Health check passed');
  }

  private async stepComplete(): Promise<void> {
    if (!this.deploymentState) return;
    this.log('success', '🎉 Deployment completed successfully!');
  }
}
