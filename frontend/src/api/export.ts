// Export API Module
// 對話記錄匯出 API 模組

import {
  buildExportQuery,
  exportContracts,
  type ExportAgentOption,
  type ExportCountResult,
  type ExportCustomerOption,
  type ExportFilters
} from '@shared/api-contracts'
import { authenticatedFetch } from './authenticatedFetch'
import { callApiContract } from './contract-client'
import type { ApiResponse } from '@/types'
export type {
  ExportAgentOption,
  ExportCountResult,
  ExportCustomerOption,
  ExportFilters,
  ExportFormat
} from '@shared/api-contracts'

// ==================== API 函數 ====================

/**
 * 匯出訊息記錄（直接下載 Blob）
 * 使用 fetch 而非 apiClient，因為回傳的是檔案而非 JSON
 */
export async function exportMessages(filters: ExportFilters = {}): Promise<ApiResponse<Blob>> {
  const queryString = buildExportQuery(filters, { includeFormat: true })

  try {
    const baseUrl = import.meta.env.DEV ? '/api' : `${(await import('@/config/runtime')).getBackendUrl()}/api`

    const response = await authenticatedFetch(`${baseUrl}/messages/export${queryString}`)

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
  return callApiContract(exportContracts.count, filters)
}

/**
 * 取得匯出篩選用的客戶列表
 * 使用 /customers 端點（/messages/export/customers 在 shared schema 缺少 deletedAt 欄位，查詢會失敗）
 * 回應格式: { success, data: { customers: [...], count } }
 */
export async function getExportCustomers(): Promise<ApiResponse<ExportCustomerOption[]>> {
  try {
    const result = await callApiContract(exportContracts.customers, {})

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
  return callApiContract(exportContracts.agents, {})
}

// ==================== PDF 匯出用 ====================

import type { PdfExportData } from '@/services/pdfExportService'

/**
 * 取得匯出用 JSON 資料（供前端 PDF 產生使用）
 * 使用 format=json 取得結構化資料，而非 blob
 */
export async function fetchExportData(filters: ExportFilters = {}): Promise<ApiResponse<PdfExportData>> {
  const queryString = buildExportQuery({ ...filters, format: 'json' }, { includeFormat: true })

  try {
    const baseUrl = import.meta.env.DEV ? '/api' : `${(await import('@/config/runtime')).getBackendUrl()}/api`

    const response = await authenticatedFetch(`${baseUrl}/messages/export${queryString}`)

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
