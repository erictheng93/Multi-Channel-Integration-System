// ============================================================================
// ANALYTICS Module - 數據分析與洞察模組
// 整合統計分析、儀表板、實時監控和報表功能的統一數據洞察平台
// ============================================================================

// ======================== 類型導出 ========================
export type * from './types/analytics-types';
export type * from './types/metrics-types';
export type * from './types/reports-types';

// Dashboard types exported separately to avoid conflicts
export type {
  DashboardConfig,
  DashboardWidget,
  WidgetData,
  WidgetMetadata,
  WidgetDataSource,
  DashboardPermissions,
  DashboardLayout,
  WidgetPosition,
  ChartType,
  Theme
} from './types/dashboard-types';

// ======================== 服務導出 ========================
export { AnalyticsCore as AnalyticsService } from './services/analytics-core';
export { AnalyticsCacheService, CacheWarmer } from './services/analytics-cache-service';
export type { CacheConfig, CacheStats, CacheKeyStrategy } from './services/analytics-cache-service';
export { PeriodComparisonService } from './services/period-comparison-service';
export type {
  Period,
  ComparisonData,
  PeriodComparisonQuery,
  MultiMetricComparison
} from './services/period-comparison-service';
export { MetricsCollector } from './services/metrics-collector';
export { DashboardService } from './services/dashboard-service';
export { WidgetManager } from './services/widget-manager';
export { RealtimeDashboardService } from './services/realtime-dashboard-service';
export { LayoutService, DeviceType, LayoutMode } from './services/layout-service';
export { ReportsService } from './services/reports-service';
export { ReportSchedulerService } from './services/report-scheduler-service';

// ======================== 處理器導出 ========================
export { analyticsHandler } from './handlers/analytics-main';
export { analyticsHandler as analyticsMainHandler } from './handlers/analytics-main';
export { dashboardHandler, createDashboardHandler } from './handlers/dashboard-main';
export { realtimeDashboardHandler, createRealtimeDashboardHandler } from './handlers/realtime-dashboard-main';
export { reportsHandler, createReportsHandler } from './handlers/reports-main';
export { comparisonAPI } from './handlers/comparison-api';

// ======================== 中間件導出 ========================
export { metricsMiddleware, conversationMetricsMiddleware, agentMetricsMiddleware, createCustomMetricsCollector } from './middleware/metrics-middleware';
export { analyticsAuthMiddleware } from './middleware/analytics-auth';

// ======================== 工具函數導出 ========================
export * from './utils/calculation-helpers';

// ======================== 常數導出 ========================
export * from './constants/metrics-definitions';

// ======================== 模組配置 ========================
export interface AnalyticsModuleConfig {
  enableRealTimeMetrics: boolean;
  metricsRetentionDays: number;
  dashboardRefreshInterval: number;
  exportFormats: ('json' | 'csv' | 'pdf')[];
  aggregationLevels: ('hourly' | 'daily' | 'weekly' | 'monthly')[];
  dashboard?: {
    maxWidgetsPerDashboard?: number;
    enableRealTimeDashboard?: boolean;
    maxSSEConnections?: number;
    defaultRefreshInterval?: number;
  };
  layout?: {
    breakpoints?: {
      mobile: number;
      tablet: number;
      desktop: number;
      large: number;
    };
    defaultColumns?: {
      mobile: number;
      tablet: number;
      desktop: number;
      large: number;
    };
  };
}

export const DEFAULT_ANALYTICS_MODULE_CONFIG: AnalyticsModuleConfig = {
  enableRealTimeMetrics: true,
  metricsRetentionDays: 90,
  dashboardRefreshInterval: 5000, // 5 seconds
  exportFormats: ['json', 'csv', 'pdf'],
  aggregationLevels: ['hourly', 'daily', 'weekly', 'monthly'],
  dashboard: {
    maxWidgetsPerDashboard: 20,
    enableRealTimeDashboard: true,
    maxSSEConnections: 1000,
    defaultRefreshInterval: 30000 // 30 seconds
  },
  layout: {
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1440,
      large: Infinity
    },
    defaultColumns: {
      mobile: 1,
      tablet: 8,
      desktop: 12,
      large: 16
    }
  }
};

// ======================== 模組資訊 ========================
export const MODULE_INFO = {
  name: 'analytics',
  version: '2.0.0',
  description: '數據分析與洞察平台，提供統計分析、儀表板、實時監控和報表功能',

  features: [
    '實時數據收集與分析',
    '互動式儀表板與小工具',
    '多格式報表生成與排程',
    '響應式佈局支援',
    'SSE 實時數據推送',
    '多維度數據聚合',
    '權限控制與數據安全',
    'KPI 監控與警報',
    '數據導出與備份',
    '自定義指標計算'
  ],

  endpoints: {
    total: 32,
    implemented: 28,
    pending: 4,
    categories: {
      analytics: 8,    // metrics, stats, insights
      dashboard: 12,   // widgets, layouts, configs
      reports: 8,      // generate, schedule, export
      realtime: 4      // SSE streams, monitoring
    }
  },

  permissions: {
    admin: {
      description: '完整數據分析平台管理權限',
      actions: [
        'view_all_analytics',
        'create_dashboards',
        'manage_reports',
        'configure_metrics',
        'export_data',
        'system_monitoring'
      ]
    },
    team: {
      description: '團隊範圍數據分析權限',
      actions: [
        'view_team_analytics',
        'create_team_dashboards',
        'generate_reports',
        'export_team_data'
      ]
    },
    agent: {
      description: '基本數據查看權限',
      actions: [
        'view_personal_metrics',
        'view_assigned_analytics',
        'export_personal_data'
      ]
    }
  },

  technical: {
    database: ['analytics_events', 'dashboard_configs', 'report_schedules', 'metrics_cache'],
    cache: ['metrics_cache', 'dashboard_cache', 'report_cache'],
    dependencies: ['shared/database', 'shared/utils', 'auth', 'session'],
    middleware: ['analytics-auth', 'metrics-collection', 'rate-limiting']
  },

  status: {
    development: 'completed' as const,
    testing: 'in_progress' as const,
    deployment: 'completed' as const,
    integration: 'completed' as const
  }
} as const;

// Global type extension for analytics config
declare global {
  var __ANALYTICS_CONFIG__: AnalyticsModuleConfig | undefined;
}

// ======================== 初始化函數 ========================
export function initializeAnalyticsModule(config: Partial<AnalyticsModuleConfig> = {}) {
  const finalConfig = { ...DEFAULT_ANALYTICS_MODULE_CONFIG, ...config };

  // 驗證配置
  if (finalConfig.metricsRetentionDays < 1) {
    console.warn('⚠️ Analytics module: metricsRetentionDays must be at least 1');
    finalConfig.metricsRetentionDays = 1;
  }

  if (finalConfig.dashboardRefreshInterval < 1000) {
    console.warn('⚠️ Analytics module: dashboardRefreshInterval too short, setting to 1 second');
    finalConfig.dashboardRefreshInterval = 1000;
  }

  // 設置全局配置
  globalThis.__ANALYTICS_CONFIG__ = finalConfig;

  return {
    config: finalConfig,
    moduleInfo: MODULE_INFO
  };
}

// ======================== 向後兼容 ========================
export { analyticsHandler as default } from './handlers/analytics-main';

// Legacy exports for backward compatibility
export const defaultAnalyticsConfig = DEFAULT_ANALYTICS_MODULE_CONFIG;

export function getAnalyticsConfig(): AnalyticsModuleConfig {
  return globalThis.__ANALYTICS_CONFIG__ || DEFAULT_ANALYTICS_MODULE_CONFIG;
}