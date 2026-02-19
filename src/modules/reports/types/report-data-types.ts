// Reports 模組 - 具體報告類型資料介面
// All 18 report-specific data interfaces

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
