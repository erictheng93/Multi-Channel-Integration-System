// Reports System Types - 報表系統類型定義
// 定義統一報表生成、模板管理和分發相關的類型

import type { TimeRange as DashboardTimeRange } from '@modules/analytics/types/dashboard-types';

/**
 * 報表配置
 */
export interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  templateId: string;
  dataSource: ReportDataSource;
  parameters: Record<string, any>;
  format: ReportFormat[];
  schedule?: ReportSchedule;
  distribution?: ReportDistribution;
  permissions: ReportPermissions;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastGenerated?: string;
  status: ReportStatus;
}

/**
 * 報表模板
 */
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  layout: ReportLayout;
  sections: ReportSection[];
  variables: ReportVariable[];
  styling: ReportStyling;
  metadata: ReportTemplateMetadata;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  isPublic: boolean;
  tags: string[];
}

/**
 * 報表數據源
 */
export interface ReportDataSource {
  type: DataSourceType;
  query: string;
  parameters?: Record<string, any>;
  timeRange?: DashboardTimeRange;
  filters?: Record<string, any>;
  aggregations?: DataAggregation[];
  joins?: DataJoin[];
  transformations?: DataTransformation[];
}

/**
 * 數據源類型
 */
export enum DataSourceType {
  Analytics = 'analytics',
  Dashboard = 'dashboard',
  Database = 'database',
  API = 'api',
  File = 'file',
  MultiSource = 'multi_source'
}

/**
 * 報表格式
 */
export enum ReportFormat {
  PDF = 'pdf',
  Excel = 'excel',
  CSV = 'csv',
  JSON = 'json',
  HTML = 'html',
  PowerBI = 'powerbi',
  Tableau = 'tableau',
  Image = 'image'
}

/**
 * 報表類別
 */
export enum ReportCategory {
  Executive = 'executive',
  Operational = 'operational',
  Financial = 'financial',
  Performance = 'performance',
  Analytics = 'analytics',
  Compliance = 'compliance',
  Custom = 'custom'
}

/**
 * 報表狀態
 */
export enum ReportStatus {
  Draft = 'draft',
  Active = 'active',
  Scheduled = 'scheduled',
  Generating = 'generating',
  Generated = 'generated',
  Failed = 'failed',
  Archived = 'archived'
}

/**
 * 報表佈局
 */
export interface ReportLayout {
  type: 'portrait' | 'landscape';
  size: 'A4' | 'A3' | 'letter' | 'legal' | 'custom';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  header?: ReportHeader;
  footer?: ReportFooter;
  pageNumbers: boolean;
  watermark?: ReportWatermark;
}

/**
 * 報表區段
 */
export interface ReportSection {
  id: string;
  type: SectionType;
  title?: string;
  content: SectionContent;
  styling?: SectionStyling;
  conditions?: RenderCondition[];
  order: number;
}

/**
 * 區段類型
 */
export enum SectionType {
  Title = 'title',
  Summary = 'summary',
  Chart = 'chart',
  Table = 'table',
  Text = 'text',
  Image = 'image',
  PageBreak = 'page_break',
  Custom = 'custom'
}

/**
 * 區段內容
 */
export interface SectionContent {
  template?: string;
  dataBinding?: DataBinding;
  staticContent?: any;
  chartConfig?: ChartConfiguration;
  tableConfig?: TableConfiguration;
}

/**
 * 數據綁定
 */
export interface DataBinding {
  source: string;
  field?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  format?: DataFormat;
  filter?: DataFilter;
}

/**
 * 圖表配置
 */
export interface ChartConfiguration {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'gauge';
  title?: string;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  series: SeriesConfig[];
  colors?: string[];
  legend?: LegendConfig;
  annotations?: ChartAnnotation[];
}

/**
 * 表格配置
 */
export interface TableConfiguration {
  columns: TableColumn[];
  sorting?: TableSorting;
  grouping?: TableGrouping;
  totals?: TableTotals;
  styling?: TableStyling;
  pagination?: TablePagination;
}

/**
 * 報表變數
 */
export interface ReportVariable {
  name: string;
  type: VariableType;
  defaultValue?: any;
  description?: string;
  validation?: VariableValidation;
  options?: VariableOption[];
  required: boolean;
}

/**
 * 變數類型
 */
export enum VariableType {
  String = 'string',
  Number = 'number',
  Date = 'date',
  DateRange = 'date_range',
  Boolean = 'boolean',
  Select = 'select',
  MultiSelect = 'multi_select',
  User = 'user',
  Team = 'team'
}

/**
 * 報表排程
 */
export interface ReportSchedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timezone: string;
  startDate: string;
  endDate?: string;
  parameters?: Record<string, any>;
  retryConfig?: RetryConfig;
}

/**
 * 排程頻率
 */
export enum ScheduleFrequency {
  Manual = 'manual',
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Yearly = 'yearly',
  Custom = 'custom'
}

/**
 * 報表分發
 */
export interface ReportDistribution {
  enabled: boolean;
  channels: DistributionChannel[];
  recipients: ReportRecipient[];
  conditions?: DistributionCondition[];
  archival?: ArchivalConfig;
}

/**
 * 分發通道
 */
export interface DistributionChannel {
  type: ChannelType;
  config: ChannelConfig;
  enabled: boolean;
}

/**
 * 通道類型
 */
export enum ChannelType {
  Email = 'email',
  Slack = 'slack',
  Teams = 'teams',
  WebHook = 'webhook',
  FTP = 'ftp',
  S3 = 's3',
  SharePoint = 'sharepoint'
}

/**
 * 報表收件人
 */
export interface ReportRecipient {
  type: 'user' | 'group' | 'external';
  identifier: string;
  name?: string;
  email?: string;
  preferences?: RecipientPreferences;
}

/**
 * 報表權限
 */
export interface ReportPermissions {
  owner: string;
  viewers: string[];
  editors: string[];
  schedulers: string[];
  distributors: string[];
  isPublic: boolean;
  teamAccess?: TeamAccess[];
}

/**
 * 團隊存取
 */
export interface TeamAccess {
  teamId: string;
  permission: 'view' | 'edit' | 'schedule' | 'distribute';
}

/**
 * 報表生成結果
 */
export interface ReportGenerationResult {
  id: string;
  reportId: string;
  format: ReportFormat;
  status: GenerationStatus;
  filePath?: string;
  downloadUrl?: string;
  fileSize?: number;
  generatedAt: string;
  generatedBy: string;
  error?: string;
  metadata: GenerationMetadata;
}

/**
 * 生成狀態
 */
export enum GenerationStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

/**
 * 報表批次
 */
export interface ReportBatch {
  id: string;
  name: string;
  reports: string[];
  schedule?: ReportSchedule;
  distribution?: ReportDistribution;
  status: BatchStatus;
  createdBy: string;
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
}

/**
 * 批次狀態
 */
export enum BatchStatus {
  Active = 'active',
  Paused = 'paused',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed'
}

/**
 * 報表庫
 */
export interface ReportLibrary {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  templates: ReportTemplate[];
  isPublic: boolean;
  organization?: string;
  maintainer: string;
  version: string;
  downloads: number;
  rating: number;
  tags: string[];
}

/**
 * 報表分析
 */
export interface ReportAnalytics {
  reportId: string;
  views: number;
  downloads: number;
  shares: number;
  averageGenerationTime: number;
  successRate: number;
  lastAccessed: string;
  popularFormats: Record<ReportFormat, number>;
  userEngagement: UserEngagement[];
}

// 輔助類型定義

export interface ReportHeader {
  enabled: boolean;
  content: string;
  height: number;
  styling?: TextStyling;
}

export interface ReportFooter {
  enabled: boolean;
  content: string;
  height: number;
  styling?: TextStyling;
}

export interface ReportWatermark {
  text: string;
  opacity: number;
  rotation: number;
  color: string;
}

export interface ReportStyling {
  theme: 'light' | 'dark' | 'custom';
  fontFamily: string;
  fontSize: number;
  colors: ColorPalette;
  spacing: SpacingConfig;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  border: string;
}

export interface SpacingConfig {
  sectionGap: number;
  elementGap: number;
  lineHeight: number;
}

export interface SectionStyling {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
  margin?: number;
}

export interface RenderCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';
  value: any;
}

export interface DataAggregation {
  field: string;
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group_by';
  alias?: string;
}

export interface DataJoin {
  type: 'inner' | 'left' | 'right' | 'full';
  table: string;
  on: string;
  alias?: string;
}

export interface DataTransformation {
  type: 'filter' | 'sort' | 'group' | 'calculate' | 'format';
  config: Record<string, any>;
}

export interface DataFormat {
  type: 'number' | 'currency' | 'percentage' | 'date' | 'text';
  pattern?: string;
  locale?: string;
}

export interface DataFilter {
  field: string;
  operator: string;
  value: any;
}

export interface AxisConfig {
  title?: string;
  type: 'category' | 'value' | 'time';
  format?: DataFormat;
  min?: number;
  max?: number;
  gridLines?: boolean;
}

export interface SeriesConfig {
  name: string;
  data: string;
  type?: string;
  color?: string;
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface ChartAnnotation {
  type: 'line' | 'area' | 'point' | 'text';
  value: any;
  label?: string;
  color?: string;
}

export interface TableColumn {
  field: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: DataFormat;
  sortable?: boolean;
  groupable?: boolean;
}

export interface TableSorting {
  field: string;
  direction: 'asc' | 'desc';
}

export interface TableGrouping {
  field: string;
  showTotals: boolean;
}

export interface TableTotals {
  enabled: boolean;
  fields: string[];
  position: 'top' | 'bottom' | 'both';
}

export interface TableStyling {
  headerBackground?: string;
  alternateRowColor?: string;
  borderColor?: string;
  fontSize?: number;
}

export interface TablePagination {
  enabled: boolean;
  pageSize: number;
  showPageNumbers: boolean;
}

export interface VariableValidation {
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
}

export interface VariableOption {
  value: any;
  label: string;
  description?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  maxBackoffTime: number;
}

export interface ChannelConfig {
  [key: string]: any;
}

export interface DistributionCondition {
  field: string;
  operator: string;
  value: any;
}

export interface ArchivalConfig {
  enabled: boolean;
  retentionDays: number;
  location: string;
}

export interface RecipientPreferences {
  format: ReportFormat[];
  delivery: 'immediate' | 'batch';
  frequency?: ScheduleFrequency;
}

export interface ReportTemplateMetadata {
  author: string;
  organization?: string;
  version: string;
  compatibility: string[];
  requirements: string[];
  changelog: ChangelogEntry[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
  breaking: boolean;
}

export interface GenerationMetadata {
  duration: number;
  recordCount: number;
  dataSourcesUsed: string[];
  parameters: Record<string, any>;
  warnings?: string[];
}

export interface TextStyling {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface UserEngagement {
  userId: string;
  views: number;
  downloads: number;
  lastAccessed: string;
  preferences: RecipientPreferences;
}

/**
 * 報表查詢介面
 */
export interface ReportQuery {
  templateId?: string;
  category?: ReportCategory;
  format?: ReportFormat;
  status?: ReportStatus;
  createdBy?: string;
  tags?: string[];
  dateRange?: DashboardTimeRange;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 報表匯出選項
 */
export interface ReportExportOptions {
  format: ReportFormat;
  quality?: 'low' | 'medium' | 'high';
  orientation?: 'portrait' | 'landscape';
  compression?: boolean;
  password?: string;
  watermark?: ReportWatermark;
  includeData?: boolean;
  includeCharts?: boolean;
  customOptions?: Record<string, any>;
}

// All enums are already exported at their declaration site above