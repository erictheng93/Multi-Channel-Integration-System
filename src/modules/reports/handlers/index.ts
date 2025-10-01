// Reports 模組處理器統一導出
// Reports module handlers exports

// 主要報告處理器
export { default as reportsHandler, default } from './reports-main';

// 處理器類型和介面
export interface ReportsHandlerConfig {
  maxReportSize: number;
  maxConcurrentGenerations: number;
  defaultPageSize: number;
  maxPageSize: number;
  rateLimitWindow: number;
  rateLimitRequests: number;
}

// 預設配置
export const DEFAULT_REPORTS_HANDLER_CONFIG: ReportsHandlerConfig = {
  maxReportSize: 50 * 1024 * 1024, // 50MB
  maxConcurrentGenerations: 5,
  defaultPageSize: 20,
  maxPageSize: 100,
  rateLimitWindow: 60 * 1000, // 1 minute
  rateLimitRequests: 30
};

// 處理器路由映射
export const REPORTS_HANDLER_ROUTES = {
  // 基本操作
  health: 'GET /health',
  info: 'GET /info',

  // 報告管理
  generate: 'POST /',
  list: 'GET /',
  details: 'GET /:id',
  download: 'GET /:id/download',
  delete: 'DELETE /:id',

  // 分析統計
  stats: 'GET /stats',

  // 批量操作
  batch: 'POST /batch',

  // 模板和預覽
  templates: 'GET /templates/:type',
  preview: 'POST /preview',

  // 排程報告
  createScheduled: 'POST /scheduled',
  listScheduled: 'GET /scheduled',
  updateScheduled: 'PUT /scheduled/:id',
  deleteScheduled: 'DELETE /scheduled/:id'
} as const;

// 處理器能力描述
export const REPORTS_HANDLER_CAPABILITIES = {
  reportGeneration: {
    types: 10,
    formats: 5,
    maxFileSize: '50MB',
    estimatedTime: '30-120 seconds'
  },
  scheduling: {
    frequencies: ['daily', 'weekly', 'monthly', 'quarterly'],
    maxRecipients: 20,
    automation: true
  },
  batchOperations: {
    maxItems: 50,
    supportedActions: ['delete', 'regenerate', 'download', 'export'],
    parallelProcessing: true
  },
  analytics: {
    statistics: true,
    trends: true,
    comparisons: true,
    realTimeTracking: true
  },
  security: {
    roleBasedAccess: true,
    auditLogging: true,
    dataEncryption: true,
    accessControl: 'granular'
  }
} as const;