// Dashboard Types - 儀表板相關類型定義

import type { TimeSeriesData, DistributionData, ComparisonData } from '@modules/analytics/types/analytics-types';
import type { Metric, AggregatedMetric } from '@modules/analytics/types/metrics-types';

// ======================== 基礎數據類型 ========================

/**
 * 圖表數據集項目
 */
export interface DatasetItem {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

/**
 * 基礎列定義 (用於簡單場景)
 */
export interface BaseColumn {
  key: string;
  label?: string;
  title?: string;
  id?: string;
  dataIndex?: string;
  type?: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  format?: string;
}

/**
 * 表格行數據
 */
export interface TableRow {
  id: string | number;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * 閾值配置 (兼容 GaugeThreshold)
 */
export interface ThresholdConfig {
  value: number;
  status?: 'success' | 'warning' | 'danger' | 'info';
  label?: string;
  color?: string;
}

/**
 * 分頁狀態 (用於數據響應)
 */
export interface PaginationState {
  page?: number;
  current?: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

/**
 * 趨勢數據
 */
export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  value: number;
  percentage?: number;
  period?: string;
}

/**
 * 狀態消息 (結構化格式)
 */
export interface StatusMessage {
  type: 'success' | 'warning' | 'error' | 'info';
  text: string;
  timestamp?: string;
}

/**
 * 狀態消息映射 (簡化格式：status -> message)
 */
export type StatusMessages = Record<string, StatusMessage | string>;

/**
 * 圖表選項
 */
export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: Record<string, unknown>;
  scales?: Record<string, unknown>;
  animation?: boolean | Record<string, unknown>;
}

/**
 * 小部件查詢配置
 */
export interface WidgetQuery {
  type: string;
  metrics?: string[];
  filters?: Record<string, string | number | boolean>;
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
  timeRange?: string;
}

/**
 * 儀表板配置
 */
export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  refreshInterval?: number; // 秒 - 可選屬性
  autoRefresh?: boolean;
  permissions: DashboardPermissions;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags?: string[];
  theme?: Theme;
}

/**
 * 儀表板布局
 */
export interface DashboardLayout {
  type: 'grid' | 'flex' | 'absolute' | 'responsive';
  columns?: number;
  rows?: number | 'auto';
  gap?: number;
  padding?: number;
  margin?: number;
  responsive?: boolean;
  breakpoints?: ResponsiveBreakpoints;
}

/**
 * 響應式斷點配置
 */
export interface ResponsiveBreakpoints {
  mobile: number;    // < 768px
  tablet: number;    // 768px - 1024px
  desktop: number;   // 1024px - 1440px
  large: number;     // > 1440px
}

/**
 * 儀表板權限
 */
export interface DashboardPermissions {
  owner: string;    // 擁有者用戶ID
  viewers: string[]; // 觀看者用戶ID
  editors: string[]; // 編輯者用戶ID
}

/**
 * 儀表板小部件
 */
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  position: WidgetPosition;
  size?: WidgetSize;
  config: WidgetConfig;
  dataSource: WidgetDataSource;
  styling?: WidgetStyling;
  interactions?: WidgetInteractions;

  // 快捷屬性 (從 config 中提取)
  realTime?: boolean;
  refreshInterval?: number;
  defaultTimeRange?: TimeRange;
  metric?: string;
  metrics?: string[];
  filters?: Record<string, string | number | boolean>;
  unit?: string;
  format?: string;
  chartConfig?: ChartConfig;
  tableConfig?: TableConfig;
  gaugeConfig?: GaugeConfig;
  progressConfig?: { target?: number; thresholds?: Array<{ value: number; status: string }> };
  statusConfig?: { thresholds?: Array<{ min?: number; max?: number; status: string }>; messages?: StatusMessages };
  query?: WidgetQuery;
}

/**
 * 小部件類型
 */
export type WidgetType =
  | 'metric'           // 單一指標顯示
  | 'chart'            // 圖表
  | 'table'            // 表格
  | 'gauge'            // 儀表盤
  | 'progress'         // 進度條
  | 'status'           // 狀態指示器
  | 'timeline'         // 時間軸
  | 'heatmap'          // 熱力圖
  | 'wordcloud'        // 詞雲
  | 'map'              // 地圖
  | 'alert'            // 警報
  | 'text'             // 文字
  | 'image'            // 圖片
  | 'iframe'           // 嵌入式
  | 'custom';          // 自定義

/**
 * 小部件位置
 */
export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number; // 層級
}

/**
 * 小部件尺寸
 */
export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * 小部件配置
 */
export interface WidgetConfig {
  // 通用配置
  showTitle: boolean;
  showDescription: boolean;
  showLegend: boolean;
  showToolbar: boolean;

  // 數據配置
  realTime: boolean;
  refreshInterval: number;
  maxDataPoints: number;
  aggregation?: string;
  defaultTimeRange?: TimeRange;

  // 顯示配置
  theme: WidgetTheme;
  colors: string[];
  animation: boolean;

  // 特定配置（根據 widget type）
  chartConfig?: ChartConfig;
  tableConfig?: TableConfig;
  gaugeConfig?: GaugeConfig;
  alertConfig?: AlertConfig;

  // 額外的 widget 屬性
  metric?: string;
  metrics?: string[];
  filters?: Record<string, string | number | boolean>;
  unit?: string;
  format?: string;
  query?: WidgetQuery;
}

/**
 * 圖表配置
 */
export interface ChartConfig {
  type: ChartType;
  axes?: AxisConfig[];
  series?: SeriesConfig[];
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  responsive?: boolean;
  zoom?: ZoomConfig;
  brush?: BrushConfig;
  groupBy?: string[];
  options?: ChartOptions;
}

/**
 * 圖表類型
 */
export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'column'
  | 'pie'
  | 'doughnut'
  | 'scatter'
  | 'bubble'
  | 'candlestick'
  | 'heatmap'
  | 'treemap'
  | 'funnel'
  | 'radar'
  | 'sankey';

/**
 * 軸配置
 */
export interface AxisConfig {
  id: string;
  type: 'category' | 'value' | 'time';
  position: 'top' | 'bottom' | 'left' | 'right';
  title?: string;
  min?: number;
  max?: number;
  format?: string;
  gridLines: boolean;
  tickMarks: boolean;
}

/**
 * 系列配置
 */
export interface SeriesConfig {
  id: string;
  name: string;
  type: ChartType;
  data: string; // 數據字段路徑
  xAxis?: string;
  yAxis?: string;
  color?: string;
  lineWidth?: number;
  fillOpacity?: number;
  smooth?: boolean;
  stack?: string;
}

/**
 * 圖例配置
 */
export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  align: 'start' | 'center' | 'end';
  orientation: 'horizontal' | 'vertical';
  itemGap: number;
}

/**
 * 提示框配置
 */
export interface TooltipConfig {
  show: boolean;
  trigger: 'axis' | 'item';
  format?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

/**
 * 縮放配置
 */
export interface ZoomConfig {
  enabled: boolean;
  type: 'x' | 'y' | 'xy';
  mode: 'pan' | 'zoom' | 'select';
}

/**
 * 刷選配置
 */
export interface BrushConfig {
  enabled: boolean;
  type: 'rect' | 'polygon' | 'lineX' | 'lineY';
}

/**
 * 表格配置
 */
export interface TableConfig {
  columns: TableColumn[];
  pagination: PaginationConfig;
  sorting: SortingConfig;
  filtering: FilteringConfig;
  selection: SelectionConfig;
  sortable?: boolean;
  export: ExportConfig;
  pageSize?: number;
  sortBy?: string;
}

/**
 * 表格列配置
 */
export interface TableColumn {
  key?: string;
  id?: string;
  title?: string;
  dataIndex?: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  format?: string;
  type?: string;
  render?: string; // 自定義渲染函數
}

/**
 * 分頁配置
 */
export interface PaginationConfig {
  enabled: boolean;
  pageSize: number;
  showSizeChanger: boolean;
  showQuickJumper: boolean;
  showTotal: boolean;
}

/**
 * 排序配置
 */
export interface SortingConfig {
  enabled: boolean;
  multiple: boolean;
  defaultSort?: { field: string; order: 'asc' | 'desc' }[];
}

/**
 * 篩選配置
 */
export interface FilteringConfig {
  enabled: boolean;
  mode: 'menu' | 'search' | 'custom';
  operators: FilterOperator[];
}

export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';

/**
 * 選擇配置
 */
export interface SelectionConfig {
  enabled: boolean;
  mode: 'single' | 'multiple';
  checkboxSelection: boolean;
  rowClick: boolean;
}

/**
 * 導出配置
 */
export interface ExportConfig {
  enabled: boolean;
  formats: ('csv' | 'xlsx' | 'pdf' | 'json')[];
  includeHeaders: boolean;
  includeSelection: boolean;
}

/**
 * 儀表盤配置
 */
export interface GaugeConfig {
  min: number;
  max: number;
  unit?: string;
  thresholds: GaugeThreshold[];
  showValue: boolean;
  showPointer: boolean;
  arcWidth: number;
}

/**
 * 儀表盤閾值
 */
export interface GaugeThreshold {
  value: number;
  color: string;
  label?: string;
}

/**
 * 警報配置
 */
export interface AlertConfig {
  severity: 'info' | 'warning' | 'error' | 'success';
  showIcon: boolean;
  closable: boolean;
  autoClose: boolean;
  duration: number; // 秒
}

/**
 * 小部件數據源
 */
/**
 * 參數值類型
 */
export type ParameterValue = string | number | boolean | null | string[] | number[];

export interface WidgetDataSource {
  type: DataSourceType;
  config: DataSourceConfig;
  query: string;
  parameters?: Record<string, ParameterValue>;
  cache?: CacheConfig;
}

/**
 * 數據源類型
 */
export type DataSourceType =
  | 'analytics'     // Analytics API
  | 'metrics'       // Metrics API
  | 'database'      // 直接數據庫查詢
  | 'api'           // 外部 API
  | 'static'        // 靜態數據
  | 'realtime'      // 實時數據流
  | 'conversation'  // 對話數據
  | 'message'       // 消息數據
  | 'user';         // 用戶數據

/**
 * 數據源配置
 */
export interface DataSourceConfig {
  endpoint?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  transform?: string; // 數據轉換函數
}

/**
 * 緩存配置
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // 秒
  key?: string;
  invalidateOn?: string[];
}

/**
 * 小部件樣式
 */
export interface WidgetStyling {
  theme: WidgetTheme;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  shadow?: boolean;
  opacity?: number;
  customCSS?: string;
}

/**
 * 小部件主題
 */
export type WidgetTheme = 'light' | 'dark' | 'auto' | 'custom';

/**
 * 主題配置
 */
export type Theme = 'light' | 'dark';

/**
 * 小部件交互
 */
export interface WidgetInteractions {
  clickable: boolean;
  hoverable: boolean;
  draggable: boolean;
  resizable: boolean;
  onClick?: WidgetAction;
  onHover?: WidgetAction;
  onDoubleClick?: WidgetAction;
  onContextMenu?: WidgetAction;
}

/**
 * 小部件動作
 */
export interface WidgetAction {
  type: WidgetActionType;
  config: WidgetActionConfig;
}

export type WidgetActionType =
  | 'navigate'      // 導航到其他頁面
  | 'filter'        // 設置過濾器
  | 'drill_down'    // 向下鑽取
  | 'drill_up'      // 向上鑽取
  | 'export'        // 導出數據
  | 'alert'         // 觸發警報
  | 'custom';       // 自定義動作

/**
 * 小部件動作配置
 */
export interface WidgetActionConfig {
  target?: string;
  parameters?: Record<string, ParameterValue>;
  script?: string;
  confirmation?: boolean;
  confirmationMessage?: string;
}

/**
 * 儀表板數據
 */
export interface DashboardData {
  widgets: WidgetData[];
  metadata: DashboardMetadata;
  realTimeUpdates?: RealtimeUpdate[];
}

/**
 * 小部件數據
 */
export interface WidgetData {
  widgetId: string;
  type: string;
  data: TimeSeriesData[] | DistributionData[] | ComparisonData[] | Record<string, unknown>;
  error?: string;
  loading: boolean;
  lastUpdate: string;
  metadata: WidgetMetadata;

  // 數據字段
  value?: number | string;
  labels?: string[];
  datasets?: DatasetItem[];
  columns?: TableColumn[];
  rows?: TableRow[];
  options?: ChartOptions;

  // 特定類型的數據字段
  previousValue?: number | string;
  unit?: string;
  format?: string;
  trend?: TrendData;
  chartType?: string;
  pagination?: PaginationState;
  current?: number;
  target?: number;
  percentage?: number;
  status?: string;
  min?: number;
  max?: number;
  thresholds?: ThresholdConfig[];
  message?: StatusMessages;
}

/**
 * 小部件元數據
 */
export interface WidgetMetadata {
  widgetId?: string;
  queryTime: number;
  recordCount: number;
  cacheHit: boolean;
  dataSource: string;
  refreshedAt: string;
  lastUpdated?: string;
  refreshInterval?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * 儀表板元數據
 */
export interface DashboardMetadata {
  totalWidgets: number;
  loadingWidgets: number;
  errorWidgets: number;
  lastRefresh: string;
  nextRefresh: string;
  totalQueryTime: number;
}

/**
 * 實時更新
 */
export interface RealtimeUpdate {
  widgetId: string;
  data: TimeSeriesData[] | DistributionData[] | Record<string, unknown>;
  timestamp: string;
  type: 'full' | 'partial' | 'append' | 'prepend';
}

/**
 * 儀表板模板
 */
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  config: DashboardConfig;
  defaultLayout: DashboardLayout;
  widgets: DashboardWidget[];
  previewImage?: string;
  author: string;
  version: string;
  created: string;
  updated: string;
  downloads: number;
  rating: number;
}

/**
 * 小工具模板
 */
export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  config: DashboardWidget;
  previewImage?: string;
  tags: string[];
  author: string;
  created: string;
}

/**
 * 小工具驗證規則
 */
export interface WidgetValidation {
  rules: Array<{
    field: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    allowedValues?: (string | number | boolean)[];
    min?: number;
    max?: number;
  }>;
}

/**
 * 佈局配置
 */
export interface LayoutConfig {
  type: 'grid' | 'flex' | 'absolute' | 'responsive';
  columns: number;
  gap: number;
  margin: number;
  containerWidth: number;
  containerHeight: number;
  responsive: boolean;
  breakpoints: ResponsiveBreakpoints;
}


/**
 * 時間範圍接口
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * 時間範圍類型 (從 analytics-types 重新導出)
 */
export type TimeRange =
  | '1h' | '6h' | '12h' | '24h'
  | '3d' | '7d' | '14d' | '30d'
  | '90d' | '1y' | 'custom';

/**
 * 儀表板快照
 */
export interface DashboardSnapshot {
  id: string;
  dashboardId: string;
  name: string;
  description?: string;
  data: DashboardData;
  config: DashboardConfig;
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
}

/**
 * 儀表板分享配置
 */
export interface DashboardShare {
  id: string;
  dashboardId: string;
  shareType: 'public' | 'private' | 'password';
  password?: string;
  permissions: ('view' | 'interact' | 'export')[];
  expiresAt?: string;
  accessCount: number;
  lastAccessed?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * 儀表板導出設定
 */
export interface DashboardExport {
  format: 'pdf' | 'png' | 'jpeg' | 'svg' | 'html';
  orientation: 'portrait' | 'landscape';
  size: 'A4' | 'A3' | 'letter' | 'custom';
  quality: 'low' | 'medium' | 'high';
  includeData: boolean;
  includeInteractions: boolean;
  customSize?: { width: number; height: number };
}

/**
 * 預定義儀表板類型
 */
export const DASHBOARD_TEMPLATES = {
  OVERVIEW: 'overview',
  PERFORMANCE: 'performance',
  OPERATIONS: 'operations',
  BUSINESS: 'business',
  TECHNICAL: 'technical',
  EXECUTIVE: 'executive',
} as const;

/**
 * 預定義小部件配置
 */
export const WIDGET_PRESETS = {
  ACTIVE_CONVERSATIONS: {
    type: 'metric' as const,
    title: 'Active Conversations',
    dataSource: {
      type: 'analytics' as const,
      query: 'conversation.active'
    }
  },
  RESPONSE_TIME_CHART: {
    type: 'chart' as const,
    title: 'Response Time Trend',
    config: {
      chartConfig: {
        type: 'line' as const,
        axes: [
          { id: 'x', type: 'time' as const, position: 'bottom' as const },
          { id: 'y', type: 'value' as const, position: 'left' as const }
        ]
      }
    }
  },
  AGENT_PERFORMANCE_TABLE: {
    type: 'table' as const,
    title: 'Agent Performance',
    config: {
      tableConfig: {
        columns: [
          { id: 'name', title: 'Agent Name', dataIndex: 'name' },
          { id: 'conversations', title: 'Conversations', dataIndex: 'conversations' },
          { id: 'responseTime', title: 'Avg Response Time', dataIndex: 'responseTime' },
          { id: 'satisfaction', title: 'Satisfaction', dataIndex: 'satisfaction' }
        ]
      }
    }
  }
} as const;