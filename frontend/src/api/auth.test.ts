import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGet, mockPost, mockSetAuthHeader, mockRemoveAuthHeader } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockSetAuthHeader: vi.fn(),
  mockRemoveAuthHeader: vi.fn()
}))

// Mock only the transport; authApi and callApiContract are the real modules.
vi.mock('./base', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    setAuthHeader: mockSetAuthHeader,
    removeAuthHeader: mockRemoveAuthHeader
  }
}))

import { authApi } from './auth'

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards the token and refresh token to the transport', () => {
    authApi.setAuthHeader('t', 'r')
    expect(mockSetAuthHeader).toHaveBeenCalledWith('t', 'r')
  })

  it('removes the auth header on the transport', () => {
    authApi.removeAuthHeader()
    expect(mockRemoveAuthHeader).toHaveBeenCalledTimes(1)
  })

  it('posts credentials to /auth/login and returns the response untouched', async () => {
    const response = { success: false, error: 'Invalid credentials' }
    mockPost.mockResolvedValue(response)

    const result = await authApi.login({ email: 'a@example.com', password: 'pw' })

    expect(mockPost).toHaveBeenCalledWith('/auth/login', { email: 'a@example.com', password: 'pw' })
    expect(result).toBe(response)
  })

  it('gets /auth/me, passing request options only when given', async () => {
    mockGet.mockResolvedValue({ success: true })

    await authApi.me()
    expect(mockGet).toHaveBeenLastCalledWith('/auth/me')

    await authApi.me({ redirectOnUnauthorized: false })
    expect(mockGet).toHaveBeenLastCalledWith('/auth/me', { redirectOnUnauthorized: false })
  })

  it('posts /auth/logout without a body', async () => {
    mockPost.mockResolvedValue({ success: true })
    await authApi.logout()
    expect(mockPost).toHaveBeenCalledWith('/auth/logout')
  })

  describe('changePassword', () => {
    const data = { currentPassword: 'old', newPassword: 'new' } as never

    it('uses the temp token as a Bearer header when forced to change password', async () => {
      mockPost.mockResolvedValue({ success: true })
      await authApi.changePassword(data, 'temp-token')
      expect(mockPost).toHaveBeenCalledWith('/auth/change-password', data, {
        redirectOnUnauthorized: false,
        headers: { Authorization: 'Bearer temp-token' }
      })
    })

    it('does not set an Authorization header without a temp token', async () => {
      mockPost.mockResolvedValue({ success: true })
      await authApi.changePassword(data)
      expect(mockPost).toHaveBeenCalledWith('/auth/change-password', data, {
        redirectOnUnauthorized: false
      })
    })
  })
})
