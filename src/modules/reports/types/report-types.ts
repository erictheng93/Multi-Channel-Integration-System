// Reports 模組類型定義
// Comprehensive reporting system with multiple report types and export formats

import type { Bindings } from '@/types';
import type { Context } from 'hono';

// ======================== 基礎類型 ========================

/**
 * 報告類型定義
 */
export type ReportType =
  // === 原有報表類型 ===
  | 'conversation_summary'     // 對話摘要報告
  | 'agent_performance'        // 客服績效報告
  | 'team_analytics'           // 團隊分析報告
  | 'customer_satisfaction'    // 客戶滿意度報告
  | 'platform_usage'          // 平台使用情況
  | 'message_statistics'       // 訊息統計報告
  | 'response_time_analysis'   // 回應時間分析
  | 'workload_distribution'    // 工作量分配報告
  | 'system_health'            // 系統健康報告
  | 'custom'                   // 自定義報告

  // === Phase 1: 企業級高優先級報表 ===
  | 'cost_analysis'            // 💰 成本分析報告
  | 'sla_compliance'           // ⚖️ SLA合規報告
  | 'anomaly_detection'        // 🚨 異常檢測報告
  | 'audit_trail'              // 📋 審計追蹤報告
  | 'resource_utilization'     // ⚡ 資源利用率報告

  // === Phase 2: 商業智能增強 ===
  | 'trend_forecast'           // 📈 趨勢預測報告
  | 'customer_insights'        // 💡 客戶洞察報告
  | 'channel_integration'      // 🌐 多通道整合報告
  | 'goal_achievement'         // 🎯 目標達成報告
  | 'automation_effectiveness' // 🤖 自動化成效報告

  // === Phase 3: 高級分析功能 ===
  | 'security_risk'            // 🔒 資安風險報告
  | 'knowledge_base'           // 📚 知識庫效能報告
  | 'call_quality'             // 📞 通話品質分析報告
  | 'executive_summary'        // 💼 高管摘要報告
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
  | 'json'      // JSON 格式
  | 'csv'       // CSV 格式
  | 'excel'     // Excel 格式
  | 'pdf'       // PDF 格式
  | 'html'      // HTML 格式
  ;

/**
 * 報告狀態
 */
export type ReportStatus =
  | 'pending'      // 待處理
  | 'generating'   // 生成中
  | 'completed'    // 已完成
  | 'failed'       // 失敗
  | 'expired'      // 已過期
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

// ======================== 具體報告類型 ========================

/**
 * 對話摘要報告資料
 */
export interface ConversationSummaryReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  totalConversations: number;
  activeConversations: number;
  completedConversations: number;
  averageResponseTime: number; // minutes
  averageResolutionTime: number; // minutes
  conversationsByPlatform: Record<string, number>;
  conversationsByPriority: Record<string, number>;
  conversationsByTeam: Record<string, number>;
  hourlyDistribution: Array<{
    hour: number;
    count: number;
  }>;
  dailyTrends: Array<{
    date: string;
    conversations: number;
    messages: number;
    avgResponseTime: number;
  }>;
  topTags: Array<{
    tag: string;
    count: number;
  }>;
}

/**
 * 客服績效報告資料
 */
export interface AgentPerformanceReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  totalAgents: number;
  activeAgents: number;
  agentMetrics: Array<{
    agentId: string;
    agentName: string;
    teamId: string;
    teamName: string;
    conversationsHandled: number;
    messagesHandled: number;
    averageResponseTime: number;
    customerSatisfactionScore: number;
    resolutionRate: number;
    activeHours: number;
    efficiency: number; // conversations per hour
  }>;
  teamComparisons: Array<{
    teamId: string;
    teamName: string;
    agentCount: number;
    totalConversations: number;
    averageResponseTime: number;
    satisfactionScore: number;
  }>;
  performanceTrends: Array<{
    date: string;
    responseTime: number;
    satisfaction: number;
    throughput: number;
  }>;
}

/**
 * 客戶滿意度報告資料
 */
export interface CustomerSatisfactionReportData {
  overallSatisfaction: {
    average: number;
    total: number;
    distribution: Record<number, number>; // rating -> count
  };
  satisfactionByPlatform: Record<string, {
    average: number;
    total: number;
  }>;
  satisfactionByTeam: Record<string, {
    average: number;
    total: number;
  }>;
  satisfactionTrends: Array<{
    date: string;
    average: number;
    count: number;
  }>;
  feedbackKeywords: Array<{
    keyword: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    count: number;
  }>;
  improvementSuggestions: string[];
}

/**
 * 系統健康報告資料
 */
export interface SystemHealthReportData {
  uptime: {
    percentage: number;
    totalHours: number;
    downtime: Array<{
      start: string;
      end: string;
      duration: number; // minutes
      reason?: string;
    }>;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number; // requests per minute
    errorRate: number; // percentage
  };
  resources: {
    cpuUsage: number; // percentage
    memoryUsage: number; // percentage
    diskUsage: number; // percentage
    networkUsage: {
      inbound: number; // MB/s
      outbound: number; // MB/s
    };
  };
  database: {
    connectionCount: number;
    queryPerformance: number; // average ms
    slowQueries: number;
    errors: number;
  };
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

// === Phase 1: 新增報表類型資料介面 ===

/**
 * 💰 成本分析報告資料
 */
export interface CostAnalysisReportData {
  totalCosts: {
    operational: number;        // 營運成本
    personnel: number;          // 人力成本
    technology: number;         // 技術成本
    overhead: number;           // 管理費用
  };
  costByTeam: Array<{
    teamId: string;
    teamName: string;
    totalCost: number;
    avgCostPerAgent: number;
    avgCostPerConversation: number;
    costBreakdown: {
      salary: number;
      training: number;
      tools: number;
      overhead: number;
    };
  }>;
  costEfficiency: {
    costPerConversation: number;
    costPerResolution: number;
    costPerCustomer: number;
    rOI: number;                // 投資報酬率
  };
  monthlyTrends: Array<{
    month: string;
    totalCost: number;
    conversations: number;
    costPerConversation: number;
    budgetVariance: number;     // 預算差異百分比
  }>;
  budgetComparison: {
    allocated: number;
    actual: number;
    variance: number;
    utilizationRate: number;
  };
  costSavingOpportunities: Array<{
    category: string;
    description: string;
    estimatedSaving: number;
    effort: 'low' | 'medium' | 'high';
  }>;
}

/**
 * ⚖️ SLA合規報告資料
 */
export interface SLAComplianceReportData {
  overallCompliance: {
    percentage: number;
    target: number;
    variance: number;
    status: 'compliant' | 'at_risk' | 'non_compliant';
  };
  slaMetrics: Array<{
    slaType: 'response_time' | 'resolution_time' | 'availability' | 'quality';
    metric: string;
    target: number;
    actual: number;
    compliance: number;         // 百分比
    breaches: number;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  complianceByTeam: Array<{
    teamId: string;
    teamName: string;
    overallCompliance: number;
    slaBreaches: number;
    criticalBreaches: number;
    trends: Array<{
      date: string;
      compliance: number;
    }>;
  }>;
  breachAnalysis: {
    totalBreaches: number;
    criticalBreaches: number;
    breachesByCategory: Record<string, number>;
    rootCauses: Array<{
      cause: string;
      frequency: number;
      impact: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
  correctiveActions: Array<{
    id: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignedTo: string;
    dueDate: string;
    status: 'open' | 'in_progress' | 'completed';
  }>;
  complianceTrends: Array<{
    date: string;
    compliance: number;
    breaches: number;
    target: number;
  }>;
}

/**
 * 🚨 異常檢測報告資料
 */
export interface AnomalyDetectionReportData {
  detectionSummary: {
    totalAnomalies: number;
    criticalAnomalies: number;
    resolvedAnomalies: number;
    falsePositives: number;
    detectionAccuracy: number;
  };
  anomaliesByCategory: Array<{
    category: 'performance' | 'security' | 'usage' | 'quality' | 'system';
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    avgImpact: number;
    trends: Array<{
      date: string;
      count: number;
    }>;
  }>;
  recentAnomalies: Array<{
    id: string;
    timestamp: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedSystems: string[];
    confidence: number;         // 信心度 0-1
    status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
    resolution: string;
  }>;
  predictiveInsights: {
    riskScore: number;          // 0-100
    probabilityOfIncident: number;
    timeToNextAnomaly: number;  // hours
    recommendedActions: string[];
  };
  anomalyPatterns: Array<{
    pattern: string;
    frequency: number;
    timeOfDay: number[];        // hours when most frequent
    dayOfWeek: number[];        // days when most frequent
    correlatedMetrics: string[];
  }>;
  systemHealthIndicators: {
    overallHealth: number;      // 0-100
    performanceScore: number;
    reliabilityScore: number;
    securityScore: number;
  };
}

/**
 * 📋 審計追蹤報告資料
 */
export interface AuditTrailReportData {
  auditSummary: {
    totalEvents: number;
    criticalEvents: number;
    securityEvents: number;
    complianceEvents: number;
    dataAccessEvents: number;
  };
  eventsByCategory: Record<string, {
    count: number;
    criticalCount: number;
    trends: Array<{
      date: string;
      count: number;
    }>;
  }>;
  userActivity: Array<{
    userId: string;
    username: string;
    role: string;
    totalActions: number;
    sensitiveActions: number;
    lastActivity: string;
    riskScore: number;
    suspiciousActivity: boolean;
    actions: Array<{
      action: string;
      timestamp: string;
      resource: string;
      result: 'success' | 'failure' | 'denied';
      ipAddress?: string;
    }>;
  }>;
  complianceChecks: Array<{
    checkType: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
    lastChecked: string;
    evidence: string[];
    remediation?: string;
  }>;
  securityIncidents: Array<{
    id: string;
    timestamp: string;
    type: 'unauthorized_access' | 'data_breach' | 'policy_violation' | 'suspicious_activity';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    involvedUsers: string[];
    affectedData: string[];
    status: 'open' | 'investigating' | 'resolved';
    timeline: Array<{
      timestamp: string;
      event: string;
      actor: string;
    }>;
  }>;
  dataAccess: {
    totalAccess: number;
    unauthorizedAttempts: number;
    sensitiveDataAccess: number;
    exportActivities: number;
    accessByRole: Record<string, number>;
    accessTrends: Array<{
      date: string;
      totalAccess: number;
      sensitiveAccess: number;
    }>;
  };
}

/**
 * ⚡ 資源利用率報告資料
 */
export interface ResourceUtilizationReportData {
  utilizationSummary: {
    overallUtilization: number; // 0-100
    peakUtilization: number;
    avgUtilization: number;
    utilizationTrend: 'increasing' | 'stable' | 'decreasing';
  };
  agentUtilization: Array<{
    agentId: string;
    agentName: string;
    teamId: string;
    totalHours: number;
    activeHours: number;
    utilizationRate: number;    // 0-100
    efficiency: number;         // conversations per hour
    idleTime: number;
    overloadIndicator: boolean;
    workloadBalance: 'underutilized' | 'optimal' | 'overloaded';
  }>;
  systemResources: {
    serverUtilization: {
      cpu: number;              // 0-100
      memory: number;           // 0-100
      disk: number;             // 0-100
      network: number;          // 0-100
    };
    databasePerformance: {
      connections: number;
      queryTime: number;        // avg milliseconds
      throughput: number;       // queries per second
      errors: number;
    };
    apiPerformance: {
      requestRate: number;      // requests per minute
      responseTime: number;     // avg milliseconds
      errorRate: number;        // percentage
      throughput: number;       // successful requests per minute
    };
  };
  capacityPlan: {
    currentCapacity: number;
    projectedNeed: number;      // next 3 months
    capacityGap: number;
    recommendations: Array<{
      type: 'scale_up' | 'scale_out' | 'optimize' | 'redistribute';
      description: string;
      priority: 'low' | 'medium' | 'high';
      estimatedCost: number;
      impact: string;
    }>;
  };
  utilizationTrends: Array<{
    date: string;
    agentUtilization: number;
    systemUtilization: number;
    conversationsHandled: number;
    responseTime: number;
  }>;
  bottleneckAnalysis: Array<{
    type: 'agent' | 'system' | 'process';
    location: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
    suggestedAction: string;
    estimatedImprovement: number;
  }>;
}

// === Phase 2: 商業智能增強報表資料介面 ===

/**
 * 📈 趨勢預測報告資料
 */
export interface TrendForecastReportData {
  forecastSummary: {
    forecastPeriod: number;     // 預測天數
    confidence: number;         // 信心度 0-100
    accuracy: number;           // 歷史準確度
    lastUpdate: string;
  };
  conversationTrends: {
    historical: Array<{
      date: string;
      actual: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    }>;
    predicted: Array<{
      date: string;
      predicted: number;
      confidenceLow: number;
      confidenceHigh: number;
      scenario: 'optimistic' | 'realistic' | 'pessimistic';
    }>;
  };
  demandForecast: {
    peakHours: Array<{
      hour: number;
      predictedVolume: number;
      requiredAgents: number;
    }>;
    seasonalPatterns: Array<{
      period: string;
      pattern: 'high' | 'normal' | 'low';
      multiplier: number;
    }>;
    specialEvents: Array<{
      date: string;
      event: string;
      expectedImpact: number;
      type: 'promotion' | 'holiday' | 'system_maintenance' | 'other';
    }>;
  };
  riskAssessment: {
    overloadRisk: number;       // 0-100
    understaffingRisk: number;
    systemCapacityRisk: number;
    mitigationSuggestions: Array<{
      risk: string;
      suggestion: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
  modelPerformance: {
    mape: number;               // Mean Absolute Percentage Error
    rmse: number;               // Root Mean Square Error
    lastTraining: string;
    dataQuality: number;        // 0-100
  };
}

/**
 * 💡 客戶洞察報告資料
 */
export interface CustomerInsightsReportData {
  customerSegmentation: {
    totalCustomers: number;
    segments: Array<{
      segment: 'vip' | 'loyal' | 'new' | 'at_risk' | 'inactive';
      count: number;
      percentage: number;
      characteristics: string[];
      averageValue: number;
      retentionRate: number;
    }>;
  };
  behaviorAnalysis: {
    preferredChannels: Record<string, {
      usage: number;
      satisfaction: number;
      conversionRate: number;
    }>;
    contactPatterns: {
      peakHours: number[];
      commonTopics: Array<{
        topic: string;
        frequency: number;
        avgResolutionTime: number;
      }>;
      seasonality: Array<{
        month: string;
        activity: number;
        issues: string[];
      }>;
    };
    journeyMapping: Array<{
      stage: 'awareness' | 'consideration' | 'purchase' | 'support' | 'advocacy';
      touchpoints: string[];
      duration: number;         // days
      conversionRate: number;
      dropoffRate: number;
    }>;
  };
  satisfactionInsights: {
    overallSatisfaction: number;
    satisfactionDrivers: Array<{
      factor: string;
      impact: number;           // correlation coefficient
      improvement: number;      // potential improvement
    }>;
    npsAnalysis: {
      score: number;
      promoters: number;
      passives: number;
      detractors: number;
      trends: Array<{
        date: string;
        score: number;
      }>;
    };
  };
  churnPrediction: {
    churnRate: number;
    riskSegments: Array<{
      segment: string;
      riskScore: number;
      churnProbability: number;
      retentionActions: string[];
    }>;
    earlyWarningIndicators: Array<{
      indicator: string;
      threshold: number;
      currentValue: number;
      trend: 'improving' | 'stable' | 'worsening';
    }>;
  };
  revenueImpact: {
    customerLifetimeValue: number;
    revenueBySegment: Record<string, number>;
    retentionImpact: {
      currentRevenue: number;
      potentialLoss: number;
      retentionOpportunity: number;
    };
  };
}

/**
 * 🌐 多通道整合報告資料
 */
export interface ChannelIntegrationReportData {
  channelOverview: {
    activeChannels: Array<{
      channel: 'line' | 'facebook' | 'webchat' | 'email' | 'phone' | 'whatsapp';
      status: 'active' | 'inactive' | 'maintenance';
      uptime: number;           // percentage
      totalConversations: number;
      avgResponseTime: number;
      satisfaction: number;
    }>;
    integrationHealth: number;  // 0-100
  };
  crossChannelAnalysis: {
    channelMigration: Array<{
      fromChannel: string;
      toChannel: string;
      count: number;
      reason: 'escalation' | 'preference' | 'availability' | 'complexity';
    }>;
    omnichanelJourneys: Array<{
      customer: string;
      touchpoints: Array<{
        channel: string;
        timestamp: string;
        interaction: string;
      }>;
      totalDuration: number;
      resolution: 'resolved' | 'ongoing' | 'escalated';
    }>;
  };
  integrationMetrics: {
    dataConsistency: number;    // 0-100
    responseTimeVariance: number;
    qualityConsistency: number;
    contextPreservation: number; // how well context is maintained across channels
  };
  channelEffectiveness: {
    conversionRates: Record<string, number>;
    costPerChannel: Record<string, number>;
    customerPreferences: Record<string, {
      usage: number;
      satisfaction: number;
      efficiency: number;
    }>;
    performanceComparison: Array<{
      metric: string;
      channels: Record<string, number>;
      benchmark: number;
    }>;
  };
  unificationOpportunities: Array<{
    opportunity: string;
    description: string;
    estimatedImpact: number;
    implementationEffort: 'low' | 'medium' | 'high';
    priority: 'low' | 'medium' | 'high';
  }>;
}

/**
 * 🎯 目標達成報告資料
 */
export interface GoalAchievementReportData {
  goalSummary: {
    totalGoals: number;
    achievedGoals: number;
    onTrackGoals: number;
    atRiskGoals: number;
    overallProgress: number;    // 0-100
  };
  departmentGoals: Array<{
    department: string;
    goals: Array<{
      id: string;
      title: string;
      target: number;
      current: number;
      progress: number;         // 0-100
      status: 'achieved' | 'on_track' | 'at_risk' | 'behind';
      deadline: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      assignee: string;
    }>;
    departmentProgress: number;
  }>;
  kpiTracking: {
    responseTimeGoal: {
      target: number;           // seconds
      current: number;
      improvement: number;      // percentage
      trend: 'improving' | 'stable' | 'declining';
    };
    satisfactionGoal: {
      target: number;           // 1-5 scale
      current: number;
      improvement: number;
      trend: 'improving' | 'stable' | 'declining';
    };
    resolutionRateGoal: {
      target: number;           // percentage
      current: number;
      improvement: number;
      trend: 'improving' | 'stable' | 'declining';
    };
    customKPIs: Array<{
      name: string;
      target: number;
      current: number;
      unit: string;
      progress: number;
    }>;
  };
  milestones: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: 'completed' | 'in_progress' | 'planned' | 'overdue';
    progress: number;
    dependencies: string[];
    blockers: string[];
  }>;
  performanceTrends: Array<{
    date: string;
    overallProgress: number;
    goalsAchieved: number;
    newGoalsAdded: number;
  }>;
  recommendations: Array<{
    type: 'acceleration' | 'resource_reallocation' | 'goal_adjustment' | 'process_improvement';
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
  }>;
}

/**
 * 🤖 自動化成效報告資料
 */
export interface AutomationEffectivenessReportData {
  automationOverview: {
    totalAutomations: number;
    activeAutomations: number;
    automationCoverage: number; // percentage of processes automated
    overallEffectiveness: number; // 0-100
  };
  automationTypes: Array<{
    type: 'chatbot' | 'workflow' | 'routing' | 'escalation' | 'notification';
    count: number;
    successRate: number;
    avgProcessingTime: number;
    costSavings: number;
    humanHandoffRate: number;
  }>;
  performanceMetrics: {
    automatedVsManual: {
      totalInteractions: number;
      automatedHandled: number;
      manualHandled: number;
      automationRate: number;
    };
    qualityMetrics: {
      automatedSatisfaction: number;
      manualSatisfaction: number;
      automatedAccuracy: number;
      falsePositiveRate: number;
      falseNegativeRate: number;
    };
    efficiencyGains: {
      timeReduction: number;     // percentage
      costReduction: number;     // percentage
      volumeIncrease: number;    // percentage increase in handled volume
      agentProductivityGain: number;
    };
  };
  automationROI: {
    totalInvestment: number;
    monthlySavings: number;
    paybackPeriod: number;      // months
    roi: number;                // percentage
    npv: number;                // net present value
  };
  failureAnalysis: {
    commonFailures: Array<{
      automation: string;
      failure: string;
      frequency: number;
      impact: 'low' | 'medium' | 'high';
      resolution: string;
    }>;
    errorPatterns: Array<{
      pattern: string;
      frequency: number;
      suggestedFix: string;
    }>;
  };
  optimizationOpportunities: Array<{
    automation: string;
    opportunity: string;
    estimatedImprovement: number;
    implementationEffort: 'low' | 'medium' | 'high';
    priority: 'low' | 'medium' | 'high';
  }>;
}

// === Phase 3: 高級分析功能報表資料介面 ===

/**
 * 🔒 資安風險報告資料
 */
export interface SecurityRiskReportData {
  riskOverview: {
    overallRiskScore: number;   // 0-100
    riskTrend: 'improving' | 'stable' | 'deteriorating';
    highRiskCount: number;
    criticalVulnerabilities: number;
    lastAssessment: string;
  };
  threatLandscape: {
    identifiedThreats: Array<{
      threat: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      likelihood: number;       // 0-100
      impact: number;          // 0-100
      riskScore: number;       // likelihood * impact
      mitigation: string;
      status: 'open' | 'mitigating' | 'closed';
    }>;
    attackVectors: Array<{
      vector: 'phishing' | 'malware' | 'social_engineering' | 'brute_force' | 'sql_injection' | 'other';
      attempts: number;
      success: number;
      preventionRate: number;
    }>;
  };
  vulnerabilityAssessment: {
    systemVulnerabilities: Array<{
      system: string;
      vulnerabilities: Array<{
        cve: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        cvssScore: number;
        description: string;
        patch: string;
        patchDate?: string;
      }>;
    }>;
    dataExposureRisks: Array<{
      dataType: 'pii' | 'financial' | 'health' | 'credentials' | 'business';
      exposureLevel: 'low' | 'medium' | 'high' | 'critical';
      affectedRecords: number;
      protection: string;
    }>;
  };
  securityIncidents: {
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    avgResolutionTime: number;
    recentIncidents: Array<{
      id: string;
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      status: 'open' | 'investigating' | 'resolved';
      impact: string;
      timeline: Array<{
        timestamp: string;
        action: string;
      }>;
    }>;
  };
  complianceStatus: {
    regulations: Array<{
      regulation: 'GDPR' | 'CCPA' | 'HIPAA' | 'PCI_DSS' | 'ISO_27001';
      compliance: number;       // 0-100
      gaps: string[];
      nextAudit: string;
    }>;
    policyAdherence: {
      passwordPolicy: number;
      accessControl: number;
      dataHandling: number;
      incidentResponse: number;
    };
  };
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'preventive' | 'detective' | 'corrective' | 'compensating';
    recommendation: string;
    estimatedCost: number;
    estimatedEffort: number;   // person-days
    expectedRiskReduction: number;
  }>;
}

/**
 * 📚 知識庫效能報告資料
 */
export interface KnowledgeBaseReportData {
  knowledgeOverview: {
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    archivedArticles: number;
    totalViews: number;
    avgRating: number;
  };
  contentPerformance: {
    topPerformingArticles: Array<{
      id: string;
      title: string;
      views: number;
      rating: number;
      helpfulness: number;     // percentage
      lastUpdated: string;
    }>;
    underperformingArticles: Array<{
      id: string;
      title: string;
      views: number;
      rating: number;
      issues: string[];
      recommendedActions: string[];
    }>;
    contentGaps: Array<{
      topic: string;
      searchFrequency: number;
      availableArticles: number;
      gapScore: number;        // search frequency / available articles
    }>;
  };
  usageAnalytics: {
    searchPatterns: Array<{
      query: string;
      frequency: number;
      successRate: number;     // found relevant results
      avgTimeToResult: number; // seconds
    }>;
    userBehavior: {
      avgSessionDuration: number;
      bounceRate: number;
      pagesPerSession: number;
      returnVisitorRate: number;
    };
    channelUsage: Record<string, {
      views: number;
      searches: number;
      ratings: number;
    }>;
  };
  contentMaintenance: {
    outdatedContent: Array<{
      id: string;
      title: string;
      lastUpdated: string;
      staleness: number;       // days since last update
      priority: 'low' | 'medium' | 'high';
    }>;
    maintenanceBacklog: {
      reviewPending: number;
      updateRequired: number;
      accuracyCheck: number;
      brokenLinks: number;
    };
    contentLifecycle: {
      creationRate: number;    // articles per month
      updateRate: number;      // updates per month
      retirementRate: number;  // archived per month
    };
  };
  agentProductivity: {
    knowledgeUsageByAgents: Array<{
      agentId: string;
      agentName: string;
      articlesViewed: number;
      timeSpent: number;       // minutes
      resolutionImprovement: number; // percentage
    }>;
    resolutionEfficiency: {
      withKnowledge: {
        avgResolutionTime: number;
        firstCallResolution: number;
        customerSatisfaction: number;
      };
      withoutKnowledge: {
        avgResolutionTime: number;
        firstCallResolution: number;
        customerSatisfaction: number;
      };
    };
  };
  aiIntegration: {
    chatbotUsage: {
      articlesReferenced: number;
      accurateResponses: number;
      fallbackToHuman: number;
    };
    smartSuggestions: {
      suggestionsProvided: number;
      accepted: number;
      accuracy: number;
    };
  };
}

/**
 * 📞 通話品質分析報告資料
 */
export interface CallQualityReportData {
  qualityOverview: {
    totalCalls: number;
    avgQualityScore: number;  // 0-100
    qualityTrend: 'improving' | 'stable' | 'declining';
    monitoredCalls: number;
    qualityAssessments: number;
  };
  audioQuality: {
    overallAudioScore: number; // 0-100
    commonIssues: Array<{
      issue: 'background_noise' | 'echo' | 'low_volume' | 'distortion' | 'dropouts';
      frequency: number;
      impact: 'low' | 'medium' | 'high';
      solutions: string[];
    }>;
    networkPerformance: {
      avgLatency: number;       // milliseconds
      packetLoss: number;       // percentage
      jitter: number;           // milliseconds
      connectionQuality: number; // 0-100
    };
  };
  conversationQuality: {
    agentPerformance: Array<{
      agentId: string;
      agentName: string;
      avgScore: number;
      callsMonitored: number;
      strengths: string[];
      improvementAreas: string[];
      trainingRecommended: string[];
    }>;
    qualityMetrics: {
      professionalism: number;
      productKnowledge: number;
      problemSolving: number;
      communication: number;
      empathy: number;
    };
    compliance: {
      scriptAdherence: number;  // percentage
      regulatoryCompliance: number;
      dataPrivacyCompliance: number;
      complianceViolations: Array<{
        type: string;
        frequency: number;
        severity: 'minor' | 'major' | 'critical';
      }>;
    };
  };
  customerExperience: {
    satisfactionCorrelation: {
      qualityScore: number;
      satisfaction: number;
      correlation: number;      // -1 to 1
    };
    callOutcomes: {
      resolved: number;
      escalated: number;
      callback: number;
      abandoned: number;
    };
    emotionAnalysis: {
      positiveEmotions: number;
      neutralEmotions: number;
      negativeEmotions: number;
      emotionTrends: Array<{
        timeSegment: string;
        emotion: 'positive' | 'neutral' | 'negative';
        intensity: number;
      }>;
    };
  };
  technicalMetrics: {
    callStability: {
      completionRate: number;   // percentage
      dropCallRate: number;     // percentage
      reconnectionRate: number;
    };
    systemPerformance: {
      cpuUsage: number;
      memoryUsage: number;
      bandwidthUsage: number;
      serverResponse: number;
    };
  };
  improvementPlan: Array<{
    area: 'audio' | 'conversation' | 'technical' | 'process';
    issue: string;
    recommendation: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedImpact: number;
    implementationTime: number; // days
  }>;
}

/**
 * 💼 高管摘要報告資料
 */
export interface ExecutiveSummaryReportData {
  executiveOverview: {
    reportPeriod: string;
    generatedAt: string;
    keyHighlights: string[];
    overallPerformance: 'excellent' | 'good' | 'average' | 'needs_improvement';
    performanceScore: number; // 0-100
  };
  businessMetrics: {
    customerSatisfaction: {
      current: number;
      target: number;
      trend: 'up' | 'stable' | 'down';
      comparison: 'above' | 'meeting' | 'below';
    };
    operationalEfficiency: {
      current: number;
      target: number;
      trend: 'up' | 'stable' | 'down';
      comparison: 'above' | 'meeting' | 'below';
    };
    costEffectiveness: {
      current: number;
      target: number;
      trend: 'up' | 'stable' | 'down';
      comparison: 'above' | 'meeting' | 'below';
    };
    revenueImpact: {
      directRevenue: number;
      costSavings: number;
      customerRetention: number;
      revenueAtRisk: number;
    };
  };
  strategicInsights: {
    marketPosition: {
      competitiveRanking: number; // 1-10
      marketShare: number;        // percentage
      brandPerception: 'positive' | 'neutral' | 'negative';
      differentiators: string[];
    };
    customerInsights: {
      loyaltyIndex: number;       // 0-100
      churnRisk: 'low' | 'medium' | 'high';
      growthOpportunities: string[];
      segmentPerformance: Record<string, {
        revenue: number;
        growth: number;
        satisfaction: number;
      }>;
    };
  };
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: Array<{
      risk: string;
      probability: number;      // 0-100
      impact: number;           // 0-100
      mitigation: string;
    }>;
    complianceStatus: 'compliant' | 'minor_issues' | 'major_concerns';
  };
  financialSummary: {
    currentPeriod: {
      revenue: number;
      costs: number;
      profit: number;
      margin: number;
    };
    yearOverYear: {
      revenueGrowth: number;
      costChange: number;
      profitGrowth: number;
      marginChange: number;
    };
    projections: {
      nextQuarter: {
        revenue: number;
        costs: number;
        profit: number;
      };
      yearEnd: {
        revenue: number;
        costs: number;
        profit: number;
      };
    };
  };
  actionItems: {
    immediate: Array<{
      priority: 'critical' | 'high';
      action: string;
      owner: string;
      deadline: string;
      impact: string;
    }>;
    strategic: Array<{
      priority: 'high' | 'medium';
      initiative: string;
      timeline: string;
      investment: number;
      expectedROI: number;
    }>;
  };
  recommendations: Array<{
    category: 'growth' | 'efficiency' | 'quality' | 'cost' | 'risk';
    recommendation: string;
    rationale: string;
    expectedBenefit: string;
    investmentRequired: number;
    timeframe: string;
  }>;
}

// ======================== 報告查詢和管理 ========================

/**
 * 報告列表查詢參數
 */
export interface ReportListQuery {
  type?: ReportType;
  status?: ReportStatus;
  format?: ReportFormat;
  createdBy?: string;
  teamId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 報告列表回應
 */
export interface ReportListResponse {
  reports: ReportBase[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalReports: number;
    pendingReports: number;
    completedReports: number;
    failedReports: number;
  };
}

/**
 * 報告詳細資訊
 */
export interface ReportDetails extends ReportBase {
  generationLog?: string[];
  errorMessage?: string;
  executionTime?: number; // seconds
  dataSource?: {
    tables: string[];
    filters: ReportFilters;
    recordCount: number;
  };
  downloadHistory?: Array<{
    downloadedAt: string;
    downloadedBy: string;
    ipAddress?: string;
  }>;
}

// ======================== 報告統計 ========================

/**
 * 報告統計資料
 */
export interface ReportStatistics {
  totalReports: number;
  reportsByType: Record<ReportType, number>;
  reportsByFormat: Record<ReportFormat, number>;
  reportsByStatus: Record<ReportStatus, number>;
  averageGenerationTime: number; // seconds
  popularReports: Array<{
    type: ReportType;
    count: number;
    averageSize: number; // bytes
  }>;
  usageByUser: Array<{
    userId: string;
    username: string;
    reportCount: number;
    lastGenerated: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    reportsGenerated: number;
    totalSize: number; // bytes
  }>;
}

// ======================== 批量操作 ========================

/**
 * 批量報告操作
 */
export interface BatchReportOperation {
  reportIds: string[];
  action: 'delete' | 'regenerate' | 'download' | 'export';
  options?: {
    format?: ReportFormat;
    mergeReports?: boolean;
  };
}

/**
 * 批量操作結果
 */
export interface BatchOperationResult {
  success: boolean;
  totalRequested: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    reportId: string;
    success: boolean;
    error?: string;
    downloadUrl?: string;
  }>;
}

// ======================== 排程報告 ========================

/**
 * 排程報告配置
 */
export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  format: ReportFormat;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:mm format
    dayOfWeek?: number; // 0-6, Sunday=0
    dayOfMonth?: number; // 1-31
  };
  filters: ReportFilters;
  options: ReportOptions;
  recipients: Array<{
    email: string;
    name: string;
    role: string;
  }>;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  lastRun?: string;
  nextRun: string;
}

/**
 * 排程報告執行記錄
 */
export interface ScheduledReportExecution {
  id: string;
  scheduledReportId: string;
  executedAt: string;
  status: ReportStatus;
  reportId?: string;
  errorMessage?: string;
  executionTime?: number; // seconds
  recipients: string[];
  deliveryStatus: Record<string, 'sent' | 'failed'>;
}

// ======================== 服務介面 ========================

/**
 * Reports Service 介面
 */
export interface ReportsServiceInterface {
  // 報告生成
  generateReport(params: ReportGenerationParams, userId: string): Promise<ReportBase>;
  getReportStatus(reportId: string): Promise<ReportBase | null>;
  downloadReport(reportId: string, userId: string): Promise<{ url: string; filename: string } | null>;

  // 報告管理
  listReports(query: ReportListQuery): Promise<ReportListResponse>;
  getReportDetails(reportId: string): Promise<ReportDetails | null>;
  deleteReport(reportId: string, userId: string): Promise<boolean>;

  // 統計分析
  getReportStatistics(timeRange?: ReportTimeRange): Promise<ReportStatistics>;

  // 批量操作
  batchOperation(operation: BatchReportOperation, userId: string): Promise<BatchOperationResult>;

  // 排程報告
  createScheduledReport(config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>, userId: string): Promise<ScheduledReport>;
  updateScheduledReport(id: string, updates: Partial<ScheduledReport>, userId: string): Promise<ScheduledReport>;
  deleteScheduledReport(id: string, userId: string): Promise<boolean>;
  listScheduledReports(userId?: string): Promise<ScheduledReport[]>;

  // 工具方法
  validateReportParams(params: ReportGenerationParams): Promise<{ valid: boolean; errors: string[] }>;
  getAvailableTemplates(type: ReportType): Promise<Array<{ name: string; description: string; options: ReportOptions }>>;
  previewReport(params: ReportGenerationParams): Promise<any>; // Sample data for preview
}

// ======================== 中間件類型 ========================

/**
 * Reports Context 擴展
 */
export interface ReportsContext extends Context<{ Bindings: Bindings }> {
  get: {
    reportId?: string;
    reportQuery?: ReportListQuery;
    reportParams?: ReportGenerationParams;
    scheduledReportId?: string;
    batchOperation?: BatchReportOperation;
  } & Context<{ Bindings: Bindings }>['get'];
  set: Context<{ Bindings: Bindings }>['set'] & {
    (key: 'reportId', value: string): void;
    (key: 'reportQuery', value: ReportListQuery): void;
    (key: 'reportParams', value: ReportGenerationParams): void;
    (key: 'scheduledReportId', value: string): void;
    (key: 'batchOperation', value: BatchReportOperation): void;
  };
}

// ======================== 錯誤類型 ========================

export class ReportNotFoundError extends Error {
  constructor(reportId: string) {
    super(`Report not found: ${reportId}`);
    this.name = 'ReportNotFoundError';
  }
}

export class ReportGenerationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ReportGenerationError';
  }
}

export class InvalidReportParamsError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'InvalidReportParamsError';
  }
}

export class ReportAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportAccessDeniedError';
  }
}

// ======================== 常數和配置 ========================

/**
 * 預設報告配置
 */
export const DEFAULT_REPORT_CONFIG = {
  maxReportSize: 50 * 1024 * 1024, // 50MB
  reportExpiryDays: 30,
  maxConcurrentGenerations: 5,
  defaultPageSize: 20,
  maxPageSize: 100,
  supportedTimezones: [
    'Asia/Taipei',
    'UTC',
    'America/New_York',
    'Europe/London'
  ]
} as const;

/**
 * 報告類型配置
 */
export const REPORT_TYPE_CONFIG: Record<ReportType, {
  name: string;
  description: string;
  supportedFormats: ReportFormat[];
  estimatedGenerationTime: number; // seconds
  requiredPermissions: string[];
}> = {
  conversation_summary: {
    name: '對話摘要報告',
    description: '提供對話活動的綜合分析，包括對話數量、回應時間和平台分布',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 30,
    requiredPermissions: ['reports.conversation.view']
  },
  agent_performance: {
    name: '客服績效報告',
    description: '分析客服代理的工作表現，包括處理數量、回應時間和客戶滿意度',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 45,
    requiredPermissions: ['reports.agent.view']
  },
  team_analytics: {
    name: '團隊分析報告',
    description: '提供團隊層級的績效分析和比較',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 60,
    requiredPermissions: ['reports.team.view']
  },
  customer_satisfaction: {
    name: '客戶滿意度報告',
    description: '分析客戶滿意度評分和反饋趨勢',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 40,
    requiredPermissions: ['reports.satisfaction.view']
  },
  platform_usage: {
    name: '平台使用報告',
    description: '分析各個通訊平台的使用情況和趨勢',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 25,
    requiredPermissions: ['reports.platform.view']
  },
  message_statistics: {
    name: '訊息統計報告',
    description: '詳細的訊息發送和接收統計分析',
    supportedFormats: ['json', 'csv', 'excel', 'pdf'],
    estimatedGenerationTime: 35,
    requiredPermissions: ['reports.message.view']
  },
  response_time_analysis: {
    name: '回應時間分析',
    description: '深入分析回應時間模式和瓶頸',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 50,
    requiredPermissions: ['reports.performance.view']
  },
  workload_distribution: {
    name: '工作量分配報告',
    description: '分析工作量在團隊和個人間的分配情況',
    supportedFormats: ['json', 'csv', 'excel', 'pdf'],
    estimatedGenerationTime: 40,
    requiredPermissions: ['reports.workload.view']
  },
  system_health: {
    name: '系統健康報告',
    description: '系統運行狀況和效能指標分析',
    supportedFormats: ['json', 'html', 'pdf'],
    estimatedGenerationTime: 20,
    requiredPermissions: ['reports.system.view']
  },
  custom: {
    name: '自定義報告',
    description: '根據特定需求客製化的報告',
    supportedFormats: ['json', 'csv', 'excel'],
    estimatedGenerationTime: 120,
    requiredPermissions: ['reports.custom.create']
  },

  // === Phase 1: 企業級高優先級報表配置 ===
  cost_analysis: {
    name: '💰 成本分析報告',
    description: '提供完整的成本結構分析，包括人力、技術和營運成本，以及成本效益評估',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 90,
    requiredPermissions: ['reports.finance.view', 'reports.cost.analysis']
  },
  sla_compliance: {
    name: '⚖️ SLA合規報告',
    description: '監控服務等級協議遵循情況，識別違規事件並提供改善建議',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 75,
    requiredPermissions: ['reports.compliance.view', 'reports.sla.monitor']
  },
  anomaly_detection: {
    name: '🚨 異常檢測報告',
    description: '使用機器學習算法檢測系統異常，提供預警和預測性分析',
    supportedFormats: ['json', 'html', 'pdf'],
    estimatedGenerationTime: 120,
    requiredPermissions: ['reports.security.view', 'reports.anomaly.detect']
  },
  audit_trail: {
    name: '📋 審計追蹤報告',
    description: '完整的審計日誌追蹤，包括用戶行為、安全事件和合規檢查',
    supportedFormats: ['json', 'csv', 'excel', 'pdf'],
    estimatedGenerationTime: 100,
    requiredPermissions: ['reports.audit.view', 'reports.security.admin']
  },
  resource_utilization: {
    name: '⚡ 資源利用率報告',
    description: '分析人力和系統資源的使用效率，提供容量規劃建議',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 80,
    requiredPermissions: ['reports.resources.view', 'reports.capacity.plan']
  },

  // === Phase 2: 商業智能增強報表配置 ===
  trend_forecast: {
    name: '📈 趨勢預測報告',
    description: '使用機器學習算法預測業務趨勢，提供需求預測和風險評估',
    supportedFormats: ['json', 'html', 'pdf', 'excel'],
    estimatedGenerationTime: 150,
    requiredPermissions: ['reports.forecast.view', 'reports.analytics.advanced']
  },
  customer_insights: {
    name: '💡 客戶洞察報告',
    description: '深度分析客戶行為模式，提供客戶分群和流失預測',
    supportedFormats: ['json', 'html', 'pdf', 'excel'],
    estimatedGenerationTime: 135,
    requiredPermissions: ['reports.customer.analytics', 'reports.insights.view']
  },
  channel_integration: {
    name: '🌐 多通道整合報告',
    description: '分析多通道客服整合效果，評估全通路客戶體驗',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 110,
    requiredPermissions: ['reports.channel.view', 'reports.integration.analysis']
  },
  goal_achievement: {
    name: '🎯 目標達成報告',
    description: '追蹤和分析各部門目標達成情況，提供績效改善建議',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 95,
    requiredPermissions: ['reports.goals.view', 'reports.performance.track']
  },
  automation_effectiveness: {
    name: '🤖 自動化成效報告',
    description: '評估自動化系統效果和ROI，識別優化機會',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 125,
    requiredPermissions: ['reports.automation.view', 'reports.roi.analysis']
  },

  // === Phase 3: 高級分析功能報表配置 ===
  security_risk: {
    name: '🔒 資安風險報告',
    description: '綜合資安風險評估，包括威脅分析、漏洞評估和合規檢查',
    supportedFormats: ['json', 'pdf', 'html'],
    estimatedGenerationTime: 180,
    requiredPermissions: ['reports.security.view', 'reports.risk.analysis', 'security.admin']
  },
  knowledge_base: {
    name: '📚 知識庫效能報告',
    description: '分析知識庫使用效果和內容品質，提供內容優化建議',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 105,
    requiredPermissions: ['reports.knowledge.view', 'reports.content.analysis']
  },
  call_quality: {
    name: '📞 通話品質分析報告',
    description: '深度分析通話品質和客服表現，提供訓練改善建議',
    supportedFormats: ['json', 'csv', 'excel', 'pdf', 'html'],
    estimatedGenerationTime: 140,
    requiredPermissions: ['reports.call.quality', 'reports.agent.performance']
  },
  executive_summary: {
    name: '💼 高管摘要報告',
    description: '為高階管理層量身定製的綜合業務洞察和戰略建議報告',
    supportedFormats: ['pdf', 'html', 'excel'],
    estimatedGenerationTime: 200,
    requiredPermissions: ['reports.executive.view', 'reports.strategic.analysis', 'management.access']
  }
} as const;