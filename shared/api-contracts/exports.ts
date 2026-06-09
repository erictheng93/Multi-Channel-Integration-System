import { defineApiContract } from './core'

export type ExportFormat = 'json' | 'csv' | 'txt' | 'pdf'

export interface ExportFilters {
  format?: ExportFormat
  conversationId?: string
  dateFrom?: string
  dateTo?: string
  customerId?: string
  agentId?: string
  limit?: number
}

export interface ExportCustomerOption {
  id: number
  displayName: string | null
  platform: string | null
  platformUserId: string | null
}

export interface ExportAgentOption {
  id: string
  displayName: string | null
  role: string | null
}

export interface ExportCountResult {
  count: number
  limit: number
  willBeTruncated: boolean
}

export interface ExportCustomersPayload {
  customers: ExportCustomerOption[]
  count: number
}

export function buildExportQuery(filters: ExportFilters = {}, options: { includeFormat?: boolean } = {}): string {
  const params = new URLSearchParams()

  if (options.includeFormat) {
    const format = filters.format || 'json'
    if (['json', 'csv', 'txt', 'pdf'].includes(format)) {
      params.append('format', format === 'pdf' ? 'json' : format)
    }
  }

  if (filters.conversationId && /^[a-zA-Z0-9-_]+$/.test(filters.conversationId)) {
    params.append('conversationId', filters.conversationId)
  }

  if (filters.dateFrom && !isNaN(Date.parse(filters.dateFrom))) {
    params.append('dateFrom', filters.dateFrom)
  }

  if (filters.dateTo && !isNaN(Date.parse(filters.dateTo))) {
    params.append('dateTo', filters.dateTo)
  }

  if (filters.customerId && /^\d+$/.test(filters.customerId)) {
    params.append('customerId', filters.customerId)
  }

  if (filters.agentId && /^[a-zA-Z0-9-_]+$/.test(filters.agentId)) {
    params.append('agentId', filters.agentId)
  }

  if (filters.limit && filters.limit > 0 && filters.limit <= 5000) {
    params.append('limit', filters.limit.toString())
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

export const exportContracts = {
  count: defineApiContract<ExportFilters | undefined, void, ExportCountResult>({
    method: 'GET',
    path: filters => `/messages/export/count${buildExportQuery(filters)}`
  }),

  customers: defineApiContract<Record<string, never>, void, ExportCustomersPayload>({
    method: 'GET',
    path: () => '/customers?pageSize=200'
  }),

  agents: defineApiContract<Record<string, never>, void, ExportAgentOption[]>({
    method: 'GET',
    path: () => '/messages/export/agents'
  })
} as const
