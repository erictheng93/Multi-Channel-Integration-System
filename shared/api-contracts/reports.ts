import { defineApiContract } from './core'
import type { ApiResponse } from '../types/api'

export type ReportType =
  | 'conversation_summary'
  | 'agent_performance'
  | 'team_analytics'
  | 'customer_satisfaction'
  | 'platform_usage'
  | 'message_statistics'
  | 'response_time_analysis'
  | 'workload_distribution'
  | 'system_health'
  | 'custom'
  | 'cost_analysis'
  | 'sla_compliance'
  | 'anomaly_detection'
  | 'audit_trail'
  | 'resource_utilization'
  | 'trend_forecast'
  | 'customer_insights'
  | 'channel_integration'
  | 'goal_achievement'
  | 'automation_effectiveness'
  | 'security_risk'
  | 'knowledge_base'
  | 'call_quality'
  | 'executive_summary'

export type ReportTimeRange =
  | 'last_24_hours'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'current_month'
  | 'last_month'
  | 'current_quarter'
  | 'last_quarter'
  | 'current_year'
  | 'last_year'
  | 'custom'

export type ReportFormat = 'json' | 'csv' | 'excel' | 'pdf' | 'html'
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'expired'

export interface ReportFilters {
  teamIds?: string[]
  agentIds?: string[]
  customerIds?: string[]
  conversationIds?: string[]
  platforms?: string[]
  messageTypes?: string[]
  priority?: ('low' | 'medium' | 'high' | 'urgent')[]
  tags?: string[]
  customFields?: Record<string, unknown>
}

export interface ReportOptions {
  includeCharts?: boolean
  includeSummary?: boolean
  includeDetails?: boolean
  includeRawData?: boolean
  chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'area'
  groupBy?: string[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  maxRecords?: number
  timezone?: string
  language?: 'zh-TW' | 'en-US'
}

export interface ReportBase {
  id: string
  title: string
  description?: string
  type: ReportType
  format: ReportFormat
  status: ReportStatus
  createdBy: string
  createdAt: string
  completedAt?: string
  expiresAt?: string
  downloadUrl?: string
  fileSize?: number
  metadata?: Record<string, unknown>
}

export interface ReportDetails extends ReportBase {
  generationLog?: string[]
  errorMessage?: string
  executionTime?: number
  dataSource?: {
    tables: string[]
    filters: ReportFilters
    recordCount: number
  }
  downloadHistory?: Array<{
    downloadedAt: string
    downloadedBy: string
    ipAddress?: string
  }>
}

export interface ReportGenerationParams {
  type: ReportType
  title: string
  description?: string
  format: ReportFormat
  timeRange: ReportTimeRange
  startDate?: string
  endDate?: string
  filters?: ReportFilters
  options?: ReportOptions
}

export interface ReportListQuery {
  type?: ReportType
  status?: ReportStatus
  format?: ReportFormat
  createdBy?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ReportListResponse {
  reports: ReportBase[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  summary: {
    totalReports: number
    pendingReports: number
    completedReports: number
    failedReports: number
  }
}

export interface ReportStatistics {
  totalReports: number
  reportsByType: Record<ReportType, number>
  reportsByFormat: Record<ReportFormat, number>
  reportsByStatus: Record<ReportStatus, number>
  averageGenerationTime: number
  popularReports: Array<{
    type: ReportType
    count: number
    averageSize: number
  }>
  usageByUser: Array<{
    userId: string
    username: string
    reportCount: number
    lastGenerated: string
  }>
  monthlyTrends: Array<{
    month: string
    reportsGenerated: number
    totalSize: number
  }>
}

export interface BatchReportOperation {
  reportIds: string[]
  action: 'delete' | 'regenerate' | 'download' | 'export'
  options?: {
    format?: ReportFormat
    mergeReports?: boolean
  }
}

export interface BatchOperationResult {
  success: boolean
  totalRequested: number
  successCount: number
  failedCount: number
  results: Array<{
    reportId: string
    success: boolean
    error?: string
    downloadUrl?: string
  }>
}

export interface ScheduledReport {
  id: string
  name: string
  description?: string
  type: ReportType
  format: ReportFormat
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    time: string
    dayOfWeek?: number
    dayOfMonth?: number
  }
  filters: ReportFilters
  options: ReportOptions
  recipients: Array<{
    email: string
    name: string
    role: string
  }>
  isActive: boolean
  createdBy: string
  createdAt: string
  lastRun?: string
  nextRun: string
}

export interface ReportModuleInfo {
  module: string
  version: string
  description: string
  features: string[]
  reportTypes: string[]
  endpoints: string[]
  permissions: Record<string, string>
}

export interface ReportDownloadResponse {
  blob: Blob
  filename: string
  contentType: string
}

export interface ReportHealthResponse {
  status: string
  module: string
  timestamp: string
  version: string
}

export interface ReportGenerationResponse extends ApiResponse<ReportBase> {
  estimatedTime: string
}

export interface ReportDeleteResponse extends ApiResponse<void> {
  message?: string
}

export interface ReportTemplate {
  name: string
  description: string
  options: ReportOptions
}

export interface ReportTemplatesResponse extends ApiResponse<ReportTemplate[]> {
  reportType?: string
}

export interface ScheduledReportListResponse extends ApiResponse<ScheduledReport[]> {
  count?: number
}

/**
 * Serialise a report list query, dropping absent values.
 *
 * `new URLSearchParams({ type: undefined })` stringifies the value, producing
 * the literal `type=undefined`. That is not a missing parameter as far as the
 * backend is concerned - it is the six-character string "undefined", which fails
 * validation:
 *
 *   GET /api/reports?...&type=undefined&status=undefined&format=undefined
 *   400 Bad Request
 *
 * Observed live during post-deploy QA. Sibling contracts (system.ts,
 * notifications.ts) guard each field with an explicit `if`; this one passed the
 * whole object straight through.
 */
export function buildReportQuery(query: ReportListQuery = {}): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    params.append(key, String(value))
  }

  return params.toString()
}

export const reportContracts = {
  health: defineApiContract<
    Record<string, never>,
    void,
    ReportHealthResponse,
    ReportHealthResponse
  >({
    method: 'GET',
    path: () => '/reports/health'
  }),

  info: defineApiContract<Record<string, never>, void, ReportModuleInfo>({
    method: 'GET',
    path: () => '/reports/info'
  }),

  generate: defineApiContract<
    Record<string, never>,
    ReportGenerationParams,
    ReportBase,
    ReportGenerationResponse
  >({
    method: 'POST',
    path: () => '/reports'
  }),

  list: defineApiContract<ReportListQuery, void, ReportListResponse>({
    method: 'GET',
    path: query => `/reports?${buildReportQuery(query)}`
  }),

  details: defineApiContract<{ reportId: string }, void, ReportDetails>({
    method: 'GET',
    path: ({ reportId }) => `/reports/${reportId}`
  }),

  download: defineApiContract<{ reportId: string }, void, never, ReportDownloadResponse>({
    method: 'GET',
    transport: 'download',
    path: ({ reportId }) => `/reports/${reportId}/download`
  }),

  delete: defineApiContract<{ reportId: string }, void, void, ReportDeleteResponse>({
    method: 'DELETE',
    path: ({ reportId }) => `/reports/${reportId}`
  }),

  stats: defineApiContract<{ timeRange: ReportTimeRange }, void, ReportStatistics>({
    method: 'GET',
    path: ({ timeRange }) => `/reports/stats?timeRange=${timeRange}`
  }),

  batch: defineApiContract<Record<string, never>, BatchReportOperation, BatchOperationResult>({
    method: 'POST',
    path: () => '/reports/batch'
  }),

  templates: defineApiContract<
    { reportType: ReportType },
    void,
    ReportTemplate[],
    ReportTemplatesResponse
  >({
    method: 'GET',
    path: ({ reportType }) => `/reports/templates/${reportType}`
  }),

  preview: defineApiContract<Record<string, never>, ReportGenerationParams, unknown>({
    method: 'POST',
    path: () => '/reports/preview'
  }),

  createScheduled: defineApiContract<
    Record<string, never>,
    Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>,
    ScheduledReport
  >({
    method: 'POST',
    path: () => '/reports/scheduled'
  }),

  listScheduled: defineApiContract<
    Record<string, never>,
    void,
    ScheduledReport[],
    ScheduledReportListResponse
  >({
    method: 'GET',
    path: () => '/reports/scheduled'
  }),

  updateScheduled: defineApiContract<{ id: string }, Partial<ScheduledReport>, ScheduledReport>({
    method: 'PUT',
    path: ({ id }) => `/reports/scheduled/${id}`
  }),

  deleteScheduled: defineApiContract<{ id: string }, void, void, ReportDeleteResponse>({
    method: 'DELETE',
    path: ({ id }) => `/reports/scheduled/${id}`
  })
} as const
