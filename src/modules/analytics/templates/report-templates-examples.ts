// Report Templates Examples - 報表模板範例
// 提供預設的報表模板配置

import type {
  ReportTemplate
} from '../types/reports-types';
import {
  ReportCategory,
  SectionType,
  VariableType
} from '../types/reports-types';

/**
 * 系統預設報表模板
 */
export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {

  // 1. 每日運營概覽報表
  DAILY_OPERATIONS_OVERVIEW: {
    id: 'daily-ops-overview',
    name: '每日運營概覽報表',
    description: '包含客服對話、用戶活動、系統性能等關鍵指標的每日概覽',
    category: ReportCategory.Operational,
    layout: {
      type: 'portrait',
      size: 'A4',
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      pageNumbers: true
    },
    sections: [{
      id: 'main',
      type: SectionType.Summary,
      title: 'Summary',
      content: {
        template: 'basic-summary'
      },
      order: 1
    }],
    variables: [{
      name: 'dateRange',
      type: VariableType.DateRange,
      defaultValue: 'last_24_hours',
      description: '報表時間範圍',
      required: true
    }],
    styling: {
      theme: 'light',
      fontFamily: 'Arial',
      fontSize: 12,
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
        accent: '#28a745',
        background: '#ffffff',
        text: '#333333',
        border: '#dee2e6'
      },
      spacing: {
        sectionGap: 20,
        elementGap: 10,
        lineHeight: 1.5
      }
    },
    metadata: {
      author: 'System',
      organization: 'Multi Channel Integration',
      version: '1.0.0',
      compatibility: ['1.0.0'],
      requirements: [],
      changelog: []
    },
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: '1.0.0',
    isPublic: true,
    tags: ['daily', 'operations', 'overview', 'metrics']
  },

  // 2. 客戶服務績效報表
  CUSTOMER_SERVICE_PERFORMANCE: {
    id: 'customer-service-perf',
    name: '客戶服務績效報表',
    description: '分析客服團隊的服務表現、回應時間和客戶滿意度',
    category: ReportCategory.Performance,
    layout: {
      type: 'portrait',
      size: 'A4',
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      pageNumbers: true
    },
    sections: [{
      id: 'performance',
      type: SectionType.Chart,
      title: 'Performance Metrics',
      content: {
        chartConfig: {
          type: 'bar',
          title: 'Service Performance',
          series: [{
            name: 'Response Time',
            data: 'response_time'
          }]
        }
      },
      order: 1
    }],
    variables: [{
      name: 'teamId',
      type: VariableType.Team,
      description: '選擇特定團隊',
      required: false
    }],
    styling: {
      theme: 'light',
      fontFamily: 'Arial',
      fontSize: 12,
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
        accent: '#28a745',
        background: '#ffffff',
        text: '#333333',
        border: '#dee2e6'
      },
      spacing: {
        sectionGap: 20,
        elementGap: 10,
        lineHeight: 1.5
      }
    },
    metadata: {
      author: 'System',
      organization: 'Multi Channel Integration',
      version: '1.0.0',
      compatibility: ['1.0.0'],
      requirements: [],
      changelog: []
    },
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: '1.0.0',
    isPublic: true,
    tags: ['performance', 'customer', 'service']
  }
};

/**
 * 預設報表配置示例
 */
export const EXAMPLE_REPORT_CONFIGS = {
  // 可以添加具體的報表配置示例
};

export default REPORT_TEMPLATES;