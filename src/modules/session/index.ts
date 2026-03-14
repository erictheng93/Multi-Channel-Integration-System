// ============================================================================
// SESSION Module - 會話管理模組
// 處理對話會話的生命週期管理、邊界檢測和智能分析功能
// ============================================================================

// ======================== 類型導出 ========================
export type {
  // 基本類型
  ConversationSession,
  CreateSessionData,
  UpdateSessionData,
  SessionListQuery,
  SessionSearchQuery,
  SessionListResponse,

  // 統計和分析類型
  SessionStats,
  SessionActivityStats,
  SessionBoundaryDetection,
  SessionMessage,
  SessionMessagesResponse,

  // 批量操作類型
  BatchSessionOperation,
  BatchOperationResult,

  // 服務介面類型
  SessionServiceInterface,
  SessionContext,

  // 配置類型
  SessionConfig,

  // 錯誤類型
  SessionNotFoundError,
  SessionValidationError,
  SessionOperationError
} from './types/session-types';

// ======================== 服務導出 ========================
export { SessionService } from './services/session-service';

// ======================== 處理器導出 ========================
export { sessionRouter, sessionMainHandler } from './handlers/index';
export { default as sessionHandler } from './handlers/session-main';

// ======================== 中間件導出 ========================
export {
  // 權限控制
  checkSessionAccess,
  checkSessionViewPermission,
  checkSessionCreatePermission,
  checkSessionUpdatePermission,
  checkSessionDeletePermission,
  checkSessionStatsPermission,
  checkSessionBatchPermission,
  logSessionOperation,

  // 資料驗證
  validateRequestSize,
  validateRateLimit,
  validateSessionId,
  validateConversationId,
  validateCreateSessionData,
  validateUpdateSessionData,
  validateSessionListQuery,
  validateSessionSearchQuery,
  validateBatchSessionOperation,

  // 工具函數
  sanitizeString,
  validateNumberRange,
  validateUUID,
  validateISODate,

  // 中間件配置
  createSessionMiddleware,
  createSessionOperationMiddleware,
  isMiddlewareEnabled,
  addMiddleware,
  removeMiddleware
} from './middleware/index';

export type {
  SessionPermissions,
  SessionAccessScope,
  SessionMiddlewareConfig
} from './middleware/index';

// ======================== 工具函數導出 ========================
// 會話相關工具函數已整合在中間件中

// ======================== 常數導出 ========================
export {
  DEFAULT_SESSION_CONFIG,
  DEFAULT_PAGINATION,
  SESSION_TYPES,
  PRIORITY_LEVELS,
  SENTIMENT_TYPES
} from './types/session-types';

export {
  DEFAULT_SESSION_MIDDLEWARE_CONFIG
} from './middleware/index';

export {
  SESSION_ROUTER_INFO
} from './handlers/index';

// ======================== 模組配置 ========================
export interface SessionModuleConfig {
  maxSessionDuration: number;
  inactivityTimeout: number;
  autoArchiveAfter: number;
  maxMessagesPerSession: number;
  enableBoundaryDetection: boolean;
  enableSentimentAnalysis: boolean;
  batchOperationLimit: number;
}

export const DEFAULT_SESSION_MODULE_CONFIG: SessionModuleConfig = {
  maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
  autoArchiveAfter: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxMessagesPerSession: 1000,
  enableBoundaryDetection: true,
  enableSentimentAnalysis: true,
  batchOperationLimit: 100
};

// ======================== 模組資訊 ========================
export const MODULE_INFO = {
  name: 'session',
  version: '2.0.0',
  description: 'Conversation session management module with intelligent boundary detection and comprehensive analytics',

  // 功能特色
  features: [
    'Intelligent session boundary detection',
    'Comprehensive session lifecycle management',
    'Message association and sequencing',
    'Advanced statistics and analytics',
    'Batch operations support',
    'Real-time activity tracking',
    'Search and filtering capabilities',
    'Session health monitoring',
    'Topic extraction and sentiment analysis',
    'Role-based access control'
  ],

  // API 端點統計
  endpoints: {
    total: 20,
    implemented: 16,
    pending: 4,
    categories: {
      basic: 4, // health, info, status, config
      crud: 5, // create, read, update, delete, list
      management: 3, // close, reopen, health
      search: 1, // search
      messages: 1, // get messages
      statistics: 3, // stats, activity
      batch: 1, // batch operations
      testing: 1, // boundary detection test
      maintenance: 2 // cleanup, export
    }
  },

  // 權限層級
  permissions: {
    admin: {
      description: 'Full session management access',
      capabilities: [
        'Create, read, update, delete all sessions',
        'Access all statistics and analytics',
        'Perform batch operations',
        'Execute maintenance operations',
        'Configure session settings'
      ]
    },
    team: {
      description: 'Team-scoped session management',
      capabilities: [
        'Manage team conversations sessions',
        'View team statistics',
        'Perform limited batch operations',
        'Access session health reports'
      ]
    },
    agent: {
      description: 'Limited to assigned conversations',
      capabilities: [
        'View and manage assigned conversation sessions',
        'Create new sessions in assigned conversations',
        'View basic session information'
      ]
    }
  },

  // 技術規格
  technical: {
    database: 'Cloudflare D1 with Drizzle ORM',
    caching: 'Cloudflare KV for session data',
    authentication: 'JWT with role-based access control',
    validation: 'Comprehensive input validation and sanitization',
    rateLimit: 'Configurable rate limiting',
    logging: 'Structured logging with operation tracking'
  },

  // 實作詳細規格
  implementation: {
    database: ['conversation_sessions', 'session_messages', 'session_stats'],
    cache: ['session_cache', 'boundary_cache'],
    dependencies: ['shared/database', 'shared/utils', 'auth'],
    middleware: ['session-auth', 'session-validation', 'rate-limiting']
  },

  // 模組狀態
  status: {
    development: 'completed' as const,
    testing: 'pending' as const,
    deployment: 'pending' as const,
    integration: 'in_progress' as const
  }
} as const;

// ======================== 初始化函數 ========================
export function initializeSessionModule(config: Partial<SessionModuleConfig> = {}) {
  const finalConfig = { ...DEFAULT_SESSION_MODULE_CONFIG, ...config };

  // 驗證配置
  if (finalConfig.maxSessionDuration < 60000) { // min 1 minute
    console.warn(' Session module: maxSessionDuration too short, setting to 1 minute');
    finalConfig.maxSessionDuration = 60000;
  }

  if (finalConfig.maxMessagesPerSession < 1) {
    console.warn(' Session module: maxMessagesPerSession must be at least 1');
    finalConfig.maxMessagesPerSession = 1;
  }

  return {
    config: finalConfig,
    moduleInfo: MODULE_INFO
  };
}

// ======================== 向後兼容 ========================
export { sessionRouter as default } from './handlers/index';

// Legacy exports for backward compatibility
export const SESSION_MODULE_INFO = MODULE_INFO;