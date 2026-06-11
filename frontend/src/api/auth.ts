// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/auth.ts
// Created by: API Service Developer

import { apiClient } from './base'
import { callApiContract } from './contract-client'
import { authContracts } from '@shared/api-contracts'
import type { ChangePasswordRequest } from '@shared/api-contracts'
import type { LoginRequest, LoginResponse, Agent, ApiResponse } from '@/types'

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
  login: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    return callApiContract(authContracts.login, {}, credentials)
  },

  // 獲取當前用戶資訊
  me: async (): Promise<ApiResponse<Agent>> => {
    return callApiContract(authContracts.me, {})
  },

  // 登出
  logout: async (): Promise<ApiResponse<void>> => {
    return callApiContract(authContracts.logout, {})
  },

  // 更改密碼（用於強制密碼更改）
  changePassword: async (
    data: ChangePasswordRequest,
    tempToken?: string
  ): Promise<ApiResponse<void>> => {
    if (tempToken) {
      return callApiContract(authContracts.changePassword, {}, data, {
        redirectOnUnauthorized: false,
        headers: {
          Authorization: `Bearer ${tempToken}`,
        },
      })
    } else {
      return callApiContract(authContracts.changePassword, {}, data, {
        redirectOnUnauthorized: false,
      })
    }
  }
}

export default apiClient
