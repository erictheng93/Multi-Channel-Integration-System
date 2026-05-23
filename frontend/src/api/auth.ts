// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/auth.ts
// Created by: API Service Developer

import { apiClient } from './base'
import type { LoginRequest, Agent, ApiResponse } from '@/types'

export const authApi = {
  // 設定認證標頭
  setAuthHeader: (token: string, refreshToken?: string) => {
    apiClient.setAuthHeader(token, refreshToken)
  },

  // 移除認證標頭
  removeAuthHeader: () => {
    apiClient.removeAuthHeader()
  },

  // 登入
  login: async (credentials: LoginRequest): Promise<ApiResponse<{ token: string; refreshToken?: string; agent: Agent }>> => {
    return apiClient.post('/auth/login', credentials)
  },

  // 獲取當前用戶資訊
  me: async (): Promise<ApiResponse<Agent>> => {
    return apiClient.get('/auth/me')
  },

  // 登出
  logout: async (): Promise<ApiResponse<void>> => {
    return apiClient.post('/auth/logout')
  },

  // 更改密碼（用於強制密碼更改）
  changePassword: async (
    data: { newPassword: string; currentPassword?: string },
    tempToken?: string
  ): Promise<ApiResponse<void>> => {
    if (tempToken) {
      // 臨時設置認證標頭
      const originalToken = apiClient.getCurrentToken()
      apiClient.setAuthHeader(tempToken)
      
      try {
        return await apiClient.post('/auth/change-password', data, {
          redirectOnUnauthorized: false,
        })
      } finally {
        // 恢復原始token
        if (originalToken) {
          apiClient.setAuthHeader(originalToken)
        } else {
          apiClient.removeAuthHeader()
        }
      }
    } else {
      return apiClient.post('/auth/change-password', data, {
        redirectOnUnauthorized: false,
      })
    }
  }
}

export default apiClient
