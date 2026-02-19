// Sample Data Generators for Report Preview
// Extracted from reports-service.ts for better maintainability and testability

import type {
  ReportType,
  ConversationSummaryReportData,
  AgentPerformanceReportData,
  CostAnalysisReportData,
  SLAComplianceReportData,
  AnomalyDetectionReportData,
  AuditTrailReportData,
  ResourceUtilizationReportData,
  TrendForecastReportData,
  CustomerInsightsReportData,
  ChannelIntegrationReportData,
  GoalAchievementReportData,
  AutomationEffectivenessReportData,
  SecurityRiskReportData,
  KnowledgeBaseReportData,
  CallQualityReportData,
  ExecutiveSummaryReportData
} from '../types/report-types';
import { nowISO } from '@/utils/timestamp'

/**
 * Sample Data Generators for Report Preview
 * Provides static methods to generate sample data for each report type
 */
export class SampleDataGenerators {
  /**
   * Get sample data for a specific report type
   * @param reportType - The type of report to generate sample data for
   * @returns Sample data for the report type, or null if not available
   */
  static getSampleData(reportType: ReportType): unknown {
    switch (reportType) {
      case 'conversation_summary':
        return this.generateConversationData();
      case 'agent_performance':
        return this.generateAgentData();
      case 'cost_analysis':
        return this.generateCostAnalysisData();
      case 'sla_compliance':
        return this.generateSLAComplianceData();
      case 'anomaly_detection':
        return this.generateAnomalyDetectionData();
      case 'audit_trail':
        return this.generateAuditTrailData();
      case 'resource_utilization':
        return this.generateResourceUtilizationData();
      case 'trend_forecast':
        return this.generateTrendForecastData();
      case 'customer_insights':
        return this.generateCustomerInsightsData();
      case 'channel_integration':
        return this.generateChannelIntegrationData();
      case 'goal_achievement':
        return this.generateGoalAchievementData();
      case 'automation_effectiveness':
        return this.generateAutomationEffectivenessData();
      case 'security_risk':
        return this.generateSecurityRiskData();
      case 'knowledge_base':
        return this.generateKnowledgeBaseData();
      case 'call_quality':
        return this.generateCallQualityData();
      case 'executive_summary':
        return this.generateExecutiveSummaryData();
      default:
        return null;
    }
  }

  /**
   * Generate sample conversation summary data
   */
  static generateConversationData(): ConversationSummaryReportData {
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
  static generateAgentData(): AgentPerformanceReportData {
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
   * Generate sample cost analysis data
   */
  static generateCostAnalysisData(): CostAnalysisReportData {
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
  static generateSLAComplianceData(): SLAComplianceReportData {
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

  /**
   * Generate sample anomaly detection data
   */
  static generateAnomalyDetectionData(): AnomalyDetectionReportData {
    return {
      detectionSummary: {
        totalAnomalies: 47,
        criticalAnomalies: 8,
        resolvedAnomalies: 35,
        falsePositives: 4,
        detectionAccuracy: 91.5
      },
      anomaliesByCategory: [
        {
          category: 'performance',
          count: 18,
          severity: 'medium',
          avgImpact: 6.7,
          trends: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
            count: Math.floor(Math.random() * 5) + 1
          }))
        },
        {
          category: 'security',
          count: 12,
          severity: 'high',
          avgImpact: 8.9,
          trends: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
            count: Math.floor(Math.random() * 3)
          }))
        }
      ],
      recentAnomalies: [
        {
          id: 'anomaly-001',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          type: 'Response Time Spike',
          severity: 'high',
          description: '回應時間異常增加至平均值3倍以上',
          affectedSystems: ['api-gateway', 'database'],
          confidence: 0.89,
          status: 'investigating',
          resolution: ''
        },
        {
          id: 'anomaly-002',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          type: 'Unusual Login Pattern',
          severity: 'medium',
          description: '非正常時段大量登入活動',
          affectedSystems: ['auth-service'],
          confidence: 0.76,
          status: 'resolved',
          resolution: '確認為自動化測試活動'
        }
      ],
      predictiveInsights: {
        riskScore: 67,
        probabilityOfIncident: 0.23,
        timeToNextAnomaly: 18.5,
        recommendedActions: [
          '增加系統監控頻率',
          '檢查資料庫連線池配置',
          '更新異常檢測閾值'
        ]
      },
      anomalyPatterns: [
        {
          pattern: '週末流量異常',
          frequency: 12,
          timeOfDay: [2, 3, 4, 22, 23],
          dayOfWeek: [0, 6],
          correlatedMetrics: ['cpu_usage', 'response_time']
        }
      ],
      systemHealthIndicators: {
        overallHealth: 78,
        performanceScore: 82,
        reliabilityScore: 74,
        securityScore: 88
      }
    };
  }

  /**
   * Generate sample audit trail data
   */
  static generateAuditTrailData(): AuditTrailReportData {
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
   * Generate sample resource utilization data
   */
  static generateResourceUtilizationData(): ResourceUtilizationReportData {
    return {
      utilizationSummary: {
        overallUtilization: 76.8,
        peakUtilization: 94.2,
        avgUtilization: 73.1,
        utilizationTrend: 'stable'
      },
      agentUtilization: [
        {
          agentId: 'agent-001',
          agentName: 'John Doe',
          teamId: 'team-1',
          totalHours: 160,
          activeHours: 125,
          utilizationRate: 78.1,
          efficiency: 3.2,
          idleTime: 35,
          overloadIndicator: false,
          workloadBalance: 'optimal'
        },
        {
          agentId: 'agent-002',
          agentName: 'Jane Smith',
          teamId: 'team-1',
          totalHours: 160,
          activeHours: 148,
          utilizationRate: 92.5,
          efficiency: 4.1,
          idleTime: 12,
          overloadIndicator: true,
          workloadBalance: 'overloaded'
        }
      ],
      systemResources: {
        serverUtilization: {
          cpu: 68.4,
          memory: 72.8,
          disk: 45.2,
          network: 34.7
        },
        databasePerformance: {
          connections: 85,
          queryTime: 125,
          throughput: 450,
          errors: 3
        },
        apiPerformance: {
          requestRate: 1250,
          responseTime: 180,
          errorRate: 0.8,
          throughput: 1240
        }
      },
      capacityPlan: {
        currentCapacity: 1000,
        projectedNeed: 1300,
        capacityGap: 300,
        recommendations: [
          {
            type: 'scale_out',
            description: '增加3台新的客服工作站',
            priority: 'high',
            estimatedCost: 150000,
            impact: '增加30%處理能力'
          },
          {
            type: 'optimize',
            description: '優化資料庫查詢效能',
            priority: 'medium',
            estimatedCost: 50000,
            impact: '減少15%回應時間'
          }
        ]
      },
      utilizationTrends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
        agentUtilization: 70 + Math.random() * 20,
        systemUtilization: 60 + Math.random() * 25,
        conversationsHandled: Math.floor(Math.random() * 100) + 200,
        responseTime: 150 + Math.random() * 100
      })),
      bottleneckAnalysis: [
        {
          type: 'system',
          location: 'Database Connection Pool',
          severity: 'medium',
          impact: '查詢排隊時間增加',
          suggestedAction: '增加連線池大小或優化查詢',
          estimatedImprovement: 25
        },
        {
          type: 'agent',
          location: 'Team Alpha',
          severity: 'high',
          impact: '客服回應時間過長',
          suggestedAction: '增加人力或重新分配工作量',
          estimatedImprovement: 40
        }
      ]
    };
  }

  /**
   * Generate sample trend forecast data
   */
  static generateTrendForecastData(): TrendForecastReportData {
    return {
      forecastSummary: {
        forecastPeriod: 30,
        confidence: 87.5,
        accuracy: 92.3,
        lastUpdate: nowISO()
      },
      conversationTrends: {
        historical: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
          actual: Math.floor(Math.random() * 100) + 150,
          trend: i % 3 === 0 ? 'increasing' : i % 3 === 1 ? 'stable' : 'decreasing' as const
        })),
        predicted: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
          predicted: Math.floor(Math.random() * 80) + 170,
          confidenceLow: Math.floor(Math.random() * 50) + 140,
          confidenceHigh: Math.floor(Math.random() * 50) + 200,
          scenario: i % 3 === 0 ? 'optimistic' : i % 3 === 1 ? 'realistic' : 'pessimistic' as const
        }))
      },
      demandForecast: {
        peakHours: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          predictedVolume: Math.floor(Math.random() * 50) + (i >= 9 && i <= 17 ? 80 : 20),
          requiredAgents: Math.floor(Math.random() * 8) + (i >= 9 && i <= 17 ? 12 : 3)
        })),
        seasonalPatterns: [
          { period: '春季', pattern: 'normal', multiplier: 1.0 },
          { period: '夏季', pattern: 'high', multiplier: 1.3 },
          { period: '秋季', pattern: 'normal', multiplier: 1.1 },
          { period: '冬季', pattern: 'low', multiplier: 0.8 }
        ],
        specialEvents: [
          {
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
            event: '雙11購物節',
            expectedImpact: 2.5,
            type: 'promotion'
          },
          {
            date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
            event: '系統維護',
            expectedImpact: 1.8,
            type: 'system_maintenance'
          }
        ]
      },
      riskAssessment: {
        overloadRisk: 35,
        understaffingRisk: 42,
        systemCapacityRisk: 28,
        mitigationSuggestions: [
          {
            risk: '人力不足風險',
            suggestion: '預先招聘3名臨時客服人員',
            priority: 'high'
          },
          {
            risk: '系統超載風險',
            suggestion: '升級服務器配置和增加負載平衡',
            priority: 'medium'
          }
        ]
      },
      modelPerformance: {
        mape: 8.7,
        rmse: 12.3,
        lastTraining: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dataQuality: 94.2
      }
    };
  }

  /**
   * Generate sample customer insights data
   */
  static generateCustomerInsightsData(): CustomerInsightsReportData {
    return {
      customerSegmentation: {
        totalCustomers: 15420,
        segments: [
          {
            segment: 'vip',
            count: 892,
            percentage: 5.8,
            characteristics: ['高價值訂單', '低流失率', '頻繁互動'],
            averageValue: 8500,
            retentionRate: 94.5
          },
          {
            segment: 'loyal',
            count: 4626,
            percentage: 30.0,
            characteristics: ['定期購買', '推薦他人', '品牌忠誠'],
            averageValue: 3200,
            retentionRate: 87.2
          },
          {
            segment: 'new',
            count: 3084,
            percentage: 20.0,
            characteristics: ['首次購買', '探索階段', '價格敏感'],
            averageValue: 850,
            retentionRate: 45.8
          },
          {
            segment: 'at_risk',
            count: 2313,
            percentage: 15.0,
            characteristics: ['降低互動', '投訴增加', '考慮替代'],
            averageValue: 1200,
            retentionRate: 23.4
          },
          {
            segment: 'inactive',
            count: 4505,
            percentage: 29.2,
            characteristics: ['長期未購買', '無回應', '可能流失'],
            averageValue: 0,
            retentionRate: 5.1
          }
        ]
      },
      behaviorAnalysis: {
        preferredChannels: {
          line: { usage: 45.2, satisfaction: 4.3, conversionRate: 23.8 },
          webchat: { usage: 28.7, satisfaction: 4.1, conversionRate: 19.4 },
          facebook: { usage: 18.3, satisfaction: 3.9, conversionRate: 15.2 },
          email: { usage: 7.8, satisfaction: 3.7, conversionRate: 12.1 }
        },
        contactPatterns: {
          peakHours: [9, 10, 11, 14, 15, 16, 19, 20],
          commonTopics: [
            { topic: '產品諮詢', frequency: 340, avgResolutionTime: 8.5 },
            { topic: '訂單問題', frequency: 280, avgResolutionTime: 12.3 },
            { topic: '退換貨', frequency: 195, avgResolutionTime: 15.7 },
            { topic: '帳戶問題', frequency: 142, avgResolutionTime: 6.8 }
          ],
          seasonality: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(2024, i, 1).toLocaleString('zh-TW', { month: 'long' }),
            activity: Math.floor(Math.random() * 40) + 80,
            issues: ['產品諮詢', '促銷活動', '技術支援'].slice(0, Math.floor(Math.random() * 3) + 1)
          }))
        },
        journeyMapping: [
          {
            stage: 'awareness',
            touchpoints: ['社群媒體', '廣告', '搜尋引擎'],
            duration: 7,
            conversionRate: 45.2,
            dropoffRate: 54.8
          },
          {
            stage: 'consideration',
            touchpoints: ['官網', '產品頁面', '客服諮詢'],
            duration: 14,
            conversionRate: 32.1,
            dropoffRate: 67.9
          },
          {
            stage: 'purchase',
            touchpoints: ['購物車', '付款頁面', '確認郵件'],
            duration: 2,
            conversionRate: 78.5,
            dropoffRate: 21.5
          },
          {
            stage: 'support',
            touchpoints: ['客服中心', '幫助文件', '社群'],
            duration: 5,
            conversionRate: 85.3,
            dropoffRate: 14.7
          },
          {
            stage: 'advocacy',
            touchpoints: ['評價系統', '推薦計畫', '社群分享'],
            duration: 30,
            conversionRate: 23.8,
            dropoffRate: 76.2
          }
        ]
      },
      satisfactionInsights: {
        overallSatisfaction: 4.2,
        satisfactionDrivers: [
          { factor: '回應速度', impact: 0.45, improvement: 15.3 },
          { factor: '解決品質', impact: 0.38, improvement: 12.7 },
          { factor: '服務態度', impact: 0.32, improvement: 8.9 },
          { factor: '專業知識', impact: 0.28, improvement: 18.2 }
        ],
        npsAnalysis: {
          score: 52,
          promoters: 3892,
          passives: 7234,
          detractors: 4294,
          trends: Array.from({ length: 12 }, (_, i) => ({
            date: new Date(2024, i, 1).toISOString().split('T')[0]!,
            score: Math.floor(Math.random() * 20) + 45
          }))
        }
      },
      churnPrediction: {
        churnRate: 18.7,
        riskSegments: [
          {
            segment: '高價值流失風險',
            riskScore: 78,
            churnProbability: 65.4,
            retentionActions: ['個人化優惠', '專屬客服', '產品升級']
          },
          {
            segment: '新客戶流失風險',
            riskScore: 45,
            churnProbability: 42.1,
            retentionActions: ['新手指導', '首購優惠', '定期追蹤']
          }
        ],
        earlyWarningIndicators: [
          { indicator: '互動頻率下降', threshold: -30, currentValue: -25, trend: 'worsening' },
          { indicator: '投訴增加', threshold: 2, currentValue: 1.5, trend: 'stable' },
          { indicator: '滿意度下降', threshold: -0.5, currentValue: -0.3, trend: 'improving' }
        ]
      },
      revenueImpact: {
        customerLifetimeValue: 2450,
        revenueBySegment: {
          vip: 7580000,
          loyal: 14803200,
          new: 2621400,
          at_risk: 2775600,
          inactive: 0
        },
        retentionImpact: {
          currentRevenue: 27780200,
          potentialLoss: 4200000,
          retentionOpportunity: 1890000
        }
      }
    };
  }

  /**
   * Generate sample channel integration data
   */
  static generateChannelIntegrationData(): ChannelIntegrationReportData {
    return {
      channelOverview: {
        activeChannels: [
          {
            channel: 'line',
            status: 'active',
            uptime: 99.8,
            totalConversations: 4562,
            avgResponseTime: 2.3,
            satisfaction: 4.4
          },
          {
            channel: 'facebook',
            status: 'active',
            uptime: 99.2,
            totalConversations: 2156,
            avgResponseTime: 3.1,
            satisfaction: 4.1
          },
          {
            channel: 'webchat',
            status: 'active',
            uptime: 99.9,
            totalConversations: 3247,
            avgResponseTime: 1.8,
            satisfaction: 4.2
          },
          {
            channel: 'email',
            status: 'active',
            uptime: 100.0,
            totalConversations: 1823,
            avgResponseTime: 45.2,
            satisfaction: 3.8
          },
          {
            channel: 'phone',
            status: 'maintenance',
            uptime: 95.5,
            totalConversations: 892,
            avgResponseTime: 5.6,
            satisfaction: 4.0
          }
        ],
        integrationHealth: 94.2
      },
      crossChannelAnalysis: {
        channelMigration: [
          { fromChannel: 'webchat', toChannel: 'phone', count: 245, reason: 'escalation' },
          { fromChannel: 'line', toChannel: 'webchat', count: 189, reason: 'preference' },
          { fromChannel: 'email', toChannel: 'phone', count: 156, reason: 'complexity' },
          { fromChannel: 'facebook', toChannel: 'line', count: 98, reason: 'availability' }
        ],
        omnichanelJourneys: [
          {
            customer: 'CUST001',
            touchpoints: [
              { channel: 'webchat', timestamp: '2025-09-26T09:00:00Z', interaction: '產品詢問' },
              { channel: 'line', timestamp: '2025-09-26T14:30:00Z', interaction: '價格確認' },
              { channel: 'phone', timestamp: '2025-09-26T16:45:00Z', interaction: '訂單完成' }
            ],
            totalDuration: 465,
            resolution: 'resolved'
          },
          {
            customer: 'CUST002',
            touchpoints: [
              { channel: 'email', timestamp: '2025-09-25T08:00:00Z', interaction: '退貨申請' },
              { channel: 'webchat', timestamp: '2025-09-25T10:15:00Z', interaction: '狀態查詢' },
              { channel: 'phone', timestamp: '2025-09-25T15:20:00Z', interaction: '退貨確認' }
            ],
            totalDuration: 440,
            resolution: 'resolved'
          }
        ]
      },
      integrationMetrics: {
        dataConsistency: 96.7,
        responseTimeVariance: 8.2,
        qualityConsistency: 91.4,
        contextPreservation: 89.3
      },
      channelEffectiveness: {
        conversionRates: {
          line: 28.7,
          webchat: 24.3,
          facebook: 19.8,
          email: 15.2,
          phone: 42.1
        },
        costPerChannel: {
          line: 12.5,
          webchat: 8.9,
          facebook: 15.3,
          email: 3.2,
          phone: 35.8
        },
        customerPreferences: {
          line: { usage: 35.2, satisfaction: 4.4, efficiency: 92.1 },
          webchat: { usage: 28.7, satisfaction: 4.2, efficiency: 89.5 },
          facebook: { usage: 18.9, satisfaction: 4.1, efficiency: 86.3 },
          email: { usage: 12.4, satisfaction: 3.8, efficiency: 78.9 },
          phone: { usage: 4.8, satisfaction: 4.0, efficiency: 94.2 }
        },
        performanceComparison: [
          {
            metric: '回應時間',
            channels: { line: 2.3, webchat: 1.8, facebook: 3.1, email: 45.2, phone: 5.6 },
            benchmark: 5.0
          },
          {
            metric: '解決率',
            channels: { line: 87.5, webchat: 82.3, facebook: 79.1, email: 92.8, phone: 95.2 },
            benchmark: 85.0
          }
        ]
      },
      unificationOpportunities: [
        {
          opportunity: '統一客戶檔案',
          description: '建立跨通道統一的客戶檔案系統',
          estimatedImpact: 25.3,
          implementationEffort: 'high',
          priority: 'high'
        },
        {
          opportunity: '智能路由',
          description: '根據客戶偏好和複雜度智能分配通道',
          estimatedImpact: 18.7,
          implementationEffort: 'medium',
          priority: 'high'
        }
      ]
    };
  }

  /**
   * Generate sample goal achievement data
   */
  static generateGoalAchievementData(): GoalAchievementReportData {
    return {
      goalSummary: {
        totalGoals: 24,
        achievedGoals: 8,
        onTrackGoals: 12,
        atRiskGoals: 4,
        overallProgress: 73.5
      },
      departmentGoals: [
        {
          department: '客服部',
          goals: [
            {
              id: 'CS001',
              title: '客戶滿意度提升至4.5分',
              target: 4.5,
              current: 4.2,
              progress: 82.3,
              status: 'on_track',
              deadline: '2025-12-31',
              priority: 'high',
              assignee: 'customer_service_manager'
            },
            {
              id: 'CS002',
              title: '平均回應時間降至3分鐘',
              target: 3.0,
              current: 4.1,
              progress: 68.7,
              status: 'at_risk',
              deadline: '2025-10-31',
              priority: 'critical',
              assignee: 'operations_lead'
            }
          ],
          departmentProgress: 75.5
        },
        {
          department: '技術部',
          goals: [
            {
              id: 'TEC001',
              title: '系統可用性達99.9%',
              target: 99.9,
              current: 99.2,
              progress: 92.1,
              status: 'on_track',
              deadline: '2025-12-31',
              priority: 'high',
              assignee: 'tech_lead'
            }
          ],
          departmentProgress: 92.1
        }
      ],
      kpiTracking: {
        responseTimeGoal: {
          target: 180,
          current: 245,
          improvement: -8.2,
          trend: 'declining'
        },
        satisfactionGoal: {
          target: 4.5,
          current: 4.2,
          improvement: 12.5,
          trend: 'improving'
        },
        resolutionRateGoal: {
          target: 90.0,
          current: 87.3,
          improvement: 5.8,
          trend: 'improving'
        },
        customKPIs: [
          { name: '首次解決率', target: 85.0, current: 82.4, unit: '%', progress: 96.9 },
          { name: '客戶流失率', target: 5.0, current: 6.2, unit: '%', progress: 80.6 }
        ]
      },
      milestones: [
        {
          id: 'M001',
          title: '新客服系統上線',
          dueDate: '2025-11-15',
          status: 'in_progress',
          progress: 65.0,
          dependencies: ['系統開發', '人員訓練'],
          blockers: ['預算延遲']
        },
        {
          id: 'M002',
          title: '客戶滿意度調查完成',
          dueDate: '2025-10-01',
          status: 'completed',
          progress: 100.0,
          dependencies: [],
          blockers: []
        }
      ],
      performanceTrends: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0]!,
        overallProgress: Math.floor(Math.random() * 20) + 65,
        goalsAchieved: Math.floor(Math.random() * 3) + 1,
        newGoalsAdded: Math.floor(Math.random() * 2)
      })),
      recommendations: [
        {
          type: 'acceleration',
          description: '增加客服人力以加速回應時間改善',
          impact: 'high',
          effort: 'medium'
        },
        {
          type: 'resource_reallocation',
          description: '將部分預算從廣告轉移至客服系統升級',
          impact: 'medium',
          effort: 'low'
        }
      ]
    };
  }

  /**
   * Generate sample automation effectiveness data
   */
  static generateAutomationEffectivenessData(): AutomationEffectivenessReportData {
    return {
      automationOverview: {
        totalAutomations: 12,
        activeAutomations: 10,
        automationCoverage: 68.5,
        overallEffectiveness: 82.3
      },
      automationTypes: [
        {
          type: 'chatbot',
          count: 3,
          successRate: 78.5,
          avgProcessingTime: 2.3,
          costSavings: 45000,
          humanHandoffRate: 21.5
        },
        {
          type: 'workflow',
          count: 4,
          successRate: 92.1,
          avgProcessingTime: 0.8,
          costSavings: 32000,
          humanHandoffRate: 7.9
        },
        {
          type: 'routing',
          count: 2,
          successRate: 89.7,
          avgProcessingTime: 1.2,
          costSavings: 18000,
          humanHandoffRate: 10.3
        },
        {
          type: 'escalation',
          count: 2,
          successRate: 95.3,
          avgProcessingTime: 0.5,
          costSavings: 12000,
          humanHandoffRate: 4.7
        },
        {
          type: 'notification',
          count: 1,
          successRate: 99.2,
          avgProcessingTime: 0.1,
          costSavings: 8000,
          humanHandoffRate: 0.8
        }
      ],
      performanceMetrics: {
        automatedVsManual: {
          totalInteractions: 18450,
          automatedHandled: 12638,
          manualHandled: 5812,
          automationRate: 68.5
        },
        qualityMetrics: {
          automatedSatisfaction: 4.1,
          manualSatisfaction: 4.3,
          automatedAccuracy: 87.6,
          falsePositiveRate: 8.3,
          falseNegativeRate: 4.1
        },
        efficiencyGains: {
          timeReduction: 65.2,
          costReduction: 42.8,
          volumeIncrease: 85.3,
          agentProductivityGain: 28.7
        }
      },
      automationROI: {
        totalInvestment: 180000,
        monthlySavings: 28500,
        paybackPeriod: 6.3,
        roi: 189.5,
        npv: 285000
      },
      failureAnalysis: {
        commonFailures: [
          {
            automation: '智能客服機器人',
            failure: '複雜查詢理解失敗',
            frequency: 23,
            impact: 'medium',
            resolution: '改進自然語言處理模型'
          },
          {
            automation: '自動路由系統',
            failure: '錯誤分類客戶問題',
            frequency: 15,
            impact: 'low',
            resolution: '更新分類規則和訓練數據'
          }
        ],
        errorPatterns: [
          {
            pattern: '非結構化查詢處理困難',
            frequency: 38,
            suggestedFix: '增強機器學習模型訓練'
          },
          {
            pattern: '多輪對話上下文丟失',
            frequency: 22,
            suggestedFix: '改進對話狀態管理'
          }
        ]
      },
      optimizationOpportunities: [
        {
          automation: '聊天機器人',
          opportunity: '擴展知識庫覆蓋範圍',
          estimatedImprovement: 15.3,
          implementationEffort: 'medium',
          priority: 'high'
        },
        {
          automation: '工作流程',
          opportunity: '增加異常處理規則',
          estimatedImprovement: 8.7,
          implementationEffort: 'low',
          priority: 'medium'
        }
      ]
    };
  }

  /**
   * Generate sample security risk data
   */
  static generateSecurityRiskData(): SecurityRiskReportData {
    return {
      riskOverview: {
        overallRiskScore: 42,
        riskTrend: 'improving',
        highRiskCount: 8,
        criticalVulnerabilities: 3,
        lastAssessment: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      threatLandscape: {
        identifiedThreats: [
          {
            threat: 'SQL注入攻擊',
            severity: 'high',
            likelihood: 25,
            impact: 85,
            riskScore: 21.25,
            mitigation: '實施參數化查詢和輸入驗證',
            status: 'mitigating'
          },
          {
            threat: '釣魚攻擊',
            severity: 'medium',
            likelihood: 60,
            impact: 45,
            riskScore: 27.0,
            mitigation: '加強員工安全意識培訓',
            status: 'open'
          },
          {
            threat: 'DDoS攻擊',
            severity: 'high',
            likelihood: 35,
            impact: 75,
            riskScore: 26.25,
            mitigation: '部署CDN和流量清洗服務',
            status: 'closed'
          }
        ],
        attackVectors: [
          { vector: 'phishing', attempts: 156, success: 12, preventionRate: 92.3 },
          { vector: 'malware', attempts: 89, success: 3, preventionRate: 96.6 },
          { vector: 'brute_force', attempts: 234, success: 8, preventionRate: 96.6 },
          { vector: 'sql_injection', attempts: 45, success: 2, preventionRate: 95.6 }
        ]
      },
      vulnerabilityAssessment: {
        systemVulnerabilities: [
          {
            system: '客服管理系統',
            vulnerabilities: [
              {
                cve: 'CVE-2024-1234',
                severity: 'high',
                cvssScore: 7.8,
                description: '未經驗證的檔案上傳漏洞',
                patch: '更新至版本 v2.3.1',
                patchDate: '2025-09-20'
              },
              {
                cve: 'CVE-2024-5678',
                severity: 'medium',
                cvssScore: 5.4,
                description: '跨站腳本攻擊漏洞',
                patch: '套用安全修補程式 SP-001',
                patchDate: undefined
              }
            ]
          },
          {
            system: 'LINE 整合服務',
            vulnerabilities: [
              {
                cve: 'CVE-2024-9012',
                severity: 'low',
                cvssScore: 3.2,
                description: '資訊洩露漏洞',
                patch: '配置檔案權限修正',
                patchDate: '2025-09-25'
              }
            ]
          }
        ],
        dataExposureRisks: [
          {
            dataType: 'pii',
            exposureLevel: 'medium',
            affectedRecords: 1500,
            protection: '加密存儲和傳輸'
          },
          {
            dataType: 'credentials',
            exposureLevel: 'low',
            affectedRecords: 50,
            protection: '雜湊加鹽存儲'
          }
        ]
      },
      securityIncidents: {
        totalIncidents: 23,
        incidentsByType: {
          'unauthorized_access': 8,
          'data_breach': 2,
          'malware': 5,
          'phishing': 8
        },
        avgResolutionTime: 4.5,
        recentIncidents: [
          {
            id: 'SEC-2025-001',
            type: '可疑登入行為',
            severity: 'medium',
            status: 'resolved',
            impact: '無資料外洩，系統正常運作',
            timeline: [
              { timestamp: '2025-09-25T14:30:00Z', action: '異常登入偵測觸發' },
              { timestamp: '2025-09-25T14:35:00Z', action: '帳戶暫時鎖定' },
              { timestamp: '2025-09-25T15:10:00Z', action: '身份驗證完成，帳戶解鎖' }
            ]
          }
        ]
      },
      complianceStatus: {
        regulations: [
          {
            regulation: 'GDPR',
            compliance: 92,
            gaps: ['資料保留政策更新', '同意管理改善'],
            nextAudit: '2025-12-01'
          },
          {
            regulation: 'ISO_27001',
            compliance: 88,
            gaps: ['風險管理程序文件', '員工安全培訓記錄'],
            nextAudit: '2026-03-15'
          }
        ],
        policyAdherence: {
          passwordPolicy: 94,
          accessControl: 89,
          dataHandling: 91,
          incidentResponse: 87
        }
      },
      recommendations: [
        {
          priority: 'critical',
          category: 'preventive',
          recommendation: '立即修補高風險漏洞CVE-2024-1234',
          estimatedCost: 15000,
          estimatedEffort: 5,
          expectedRiskReduction: 35
        },
        {
          priority: 'high',
          category: 'detective',
          recommendation: '部署進階威脅偵測系統',
          estimatedCost: 80000,
          estimatedEffort: 20,
          expectedRiskReduction: 45
        }
      ]
    };
  }

  /**
   * Generate sample knowledge base data
   */
  static generateKnowledgeBaseData(): KnowledgeBaseReportData {
    return {
      knowledgeOverview: {
        totalArticles: 456,
        publishedArticles: 398,
        draftArticles: 42,
        archivedArticles: 16,
        totalViews: 28450,
        avgRating: 4.2
      },
      contentPerformance: {
        topPerformingArticles: [
          {
            id: 'KB001',
            title: 'LINE官方帳號設定指南',
            views: 2580,
            rating: 4.7,
            helpfulness: 89.5,
            lastUpdated: '2025-08-15'
          },
          {
            id: 'KB023',
            title: '常見客服問題快速解答',
            views: 1920,
            rating: 4.4,
            helpfulness: 85.2,
            lastUpdated: '2025-09-01'
          },
          {
            id: 'KB045',
            title: '退換貨處理流程',
            views: 1650,
            rating: 4.6,
            helpfulness: 92.1,
            lastUpdated: '2025-07-20'
          }
        ],
        underperformingArticles: [
          {
            id: 'KB089',
            title: '系統維護通知範本',
            views: 45,
            rating: 2.8,
            issues: ['內容過時', '範例不清楚', '缺少實際案例'],
            recommendedActions: ['更新內容', '增加範例', '重新分類']
          },
          {
            id: 'KB156',
            title: '複雜技術問題處理',
            views: 78,
            rating: 3.1,
            issues: ['過於複雜', '缺少步驟說明'],
            recommendedActions: ['簡化內容', '分解為多篇文章']
          }
        ],
        contentGaps: [
          { topic: '社群媒體整合', searchFrequency: 156, availableArticles: 2, gapScore: 78.0 },
          { topic: '多語言客服', searchFrequency: 98, availableArticles: 1, gapScore: 98.0 },
          { topic: '行動裝置問題', searchFrequency: 234, availableArticles: 5, gapScore: 46.8 }
        ]
      },
      usageAnalytics: {
        searchPatterns: [
          { query: 'LINE 設定', frequency: 234, successRate: 87.2, avgTimeToResult: 12.5 },
          { query: '退貨流程', frequency: 189, successRate: 94.1, avgTimeToResult: 8.3 },
          { query: '帳號問題', frequency: 156, successRate: 78.5, avgTimeToResult: 15.7 },
          { query: '付款失敗', frequency: 123, successRate: 82.9, avgTimeToResult: 11.2 }
        ],
        userBehavior: {
          avgSessionDuration: 4.5,
          bounceRate: 32.1,
          pagesPerSession: 2.8,
          returnVisitorRate: 45.6
        },
        channelUsage: {
          webchat: { views: 12500, searches: 3200, ratings: 890 },
          mobile_app: { views: 8900, searches: 2100, ratings: 650 },
          admin_panel: { views: 7050, searches: 1800, ratings: 420 }
        }
      },
      contentMaintenance: {
        outdatedContent: [
          { id: 'KB034', title: 'Facebook整合設定', lastUpdated: '2024-03-15', staleness: 195, priority: 'high' },
          { id: 'KB067', title: '舊版客服系統操作', lastUpdated: '2024-01-20', staleness: 249, priority: 'high' },
          { id: 'KB098', title: '促銷活動設定', lastUpdated: '2024-08-10', staleness: 47, priority: 'medium' }
        ],
        maintenanceBacklog: {
          reviewPending: 23,
          updateRequired: 18,
          accuracyCheck: 12,
          brokenLinks: 8
        },
        contentLifecycle: {
          creationRate: 8.5,
          updateRate: 15.2,
          retirementRate: 2.1
        }
      },
      agentProductivity: {
        knowledgeUsageByAgents: [
          {
            agentId: 'agent-001',
            agentName: 'Alice Chen',
            articlesViewed: 145,
            timeSpent: 320,
            resolutionImprovement: 23.5
          },
          {
            agentId: 'agent-002',
            agentName: 'Bob Lin',
            articlesViewed: 98,
            timeSpent: 210,
            resolutionImprovement: 18.7
          }
        ],
        resolutionEfficiency: {
          withKnowledge: {
            avgResolutionTime: 8.5,
            firstCallResolution: 87.3,
            customerSatisfaction: 4.4
          },
          withoutKnowledge: {
            avgResolutionTime: 15.2,
            firstCallResolution: 62.1,
            customerSatisfaction: 3.8
          }
        }
      },
      aiIntegration: {
        chatbotUsage: {
          articlesReferenced: 1580,
          accurateResponses: 1342,
          fallbackToHuman: 238
        },
        smartSuggestions: {
          suggestionsProvided: 2340,
          accepted: 1890,
          accuracy: 80.8
        }
      }
    };
  }

  /**
   * Generate sample call quality data
   */
  static generateCallQualityData(): CallQualityReportData {
    return {
      qualityOverview: {
        totalCalls: 1850,
        avgQualityScore: 82.5,
        qualityTrend: 'improving',
        monitoredCalls: 378,
        qualityAssessments: 156
      },
      audioQuality: {
        overallAudioScore: 87.3,
        commonIssues: [
          {
            issue: 'background_noise',
            frequency: 23,
            impact: 'medium',
            solutions: ['使用降噪耳機', '改善工作環境', '音訊處理軟體']
          },
          {
            issue: 'low_volume',
            frequency: 15,
            impact: 'low',
            solutions: ['調整麥克風增益', '檢查設備連接', '更新音訊驅動']
          },
          {
            issue: 'echo',
            frequency: 8,
            impact: 'high',
            solutions: ['使用耳機', '調整回音消除', '音響設備檢查']
          }
        ],
        networkPerformance: {
          avgLatency: 45.2,
          packetLoss: 0.8,
          jitter: 12.5,
          connectionQuality: 94.2
        }
      },
      conversationQuality: {
        agentPerformance: [
          {
            agentId: 'agent-001',
            agentName: 'Sarah Wang',
            avgScore: 88.5,
            callsMonitored: 45,
            strengths: ['專業知識豐富', '溝通清晰', '解決效率高'],
            improvementAreas: ['需提升耐心', '主動關懷可改善'],
            trainingRecommended: ['情緒管理訓練', '進階客服技巧']
          },
          {
            agentId: 'agent-002',
            agentName: 'David Liu',
            avgScore: 75.2,
            callsMonitored: 38,
            strengths: ['友善態度', '積極解決問題'],
            improvementAreas: ['產品知識不足', '處理速度較慢'],
            trainingRecommended: ['產品培訓', '流程優化訓練']
          }
        ],
        qualityMetrics: {
          professionalism: 85.7,
          productKnowledge: 78.9,
          problemSolving: 82.1,
          communication: 87.3,
          empathy: 79.5
        },
        compliance: {
          scriptAdherence: 89.2,
          regulatoryCompliance: 95.8,
          dataPrivacyCompliance: 97.1,
          complianceViolations: [
            { type: '未完成身份驗證', frequency: 12, severity: 'major' },
            { type: '遺漏重要資訊確認', frequency: 8, severity: 'minor' },
            { type: '未依標準流程處理', frequency: 5, severity: 'major' }
          ]
        }
      },
      customerExperience: {
        satisfactionCorrelation: {
          qualityScore: 82.5,
          satisfaction: 4.2,
          correlation: 0.78
        },
        callOutcomes: {
          resolved: 1456,
          escalated: 234,
          callback: 98,
          abandoned: 62
        },
        emotionAnalysis: {
          positiveEmotions: 65.4,
          neutralEmotions: 28.7,
          negativeEmotions: 5.9,
          emotionTrends: [
            { timeSegment: '開始', emotion: 'neutral', intensity: 45.2 },
            { timeSegment: '中段', emotion: 'positive', intensity: 62.8 },
            { timeSegment: '結束', emotion: 'positive', intensity: 78.5 }
          ]
        }
      },
      technicalMetrics: {
        callStability: {
          completionRate: 96.8,
          dropCallRate: 3.2,
          reconnectionRate: 89.5
        },
        systemPerformance: {
          cpuUsage: 42.3,
          memoryUsage: 67.8,
          bandwidthUsage: 78.9,
          serverResponse: 98.5
        }
      },
      improvementPlan: [
        {
          area: 'conversation',
          issue: '產品知識不足影響解決效率',
          recommendation: '增加定期產品培訓和知識測試',
          priority: 'high',
          estimatedImpact: 25.3,
          implementationTime: 14
        },
        {
          area: 'audio',
          issue: '背景噪音影響通話品質',
          recommendation: '改善工作環境並配發降噪設備',
          priority: 'medium',
          estimatedImpact: 15.7,
          implementationTime: 7
        },
        {
          area: 'technical',
          issue: '網路延遲偶爾影響通話穩定度',
          recommendation: '升級網路設備和頻寬',
          priority: 'medium',
          estimatedImpact: 12.1,
          implementationTime: 21
        }
      ]
    };
  }

  /**
   * Generate sample executive summary data
   */
  static generateExecutiveSummaryData(): ExecutiveSummaryReportData {
    return {
      executiveOverview: {
        reportPeriod: '2025 Q3',
        generatedAt: nowISO(),
        keyHighlights: [
          '客戶滿意度連續三個月提升，達到4.2分歷史新高',
          '自動化客服覆蓋率提升至68.5%，節省成本42.8%',
          '多通道整合度達94.2%，客戶體驗顯著改善',
          'SLA合規率從75%提升至87.5%，仍需持續改進'
        ],
        overallPerformance: 'good',
        performanceScore: 78.5
      },
      businessMetrics: {
        customerSatisfaction: {
          current: 4.2,
          target: 4.5,
          trend: 'up',
          comparison: 'below'
        },
        operationalEfficiency: {
          current: 82.3,
          target: 85.0,
          trend: 'up',
          comparison: 'below'
        },
        costEffectiveness: {
          current: 76.8,
          target: 80.0,
          trend: 'up',
          comparison: 'below'
        },
        revenueImpact: {
          directRevenue: 2850000,
          costSavings: 420000,
          customerRetention: 1890000,
          revenueAtRisk: 350000
        }
      },
      strategicInsights: {
        marketPosition: {
          competitiveRanking: 3,
          marketShare: 12.5,
          brandPerception: 'positive',
          differentiators: ['多通道整合', 'AI智能客服', '24/7全天候服務', '個人化體驗']
        },
        customerInsights: {
          loyaltyIndex: 67,
          churnRisk: 'medium',
          growthOpportunities: [
            '擴展企業客戶市場',
            '提升VIP客戶服務體驗',
            '開發新興通路整合'
          ],
          segmentPerformance: {
            'enterprise': { revenue: 15800000, growth: 23.5, satisfaction: 4.4 },
            'smb': { revenue: 8950000, growth: 12.8, satisfaction: 4.1 },
            'individual': { revenue: 3450000, growth: 8.7, satisfaction: 3.9 }
          }
        }
      },
      riskAssessment: {
        overallRisk: 'medium',
        riskFactors: [
          {
            risk: '人才短缺風險',
            probability: 65,
            impact: 75,
            mitigation: '加強招募和員工留任計畫'
          },
          {
            risk: '技術依賴風險',
            probability: 40,
            impact: 85,
            mitigation: '建立備援系統和災難復原計畫'
          },
          {
            risk: '競爭加劇風險',
            probability: 80,
            impact: 60,
            mitigation: '持續創新和差異化策略'
          }
        ],
        complianceStatus: 'minor_issues'
      },
      financialSummary: {
        currentPeriod: {
          revenue: 28200000,
          costs: 18500000,
          profit: 9700000,
          margin: 34.4
        },
        yearOverYear: {
          revenueGrowth: 18.5,
          costChange: 12.3,
          profitGrowth: 28.7,
          marginChange: 2.8
        },
        projections: {
          nextQuarter: {
            revenue: 30500000,
            costs: 19200000,
            profit: 11300000
          },
          yearEnd: {
            revenue: 115000000,
            costs: 75000000,
            profit: 40000000
          }
        }
      },
      actionItems: {
        immediate: [
          {
            priority: 'critical',
            action: '完成關鍵系統安全漏洞修補',
            owner: 'CTO',
            deadline: '2025-10-05',
            impact: '降低資安風險，確保業務連續性'
          },
          {
            priority: 'high',
            action: '啟動Q4客服人力擴充計畫',
            owner: 'CHRO',
            deadline: '2025-10-15',
            impact: '改善服務品質，提升客戶滿意度'
          }
        ],
        strategic: [
          {
            priority: 'high',
            initiative: 'AI客服能力全面升級計畫',
            timeline: '6個月',
            investment: 2500000,
            expectedROI: 285.5
          },
          {
            priority: 'medium',
            initiative: '企業客戶專屬服務平台建置',
            timeline: '9個月',
            investment: 4200000,
            expectedROI: 180.3
          }
        ]
      },
      recommendations: [
        {
          category: 'growth',
          recommendation: '加速AI技術應用，提升自動化服務覆蓋率至80%',
          rationale: '可顯著降低營運成本並提升服務效率',
          expectedBenefit: '年節省成本約300萬，服務效率提升35%',
          investmentRequired: 1800000,
          timeframe: '6個月'
        },
        {
          category: 'quality',
          recommendation: '建立客戶體驗監控和改善機制',
          rationale: '持續監控和優化客戶體驗可提升滿意度和留存率',
          expectedBenefit: '客戶滿意度提升至4.5分，流失率降低15%',
          investmentRequired: 800000,
          timeframe: '3個月'
        },
        {
          category: 'efficiency',
          recommendation: '優化跨部門協作流程，建立統一服務標準',
          rationale: '標準化流程可提升服務一致性和員工效率',
          expectedBenefit: '服務處理時間縮短25%，員工滿意度提升',
          investmentRequired: 500000,
          timeframe: '4個月'
        }
      ]
    };
  }
}
