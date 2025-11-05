/**
 * Web Installer - Type Exports
 *
 * Central export point for all TypeScript types
 */

// Deployment Types
export type {
  DeploymentConfig,
  DeploymentState,
  DeploymentStep,
  DeploymentStatus,
  DeploymentLog,
  DeploymentError,
  DeploymentResult,
  CloudflareResources,
  AdminCredentials,
  SSEEvent,
  SSEProgressData,
  SSELogData,
  SSECompleteData,
  SSEErrorData,
  StepConfig
} from './deployment';

export { DEPLOYMENT_STEPS } from './deployment';

// Cloudflare API Types
export type {
  CloudflareAPIConfig,
  CloudflareAPIResponse,
  D1Database,
  CreateD1Request,
  D1QueryResult,
  KVNamespace,
  CreateKVRequest,
  R2Bucket,
  CreateR2Request,
  Queue,
  CreateQueueRequest,
  Worker,
  DeployWorkerRequest,
  WorkerBinding,
  PagesProject,
  PagesSource,
  CreatePagesProjectRequest,
  PagesDeployment,
  PagesDeploymentStage,
  DirectUploadRequest,
  CustomDomain,
  AddCustomDomainRequest,
  CloudflareAPIError,
  CloudflareAPIMessage,
  APIRequestOptions
} from './cloudflare';

// Environment Types
export interface Env {
  // Secrets (set via wrangler secret put)
  CF_CLIENT_ID: string;
  CF_CLIENT_SECRET: string;
  RESEND_API_KEY: string;

  // Variables
  ENVIRONMENT?: string;
  FROM_EMAIL?: string;
  SUPPORT_EMAIL?: string;

  // Durable Object bindings
  DEPLOYMENT_ORCHESTRATOR: DurableObjectNamespace;
}

// OAuth Types
export interface OAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface CloudflareUserInfo {
  id: string;
  email: string;
  accounts: Array<{
    id: string;
    name: string;
  }>;
}

// Request/Response Types
export interface StartDeploymentRequest {
  projectName: string;
  adminEmail: string;
  customDomain?: string;
  accountId: string;
  oauthToken: string;
}

export interface StartDeploymentResponse {
  success: boolean;
  deploymentId: string;
  message: string;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}
