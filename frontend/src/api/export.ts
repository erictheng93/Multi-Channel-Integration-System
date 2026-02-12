// Export API Module
// 對話記錄匯出 API 模組

import { apiClient } from './base'
import type { ApiResponse } from '@/types'

// ==================== 型別定義 ====================

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

// ==================== API 函數 ====================

/**
 * 匯出訊息記錄（直接下載 Blob）
 * 使用 fetch 而非 apiClient，因為回傳的是檔案而非 JSON
 */
export async function exportMessages(filters: ExportFilters = {}): Promise<ApiResponse<Blob>> {
  // 驗證並清理篩選參數
  const params = new URLSearchParams()

  const format = filters.format || 'json'
  if (['json', 'csv', 'txt', 'pdf'].includes(format)) {
    // PDF 在前端產生，後端只需要 JSON 資料
    params.append('format', format === 'pdf' ? 'json' : format)
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

  const queryString = params.toString()

  try {
    const token = localStorage.getItem('token')
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
 * 取得匯出記錄計數（輕量查詢）
 * 用於匯出前確認記錄數量
 */
export async function getExportCount(filters: ExportFilters = {}): Promise<ApiResponse<ExportCountResult>> {
  const params = new URLSearchParams()

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

  const queryString = params.toString()

  return apiClient.get<ExportCountResult>(`/messages/export/count${queryString ? `?${queryString}` : ''}`)
}

/**
 * 取得匯出篩選用的客戶列表
 * 使用 /customers 端點（/messages/export/customers 在 shared schema 缺少 deletedAt 欄位，查詢會失敗）
 * 回應格式: { success, data: { customers: [...], count } }
 */
export async function getExportCustomers(): Promise<ApiResponse<ExportCustomerOption[]>> {
  try {
    const result = await apiClient.get<{
      customers: Array<{
        id: number
        displayName: string | null
        platform: string | null
        platformUserId: string | null
      }>
      count: number
    }>('/customers?pageSize=200')

    if (result.success && result.data?.customers) {
      return {
        success: true,
        data: result.data.customers.map(c => ({
          id: c.id,
          displayName: c.displayName,
          platform: c.platform,
          platformUserId: c.platformUserId
        }))
      }
    }

    return { success: false, error: result.error || '無法載入用戶列表' }
  } catch {
    return { success: false, error: '載入用戶列表失敗' }
  }
}

/**
 * 取得匯出篩選用的客服列表
 */
export async function getExportAgents(): Promise<ApiResponse<ExportAgentOption[]>> {
  return apiClient.get<ExportAgentOption[]>('/messages/export/agents')
}

// ==================== PDF 匯出用 ====================

import type { PdfExportData } from '@/services/pdfExportService'

/**
 * 取得匯出用 JSON 資料（供前端 PDF 產生使用）
 * 使用 format=json 取得結構化資料，而非 blob
 */
export async function fetchExportData(filters: ExportFilters = {}): Promise<ApiResponse<PdfExportData>> {
  const params = new URLSearchParams()
  params.append('format', 'json')

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

  const queryString = params.toString()

  try {
    const token = localStorage.getItem('token')
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

    const json = await response.json()

    if (!json.success || !json.data) {
      return { success: false, error: json.error || '匯出資料格式錯誤' }
    }

    return { success: true, data: json.data as PdfExportData }
  } catch {
    return {
      success: false,
      error: '匯出請求失敗，請檢查網路連線'
    }
  }
}
