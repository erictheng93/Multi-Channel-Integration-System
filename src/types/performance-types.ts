// Type Definitions for Performance Validation System
// 專案名稱：Multi-Channel Support MVP - Performance Type Definitions

export interface PerformanceMetrics {
  connectionType: 'websocket';
  timeRange: {
    start: number;
    end: number;
  };
  latency: {
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    messagesPerSecond: number;
    connectionsPerSecond: number;
    peakConcurrentConnections: number;
    dataTransferRate: number; // bytes per second
  };
  reliability: {
    uptime: number; // 0-1
    connectionSuccessRate: number; // 0-1
    errorRate: number; // 0-1
    reconnectionRate: number; // 0-1
  };
  efficiency: {
    cpuUtilization: number; // 0-1
    memoryUtilization: number; // 0-1
    networkUtilization: number; // 0-1
    bandwidthEfficiency: number; // 0-1
    compressionRatio: number; // 0-1
  };
  scalability: {
    maxConcurrentConnections: number;
    connectionGrowthRate: number;
    resourceScalingEfficiency: number;
  };
}

export interface PerformanceComparison {
  timeRange: {
    start: number;
    end: number;
  };
  websocket: {
    metrics: PerformanceMetrics;
    score: {
      overall: number;
      latency: number;
      throughput: number;
      reliability: number;
      efficiency: number;
    };
    advantages: string[];
    disadvantages: string[];
  };
  comparison: {
    winner: 'websocket' | 'tie';
    winnerScore: number;
    scoreDifference: number;
    keyDifferentiators: string[];
    confidence: number; // 0-1
  };
  recommendations: OptimizationRecommendation[];
  loadTestResults?: LoadTestResult | null;
  generatedAt: number;
}

export interface ValidationResult {
  connectionType: 'websocket';
  timeRange: {
    start: number;
    end: number;
  };
  slaTargets: {
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: {
      messagesPerSecond: number;
      connectionsPerSecond: number;
      peakConcurrentConnections: number;
    };
    reliability: {
      uptime: number;
      connectionSuccess: number;
      errorRate: number;
    };
    efficiency: {
      cpuUtilization: number;
      memoryUtilization: number;
      bandwidthEfficiency: number;
    };
  };
  results: Array<{
    connectionType: string;
    validations: Array<{
      metric: string;
      target: number;
      actual: number;
      passed: boolean;
      score: number;
    }>;
    passed: boolean;
    score: number;
    passingCount: number;
    totalCount: number;
  }>;
  overallPass: boolean;
  score: number;
  validatedAt: number;
}

export interface PerformanceBenchmark {
  name: string;
  category: 'latency' | 'throughput' | 'reliability' | 'efficiency' | 'scalability';
  baseline: {
    value: number;
    unit: string;
    measuredAt: number;
    conditions: string[];
  };
  target: {
    value: number;
    unit: string;
    improvementExpected: number; // percentage
  };
  current?: {
    value: number;
    unit: string;
    measuredAt: number;
    comparisonToBaseline: number; // percentage change
    comparisonToTarget: number; // percentage of target achieved
  };
}

export interface OptimizationRecommendation {
  category: 'latency' | 'throughput' | 'reliability' | 'efficiency' | 'comparative';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  recommendations: string[];
  expectedImprovement: string;
  estimatedImplementationTime: string;
  dependencies?: string[];
  risks?: string[];
}

export interface LoadTestResult {
  testId: string;
  config: {
    connectionType: 'websocket';
    duration: number;
    concurrentUsers: number;
    messagesPerUser: number;
    rampUpTime: number;
    includeStressTest: boolean;
  };
  startTime: number;
  endTime: number;
  results: {
    websocket?: {
      connectionType: string;
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageLatency: number;
      p95Latency: number;
      p99Latency: number;
      throughput: number;
      peakConcurrentConnections: number;
      errorRate: number;
      resourceUtilization: {
        cpu: number;
        memory: number;
      };
    };
  };
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
    errorRate: number;
    peakConcurrentConnections: number;
  };
  stressTestResults?: {
    maxCapacity: {
      concurrentConnections: number;
      messagesPerSecond: number;
      sustainedDuration: number;
    };
    breakingPoint: {
      connections: number;
      latencyDegradation: number;
      errorRateSpike: number;
    };
    recoveryTime: number;
    gracefulDegradation: boolean;
  };
  issues: string[];
  recommendations: string[];
}

export interface PerformanceTrend {
  metric: string;
  timeRange: {
    start: number;
    end: number;
  };
  dataPoints: Array<{
    timestamp: number;
    value: number;
    connectionType: 'websocket';
  }>;
  trend: {
    direction: 'improving' | 'degrading' | 'stable';
    rate: number; // percentage change per hour
    confidence: number; // 0-1
  };
  seasonality?: {
    detected: boolean;
    pattern: 'daily' | 'weekly' | 'monthly';
    amplitude: number;
  };
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  connectionType: 'websocket';
  threshold: {
    value: number;
    operator: 'greater_than' | 'less_than' | 'equals';
    unit: string;
  };
  current: {
    value: number;
    timestamp: number;
  };
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'active' | 'resolved' | 'acknowledged';
  createdAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  description: string;
  recommendedActions: string[];
}

export interface CapacityPlan {
  current: {
    connections: number;
    throughput: number;
    resourceUsage: {
      cpu: number;
      memory: number;
      network: number;
    };
    bottlenecks: string[];
  };
  projected: {
    timeframe: number; // days
    growthRate: number; // percentage
    peakLoad: {
      connections: number;
      throughput: number;
      expectedAt: number;
    };
    resourceRequirements: {
      additionalWorkers: number;
      additionalDurableObjects: number;
      bandwidthIncrease: number;
      storageIncrease: number;
    };
  };
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'scaling' | 'optimization' | 'infrastructure';
    description: string;
    timeline: string;
    costImpact: 'low' | 'medium' | 'high';
    riskMitigation: string[];
  }>;
  generatedAt: number;
  validUntil: number;
}

export interface PerformanceBaseline {
  name: string;
  version: string;
  establishedAt: number;
  validUntil?: number;
  metrics: {
    websocket: PerformanceMetrics;
  };
  conditions: {
    environment: string;
    loadLevel: 'low' | 'medium' | 'high';
    userTypes: string[];
    dataVolume: string;
  };
  confidence: number; // 0-1
  sampleSize: number;
}

// =================== Internal Types for Performance Validation ===================

/**
 * Performance score breakdown
 */
export interface PerformanceScore {
  overall: number;
  latency: number;
  throughput: number;
  reliability: number;
  efficiency: number;
}

/**
 * Detailed analysis of WebSocket performance
 */
export interface PerformanceDetailedAnalysis {
  websocketAdvantages: string[];
  websocketDisadvantages: string[];
}

/**
 * Single validation result for a metric against SLA target
 */
export interface SLAValidationItem {
  metric: string;
  target: number;
  actual: number;
  passed: boolean;
  score: number;
}

/**
 * Validation results for a connection type
 */
export interface ConnectionValidationResult {
  connectionType: string;
  validations: SLAValidationItem[];
  passed: boolean;
  score: number;
  passingCount: number;
  totalCount: number;
}

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  connectionType: 'websocket';
  duration: number;
  concurrentUsers: number;
  messagesPerUser: number;
  rampUpTime: number;
  includeStressTest: boolean;
}

/**
 * Connection type load test result
 */
export interface ConnectionTypeLoadTestResult {
  connectionType: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  peakConcurrentConnections: number;
  errorRate: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
  };
}

/**
 * Load test summary aggregated across connection types
 */
export interface LoadTestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  peakConcurrentConnections: number;
}

/**
 * Validation history entry
 */
export interface ValidationHistoryEntry {
  timestamp: number;
  connectionType: 'websocket';
  passed: boolean;
  score: number;
  metrics: PerformanceMetrics;
}