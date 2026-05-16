// Messaging 模組主要導出檔案
// 統一導出訊息模組的所有功能和類型

// ======================== Handlers 導出 ========================
// Active handler: handlers/messaging/index.ts (modular orchestrator, registered via src/handlers/index.ts)

// ======================== Services 導出 ========================
export { MessageCrudService } from './services/message-crud';
export { DelayedMessageService } from './services/delayed-message-service';
export { MessageRecallService } from './services/message-recall-service';
export { createMessagingServices } from './services/index';
export type { MessagingServices } from './services/index';

// ======================== Middleware 導出 ========================
export * from './middleware/index';

// ======================== Types 導出 ========================
export * from './types/message-types';

// ======================== 模組資訊 ========================
export const MESSAGING_MODULE_INFO = {
  name: 'messaging',
  version: '1.0.0',
  description: 'Unified messaging module with delayed send, recall, and batch operations',
  routes: {
    base: '/api/messages',
    endpoints: [
      // Basic CRUD
      'POST /', // Create message
      'GET /:id', // Get message details
      'PUT /:id', // Update message
      'HEAD /:id', // Check message exists
      'GET /:id/can-recall', // Check recall eligibility

      // Conversation messages
      'GET /conversation/:conversationId', // Get conversation messages

      // Search operations
      'GET /search', // Quick search
      'POST /advanced-search', // Advanced search with filters

      // Statistics
      'GET /stats', // General message stats

      // Delayed messaging
      'POST /delayed', // Schedule delayed message
      'GET /delayed', // List delayed messages
      'GET /delayed/:id', // Get delayed message details
      'PUT /delayed/:id', // Update delayed message
      'DELETE /delayed/:id', // Cancel delayed message

      // Message recall
      'POST /:id/recall', // Recall message
      'GET /recall/:id', // Get recall details
      'GET /recalls', // List recall history

      // Batch operations
      'POST /batch/send', // Batch send messages
      'GET /batch/:operationId', // Get batch operation status
      'DELETE /batch/:operationId', // Cancel batch operation

      // Attachments
      'POST /:id/attachments', // Add attachments
      'GET /:id/attachments', // Get message attachments
      'DELETE /:id/attachments/:attachmentId', // Remove attachment

      // Reactions and interactions
      'POST /:id/reactions', // Add reaction
      'DELETE /:id/reactions', // Remove reaction
      'POST /:id/read', // Mark as read
    ]
  },
  features: [
    'Real-time messaging with multi-platform support',
    'Delayed message sending (1-120 seconds)',
    'Advanced message recall functionality',
    'Batch operations for high-volume scenarios',
    'File attachments with R2 integration',
    'Comprehensive search and filtering',
    'Message statistics and analytics',
    'Reactions and read receipts',
    'Multi-platform delivery (LINE, Facebook, WebChat)',
    'Queue-based processing with Cloudflare Queues',
    'Enterprise-grade error handling and logging',
    'Role-based access control integration'
  ],
  supportedPlatforms: ['line', 'facebook', 'webchat'],
  validationRules: {
    content: {
      maxLength: 5000,
      minLength: 1,
      allowedTypes: ['text', 'image', 'video', 'audio', 'file', 'sticker', 'location']
    },
    delayedSend: {
      minDelaySeconds: 1,
      maxDelaySeconds: 120
    },
    attachments: {
      maxSize: 10 * 1024 * 1024, // 10MB
      maxCount: 5
    },
    batch: {
      maxBatchSize: 100,
      maxConcurrentBatches: 5
    }
  },
  dependencies: [
    '../../shared/database/schema',
    '../../shared/utils/api-response',
    '../../shared/utils/drizzle-converters',
    '../../shared/types',
    'drizzle-orm',
    'hono',
    'cloudflare:queues'
  ]
} as const;

// ======================== 服務工廠函數 ========================
import type { Bindings } from '../../types';
import type { D1Database } from '@cloudflare/workers-types';
import { createMessagingServices } from '@modules/messaging/services';

/**
 * 創建完整的 Messaging 服務集合
 * 提供統一的服務初始化接口
 */
export function createMessagingModule(db: D1Database, env: Bindings) {
  const services = createMessagingServices(db, env);

  return {
    services,
    moduleInfo: MESSAGING_MODULE_INFO
  };
}

// ======================== 類型守衛和工具函數 ========================

/**
 * 檢查是否為有效的訊息類型
 */
export function isValidMessageType(type: string): type is import('./types/message-types').MessageType {
  return ['text', 'image', 'video', 'audio', 'file', 'sticker', 'location'].includes(type);
}

/**
 * 檢查是否為有效的發送者類型
 */
export function isValidSenderType(type: string): type is import('./types/message-types').SenderType {
  return ['customer', 'agent', 'system'].includes(type);
}

/**
 * 檢查是否為支援的平台
 */
export function isSupportedPlatform(platform: string): platform is import('./types/message-types').Platform {
  return ['line', 'facebook', 'webchat'].includes(platform);
}

/**
 * 驗證延遲發送秒數
 */
export function isValidDelaySeconds(seconds: number): boolean {
  const { minDelaySeconds, maxDelaySeconds } = MESSAGING_MODULE_INFO.validationRules.delayedSend;
  return seconds >= minDelaySeconds && seconds <= maxDelaySeconds;
}

/**
 * 驗證訊息內容長度
 */
export function isValidMessageContent(content: string): boolean {
  const { minLength, maxLength } = MESSAGING_MODULE_INFO.validationRules.content;
  return content.length >= minLength && content.length <= maxLength;
}

// ======================== 預設配置 ========================

/**
 * 預設的訊息配置
 */
export const DEFAULT_MESSAGING_CONFIG = {
  pagination: {
    defaultLimit: 50,
    maxLimit: 100
  },
  search: {
    defaultLimit: 20,
    maxLimit: 50
  },
  recall: {
    defaultDeadlineMinutes: 60, // 1 hour
    maxDeadlineHours: 24
  },
  batch: {
    defaultBatchSize: 20,
    processingTimeoutMs: 30000
  }
} as const;

// ======================== 錯誤處理 ========================

interface CodedError extends Error {
  code: string;
  details?: unknown;
}

function hasErrorCode(error: Error): error is CodedError {
  return 'code' in error && typeof (error as { code?: unknown }).code === 'string';
}

/**
 * 統一的訊息模組錯誤處理
 */
export function handleMessagingError(error: unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  if (error instanceof Error) {
    // 檢查是否為已知的訊息錯誤類型
    if (hasErrorCode(error)) {
      return {
        code: error.code,
        message: error.message,
        details: error.details
      };
    }

    return {
      code: 'MESSAGING_ERROR',
      message: error.message
    };
  }

  return {
    code: 'UNKNOWN_MESSAGING_ERROR',
    message: 'An unknown error occurred in messaging module'
  };
}
