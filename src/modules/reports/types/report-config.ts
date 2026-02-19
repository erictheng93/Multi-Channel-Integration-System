// Reports 模組 - 配置常數
// Configuration constants for the reporting system

import type { ReportType, ReportFormat } from './report-core-types';

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
