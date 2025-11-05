/**
 * Frontend Type Definitions for Web Installer
 */

// ========================================
// DEPLOYMENT TYPES
// ========================================

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

export type DeploymentStatus = 'idle' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface DeploymentConfig {
  projectName: string;
  adminEmail: string;
  customDomain?: string;
  accountId: string;
  oauthToken: string;
}

export interface DeploymentState {
  deploymentId: string;
  status: DeploymentStatus;
  currentStep: DeploymentStep | null;
  currentStepProgress: number;
  totalProgress: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
  resources: CloudflareResources;
  logs: LogEntry[];
}

export interface CloudflareResources {
  d1DatabaseId?: string;
  kvSessionNamespaceId?: string;
  kvCacheNamespaceId?: string;
  r2BucketName?: string;
  queueName?: string;
  workerName?: string;
  workerUrl?: string;
  pagesProjectName?: string;
  pagesUrl?: string;
  customDomain?: string;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  step?: DeploymentStep;
}

export interface AdminCredentials {
  username: string;
  password: string;
  email: string;
}

// ========================================
// API REQUEST/RESPONSE TYPES
// ========================================

export interface OAuthAuthorizeResponse {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OAuthCallbackResponse {
  success: boolean;
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
  };
  accounts: CloudflareAccount[];
}

export interface CloudflareAccount {
  id: string;
  name: string;
  type?: string;
}

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

export interface DeploymentStatusResponse {
  deploymentId: string;
  status: DeploymentStatus;
  currentStep: DeploymentStep | null;
  currentStepProgress: number;
  totalProgress: number;
  resources: CloudflareResources;
  logs: LogEntry[];
  error?: string;
  credentials?: AdminCredentials;
}

// ========================================
// SSE EVENT TYPES
// ========================================

export type SSEEventType = 'progress' | 'log' | 'error' | 'complete' | 'cancelled';

export interface SSEEvent {
  type: SSEEventType;
  data: SSEEventData;
}

export type SSEEventData =
  | ProgressEventData
  | LogEventData
  | ErrorEventData
  | CompleteEventData
  | CancelledEventData;

export interface ProgressEventData {
  step: DeploymentStep;
  stepProgress: number;
  totalProgress: number;
}

export interface LogEventData {
  level: LogLevel;
  message: string;
  step?: DeploymentStep;
}

export interface ErrorEventData {
  error: string;
  step?: DeploymentStep;
}

export interface CompleteEventData {
  deploymentId: string;
  resources: CloudflareResources;
  credentials: AdminCredentials;
  duration: number;
}

export interface CancelledEventData {
  reason: string;
}

// ========================================
// UI STATE TYPES
// ========================================

export interface FormErrors {
  projectName?: string;
  adminEmail?: string;
  customDomain?: string;
  accountId?: string;
}

export interface RouteParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}
