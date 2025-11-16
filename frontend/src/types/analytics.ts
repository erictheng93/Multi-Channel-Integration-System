// Analytics Module Type Definitions
// 與後端 src/modules/analytics/services/period-comparison-service.ts 同步

export interface Period {
  start: string;
  end: string;
  label?: string;
}

export interface ComparisonData {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  trend: 'up' | 'down' | 'stable';
  period: {
    current: Period;
    previous: Period;
  };
}

export interface MultiMetricComparison {
  metrics: Record<string, ComparisonData>;
  summary: {
    totalMetrics: number;
    improvedMetrics: number;
    declinedMetrics: number;
    stableMetrics: number;
    overallTrend: 'positive' | 'negative' | 'neutral' | 'mixed';
  };
  period: {
    current: Period;
    previous: Period;
  };
}

export interface PeriodComparisonQuery {
  metric: string;
  currentPeriod: Period;
  previousPeriod?: Period;
  filters?: {
    teamId?: number;
    userId?: number;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  totalRequests: number;
  hitRate: number;
}

export interface ComparisonAPIResponse<T = ComparisonData | MultiMetricComparison> {
  success: boolean;
  data: T;
  metadata: {
    metric?: string;
    metricsCount?: number;
    preset?: string;
    currentPeriod: Period;
    previousPeriod?: Period;
    processedAt: string;
  };
  error?: string;
}

export interface MetricDefinition {
  key: string;
  label: string;
  description?: string;
  unit?: string;
  formatter?: (_value: number) => string;
  category?: 'conversation' | 'message' | 'user' | 'performance';
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  totalConversations: {
    key: 'totalConversations',
    label: '總對話數',
    description: '系統中所有對話的總數',
    unit: '個',
    category: 'conversation'
  },
  activeConversations: {
    key: 'activeConversations',
    label: '活躍對話',
    description: '當前活躍狀態的對話數量',
    unit: '個',
    category: 'conversation'
  },
  closedConversations: {
    key: 'closedConversations',
    label: '已關閉對話',
    description: '已結束的對話數量',
    unit: '個',
    category: 'conversation'
  },
  totalMessages: {
    key: 'totalMessages',
    label: '總消息數',
    description: '系統中所有消息的總數',
    unit: '則',
    category: 'message'
  },
  customerMessages: {
    key: 'customerMessages',
    label: '客戶消息',
    description: '客戶發送的消息數量',
    unit: '則',
    category: 'message'
  },
  agentMessages: {
    key: 'agentMessages',
    label: '客服消息',
    description: '客服發送的消息數量',
    unit: '則',
    category: 'message'
  },
  activeUsers: {
    key: 'activeUsers',
    label: '活躍用戶',
    description: '活躍的用戶數量',
    unit: '人',
    category: 'user'
  },
  totalActivities: {
    key: 'totalActivities',
    label: '總活動數',
    description: '用戶活動的總數',
    unit: '次',
    category: 'user'
  },
  averageResponseTime: {
    key: 'averageResponseTime',
    label: '平均回應時間',
    description: '客服平均回應時間',
    unit: '秒',
    category: 'performance',
    formatter: (_value: number) => {
      if (_value < 60) {return `${_value.toFixed(0)}秒`;}
      if (_value < 3600) {return `${(_value / 60).toFixed(1)}分鐘`;}
      return `${(_value / 3600).toFixed(1)}小時`;
    }
  },
  firstResponseTime: {
    key: 'firstResponseTime',
    label: '首次回應時間',
    description: '首次回應客戶的平均時間',
    unit: '秒',
    category: 'performance',
    formatter: (_value: number) => {
      if (_value < 60) {return `${_value.toFixed(0)}秒`;}
      if (_value < 3600) {return `${(_value / 60).toFixed(1)}分鐘`;}
      return `${(_value / 3600).toFixed(1)}小時`;
    }
  }
};

export type MetricPreset = 'conversation' | 'message' | 'user-activity';

export const METRIC_PRESETS: Record<MetricPreset, string[]> = {
  conversation: ['total_conversations', 'active_conversations', 'closed_conversations'],
  message: ['total_messages', 'customer_messages', 'agent_messages'],
  'user-activity': ['active_users', 'total_activities']
};