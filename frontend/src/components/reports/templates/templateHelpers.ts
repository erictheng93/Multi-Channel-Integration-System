/**
 * Shared helper functions and preset data for report template components
 * Provides label mappings, formatting utilities, and default template definitions
 */

import type { ReportType, ReportTemplate } from '@/types/reports';
import ReportsAPI from '@/api/reports';

/** Get localized category label */
export const getCategoryLabel = (category: string): string => {
  /* eslint-disable camelcase */
  const labels: Record<string, string> = {
    basic: '基礎',
    enterprise: '企業級',
    business_intelligence: '商業智能',
    advanced_analytics: '高級分析'
  };
  /* eslint-enable camelcase */
  return labels[category] || category;
};

/** Get localized report type label */
export const getReportTypeLabel = (type: ReportType): string => {
  const types = ReportsAPI.getAvailableReportTypes();
  return types.find(t => t.value === type)?.label || type;
};

/** Get localized filter label */
export const getFilterLabel = (filter: string): string => {
  const labels: Record<string, string> = {
    teamIds: '團隊',
    agentIds: '客服',
    customerIds: '客戶',
    platforms: '平台',
    messageTypes: '訊息類型',
    priority: '優先級',
    tags: '標籤',
    customFields: '自定義欄位'
  };
  return labels[filter] || filter;
};

/** Get localized chart type label */
export const getChartTypeLabel = (chartType: string): string => {
  const labels: Record<string, string> = {
    line: '折線圖',
    bar: '柱狀圖',
    pie: '圓餅圖',
    donut: '環狀圖',
    area: '面積圖'
  };
  return labels[chartType] || chartType;
};

/** Format estimated time in human-readable form */
export const formatEstimatedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} 秒`;
  } else if (seconds < 3600) {
    return `${Math.ceil(seconds / 60)} 分鐘`;
  } else {
    return `${Math.ceil(seconds / 3600)} 小時`;
  }
};

/**
 * Default preset template definitions
 * These are loaded when no backend API is available
 */
export const DEFAULT_TEMPLATES: ReportTemplate[] = [
  // 基礎報表模板
  {
    name: '每日對話摘要',
    description: '快速查看每日對話統計和關鍵指標',
    type: 'conversation_summary',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: false,
      chartType: 'line',
      maxRecords: 1000,
      timezone: 'Asia/Taipei'
    },
    requiredFilters: [],
    optionalFilters: ['teamIds', 'agentIds', 'platforms'],
    estimatedTime: 15,
    icon: '📊',
    category: 'basic'
  },
  {
    name: '客服績效月報',
    description: '客服人員月度績效評估和排名',
    type: 'agent_performance',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      chartType: 'bar',
      maxRecords: 500,
      groupBy: ['agentId'],
      sortBy: 'responseTime',
      sortOrder: 'asc'
    },
    requiredFilters: ['agentIds'],
    optionalFilters: ['teamIds', 'priority'],
    estimatedTime: 45,
    icon: '👥',
    category: 'basic'
  },
  {
    name: '客戶滿意度調查',
    description: '分析客戶滿意度評分和意見回饋',
    type: 'customer_satisfaction',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      chartType: 'donut',
      maxRecords: 2000
    },
    requiredFilters: [],
    optionalFilters: ['platforms', 'teamIds', 'priority'],
    estimatedTime: 30,
    icon: '😊',
    category: 'basic'
  },

  // 企業級模板
  {
    name: '成本效益分析',
    description: '完整的營運成本分析和ROI計算',
    type: 'cost_analysis',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      chartType: 'area',
      maxRecords: 5000,
      includeRawData: true
    },
    requiredFilters: ['teamIds'],
    optionalFilters: ['platforms', 'customFields'],
    estimatedTime: 120,
    icon: '💰',
    category: 'enterprise'
  },
  {
    name: 'SLA 合規性監控',
    description: '服務水準協議執行狀況和合規性報告',
    type: 'sla_compliance',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      chartType: 'line',
      maxRecords: 10000
    },
    requiredFilters: ['teamIds'],
    optionalFilters: ['agentIds', 'priority'],
    estimatedTime: 90,
    icon: '⚖️',
    category: 'enterprise'
  },
  {
    name: '異常檢測警報',
    description: '系統異常檢測和風險評估報告',
    type: 'anomaly_detection',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      chartType: 'line',
      includeRawData: true
    },
    requiredFilters: [],
    optionalFilters: ['platforms', 'messageTypes'],
    estimatedTime: 180,
    icon: '🚨',
    category: 'enterprise'
  },

  // 商業智能模板
  {
    name: '30天趨勢預測',
    description: '基於歷史資料的趨勢分析和預測',
    type: 'trend_forecast',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      chartType: 'area',
      maxRecords: 15000
    },
    requiredFilters: [],
    optionalFilters: ['platforms', 'teamIds', 'messageTypes'],
    estimatedTime: 240,
    icon: '📈',
    category: 'enterprise'
  },
  {
    name: '客戶洞察分析',
    description: '深度客戶行為分析和區段劃分',
    type: 'customer_insights',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      chartType: 'pie',
      maxRecords: 20000,
      groupBy: ['customerSegment', 'platform']
    },
    requiredFilters: [],
    optionalFilters: ['platforms', 'customFields'],
    estimatedTime: 300,
    icon: '💡',
    category: 'enterprise'
  },

  // 高級分析模板
  {
    name: '高管戰略摘要',
    description: '高層決策支援的戰略分析報告',
    type: 'executive_summary',
    presetOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: false,
      chartType: 'area',
      maxRecords: 50000
    },
    requiredFilters: ['teamIds'],
    optionalFilters: ['platforms'],
    estimatedTime: 600,
    icon: '💼',
    category: 'advanced'
  }
];
