// Cloudflare Worker bindings with Drizzle and KV integration
import { Database, KVService } from '../db';
import type { Agent } from '../db/schema';

// Runtime validation for required environment variables
export function validateBindings(bindings: Partial<Bindings>): asserts bindings is Bindings {
  const required = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'JWT_SECRET',
    'ENCRYPTION_KEY'
  ] as const;
  
  for (const key of required) {
    if (!bindings[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export interface Bindings {
  // D1 Databases - Both environments bound
  DB_PROD: D1Database;
  DB_DEV: D1Database;

  // KV Namespaces - Both environments bound
  SESSIONS_PROD: KVNamespace;
  SESSIONS_DEV: KVNamespace;
  CACHE_PROD: KVNamespace;
  CACHE_DEV: KVNamespace;

  // R2 Storage - Both environments bound
  R2_BUCKET_PROD: R2Bucket;
  R2_BUCKET_DEV: R2Bucket;

  // Queues - LINE Async Processing
  // LINE_MESSAGE_QUEUE - Async LINE message delivery
  // Purpose: Decouple HTTP response from LINE API calls for better UX
  LINE_MESSAGE_QUEUE: Queue<LineMessageQueuePayload>;
  LINE_MESSAGE_DLQ: Queue<LineMessageQueuePayload>; // Dead Letter Queue for failed messages

  // These are set by resourceMiddleware based on ENVIRONMENT
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  KV: KVNamespace; // Alias for SESSIONS
  
  // Durable Objects - WebSocket + Durable Objects Architecture
  CONVERSATION_ROOM?: DurableObjectNamespace;
  USER_CONNECTION?: DurableObjectNamespace;
  MESSAGE_BROADCASTER?: DurableObjectNamespace;
  DELAYED_MESSAGE_SCHEDULER?: DurableObjectNamespace; // Unified delayed message scheduling
  DISTRIBUTED_LOCK?: DurableObjectNamespace;
  LATEST_MESSAGE_COORDINATOR?: DurableObjectNamespace; // Phase 1.4b: Batch cache updates via alarm

  // NEW: Customer Conversation System (Chat-Style)
  CUSTOMER_CONVERSATION_DO: DurableObjectNamespace; // Simplified WebSocket management
  CUSTOMER_MESSAGE_DO: DurableObjectNamespace; // Message operations and R2 uploads

  // KV Optimization: Rate Limiter Durable Object
  RATE_LIMITER?: DurableObjectNamespace; // DO-based rate limiting (replaces KV rate:* keys)
  USE_DO_RATE_LIMITER?: string; // Feature flag: 'true' to use DO, 'false' for KV fallback
  
  // Environment variables - LINE
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  LINE_BOT_BASIC_ID: string;
  LINE_BOT_ID?: string; // LINE OA Basic ID for QR Code generation (e.g., @110xsqef)
  LINE_LIFF_ID?: string; // LIFF App ID for team QR Code system

  // KV Cache alias (for backward compatibility)
  KV_CACHE?: KVNamespace;
  
  // Environment variables - JWT and Auth
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  ADMIN_PASSWORD?: string;
  
  // Environment variables - Facebook
  FACEBOOK_PAGE_ACCESS_TOKEN?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_VERIFY_TOKEN?: string;
  FB_PAGE_ACCESS_TOKEN: string;
  FB_APP_SECRET: string;
  FB_VERIFY_TOKEN: string;
  
  // Environment variables - System
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  BACKEND_URL?: string;
  STORAGE_PUBLIC_URL?: string;
  CURRENT_ENVIRONMENT?: string;
  WORKER_URL?: string;
  ADMIN_TOKEN?: string;
  ADDITIONAL_ALLOWED_ORIGINS?: string; // Comma-separated list of additional CORS origins
  
  // Environment variables - Cloudflare
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_D1_TOKEN?: string;
  
  // R2 Storage Configuration
  R2_PUBLIC_DOMAIN?: string; // 公開 R2 域名（用於生成公開 URL）
  WORKER_DOMAIN?: string; // Worker 域名（用於生成檔案下載 URL）

  // File upload settings
  MAX_FILE_SIZE?: string;
  ALLOWED_FILE_TYPES?: string;
  R2_PUBLIC_URL: string;
  R2_CUSTOM_DOMAIN?: string;
  R2_BUCKET_NAME?: string;

  // R2 S3 API Configuration (用於 Presigned URLs)
  // 這些需要通過 Cloudflare Dashboard 創建 R2 API Token 後設置
  R2_ACCOUNT_ID?: string; // Cloudflare Account ID
  R2_ACCESS_KEY_ID?: string; // R2 API Token Access Key ID
  R2_SECRET_ACCESS_KEY?: string; // R2 API Token Secret Access Key
  
  // Additional optional buckets
  FILES?: R2Bucket;
  AVATARS?: R2Bucket;
  FILE_STORAGE: R2Bucket; // Primary file storage for attachments

  // Additional optional queues
  NOTIFICATION_QUEUE?: Queue;
  DELAYED_QUEUE?: Queue;

  // P2-5: Alert System Configuration
  // Email alert settings
  ALERT_EMAIL_ENABLED?: string;
  ALERT_EMAIL_FROM?: string;
  ALERT_EMAIL_TO?: string;
  ALERT_EMAIL_SUBJECT?: string;
  EMAIL_API_KEY?: string;
  EMAIL_API_ENDPOINT?: string;

  // Slack alert settings
  ALERT_SLACK_ENABLED?: string;
  ALERT_SLACK_WEBHOOK_URL?: string;
  ALERT_SLACK_CHANNEL?: string;
  ALERT_SLACK_USERNAME?: string;

  // Webhook alert settings
  ALERT_WEBHOOK_ENABLED?: string;
  ALERT_WEBHOOK_URL?: string;
  ALERT_WEBHOOK_HEADERS?: string;
  ALERT_WEBHOOK_METHOD?: string;

  // Logging Configuration (P2-6)
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
}

// Extended context with database and KV services
export interface AppContext {
  db: Database;
  kv: KVService;
  bindings: Bindings;
}

// Hono context type
export interface HonoContext {
  Bindings: Bindings;
  Variables: {
    db: Database;
    kv: KVService;
    dbService: any;
    conversationService: any;
    agent?: Agent;
  };
}

// Security utility types
export interface SecurityContext {
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  canAccessResource: (resourceId: string, action: string) => boolean;
}

// Audit logging context
export interface AuditContext {
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Export commonly used types from schema
// 注意：使用表名而不是類型名
export type {
  agents,
  conversations,
  messages,
  fileAttachments,
  delayedMessages,
  SessionData,
  teams,
  NewTeam
} from '../db/schema';

// =================== LINE Message Queue Types (Phase 3) ===================

/**
 * LINE Message Queue Payload
 * Represents a message to be sent asynchronously to LINE
 */
export interface LineMessageQueuePayload {
  // Message identification
  messageId: string;
  conversationId: string;

  // Recipient information
  recipientPlatformId: string; // LINE User ID

  // Message content
  content: string;
  messageType: 'text' | 'image' | 'file' | 'flex';

  // Attachments (optional)
  attachments?: LineMessageAttachment[];

  // Metadata for tracking
  metadata: {
    agentId: string;
    agentName?: string;
    enqueuedAt: number; // Unix timestamp
    retryCount?: number;
    originalRequestId?: string;
  };

  // LINE-specific options
  lineOptions?: {
    notificationDisabled?: boolean;
    customAggregationUnit?: string;
  };
}

/**
 * LINE Message Attachment
 */
export interface LineMessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
}

/**
 * LINE Message Queue Result
 * Used for WebSocket status updates
 */
export interface LineMessageQueueResult {
  messageId: string;
  conversationId: string;
  success: boolean;
  deliveredAt?: number;
  error?: string;
  retryCount?: number;
  lineMessageId?: string; // LINE's internal message ID if available
}