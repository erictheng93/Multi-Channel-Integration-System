// Integration 模組主要導出檔案
// Main export file for Integration module

// ======================== 處理器導出 ========================
// Active handlers: webhook.ts, channel-handler.ts (registered via src/index.ts)

// ======================== 服務導出 ========================
export { LineIntegrationService } from './services/line-integration-service';
export { FacebookIntegrationService } from './services/facebook-integration-service';
export { CredentialManagementService } from './services/credential-management-service';
export { WebhookRouterService } from './services/webhook-router-service';

// ======================== 內部導入 ========================
import { LineIntegrationService } from '@modules/integrations/services/line-integration-service';
import { FacebookIntegrationService } from '@modules/integrations/services/facebook-integration-service';

// ======================== 類型導出 ========================
export type {
  // 基本類型
  IntegrationPlatform,
  IntegrationStatus,
  CredentialType,
  IntegrationRecord,
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
  IntegrationListQuery,
  IntegrationListResponse,

  // 設定和功能
  IntegrationConfig,
  PlatformFeatures,
  WebhookConfiguration,
  EncryptedCredentials,

  // 統計和健康狀態
  IntegrationStats,
  HealthStatus,
  HealthCheck,

  // 測試相關
  TestIntegrationRequest,
  TestIntegrationResponse,
  TestResult,

  // 批量操作
  BatchIntegrationOperation,
  BatchOperationResult,

  // 平台事件
  PlatformEvent,
  WebhookEventType,
  MessageType,

  // 服務介面
  IIntegrationService,
  IPlatformAdapter,

  // 錯誤類型
  IntegrationNotFoundError,
  IntegrationValidationError,
  PlatformConnectionError,
  CredentialError,

  // 平台特定類型
  LineIntegrationConfig,
  FacebookIntegrationConfig,

  // 工具類型
  IntegrationContext
} from './types/integration-types';

// ======================== 路由系統 ========================
// Active routes are registered directly in src/index.ts via:
// - webhook.ts (LINE + Facebook webhook handlers)
// - channel-handler.ts (channel management)
import { WebhookRouterService } from '@modules/integrations/services/webhook-router-service';
import { CredentialManagementService } from '@modules/integrations/services/credential-management-service';

// Import types for local use
import type { Bindings } from '../../types';
import type {
  FacebookIntegrationConfig,
  IntegrationConfig,
  IntegrationPlatform,
  LineIntegrationConfig
} from '@modules/integrations/types/integration-types';

// ======================== 模組資訊 ========================
export const INTEGRATION_MODULE_INFO = {
  name: 'integration',
  version: '2.0.0',
  description: 'Multi-platform messaging integration module with enterprise-grade security and monitoring',

  features: [
    'Multi-platform integration support (LINE, Facebook, Instagram, Telegram, WhatsApp)',
    'Secure credential management with encryption',
    'Intelligent webhook routing and validation',
    'Comprehensive API endpoints for CRUD operations',
    'Real-time health monitoring and statistics',
    'Batch operations for enterprise management',
    'Platform-specific adapters with unified interface',
    'Advanced testing and validation capabilities',
    'Role-based access control and team management',
    'Audit logging and compliance features'
  ],

  platforms: {
    supported: ['line', 'facebook', 'instagram', 'telegram', 'whatsapp', 'wechat', 'custom'],
    implemented: ['line', 'facebook', 'instagram'],
    planned: ['telegram', 'whatsapp', 'wechat']
  },

  endpoints: {
    total: 15,
    categories: {
      crud: ['POST /', 'GET /', 'GET /:id', 'PUT /:id', 'DELETE /:id'],
      status: ['POST /:id/activate', 'POST /:id/deactivate', 'POST /:id/test'],
      monitoring: ['GET /:id/stats', 'GET /:id/health'],
      webhooks: ['POST /webhooks/:platform/:integrationId'],
      batch: ['POST /batch']
    }
  },

  permissions: {
    admin: {
      description: 'Full integration management access',
      capabilities: [
        'Create, read, update, delete all integrations',
        'Access all statistics and health monitoring',
        'Perform batch operations',
        'Configure webhook endpoints',
        'Manage credentials and security settings'
      ]
    },
    team: {
      description: 'Team-scoped integration management',
      capabilities: [
        'Manage team integrations',
        'View team statistics and health reports',
        'Test integration connections',
        'Update integration configurations'
      ]
    },
    agent: {
      description: 'Limited to assigned integrations',
      capabilities: [
        'View assigned integrations',
        'Update own integration settings',
        'Access basic health information'
      ]
    }
  },

  security: {
    encryption: 'AES-256-GCM for credential storage',
    authentication: 'JWT-based with role verification',
    webhookValidation: 'Platform-specific signature validation',
    audit: 'Complete operation audit trail',
    rateLimit: 'Configurable per platform and endpoint'
  },

  technical: {
    database: 'Cloudflare D1 with optimized queries',
    caching: 'Cloudflare KV for performance optimization',
    storage: 'Encrypted credential storage with key rotation',
    monitoring: 'Real-time health checks and statistics',
    webhooks: 'Multi-platform routing with validation'
  },

  status: {
    development: 'completed',
    testing: 'pending',
    deployment: 'ready',
    integration: 'completed'
  }
} as const;

// ======================== 工廠函數 ========================
/**
 * 創建 Integration 服務實例
 */
export function createIntegrationModule(
  db: D1Database,
  cache: KVNamespace,
  env: Bindings
) {
  const webhookRouter = new WebhookRouterService(env, db, cache);
  const credentialManager = new CredentialManagementService(cache, env);

  return {
    services: {
      webhookRouter,
      credentialManager
    },
    moduleInfo: INTEGRATION_MODULE_INFO,

    // 便利方法
    createLineIntegration: (token: string, secret: string, config: LineIntegrationConfig) =>
      new LineIntegrationService(token, secret, config, env),

    createFacebookIntegration: (token: string, secret: string, pageId: string, config: FacebookIntegrationConfig) =>
      new FacebookIntegrationService(token, secret, pageId, config, env)
  };
}

// ======================== 常數導出 ========================
export const DEFAULT_INTEGRATION_CONFIG = {
  enabled: true,
  autoRetry: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
    burstSize: 10
  },
  messageConfig: {
    maxLength: 2000,
    supportedTypes: ['text', 'image', 'file'],
    autoTranslate: false,
    defaultLanguage: 'zh-TW'
  }
};

export const PLATFORM_CAPABILITIES = {
  line: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: true,
      sendLocation: true,
      sendQuickReply: true,
      sendCarousel: true,
      sendTemplate: true
    },
    advanced: {
      richMenu: true,
      broadcast: true,
      multicast: true,
      push: true,
      userProfile: true
    }
  },
  facebook: {
    messaging: {
      sendText: true,
      sendImage: true,
      sendFile: true,
      sendQuickReply: true,
      sendTemplate: true
    },
    advanced: {
      broadcast: true,
      userProfile: true
    }
  }
};

// ======================== 錯誤處理工具 ========================
export function handleIntegrationError(error: unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  if (error instanceof Error) {
    if (error.message.includes('credentials')) {
      return {
        code: 'INTEGRATION_CREDENTIAL_ERROR',
        message: error.message
      };
    }

    if (error.message.includes('connection')) {
      return {
        code: 'INTEGRATION_CONNECTION_ERROR',
        message: error.message
      };
    }

    if (error.message.includes('validation')) {
      return {
        code: 'INTEGRATION_VALIDATION_ERROR',
        message: error.message
      };
    }

    return {
      code: 'INTEGRATION_ERROR',
      message: error.message
    };
  }

  return {
    code: 'UNKNOWN_INTEGRATION_ERROR',
    message: 'An unknown error occurred in integration module'
  };
}

// ======================== 平台檢查工具 ========================
export function isSupportedPlatform(platform: string): platform is IntegrationPlatform {
  return ['line', 'facebook', 'instagram', 'telegram', 'whatsapp', 'wechat', 'custom'].includes(platform);
}

export function getPlatformCapabilities(platform: IntegrationPlatform) {
  return PLATFORM_CAPABILITIES[platform as keyof typeof PLATFORM_CAPABILITIES] || null;
}

// ======================== 驗證工具 ========================
export function validateIntegrationConfig(config: Partial<IntegrationConfig>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
    errors.push('maxRetries must be between 0 and 10');
  }

  if (config.retryDelayMs && config.retryDelayMs < 100) {
    errors.push('retryDelayMs must be at least 100ms');
  }

  if (config.rateLimit) {
    if (config.rateLimit.maxRequests && config.rateLimit.maxRequests < 1) {
      errors.push('rateLimit.maxRequests must be at least 1');
    }
    if (config.rateLimit.windowMs && config.rateLimit.windowMs < 1000) {
      errors.push('rateLimit.windowMs must be at least 1000ms');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ======================== 預設導出 ========================
export { createIntegrationModule as default };
