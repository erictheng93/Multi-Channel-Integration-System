// Analytics Core Types - 統一分析服務核心類型定義

import type { Database } from '@/db/drizzle-factory';
import type { Bindings } from '@/types';

/**
 * 通用分析查詢接口
 */
export interface AnalyticsQuery {
  type?: string;
  timeRange: TimeRange;
  startDate?: string;
  endDate?: string;
  filters?: AnalyticsFilters;
  metrics?: string[];
  groupBy?: string[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
}

/**
 * 時間範圍類型
 */
export type TimeRange =
  | '1h' | '6h' | '12h' | '24h'
  | '3d' | '7d' | '14d' | '30d'
  | '90d' | '1y' | 'custom';

/**
 * 分析篩選條件
 */
export interface AnalyticsFilters {
  teamId?: number;
  userId?: string;
  agentId?: string;
  conversationId?: string;
  customerId?: string;
  platform?: 'line' | 'facebook' | 'web';
  status?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  customFields?: Record<string, any>;
  includePrevious?: boolean; // 是否包含上期對比數據
}

/**
 * 排序子句
 */
export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * 統一服務響應接口 - 標準化所有 Service 層返回格式
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  metadata?: {
    totalRecords?: number;
    processedAt?: string;
    queryTime?: number; // milliseconds
    cacheHit?: boolean;
    aggregationLevel?: 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * 統一分析結果接口 - 繼承 ServiceResponse
 * @deprecated 使用 ServiceResponse<T> 代替以獲得更好的一致性
 */
export interface AnalyticsResult<T = any> extends ServiceResponse<T> {
  data: T;
  metadata: {
    totalRecords: number;
    processedAt: string;
    queryTime: number; // milliseconds
    cacheHit?: boolean;
    aggregationLevel?: 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  };
}

/**
 * 分析服務接口 - 使用標準化 ServiceResponse
 */
export interface AnalyticsServiceInterface {
  // 會話分析
  getConversationAnalytics(query: ConversationAnalyticsQuery): Promise<ServiceResponse<ConversationAnalytics>>;

  // 消息分析
  getMessageAnalytics(query: MessageAnalyticsQuery): Promise<ServiceResponse<MessageAnalytics>>;

  // 用戶分析
  getUserAnalytics(query: UserAnalyticsQuery): Promise<ServiceResponse<UserAnalytics>>;

  // 性能分析
  getPerformanceAnalytics(query: PerformanceAnalyticsQuery): Promise<ServiceResponse<PerformanceAnalytics>>;

  // 自定義分析
  getCustomAnalytics(query: CustomAnalyticsQuery): Promise<ServiceResponse<any>>;

  // 導出功能
  exportAnalytics(query: ExportQuery): Promise<ServiceResponse<ExportResult>>;
}

/**
 * 會話分析查詢
 */
export interface ConversationAnalyticsQuery extends AnalyticsQuery {
  metrics?: ConversationMetric[];
}

export type ConversationMetric =
  | 'total_conversations'
  | 'active_conversations'
  | 'closed_conversations'
  | 'avg_duration'
  | 'avg_messages_per_conversation'
  | 'first_response_time'
  | 'resolution_time'
  | 'customer_satisfaction'
  | 'conversation_by_channel'
  | 'conversation_by_team'
  | 'conversation_by_priority';

/**
 * 會話分析結果
 */
export interface ConversationAnalytics {
  summary: ConversationSummary;
  trends: TimeSeriesData[];
  distributions: DistributionData[];
  comparisons?: ComparisonData[];
}

/**
 * 會話摘要統計
 */
export interface ConversationSummary {
  totalConversations: number;
  activeConversations: number;
  closedConversations: number;
  averageDuration: number; // minutes
  averageMessagesPerConversation: number;
  averageFirstResponseTime: number; // minutes
  averageResolutionTime: number; // minutes
  customerSatisfactionScore: number;
  period: {
    start: string;
    end: string;
  };
}

/**
 * 消息分析查詢
 */
export interface MessageAnalyticsQuery extends AnalyticsQuery {
  metrics?: MessageMetric[];
}

export type MessageMetric =
  | 'total_messages'
  | 'messages_per_hour'
  | 'messages_by_type'
  | 'messages_by_channel'
  | 'response_times'
  | 'message_sentiment'
  | 'attachment_usage';

/**
 * 消息分析結果
 */
export interface MessageAnalytics {
  summary: MessageSummary;
  volume: TimeSeriesData[];
  types: DistributionData[];
  channels: DistributionData[];
  sentiments: DistributionData[];
}

/**
 * 消息摘要統計
 */
export interface MessageSummary {
  totalMessages: number;
  messagesPerHour: number;
  averageResponseTime: number; // minutes
  messageTypes: Record<string, number>;
  channelDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
}

/**
 * 用戶分析查詢
 */
export interface UserAnalyticsQuery extends AnalyticsQuery {
  metrics?: UserMetric[];
  userType?: 'agent' | 'customer' | 'admin';
}

export type UserMetric =
  | 'active_users'
  | 'user_activity'
  | 'user_performance'
  | 'user_workload'
  | 'user_satisfaction'
  | 'login_patterns';

/**
 * 用戶分析結果
 */
export interface UserAnalytics {
  summary: UserSummary;
  activity: TimeSeriesData[];
  performance: UserPerformanceData[];
  workload: WorkloadData[];
}

/**
 * 用戶摘要統計
 */
export interface UserSummary {
  totalUsers: number;
  activeUsers: number;
  averageSessionDuration: number; // minutes
  averageActivityPerDay: number;
  topPerformers: UserPerformanceData[];
}

/**
 * 性能分析查詢
 */
export interface PerformanceAnalyticsQuery extends AnalyticsQuery {
  metrics?: PerformanceMetric[];
}

export type PerformanceMetric =
  | 'response_times'
  | 'throughput'
  | 'error_rates'
  | 'system_load'
  | 'database_performance'
  | 'api_performance'
  | 'integration_health';

/**
 * 性能分析結果
 */
export interface PerformanceAnalytics {
  summary: PerformanceSummary;
  trends: TimeSeriesData[];
  bottlenecks: BottleneckData[];
  recommendations: RecommendationData[];
}

/**
 * 性能摘要統計
 */
export interface PerformanceSummary {
  averageResponseTime: number; // ms
  throughput: number; // requests per second
  errorRate: number; // percentage
  uptime: number; // percentage
  systemLoad: number; // percentage
}

/**
 * 自定義分析查詢
 */
export interface CustomAnalyticsQuery extends AnalyticsQuery {
  query: string;
  parameters?: Record<string, any>;
  aggregation?: AggregationConfig;
}

/**
 * 聚合配置
 */
export interface AggregationConfig {
  groupBy: string[];
  aggregations: AggregationFunction[];
  having?: FilterCondition[];
}

export type AggregationFunction =
  | { type: 'count'; field?: string }
  | { type: 'sum'; field: string }
  | { type: 'avg'; field: string }
  | { type: 'min'; field: string }
  | { type: 'max'; field: string }
  | { type: 'distinct'; field: string };

/**
 * 篩選條件
 */
export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: any;
}

/**
 * 時間序列數據
 */
export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

/**
 * 分佈數據
 */
export interface DistributionData {
  category: string;
  value: number;
  percentage: number;
  label?: string;
  color?: string;
}

/**
 * 比較數據
 */
export interface ComparisonData {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  trend: 'up' | 'down' | 'stable';
  period: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
}

/**
 * 用戶性能數據
 */
export interface UserPerformanceData {
  userId: string;
  userName: string;
  userRole: string;
  score: number;
  metrics: {
    conversationsHandled: number;
    averageResponseTime: number;
    customerSatisfaction: number;
    resolutionRate: number;
  };
}

/**
 * 工作負載數據
 */
export interface WorkloadData {
  userId: string;
  userName: string;
  activeConversations: number;
  dailyMessageCount: number;
  utilizationRate: number; // percentage
  workingHours: number;
}

/**
 * 瓶頸數據
 */
export interface BottleneckData {
  type: 'api' | 'database' | 'integration' | 'network';
  component: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
}

/**
 * 建議數據
 */
export interface RecommendationData {
  id: string;
  type: 'performance' | 'resource' | 'process';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedImpact: string;
  implementationEffort: 'low' | 'medium' | 'high';
  actions: ActionItem[];
}

/**
 * 行動項目
 */
export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * 導出查詢
 */
export interface ExportQuery extends AnalyticsQuery {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  metrics?: string[];
  includeCharts?: boolean;
  template?: string;
  fileName?: string;
}

/**
 * 導出結果
 */
export interface ExportResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  format: string;
  generatedAt: string;
  expiresAt: string;
  downloadCount: number;
}

/**
 * 內部查詢上下文類型 - 用於 buildWhereConditions
 */
export interface WhereConditionContext {
  table: 'conversations' | 'messages' | 'activities' | 'agents' | 'users';
  startDate?: string;
  endDate?: string;
}

/**
 * SQL 查詢結果行類型 - 用於趨勢和分佈數據
 */
export interface TrendDataRow {
  period: string | null;
  count: number | null;
}

/**
 * Conversation trend query result row
 */
export interface ConversationTrendRow {
  timePeriod: string | null;
  count: number | null;
  activeCount: number | null;
  closedCount: number | null;
}

/**
 * Message volume trend query result row
 */
export interface MessageVolumeTrendRow {
  timePeriod: string | null;
  totalMessages: number | null;
  customerMessages: number | null;
  agentMessages: number | null;
}

/**
 * User activity trend query result row
 */
export interface UserActivityTrendRow {
  timePeriod: string | null;
  totalActivities: number | null;
  uniqueUsers: number | null;
  messageActions: number | null;
  conversationActions: number | null;
}

export interface DistributionRow {
  category: string | null;
  count: number | null;
}

/**
 * Team distribution query result row (numeric category)
 */
export interface TeamDistributionRow {
  category: number | null;
  count: number;
}

export interface ConversationSummaryRow {
  total_conversations?: number | null;
  active_conversations?: number | null;
  closed_conversations?: number | null;
  avg_duration?: number | null;
  avg_messages?: number | null;
  avg_first_response?: number | null;
  avg_resolution?: number | null;
  satisfaction_score?: number | null;
}

export interface MessageSummaryRow {
  total_messages?: number | null;
  messages_per_hour?: number | null;
  avg_response_time?: number | null;
}

/**
 * 分析服務配置
 */
export interface AnalyticsServiceConfig {
  database: Database;
  kv?: Bindings['KV'];
  env?: Bindings;
  cache?: {
    enabled: boolean;
    ttl: number; // seconds
    prefix: string;
  };
  aggregation?: {
    enabled: boolean;
    levels: ('hourly' | 'daily' | 'weekly' | 'monthly')[];
    retentionDays: Record<string, number>;
  };
  realTime?: {
    enabled: boolean;
    updateInterval: number; // seconds
    maxConnections: number;
  };
}

/**
 * 分析錯誤類型
 */
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export class QueryValidationError extends AnalyticsError {
  constructor(message: string, details?: any) {
    super(message, 'QUERY_VALIDATION_ERROR', 400, details);
    this.name = 'QueryValidationError';
  }
}

export class DataProcessingError extends AnalyticsError {
  constructor(message: string, details?: any) {
    super(message, 'DATA_PROCESSING_ERROR', 500, details);
    this.name = 'DataProcessingError';
  }
}

export class ExportError extends AnalyticsError {
  constructor(message: string, details?: any) {
    super(message, 'EXPORT_ERROR', 500, details);
    this.name = 'ExportError';
  }
}