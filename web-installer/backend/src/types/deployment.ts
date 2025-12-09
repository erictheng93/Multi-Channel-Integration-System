/**
 * Web Installer - Deployment Types
 *
 * Type definitions for deployment configuration, state, and progress tracking
 */

export interface DeploymentConfig {
  projectName: string;
  adminEmail: string;
  customDomain?: string;
  oauthToken: string;
  accountId: string;
  // LINE OA Integration (optional - can configure later)
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  // Facebook Integration (optional - future feature)
  facebookPageAccessToken?: string;
  facebookAppSecret?: string;
}

export interface CloudflareResources {
  d1DatabaseId?: string;
  kvSessionNamespaceId?: string;
  kvCacheNamespaceId?: string;
  r2BucketName?: string;
  queueId?: string;        // Queue ID for deletion
  queueName?: string;      // Queue name for reference
  workerId?: string;
  workerUrl?: string;
  pagesProjectId?: string;
  pagesProjectName?: string;  // Project name for reference
  pagesUrl?: string;
}

export type DeploymentStep =
  | 'initialize'
  | 'create_d1'
  | 'create_kv_session'
  | 'create_kv_cache'
  | 'create_r2'
  | 'create_queue'
  | 'run_migrations'
  | 'generate_config'
  | 'deploy_worker'
  | 'build_frontend'
  | 'deploy_pages'
  | 'configure_domain'
  | 'create_admin'
  | 'send_email'
  | 'verify_health'
  | 'complete';

export type DeploymentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolling_back';

export interface DeploymentState {
  deploymentId: string;
  config: DeploymentConfig;
  status: DeploymentStatus;
  currentStep: DeploymentStep;
  currentStepProgress: number; // 0-100
  totalProgress: number; // 0-100
  resources: CloudflareResources;
  logs: DeploymentLog[];
  error?: DeploymentError;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface DeploymentLog {
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  step: DeploymentStep;
  details?: Record<string, unknown>;
}

export interface DeploymentError {
  code: string;
  message: string;
  step: DeploymentStep;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

export interface AdminCredentials {
  username: string;
  password: string;
  email: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  resources: CloudflareResources;
  credentials?: AdminCredentials;
  urls: {
    frontend: string;
    backend: string;
  };
  message: string;
}

// SSE Event Types
export interface SSEEvent {
  type: 'progress' | 'log' | 'complete' | 'error';
  data: SSEProgressData | SSELogData | SSECompleteData | SSEErrorData;
}

export interface SSEProgressData {
  step: DeploymentStep;
  stepProgress: number;
  totalProgress: number;
  message: string;
}

export interface SSELogData {
  timestamp: number;
  level: DeploymentLog['level'];
  message: string;
  step: DeploymentStep;
}

export interface SSECompleteData {
  deploymentId: string;
  resources: CloudflareResources;
  credentials: AdminCredentials;
  urls: {
    frontend: string;
    backend: string;
  };
}

export interface SSEErrorData {
  error: DeploymentError;
  rollbackInitiated: boolean;
}

// Step Configuration
export interface StepConfig {
  name: DeploymentStep;
  description: string;
  weight: number; // For calculating total progress (sum should be 100)
  timeout: number; // milliseconds
  retryable: boolean;
  maxRetries?: number;
}

export const DEPLOYMENT_STEPS: Record<DeploymentStep, StepConfig> = {
  initialize: {
    name: 'initialize',
    description: 'Initializing deployment',
    weight: 1,
    timeout: 5000,
    retryable: false
  },
  create_d1: {
    name: 'create_d1',
    description: 'Creating D1 Database',
    weight: 8,
    timeout: 60000,
    retryable: true,
    maxRetries: 3
  },
  create_kv_session: {
    name: 'create_kv_session',
    description: 'Creating KV Namespace (Session)',
    weight: 5,
    timeout: 30000,
    retryable: true,
    maxRetries: 3
  },
  create_kv_cache: {
    name: 'create_kv_cache',
    description: 'Creating KV Namespace (Cache)',
    weight: 5,
    timeout: 30000,
    retryable: true,
    maxRetries: 3
  },
  create_r2: {
    name: 'create_r2',
    description: 'Creating R2 Bucket',
    weight: 5,
    timeout: 30000,
    retryable: true,
    maxRetries: 3
  },
  create_queue: {
    name: 'create_queue',
    description: 'Creating Queue',
    weight: 5,
    timeout: 30000,
    retryable: true,
    maxRetries: 3
  },
  run_migrations: {
    name: 'run_migrations',
    description: 'Running database migrations',
    weight: 15,
    timeout: 120000,
    retryable: true,
    maxRetries: 2
  },
  generate_config: {
    name: 'generate_config',
    description: 'Generating configuration files',
    weight: 3,
    timeout: 10000,
    retryable: true,
    maxRetries: 3
  },
  deploy_worker: {
    name: 'deploy_worker',
    description: 'Deploying Worker',
    weight: 12,
    timeout: 90000,
    retryable: true,
    maxRetries: 2
  },
  build_frontend: {
    name: 'build_frontend',
    description: 'Building frontend',
    weight: 10,
    timeout: 120000,
    retryable: true,
    maxRetries: 2
  },
  deploy_pages: {
    name: 'deploy_pages',
    description: 'Deploying Pages',
    weight: 12,
    timeout: 90000,
    retryable: true,
    maxRetries: 2
  },
  configure_domain: {
    name: 'configure_domain',
    description: 'Configuring custom domain',
    weight: 5,
    timeout: 30000,
    retryable: true,
    maxRetries: 3
  },
  create_admin: {
    name: 'create_admin',
    description: 'Creating admin user',
    weight: 5,
    timeout: 20000,
    retryable: true,
    maxRetries: 3
  },
  send_email: {
    name: 'send_email',
    description: 'Sending credentials email',
    weight: 3,
    timeout: 15000,
    retryable: true,
    maxRetries: 3
  },
  verify_health: {
    name: 'verify_health',
    description: 'Verifying deployment health',
    weight: 4,
    timeout: 30000,
    retryable: true,
    maxRetries: 3
  },
  complete: {
    name: 'complete',
    description: 'Deployment complete',
    weight: 2,
    timeout: 5000,
    retryable: false
  }
};
