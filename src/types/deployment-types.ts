// Type Definitions for Deployment Feature Flags System
// 專案名稱：Multi-Channel Support MVP - Deployment Type Definitions

export interface FeatureFlagConfig {
  name: string;
  enabled: boolean;
  description?: string;
  deploymentPhase?: string;
  rolloutPercentage?: number; // Added for compatibility
  rollout: {
    percentage: number;
    strategy?: 'hash' | 'random' | 'geographic' | 'time_based';
  };
  targeting: UserTargeting;
  abTest?: ABTestConfig;
  conditions?: FlagCondition[];
  metadata?: {
    owner: string;
    createdAt: number;
    lastModified: number;
    tags: string[];
  };
}

export interface UserTargeting {
  includeRoles?: string[];
  excludeRoles?: string[];
  includeTeams?: number[];
  excludeTeams?: number[];
  includeUsers?: string[];
  excludeUsers?: string[];
  includeGeographies?: string[];
  excludeGeographies?: string[];
  includeRegions?: string[]; // Added for compatibility
  targetHighActivity?: boolean;
  targetNewUsers?: boolean;
  minUserAge?: number; // days
  maxUserAge?: number; // days
}

export interface DeploymentPhase {
  name: string;
  rolloutPercentage: number;
  userTargeting: UserTargeting;
  duration: number; // milliseconds, -1 for permanent
  requirements: string[];
  autoAdvance?: boolean;
  rollbackThreshold?: {
    errorRate: number;
    userComplaints: number;
  };
}

export interface ABTestConfig {
  name: string;
  testName?: string; // Added for compatibility
  enabled?: boolean; // Added for compatibility
  description?: string;
  variants: Array<{
    name: string;
    weight: number; // percentage, must sum to 100
    enabled: boolean;
    config?: Record<string, any>;
  }>;
  metrics: string[];
  duration?: number; // milliseconds
  minSampleSize?: number;
  confidenceThreshold?: number; // 0-1
}

export interface FlagCondition {
  type: 'user_property' | 'request_property' | 'time_window' | 'dependency';
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  property: string;
  value: any;
}

export interface FlagOverride {
  enabled: boolean;
  reason: string;
  createdAt: number;
  createdBy: string;
  expiresAt?: number;
  userIds?: string[];
  teamIds?: number[];
}

export interface FlagMetrics {
  flagName: string;
  evaluations: {
    total: number;
    enabled: number;
    disabled: number;
    errors: number;
  };
  performance: {
    averageEvaluationTime: number; // milliseconds
    cacheHitRate: number; // 0-1
    errorRate: number; // 0-1
  };
  rollout: {
    currentPercentage: number;
    targetPercentage: number;
    affectedUsers: number;
  };
  abTest?: {
    variants: Record<string, {
      participants: number;
      successRate: number;
      errorRate: number;
      conversionRate?: number;
    }>;
    winningVariant?: string;
    confidenceLevel: number;
  };
  lastUpdated: number;
}

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  rolloutStrategy: 'immediate' | 'gradual' | 'canary' | 'blue_green';
  phases: DeploymentPhase[];
  rollbackPolicy: {
    automatic: boolean;
    triggers: string[];
    maxRolloutPercentage: number;
  };
  monitoring: {
    metricsCollection: boolean;
    alerting: boolean;
    dashboards: string[];
  };
}

export interface GeographicRollout {
  regions: Array<{
    code: string;
    name: string;
    percentage: number;
    priority: number;
  }>;
  strategy: 'priority_order' | 'parallel' | 'time_zone_based';
}

export interface CanaryConfig {
  userGroups: string[];
  percentage: number;
  duration: number;
  successCriteria: {
    errorRate: number;
    latency: number;
    userSatisfaction: number;
  };
  autoPromote: boolean;
  autoRollback: boolean;
}

export interface BlueGreenConfig {
  environments: {
    blue: string;
    green: string;
  };
  switchStrategy: 'instant' | 'gradual';
  healthChecks: string[];
  rollbackTimeout: number;
}

export interface FeatureDependency {
  dependsOn: string[];
  conflicts: string[];
  requires: Array<{
    flag: string;
    condition: 'enabled' | 'disabled' | 'percentage_above' | 'percentage_below';
    value?: number;
  }>;
}

export interface RolloutSchedule {
  phases: Array<{
    name: string;
    startTime: number;
    endTime: number;
    percentage: number;
    targeting: UserTargeting;
  }>;
  timezone: string;
  pauseWindows: Array<{
    start: string; // HH:MM
    end: string; // HH:MM
    days: number[]; // 0-6, Sunday = 0
  }>;
}

export interface FlagAuditLog {
  timestamp: number;
  action: 'created' | 'updated' | 'enabled' | 'disabled' | 'deleted' | 'rollback';
  flagName: string;
  userId: string;
  changes: Record<string, {
    before: any;
    after: any;
  }>;
  reason?: string;
}

export interface DeploymentValidation {
  tests: Array<{
    name: string;
    type: 'unit' | 'integration' | 'performance' | 'security';
    status: 'pending' | 'running' | 'passed' | 'failed';
    duration?: number;
    error?: string;
  }>;
  requirements: Array<{
    name: string;
    met: boolean;
    description: string;
  }>;
  overallStatus: 'pending' | 'validating' | 'passed' | 'failed';
}

// Additional types for staged deployment service
export interface DeploymentStage {
  name: string;
  id: string;
  order: number;
  percentage: number;
  duration: number;
  requirements: string[];
  features: string[];
  autoAdvance?: boolean;
  validation: {
    pre: string[];
    post: string[];
  };
  rollbackCriteria: {
    errorRate: number;
    userComplaints: number;
    performanceDegradation: number;
  };
  successCriteria: {
    errorRate: number;
    latency: number;
    throughput: number;
  };
}

export interface DeploymentPlan {
  id: string;
  features: string[];
  stages: DeploymentStage[];
  createdAt: number;
  createdBy?: string;
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'cancelled';
  currentStage: string | null;
  options: {
    environment?: string;
    skipStages?: string[];
    customValidation?: string[];
    emergencyContacts?: string[];
  };
  validation: {
    preDeployment: string[];
    postDeployment: string[];
    rollbackCriteria: string[];
  };
  timeline: {
    totalDuration: number;
    stages: Array<{ name: string; duration: number; startOffset: number }>;
  };
  risks: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    mitigation: string;
  }>;
  rollbackPlan: {
    triggerCriteria: string[];
    steps: Array<{ step: string; estimatedDuration: number }>;
    estimatedDuration: number;
  };
}

export interface DeploymentExecution {
  id?: string;
  executionId: string;
  planId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_for_promotion';
  currentStageIndex: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
  metrics: DeploymentMetrics[];
  issues: string[];
  decisions: string[];
  stages: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: number | null;
    completedAt?: number | null;
    autoAdvance?: boolean;
    error?: string;
    validation?: StageValidation;
  }>;
}

export interface StageValidation {
  phase?: 'pre' | 'post';
  passed: boolean;
  results: Array<{
    criterion: string;
    passed: boolean;
    value: number;
    threshold: number;
  }>;
  failures?: string[];
  timestamp?: number;
}

export interface DeploymentMetrics {
  timestamp: number;
  stage: string;
  metrics: {
    errorRate: number;
    latency: number;
    throughput: number;
    userComplaints: number;
    connectionSuccess: number;
  };
}