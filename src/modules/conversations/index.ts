// ============================================================================
// CONVERSATIONS Module - 對話管理模組
// 處理客戶對話的完整生命週期管理，包含訊息處理、狀態管理和分配功能
// ============================================================================

// ======================== 類型導出 ========================
export type * from './types/conversation-types';

// ======================== 服務導出 ========================
export { ConversationService } from './services/conversation-service';

// ======================== 處理器導出 ========================
export { conversationsMainHandler } from './handlers/index';
// Note: conversationHandler from './handlers/conversation' removed (dead code)
export { default as conversationsHandler } from './handlers/index';

// ======================== 中間件導出 ========================
// 未來可擴展對話相關中間件

// ======================== 工具函數導出 ========================
// 未來可擴展對話相關工具函數

// ======================== 常數導出 ========================
export const CONVERSATION_CONSTANTS = {
  MAX_CONVERSATION_TITLE_LENGTH: 200,
  MAX_MESSAGE_LENGTH: 4000,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  CONVERSATION_STATUS: {
    ACTIVE: 'active',
    PENDING: 'pending',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in-progress',
    WAITING: 'waiting'
  }
} as const;

// ======================== 模組配置 ========================
export interface ConversationsModuleConfig {
  maxMessageLength: number;
  defaultPageSize: number;
  maxPageSize: number;
  autoAssignment: boolean;
  enableMetrics: boolean;
  cacheEnabled: boolean;
}

export const DEFAULT_CONVERSATIONS_MODULE_CONFIG: ConversationsModuleConfig = {
  maxMessageLength: 4000,
  defaultPageSize: 20,
  maxPageSize: 100,
  autoAssignment: true,
  enableMetrics: true,
  cacheEnabled: true
};

// ======================== 模組資訊 ========================
export const MODULE_INFO = {
  name: 'conversations',
  version: '1.0.0',
  description: '對話管理核心模組，提供完整的客戶對話處理功能',

  features: [
    '對話列表與分頁',
    '訊息管理與追蹤',
    '對話分配與轉移',
    '狀態管理與更新',
    '搜尋與篩選功能',
    '指標統計與分析',
    '實時通知與更新',
    '附件處理與管理'
  ],

  endpoints: {
    total: 12,
    implemented: 12,
    pending: 0,
    categories: {
      conversation: 6,  // list, get, create, update, delete, assign
      message: 4, // list, send, recall, update
      status: 2 // update, history
    }
  },

  permissions: {
    admin: {
      description: '完整對話系統管理權限',
      actions: ['view_all_conversations', 'manage_assignments', 'system_settings']
    },
    team: {
      description: '團隊範圍對話管理權限',
      actions: ['view_team_conversations', 'manage_team_assignments', 'view_metrics']
    },
    agent: {
      description: '基本對話處理權限',
      actions: ['view_assigned_conversations', 'send_messages', 'update_status']
    }
  },

  technical: {
    database: ['conversations', 'messages', 'conversation_assignments'],
    cache: ['conversation_cache', 'message_cache'],
    dependencies: ['shared/database', 'shared/utils', 'auth'],
    middleware: ['auth', 'validation', 'rate-limiting']
  },

  status: {
    development: 'completed' as const,
    testing: 'completed' as const,
    deployment: 'completed' as const,
    integration: 'completed' as const
  }
} as const;

// ======================== 初始化函數 ========================
export function initializeConversationsModule(config: Partial<ConversationsModuleConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONVERSATIONS_MODULE_CONFIG, ...config };

  // 驗證配置
  if (finalConfig.maxMessageLength < 100) {
    console.warn(' Conversations module: maxMessageLength too short, setting to 100');
    finalConfig.maxMessageLength = 100;
  }

  if (finalConfig.defaultPageSize < 1) {
    console.warn(' Conversations module: defaultPageSize must be at least 1');
    finalConfig.defaultPageSize = 1;
  }

  return {
    config: finalConfig,
    moduleInfo: MODULE_INFO,
    constants: CONVERSATION_CONSTANTS
  };
}

// ======================== 向後兼容 ========================
export { conversationsMainHandler as default } from './handlers/index';

// Legacy exports for backward compatibility
export const CONVERSATIONS_MODULE_CONFIG = {
  name: 'conversations',
  version: '1.0.0',
  dependencies: ['shared/database', 'shared/utils', 'auth'],
  features: [
    'conversation_listing',
    'message_management',
    'conversation_assignment',
    'status_management',
    'search_and_filtering',
    'metrics_and_analytics'
  ]
} as const;