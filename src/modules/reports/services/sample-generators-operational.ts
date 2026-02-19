// Sample Data Generators - Operational Reports
// conversation_summary, agent_performance, audit_trail, cost_analysis, sla_compliance

import type {
  ConversationSummaryReportData,
  AgentPerformanceReportData,
  AuditTrailReportData,
  CostAnalysisReportData,
  SLAComplianceReportData
} from '../types/report-types';

/**
 * Generate sample conversation summary data
 */
export function generateConversationData(): ConversationSummaryReportData {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    period: {
      startDate: thirtyDaysAgo.toISOString(),
      endDate: now.toISOString()
    },
    totalConversations: 1250,
    activeConversations: 45,
    completedConversations: 1205,
    averageResponseTime: 8.5,
    averageResolutionTime: 35.2,
    conversationsByPlatform: {
      line: 650,
      facebook: 400,
      webchat: 200
    },
    conversationsByPriority: {
      low: 500,
      medium: 450,
      high: 250,
      urgent: 50
    },
    conversationsByTeam: {
      'team-1': 625,
      'team-2': 425,
      'team-3': 200
    },
    hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: Math.floor(Math.random() * 100)
    })),
    dailyTrends: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      conversations: Math.floor(Math.random() * 50) + 20,
      messages: Math.floor(Math.random() * 500) + 100,
      avgResponseTime: Math.random() * 10 + 5
    })),
    topTags: [
      { tag: 'billing', count: 150 },
      { tag: 'support', count: 120 },
      { tag: 'complaint', count: 80 }
    ]
  };
}

/**
 * Generate sample agent performance data
 */
export function generateAgentData(): AgentPerformanceReportData {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    period: {
      startDate: thirtyDaysAgo.toISOString(),
      endDate: now.toISOString()
    },
    totalAgents: 25,
    activeAgents: 22,
    agentMetrics: [
      {
        agentId: 'agent-1',
        agentName: 'John Doe',
        teamId: 'team-1',
        teamName: 'Support Team A',
        conversationsHandled: 85,
        messagesHandled: 420,
        averageResponseTime: 6.5,
        customerSatisfactionScore: 4.2,
        resolutionRate: 0.92,
        activeHours: 160,
        efficiency: 0.53
      }
    ],
    teamComparisons: [
      {
        teamId: 'team-1',
        teamName: 'Support Team A',
        agentCount: 8,
        totalConversations: 650,
        averageResponseTime: 7.2,
        satisfactionScore: 4.1
      }
    ],
    performanceTrends: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      responseTime: Math.random() * 5 + 5,
      satisfaction: Math.random() * 1 + 3.5,
      throughput: Math.random() * 20 + 30
    }))
  };
}

/**
 * Generate sample audit trail data
 */
export function generateAuditTrailData(): AuditTrailReportData {
  return {
    auditSummary: {
      totalEvents: 15420,
      criticalEvents: 23,
      securityEvents: 156,
      complianceEvents: 89,
      dataAccessEvents: 3420
    },
    eventsByCategory: {
      'user_login': {
        count: 4520,
        criticalCount: 12,
        trends: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
          count: Math.floor(Math.random() * 100) + 600
        }))
      },
      'data_access': {
        count: 3420,
        criticalCount: 8,
        trends: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
          count: Math.floor(Math.random() * 80) + 400
        }))
      }
    },
    userActivity: [
      {
        userId: 'admin-001',
        username: 'admin',
        role: 'admin',
        totalActions: 245,
        sensitiveActions: 23,
        lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        riskScore: 15,
        suspiciousActivity: false,
        actions: [
          {
            action: 'user_created',
            timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            resource: 'users/new_agent_001',
            result: 'success',
            ipAddress: '192.168.1.100'
          }
        ]
      }
    ],
    complianceChecks: [
      {
        checkType: 'GDPR Data Retention',
        status: 'pass',
        details: '所有個人資料符合保留期限規定',
        lastChecked: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        evidence: ['retention_policy_check.log', 'data_cleanup_report.pdf']
      },
      {
        checkType: 'Access Control Review',
        status: 'warning',
        details: '發現3個帳戶超過90天未使用',
        lastChecked: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        evidence: ['access_review_Q3_2024.xlsx'],
        remediation: '停用閒置帳戶或要求重新驗證'
      }
    ],
    securityIncidents: [
      {
        id: 'inc-001',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        type: 'unauthorized_access',
        severity: 'medium',
        description: '嘗試從未知IP位址存取管理介面',
        involvedUsers: ['unknown'],
        affectedData: ['admin_panel'],
        status: 'investigating',
        timeline: [
          {
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            event: '偵測到未授權存取嘗試',
            actor: 'security_system'
          },
          {
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            event: '封鎖可疑IP位址',
            actor: 'security_admin'
          }
        ]
      }
    ],
    dataAccess: {
      totalAccess: 3420,
      unauthorizedAttempts: 12,
      sensitiveDataAccess: 156,
      exportActivities: 23,
      accessByRole: {
        'admin': 450,
        'team': 1200,
        'agent': 1770
      },
      accessTrends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
        totalAccess: Math.floor(Math.random() * 50) + 100,
        sensitiveAccess: Math.floor(Math.random() * 10) + 5
      }))
    }
  };
}

/**
 * Generate sample cost analysis data
 */
export function generateCostAnalysisData(): CostAnalysisReportData {
  return {
    totalCosts: {
      operational: 450000,
      personnel: 2800000,
      technology: 180000,
      overhead: 120000
    },
    costByTeam: [
      {
        teamId: 'team-1',
        teamName: '前台客服團隊',
        totalCost: 1200000,
        avgCostPerAgent: 150000,
        avgCostPerConversation: 45.5,
        costBreakdown: {
          salary: 960000,
          training: 60000,
          tools: 120000,
          overhead: 60000
        }
      },
      {
        teamId: 'team-2',
        teamName: '技術支援團隊',
        totalCost: 1500000,
        avgCostPerAgent: 187500,
        avgCostPerConversation: 78.2,
        costBreakdown: {
          salary: 1200000,
          training: 90000,
          tools: 150000,
          overhead: 60000
        }
      }
    ],
    costEfficiency: {
      costPerConversation: 52.3,
      costPerResolution: 68.7,
      costPerCustomer: 125.4,
      rOI: 2.4
    },
    monthlyTrends: Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i, 1).toISOString().slice(0, 7),
      totalCost: 350000 + Math.random() * 100000,
      conversations: Math.floor(Math.random() * 1000) + 5000,
      costPerConversation: 45 + Math.random() * 20,
      budgetVariance: (Math.random() - 0.5) * 20
    })),
    budgetComparison: {
      allocated: 4000000,
      actual: 3550000,
      variance: -450000,
      utilizationRate: 88.75
    },
    costSavingOpportunities: [
      {
        category: '自動化處理',
        description: '實施智能客服機器人處理常見問題',
        estimatedSaving: 480000,
        effort: 'medium'
      },
      {
        category: '流程優化',
        description: '優化客服工作流程減少處理時間',
        estimatedSaving: 240000,
        effort: 'low'
      }
    ]
  };
}

/**
 * Generate sample SLA compliance data
 */
export function generateSLAComplianceData(): SLAComplianceReportData {
  return {
    overallCompliance: {
      percentage: 87.5,
      target: 95.0,
      variance: -7.5,
      status: 'at_risk'
    },
    slaMetrics: [
      {
        slaType: 'response_time',
        metric: '首次回應時間',
        target: 300,
        actual: 378,
        compliance: 82.4,
        breaches: 156,
        trend: 'declining'
      },
      {
        slaType: 'resolution_time',
        metric: '問題解決時間',
        target: 1440,
        actual: 1680,
        compliance: 76.8,
        breaches: 89,
        trend: 'stable'
      },
      {
        slaType: 'availability',
        metric: '系統可用性',
        target: 99.9,
        actual: 99.6,
        compliance: 99.7,
        breaches: 3,
        trend: 'improving'
      }
    ],
    complianceByTeam: [
      {
        teamId: 'team-1',
        teamName: '前台客服團隊',
        overallCompliance: 85.2,
        slaBreaches: 45,
        criticalBreaches: 8,
        trends: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          compliance: 80 + Math.random() * 15
        }))
      }
    ],
    breachAnalysis: {
      totalBreaches: 248,
      criticalBreaches: 23,
      breachesByCategory: {
        'response_time': 156,
        'resolution_time': 89,
        'availability': 3
      },
      rootCauses: [
        {
          cause: '人手不足',
          frequency: 89,
          impact: 'high'
        },
        {
          cause: '系統故障',
          frequency: 34,
          impact: 'critical'
        },
        {
          cause: '訓練不足',
          frequency: 67,
          impact: 'medium'
        }
      ]
    },
    correctiveActions: [
      {
        id: 'ca-001',
        description: '增加夜班客服人力',
        priority: 'high',
        assignedTo: 'team-manager-1',
        dueDate: '2025-10-15',
        status: 'in_progress'
      }
    ],
    complianceTrends: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      compliance: 85 + Math.random() * 10,
      breaches: Math.floor(Math.random() * 10),
      target: 95
    }))
  };
}
