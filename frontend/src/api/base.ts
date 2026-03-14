// frontend/src/api/base.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/base.ts
// Created by: API Client Developer

import type { ApiResponse } from '@/types';

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (_error: unknown) => boolean;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private contextTeamId: number | null = null;  //  Phase 1: Multi-team context
  private isRefreshing = false;
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

    // Initialize tokens from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      this.token = localStorage.getItem('token');
      this.refreshToken = localStorage.getItem('refreshToken');
      // Phase 1: Restore team context from localStorage
      const storedTeamId = localStorage.getItem('contextTeamId');
      if (storedTeamId) {
        const parsed = parseInt(storedTeamId, 10);
        if (!isNaN(parsed)) {
          this.contextTeamId = parsed;
        }
      }
    }
  }

  setAuthHeader(token: string, refreshToken?: string) {
    this.token = token;
    if (refreshToken) {
      this.refreshToken = refreshToken;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    }
  }

  removeAuthHeader() {
    this.token = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('refreshToken');
    }
  }

  getCurrentToken(): string | null {
    return this.token;
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

  private async refreshAuthToken(): Promise<string | null> {
    if (!this.refreshToken) {return null;}

    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          this.token = result.data.token;
          if (result.data.refreshToken) {
            this.refreshToken = result.data.refreshToken;
          }
          
          // Update localStorage
          if (typeof window !== 'undefined' && window.localStorage && this.token) {
            localStorage.setItem('token', this.token);
            if (this.refreshToken) {
              localStorage.setItem('refreshToken', this.refreshToken);
            }
          }

          this.processQueue(null, this.token);
          return this.token;
        }
      }
    } catch (error) {
      this.processQueue(error as Error, null);
    } finally {
      this.isRefreshing = false;
    }

    // Refresh failed, clear everything
    this.removeAuthHeader();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    return null;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Phase 1 Optimization: Include team context header
    if (this.contextTeamId !== null) {
      headers['X-Context-Team-ID'] = this.contextTeamId.toString();
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
    options: { retries?: number; isRetry?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { retries = 0, isRetry = false } = options;

    console.log(` API Request: ${method} ${this.baseURL}${endpoint}`);
    console.log(' Request data:', data);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method,
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined
      });

      console.log(` Response status: ${response.status} ${response.statusText}`);

      let result;
      try {
        result = await response.json();
      } catch {
        // Handle non-JSON responses
        result = { error: '服務器響應格式錯誤' };
      }

      if (!response.ok) {
        // Handle 401 Unauthorized with token refresh
        if (response.status === 401 && !isRetry && this.refreshToken) {
          const newToken = await this.refreshAuthToken();
          if (newToken) {
            // Retry the request with new token
            return this.request<T>(method, endpoint, data, { ...options, isRetry: true });
          }
        }

        // Handle 401 without refresh token
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          }
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

  get<T>(endpoint: string) {
    return this.request<T>('GET', endpoint);
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>('POST', endpoint, data);
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.request<T>('PUT', endpoint, data);
  }

  delete<T>(endpoint: string) {
    return this.request<T>('DELETE', endpoint);
  }

  // 專門處理檔案上傳的方法
  async uploadFile<T>(endpoint: string, formData: globalThis.FormData): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {};

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      // Phase 1 Optimization: Include team context header
      if (this.contextTeamId !== null) {
        headers['X-Context-Team-ID'] = this.contextTeamId.toString();
      }

      // 不設定 Content-Type，讓瀏覽器自動設定 multipart/form-data 邊界
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
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
        // Handle 401 Unauthorized
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          }
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

// 建立 API 客戶端實例
// 開發環境使用相對路徑，讓 Vite proxy 處理 CORS
// 生產環境使用完整 URL 直連後端
const apiBaseUrl = import.meta.env.DEV
  ? '/api'  // 開發環境: 走 Vite proxy (vite.config.ts 中配置)
  : `${getBackendUrl()}/api`;  // 生產環境: 直連後端

export const apiClient = new ApiClient(apiBaseUrl);