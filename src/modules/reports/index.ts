// ============================================================================
// REPORTS Module - 報表生成與管理模組
// 提供多樣化報表生成、排程執行、格式導出和數據分析功能
// ============================================================================

// ======================== 類型導出 ========================
// 基礎類型
export type {
  ReportType,
  ReportFormat,
  ReportStatus,
  ReportTimeRange
} from './types/report-types';

// 報告相關介面
export type {
  ReportBase,
  ReportDetails,
  ReportGenerationParams,
  ReportFilters,
  ReportOptions,
  ReportListQuery,
  ReportListResponse,
  ReportStatistics
} from './types/report-types';

// 具體報告資料類型
export type {
  ConversationSummaryReportData,
  AgentPerformanceReportData,
  CustomerSatisfactionReportData,
  SystemHealthReportData
} from './types/report-types';

// 批量操作和排程
export type {
  BatchReportOperation,
  BatchOperationResult,
  ScheduledReport,
  ScheduledReportExecution
} from './types/report-types';

// 服務介面
export type {
  ReportsServiceInterface
} from './types/report-types';

// 中間件類型
export type {
  ReportsPermissions,
  ReportsAccessScope,
  ReportTypePermissions
} from './middleware/index';

// 處理器類型
export type {
  ReportsHandlerConfig
} from './handlers/index';

// ======================== 服務導出 ========================
export { ReportsService } from './services/reports-service';

// ======================== 處理器導出 ========================
export {
  reportsHandler,
  DEFAULT_REPORTS_HANDLER_CONFIG,
  REPORTS_HANDLER_ROUTES,
  REPORTS_HANDLER_CAPABILITIES
} from './handlers/index';
export { reportsHandler as reportsMainHandler } from './handlers/index';

// ======================== 中間件導出 ========================
export {
  // 權限控制
  checkReportsAccess,
  checkReportsViewPermission,
  checkReportsGeneratePermission,
  checkReportsDownloadPermission,
  checkReportsDeletePermission,
  checkReportsStatsPermission,
  checkReportsBatchPermission,
  checkScheduledReportsPermission,
  checkSpecialReportTypePermission,
  logReportsOperation,

  // 資料驗證
  validateRequestSize,
  validateRateLimit,
  validateReportId,
  validateScheduledReportId,
  validateReportGenerationParams,
  validateReportListQuery,
  validateBatchReportOperation,
  validateScheduledReportData,
  validateReportPreviewRequest,

  // 工具函數
  sanitizeString,
  validateNumberRange,
  validateUUID,
  validateISODate,
  validateEmail,
  validateTimeFormat
} from './middleware/index';

// ======================== 工具函數導出 ========================
// 工具函數已整合在中間件導出中

// ======================== 常數導出 ========================
// 錯誤類型
export {
  ReportNotFoundError,
  ReportGenerationError,
  InvalidReportParamsError,
  ReportAccessDeniedError
} from './types/report-types';

// 配置和常數
export {
  DEFAULT_REPORT_CONFIG,
  REPORT_TYPE_CONFIG
} from './types/report-types';

// ======================== 模組配置 ========================
export interface ReportsModuleConfig {
  // 服務配置
  service: {
    maxReportSize: number;
    reportExpiryDays: number;
    maxConcurrentGenerations: number;
    defaultTimezone: string;
  };
  // 處理器配置
  handler: {
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
    validation: {
      maxTitleLength: number;
      maxDescriptionLength: number;
      maxRecipientsCount: number;
    };
  };
  // 功能開關
  features: {
    scheduling: boolean;
    batchOperations: boolean;
    customReports: boolean;
    systemHealthReports: boolean;
    realTimePreview: boolean;
  };
}

export const DEFAULT_REPORTS_MODULE_CONFIG: ReportsModuleConfig = {
  service: {
    maxReportSize: 50 * 1024 * 1024, // 50MB
    reportExpiryDays: 30,
    maxConcurrentGenerations: 5,
    defaultTimezone: 'Asia/Taipei'
  },
  handler: {
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 30
    },
    validation: {
      maxTitleLength: 200,
      maxDescriptionLength: 1000,
      maxRecipientsCount: 20
    }
  },
  features: {
    scheduling: true,
    batchOperations: true,
    customReports: true,
    systemHealthReports: true,
    realTimePreview: true
  }
};

// ======================== 模組資訊 ========================
export const MODULE_INFO = {
  name: 'reports',
  version: '1.0.0',
  description: '全面性報表生成系統，支援多種報表類型和導出格式',

  features: [
    '多樣化報表類型生成',
    '多種格式導出支援',
    '自動排程執行',
    '批量操作管理',
    '實時預覽功能',
    '自定義報表設計',
    '統計分析與趨勢',
    '權限控制與安全',
    '壓縮與緩存優化',
    '多語言支援'
  ],

  endpoints: {
    total: 15,
    implemented: 15,
    pending: 0,
    categories: {
      core: 6, // generate, list, details, download, delete, stats
      batch: 1, // batch operations
      templates: 2,  // templates, preview
      scheduled: 4,  // create, list, update, delete scheduled
      system: 2 // health, info
    }
  },

  permissions: {
    admin: {
      description: '完整報表系統管理權限',
      actions: [
        'generate_all_reports',
        'manage_scheduled_reports',
        'system_health_reports',
        'batch_operations',
        'view_statistics'
      ]
    },
    team: {
      description: '團隊範圍報表管理權限',
      actions: [
        'generate_team_reports',
        'manage_team_scheduled_reports',
        'team_analytics',
        'view_team_statistics'
      ]
    },
    agent: {
      description: '基本報表查看權限',
      actions: [
        'generate_basic_reports',
        'view_own_reports',
        'personal_performance_reports'
      ]
    }
  },

  technical: {
    database: ['reports', 'scheduled_reports', 'report_executions'],
    cache: ['report_cache', 'template_cache'],
    dependencies: ['shared/database', 'shared/utils', 'auth', 'analytics'],
    middleware: ['reports-auth', 'validation', 'rate-limiting']
  },

  status: {
    development: 'completed' as const,
    testing: 'in_progress' as const,
    deployment: 'completed' as const,
    integration: 'completed' as const
  }
} as const;

// ======================== 初始化函數 ========================
import { createContextLogger } from '@/utils/logger';
const log = createContextLogger('ReportsModule');

export function initializeReportsModule(config: Partial<ReportsModuleConfig> = {}) {
  const finalConfig = { ...DEFAULT_REPORTS_MODULE_CONFIG, ...config };

  // 驗證配置
  if (finalConfig.service.maxReportSize < 1024 * 1024) { // min 1MB
    log.warn('maxReportSize too small, setting to 1MB');
    finalConfig.service.maxReportSize = 1024 * 1024;
  }

  if (finalConfig.service.maxConcurrentGenerations < 1) {
    log.warn('maxConcurrentGenerations must be at least 1');
    finalConfig.service.maxConcurrentGenerations = 1;
  }

  if (finalConfig.handler.validation.maxRecipientsCount < 1) {
    log.warn('maxRecipientsCount must be at least 1');
    finalConfig.handler.validation.maxRecipientsCount = 1;
  }

  return {
    config: finalConfig,
    moduleInfo: MODULE_INFO
  };
}

// ======================== 向後兼容 ========================
export { reportsHandler as default } from './handlers/index';

// Legacy exports for backward compatibility
export const REPORTS_MODULE_INFO = MODULE_INFO;