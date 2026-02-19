// Sample Data Generators - Strategic Reports
// goal_achievement, automation_effectiveness, security_risk, knowledge_base, call_quality, executive_summary

import type {
  GoalAchievementReportData,
  AutomationEffectivenessReportData,
  SecurityRiskReportData,
  KnowledgeBaseReportData,
  CallQualityReportData,
  ExecutiveSummaryReportData
} from '../types/report-types';
import { nowISO } from '@/utils/timestamp'

/**
 * Generate sample goal achievement data
 */
export function generateGoalAchievementData(): GoalAchievementReportData {
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
export function generateAutomationEffectivenessData(): AutomationEffectivenessReportData {
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
export function generateSecurityRiskData(): SecurityRiskReportData {
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
export function generateKnowledgeBaseData(): KnowledgeBaseReportData {
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
export function generateCallQualityData(): CallQualityReportData {
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
export function generateExecutiveSummaryData(): ExecutiveSummaryReportData {
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
