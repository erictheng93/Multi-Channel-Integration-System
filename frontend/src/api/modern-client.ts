// 現代化 API 客戶端
// 支持標準化響應格式和現代化錯誤處理

import { getBackendUrl } from '@/config/runtime'
import { buildAuthenticatedHeaders } from './authenticatedFetch'
import { clearAuthStorageItems } from '../utils/authStorage'
import type {
  StandardApiResponse,
  PaginatedApiResponse,
  ApiResponse
} from '@shared/api-types'
// import { useError } from '@/composables' // Removed unused import

interface ModernApiClientOptions {
  baseURL?: string
  timeout?: number
  retries?: number
  retryDelay?: number
}

type ResponseHandler<T> = (_response: Response) => Promise<ApiResponse<T>>

class ModernApiClient {
  private baseURL: string
  private timeout: number
  private retries: number
  private retryDelay: number

  constructor(options: ModernApiClientOptions = {}) {
    this.baseURL = options.baseURL || getBackendUrl()
    this.timeout = options.timeout || 30000
    this.retries = options.retries || 3
    this.retryDelay = options.retryDelay || 1000

  }

  // 設置認證 token
  setAuthToken(_token: string, _refreshToken?: string) {
    // Headers are built from shared auth storage/cookies by buildAuthenticatedHeaders.
  }

  // 移除認證 token
  removeAuthToken() {
    // Auth state is cleared centrally by auth storage helpers.
  }

  // 獲取請求標頭
  private getHeaders(method: string = 'GET'): globalThis.Headers {
    const headers = buildAuthenticatedHeaders(method, {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    })

    return headers
  }

  // 處理響應
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: StandardApiResponse<T>
    
    try {
      data = await response.json()
    } catch {
      return {
        success: false,
        error: '響應格式錯誤',
        status: response.status
      }
    }

    // 標準化響應格式
    const result: ApiResponse<T> = {
      success: data.success,
      data: data.data,
      error: data.error,
      message: data.message,
      status: response.status
    }

    return result
  }

  // 處理分頁響應
  private async handlePaginatedResponse<T>(response: Response): Promise<ApiResponse<T[]>> {
    let data: PaginatedApiResponse<T>
    
    try {
      data = await response.json()
    } catch {
      return {
        success: false,
        error: '響應格式錯誤',
        status: response.status
      }
    }

    // 轉換分頁響應格式
    const result: ApiResponse<T[]> = {
      success: data.success,
      data: data.data,
      error: data.error,
      message: data.message,
      status: response.status,
      // 添加分頁信息
      pagination: data.pagination
    }

    return result
  }

  // 延遲函數
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 核心請求方法
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options: {
      retryCount?: number
      isFileUpload?: boolean
      responseHandler?: ResponseHandler<T>
    } = {}
  ): Promise<ApiResponse<T>> {
    const { retryCount = 0, isFileUpload = false, responseHandler } = options

    try {
      const controller = new globalThis.AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const headers = isFileUpload
        ? buildAuthenticatedHeaders(method)
        : this.getHeaders(method)

      const body = isFileUpload ? (data as globalThis.BodyInit) : (data ? JSON.stringify(data) : undefined)

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method,
        credentials: 'include',
        headers,
        body,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // 處理 401 未授權錯誤
      if (response.status === 401 && retryCount === 0) {
        const refreshResult = await this.refreshAuthToken()
        if (refreshResult) {
          // 重試請求
          return this.makeRequest<T>(method, endpoint, data, { 
            ...options, 
            retryCount: retryCount + 1 
          })
        }
      }

      // 處理響應
      return responseHandler ? responseHandler(response) : this.handleResponse<T>(response)

    } catch (error) {
      // 處理網路錯誤和超時
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: '請求超時',
            status: 408
          }
        }
        
        // 重試機制
        if (retryCount < this.retries) {
          await this.delay(this.retryDelay * Math.pow(2, retryCount))
          return this.makeRequest<T>(method, endpoint, data, {
            ...options,
            retryCount: retryCount + 1
          })
        }
      }

      return {
        success: false,
        error: '網路連接錯誤',
        status: 0
      }
    }
  }

  // 刷新認證 token
  private async refreshAuthToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthenticatedHeaders('POST', { 'Content-Type': 'application/json' }),
        body: JSON.stringify({})
      })

      if (response.ok) {
        const result: StandardApiResponse<{ token?: string; refreshToken?: string }> = 
          await response.json()
        
        if (result.success && result.data) {
          return true
        }
      }
    } catch (_error) {
      console.error('Token refresh failed:', _error)
    }

    // 刷新失敗，清除認證信息
    this.removeAuthToken()
    if (typeof window !== 'undefined') {
      clearAuthStorageItems()
    }

    return false
  }

  // HTTP 方法
  get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    // 如果有 params，添加到 URL
    let url = endpoint;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url = `${endpoint}?${queryString}`;
    }
    return this.makeRequest<T>('GET', url)
  }

  post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, data)
  }

  put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PUT', endpoint, data)
  }

  delete<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('DELETE', endpoint, data)
  }

  patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PATCH', endpoint, data)
  }

  // 分頁請求
  getPaginated<T>(endpoint: string): Promise<ApiResponse<T[]>> {
    return this.makeRequest<T[]>('GET', endpoint, undefined, {
      responseHandler: (response) => this.handlePaginatedResponse<T>(response)
    })
  }

  // 文件上傳
  uploadFile<T>(endpoint: string, formData: globalThis.FormData): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, formData, { isFileUpload: true })
  }
}

// 創建全局實例
export const modernApiClient = new ModernApiClient()

// 導出類型
export type { ModernApiClientOptions }
export { ModernApiClient }
