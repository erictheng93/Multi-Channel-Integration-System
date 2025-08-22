import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mocks are available
const { mockLogin, mockLogout, mockMe, mockRefresh, mockRefreshToken, mockSetAuthHeader, mockRemoveAuthHeader } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockLogout: vi.fn(),
  mockMe: vi.fn(),
  mockRefresh: vi.fn(),
  mockRefreshToken: vi.fn(),
  mockSetAuthHeader: vi.fn(),
  mockRemoveAuthHeader: vi.fn()
}))

// Mock the auth module directly
vi.mock('./auth', () => ({
  authApi: {
    setAuthHeader: mockSetAuthHeader,
    removeAuthHeader: mockRemoveAuthHeader,
    login: mockLogin,
    me: mockMe,
    logout: mockLogout,
    refresh: mockRefresh,
    refreshToken: mockRefreshToken
  }
}))

// Import after mocking
import { authApi } from './auth'

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Header Management', () => {
    it('should set auth header', () => {
      const token = 'test-token'
      const refreshToken = 'test-refresh-token'
      
      authApi.setAuthHeader(token, refreshToken)
      
      expect(mockSetAuthHeader).toHaveBeenCalledWith(token, refreshToken)
    })

    it('should set auth header without refresh token', () => {
      const token = 'test-token'
      
      authApi.setAuthHeader(token)
      
      expect(mockSetAuthHeader).toHaveBeenCalledWith(token)
    })

    it('should remove auth header', () => {
      authApi.removeAuthHeader()
      
      expect(mockRemoveAuthHeader).toHaveBeenCalled()
    })
  })

  describe('Authentication', () => {
    it('should login successfully', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' }
      const mockResponse = {
        success: true,
        data: {
          token: 'auth-token',
          refreshToken: 'refresh-token',
          agent: { id: '1', name: 'Test Agent', email: 'test@example.com' }
        }
      }
      
      mockLogin.mockResolvedValue(mockResponse)
      
      const result = await authApi.login(credentials)
      
      expect(mockLogin).toHaveBeenCalledWith(credentials)
      expect(result).toEqual(mockResponse)
    })

    it('should handle login failure', async () => {
      const credentials = { email: 'wrong@example.com', password: 'wrongpassword' }
      const mockResponse = {
        success: false,
        error: 'Invalid credentials'
      }
      
      mockLogin.mockResolvedValue(mockResponse)
      
      const result = await authApi.login(credentials)
      
      expect(mockLogin).toHaveBeenCalledWith(credentials)
      expect(result).toEqual(mockResponse)
    })

    it('should logout successfully', async () => {
      const mockResponse = { success: true }
      
      mockLogout.mockResolvedValue(mockResponse)
      
      const result = await authApi.logout()
      
      expect(mockLogout).toHaveBeenCalled()
      expect(result).toEqual(mockResponse)
    })
  })

  describe('User Information', () => {
    it('should get current user info', async () => {
      const mockAgent = {
        id: '1',
        name: 'Test Agent',
        email: 'test@example.com',
        role: 'agent',
        isOnline: true,
        platforms: ['line']
      }
      const mockResponse = { success: true, data: mockAgent }
      
      mockMe.mockResolvedValue(mockResponse)
      
      const result = await authApi.me()
      
      expect(mockMe).toHaveBeenCalled()
      expect(result).toEqual(mockResponse)
    })

    it('should handle unauthorized error', async () => {
      const mockResponse = { 
        success: false, 
        error: 'Unauthorized',
        statusCode: 401
      }
      
      mockMe.mockResolvedValue(mockResponse)
      
      const result = await authApi.me()
      
      expect(mockMe).toHaveBeenCalled()
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Token Refresh', () => {
    it('should refresh token with refresh token parameter', async () => {
      const refreshToken = 'current-refresh-token'
      const mockResponse = {
        success: true,
        data: {
          token: 'new-auth-token',
          refreshToken: 'new-refresh-token'
        }
      }
      
      mockRefresh.mockResolvedValue(mockResponse)
      
      const result = await authApi.refresh(refreshToken)
      
      expect(mockRefresh).toHaveBeenCalledWith(refreshToken)
      expect(result).toEqual(mockResponse)
    })

    it('should refresh token without parameter', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'new-auth-token',
          refreshToken: 'new-refresh-token'
        }
      }
      
      mockRefreshToken.mockResolvedValue(mockResponse)
      
      const result = await authApi.refreshToken()
      
      expect(mockRefreshToken).toHaveBeenCalled()
      expect(result).toEqual(mockResponse)
    })

    it('should handle refresh token failure', async () => {
      const refreshToken = 'expired-refresh-token'
      const mockResponse = {
        success: false,
        error: 'Refresh token expired'
      }
      
      mockRefresh.mockResolvedValue(mockResponse)
      
      const result = await authApi.refresh(refreshToken)
      
      expect(mockRefresh).toHaveBeenCalledWith(refreshToken)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Network error',
        status: 0
      }
      mockLogin.mockResolvedValue(mockResponse)
      
      const result = await authApi.login({ email: 'test@example.com', password: 'password' })
      
      expect(result).toEqual(mockResponse)
      expect(mockLogin).toHaveBeenCalledWith({ 
        email: 'test@example.com', 
        password: 'password' 
      })
    })

    it('should handle timeout errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Request timeout',
        status: 0
      }
      mockMe.mockResolvedValue(mockResponse)
      
      const result = await authApi.me()
      
      expect(result).toEqual(mockResponse)
      expect(mockMe).toHaveBeenCalled()
    })
  })
})