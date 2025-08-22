// 現代化 API 客戶端
// 支持標準化響應格式和現代化錯誤處理

import type { 
  StandardApiResponse, 
  PaginatedApiResponse, 
  ApiResponse 
} from '../../../shared/api-types'
// import { useError } from '@/composables' // Removed unused import

interface ModernApiClientOptions {
  baseURL?: string
  timeout?: number
  retries?: number
  retryDelay?: number
}

class ModernApiClient {
  private baseURL: string
  private timeout: number
  private retries: number
  private retryDelay: number
  private token: string | null = null
  private refreshToken: string | null = null

  constructor(options: ModernApiClientOptions = {}) {
    this.baseURL = options.baseURL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
    this.timeout = options.timeout || 30000
    this.retries = options.retries || 3
    this.retryDelay = options.retryDelay || 1000

    // 從 localStorage 初始化 tokens
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token')
      this.refreshToken = localStorage.getItem('refreshToken')
    }
  }

  // 設置認證 token
  setAuthToken(token: string, refreshToken?: string) {
    this.token = token
    if (refreshToken) {
      this.refreshToken = refreshToken
    }
  }

  // 移除認證 token
  removeAuthToken() {
    this.token = null
    this.refreshToken = null
  }

  // 獲取請求標頭
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return headers
  }

  // 處理響應
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: StandardApiResponse<T>
    
    try {
      data = await response.json()
    } catch (error) {
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
    } catch (error) {
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
      isPaginated?: boolean
      retryCount?: number
      isFileUpload?: boolean
    } = {}
  ): Promise<ApiResponse<T>> {
    const { isPaginated = false, retryCount = 0, isFileUpload = false } = options

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const headers = isFileUpload ? 
        (this.token ? { 'Authorization': `Bearer ${this.token}` } : {}) :
        this.getHeaders()

      const body = isFileUpload ? (data as BodyInit) : (data ? JSON.stringify(data) : undefined)

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method,
        headers,
        body,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // 處理 401 未授權錯誤
      if (response.status === 401 && this.refreshToken && retryCount === 0) {
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
      if (isPaginated) {
        return this.handlePaginatedResponse<T[]>(response) as unknown as ApiResponse<T>
      } else {
        return this.handleResponse<T>(response)
      }

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
    if (!this.refreshToken) {return false}

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      })

      if (response.ok) {
        const result: StandardApiResponse<{ token: string; refreshToken?: string }> = 
          await response.json()
        
        if (result.success && result.data) {
          this.token = result.data.token
          if (result.data.refreshToken) {
            this.refreshToken = result.data.refreshToken
          }

          // 更新 localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', this.token)
            if (this.refreshToken) {
              localStorage.setItem('refreshToken', this.refreshToken)
            }
          }

          return true
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
    }

    // 刷新失敗，清除認證信息
    this.removeAuthToken()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    }

    return false
  }

  // HTTP 方法
  get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('GET', endpoint)
  }

  post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, data)
  }

  put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PUT', endpoint, data)
  }

  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('DELETE', endpoint)
  }

  patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PATCH', endpoint, data)
  }

  // 分頁請求
  getPaginated<T>(endpoint: string): Promise<ApiResponse<T[]>> {
    return this.makeRequest<T[]>('GET', endpoint, undefined, { isPaginated: true })
  }

  // 文件上傳
  uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, formData, { isFileUpload: true })
  }
}

// 創建全局實例
export const modernApiClient = new ModernApiClient()

// 導出類型
export type { ModernApiClientOptions }
export { ModernApiClient }