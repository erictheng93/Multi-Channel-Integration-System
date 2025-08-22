// Cloudflare Worker bindings with Drizzle and KV integration
import { Database, KVService } from '../db';

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
  // D1 Database
  DB: D1Database;
  
  // KV Namespaces
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  
  // R2 Storage
  R2_BUCKET: R2Bucket;
  
  // Queue
  MESSAGE_QUEUE: Queue;
  
  // Durable Objects (optional)
  CONVERSATION_ROOM?: DurableObjectNamespace;
  
  // Environment variables
  ENVIRONMENT?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  LINE_CHANNEL_SECRET?: string;
  JWT_SECRET?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_D1_TOKEN?: string;
  
  // Additional platform tokens
  FACEBOOK_PAGE_ACCESS_TOKEN?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_VERIFY_TOKEN?: string;
  
  // File upload settings
  MAX_FILE_SIZE?: string;
  ALLOWED_FILE_TYPES?: string;
  R2_PUBLIC_URL?: string;
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
    agent?: {
      id: string;
      username: string;
      role: string;
      permissions: string[];
      sessionId: string;
      lastActivity: Date;
      teamId?: string;
    };
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
export type { 
  User, 
  NewUser, 
  Agent, 
  NewAgent, 
  Conversation, 
  NewConversation, 
  Message, 
  NewMessage,
  FileAttachment,
  NewFileAttachment,
  DelayedMessage,
  NewDelayedMessage,
  SessionData 
} from '../db/schema';