/**
 * Web Installer - Cloudflare API Types
 *
 * Type definitions for Cloudflare Platform API interactions
 */

export interface CloudflareAPIConfig {
  accountId: string;
  apiToken: string;
  baseUrl?: string;
}

// D1 Database Types
export interface D1Database {
  uuid: string;
  name: string;
  version: string;
  num_tables: number;
  file_size: number;
  created_at: string;
}

export interface CreateD1Request {
  name: string;
}

export interface D1QueryResult {
  success: boolean;
  results?: unknown[];
  meta?: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
  errors?: CloudflareAPIError[];
}

// KV Namespace Types
export interface KVNamespace {
  id: string;
  title: string;
  supports_url_encoding: boolean;
}

export interface CreateKVRequest {
  title: string;
}

// R2 Bucket Types
export interface R2Bucket {
  name: string;
  creation_date: string;
  location: string;
}

export interface CreateR2Request {
  name: string;
  locationHint?: string;
}

// Queue Types
export interface Queue {
  queue_id: string;
  queue_name: string;
  created_on: string;
  modified_on: string;
  producers: number;
  consumers: number;
}

export interface CreateQueueRequest {
  queue_name: string;
}

// Worker Types
export interface Worker {
  id: string;
  created_on: string;
  modified_on: string;
  etag: string;
}

export interface DurableObjectMigration {
  tag: string;
  new_classes?: string[];
  new_sqlite_classes?: string[];
  renamed_classes?: Array<{ from: string; to: string }>;
  deleted_classes?: string[];
}

export interface DeployWorkerRequest {
  name: string;
  script: string;
  bindings: WorkerBinding[];
  compatibility_date: string;
  compatibility_flags?: string[];
  migrations?: { steps: DurableObjectMigration[] };
}

export interface WorkerBinding {
  type: 'kv_namespace' | 'd1' | 'r2_bucket' | 'queue' | 'durable_object_namespace';
  name: string;
  id?: string;
  namespace_id?: string;  // KV namespace bindings require namespace_id
  bucket_name?: string;
  queue_name?: string;
  class_name?: string;
  script_name?: string;
}

// Pages Types
export interface PagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  source: PagesSource | null;
  created_on: string;
  production_branch: string;
}

export interface PagesSource {
  type: string;
  config: {
    owner: string;
    repo_name: string;
    production_branch: string;
  };
}

export interface CreatePagesProjectRequest {
  name: string;
  production_branch: string;
}

export interface PagesDeployment {
  id: string;
  url: string;
  environment: string;
  deployment_trigger: {
    type: string;
  };
  stages: PagesDeploymentStage[];
  build_config: {
    build_command: string;
    destination_dir: string;
  };
  created_on: string;
  latest_stage: PagesDeploymentStage;
}

export interface PagesDeploymentStage {
  name: string;
  status: 'active' | 'success' | 'failure' | 'skipped';
  started_on: string | null;
  ended_on: string | null;
}

export interface DirectUploadRequest {
  files: Map<string, string>; // filename -> content
}

// Custom Domain Types
export interface CustomDomain {
  id: string;
  hostname: string;
  ssl: {
    status: string;
    validation_method: string;
  };
  created_on: string;
}

export interface AddCustomDomainRequest {
  hostname: string;
}

// Pages Environment Variables Types
export interface PagesEnvVar {
  value: string;
  type?: 'plain_text' | 'secret_text';
}

export interface PagesDeploymentConfig {
  env_vars?: Record<string, PagesEnvVar>;
  compatibility_date?: string;
  compatibility_flags?: string[];
  d1_databases?: Record<string, { id: string }>;
  kv_namespaces?: Record<string, { namespace_id: string }>;
  r2_buckets?: Record<string, { name: string }>;
}

export interface UpdatePagesProjectRequest {
  deployment_configs?: {
    production?: PagesDeploymentConfig;
    preview?: PagesDeploymentConfig;
  };
}

// Generic API Response
export interface CloudflareAPIResponse<T = unknown> {
  result: T;
  success: boolean;
  errors: CloudflareAPIError[];
  messages: CloudflareAPIMessage[];
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
    count: number;
    total_count: number;
  };
}

export interface CloudflareAPIError {
  code: number;
  message: string;
}

export interface CloudflareAPIMessage {
  code: number;
  message: string;
}

// API Method Options
export interface APIRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}
