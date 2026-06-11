import { defineApiContract } from './core'
import type { Agent, ApiResponse, LoginRequest, LoginResponse } from '../types'

export interface ChangePasswordRequest {
  newPassword: string
  currentPassword?: string
}

export const authContracts = {
  login: defineApiContract<Record<string, never>, LoginRequest, LoginResponse>({
    method: 'POST',
    path: () => '/auth/login'
  }),

  me: defineApiContract<Record<string, never>, void, Agent>({
    method: 'GET',
    path: () => '/auth/me'
  }),

  logout: defineApiContract<Record<string, never>, void, void>({
    method: 'POST',
    path: () => '/auth/logout'
  }),

  changePassword: defineApiContract<
    Record<string, never>,
    ChangePasswordRequest,
    void,
    ApiResponse<void>
  >({
    method: 'POST',
    path: () => '/auth/change-password'
  })
} as const
