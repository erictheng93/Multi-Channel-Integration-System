// Export API Module
// 對話記錄匯出 API 模組

import { apiClient } from './base'
import type { ApiResponse } from '@/types'

// ==================== 型別定義 ====================

export type ExportFormat = 'json' | 'csv' | 'txt'

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

// ==================== API 函數 ====================

/**
 * 匯出訊息記錄（直接下載 Blob）
 * 使用 fetch 而非 apiClient，因為回傳的是檔案而非 JSON
 */
export async function exportMessages(filters: ExportFilters = {}): Promise<ApiResponse<Blob>> {
  // 驗證並清理篩選參數
  const params = new URLSearchParams()

  const format = filters.format || 'json'
  if (['json', 'csv', 'txt'].includes(format)) {
    params.append('format', format)
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

  if (filters.limit && filters.limit > 0 && filters.limit <= 1000) {
    params.append('limit', filters.limit.toString())
  }

  const queryString = params.toString()

  try {
    const token = localStorage.getItem('auth_token')
    const baseUrl = import.meta.env.DEV ? '/api' : `${(await import('@/config/runtime')).getBackendUrl()}/api`

    const response = await fetch(`${baseUrl}/messages/export${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const sanitizedError = response.status === 403
        ? '權限不足'
        : response.status === 404
        ? '匯出端點不存在'
        : '匯出失敗'
      return { success: false, error: sanitizedError }
    }

    const blob = await response.blob()
    return { success: true, data: blob }
  } catch {
    return {
      success: false,
      error: '匯出請求失敗，請檢查網路連線'
    }
  }
}

/**
 * 取得匯出篩選用的客戶列表
 */
export async function getExportCustomers(): Promise<ApiResponse<ExportCustomerOption[]>> {
  return apiClient.get<ExportCustomerOption[]>('/messages/export/customers')
}

/**
 * 取得匯出篩選用的客服列表
 */
export async function getExportAgents(): Promise<ApiResponse<ExportAgentOption[]>> {
  return apiClient.get<ExportAgentOption[]>('/messages/export/agents')
}
