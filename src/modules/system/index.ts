// System 模組主要導出檔案
// 統一導出系統模組的所有功能和類型

// ======================== Handlers 導出 ========================
export { systemRouter, SYSTEM_ROUTER_INFO } from './handlers/index';
import systemMainHandler from '@modules/system/handlers/system';
export { systemMainHandler };

// ======================== Services 導出 ========================
export { SystemService } from './services/system-service';

// ======================== Middleware 導出 ========================
export * from './middleware/index';

// ======================== Types 導出 ========================
export * from './types/system-types';

// ======================== 模組資訊 ========================
export const SYSTEM_MODULE_INFO = {
  name: 'system',
  version: '2.0.0',
  description: 'System management and monitoring module with enterprise-grade features',
  routes: {
    base: '/api/system',
    endpoints: [
      // 基本監控
      'GET /health',                        // 健康檢查
      'GET /status',                        // 系統狀態
      'GET /info',                          // 系統資訊
      'GET /diagnostics',                   // 系統診斷

      // API 和統計
      'GET /api',                           // API 資訊
      'GET /stats',                         // 系統統計
      'GET /metrics',                       // 系統指標
      'GET /performance/report',            // 效能報告

      // 設置管理
      'GET /settings',                      // 獲取設置
      'PUT /settings',                      // 更新設置
      'POST /config/validate',              // 配置驗證

      // 平台整合
      'POST /integrations/:platform/test',  // 測試整合

      // 備份和恢復
      'POST /backup',                       // 創建備份
      'GET /backups',                       // 備份列表
      'POST /restore/:backupId',            // 恢復備份

      // 維護操作
      'POST /cache/clear',                  // 清除快取
      'POST /restart',                      // 重啟系統
      'POST /maintenance/mode',             // 維護模式

      // 安全性和日誌
      'GET /security/audit',                // 安全稽核
      'GET /logs/system',                   // 系統日誌

      // 進階功能
      'GET /messages/recall-stats',         // 召回統計
      'GET /messages/:messageId/replies',   // 訊息回覆
      'GET /conversations/:conversationId/message-tree', // 對話樹
      'GET /conversations/:conversationId/sessions',     // 會話統計

      // 模組資訊
      'GET /module-info'                    // 模組資訊
    ]
  },
  features: [
    'Complete health monitoring and status reporting',
    'Comprehensive system metrics and performance tracking',
    'Advanced settings management with validation',
    'Multi-platform integration testing (LINE, Facebook)',
    'Enterprise backup and restore functionality',
    'System maintenance and cache management',
    'Security auditing and access control',
    'Advanced logging and monitoring',
    'Role-based permission system',
    'Rate limiting and request validation',
    'Real-time diagnostics and alerts',
    'Configuration validation and management'
  ],
  permissions: {
    admin: {
      description: 'Full system administration access',
      capabilities: [
        'All monitoring and diagnostic functions',
        'System settings management and updates',
        'Backup creation and restoration',
        'System restart and maintenance mode',
        'Security auditing and advanced features',
        'User and role management',
        'Integration management and testing'
      ]
    },
    team: {
      description: 'Team leader monitoring access',
      capabilities: [
        'Health and status monitoring',
        'Performance metrics and reports',
        'Read-only access to system information',
        'Statistics and analytics viewing',
        'Basic diagnostic information'
      ]
    },
    agent: {
      description: 'Basic health check access',
      capabilities: [
        'Health check endpoint only',
        'Basic system status information'
      ]
    }
  },
  security: {
    authentication: 'JWT-based with role verification',
    authorization: 'Role-based access control (RBAC)',
    rateLimit: 'Configurable per endpoint',
    validation: 'Comprehensive input validation',
    logging: 'Complete operation audit trail'
  },
  dependencies: [
    '../../shared/database/schema',
    '../../shared/utils/api-response',
    '../../shared/utils/error-messages',
    '../../shared/types',
    'drizzle-orm',
    'hono',
    'cloudflare:d1',
    'cloudflare:kv',
    'cloudflare:r2'
  ]
} as const;

// ======================== 服務工廠函數 ========================
import type { Bindings } from '../../types';

/**
 * 創建完整的 System 服務實例
 * 提供統一的系統服務初始化接口
 */
export async function createSystemModule(db: D1Database, cache: KVNamespace, env: Bindings) {
  const { SystemService } = await import('./services/system-service');
  const systemService = new SystemService(db, cache, env);

  return {
    service: systemService,
    router: systemMainHandler,
    moduleInfo: SYSTEM_MODULE_INFO
  };
}

// ======================== 類型守衛和工具函數 ========================

/**
 * 檢查是否為有效的平台
 */
export function isSupportedPlatform(platform: string): platform is 'line' | 'facebook' {
  return ['line', 'facebook'].includes(platform);
}

/**
 * 檢查是否為有效的日誌等級
 */
export function isValidLogLevel(level: string): level is 'error' | 'warn' | 'info' | 'debug' {
  return ['error', 'warn', 'info', 'debug'].includes(level);
}

/**
 * 驗證系統狀態
 */
export function isSystemHealthy(status: any): boolean {
  return status?.overall === 'healthy' || status?.status === 'healthy';
}

/**
 * 格式化系統指標
 */
export function formatSystemMetrics(metrics: any) {
  return {
    timestamp: new Date().toISOString(),
    cpu: metrics.cpu || 'N/A',
    memory: metrics.memory || 'N/A',
    disk: metrics.disk || 'N/A',
    network: metrics.network || { inbound: 'N/A', outbound: 'N/A' },
    requests: metrics.requests || { total: 0, successful: 0, failed: 0 }
  };
}

// ======================== 預設配置 ========================

/**
 * 預設的系統配置
 */
export const DEFAULT_SYSTEM_CONFIG = {
  health: {
    checkIntervalMs: 30000,
    timeoutMs: 5000
  },
  cache: {
    defaultTtl: 3600,
    maxKeys: 10000
  },
  rateLimit: {
    defaultMax: 100,
    defaultWindow: 60
  },
  backup: {
    maxBackups: 10,
    compressionLevel: 6
  },
  logging: {
    defaultLevel: 'info',
    maxLogSize: 1000,
    rotationDays: 7
  }
} as const;

// ======================== 錯誤處理 ========================

/**
 * 統一的系統模組錯誤處理
 */
export function handleSystemError(error: unknown): {
  code: string;
  message: string;
  details?: any;
} {
  if (error instanceof Error) {
    // 檢查是否為已知的系統錯誤類型
    if (error.message.includes('permission')) {
      return {
        code: 'SYSTEM_PERMISSION_DENIED',
        message: error.message
      };
    }

    if (error.message.includes('validation')) {
      return {
        code: 'SYSTEM_VALIDATION_ERROR',
        message: error.message
      };
    }

    if (error.message.includes('rate limit')) {
      return {
        code: 'SYSTEM_RATE_LIMIT_EXCEEDED',
        message: error.message
      };
    }

    return {
      code: 'SYSTEM_ERROR',
      message: error.message
    };
  }

  return {
    code: 'UNKNOWN_SYSTEM_ERROR',
    message: 'An unknown error occurred in system module'
  };
}