import { defineApiContract } from './core'

export type IntegrationPlatform = 'line' | 'facebook'
export type SystemStatsPeriod = '1h' | '24h' | '7d' | '30d'
export type FeedbackTimeRange = '24h' | '7d' | '30d' | 'all'

export interface SystemLogParams {
  level?: 'error' | 'warn' | 'info' | 'debug'
  startDate?: string
  endDate?: string
  limit?: number
}

export interface SystemEventParams {
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
}

export interface FeedbackListParams {
  page?: number
  pageSize?: number
}

export function buildSystemLogQuery(params?: SystemLogParams): string {
  const queryParams = new URLSearchParams()
  if (params?.level) {
    queryParams.append('level', params.level)
  }
  if (params?.startDate) {
    queryParams.append('startDate', params.startDate)
  }
  if (params?.endDate) {
    queryParams.append('endDate', params.endDate)
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString())
  }
  const query = queryParams.toString()
  return query ? `?${query}` : ''
}

export function buildSystemEventQuery(params?: SystemEventParams): string {
  const queryParams = new URLSearchParams()
  if (params?.type) {
    queryParams.append('type', params.type)
  }
  if (params?.startDate) {
    queryParams.append('startDate', params.startDate)
  }
  if (params?.endDate) {
    queryParams.append('endDate', params.endDate)
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString())
  }
  const query = queryParams.toString()
  return query ? `?${query}` : ''
}

export function buildFeedbackListQuery(params?: FeedbackListParams): string {
  const queryParams = new URLSearchParams()
  if (params?.page) {
    queryParams.append('page', params.page.toString())
  }
  if (params?.pageSize) {
    queryParams.append('pageSize', params.pageSize.toString())
  }
  const query = queryParams.toString()
  return query ? `?${query}` : ''
}

export const systemContracts = {
  info: defineApiContract<Record<string, never>, void, unknown>({ method: 'GET', path: () => '/system/info' }),
  settings: defineApiContract<Record<string, never>, void, unknown>({ method: 'GET', path: () => '/system/settings' }),
  updateSettings: defineApiContract<Record<string, never>, unknown, void>({ method: 'PUT', path: () => '/system/settings' }),
  testIntegration: defineApiContract<{ platform: IntegrationPlatform }, unknown, { status: string; message?: string }>({
    method: 'POST',
    path: ({ platform }) => `/system/integrations/${platform}/test`
  }),
  metrics: defineApiContract<Record<string, never>, void, unknown>({ method: 'GET', path: () => '/system/metrics' }),
  logs: defineApiContract<SystemLogParams | undefined, void, unknown>({
    method: 'GET',
    path: params => `/system/logs${buildSystemLogQuery(params)}`
  }),
  exportConfig: defineApiContract<Record<string, never>, void, unknown>({
    method: 'GET',
    path: () => '/system/config/export'
  }),
  importConfig: defineApiContract<Record<string, never>, unknown, void>({
    method: 'POST',
    path: () => '/system/config/import'
  }),
  stats: defineApiContract<{ period?: SystemStatsPeriod }, void, unknown>({
    method: 'GET',
    path: ({ period }) => `/system/stats${period ? `?period=${period}` : ''}`
  }),
  dashboardStats: defineApiContract<Record<string, never>, void, unknown>({
    method: 'GET',
    path: () => '/system/stats'
  }),
  updateWebhookUrl: defineApiContract<{ platform: IntegrationPlatform }, { url: string }, void>({
    method: 'PUT',
    path: ({ platform }) => `/system/webhooks/${platform}`
  }),
  testWebhook: defineApiContract<{ platform: IntegrationPlatform }, void, unknown>({
    method: 'POST',
    path: ({ platform }) => `/system/webhooks/${platform}/test`
  }),
  events: defineApiContract<SystemEventParams | undefined, void, unknown>({
    method: 'GET',
    path: params => `/system/events${buildSystemEventQuery(params)}`
  }),
  setMaintenance: defineApiContract<Record<string, never>, { enabled: boolean; message?: string }, void>({
    method: 'POST',
    path: () => '/system/maintenance'
  }),
  maintenanceStatus: defineApiContract<Record<string, never>, void, unknown>({
    method: 'GET',
    path: () => '/system/maintenance'
  })
} as const

export const credentialContracts = {
  store: defineApiContract<Record<string, never>, { platform: IntegrationPlatform; type: string; value: string }, void>({
    method: 'POST',
    path: () => '/credentials'
  }),
  get: defineApiContract<{ platform: IntegrationPlatform; type: string }, void, { value: string }>({
    method: 'GET',
    path: ({ platform, type }) => `/credentials/${platform}/${type}`
  }),
  all: defineApiContract<Record<string, never>, void, unknown>({
    method: 'GET',
    path: () => '/credentials'
  }),
  clearPlatform: defineApiContract<{ platform: IntegrationPlatform }, void, void>({
    method: 'DELETE',
    path: ({ platform }) => `/credentials/${platform}`
  })
} as const

export const feedbackContracts = {
  submit: defineApiContract<Record<string, never>, unknown, unknown>({
    method: 'POST',
    path: () => '/feedback'
  }),
  stats: defineApiContract<{ timeRange?: FeedbackTimeRange }, void, unknown>({
    method: 'GET',
    path: ({ timeRange }) => `/feedback/stats${timeRange ? `?timeRange=${timeRange}` : ''}`
  }),
  byConversation: defineApiContract<{ conversationId: string }, void, unknown>({
    method: 'GET',
    path: ({ conversationId }) => `/feedback/conversation/${conversationId}`
  }),
  list: defineApiContract<FeedbackListParams | undefined, void, unknown>({
    method: 'GET',
    path: params => `/feedback${buildFeedbackListQuery(params)}`
  })
} as const
