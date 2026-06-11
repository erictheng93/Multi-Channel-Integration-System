// frontend/src/api/base.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/base.ts
// Created by: API Client Developer

import type { ApiResponse } from '@/types';
import { buildAuthenticatedHeaders } from './authenticatedFetch'
import { clearAuthStorageItems, removeStoredAuthItem } from '@/utils/authStorage'

const CSRF_COOKIE_NAME = 'mcis_csrf'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (_error: unknown) => boolean;
}

export interface RequestOptions {
  retries?: number;
  isRetry?: boolean;
  redirectOnUnauthorized?: boolean;
  headers?: Record<string, string>;
}

export interface FileDownloadResponse {
  blob: Blob;
  filename: string;
  contentType: string;
}

class ApiClient {
  private baseURL: string;
  private contextTeamId: number | null = null;  //  Phase 1: Multi-team context
  private isRefreshing = false;
  private isRedirecting = false;
  private failedQueue: Array<{ resolve: (_token: string | null) => void; reject: (_error?: unknown) => void }> = [];
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      // Retry on network errors or 5xx server errors, but not on 4xx client errors
      if (!error || typeof error !== 'object') {
        return true;
      }
      const errorObj = error as { response?: { status?: number } };
      return !errorObj.response || (errorObj.response.status ? errorObj.response.status >= 500 && errorObj.response.status < 600 : true);
    }
  };

  constructor(baseURL: string) {
    this.baseURL = baseURL;

    if (typeof window !== 'undefined') {
      // Phase 1: Restore team context from localStorage
      const storedTeamId = window.localStorage?.getItem('contextTeamId');
      if (storedTeamId) {
        const parsed = parseInt(storedTeamId, 10);
        if (!isNaN(parsed)) {
          this.contextTeamId = parsed;
        }
      }
    }
  }

  setAuthHeader(_token: string, _refreshToken?: string) {
    // Deprecated for session auth. Kept as a compatibility no-op.
  }

  removeAuthHeader() {
    if (typeof window !== 'undefined') {
      removeStoredAuthItem('refreshToken');
    }
  }

  /**
   * Safely redirect to login page.
   * Guards against multiple concurrent redirects from parallel 401 responses.
   * The isRedirecting flag resets naturally on page reload (full state destruction).
   */
  private redirectToLogin(): void {
    if (this.isRedirecting) {
      return;
    }
    this.isRedirecting = true;
    if (typeof window !== 'undefined') {
      clearAuthStorageItems();
      window.location.href = '/login';
    }
  }

  getCurrentToken(): string | null {
    return null;
  }

  // Phase 1 Optimization: Team context management
  /**
   * Set the current team context for API requests
   * This team ID will be sent as X-Context-Team-ID header
   */
  setContextTeam(teamId: number | null): void {
    this.contextTeamId = teamId;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (teamId !== null) {
        localStorage.setItem('contextTeamId', teamId.toString());
      } else {
        localStorage.removeItem('contextTeamId');
      }
    }
  }

  /**
   * Get the current team context
   */
  getContextTeam(): number | null {
    return this.contextTeamId;
  }

  private processQueue(error: Error | null, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });
    
    this.failedQueue = [];
  }

  async refreshAuthToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders('POST'),
        body: JSON.stringify({})
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:token-refreshed'));
          }

          this.processQueue(null, 'cookie-refreshed');
          return 'cookie-refreshed';
        }
      }
    } catch (error) {
      this.processQueue(error as Error, null);
    } finally {
      this.isRefreshing = false;
    }

    // Refresh failed — redirect to login (guarded against concurrent calls)
    this.redirectToLogin();

    return null;
  }

  private getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') {
      return null
    }

    const encodedName = `${name}=`
    const cookie = document.cookie
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith(encodedName))

    return cookie ? decodeURIComponent(cookie.slice(encodedName.length)) : null
  }

  private getHeaders(method: string = 'GET'): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Phase 1 Optimization: Include team context header
    if (this.contextTeamId !== null) {
      headers['X-Context-Team-ID'] = this.contextTeamId.toString();
    }

    if (UNSAFE_METHODS.has(method.toUpperCase())) {
      const csrfToken = this.getCookieValue(CSRF_COOKIE_NAME)
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }
    }

    return headers;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { retries = 0, isRetry = false, redirectOnUnauthorized = true } = options;

    if (import.meta.env.DEV) {
      frontendLogger.debug(`API Request: ${method} ${this.baseURL}${endpoint}`);
      frontendLogger.debug('Request data:', data);
    }

    try {
      const requestHeaders = {
        ...this.getHeaders(method),
        ...options.headers
      };

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method,
        credentials: 'include',
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined
      });

      if (import.meta.env.DEV) {
        frontendLogger.debug(`Response status: ${response.status} ${response.statusText}`);
      }

      let result;
      try {
        result = await response.json();
      } catch {
        // Handle non-JSON responses
        result = { error: '服務器響應格式錯誤' };
      }

      if (!response.ok) {
        // Handle 401 Unauthorized with token refresh
        if (response.status === 401 && redirectOnUnauthorized && !isRetry) {
          const newToken = await this.refreshAuthToken();
          if (newToken) {
            // Retry the request with new token
            return this.request<T>(method, endpoint, data, { ...options, isRetry: true });
          }
        }

        // Handle 401 without refresh token — guarded redirect
        if (response.status === 401 && redirectOnUnauthorized) {
          this.redirectToLogin();
        }

        // Check if we should retry for server errors
        const shouldRetry = retries < this.defaultRetryConfig.maxRetries && 
                           response.status >= 500 && 
                           response.status < 600;

        if (shouldRetry) {
          await this.delay(this.defaultRetryConfig.retryDelay * Math.pow(2, retries)); // Exponential backoff
          return this.request<T>(method, endpoint, data, { ...options, retries: retries + 1 });
        }

        const errorMessage = result.error || result.message || this.getErrorMessage(response.status);
        return {
          success: false,
          error: errorMessage,
          status: response.status
        };
      }

      // 成功的請求 - 會話延長現在由 composables 層處理，避免循環依賴

      return result;
    } catch {
      // Network or other errors
      const shouldRetry = retries < this.defaultRetryConfig.maxRetries;
      
      if (shouldRetry) {
        await this.delay(this.defaultRetryConfig.retryDelay * Math.pow(2, retries));
        return this.request<T>(method, endpoint, data, { ...options, retries: retries + 1 });
      }

      return {
        success: false,
        error: '網路連接錯誤，請檢查您的網路連接',
        status: 0
      };
    }
  }

  private getErrorMessage(status: number): string {
    switch (status) {
      case 400:
        return '請求參數錯誤';
      case 401:
        return '認證失敗，請重新登入';
      case 403:
        return '權限不足';
      case 404:
        return '請求的資源不存在';
      case 429:
        return '請求過於頻繁，請稍後再試';
      case 500:
        return '服務器內部錯誤';
      case 502:
        return '服務器網關錯誤';
      case 503:
        return '服務暫時不可用';
      case 504:
        return '服務器響應超時';
      default:
        return '請求失敗';
    }
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  post<T>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', endpoint, data, options);
  }

  put<T>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>('PUT', endpoint, data, options);
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  async downloadFile(
    endpoint: string,
    options: { isRetry?: boolean } = {}
  ): Promise<FileDownloadResponse> {
    const { isRetry = false } = options;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      headers: this.getHeaders('GET')
    });

    if (response.status === 401 && !isRetry) {
      const newToken = await this.refreshAuthToken();
      if (newToken) {
        return this.downloadFile(endpoint, { isRetry: true });
      }
    }

    if (response.status === 401) {
      this.redirectToLogin();
    }

    if (!response.ok) {
      let errorMessage = this.getErrorMessage(response.status);
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorBody.message || errorMessage;
      } catch {
        // File endpoints may return non-JSON errors.
      }
      throw new Error(errorMessage);
    }

    return {
      blob: await response.blob(),
      filename: this.getFilenameFromContentDisposition(response.headers.get('Content-Disposition')) || 'download',
      contentType: response.headers.get('Content-Type') || 'application/octet-stream'
    };
  }

  private getFilenameFromContentDisposition(header: string | null): string | null {
    if (!header) {
      return null;
    }

    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1].trim());
    }

    const asciiMatch = header.match(/filename="?([^";]+)"?/i);
    return asciiMatch?.[1]?.trim() || null;
  }

  // 專門處理檔案上傳的方法
  async uploadFile<T>(
    endpoint: string,
    formData: globalThis.FormData,
    options: { isRetry?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { isRetry = false } = options;

    try {
      const headers = buildAuthenticatedHeaders('POST');

      // Phase 1 Optimization: Include team context header
      if (this.contextTeamId !== null) {
        headers.set('X-Context-Team-ID', this.contextTeamId.toString());
      }

      // 不設定 Content-Type，讓瀏覽器自動設定 multipart/form-data 邊界
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData
      });

      let result;
      try {
        result = await response.json();
      } catch {
        result = { error: '服務器響應格式錯誤' };
      }

      if (!response.ok) {
        // Handle 401 Unauthorized with token refresh (same pattern as request())
        if (response.status === 401 && !isRetry) {
          const newToken = await this.refreshAuthToken();
          if (newToken) {
            return this.uploadFile<T>(endpoint, formData, { isRetry: true });
          }
        }

        // Handle 401 without refresh token — guarded redirect
        if (response.status === 401) {
          this.redirectToLogin();
        }

        const errorMessage = result.error || result.message || this.getErrorMessage(response.status);
        return {
          success: false,
          error: errorMessage,
          status: response.status
        };
      }

      return result;
    } catch {
      return {
        success: false,
        error: '檔案上傳過程中發生網路錯誤',
        status: 0
      };
    }
  }
}

// ============================================================================
// Layer 3: 使用運行時配置層
// ============================================================================
import { getBackendUrl } from '@/config/runtime';
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('base')

// 建立 API 客戶端實例
// 開發環境使用相對路徑，讓 Vite proxy 處理 CORS
// 生產環境使用完整 URL 直連後端
const apiBaseUrl = import.meta.env.DEV
  ? '/api'  // 開發環境: 走 Vite proxy (vite.config.ts 中配置)
  : `${getBackendUrl()}/api`;  // 生產環境: 直連後端

export const apiClient = new ApiClient(apiBaseUrl);
