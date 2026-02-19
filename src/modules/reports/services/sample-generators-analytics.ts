// Sample Data Generators - Analytics Reports
// anomaly_detection, resource_utilization, trend_forecast, customer_insights, channel_integration

import type {
  AnomalyDetectionReportData,
  ResourceUtilizationReportData,
  TrendForecastReportData,
  CustomerInsightsReportData,
  ChannelIntegrationReportData
} from '../types/report-types';
import { nowISO } from '@/utils/timestamp'

/**
 * Generate sample anomaly detection data
 */
export function generateAnomalyDetectionData(): AnomalyDetectionReportData {
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
 * Generate sample resource utilization data
 */
export function generateResourceUtilizationData(): ResourceUtilizationReportData {
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
export function generateTrendForecastData(): TrendForecastReportData {
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
export function generateCustomerInsightsData(): CustomerInsightsReportData {
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
export function generateChannelIntegrationData(): ChannelIntegrationReportData {
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
