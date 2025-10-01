// 報表系統前端類型定義
// Frontend types for the comprehensive reporting system

// ======================== 基礎類型 ========================

/**
 * 報告類型定義 - 與後端保持一致
 */
export type ReportType =
  // === 原有報表類型 ===
  | 'conversation_summary'     // 對話摘要報告
  | 'agent_performance'        // 客服績效報告
  | 'team_analytics'           // 團隊分析報告
  | 'customer_satisfaction'    // 客戶滿意度報告
  | 'platform_usage'          // 平台使用情況
  | 'message_statistics'       // 訊息統計報告
  | 'response_time_analysis'   // 回應時間分析
  | 'workload_distribution'    // 工作量分配報告
  | 'system_health'            // 系統健康報告
  | 'custom'                   // 自定義報告

  // === Phase 1: 企業級高優先級報表 ===
  | 'cost_analysis'            // 💰 成本分析報告
  | 'sla_compliance'           // ⚖️ SLA合規報告
  | 'anomaly_detection'        // 🚨 異常檢測報告
  | 'audit_trail'              // 📋 審計追蹤報告
  | 'resource_utilization'     // ⚡ 資源利用率報告

  // === Phase 2: 商業智能增強 ===
  | 'trend_forecast'           // 📈 趨勢預測報告
  | 'customer_insights'        // 💡 客戶洞察報告
  | 'channel_integration'      // 🌐 多通道整合報告
  | 'goal_achievement'         // 🎯 目標達成報告
  | 'automation_effectiveness' // 🤖 自動化成效報告

  // === Phase 3: 高級分析功能 ===
  | 'security_risk'            // 🔒 資安風險報告
  | 'knowledge_base'           // 📚 知識庫效能報告
  | 'call_quality'             // 📞 通話品質分析報告
  | 'executive_summary'        // 💼 高管摘要報告
  ;

/**
 * 報告時間範圍
 */
export type ReportTimeRange =
  | 'last_24_hours'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'current_month'
  | 'last_month'
  | 'current_quarter'
  | 'last_quarter'
  | 'current_year'
  | 'last_year'
  | 'custom'
  ;

/**
 * 報告格式
 */
export type ReportFormat =
  | 'json'      // JSON 格式
  | 'csv'       // CSV 格式
  | 'excel'     // Excel 格式
  | 'pdf'       // PDF 格式
  | 'html'      // HTML 格式
  ;

/**
 * 報告狀態
 */
export type ReportStatus =
  | 'pending'      // 待處理
  | 'generating'   // 生成中
  | 'completed'    // 已完成
  | 'failed'       // 失敗
  | 'expired'      // 已過期
  ;

// ======================== 報告介面 ========================

/**
 * 報告基本資訊
 */
export interface ReportBase {
  id: string;
  title: string;
  description?: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
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

/**
 * 報告生成參數
 */
export interface ReportGenerationParams {
  type: ReportType;
  title: string;
  description?: string;
  format: ReportFormat;
  timeRange: ReportTimeRange;
  startDate?: string;
  endDate?: string;
  filters?: ReportFilters;
  options?: ReportOptions;
}

/**
 * 報告篩選條件
 */
export interface ReportFilters {
  teamIds?: string[];
  agentIds?: string[];
  customerIds?: string[];
  conversationIds?: string[];
  platforms?: string[];
  messageTypes?: string[];
  priority?: ('low' | 'medium' | 'high' | 'urgent')[];
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * 報告選項
 */
export interface ReportOptions {
  includeCharts?: boolean;
  includeSummary?: boolean;
  includeDetails?: boolean;
  includeRawData?: boolean;
  chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'area';
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  maxRecords?: number;
  timezone?: string;
  language?: 'zh-TW' | 'en-US';
}

/**
 * 報告列表查詢參數
 */
export interface ReportListQuery {
  type?: ReportType;
  status?: ReportStatus;
  format?: ReportFormat;
  createdBy?: string;
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

// ======================== 前端特定類型 ========================

/**
 * 報告表單狀態
 */
export interface ReportFormState {
  type: ReportType | null;
  title: string;
  description: string;
  format: ReportFormat;
  timeRange: ReportTimeRange;
  startDate: string;
  endDate: string;
  filters: ReportFilters;
  options: ReportOptions;
  isGenerating: boolean;
  errors: Record<string, string>;
}

/**
 * 報告卡片顯示資訊
 */
export interface ReportCardInfo {
  id: string;
  title: string;
  type: ReportType;
  typeLabel: string;
  status: ReportStatus;
  statusInfo: {
    label: string;
    color: string;
    icon: string;
  };
  format: ReportFormat;
  formatIcon: string;
  createdAt: string;
  fileSize?: number;
  fileSizeFormatted?: string;
  canDownload: boolean;
  canDelete: boolean;
  canRegenerate: boolean;
}

/**
 * 儀表板統計資料
 */
export interface DashboardStats {
  totalReports: number;
  pendingReports: number;
  completedReports: number;
  failedReports: number;
  todayGenerated: number;
  thisWeekGenerated: number;
  thisMonthGenerated: number;
  popularTypes: Array<{
    type: ReportType;
    label: string;
    count: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    reportTitle: string;
    timestamp: string;
    user: string;
  }>;
}

/**
 * 報告模板資訊
 */
export interface ReportTemplate {
  name: string;
  description: string;
  type: ReportType;
  presetOptions: ReportOptions;
  requiredFilters: string[];
  optionalFilters: string[];
  estimatedTime: number; // seconds
  icon: string;
  category: 'basic' | 'advanced' | 'enterprise';
}

/**
 * 排程頻率選項
 */
export interface ScheduleFrequencyOption {
  value: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  label: string;
  description: string;
  icon: string;
}

/**
 * 報告生成進度
 */
export interface ReportProgress {
  reportId: string;
  status: ReportStatus;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
  currentStep?: string;
  logs: string[];
}

// ======================== API 回應類型 ========================

/**
 * API 標準回應格式
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * 報告健康檢查回應
 */
export interface ReportHealthResponse {
  status: string;
  module: string;
  timestamp: string;
  version: string;
}

/**
 * 報告模組資訊回應
 */
export interface ReportModuleInfo {
  module: string;
  version: string;
  description: string;
  features: string[];
  reportTypes: string[];
  endpoints: string[];
  permissions: Record<string, string>;
}

// ======================== 輔助類型 ========================

/**
 * 報告類型選項
 */
export interface ReportTypeOption {
  value: ReportType;
  label: string;
  description: string;
  icon?: string;
  category: 'basic' | 'enterprise' | 'business_intelligence' | 'advanced_analytics';
  requiredPermissions: string[];
  estimatedTime: number; // seconds
}

/**
 * 格式選項
 */
export interface FormatOption {
  value: ReportFormat;
  label: string;
  icon: string;
  description: string;
  supportedByTypes: ReportType[];
}

/**
 * 時間範圍選項
 */
export interface TimeRangeOption {
  value: ReportTimeRange;
  label: string;
  description?: string;
  maxDays?: number;
}

// ======================== 狀態管理類型 ========================

/**
 * 報告 Store 狀態
 */
export interface ReportsStoreState {
  // 報告列表
  reports: ReportBase[];
  currentReport: ReportDetails | null;
  totalReports: number;

  // 分頁
  currentPage: number;
  pageSize: number;
  totalPages: number;

  // 篩選和排序
  filters: ReportListQuery;
  sortBy: string;
  sortOrder: 'asc' | 'desc';

  // 載入狀態
  loading: boolean;
  generating: boolean;
  downloading: Record<string, boolean>;

  // 統計資料
  statistics: ReportStatistics | null;

  // 排程報告
  scheduledReports: ScheduledReport[];

  // 錯誤處理
  error: string | null;

  // 選擇狀態
  selectedReports: string[];

  // 即時更新
  lastUpdate: string;
}

/**
 * 報告動作類型
 */
export type ReportAction =
  | 'generate'
  | 'view'
  | 'download'
  | 'delete'
  | 'regenerate'
  | 'schedule'
  | 'share'
  | 'export'
  ;

/**
 * 報告事件
 */
export interface ReportEvent {
  type: ReportAction;
  reportId: string;
  timestamp: string;
  userId: string;
  details?: Record<string, unknown>;
}

export default {};