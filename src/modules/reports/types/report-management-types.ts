// Reports 模組 - 管理、批量、排程、服務介面和錯誤類型
// Management, batch operations, scheduling, service interface, and error classes

import type { Bindings } from '@/types';
import type { Context } from 'hono';
import type {
  ReportType,
  ReportTimeRange,
  ReportFormat,
  ReportStatus,
  ReportBase,
  ReportGenerationParams,
  ReportFilters,
  ReportOptions,
} from './report-core-types';

// ======================== 報告查詢和管理 ========================

/**
 * 報告列表查詢參數
 */
export interface ReportListQuery {
  type?: ReportType;
  status?: ReportStatus;
  format?: ReportFormat;
  createdBy?: string;
  teamId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 報告列表回應
 */
export interface ReportListResponse {
  reports: ReportBase[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalReports: number;
    pendingReports: number;
    completedReports: number;
    failedReports: number;
  };
}

/**
 * 報告詳細資訊
 */
export interface ReportDetails extends ReportBase {
  generationLog?: string[];
  errorMessage?: string;
  executionTime?: number; // seconds
  dataSource?: {
    tables: string[];
    filters: ReportFilters;
    recordCount: number;
  };
  downloadHistory?: Array<{
    downloadedAt: string;
    downloadedBy: string;
    ipAddress?: string;
  }>;
}

// ======================== 報告統計 ========================

/**
 * 報告統計資料
 */
export interface ReportStatistics {
  totalReports: number;
  reportsByType: Record<ReportType, number>;
  reportsByFormat: Record<ReportFormat, number>;
  reportsByStatus: Record<ReportStatus, number>;
  averageGenerationTime: number; // seconds
  popularReports: Array<{
    type: ReportType;
    count: number;
    averageSize: number; // bytes
  }>;
  usageByUser: Array<{
    userId: string;
    username: string;
    reportCount: number;
    lastGenerated: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    reportsGenerated: number;
    totalSize: number; // bytes
  }>;
}

// ======================== 批量操作 ========================

/**
 * 批量報告操作
 */
export interface BatchReportOperation {
  reportIds: string[];
  action: 'delete' | 'regenerate' | 'download' | 'export';
  options?: {
    format?: ReportFormat;
    mergeReports?: boolean;
  };
}

/**
 * 批量操作結果
 */
export interface BatchOperationResult {
  success: boolean;
  totalRequested: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    reportId: string;
    success: boolean;
    error?: string;
    downloadUrl?: string;
  }>;
}

// ======================== 排程報告 ========================

/**
 * 排程報告配置
 */
export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  format: ReportFormat;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:mm format
    dayOfWeek?: number; // 0-6, Sunday=0
    dayOfMonth?: number; // 1-31
  };
  filters: ReportFilters;
  options: ReportOptions;
  recipients: Array<{
    email: string;
    name: string;
    role: string;
  }>;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  lastRun?: string;
  nextRun: string;
}

/**
 * 排程報告執行記錄
 */
export interface ScheduledReportExecution {
  id: string;
  scheduledReportId: string;
  executedAt: string;
  status: ReportStatus;
  reportId?: string;
  errorMessage?: string;
  executionTime?: number; // seconds
  recipients: string[];
  deliveryStatus: Record<string, 'sent' | 'failed'>;
}

export interface ReportDownloadContent {
  body: BodyInit;
  contentType: string;
  filename: string;
  fileSize?: number;
  url: string;
}

// ======================== 服務介面 ========================

/**
 * Reports Service 介面
 */
export interface ReportsServiceInterface {
  // 報告生成
  generateReport(params: ReportGenerationParams, userId: string): Promise<ReportBase>;
  getReportStatus(reportId: string): Promise<ReportBase | null>;
  downloadReport(reportId: string, userId: string): Promise<ReportDownloadContent | null>;

  // 報告管理
  listReports(query: ReportListQuery): Promise<ReportListResponse>;
  getReportDetails(reportId: string): Promise<ReportDetails | null>;
  deleteReport(reportId: string, userId: string): Promise<boolean>;

  // 統計分析
  getReportStatistics(timeRange?: ReportTimeRange): Promise<ReportStatistics>;

  // 批量操作
  batchOperation(operation: BatchReportOperation, userId: string): Promise<BatchOperationResult>;

  // 排程報告
  createScheduledReport(config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>, userId: string): Promise<ScheduledReport>;
  updateScheduledReport(id: string, updates: Partial<ScheduledReport>, userId: string): Promise<ScheduledReport>;
  deleteScheduledReport(id: string, userId: string): Promise<boolean>;
  listScheduledReports(userId?: string): Promise<ScheduledReport[]>;

  // 工具方法
  validateReportParams(params: ReportGenerationParams): Promise<{ valid: boolean; errors: string[] }>;
  getAvailableTemplates(type: ReportType): Promise<Array<{ name: string; description: string; options: ReportOptions }>>;
  previewReport(params: ReportGenerationParams): Promise<unknown>; // Sample data for preview
}

// ======================== 中間件類型 ========================

/**
 * Reports Context 擴展
 */
export interface ReportsContext extends Context<{ Bindings: Bindings }> {
  get: {
    reportId?: string;
    reportQuery?: ReportListQuery;
    reportParams?: ReportGenerationParams;
    scheduledReportId?: string;
    batchOperation?: BatchReportOperation;
  } & Context<{ Bindings: Bindings }>['get'];
  set: Context<{ Bindings: Bindings }>['set'] & {
    (key: 'reportId', value: string): void;
    (key: 'reportQuery', value: ReportListQuery): void;
    (key: 'reportParams', value: ReportGenerationParams): void;
    (key: 'scheduledReportId', value: string): void;
    (key: 'batchOperation', value: BatchReportOperation): void;
  };
}

// ======================== 錯誤類型 ========================

export class ReportNotFoundError extends Error {
  constructor(reportId: string) {
    super(`Report not found: ${reportId}`);
    this.name = 'ReportNotFoundError';
  }
}

export class ReportGenerationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ReportGenerationError';
  }
}

export class InvalidReportParamsError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'InvalidReportParamsError';
  }
}

export class ReportAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportAccessDeniedError';
  }
}
