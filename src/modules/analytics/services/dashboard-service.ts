// Dashboard Service - 儀表板服務
// 提供儀表板配置管理、數據聚合和實時更新功能

import { eq, and, gte, lte, desc, asc } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '@/types';
import { AnalyticsCore } from '@modules/analytics/services/analytics-core';
import { MetricsCollector } from '@modules/analytics/services/metrics-collector';
import type {
  DashboardConfig,
  DashboardWidget,
  WidgetData,
  ChartConfig,
  DashboardPermissions,
  DashboardTemplate
} from '../types/dashboard-types';
import type {
  AnalyticsQuery,
  AnalyticsResult,
  TimeRange
} from '../types/analytics-types';
import { AnalyticsError, DataProcessingError } from '@modules/analytics/types/analytics-types';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * 儀表板服務配置選項
 */
interface DashboardServiceOptions {
  cacheEnabled?: boolean;
  cacheTTL?: number; // 緩存生存時間(秒)
  realTimeEnabled?: boolean;
  maxWidgetsPerDashboard?: number;
  refreshInterval?: number; // 實時刷新間隔(毫秒)
  enablePermissionCheck?: boolean;
}

const DEFAULT_OPTIONS: DashboardServiceOptions = {
  cacheEnabled: true,
  cacheTTL: 300, // 5分鐘
  realTimeEnabled: true,
  maxWidgetsPerDashboard: 20,
  refreshInterval: 5000, // 5秒
  enablePermissionCheck: true
};

/**
 * 儀表板服務類
 */
export class DashboardService {
  private analyticsCore: AnalyticsCore;
  private metricsCollector: MetricsCollector;
  private options: DashboardServiceOptions;
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor(
    private db: D1Database,
    private kv: Bindings['KV'],
    options: DashboardServiceOptions = {}
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Database type compatibility
    this.analyticsCore = new AnalyticsCore({ database: db as any, kv });
    this.metricsCollector = new MetricsCollector(db, kv);
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 獲取用戶儀表板配置
   */
  async getDashboardConfig(userId: string, dashboardId?: string): Promise<DashboardConfig> {
    try {
      const cacheKey = `dashboard_config_${userId}_${dashboardId || 'default'}`;

      // 檢查緩存
      if (this.options.cacheEnabled) {
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached as DashboardConfig;
      }

      // 從 KV 存儲獲取配置
      const configKey = dashboardId ? `dashboard:${userId}:${dashboardId}` : `dashboard:${userId}:default`;
      const configData = await this.kv.get(configKey, { type: 'json' });

      let config: DashboardConfig;

      if (configData) {
        config = configData as DashboardConfig;
      } else {
        // 使用默認配置
        config = await this.getDefaultDashboardConfig(userId);
        await this.saveDashboardConfig(userId, config, dashboardId);
      }

      // 緩存配置
      if (this.options.cacheEnabled) {
        this.setCachedData(cacheKey, config);
      }

      return config;
    } catch (error) {
      throw new AnalyticsError('Failed to get dashboard configuration', 'DASHBOARD_CONFIG_ERROR', 500, error);
    }
  }

  /**
   * 保存儀表板配置
   */
  async saveDashboardConfig(
    userId: string,
    config: DashboardConfig,
    dashboardId?: string
  ): Promise<void> {
    try {
      // 驗證配置
      this.validateDashboardConfig(config);

      const configKey = dashboardId ? `dashboard:${userId}:${dashboardId}` : `dashboard:${userId}:default`;

      // 更新時間戳
      config.updatedAt = nowISO();

      // 保存到 KV
      await this.kv.put(configKey, JSON.stringify(config), {
        metadata: {
          userId,
          dashboardId: dashboardId || 'default',
          lastUpdated: config.updatedAt
        }
      });

      // 清除緩存
      const cacheKey = `dashboard_config_${userId}_${dashboardId || 'default'}`;
      this.cache.delete(cacheKey);

    } catch (error) {
      throw new AnalyticsError('Failed to save dashboard configuration', 'DASHBOARD_SAVE_ERROR', 500, error);
    }
  }

  /**
   * 獲取儀表板數據
   */
  async getDashboardData(
    userId: string,
    dashboardId?: string,
    timeRange?: TimeRange
  ): Promise<Record<string, WidgetData>> {
    try {
      // 獲取儀表板配置
      const config = await this.getDashboardConfig(userId, dashboardId);

      // 檢查權限
      if (this.options.enablePermissionCheck) {
        await this.checkDashboardPermissions(userId, config);
      }

      // 並行獲取所有小工具數據
      const widgetDataPromises = config.widgets.map(async (widget) => {
        try {
          const data = await this.getWidgetData(widget, timeRange);
          return { widgetId: widget.id, data };
        } catch (error) {
          console.error(`Failed to load widget ${widget.id}:`, error);
          return {
            widgetId: widget.id,
            data: {
              type: 'error',
              error: `加載失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
              loading: false,
              widgetId: widget.id
            } as WidgetData
          };
        }
      });

      const widgetResults = await Promise.all(widgetDataPromises);

      // 轉換為對象格式
      const dashboardData: Record<string, WidgetData> = {};
      widgetResults.forEach(({ widgetId, data }) => {
        dashboardData[widgetId] = data;
      });

      return dashboardData;

    } catch (error) {
      throw new AnalyticsError('Failed to get dashboard data', 'DASHBOARD_DATA_ERROR', 500, error);
    }
  }

  /**
   * 獲取單個小工具數據
   */
  async getWidgetData(widget: DashboardWidget, timeRange?: TimeRange): Promise<WidgetData> {
    try {
      const cacheKey = `widget_data_${widget.id}_${JSON.stringify(timeRange)}`;

      // 檢查緩存
      if (this.options.cacheEnabled && !widget.realTime) {
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached as WidgetData;
      }

      let data: WidgetData;

      switch (widget.type) {
        case 'metric':
          data = await this.getMetricWidgetData(widget, timeRange);
          break;
        case 'chart':
          data = await this.getChartWidgetData(widget, timeRange);
          break;
        case 'table':
          data = await this.getTableWidgetData(widget, timeRange);
          break;
        case 'gauge':
          data = await this.getGaugeWidgetData(widget, timeRange);
          break;
        case 'progress':
          data = await this.getProgressWidgetData(widget, timeRange);
          break;
        case 'status':
          data = await this.getStatusWidgetData(widget, timeRange);
          break;
        default:
          throw new DataProcessingError(`Unsupported widget type: ${widget.type}`);
      }

      // 添加元數據
      data.metadata = {
        ...data.metadata,
        widgetId: widget.id,
        lastUpdated: nowISO(),
        refreshInterval: widget.refreshInterval || this.options.refreshInterval
      };

      // 緩存數據
      if (this.options.cacheEnabled && !widget.realTime) {
        this.setCachedData(cacheKey, data);
      }

      return data;

    } catch (error) {
      throw new DataProcessingError(`Failed to get widget data for ${widget.id}`, error);
    }
  }

  /**
   * 獲取指標小工具數據
   */
  private async getMetricWidgetData(
    widget: DashboardWidget,
    timeRange?: TimeRange
  ): Promise<WidgetData> {
    const query: AnalyticsQuery = {
      type: widget.dataSource.type || 'analytics',
      timeRange: timeRange || widget.defaultTimeRange || '24h',
      startDate: timeRange === 'custom' ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : undefined,
      endDate: timeRange === 'custom' ? nowISO() : undefined,
      metrics: [widget.metric!],
      filters: widget.filters || {}
    };

    // For now, return mock data since the query method doesn't exist
    const result = { data: [{ [widget.metric!]: 0 }] } as any;

    return {
      widgetId: widget.id,
      type: 'metric',
      data: result.data,
      loading: false,
      lastUpdate: nowISO(),
      metadata: {
        queryTime: 0,
        recordCount: result.data.length,
        cacheHit: false,
        dataSource: widget.dataSource.type || 'analytics',
        refreshedAt: nowISO()
      },
      value: result.data.length > 0 ? result.data[0][widget.metric!] : 0,
      previousValue: undefined, // TODO: 實現上期對比
      unit: widget.unit || '',
      format: widget.format || 'number',
      trend: undefined // TODO: 實現趨勢計算
    };
  }

  /**
   * 獲取圖表小工具數據
   */
  private async getChartWidgetData(
    widget: DashboardWidget,
    timeRange?: TimeRange
  ): Promise<WidgetData> {
    const query: AnalyticsQuery = {
      type: widget.dataSource.type || 'analytics',
      timeRange: timeRange || widget.defaultTimeRange || '7d',
      startDate: timeRange === 'custom' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      endDate: timeRange === 'custom' ? nowISO() : undefined,
      metrics: widget.metrics || [],
      groupBy: widget.chartConfig?.groupBy,
      filters: widget.filters || {}
    };

    // For now, return mock data since the query method doesn't exist
    const result = { data: [{ [widget.metric!]: 0 }] } as any;

    return {
      widgetId: widget.id,
      type: 'chart',
      data: result.data,
      loading: false,
      lastUpdate: nowISO(),
      metadata: {
        queryTime: 0,
        recordCount: result.data.length,
        cacheHit: false,
        dataSource: widget.dataSource.type || 'analytics',
        refreshedAt: nowISO()
      },
      chartType: widget.chartConfig?.type || 'line',
      labels: this.extractLabels(result.data, widget.chartConfig?.groupBy?.[0]),
      datasets: this.buildDatasets(result.data, widget.metrics || []),
      options: widget.chartConfig?.options || {}
    };
  }

  /**
   * 獲取表格小工具數據
   */
  private async getTableWidgetData(
    widget: DashboardWidget,
    timeRange?: TimeRange
  ): Promise<WidgetData> {
    const query: AnalyticsQuery = {
      type: widget.dataSource.type || 'analytics',
      timeRange: timeRange || widget.defaultTimeRange || '24h',
      startDate: timeRange === 'custom' ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : undefined,
      endDate: timeRange === 'custom' ? nowISO() : undefined,
      metrics: widget.metrics || [],
      filters: widget.filters || {},
      limit: widget.tableConfig?.pageSize || 10,
      orderBy: widget.tableConfig?.sortBy ? [{ field: widget.tableConfig.sortBy, direction: 'desc' as const }] : undefined
    };

    // For now, return mock data since the query method doesn't exist
    const result = { data: [{ [widget.metric!]: 0 }] } as any;

    return {
      widgetId: widget.id,
      type: 'table',
      data: result.data,
      loading: false,
      lastUpdate: nowISO(),
      metadata: {
        queryTime: 0,
        recordCount: result.data.length,
        cacheHit: false,
        dataSource: widget.dataSource.type || 'analytics',
        refreshedAt: nowISO()
      },
      columns: widget.tableConfig?.columns || this.inferColumns(result.data),
      rows: result.data,
      pagination: {
        current: 1,
        total: Math.ceil((result.total || result.data.length) / (widget.tableConfig?.pageSize || 10)),
        pageSize: widget.tableConfig?.pageSize || 10
      }
    };
  }

  /**
   * 獲取儀表小工具數據
   */
  private async getGaugeWidgetData(
    widget: DashboardWidget,
    timeRange?: TimeRange
  ): Promise<WidgetData> {
    const metricData = await this.getMetricWidgetData(widget, timeRange);

    return {
      widgetId: widget.id,
      type: 'gauge',
      data: metricData.data,
      loading: false,
      lastUpdate: nowISO(),
      metadata: metricData.metadata,
      value: metricData.value as number,
      min: widget.gaugeConfig?.min || 0,
      max: widget.gaugeConfig?.max || 100,
      unit: widget.unit || '',
      thresholds: widget.gaugeConfig?.thresholds || []
    };
  }

  /**
   * 獲取進度條小工具數據
   */
  private async getProgressWidgetData(
    widget: DashboardWidget,
    timeRange?: TimeRange
  ): Promise<WidgetData> {
    const metricData = await this.getMetricWidgetData(widget, timeRange);
    const currentValue = metricData.value as number;
    const targetValue = widget.progressConfig?.target || 100;

    return {
      widgetId: widget.id,
      type: 'progress',
      data: metricData.data,
      loading: false,
      lastUpdate: nowISO(),
      metadata: metricData.metadata,
      current: currentValue,
      target: targetValue,
      percentage: Math.min(100, (currentValue / targetValue) * 100),
      status: this.determineProgressStatus(currentValue, targetValue, widget.progressConfig?.thresholds)
    };
  }

  /**
   * 獲取狀態小工具數據
   */
  private async getStatusWidgetData(
    widget: DashboardWidget,
    timeRange?: TimeRange
  ): Promise<WidgetData> {
    const metricData = await this.getMetricWidgetData(widget, timeRange);
    const value = metricData.value as number;

    return {
      widgetId: widget.id,
      type: 'status',
      data: metricData.data,
      loading: false,
      lastUpdate: nowISO(),
      metadata: metricData.metadata,
      status: this.determineStatus(value, widget.statusConfig?.thresholds),
      value: value,
      message: widget.statusConfig?.messages || {}
    };
  }

  /**
   * 創建儀表板模板
   */
  async createDashboardTemplate(template: DashboardTemplate): Promise<void> {
    try {
      const templateKey = `dashboard_template:${template.id}`;
      await this.kv.put(templateKey, JSON.stringify(template), {
        metadata: {
          type: 'dashboard_template',
          category: template.category,
          createdAt: nowISO()
        }
      });
    } catch (error) {
      throw new AnalyticsError('Failed to create dashboard template', 'TEMPLATE_CREATE_ERROR', 500, error);
    }
  }

  /**
   * 獲取可用的儀表板模板
   */
  async getDashboardTemplates(category?: string): Promise<DashboardTemplate[]> {
    try {
      const listResult = await this.kv.list({ prefix: 'dashboard_template:' });
      const templates: DashboardTemplate[] = [];

      for (const key of listResult.keys) {
        const template = await this.kv.get(key.name, { type: 'json' }) as DashboardTemplate;
        if (!category || template.category === category) {
          templates.push(template);
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new AnalyticsError('Failed to get dashboard templates', 'TEMPLATE_GET_ERROR', 500, error);
    }
  }

  /**
   * 從模板創建儀表板
   */
  async createDashboardFromTemplate(
    userId: string,
    templateId: string,
    customConfig?: Partial<DashboardConfig>
  ): Promise<DashboardConfig> {
    try {
      const templateKey = `dashboard_template:${templateId}`;
      const template = await this.kv.get(templateKey, { type: 'json' }) as DashboardTemplate;

      if (!template) {
        throw new AnalyticsError(`Dashboard template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND', 404);
      }

      const config: DashboardConfig = {
        id: `${templateId}_${nowMs()}`,
        name: customConfig?.name || template.name,
        description: template.description,
        layout: template.defaultLayout,
        widgets: template.widgets,
        permissions: {
          owner: userId,
          viewers: [],
          editors: []
        },
        theme: customConfig?.theme || 'light',
        autoRefresh: customConfig?.autoRefresh ?? true,
        refreshInterval: customConfig?.refreshInterval || this.options.refreshInterval!,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        ...customConfig
      };

      await this.saveDashboardConfig(userId, config);
      return config;

    } catch (error) {
      throw new AnalyticsError('Failed to create dashboard from template', 'TEMPLATE_DASHBOARD_CREATE_ERROR', 500, error);
    }
  }

  /**
   * 實時數據更新訂閱
   */
  async subscribeToRealTimeUpdates(
    userId: string,
    dashboardId: string,
    callback: (data: Record<string, WidgetData>) => void
  ): Promise<() => void> {
    if (!this.options.realTimeEnabled) {
      throw new AnalyticsError('Real-time updates are disabled', 'REALTIME_DISABLED', 400);
    }

    const config = await this.getDashboardConfig(userId, dashboardId);
    const realTimeWidgets = config.widgets.filter(w => w.realTime);

    if (realTimeWidgets.length === 0) {
      throw new AnalyticsError('No real-time widgets found in dashboard', 'NO_REALTIME_WIDGETS', 400);
    }

    // Phase 2: Real-time analytics via existing WebSocket infrastructure
    // 這裡先返回一個模擬的取消函數
    const intervalId = setInterval(async () => {
      try {
        const data = await this.getDashboardData(userId, dashboardId);
        callback(data);
      } catch (error) {
        console.error('Failed to update real-time dashboard data:', error);
      }
    }, this.options.refreshInterval);

    return () => clearInterval(intervalId);
  }

  // 私有輔助方法

  private async getDefaultDashboardConfig(userId: string): Promise<DashboardConfig> {
    return {
      id: 'default',
      name: '默認儀表板',
      description: '系統默認儀表板配置',
      layout: {
        type: 'grid',
        columns: 12,
        rows: 'auto',
        gap: 16
      },
      widgets: [
        {
          id: 'total_conversations',
          type: 'metric',
          title: '總對話數',
          config: {
            showTitle: true,
            showDescription: false,
            showLegend: false,
            showToolbar: false,
            realTime: true,
            refreshInterval: 5000,
            maxDataPoints: 100,
            theme: 'light' as const,
            colors: ['#1890ff'],
            animation: true
          },
          dataSource: { type: 'conversation', query: '', config: {} },
          metric: 'total_conversations',
          position: { x: 0, y: 0, width: 3, height: 2 },
          realTime: true
        },
        {
          id: 'active_conversations',
          type: 'metric',
          title: '活躍對話',
          config: {
            showTitle: true,
            showDescription: false,
            showLegend: false,
            showToolbar: false,
            realTime: true,
            refreshInterval: 5000,
            maxDataPoints: 100,
            theme: 'light' as const,
            colors: ['#1890ff'],
            animation: true
          },
          dataSource: { type: 'conversation', query: '', config: {} },
          metric: 'active_conversations',
          position: { x: 3, y: 0, width: 3, height: 2 },
          realTime: true
        },
        {
          id: 'response_time_chart',
          type: 'chart',
          title: '響應時間趨勢',
          config: {
            showTitle: true,
            showDescription: false,
            showLegend: false,
            showToolbar: false,
            realTime: true,
            refreshInterval: 5000,
            maxDataPoints: 100,
            theme: 'light' as const,
            colors: ['#1890ff'],
            animation: true
          },
          dataSource: { type: 'conversation', query: '', config: {} },
          metrics: ['response_time_avg'],
          chartConfig: {
            type: 'line',
            groupBy: ['time']
          },
          position: { x: 0, y: 2, width: 6, height: 4 },
          realTime: false
        }
      ],
      permissions: {
        owner: userId,
        viewers: [],
        editors: []
      },
      theme: 'light',
      autoRefresh: true,
      refreshInterval: 30000,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
  }

  private validateDashboardConfig(config: DashboardConfig): void {
    if (!config.id || !config.name) {
      throw new AnalyticsError('Dashboard ID and name are required', 'MISSING_REQUIRED_FIELDS', 400);
    }

    if (config.widgets.length > this.options.maxWidgetsPerDashboard!) {
      throw new AnalyticsError(`Too many widgets. Maximum allowed: ${this.options.maxWidgetsPerDashboard}`, 'TOO_MANY_WIDGETS', 400);
    }

    // 驗證小工具配置
    config.widgets.forEach(widget => {
      if (!widget.id || !widget.type || !widget.title) {
        throw new AnalyticsError('Widget ID, type, and title are required', 'MISSING_WIDGET_FIELDS', 400);
      }
    });
  }

  private async checkDashboardPermissions(userId: string, config: DashboardConfig): Promise<void> {
    const permissions = config.permissions;
    const hasAccess = permissions.owner === userId ||
                     permissions.viewers.includes(userId) ||
                     permissions.editors.includes(userId);

    if (!hasAccess) {
      throw new AnalyticsError('Insufficient permissions to access dashboard', 'INSUFFICIENT_PERMISSIONS', 403);
    }
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttlMs = this.options.cacheTTL! * 1000;
    if (Date.now() - cached.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: nowMs()
    });
  }

  private extractLabels(data: any[], groupBy?: string): string[] {
    if (!groupBy || data.length === 0) return [];
    return data.map(item => item[groupBy]).filter((value, index, self) => self.indexOf(value) === index);
  }

  private buildDatasets(data: any[], metrics: string[]): any[] {
    return metrics.map(metric => ({
      label: metric,
      data: data.map(item => item[metric] || 0)
    }));
  }

  private inferColumns(data: any[]): Array<{ key: string; title: string; type: string }> {
    if (data.length === 0) return [];

    const firstRow = data[0];
    return Object.keys(firstRow).map(key => ({
      key,
      title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: typeof firstRow[key]
    }));
  }

  private determineProgressStatus(
    current: number,
    target: number,
    thresholds?: Array<{ value: number; status: string }>
  ): string {
    const percentage = (current / target) * 100;

    if (thresholds) {
      for (const threshold of thresholds.sort((a, b) => b.value - a.value)) {
        if (percentage >= threshold.value) {
          return threshold.status;
        }
      }
    }

    if (percentage >= 100) return 'success';
    if (percentage >= 75) return 'warning';
    return 'danger';
  }

  private determineStatus(value: number, thresholds?: Array<{ min?: number; max?: number; status: string }>): string {
    if (!thresholds) return 'unknown';

    for (const threshold of thresholds) {
      const minCheck = threshold.min === undefined || value >= threshold.min;
      const maxCheck = threshold.max === undefined || value <= threshold.max;

      if (minCheck && maxCheck) {
        return threshold.status;
      }
    }

    return 'unknown';
  }
}

export default DashboardService;