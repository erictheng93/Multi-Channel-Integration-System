// Dashboard Service - 儀表板服務
// 提供儀表板配置管理、數據聚合和實時更新功能

import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '@/types';
import type {
  DashboardConfig,
  DashboardWidget,
  WidgetData,
  DashboardTemplate,
  TableRow
} from '../types/dashboard-types';
import type {
  AnalyticsFilters,
  ConversationAnalytics,
  ConversationAnalyticsQuery,
  MessageAnalytics,
  MessageAnalyticsQuery,
  PerformanceAnalytics,
  PerformanceAnalyticsQuery,
  TimeRange,
  TimeSeriesData,
  UserAnalytics,
  UserAnalyticsQuery
} from '../types/analytics-types';
import { AnalyticsError, DataProcessingError } from '@modules/analytics/types/analytics-types';
import { calculatePreviousPeriod } from '@modules/analytics/services/analytics-aggregation';
import { AnalyticsService } from './analytics-core';
import { createDbClient } from '@/db/drizzle-factory';
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('DashboardService')

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

type DashboardAnalyticsData =
  | ConversationAnalytics
  | MessageAnalytics
  | UserAnalytics
  | PerformanceAnalytics;

interface AnalyticsTimeWindow {
  startDate: string;
  endDate: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function toTableCellValue(value: unknown): TableRow[string] {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  return JSON.stringify(value);
}

/**
 * 儀表板服務類
 */
export class DashboardService {
  private options: DashboardServiceOptions;
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private analytics: AnalyticsService;

  constructor(
    db: D1Database,
    private kv: Bindings['KV'],
    options: DashboardServiceOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.analytics = new AnalyticsService({ database: createDbClient(db), kv });
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
          log.error(`Failed to load widget ${widget.id}`, {}, error as Error);
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
  private async getMetricWidgetData(widget: DashboardWidget, timeRange?: TimeRange): Promise<WidgetData> {
    const t0 = nowMs();
    const resolvedTimeRange = timeRange || widget.defaultTimeRange || '7d';
    const data = await this.queryAnalytics(widget, resolvedTimeRange);
    const qt = nowMs() - t0;
    const key = widget.metric || 'totalConversations';
    const value = this.extractValue(data, key);
    let previousValue: number | undefined;
    let trend: WidgetData['trend'];
    try {
      const { previousPeriod } = calculatePreviousPeriod(resolvedTimeRange);
      const prev = await this.queryAnalytics(widget, 'custom', {
        startDate: previousPeriod.start,
        endDate: previousPeriod.end
      });
      previousValue = this.extractValue(prev, key);
      if (previousValue && previousValue > 0) {
        const pct = Math.round(((value - previousValue) / previousValue) * 100);
        trend = { direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'stable', value: value - previousValue, percentage: Math.abs(pct), period: 'previous' };
      }
    } catch { /* best-effort */ }
    return {
      widgetId: widget.id, type: 'metric', data: this.toWidgetData(data), loading: false, lastUpdate: nowISO(),
      metadata: { queryTime: qt, recordCount: 1, cacheHit: false, dataSource: widget.dataSource.type || 'analytics', refreshedAt: nowISO() },
      value, previousValue, unit: widget.unit || '', format: widget.format || 'number', trend
    };
  }

  private async getChartWidgetData(widget: DashboardWidget, timeRange?: TimeRange): Promise<WidgetData> {
    const t0 = nowMs();
    const data = await this.queryAnalytics(widget, timeRange);
    const qt = nowMs() - t0;
    const trends = this.getTimeSeriesRows(data);
    const src = trends.length > 0 ? trends.map(toRecord) : (data ? [toRecord(data)] : []);
    const labels = this.extractLabels(src, widget.chartConfig?.groupBy?.[0]);
    const datasets = this.buildDatasets(src, widget.metrics || (widget.metric ? [widget.metric] : []));
    return {
      widgetId: widget.id, type: 'chart', data: this.toWidgetData(data), loading: false, lastUpdate: nowISO(),
      metadata: { queryTime: qt, recordCount: trends.length || 1, cacheHit: false, dataSource: widget.dataSource.type || 'analytics', refreshedAt: nowISO() },
      chartType: widget.chartConfig?.type || 'line', labels, datasets, options: widget.chartConfig?.options || {}
    };
  }

  private async getTableWidgetData(widget: DashboardWidget, timeRange?: TimeRange): Promise<WidgetData> {
    const t0 = nowMs();
    const data = await this.queryAnalytics(widget, timeRange);
    const qt = nowMs() - t0;
    const rows = this.getTableRows(data).map((row, index) => this.toTableRow(row, index));
    const ps = widget.tableConfig?.pageSize || 10;
    return {
      widgetId: widget.id, type: 'table', data: this.toWidgetData(data), loading: false, lastUpdate: nowISO(),
      metadata: { queryTime: qt, recordCount: rows.length, cacheHit: false, dataSource: widget.dataSource.type || 'analytics', refreshedAt: nowISO() },
      columns: widget.tableConfig?.columns || this.inferColumns(rows),
      rows: rows.slice(0, ps),
      pagination: { current: 1, total: Math.ceil(rows.length / ps), pageSize: ps }
    };
  }

  /** Route widget config to the correct AnalyticsService query method */
  private async queryAnalytics(widget: DashboardWidget, timeRange?: TimeRange, window?: AnalyticsTimeWindow): Promise<DashboardAnalyticsData | null> {
    const filters = widget.filters as AnalyticsFilters | undefined;
    const baseQuery = {
      timeRange: timeRange || widget.defaultTimeRange || '7d',
      startDate: window?.startDate,
      endDate: window?.endDate,
      filters
    };
    const key = widget.metric || widget.dataSource.query || '';
    try {
      if (key.toLowerCase().includes('conversation')) { const r = await this.analytics.getConversationAnalytics(baseQuery as ConversationAnalyticsQuery); return r.success ? r.data || null : null; }
      if (key.toLowerCase().includes('message')) { const r = await this.analytics.getMessageAnalytics(baseQuery as MessageAnalyticsQuery); return r.success ? r.data || null : null; }
      if (key.toLowerCase().includes('user') || key.toLowerCase().includes('agent')) { const r = await this.analytics.getUserAnalytics(baseQuery as UserAnalyticsQuery); return r.success ? r.data || null : null; }
      if (key.toLowerCase().includes('performance') || key.toLowerCase().includes('response')) { const r = await this.analytics.getPerformanceAnalytics(baseQuery as PerformanceAnalyticsQuery); return r.success ? r.data || null : null; }
      const r = await this.analytics.getConversationAnalytics(baseQuery as ConversationAnalyticsQuery);
      return r.success ? r.data || null : null;
    } catch { return null; }
  }

  /** Extract a numeric value from analytics result by searching summary + top-level + one level deep */
  private extractValue(data: DashboardAnalyticsData | null, key: string): number {
    if (!data) return 0;
    const record = toRecord(data);
    if (isRecord(record.summary) && record.summary[key] !== undefined) {
      return Number(record.summary[key]) || 0;
    }
    if (record[key] !== undefined) return Number(record[key]) || 0;
    for (const value of Object.values(record)) {
      if (isRecord(value) && value[key] !== undefined) {
        return Number(value[key]) || 0;
      }
    }
    return 0;
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
   * Legacy compatibility hook for callers that still expect an unsubscribe
   * callback from DashboardService.
   *
   * @deprecated Use the realtime dashboard subscription endpoint and WebSocket
   * channel subscription flow instead. This method does not attach a producer or
   * client transport by itself.
   */
  async subscribeToRealTimeUpdates(
    userId: string,
    dashboardId: string,
    _callback: (data: Record<string, WidgetData>) => void
  ): Promise<() => void> {
    if (!this.options.realTimeEnabled) {
      throw new AnalyticsError('Real-time updates are disabled', 'REALTIME_DISABLED', 400);
    }

    const config = await this.getDashboardConfig(userId, dashboardId);
    const realTimeWidgets = config.widgets.filter(w => w.realTime);

    if (realTimeWidgets.length === 0) {
      throw new AnalyticsError('No real-time widgets found in dashboard', 'NO_REALTIME_WIDGETS', 400);
    }

    log.info('Legacy realtime dashboard subscription compatibility hook invoked', {
      userId,
      dashboardId,
      widgetCount: realTimeWidgets.length
    });

    return () => {
      log.info('Legacy realtime dashboard subscription compatibility hook released', {
        userId,
        dashboardId
      });
    };
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

  private getCachedData(key: string): unknown | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttlMs = this.options.cacheTTL! * 1000;
    if (Date.now() - cached.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: nowMs()
    });
  }

  private toWidgetData(data: DashboardAnalyticsData | null): WidgetData['data'] {
    return data ? toRecord(data) : {};
  }

  private getTimeSeriesRows(data: DashboardAnalyticsData | null): TimeSeriesData[] {
    if (!data) return [];
    if ('trends' in data) return data.trends;
    if ('volume' in data) return data.volume;
    if ('activity' in data) return data.activity;
    return [];
  }

  private getTableRows(data: DashboardAnalyticsData | null): Record<string, unknown>[] {
    if (!data) return [];

    const record = toRecord(data);
    const preferredRowKeys = [
      'distributions',
      'types',
      'channels',
      'sentiments',
      'activity',
      'trends',
      'volume',
      'performance',
      'workload',
      'bottlenecks',
      'recommendations'
    ];

    for (const key of preferredRowKeys) {
      const value = record[key];
      if (Array.isArray(value)) {
        const rows = value.filter(isRecord);
        if (rows.length > 0) return rows;
      }
    }

    return [record];
  }

  private toTableRow(row: Record<string, unknown>, index: number): TableRow {
    const id = typeof row.id === 'string' || typeof row.id === 'number' ? row.id : index;
    const tableRow: TableRow = { id };

    Object.entries(row).forEach(([key, value]) => {
      tableRow[key] = toTableCellValue(value);
    });

    return tableRow;
  }

  private extractLabels(data: Record<string, unknown>[], groupBy?: string): string[] {
    if (!groupBy || data.length === 0) return [];
    return data
      .map(item => item[groupBy])
      .filter((value, index, self) => value !== undefined && self.indexOf(value) === index)
      .map(value => String(value));
  }

  private buildDatasets(data: Record<string, unknown>[], metrics: string[]) {
    return metrics.map(metric => ({
      label: metric,
      data: data.map(item => Number(item[metric]) || 0)
    }));
  }

  private inferColumns(data: TableRow[]): Array<{ key: string; title: string; type: string }> {
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
