// 前端狀態管理優化性能測試
// 驗證登入後是否避免額外的 /auth/me 請求

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { createPinia, setActivePinia } from 'pinia'

// Mock authApi
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn()
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

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
})

describe('前端狀態管理優化測試', () => {
  let authStore: ReturnType<typeof useAuthStore>
  const mockAgent = {
    id: 'test-agent-id',
    email: 'test@example.com',
    name: 'Test Agent',
    displayName: 'Test Agent',
    role: 'agent' as const,
    teamId: 1,
    isActive: true,
    createdAt: Date.now()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    authStore = useAuthStore()
  })

  describe('登入成功後狀態更新', () => {
    it('應該立即設定所有認證狀態', async () => {
      const validToken = createValidJWT('test-agent-id', 'agent')
      const validRefreshToken = createValidJWT('test-agent-id', 'agent')

      // 模擬登入成功響應
      const mockLoginResponse = {
        success: true,
        data: {
          token: validToken,
          refreshToken: validRefreshToken,
          agent: mockAgent
        }
      }

      vi.mocked(authApi.login).mockResolvedValue(mockLoginResponse)

      // 執行登入
      const result = await authStore.login({
        email: 'test@example.com',
        password: 'password'
      })

      // 驗證狀態立即更新。憑證改存 HttpOnly cookie，
      // store 不得把 token 鏡像到 JS 狀態或 web storage。
      expect(result).toBe(true)
      expect(authStore.token).toBeNull()
      expect(authStore.refreshToken).toBeNull()
      expect(authStore.currentAgent).toEqual(mockAgent)
      expect(authStore.sessionStatus).toBe('authenticated')

      // 驗證 session-scoped auth storage 同步（不得寫入任何 token）
      expect(mockSessionStorage.setItem).not.toHaveBeenCalledWith('token', expect.anything())
      expect(mockSessionStorage.setItem).not.toHaveBeenCalledWith('refreshToken', expect.anything())
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('currentAgent', JSON.stringify(mockAgent))
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('token', validToken)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token')

      // HttpOnly cookie 模式下不再設定 API 客戶端 Authorization 標頭
      expect(authApi.setAuthHeader).not.toHaveBeenCalled()
    })
  })

  describe('智能會話初始化 - 避免額外 API 請求', () => {
    it('即使有快取資料，也必須呼叫一次 /auth/me 驗證 HttpOnly cookie session', async () => {
      // 設定已有的認證狀態（模擬從 sessionStorage 恢復）
      authStore.currentAgent = mockAgent
      authStore.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天後過期

      vi.mocked(authApi.me).mockResolvedValue({ success: true, data: mockAgent })

      // 執行會話初始化
      await authStore.initializeSession()

      // 驗證：HttpOnly cookie 無法由 JS 讀取，必須向後端驗證一次
      expect(authApi.me).toHaveBeenCalledTimes(1)
      expect(authStore.sessionStatus).toBe('authenticated')
    })

    it('當沒有快取資料時，才應該發送 /auth/me 請求', async () => {
      const validToken = createValidJWT('test-agent-id', 'agent')

      // 設定只有 token，沒有 currentAgent
      authStore.token = validToken
      authStore.currentAgent = null
      authStore.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

      // 模擬 /auth/me 響應
      vi.mocked(authApi.me).mockResolvedValue({
        success: true,
        data: mockAgent
      })

      // 執行會話初始化
      await authStore.initializeSession()

      // 驗證：應該調用 authApi.me
      expect(authApi.me).toHaveBeenCalledTimes(1)
      expect(authStore.currentAgent).toEqual(mockAgent)
      expect(authStore.sessionStatus).toBe('authenticated')
    })

    it('當 agent 資料無效時，應該發送 /auth/me 請求', async () => {
      const validToken = createValidJWT('test-agent-id', 'agent')

      // 設定無效的 agent 資料
      authStore.token = validToken
      authStore.currentAgent = {
        id: '',
        email: '',
        name: '',
        displayName: '',
        role: 'agent' as const,
        isActive: false,
        createdAt: 0
      }
      authStore.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

      vi.mocked(authApi.me).mockResolvedValue({
        success: true,
        data: mockAgent
      })

      // 執行會話初始化
      await authStore.initializeSession()

      // 驗證：應該調用 authApi.me 重新獲取有效資料
      expect(authApi.me).toHaveBeenCalledTimes(1)
      expect(authStore.currentAgent).toEqual(mockAgent)
    })
  })

  describe('智能 fetchCurrentAgent 函數', () => {
    beforeEach(() => {
      const validToken = createValidJWT('test-agent-id', 'agent')
      authStore.token = validToken
    })

    it('當已有有效資料時，應該跳過 API 請求', async () => {
      authStore.currentAgent = mockAgent

      await authStore.fetchCurrentAgent()

      // 驗證：沒有調用 authApi.me
      expect(authApi.me).not.toHaveBeenCalled()
    })

    it('當強制刷新時，應該發送 API 請求', async () => {
      authStore.currentAgent = mockAgent

      vi.mocked(authApi.me).mockResolvedValue({
        success: true,
        data: mockAgent
      })

      await authStore.fetchCurrentAgent(true) // forceRefresh = true

      // 驗證：應該調用 authApi.me
      expect(authApi.me).toHaveBeenCalledTimes(1)
    })

    it('當沒有資料時，應該發送 API 請求', async () => {
      authStore.currentAgent = null

      vi.mocked(authApi.me).mockResolvedValue({
        success: true,
        data: mockAgent
      })

      await authStore.fetchCurrentAgent()

      // 驗證：應該調用 authApi.me
      expect(authApi.me).toHaveBeenCalledTimes(1)
      expect(authStore.currentAgent).toEqual(mockAgent)
    })
  })

  describe('性能指標驗證', () => {
    it('完整的登入->初始化流程應該最多只發送 1 次 /auth/me', async () => {
      const validToken = createValidJWT('test-agent-id', 'agent')
      const validRefreshToken = createValidJWT('test-agent-id', 'agent')

      // 1. 模擬登入成功
      const mockLoginResponse = {
        success: true,
        data: {
          token: validToken,
          refreshToken: validRefreshToken,
          agent: mockAgent
        }
      }

      vi.mocked(authApi.login).mockResolvedValue(mockLoginResponse)

      // 執行登入
      await authStore.login({
        email: 'test@example.com',
        password: 'password'
      })

      // 2. 模擬應用重啟後的會話初始化（有快取資料）
      const newStore = useAuthStore()
      newStore.token = validToken
      newStore.currentAgent = mockAgent
      newStore.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

      vi.mocked(authApi.me).mockResolvedValue({ success: true, data: mockAgent })

      await newStore.initializeSession()

      // 3. 模擬多次 fetchCurrentAgent 調用
      await newStore.fetchCurrentAgent()
      await newStore.fetchCurrentAgent()
      await newStore.fetchCurrentAgent()

      // 驗證：cookie session 驗證恰好打一次 /auth/me，
      // 其後 fetchCurrentAgent 走快取不再重複請求
      expect(authApi.me).toHaveBeenCalledTimes(1)
    })
  })
})
