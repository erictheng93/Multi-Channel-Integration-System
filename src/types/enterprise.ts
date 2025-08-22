// Enterprise module type definitions
// Types for RBAC, audit logging, and analytics

// RBAC (Role-Based Access Control) types
export interface RBACPermission {
  resource: string;
  action: string;
  context?: Record<string, unknown>;
}

export interface RBACRole {
  id: string;
  name: string;
  description?: string;
  permissions: RBACPermission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RBACUser {
  userId: number;
  roles: string[];
  permissions: RBACPermission[];
  context: Record<string, unknown>;
}

export interface RBACContext {
  userId: number;
  teamId?: number;
  resourceId?: string | number;
  conversationId?: number;  // For conversation-specific permissions
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
}

export interface AccessControlResult {
  allowed: boolean;
  reason?: string;
  appliedRules: string[];
  context: RBACContext;
}

// Audit logging types
export interface AuditLogEntry {
  id: string;
  userId: number;
  action: string;
  resource: string;
  resourceId?: string | number;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export type LogCategory = 'auth' | 'data' | 'system' | 'security' | 'api';
export type LogLevel = 'info' | 'warning' | 'error' | 'critical';
export type OperationResult = 'success' | 'failure' | 'partial';

export interface AuditLogFilter {
  userId?: number;
  action?: string;
  resource?: string;
  category?: LogCategory;
  level?: LogLevel;
  result?: OperationResult;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogStats {
  totalLogs: number;
  logsByCategory: Record<LogCategory, number>;
  logsByLevel: Record<LogLevel, number>;
  logsByResult: Record<OperationResult, number>;
  topUsers: Array<{ userId: number; count: number; userName?: string }>;
  topActions: Array<{ action: string; count: number }>;
  timeRange: {
    from: string;
    to: string;
  };
}

export interface AuditLogMetadata {
  correlationId?: string;
  sessionId?: string;
  traceId?: string;
  duration?: number;
  size?: number;
  version?: string;
  environment?: string;
}

// Analytics types
export interface AnalyticsFilter {
  dateFrom?: string;
  dateTo?: string;
  teamId?: number;
  platform?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  [key: string]: unknown;
}

export interface AnalyticsMetric {
  name: string;
  value: number;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationAnalytics {
  totalConversations: number;
  activeConversations: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionScore?: number;
  volumeByHour: TimeSeriesData[];
  volumeByPlatform: Record<string, number>;
  responseTimeDistribution: Record<string, number>;
}

export interface AgentPerformance {
  agentId: number;
  agentName: string;
  totalConversations: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionScore?: number;
  utilization: number; // 0-100%
  activeTime: number; // minutes
  metrics: AnalyticsMetric[];
}

export interface TeamAnalytics {
  teamId: number;
  teamName: string;
  totalAgents: number;
  activeAgents: number;
  totalConversations: number;
  avgResponseTime: number;
  workload: number; // 0-100%
  satisfactionScore?: number;
  agents: AgentPerformance[];
  trends: {
    conversations: TimeSeriesData[];
    responseTime: TimeSeriesData[];
    satisfaction: TimeSeriesData[];
  };
}

export interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  messageVelocity: number; // messages per hour
  errorRate: number; // 0-100%
  uptime: number; // 0-100%
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
    bandwidth: number;
  };
  realTimeMetrics: Record<string, unknown>;
}

export interface DashboardData {
  overview: {
    totalConversations: number;
    activeConversations: number;
    totalAgents: number;
    availableAgents: number;
    avgResponseTime: number;
    satisfactionScore?: number;
  };
  charts: {
    conversationVolume: TimeSeriesData[];
    responseTimesTrend: TimeSeriesData[];
    platformDistribution: Record<string, number>;
    agentUtilization: Array<{ name: string; value: number }>;
  };
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  recentActivity: AuditLogEntry[];
}

// Prediction and ML types
export interface PredictionModel {
  name: string;
  version: string;
  accuracy: number;
  lastTrained: string;
  features: string[];
  metadata?: Record<string, unknown>;
}

export interface ResourcePrediction {
  metric: string;
  predictedValue: number;
  confidence: number;
  timeframe: string;
  recommendations: string[];
}

export interface SatisfactionPrediction {
  conversationId: number;
  predictedScore: number;
  confidence: number;
  factors: Array<{
    factor: string;
    impact: number;
    value: unknown;
  }>;
}

export interface SeasonalityPattern {
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
  pattern: Record<string, number>;
  strength: number;
  confidence: number;
}

// Export formatting types
export interface ExportRequest {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  data: Record<string, unknown>[];
  filename?: string;
  options?: {
    includeHeaders?: boolean;
    dateFormat?: string;
    timezone?: string;
    filters?: Record<string, unknown>;
  };
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  filename: string;
  size: number;
  format: string;
  expiresAt?: string;
  error?: string;
}

// Common enterprise interfaces
export interface EnterpriseConfig {
  features: {
    rbac: boolean;
    auditLogging: boolean;
    analytics: boolean;
    predictions: boolean;
    dataExport: boolean;
  };
  limits: {
    maxUsers: number;
    maxTeams: number;
    maxConversations: number;
    dataRetentionDays: number;
    auditRetentionDays: number;
  };
  integrations: {
    sso?: {
      enabled: boolean;
      provider: string;
      config: Record<string, unknown>;
    };
    ldap?: {
      enabled: boolean;
      server: string;
      config: Record<string, unknown>;
    };
  };
}