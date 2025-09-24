// Type Definitions for Emergency Rollback System
// 專案名稱：Multi-Channel Support MVP - Rollback Type Definitions

export interface RollbackTrigger {
  type: 'error_rate' | 'latency_increase' | 'connection_failures' | 'user_complaints' | 'resource_exhaustion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  threshold: number;
  description: string;
  timestamp?: number;
}

export interface RollbackOperation {
  id: string;
  type: 'instant_emergency' | 'partial' | 'gradual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  reason: string;
  triggeredBy: string;
  startTime: number;
  endTime?: number;
  estimatedDuration: number;
  actualDuration?: number;
  targetUsers: string; // 'all' or specific count/description
  progress: number; // 0-100
  error?: string;
  steps: Array<{
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    duration: number;
    error?: string;
  }>;
}

export interface RollbackStatus {
  hasActiveRollback: boolean;
  activeOperations: RollbackOperation[];
  recentOperationsCount: number;
  systemHealth: 'healthy' | 'degraded' | 'critical' | 'unknown';
  rollbackReadiness: 'ready' | 'degraded' | 'unavailable' | 'unknown';
  lastEmergencyAction: RollbackOperation | null;
  thresholds: {
    ERROR_RATE: number;
    LATENCY_INCREASE: number;
    CONNECTION_FAILURES: number;
    USER_COMPLAINTS: number;
  };
  capabilities: {
    instantRollback: boolean;
    partialRollback: boolean;
    gradualRollback: boolean;
    automatedTriggers: boolean;
  };
}

export interface RollbackDecision {
  shouldRollback: boolean;
  triggers: RollbackTrigger[];
  recommendedAction: string;
  confidence: number; // 0-1
  timestamp: number;
}

export interface EmergencyMetrics {
  errorRate: number; // 0-1
  latencyIncrease: number; // milliseconds
  connectionFailureRate: number; // 0-1
  userComplaints: number;
  resourceUsage: {
    cpu: number; // 0-1
    memory: number; // 0-1
    durableObjectCount: number;
    activeConnections: number;
  };
  sampleSize: number;
  dataAge: number; // milliseconds
}

export interface RollbackTarget {
  userIds?: string[];
  teamIds?: number[];
  conversationIds?: string[];
  roles?: string[];
  geography?: string[];
  percentage?: number;
}

export interface RollbackConfiguration {
  enabledTriggers: string[];
  thresholds: {
    errorRate: number;
    latencyIncrease: number;
    connectionFailures: number;
    userComplaints: number;
  };
  automatedRollback: boolean;
  notificationChannels: string[];
  escalationDelay: number; // milliseconds
}

export interface AutomatedDecision {
  evaluationId: string;
  timestamp: number;
  metrics: EmergencyMetrics;
  context: DecisionContext;
  decision: RollbackDecision;
  actions: Array<{
    action: string;
    result: any;
    timestamp: number;
  }>;
  confidence: number;
  duration: number; // milliseconds
  error?: string;
}

export interface DecisionContext {
  timestamp: number;
  deploymentPhase: string;
  timeOfDay: number; // 0-23
  dayOfWeek: number; // 0-6, Sunday = 0
  isPeakHours: boolean;
  activeUserCount: number;
  systemLoad: number; // 0-1
  recentDeployments: any[];
  maintenanceWindow: boolean;
}

export interface RollbackRule {
  name: string;
  condition: (metrics: EmergencyMetrics, context?: DecisionContext) => boolean;
  action: 'monitor' | 'gradual_rollback' | 'instant_rollback' | 'partial_rollback';
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // milliseconds
  description: string;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
  evaluationWindow: number; // milliseconds
}