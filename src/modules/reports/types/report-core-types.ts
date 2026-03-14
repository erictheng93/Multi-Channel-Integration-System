// Reports 模組 - 核心類型定義
// Core type unions and base interfaces for the reporting system

// ======================== 基礎類型 ========================

/**
 * 報告類型定義
 */
export type ReportType =
  // === 原有報表類型 ===
  | 'conversation_summary' // 對話摘要報告
  | 'agent_performance' // 客服績效報告
  | 'team_analytics' // 團隊分析報告
  | 'customer_satisfaction' // 客戶滿意度報告
  | 'platform_usage' // 平台使用情況
  | 'message_statistics' // 訊息統計報告
  | 'response_time_analysis' // 回應時間分析
  | 'workload_distribution' // 工作量分配報告
  | 'system_health' // 系統健康報告
  | 'custom' // 自定義報告

  // === Phase 1: 企業級高優先級報表 ===
  | 'cost_analysis' //  成本分析報告
  | 'sla_compliance' //  SLA合規報告
  | 'anomaly_detection' //  異常檢測報告
  | 'audit_trail' //  審計追蹤報告
  | 'resource_utilization' //  資源利用率報告

  // === Phase 2: 商業智能增強 ===
  | 'trend_forecast' //  趨勢預測報告
  | 'customer_insights' //  客戶洞察報告
  | 'channel_integration' //  多通道整合報告
  | 'goal_achievement' //  目標達成報告
  | 'automation_effectiveness' //  自動化成效報告

  // === Phase 3: 高級分析功能 ===
  | 'security_risk' //  資安風險報告
  | 'knowledge_base' //  知識庫效能報告
  | 'call_quality' //  通話品質分析報告
  | 'executive_summary' //  高管摘要報告
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
  | 'json' // JSON 格式
  | 'csv' // CSV 格式
  | 'excel' // Excel 格式
  | 'pdf' // PDF 格式
  | 'html' // HTML 格式
  ;

/**
 * 報告狀態
 */
export type ReportStatus =
  | 'pending' // 待處理
  | 'generating' // 生成中
  | 'completed' // 已完成
  | 'failed' // 失敗
  | 'expired' // 已過期
  ;

// ======================== 報告基礎介面 ========================

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
  teamId?: number;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
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
  customFields?: Record<string, any>;
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
