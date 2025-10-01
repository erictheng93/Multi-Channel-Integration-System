// Metrics Types - 指標相關類型定義

/**
 * 核心指標接口
 */
export interface Metric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  unit?: MetricUnit;
  metadata?: Record<string, any>;
}

/**
 * 指標單位
 */
export type MetricUnit =
  | 'count'
  | 'percentage'
  | 'milliseconds'
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'bytes'
  | 'kilobytes'
  | 'megabytes'
  | 'requests'
  | 'errors'
  | 'score';

/**
 * 指標類型分類
 */
export type MetricType =
  | 'counter'      // 計數器（只增不減）
  | 'gauge'        // 測量值（可增可減）
  | 'histogram'    // 直方圖
  | 'rate'         // 比率
  | 'duration'     // 持續時間
  | 'distribution'; // 分佈

/**
 * 指標定義
 */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  unit: MetricUnit;
  description: string;
  tags: string[];
  aggregations: AggregationType[];
  retention: RetentionPolicy;
  alerting?: AlertingConfig;
}

/**
 * 聚合類型
 */
export type AggregationType =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'percentile_50'
  | 'percentile_95'
  | 'percentile_99';

/**
 * 資料保留政策
 */
export interface RetentionPolicy {
  raw: number;       // 原始數據保留天數
  hourly: number;    // 小時聚合保留天數
  daily: number;     // 日聚合保留天數
  weekly: number;    // 週聚合保留天數
  monthly: number;   // 月聚合保留天數
}

/**
 * 告警配置
 */
export interface AlertingConfig {
  enabled: boolean;
  threshold: ThresholdConfig;
  notifications: NotificationConfig[];
}

/**
 * 閾值配置
 */
export interface ThresholdConfig {
  warning?: ThresholdRule;
  critical?: ThresholdRule;
}

/**
 * 閾值規則
 */
export interface ThresholdRule {
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: number;
  duration?: number; // 持續時間（分鐘）
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  type: 'email' | 'webhook' | 'slack';
  endpoint: string;
  severity: 'warning' | 'critical';
  template?: string;
}

/**
 * 聚合指標
 */
export interface AggregatedMetric {
  name: string;
  aggregation: AggregationType;
  value: number;
  timestamp: number;
  period: AggregationPeriod;
  tags: Record<string, string>;
  sampleCount?: number;
  metadata?: Record<string, any>;
}

/**
 * 聚合週期
 */
export type AggregationPeriod =
  | '1m'   // 1分鐘
  | '5m'   // 5分鐘
  | '15m'  // 15分鐘
  | '1h'   // 1小時
  | '6h'   // 6小時
  | '1d'   // 1天
  | '1w'   // 1週
  | '1M';  // 1月

/**
 * 指標查詢
 */
export interface MetricQuery {
  name: string;
  aggregation?: AggregationType;
  period?: AggregationPeriod;
  startTime: number;
  endTime: number;
  tags?: Record<string, string>;
  groupBy?: string[];
  orderBy?: 'timestamp' | 'value';
  limit?: number;
}

/**
 * 指標查詢結果
 */
export interface MetricQueryResult {
  metrics: AggregatedMetric[];
  metadata: {
    totalRecords: number;
    queryTime: number;
    cacheHit: boolean;
    aggregationLevel: AggregationPeriod;
  };
}

/**
 * 會話指標
 */
export interface ConversationMetrics {
  // 基本指標
  totalConversations: Metric;
  activeConversations: Metric;
  closedConversations: Metric;

  // 時間指標
  averageResponseTime: Metric;
  firstResponseTime: Metric;
  resolutionTime: Metric;
  conversationDuration: Metric;

  // 品質指標
  customerSatisfaction: Metric;
  resolutionRate: Metric;
  escalationRate: Metric;

  // 分佈指標
  conversationsByChannel: Metric;
  conversationsByTeam: Metric;
  conversationsByPriority: Metric;
}

/**
 * 消息指標
 */
export interface MessageMetrics {
  // 數量指標
  totalMessages: Metric;
  messagesPerConversation: Metric;
  messagesPerHour: Metric;

  // 類型指標
  textMessages: Metric;
  imageMessages: Metric;
  fileMessages: Metric;

  // 渠道指標
  lineMessages: Metric;
  facebookMessages: Metric;
  webMessages: Metric;

  // 情感指標
  positiveMessages: Metric;
  negativeMessages: Metric;
  neutralMessages: Metric;
}

/**
 * 用戶指標
 */
export interface UserMetrics {
  // 基本指標
  totalUsers: Metric;
  activeUsers: Metric;
  newUsers: Metric;

  // 活動指標
  userSessions: Metric;
  sessionDuration: Metric;
  pageViews: Metric;

  // 參與指標
  engagementRate: Metric;
  retentionRate: Metric;
  churnRate: Metric;
}

/**
 * 代理人指標
 */
export interface AgentMetrics {
  // 工作負載指標
  activeAgents: Metric;
  agentUtilization: Metric;
  conversationsPerAgent: Metric;

  // 績效指標
  agentResponseTime: Metric;
  agentResolutionRate: Metric;
  agentSatisfactionScore: Metric;

  // 效率指標
  handlingTime: Metric;
  workingHours: Metric;
  productivity: Metric;
}

/**
 * 系統指標
 */
export interface SystemMetrics {
  // 性能指標
  responseTime: Metric;
  throughput: Metric;
  errorRate: Metric;

  // 資源指標
  cpuUsage: Metric;
  memoryUsage: Metric;
  diskUsage: Metric;

  // 可用性指標
  uptime: Metric;
  availability: Metric;
  downtime: Metric;

  // API 指標
  apiCalls: Metric;
  apiErrors: Metric;
  apiLatency: Metric;
}

/**
 * 業務指標
 */
export interface BusinessMetrics {
  // 客戶指標
  customerAcquisition: Metric;
  customerRetention: Metric;
  customerLifetimeValue: Metric;

  // 營收指標
  revenue: Metric;
  conversion: Metric;
  averageOrderValue: Metric;

  // 效益指標
  costPerAcquisition: Metric;
  returnOnInvestment: Metric;
  profitMargin: Metric;
}

/**
 * 指標收集器接口
 */
export interface MetricsCollectorInterface {
  // 基本收集方法
  collect(metric: Metric): Promise<void>;
  collectBatch(metrics: Metric[]): Promise<void>;

  // 查詢方法
  query(query: MetricQuery): Promise<MetricQueryResult>;

  // 聚合方法
  aggregate(
    metrics: Metric[],
    aggregation: AggregationType,
    period: AggregationPeriod
  ): Promise<AggregatedMetric[]>;

  // 管理方法
  cleanup(retentionPolicy: RetentionPolicy): Promise<void>;
  flush(): Promise<void>;
}

/**
 * 指標存儲配置
 */
export interface MetricStorageConfig {
  // 存儲後端
  backend: 'database' | 'kv' | 'hybrid';

  // 批次設定
  batchSize: number;
  flushInterval: number;

  // 壓縮設定
  compression: boolean;
  compressionLevel: number;

  // 索引設定
  indexFields: string[];

  // 分區設定
  partitioning: {
    enabled: boolean;
    field: string;
    strategy: 'time' | 'hash';
  };
}

/**
 * 指標警報狀態
 */
export interface MetricAlertStatus {
  metricName: string;
  status: 'ok' | 'warning' | 'critical';
  currentValue: number;
  threshold: number;
  triggeredAt?: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  message: string;
}

/**
 * 指標報告
 */
export interface MetricReport {
  id: string;
  name: string;
  description: string;
  metrics: MetricQuery[];
  period: {
    start: number;
    end: number;
  };
  format: 'json' | 'csv' | 'html' | 'pdf';
  generatedAt: number;
  generatedBy: string;
  data: any;
}

/**
 * 預定義指標常數
 */
export const CONVERSATION_METRICS = {
  TOTAL_CONVERSATIONS: 'conversation.total',
  ACTIVE_CONVERSATIONS: 'conversation.active',
  CLOSED_CONVERSATIONS: 'conversation.closed',
  AVERAGE_RESPONSE_TIME: 'conversation.response_time.avg',
  FIRST_RESPONSE_TIME: 'conversation.first_response_time',
  RESOLUTION_TIME: 'conversation.resolution_time',
  CUSTOMER_SATISFACTION: 'conversation.satisfaction',
  RESOLUTION_RATE: 'conversation.resolution_rate',
} as const;

export const MESSAGE_METRICS = {
  TOTAL_MESSAGES: 'message.total',
  MESSAGES_PER_CONVERSATION: 'message.per_conversation',
  MESSAGES_PER_HOUR: 'message.per_hour',
  TEXT_MESSAGES: 'message.text',
  IMAGE_MESSAGES: 'message.image',
  FILE_MESSAGES: 'message.file',
} as const;

export const AGENT_METRICS = {
  ACTIVE_AGENTS: 'agent.active',
  AGENT_UTILIZATION: 'agent.utilization',
  CONVERSATIONS_PER_AGENT: 'agent.conversations',
  AGENT_RESPONSE_TIME: 'agent.response_time',
  AGENT_SATISFACTION: 'agent.satisfaction',
} as const;

export const SYSTEM_METRICS = {
  RESPONSE_TIME: 'system.response_time',
  THROUGHPUT: 'system.throughput',
  ERROR_RATE: 'system.error_rate',
  CPU_USAGE: 'system.cpu',
  MEMORY_USAGE: 'system.memory',
  UPTIME: 'system.uptime',
} as const;