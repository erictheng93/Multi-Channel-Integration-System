/**
 * Cloudflare API Service
 *
 * Handles all interactions with Cloudflare Platform API
 * for provisioning resources during deployment
 */

import type {
  CloudflareAPIConfig,
  CloudflareAPIResponse,
  D1Database,
  CreateD1Request,
  KVNamespace,
  CreateKVRequest,
  R2Bucket,
  CreateR2Request,
  Queue,
  CreateQueueRequest,
  Worker,
  DeployWorkerRequest,
  PagesProject,
  CreatePagesProjectRequest,
  PagesDeployment,
  DirectUploadRequest,
  CustomDomain,
  AddCustomDomainRequest,
  D1QueryResult,
  APIRequestOptions,
  UpdatePagesProjectRequest,
  PagesEnvVar
} from '../types/cloudflare';

export class CloudflareAPI {
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(config: CloudflareAPIConfig) {
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || 'https://api.cloudflare.com/client/v4';
  }

  /**
   * Generic API request method
   */
  private async request<T>(options: APIRequestOptions): Promise<CloudflareAPIResponse<T>> {
    const url = new URL(`${this.baseUrl}${options.path}`);

    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.json() as CloudflareAPIResponse;
      throw new Error(`Cloudflare API Error: ${error.errors[0]?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * D1 Database Operations
   */
  async createD1Database(name: string): Promise<D1Database> {
    const body: CreateD1Request = { name };
    const response = await this.request<D1Database>({
      method: 'POST',
      path: `/accounts/${this.accountId}/d1/database`,
      body
    });

    if (!response.success) {
      throw new Error(`Failed to create D1 database: ${response.errors[0]?.message}`);
    }

    return response.result;
  }

  async executeD1Query(databaseId: string, sql: string): Promise<D1QueryResult> {
    const response = await this.request<D1QueryResult[]>({
      method: 'POST',
      path: `/accounts/${this.accountId}/d1/database/${databaseId}/query`,
      body: { sql }
    });

    // D1 query API returns result as an array — extract first element
    const result = Array.isArray(response.result) ? response.result[0] : response.result;
    return result;
  }

  /**
   * Execute D1 Query with parameterized values (prevents SQL injection)
   */
  async executeD1QueryWithParams(
    databaseId: string,
    sql: string,
    params: (string | number | boolean | null)[]
  ): Promise<D1QueryResult> {
    const response = await this.request<D1QueryResult[]>({
      method: 'POST',
      path: `/accounts/${this.accountId}/d1/database/${databaseId}/query`,
      body: {
        sql,
        params
      }
    });

    // D1 query API returns result as an array — extract first element
    const result = Array.isArray(response.result) ? response.result[0] : response.result;
    return result;
  }

  async listD1Databases(): Promise<D1Database[]> {
    const response = await this.request<D1Database[]>({
      method: 'GET',
      path: `/accounts/${this.accountId}/d1/database`
    });
    return response.result;
  }

  async deleteD1Database(databaseId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/accounts/${this.accountId}/d1/database/${databaseId}`
    });
  }

  /**
   * KV Namespace Operations
   */
  async createKVNamespace(title: string): Promise<KVNamespace> {
    const body: CreateKVRequest = { title };
    const response = await this.request<KVNamespace>({
      method: 'POST',
      path: `/accounts/${this.accountId}/storage/kv/namespaces`,
      body
    });

    if (!response.success) {
      throw new Error(`Failed to create KV namespace: ${response.errors[0]?.message}`);
    }

    return response.result;
  }

  async listKVNamespaces(): Promise<KVNamespace[]> {
    const response = await this.request<KVNamespace[]>({
      method: 'GET',
      path: `/accounts/${this.accountId}/storage/kv/namespaces`
    });
    return response.result;
  }

  async deleteKVNamespace(namespaceId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}`
    });
  }

  /**
   * R2 Bucket Operations
   */
  async createR2Bucket(name: string): Promise<R2Bucket> {
    const body: CreateR2Request = { name };
    const response = await this.request<R2Bucket>({
      method: 'POST',
      path: `/accounts/${this.accountId}/r2/buckets`,
      body
    });

    if (!response.success) {
      throw new Error(`Failed to create R2 bucket: ${response.errors[0]?.message}`);
    }

    return response.result;
  }

  async listR2Buckets(): Promise<R2Bucket[]> {
    const response = await this.request<{ buckets: R2Bucket[] }>({
      method: 'GET',
      path: `/accounts/${this.accountId}/r2/buckets`
    });
    // R2 list API wraps result in { buckets: [...] }
    const result = response.result as unknown as { buckets: R2Bucket[] };
    return Array.isArray(result) ? result : (result.buckets || []);
  }

  async deleteR2Bucket(name: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/accounts/${this.accountId}/r2/buckets/${name}`
    });
  }

  /**
   * Queue Operations
   */
  async createQueue(queueName: string): Promise<Queue> {
    const body: CreateQueueRequest = { queue_name: queueName };
    const response = await this.request<Queue>({
      method: 'POST',
      path: `/accounts/${this.accountId}/queues`,
      body
    });

    if (!response.success) {
      throw new Error(`Failed to create queue: ${response.errors[0]?.message}`);
    }

    return response.result;
  }

  async listQueues(): Promise<Queue[]> {
    const response = await this.request<Queue[]>({
      method: 'GET',
      path: `/accounts/${this.accountId}/queues`
    });
    return response.result;
  }

  async deleteQueue(queueId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/accounts/${this.accountId}/queues/${queueId}`
    });
  }

  /**
   * Worker Operations
   */

  /**
   * Check if a Worker script already exists
   * Returns true if the worker exists, false otherwise
   */
  async workerExists(name: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${name}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          }
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async deployWorker(config: DeployWorkerRequest): Promise<Worker> {
    // Workers API uses a different format (multipart/form-data)
    const metadata: Record<string, unknown> = {
      main_module: 'index.js',
      bindings: config.bindings,
      compatibility_date: config.compatibility_date,
      compatibility_flags: config.compatibility_flags
    };

    // Include DO migrations if present
    if (config.migrations) {
      metadata.migrations = config.migrations;
    }

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));

    const blob = new Blob([config.script], { type: 'application/javascript+module' });
    formData.append('index.js', blob);

    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${config.name}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.json() as CloudflareAPIResponse;
      throw new Error(`Failed to deploy worker: ${error.errors?.[0]?.message || response.statusText}`);
    }

    return response.json();
  }

  async deleteWorker(name: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/accounts/${this.accountId}/workers/scripts/${name}`
    });
  }

  /**
   * Pages Operations
   */
  async createPagesProject(name: string): Promise<PagesProject> {
    const body: CreatePagesProjectRequest = {
      name,
      production_branch: 'main'
    };

    const response = await this.request<PagesProject>({
      method: 'POST',
      path: `/accounts/${this.accountId}/pages/projects`,
      body
    });

    if (!response.success) {
      throw new Error(`Failed to create Pages project: ${response.errors[0]?.message}`);
    }

    return response.result;
  }

  async deployPagesDirectUpload(
    projectName: string,
    files: DirectUploadRequest['files']
  ): Promise<PagesDeployment> {
    // Pages direct upload uses a special format
    const formData = new FormData();

    // Convert files map to manifest
    const manifest: Record<string, string> = {};
    files.forEach((content, filename) => {
      manifest[filename] = filename; // Hash would go here in production
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append(filename, blob);
    });

    formData.append('manifest', JSON.stringify(manifest));

    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.json() as CloudflareAPIResponse;
      throw new Error(`Failed to deploy Pages: ${error.errors?.[0]?.message || response.statusText}`);
    }

    const result = await response.json() as CloudflareAPIResponse<PagesDeployment>;
    return result.result;
  }

  /**
   * Get an existing Pages project by name
   * Returns the project if it exists, null otherwise
   */
  async getPagesProject(projectName: string): Promise<PagesProject | null> {
    try {
      const response = await this.request<PagesProject>({
        method: 'GET',
        path: `/accounts/${this.accountId}/pages/projects/${projectName}`
      });
      return response.result;
    } catch {
      return null;
    }
  }

  async deletePagesProject(projectName: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/accounts/${this.accountId}/pages/projects/${projectName}`
    });
  }

  /**
   * Set Pages Environment Variables
   *
   * Sets environment variables for Pages Functions (like _middleware.ts)
   * These are different from Worker bindings - they're accessed via context.env
   *
   * @param projectName - The Pages project name
   * @param variables - Key-value pairs of environment variables
   * @param isSecret - Whether to mark variables as secrets (default: false for URLs)
   */
  async setPagesEnvironmentVariables(
    projectName: string,
    variables: Record<string, string>,
    isSecret: boolean = false
  ): Promise<PagesProject> {
    // Convert simple key-value to Pages env var format
    const envVars: Record<string, PagesEnvVar> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (value) { // Only set non-empty values
        envVars[key] = {
          value,
          type: isSecret ? 'secret_text' : 'plain_text'
        };
      }
    }

    const body: UpdatePagesProjectRequest = {
      deployment_configs: {
        production: {
          env_vars: envVars
        },
        preview: {
          env_vars: envVars
        }
      }
    };

    const response = await this.request<PagesProject>({
      method: 'PATCH',
      path: `/accounts/${this.accountId}/pages/projects/${projectName}`,
      body
    });

    if (!response.success) {
      throw new Error(`Failed to set Pages environment variables: ${response.errors[0]?.message}`);
    }

    return response.result;
  }

  /**
   * Custom Domain Operations
   */
  async addCustomDomain(projectName: string, hostname: string): Promise<CustomDomain> {
    const body: AddCustomDomainRequest = { hostname };
    const response = await this.request<CustomDomain>({
      method: 'POST',
      path: `/accounts/${this.accountId}/pages/projects/${projectName}/domains`,
      body
    });

    if (!response.success) {
      throw new Error(`Failed to add custom domain: ${response.errors[0]?.message}`);
    }

    return response.result;
  }

  async deleteCustomDomain(projectName: string, domainId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      path: `/accounts/${this.accountId}/pages/projects/${projectName}/domains/${domainId}`
    });
  }

  /**
   * Get Workers subdomain for this account
   */
  async getWorkersSubdomain(): Promise<string> {
    const response = await this.request<{ subdomain: string }>({
      method: 'GET',
      path: `/accounts/${this.accountId}/workers/subdomain`
    });
    return response.result.subdomain;
  }

  /**
   * Enable workers.dev route for a Worker script
   * Required for the worker to be accessible via <name>.<subdomain>.workers.dev
   */
  async enableWorkersDevRoute(scriptName: string): Promise<void> {
    await this.request({
      method: 'POST',
      path: `/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`,
      body: { enabled: true }
    });
  }

  /**
   * Health Check
   */
  async healthCheck(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/api/system/health`, {
        method: 'GET',
        headers: {
          'User-Agent': 'CRM-Installer-HealthCheck/1.0'
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
