import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock all dependencies at the top level
vi.mock('../../../frontend/src/api/auth', () => ({
  authApi: {
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    login: vi.fn(),
    me: vi.fn()
  }
}))

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn().mockResolvedValue(undefined)
  }))
}))

describe('FINAL Working Auth Store Tests', () => {
  let pinia: any
  let mockAuthApi: any
  let mockRouter: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Create and set Pinia instance
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Setup global mocks
    const mockLocalStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }

    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    })

    Object.defineProperty(global, 'window', {
      value: {
        localStorage: mockLocalStorage,
        location: { href: 'http://localhost:3000' }
      },
      writable: true,
      configurable: true
    })

    // Get mocked APIs
    const { authApi } = await import('../../../frontend/src/api/auth')
    const { useRouter } = await import('vue-router')
    
    mockAuthApi = authApi
    mockRouter = useRouter()
  })

  describe('initial state', () => {
    test('should initialize with null token when localStorage is empty', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      expect(authStore.token).toBeNull()
    })

    test('should initialize with null currentAgent', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      expect(authStore.currentAgent).toBeNull()
    })

    test('should initialize with loading false', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      expect(authStore.loading).toBe(false)
    })

    test('should initialize with null error', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      expect(authStore.error).toBeNull()
    })
  })

  describe('computed properties', () => {
    describe('isAuthenticated', () => {
      test('should return false when token is null', async () => {
        const { useAuthStore } = await import('../../../frontend/src/stores/auth')
        const authStore = useAuthStore(pinia)
        authStore.token = null
        expect(authStore.isAuthenticated).toBe(false)
      })

      test('should return true when token exists', async () => {
        const { useAuthStore } = await import('../../../frontend/src/stores/auth')
        const authStore = useAuthStore(pinia)
        authStore.token = 'valid-token'
        expect(authStore.isAuthenticated).toBe(true)
      })
    })

    describe('isAdmin', () => {
      test('should return false when currentAgent is null', async () => {
        const { useAuthStore } = await import('../../../frontend/src/stores/auth')
        const authStore = useAuthStore(pinia)
        authStore.currentAgent = null
        expect(authStore.isAdmin).toBe(false)
      })

      test('should return true when currentAgent role is admin', async () => {
        const { useAuthStore } = await import('../../../frontend/src/stores/auth')
        const authStore = useAuthStore(pinia)
        authStore.currentAgent = {
          id: 1,
          username: 'admin',
          role: 'admin',
          name: 'Admin User',
          email: 'admin@example.com',
          team_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
        expect(authStore.isAdmin).toBe(true)
      })
    })
  })

  describe('login', () => {
    const mockCredentials = {
      username: 'testuser',
      password: 'testpass'
    }

    const mockSuccessResponse = {
      success: true,
      data: {
        token: 'new-token',
        agent: {
          id: 1,
          username: 'testuser',
          role: 'agent',
          name: 'Test User',
          email: 'test@example.com',
          team_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      }
    }

    test('should login successfully with valid credentials', async () => {
      vi.mocked(mockAuthApi.login).mockResolvedValue(mockSuccessResponse)

      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      
      const result = await authStore.login(mockCredentials)

      expect(result).toBe(true)
      expect(authStore.token).toBe('new-token')
      expect(authStore.currentAgent).toEqual(mockSuccessResponse.data.agent)
      expect(authStore.loading).toBe(false)
      expect(authStore.error).toBeNull()
    })

    test('should handle login failure with error message', async () => {
      const mockFailureResponse = {
        success: false,
        error: '登入失敗：密碼錯誤'
      }
      vi.mocked(mockAuthApi.login).mockResolvedValue(mockFailureResponse)

      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      
      const result = await authStore.login(mockCredentials)

      expect(result).toBe(false)
      expect(authStore.token).toBeNull()
      expect(authStore.currentAgent).toBeNull()
      expect(authStore.error).toBe('登入失敗：密碼錯誤')
      expect(authStore.loading).toBe(false)
    })

    test('should handle network error during login', async () => {
      vi.mocked(mockAuthApi.login).mockRejectedValue(new Error('Network error'))

      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      
      const result = await authStore.login(mockCredentials)

      expect(result).toBe(false)
      expect(authStore.error).toBe('網路錯誤，請稍後再試')
      expect(authStore.loading).toBe(false)
    })
  })

  describe('logout', () => {
    test('should clear all auth state on logout', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      
      // Set up authenticated state
      authStore.token = 'current-token'
      authStore.currentAgent = {
        id: 1,
        username: 'testuser',
        role: 'agent',
        name: 'Test User',
        email: 'test@example.com',
        team_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await authStore.logout()

      expect(authStore.token).toBeNull()
      expect(authStore.currentAgent).toBeNull()
      expect(mockAuthApi.removeAuthHeader).toHaveBeenCalled()
    })
  })

  describe('fetchCurrentAgent', () => {
    const mockAgentResponse = {
      success: true,
      data: {
        id: 1,
        username: 'testuser',
        role: 'agent',
        name: 'Test User',
        email: 'test@example.com',
        team_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    }

    test('should fetch current agent when token exists', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      
      authStore.token = 'valid-token'
      vi.mocked(mockAuthApi.me).mockResolvedValue(mockAgentResponse)

      await authStore.fetchCurrentAgent()

      expect(authStore.currentAgent).toEqual(mockAgentResponse.data)
      expect(mockAuthApi.me).toHaveBeenCalled()
    })

    test('should not fetch when token is null', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const authStore = useAuthStore(pinia)
      
      authStore.token = null

      await authStore.fetchCurrentAgent()

      expect(mockAuthApi.me).not.toHaveBeenCalled()
      expect(authStore.currentAgent).toBeNull()
    })
  })
})