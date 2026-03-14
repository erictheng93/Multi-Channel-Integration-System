// Metrics Definitions - 指標定義常數
// 整合系統中所有預定義的指標類型和配置

import type {
  MetricDefinition,
  RetentionPolicy,
  AlertingConfig
} from '../types/metrics-types';

/**
 * 預定義指標名稱常數
 */
export const METRIC_NAMES = {
  // === 對話相關指標 ===
  CONVERSATION: {
    TOTAL: 'conversation.total',
    ACTIVE: 'conversation.active',
    CLOSED: 'conversation.closed',
    CREATED: 'conversation.created',
    DURATION: 'conversation.duration',
    MESSAGES_COUNT: 'conversation.messages_count',
    RESPONSE_TIME_FIRST: 'conversation.response_time.first',
    RESPONSE_TIME_AVG: 'conversation.response_time.avg',
    RESOLUTION_TIME: 'conversation.resolution_time',
    SATISFACTION: 'conversation.satisfaction',
    ESCALATION_RATE: 'conversation.escalation_rate',
    RESOLUTION_RATE: 'conversation.resolution_rate'
  },

  // === 消息相關指標 ===
  MESSAGE: {
    TOTAL: 'message.total',
    SENT: 'message.sent',
    RECEIVED: 'message.received',
    PER_CONVERSATION: 'message.per_conversation',
    PER_HOUR: 'message.per_hour',
    PER_DAY: 'message.per_day',
    TEXT: 'message.type.text',
    IMAGE: 'message.type.image',
    FILE: 'message.type.file',
    AUDIO: 'message.type.audio',
    VIDEO: 'message.type.video',
    SENTIMENT_POSITIVE: 'message.sentiment.positive',
    SENTIMENT_NEGATIVE: 'message.sentiment.negative',
    SENTIMENT_NEUTRAL: 'message.sentiment.neutral'
  },

  // === 用戶相關指標 ===
  USER: {
    TOTAL: 'user.total',
    ACTIVE: 'user.active',
    NEW: 'user.new',
    RETURNING: 'user.returning',
    SESSION_DURATION: 'user.session_duration',
    PAGE_VIEWS: 'user.page_views',
    ENGAGEMENT_RATE: 'user.engagement_rate',
    RETENTION_RATE: 'user.retention_rate',
    CHURN_RATE: 'user.churn_rate'
  },

  // === 代理人相關指標 ===
  AGENT: {
    TOTAL: 'agent.total',
    ACTIVE: 'agent.active',
    ONLINE: 'agent.online',
    BUSY: 'agent.busy',
    IDLE: 'agent.idle',
    UTILIZATION: 'agent.utilization',
    CONVERSATIONS_HANDLED: 'agent.conversations_handled',
    RESPONSE_TIME: 'agent.response_time',
    RESOLUTION_RATE: 'agent.resolution_rate',
    SATISFACTION_SCORE: 'agent.satisfaction_score',
    WORKLOAD: 'agent.workload',
    PRODUCTIVITY: 'agent.productivity',
    WORKING_HOURS: 'agent.working_hours'
  },

  // === 系統效能指標 ===
  SYSTEM: {
    RESPONSE_TIME: 'system.response_time',
    THROUGHPUT: 'system.throughput',
    ERROR_RATE: 'system.error_rate',
    SUCCESS_RATE: 'system.success_rate',
    UPTIME: 'system.uptime',
    DOWNTIME: 'system.downtime',
    AVAILABILITY: 'system.availability',
    CPU_USAGE: 'system.cpu_usage',
    MEMORY_USAGE: 'system.memory_usage',
    DISK_USAGE: 'system.disk_usage',
    NETWORK_IO: 'system.network_io',
    DATABASE_CONNECTIONS: 'system.database_connections',
    CACHE_HIT_RATE: 'system.cache_hit_rate',
    QUEUE_SIZE: 'system.queue_size'
  },

  // === API 相關指標 ===
  API: {
    REQUESTS_TOTAL: 'api.requests.total',
    REQUESTS_PER_SECOND: 'api.requests.per_second',
    RESPONSE_TIME: 'api.response_time',
    ERROR_RATE: 'api.error_rate',
    STATUS_2XX: 'api.status.2xx',
    STATUS_4XX: 'api.status.4xx',
    STATUS_5XX: 'api.status.5xx',
    RATE_LIMIT_HITS: 'api.rate_limit.hits',
    PAYLOAD_SIZE: 'api.payload_size'
  },

  // === 整合平台指標 ===
  INTEGRATION: {
    LINE_WEBHOOK_LATENCY: 'integration.line.webhook_latency',
    LINE_API_SUCCESS: 'integration.line.api_success',
    LINE_API_FAILURE: 'integration.line.api_failure',
    FACEBOOK_WEBHOOK_LATENCY: 'integration.facebook.webhook_latency',
    FACEBOOK_API_SUCCESS: 'integration.facebook.api_success',
    FACEBOOK_API_FAILURE: 'integration.facebook.api_failure',
    WEBHOOK_TOTAL: 'integration.webhook.total',
    WEBHOOK_SUCCESS: 'integration.webhook.success',
    WEBHOOK_FAILURE: 'integration.webhook.failure'
  },

  // === 業務相關指標 ===
  BUSINESS: {
    CUSTOMER_ACQUISITION: 'business.customer_acquisition',
    CUSTOMER_RETENTION: 'business.customer_retention',
    CUSTOMER_LIFETIME_VALUE: 'business.customer_lifetime_value',
    CONVERSION_RATE: 'business.conversion_rate',
    REVENUE: 'business.revenue',
    COST_PER_ACQUISITION: 'business.cost_per_acquisition',
    ROI: 'business.roi',
    SATISFACTION_SCORE: 'business.satisfaction_score'
  },

  // === 自定義指標 ===
  CUSTOM: {
    PREFIX: 'custom.'
  }
} as const;

/**
 * 默認數據保留政策
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  raw: 7, // 原始數據保留 7 天
  hourly: 30, // 小時聚合保留 30 天
  daily: 365, // 日聚合保留 365 天
  weekly: 730, // 週聚合保留 2 年
  monthly: 2190  // 月聚合保留 6 年
};

/**
 * 高頻指標的特殊保留政策
 */
export const HIGH_FREQUENCY_RETENTION: RetentionPolicy = {
  raw: 1, // 原始數據只保留 1 天
  hourly: 7, // 小時聚合保留 7 天
  daily: 90, // 日聚合保留 90 天
  weekly: 365, // 週聚合保留 1 年
  monthly: 1095  // 月聚合保留 3 年
};

/**
 * 預定義指標定義
 */
export const PREDEFINED_METRICS: Record<string, MetricDefinition> = {
  // 對話指標
  [METRIC_NAMES.CONVERSATION.TOTAL]: {
    name: METRIC_NAMES.CONVERSATION.TOTAL,
    type: 'counter',
    unit: 'count',
    description: '總對話數量',
    tags: ['team_id', 'platform', 'priority'],
    aggregations: ['sum', 'count'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: false,
      threshold: {},
      notifications: []
    }
  },

  [METRIC_NAMES.CONVERSATION.RESPONSE_TIME_AVG]: {
    name: METRIC_NAMES.CONVERSATION.RESPONSE_TIME_AVG,
    type: 'gauge',
    unit: 'seconds',
    description: '平均回應時間',
    tags: ['team_id', 'agent_id', 'platform'],
    aggregations: ['avg', 'percentile_95', 'percentile_99'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'gt', value: 300, duration: 5 },  // 5分鐘
        critical: { operator: 'gt', value: 600, duration: 5 } // 10分鐘
      },
      notifications: []
    }
  },

  [METRIC_NAMES.CONVERSATION.SATISFACTION]: {
    name: METRIC_NAMES.CONVERSATION.SATISFACTION,
    type: 'gauge',
    unit: 'score',
    description: '客戶滿意度分數 (1-5)',
    tags: ['team_id', 'agent_id', 'platform'],
    aggregations: ['avg', 'min', 'max'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'lt', value: 3.5, duration: 15 },
        critical: { operator: 'lt', value: 3.0, duration: 10 }
      },
      notifications: []
    }
  },

  // 消息指標
  [METRIC_NAMES.MESSAGE.TOTAL]: {
    name: METRIC_NAMES.MESSAGE.TOTAL,
    type: 'counter',
    unit: 'count',
    description: '總消息數量',
    tags: ['platform', 'message_type', 'team_id'],
    aggregations: ['sum', 'count'],
    retention: HIGH_FREQUENCY_RETENTION,
    alerting: {
      enabled: false,
      threshold: {},
      notifications: []
    }
  },

  [METRIC_NAMES.MESSAGE.PER_HOUR]: {
    name: METRIC_NAMES.MESSAGE.PER_HOUR,
    type: 'rate',
    unit: 'count',
    description: '每小時消息數量',
    tags: ['platform', 'team_id'],
    aggregations: ['avg', 'max'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'gt', value: 1000, duration: 10 }
      },
      notifications: []
    }
  },

  // 代理人指標
  [METRIC_NAMES.AGENT.UTILIZATION]: {
    name: METRIC_NAMES.AGENT.UTILIZATION,
    type: 'gauge',
    unit: 'percentage',
    description: '代理人利用率',
    tags: ['agent_id', 'team_id'],
    aggregations: ['avg', 'min', 'max'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'gt', value: 90, duration: 15 },
        critical: { operator: 'gt', value: 95, duration: 10 }
      },
      notifications: []
    }
  },

  [METRIC_NAMES.AGENT.RESPONSE_TIME]: {
    name: METRIC_NAMES.AGENT.RESPONSE_TIME,
    type: 'histogram',
    unit: 'seconds',
    description: '代理人回應時間',
    tags: ['agent_id', 'team_id'],
    aggregations: ['avg', 'percentile_50', 'percentile_95'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'gt', value: 180, duration: 5 },
        critical: { operator: 'gt', value: 300, duration: 5 }
      },
      notifications: []
    }
  },

  // 系統指標
  [METRIC_NAMES.SYSTEM.RESPONSE_TIME]: {
    name: METRIC_NAMES.SYSTEM.RESPONSE_TIME,
    type: 'histogram',
    unit: 'milliseconds',
    description: '系統回應時間',
    tags: ['endpoint', 'method', 'status_code'],
    aggregations: ['avg', 'percentile_95', 'percentile_99'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'gt', value: 1000, duration: 5 },
        critical: { operator: 'gt', value: 2000, duration: 5 }
      },
      notifications: []
    }
  },

  [METRIC_NAMES.SYSTEM.ERROR_RATE]: {
    name: METRIC_NAMES.SYSTEM.ERROR_RATE,
    type: 'rate',
    unit: 'percentage',
    description: '系統錯誤率',
    tags: ['endpoint', 'error_type'],
    aggregations: ['avg', 'max'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'gt', value: 1, duration: 5 },
        critical: { operator: 'gt', value: 5, duration: 5 }
      },
      notifications: []
    }
  },

  // API 指標
  [METRIC_NAMES.API.REQUESTS_TOTAL]: {
    name: METRIC_NAMES.API.REQUESTS_TOTAL,
    type: 'counter',
    unit: 'count',
    description: 'API 請求總數',
    tags: ['endpoint', 'method', 'status_code'],
    aggregations: ['sum', 'count'],
    retention: HIGH_FREQUENCY_RETENTION,
    alerting: {
      enabled: false,
      threshold: {},
      notifications: []
    }
  },

  [METRIC_NAMES.API.ERROR_RATE]: {
    name: METRIC_NAMES.API.ERROR_RATE,
    type: 'rate',
    unit: 'percentage',
    description: 'API 錯誤率',
    tags: ['endpoint', 'method'],
    aggregations: ['avg', 'max'],
    retention: DEFAULT_RETENTION_POLICY,
    alerting: {
      enabled: true,
      threshold: {
        warning: { operator: 'gt', value: 2, duration: 5 },
        critical: { operator: 'gt', value: 5, duration: 5 }
      },
      notifications: []
    }
  }
};

/**
 * 指標標籤定義
 */
export const METRIC_TAGS = {
  // 通用標籤
  COMMON: {
    TEAM_ID: 'team_id',
    USER_ID: 'user_id',
    AGENT_ID: 'agent_id',
    PLATFORM: 'platform',
    ENVIRONMENT: 'environment',
    VERSION: 'version'
  },

  // 對話標籤
  CONVERSATION: {
    CONVERSATION_ID: 'conversation_id',
    CUSTOMER_ID: 'customer_id',
    PRIORITY: 'priority',
    STATUS: 'status',
    TOPIC: 'topic',
    SOURCE: 'source'
  },

  // 消息標籤
  MESSAGE: {
    MESSAGE_ID: 'message_id',
    MESSAGE_TYPE: 'message_type',
    SENDER_TYPE: 'sender_type',
    DIRECTION: 'direction'
  },

  // API 標籤
  API: {
    ENDPOINT: 'endpoint',
    METHOD: 'method',
    STATUS_CODE: 'status_code',
    ERROR_TYPE: 'error_type',
    CLIENT_IP: 'client_ip'
  },

  // 系統標籤
  SYSTEM: {
    COMPONENT: 'component',
    SERVICE: 'service',
    INSTANCE: 'instance',
    REGION: 'region'
  }
} as const;

/**
 * 指標聚合週期配置
 */
export const AGGREGATION_PERIODS = {
  REAL_TIME: '1m',
  SHORT_TERM: '5m',
  MEDIUM_TERM: '15m',
  HOURLY: '1h',
  DAILY: '1d',
  WEEKLY: '1w',
  MONTHLY: '1M'
} as const;

/**
 * 指標收集配置
 */
export const METRIC_COLLECTION_CONFIG = {
  BATCH_SIZE: 100,
  FLUSH_INTERVAL: 5000, // 5 秒
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 秒
  COMPRESSION_ENABLED: true,
  COMPRESSION_LEVEL: 6
};

/**
 * 指標警報配置
 */
export const ALERT_SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const;

/**
 * 獲取指標定義
 */
export function getMetricDefinition(metricName: string): MetricDefinition | undefined {
  return PREDEFINED_METRICS[metricName];
}

/**
 * 檢查指標是否存在
 */
export function isMetricDefined(metricName: string): boolean {
  return metricName in PREDEFINED_METRICS;
}

/**
 * 獲取指標的保留政策
 */
export function getRetentionPolicy(metricName: string): RetentionPolicy {
  const definition = getMetricDefinition(metricName);
  return definition?.retention || DEFAULT_RETENTION_POLICY;
}

/**
 * 獲取指標的告警配置
 */
export function getAlertingConfig(metricName: string): AlertingConfig | undefined {
  const definition = getMetricDefinition(metricName);
  return definition?.alerting;
}

/**
 * 驗證指標標籤
 */
export function validateMetricTags(metricName: string, tags: Record<string, string>): {
  valid: boolean;
  errors: string[];
} {
  const definition = getMetricDefinition(metricName);
  if (!definition) {
    return { valid: false, errors: ['Metric not defined'] };
  }

  const errors: string[] = [];
  const requiredTags = definition.tags;

  // 檢查必需的標籤
  for (const requiredTag of requiredTags) {
    if (!(requiredTag in tags)) {
      errors.push(`Missing required tag: ${requiredTag}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 創建自定義指標名稱
 */
export function createCustomMetricName(category: string, name: string): string {
  return `${METRIC_NAMES.CUSTOM.PREFIX}${category}.${name}`;
}

export default {
  METRIC_NAMES,
  PREDEFINED_METRICS,
  METRIC_TAGS,
  DEFAULT_RETENTION_POLICY,
  HIGH_FREQUENCY_RETENTION,
  AGGREGATION_PERIODS,
  METRIC_COLLECTION_CONFIG,
  ALERT_SEVERITY_LEVELS
};