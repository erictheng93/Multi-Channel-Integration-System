// Cloudflare Worker bindings with Drizzle and KV integration
import { Database, KVService } from '../db';
import type { Agent } from '../db/schema';

// Runtime validation for required environment variables
export function validateBindings(bindings: Partial<Bindings>): asserts bindings is Bindings {
  const required = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET', 
    'JWT_SECRET'
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
  
  // Queues - Both environments bound
  AGENT_QUEUE_PROD: Queue;
  AGENT_QUEUE_DEV: Queue;
  REALTIME_QUEUE_PROD: Queue;
  REALTIME_QUEUE_DEV: Queue;
  
  // These are set by resourceMiddleware based on ENVIRONMENT
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  AGENT_QUEUE: Queue;
  REALTIME_QUEUE: Queue;
  KV: KVNamespace; // Alias for SESSIONS
  
  // Durable Objects (optional)
  CONVERSATION_ROOM?: DurableObjectNamespace;
  
  // Environment variables - LINE
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  LINE_BOT_BASIC_ID: string;
  
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
  CURRENT_ENVIRONMENT?: string;
  
  // Environment variables - Cloudflare
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_D1_TOKEN?: string;
  
  // File upload settings
  MAX_FILE_SIZE?: string;
  ALLOWED_FILE_TYPES?: string;
  R2_PUBLIC_URL: string;
  R2_CUSTOM_DOMAIN?: string;
  R2_BUCKET_NAME?: string;
  
  // Additional optional buckets
  FILES?: R2Bucket;
  AVATARS?: R2Bucket;
  
  // Additional optional queues
  NOTIFICATION_QUEUE?: Queue;
  DELAYED_QUEUE?: Queue;
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