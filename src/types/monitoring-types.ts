// Type Definitions for Deployment Monitoring System
// 專案名稱：Multi-Channel Support MVP - Monitoring Type Definitions

export type HealthStatus = 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown';

export interface ConnectionMetrics {
  active: number;
  total: number;
  successRate: number;
  averageConnectionTime?: number;
  failureReasons?: Record<string, number>;
}

export interface BasicPerformanceMetrics {
  avgLatency: number;
  p95Latency: number;
  p99Latency?: number;
  throughput?: number;
}

export interface ErrorMetrics {
  rate: number; // 0-1
  count: number;
  types?: Record<string, number>;
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number;
  phase?: string;
}

export interface DeploymentMetrics {
  timestamp: number;
  healthScore: number; // 0-100
  status: HealthStatus;
  connections: {
    websocket: ConnectionMetrics;
    sse: ConnectionMetrics;
  };
  performance: {
    websocket: BasicPerformanceMetrics;
    sse: BasicPerformanceMetrics;
  };
  errors: {
    websocket: ErrorMetrics;
    sse: ErrorMetrics;
  };
  resources: {
    cpu: number; // 0-1
    memory: number; // 0-1
    durableObjects: number;
    kvOperations: number;
    bandwidthUsage?: number;
  };
  userExperience: {
    satisfaction: number; // 1-5 scale
    complaints: number;
    conversionRate: number; // 0-1
    sessionDuration?: number;
    bounceRate?: number;
  };
  featureFlags: FeatureFlag[];
  alerts: MonitoringAlert[];
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type AlertCategory = 'performance' | 'errors' | 'connections' | 'resources' | 'deployment';

export interface AlertAction {
  name: string;
  description: string;
  automated: boolean;
}

export interface MonitoringAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: AlertCategory;
  source: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  createdAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  resolution?: string;
  tags?: string[];
  actions?: AlertAction[];
}

export interface PerformanceBaseline {
  websocket: {
    avgLatency: number;
    errorRate: number;
    connectionSuccessRate: number;
  };
  sse: {
    avgLatency: number;
    errorRate: number;
    connectionSuccessRate: number;
  };
  establishedAt: number;
  validUntil?: number;
  sampleSize?: number;
}

export interface HealthCheckResult {
  component: string;
  status: HealthStatus;
  responseTime: number;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export type ComparisonOperator = 'greater_than' | 'less_than' | 'equals' | 'not_equals';
export type AlertActionType = 'webhook' | 'email' | 'rollback' | 'scale';

export interface AlertRuleAction {
  type: AlertActionType;
  config: Record<string, unknown>;
}

export interface AlertingRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: ComparisonOperator;
  threshold: number;
  severity: AlertSeverity;
  evaluationWindow: number; // milliseconds
  cooldownPeriod: number; // milliseconds
  enabled: boolean;
  notificationChannels: string[];
  actions?: AlertRuleAction[];
}

export interface MonitoringDashboard {
  timestamp: number;
  health: {
    overall: string;
    score: number;
    connections: any;
    performance: any;
    errors: any;
    resources: any;
  };
  migration: {
    websocketAdoption: number; // 0-100
    performanceImpact: 'positive' | 'negative' | 'neutral' | 'unknown';
    issueCount: number;
    rollbackReadiness: string;
  };
  features: {
    activeFlags: number;
    inRollout: number;
    emergencyOverrides: number;
  };
  alerts: {
    active: MonitoringAlert[];
    resolved: MonitoringAlert[];
    critical: number;
  };
  trends: {
    latency?: {
      trend: 'improving' | 'degrading' | 'stable';
      change: number; // percentage
    };
    errorRate?: {
      trend: 'improving' | 'degrading' | 'stable';
      change: number; // percentage
    };
    adoption?: {
      trend: 'increasing' | 'decreasing' | 'stable';
      change: number; // percentage
    };
  };
  recommendations: string[];
}

// Additional types needed by performance-dashboard.ts
export interface DashboardData {
  timestamp: number;
  summary: {
    health: string;
    score: number;
    activeConnections: number;
    errorRate: number;
    uptime?: number;
  };
  metrics?: PerformanceMetrics;
  realTimeMetrics?: PerformanceMetrics;
  historicalData?: {
    timeRange: string;
    dataPoints: PerformanceMetrics[];
    aggregations: any;
  };
  alerts: MonitoringAlert[];
  components?: ComponentStatus[];
  trends?: MetricTrends;
}

export interface PerformanceMetrics {
  timestamp: number;
  websocket: {
    connections: number;
    activeConnections: number;
    latency: number;
    averageLatency: number;
    throughput: number;
    errorRate: number;
  };
  /**
   * @deprecated SSE has been fully replaced by WebSocket architecture (Phase 4 Complete)
   * This property is kept for backward compatibility but will be removed in future versions.
   * All connection statistics are now tracked via WebSocket metrics.
   */
  sse?: {
    connections: number;
    latency: number;
    averageLatency: number;
    throughput: number;
    errorRate: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    requestsPerSecond: number;
    workerInvocations: number;
    edgeLocations: number;
    lastUpdated: number;
  };
  durableObjects?: {
    messageBroadcaster: {
      eventsPerSecond: number;
      queueDepth: number;
      deliverySuccessRate: number;
      averageLatency: number;
      activeConnections: number;
    };
    conversationRooms: {
      sampleSize: number;
      averageParticipants: number;
      averageMessagesPerRoom: number;
      totalRoomsActive: number;
    };
    overallHealth: number;
    lastUpdated: number;
  };
  messaging?: {
    totalMessages: number;
    messagesPerSecond: number;
    averageProcessingTime: number;
    queueDepth: number;
    successRate: number;
    throughput: number;
    errorRate: number;
    lastUpdated: number;
  };
  aggregated: {
    overallLatency: number;
    totalThroughput: number;
    overallErrorRate: number;
    systemLoad: number;
  };
  comparison: {
    latencyImprovement: number;
    throughputIncrease: number;
    reliabilityGain: number;
  };
}

export interface SystemHealth {
  overall?: 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown';
  status?: 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown';
  score: number;
  components?: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown';
    metrics?: Record<string, number>;
  }>;
  timestamp?: number;
  metrics?: PerformanceMetrics;
  alerts?: MonitoringAlert[];
  uptime?: number;
  lastUpdated?: number;
}

export interface ComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown';
  metrics: Record<string, number>;
  lastCheck: number;
}

export interface MetricTrends {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  change: number;
  period: string;
  confidence: number;
}

// Additional exports needed by performance-monitor.ts
export type AlertRule = AlertingRule; // Alias for compatibility

export interface MonitoringConfig {
  enabled: boolean;
  intervals: {
    collection: number;
    aggregation: number;
    cleanup: number;
  };
  retention: {
    metrics: number;
    alerts: number;
  };
  thresholds: Record<string, MetricThreshold>;
  alerting: {
    enabled: boolean;
    channels: string[];
    escalation: {
      levels: number;
      timeouts: number[];
    };
  };
}

export interface MetricThreshold {
  warning: number;
  critical: number;
  unit: string;
  description?: string;
}

// Unified AlertNotification interface combining all needed properties
export interface AlertNotification {
  id: string;
  title?: string;
  description?: string;
  message?: string;
  severity: AlertSeverity;
  alertStatus?: AlertStatus;
  category?: AlertCategory;
  source?: string;
  metric?: string;
  value?: number;
  threshold?: number;
  triggeredAt?: number;
  lastTriggered?: number;
  acknowledgedAt?: number;
  acknowledged?: boolean;
  count?: number;
  data?: any;
  createdAt?: number;
  resolvedAt?: number;
  resolution?: string;
  tags?: string[];
  actions?: AlertAction[];
  // Notification-specific properties
  alert: MonitoringAlert;
  channels: string[];
  sentAt: number;
  status: 'pending' | 'sent' | 'failed';
}
