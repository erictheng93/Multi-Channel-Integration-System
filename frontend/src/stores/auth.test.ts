import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// 創建mock函數
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockGetCurrentAgent = vi.fn()
const mockSetAuthHeader = vi.fn()
const mockRemoveAuthHeader = vi.fn()
const mockApiClientRefreshAuthToken = vi.fn()

// Mock router
const mockRouterPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush
  })
}))

// Mock authApi模組 - 在import之前
vi.mock('@/api/auth', () => ({
  authApi: {
    login: mockLogin,
    logout: mockLogout,
    me: mockGetCurrentAgent,
    setAuthHeader: mockSetAuthHeader,
    removeAuthHeader: mockRemoveAuthHeader
  }
}))

// Mock apiClient - refreshAuthToken is now the unified refresh path
vi.mock('@/api/base', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    setContextTeam: vi.fn(),
    getContextTeam: vi.fn(),
    getCurrentToken: vi.fn(),
    refreshAuthToken: mockApiClientRefreshAuthToken
  }
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

describe('Auth Store', () => {
  beforeEach(() => {
    // 重置所有mock
    vi.clearAllMocks()
    mockLogin.mockReset()
    mockLogout.mockReset()
    mockGetCurrentAgent.mockReset()
    mockApiClientRefreshAuthToken.mockReset()
    mockSetAuthHeader.mockReset()
    mockRemoveAuthHeader.mockReset()
    mockRouterPush.mockReset()
    
    // 創建新的Pinia實例
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

    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
    
    // Mock window (includes addEventListener for auth:token-refreshed listener)
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: global.localStorage,
        sessionStorage: global.sessionStorage,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { pathname: '/dashboard', href: '' }
      },
      writable: true
    })
  })

  it('should initialize with default state', async () => {
    // 確保 localStorage 返回 null
    vi.mocked(global.localStorage.getItem).mockReturnValue(null)
    
    // 動態導入store以避免初始化時機問題
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.currentAgent).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('should handle successful login', async () => {
    const mockToken = createValidJWT('1', 'agent')
    const mockAgent = { id: '1', name: 'Test Agent', email: 'test@example.com' }

    mockLogin.mockResolvedValue({
      success: true,
      data: { token: mockToken, agent: mockAgent }
    })

    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    const result = await store.login({ email: 'test@example.com', password: 'password' })

    expect(result).toBe(true)
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(true)
    expect(store.currentAgent).toEqual(mockAgent)
    expect(mockSetAuthHeader).not.toHaveBeenCalled()
    expect(global.sessionStorage.setItem).not.toHaveBeenCalledWith('token', mockToken)
    expect(global.sessionStorage.setItem).toHaveBeenCalledWith('currentAgent', JSON.stringify(mockAgent))
    expect(global.localStorage.setItem).not.toHaveBeenCalledWith('token', mockToken)
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('token')
  })

  it('should handle failed login', async () => {
    // 確保 localStorage 返回 null
    vi.mocked(global.localStorage.getItem).mockReturnValue(null)
    
    mockLogin.mockResolvedValue({
      success: false,
      error: 'Invalid credentials'
    })
    
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    const result = await store.login({ email: 'test@example.com', password: 'wrong-password' })
    
    expect(result).toBe(false)
    expect(store.error).toBe('Invalid credentials')
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.currentAgent).toBeNull()
  })

  it('should handle logout', async () => {
    mockLogout.mockResolvedValue({ success: true })

    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()

    // Setup initial authenticated state
    store.token = createValidJWT('1', 'agent')
    store.currentAgent = {
      id: '1',
      name: 'Test Agent',
      displayName: 'Test Agent',
      email: 'test@example.com',
      isOnline: true,
      platforms: ['line'],
      isActive: true,
      createdAt: Date.now(),
      role: 'agent'
    }

    await store.logout()

    expect(store.token).toBe(null)
    expect(store.isAuthenticated).toBe(false)
    expect(store.currentAgent).toBe(null)
    expect(mockRemoveAuthHeader).toHaveBeenCalled()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('token')
  })

  it('should validate session correctly', async () => {
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()

    // Test invalid session (no cookie-backed session metadata)
    expect(store.validateSession()).toBe(false)

    // Test valid session metadata
    store.sessionExpiry = Date.now() + 10000 // 10 seconds in future
    expect(store.validateSession()).toBe(true)

    // Test expired session
    store.sessionExpiry = Date.now() - 10000 // 10 seconds in past
    expect(store.validateSession()).toBe(false)
  })

  it('should fetch current agent', async () => {
    const mockAgent = { id: '1', name: 'Test Agent', email: 'test@example.com' }

    mockGetCurrentAgent.mockResolvedValue({
      success: true,
      data: mockAgent
    })

    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    store.token = createValidJWT('1', 'agent') // Set token so fetchCurrentAgent will execute
    await store.fetchCurrentAgent()

    // preserveTeamState() always injects multi-team defaults (primaryTeamId,
    // allowedTeamIds, teamRoles) on top of the API payload, so only assert
    // that the API-returned fields flow through.
    expect(store.currentAgent).toMatchObject(mockAgent)
  })

  it('should handle token refresh via apiClient', async () => {
    const newToken = createValidJWT('1', 'agent')

    mockApiClientRefreshAuthToken.mockResolvedValue(newToken)
    // Mock sessionStorage to return refresh token after apiClient updates it
    vi.mocked(global.sessionStorage.getItem).mockImplementation((key) => {
      if (key === 'refreshToken') {
        return createValidJWT('1', 'agent')
      }
      return null
    })

    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    store.token = createValidJWT('1', 'agent')
    store.refreshToken = createValidJWT('1', 'agent')

    const result = await store.refreshAuthToken()

    expect(result.success).toBe(true)
    expect(store.token).toBe(newToken)
    expect(mockApiClientRefreshAuthToken).toHaveBeenCalled()
  })

  it('should handle login validation', async () => {
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    
    // Mock validation failures in authApi
    mockLogin.mockResolvedValue({
      success: false,
      error: '請輸入電子郵件'
    })
    
    // Test empty email
    const result1 = await store.login({ email: '', password: 'password' })
    expect(result1).toBe(false)
    expect(store.error).toBe('請輸入電子郵件')
    
    mockLogin.mockResolvedValue({
      success: false,
      error: '請輸入密碼'
    })
    
    // Test empty password
    const result2 = await store.login({ email: 'test@example.com', password: '' })
    expect(result2).toBe(false)
    expect(store.error).toBe('請輸入密碼')
  })

  it('should detect session as expired when session expiry is in the past', async () => {
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    store.sessionExpiry = Date.now() - 3600
    expect(store.isTokenExpired()).toBe(true)
  })

  it('should detect session as NOT expired when session expiry is in the future', async () => {
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    store.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000
    expect(store.isTokenExpired()).toBe(false)
  })

  it('should recommend refresh when session expiry is within 30 minutes', async () => {
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    store.sessionExpiry = Date.now() + 20 * 60 * 1000
    expect(store.shouldRefreshToken()).toBe(true)
  })

  it('should NOT recommend refresh when session expiry is more than 30 minutes away', async () => {
    const { useAuthStore } = await import('./auth')
    const store = useAuthStore()
    store.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000
    expect(store.shouldRefreshToken()).toBe(false)
  })
})
