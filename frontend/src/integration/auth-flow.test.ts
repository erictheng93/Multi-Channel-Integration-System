import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock所有依賴
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockSetAuthHeader = vi.fn()
const mockRemoveAuthHeader = vi.fn()

vi.mock('@/api/auth', () => ({
  authApi: {
    login: mockLogin,
    logout: mockLogout,
    setAuthHeader: mockSetAuthHeader,
    removeAuthHeader: mockRemoveAuthHeader
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn().mockResolvedValue(undefined)
  })
}))

// Helper function to create valid JWT token
function createValidJWT(userId: string = 'test-agent-id', role: string = 'agent'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
  }))
  const signature = btoa('test-signature')
  return `${header}.${payload}.${signature}`
}

describe('Integration: Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    
    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
    
    Object.defineProperty(global, 'window', {
      value: { localStorage: global.localStorage },
      writable: true
    })
  })

  it('should complete full login flow', async () => {
    const authToken = createValidJWT('1', 'agent')

    // Mock successful login response
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        token: authToken,
        agent: { id: '1', name: 'Test Agent', email: 'test@example.com' }
      }
    })

    // Import store after mocking
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    // Test initial state
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.token).toBe(null)
    expect(authStore.currentAgent).toBe(null)

    // Perform login
    const loginResult = await authStore.login({
      email: 'test@example.com',
      password: 'password123'
    })

    // Verify login success
    expect(loginResult).toBe(true)
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.token).toBe(authToken)
    expect(authStore.currentAgent).toEqual({
      id: '1',
      name: 'Test Agent',
      email: 'test@example.com'
    })

    // Verify API calls
    expect(mockLogin).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    })
    expect(mockSetAuthHeader).toHaveBeenCalled()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('token', authToken)
  })

  it('should handle complete logout flow', async () => {
    mockLogout.mockResolvedValue({ success: true })

    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    // Setup authenticated state
    authStore.token = createValidJWT('1', 'agent')
    authStore.currentAgent = {
      id: '1',
      name: 'Test Agent',
      displayName: 'Test Agent',
      email: 'test@example.com',
      isOnline: true,
      platforms: ['line'],
      role: 'agent',
      isActive: true,
      createdAt: Date.now()
    }

    // Perform logout
    await authStore.logout()

    // Verify logout
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.token).toBe(null)
    expect(authStore.currentAgent).toBe(null)

    // Verify API calls
    expect(mockLogout).toHaveBeenCalled()
    expect(mockRemoveAuthHeader).toHaveBeenCalled()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('token')
  })

  it('should handle login failure correctly', async () => {
    // Mock failed login response
    mockLogin.mockResolvedValue({
      success: false,
      error: 'Invalid credentials'
    })

    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    // Attempt login
    const loginResult = await authStore.login({
      email: 'wrong@example.com',
      password: 'wrongpassword'
    })

    // Verify failure handling
    expect(loginResult).toBe(false)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.error).toBe('Invalid credentials')
    expect(authStore.token).toBe(null)
    expect(authStore.currentAgent).toBe(null)

    // Verify no auth headers were set
    expect(mockSetAuthHeader).not.toHaveBeenCalled()
    expect(global.localStorage.setItem).not.toHaveBeenCalledWith('token', expect.any(String))
  })

  it('should maintain session persistence', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()

    // Test session validation with valid token
    authStore.token = createValidJWT('1', 'agent')
    authStore.sessionExpiry = Date.now() + 10000 // 10 seconds in future
    expect(authStore.validateSession()).toBe(true)

    // Test session validation with expired token
    authStore.sessionExpiry = Date.now() - 10000 // 10 seconds in past
    expect(authStore.validateSession()).toBe(false)

    // Test session validation without token
    authStore.token = null
    expect(authStore.validateSession()).toBe(false)
  })
})