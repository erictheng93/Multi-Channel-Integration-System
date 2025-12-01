// QRCode 模組主要導出檔案
// 統一導出 QRCode 模組的所有功能和類型

// ======================== Handlers 導出 ========================
export { qrCodeRouter, qrCodeMainHandler, QR_CODE_ROUTER_INFO } from './handlers/index';
export type { QRCodeMainHandler } from './handlers/qrcode-main';

// ======================== Services 導出 ========================
export { QRCodeGenerationService, QRCodeContentProcessor, QRCodeGenerationEngine } from './services/qrcode-generation-service';
export { QRCodeCrudService } from './services/qrcode-crud-service';

// ======================== Middleware 導出 ========================
export {
  qrCodeAuthMiddleware,
  requireCreatePermission,
  requireManagePermission,
  requireReadPermission,
  requireBatchPermission,
  requireAdminPermission,
  requireStatsPermission,
  qrCodeCreateRateLimit,
  qrCodeScanRateLimit,
  validateCreateRequest,
  validateUpdateRequest,
  validateQueryParams,
  validateBatchRequest,
  createQRCodeMiddleware,
  manageQRCodeMiddleware,
  readQRCodeMiddleware,
  listQRCodeMiddleware,
  qrCodeErrorHandler,
  qrCodeLoggerMiddleware,
  QR_CODE_MIDDLEWARE_CONFIG
} from './middleware/index';

// ======================== Types 導出 ========================
export type {
  QRCodeType,
  QRCodeErrorCorrectionLevel,
  QRCodeOutputFormat,
  QRCodeStatus,
  QRCodeRecord,
  CreateQRCodeRequest,
  UpdateQRCodeRequest,
  QRCodeGenerationOptions,
  QRCodeListQuery,
  QRCodeListResponse,
  QRCodeDetailResponse,
  QRCodeStatsQuery,
  QRCodeStatsResponse,
  BatchQRCodeRequest,
  BatchQRCodeResponse,
  IQRCodeService,
  QRCodeMiddlewareContext,
  QRCodeErrorCode,
  QRCodeError,
  QRCodePermission
} from './types/qrcode-types';

export { QR_CODE_DEFAULTS, QR_CODE_PERMISSIONS } from './types/qrcode-types';

// ======================== 模組資訊 ========================
export const QRCODE_MODULE_INFO = {
  name: 'qrcode',
  version: '1.0.0',
  description: 'Comprehensive QR Code management and generation module with enterprise features',

  routes: {
    base: '/api/qrcodes',
    publicBase: '/scan',
    endpoints: [
      // 基本 CRUD
      'GET /',                                    // List QR codes with filters
      'POST /',                                   // Create new QR code
      'GET /:id',                                // Get QR code details
      'PUT /:id',                                // Update QR code
      'DELETE /:id',                             // Delete QR code (soft delete)
      'HEAD /:id',                               // Check if QR code exists

      // QR Code 生成和管理
      'POST /:id/regenerate',                    // Regenerate QR code
      'GET /:id/image',                          // Get QR code image
      'GET /:id/download/:format',               // Download QR code in specific format
      'GET /:id/preview',                        // Preview QR code without tracking

      // 狀態管理
      'POST /:id/enable',                        // Enable QR code
      'POST /:id/disable',                       // Disable QR code
      'PUT /:id/expiry',                         // Set QR code expiry

      // 統計和分析
      'GET /stats/overview',                     // Get QR code statistics overview
      'GET /:id/scans',                          // Get scan history for QR code
      'POST /:id/scan',                          // Record QR code scan
      'GET /stats/types',                        // Get QR code type distribution
      'GET /stats/trends',                       // Get scan trends

      // 搜尋和過濾
      'GET /search',                             // Quick search QR codes
      'POST /advanced-search',                   // Advanced search with filters
      'GET /type/:type',                         // Get QR codes by type
      'GET /tags/:tag',                          // Get QR codes by tag

      // 批次操作
      'POST /batch/create',                      // Batch create QR codes
      'PUT /batch/update',                       // Batch update QR codes
      'DELETE /batch/delete',                    // Batch delete QR codes
      'POST /batch/status',                      // Batch update QR code status

      // 模板功能
      'GET /templates',                          // Get QR code templates
      'POST /templates/:templateId/create',      // Create from template
      'POST /:id/save-template',                 // Save QR code as template

      // 標籤管理
      'GET /tags/available',                     // Get available tags
      'POST /:id/tags',                          // Add tags to QR code
      'DELETE /:id/tags',                        // Remove tags from QR code
      'GET /tags/stats',                         // Get tag usage statistics

      // 導出功能
      'GET /export/data',                        // Export QR codes data
      'GET /export/images',                      // Export QR code images
      'GET /export/report',                      // Export statistics report

      // 公開端點
      'GET /scan/:id',                           // Scan QR code and redirect
      'GET /public/:id/info',                    // Get public QR code info

      // 管理員功能
      'GET /admin/system-stats',                 // Get system QR code statistics
      'POST /admin/cleanup',                     // Cleanup expired QR codes
      'POST /admin/rebuild-cache',               // Rebuild statistics cache
    ]
  },

  features: [
    'Multi-type QR code generation (URL, text, contact, WiFi, SMS, email, etc.)',
    'Advanced QR code customization (size, colors, logo, error correction)',
    'Multiple output formats (PNG, JPG, SVG, PDF, Base64)',
    'Enterprise role-based access control',
    'Comprehensive statistics and analytics',
    'Tag-based organization and filtering',
    'Template system for common use cases',
    'Batch operations for high-volume scenarios',
    'Real-time scan tracking and monitoring',
    'Rate limiting and quota management',
    'Advanced search and filtering capabilities',
    'Export functionality for data and reports',
    'Public scanning endpoints with privacy controls',
    'Caching and performance optimization',
    'Comprehensive error handling and validation'
  ],

  supportedQRTypes: [
    'url',      // URL links
    'text',     // Plain text
    'contact',  // vCard contact information
    'wifi',     // WiFi network credentials
    'sms',      // SMS message
    'email',    // Email composition
    'phone',    // Phone number
    'event',    // Calendar event
    'location', // Geographic location
    'app',      // App store links
    'social'    // Social media profiles
  ],

  supportedFormats: [
    'png',    // Portable Network Graphics
    'jpg',    // JPEG image
    'svg',    // Scalable Vector Graphics
    'pdf',    // Portable Document Format
    'base64'  // Base64 encoded data
  ],

  permissions: {
    admin: {
      description: 'Full QR code administration access',
      capabilities: [
        'Create, read, update, delete any QR code',
        'Access all statistics and analytics',
        'Perform batch operations',
        'Manage templates and tags',
        'Access admin functions and system stats',
        'Export data and reports',
        'Manage team quotas and settings'
      ]
    },
    team: {
      description: 'Team leader QR code management',
      capabilities: [
        'Create, read, update, delete team QR codes',
        'View team statistics and analytics',
        'Perform batch operations',
        'Manage team templates and tags',
        'Export team data and reports'
      ]
    },
    agent: {
      description: 'Basic QR code operations',
      capabilities: [
        'Create, read, update own QR codes',
        'View basic statistics',
        'Use existing templates',
        'Basic search and filtering'
      ]
    }
  },

  rateLimit: {
    create: { max: 10, window: 3600 },     // 10 per hour
    scan: { max: 1000, window: 3600 },     // 1000 per hour
    batch: { max: 5, window: 3600 },       // 5 per hour
    export: { max: 3, window: 3600 },      // 3 per hour
    default: { max: 100, window: 3600 }    // 100 per hour
  },

  quotas: {
    maxQRCodesPerTeam: 1000,
    maxQRCodesPerUser: 100,
    maxBatchSize: 50,
    maxTagsPerQRCode: 10,
    maxContentLength: 4296,
    maxCustomDataSize: 5000
  },

  security: {
    authentication: 'JWT-based with role verification',
    authorization: 'Role-based access control (RBAC)',
    validation: 'Comprehensive input validation and sanitization',
    rateLimit: 'Configurable per endpoint and user',
    logging: 'Complete operation audit trail',
    encryption: 'Data encryption at rest and in transit'
  },

  dependencies: [
    '../../shared/database/schema',
    '../../shared/utils/api-response',
    '../../shared/utils/error-messages',
    '../../shared/types',
    'drizzle-orm',
    'hono'
  ],

  databaseTables: [
    'qr_codes',
    'qr_code_scans',
    'qr_code_analytics',
    'qr_code_templates',
    'qr_code_tags',
    'qr_code_tag_relations'
  ]
} as const;

// ======================== 服務工廠函數 ========================
import type { Bindings } from '../../types';

/**
 * 創建完整的 QRCode 模組實例
 * 提供統一的服務初始化接口
 */
export function createQRCodeModule(db: D1Database, cache?: KVNamespace, storage?: R2Bucket) {
  // Note: Services are implemented in services/ directory
  // Using null as placeholders - instantiate services when module initialization is needed
  const crudService = null as any; // QRCodeCrudService is available in services/qrcode-crud-service.ts

  return {
    services: {
      crud: crudService,
      generation: null as any // QRCodeGenerationService
    },
    handlers: {
      main: null as any, // qrCodeMainHandler,
      router: null as any // qrCodeRouter
    },
    middleware: {
      auth: null as any, // qrCodeAuthMiddleware,
      createPermission: null as any, // requireCreatePermission,
      managePermission: null as any, // requireManagePermission,
      readPermission: null as any, // requireReadPermission,
      validation: {
        create: null as any, // validateCreateRequest,
        update: null as any, // validateUpdateRequest,
        query: null as any, // validateQueryParams,
        batch: null as any // validateBatchRequest
      },
      rateLimit: {
        create: null as any, // qrCodeCreateRateLimit,
        scan: null as any // qrCodeScanRateLimit
      },
      errorHandler: null as any, // qrCodeErrorHandler,
      logger: null as any // qrCodeLoggerMiddleware
    },
    moduleInfo: QRCODE_MODULE_INFO
  };
}

// ======================== 類型守衛和工具函數 ========================

/**
 * 檢查是否為有效的 QR Code 類型
 */
export function isValidQRCodeType(type: string): type is import('./types/qrcode-types').QRCodeType {
  return QRCODE_MODULE_INFO.supportedQRTypes.includes(type as any);
}

/**
 * 檢查是否為有效的輸出格式
 */
export function isValidOutputFormat(format: string): format is import('./types/qrcode-types').QRCodeOutputFormat {
  return QRCODE_MODULE_INFO.supportedFormats.includes(format as any);
}

/**
 * 檢查是否為有效的錯誤修正等級
 */
export function isValidErrorCorrectionLevel(level: string): level is import('./types/qrcode-types').QRCodeErrorCorrectionLevel {
  return ['L', 'M', 'Q', 'H'].includes(level);
}

/**
 * 檢查用戶是否有指定權限
 */
export function hasQRCodePermission(userRole: string, permission: string): boolean {
  const rolePermissions = QRCODE_MODULE_INFO.permissions[userRole as keyof typeof QRCODE_MODULE_INFO.permissions];
  if (!rolePermissions) return false;

  // 簡化權限檢查 - 實際實現可能更複雜
  return userRole === 'admin' ||
         (userRole === 'team' && !permission.includes('admin')) ||
         (userRole === 'agent' && ['create', 'read', 'update'].some(p => permission.includes(p)));
}

/**
 * 獲取用戶配額限制
 */
export function getQRCodeQuota(userRole: string): { maxQRCodes: number; maxBatchSize: number } {
  switch (userRole) {
    case 'admin':
      return {
        maxQRCodes: QRCODE_MODULE_INFO.quotas.maxQRCodesPerTeam * 10,
        maxBatchSize: QRCODE_MODULE_INFO.quotas.maxBatchSize
      };
    case 'team':
      return {
        maxQRCodes: QRCODE_MODULE_INFO.quotas.maxQRCodesPerTeam,
        maxBatchSize: QRCODE_MODULE_INFO.quotas.maxBatchSize
      };
    case 'agent':
    default:
      return {
        maxQRCodes: QRCODE_MODULE_INFO.quotas.maxQRCodesPerUser,
        maxBatchSize: Math.floor(QRCODE_MODULE_INFO.quotas.maxBatchSize / 2)
      };
  }
}

/**
 * 格式化 QR Code 統計數據
 */
export function formatQRCodeStats(stats: any) {
  return {
    overview: {
      totalQRCodes: stats.totalQRCodes || 0,
      activeQRCodes: stats.activeQRCodes || 0,
      totalScans: stats.totalScans || 0,
      averageScansPerQRCode: stats.totalQRCodes > 0 ?
        Math.round((stats.totalScans || 0) / stats.totalQRCodes) : 0
    },
    distribution: stats.typeDistribution || [],
    trends: stats.scanTrends || [],
    topPerformers: stats.topQRCodes || []
  };
}

// ======================== 預設配置 ========================

/**
 * QRCode 模組預設配置
 */
export const DEFAULT_QRCODE_CONFIG = {
  generation: {
    defaultSize: 300,
    defaultErrorCorrectionLevel: 'M' as const,
    defaultOutputFormat: 'png' as const,
    defaultForegroundColor: '#000000',
    defaultBackgroundColor: '#FFFFFF',
    defaultBorderWidth: 0,
    includeMargin: true
  },

  caching: {
    qrCodeDetailTtl: 300,     // 5 minutes
    qrCodeListTtl: 60,        // 1 minute
    statsTtl: 900,            // 15 minutes
    imageTtl: 3600            // 1 hour
  },

  validation: {
    maxNameLength: 100,
    maxDescriptionLength: 500,
    maxContentLength: 4296,
    maxTagsCount: 10,
    maxTagLength: 50,
    maxCustomDataSize: 5000
  },

  performance: {
    enableCaching: true,
    enableImageCaching: true,
    enableStatsCaching: true,
    batchProcessingTimeout: 30000,
    scanRecordingBatchSize: 100
  }
} as const;

// ======================== 錯誤處理 ========================

/**
 * 統一的 QRCode 模組錯誤處理
 */
export function handleQRCodeError(error: unknown): {
  code: string;
  message: string;
  details?: any;
} {
  if (error instanceof Error) {
    // 檢查是否為已知的 QRCode 錯誤類型
    if ('code' in error) {
      return {
        code: (error as any).code,
        message: error.message,
        details: 'details' in error ? (error as any).details : undefined
      };
    }

    // 根據錯誤訊息判斷錯誤類型
    if (error.message.includes('not found')) {
      return {
        code: 'QR_CODE_NOT_FOUND',
        message: error.message
      };
    }

    if (error.message.includes('permission') || error.message.includes('access')) {
      return {
        code: 'PERMISSION_DENIED',
        message: error.message
      };
    }

    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message
      };
    }

    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      return {
        code: 'QUOTA_EXCEEDED',
        message: error.message
      };
    }

    return {
      code: 'QRCODE_ERROR',
      message: error.message
    };
  }

  return {
    code: 'UNKNOWN_QRCODE_ERROR',
    message: 'An unknown error occurred in QRCode module'
  };
}

// ======================== 模組初始化 ========================

/**
 * QRCode 模組初始化函數
 */
export function initializeQRCodeModule(options: {
  db: D1Database;
  cache?: KVNamespace;
  storage?: R2Bucket;
  config?: Partial<typeof DEFAULT_QRCODE_CONFIG>;
}) {
  const { db, cache, storage, config = {} } = options;

  // 合併配置
  const finalConfig = {
    ...DEFAULT_QRCODE_CONFIG,
    ...config
  };

  // 創建模組實例
  const module = createQRCodeModule(db, cache, storage);

  return {
    ...module,
    config: finalConfig,
    initialize: async () => {
      console.log('[QRCode Module] Initializing...');

      // 檢查數據庫連接
      try {
        await db.prepare('SELECT 1').first();
        console.log('[QRCode Module] Database connection verified');
      } catch (error) {
        console.error('[QRCode Module] Database connection failed:', error);
        throw new Error('Failed to initialize QRCode module: Database connection failed');
      }

      // 檢查快取連接（如果提供）
      if (cache) {
        try {
          await cache.get('qrcode-init-test');
          console.log('[QRCode Module] Cache connection verified');
        } catch (error) {
          console.warn('[QRCode Module] Cache connection failed:', error);
          // 快取失敗不阻止模組初始化
        }
      }

      // 檢查儲存連接（如果提供）
      if (storage) {
        try {
          await storage.head('qrcode-init-test');
          console.log('[QRCode Module] Storage connection verified');
        } catch (error) {
          console.warn('[QRCode Module] Storage connection failed:', error);
          // 儲存失敗不阻止模組初始化
        }
      }

      console.log('[QRCode Module] Initialized successfully');
      return true;
    }
  };
}