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
    setAuthHeader: vi.fn()
  }
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
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
      // 模擬登入成功響應
      const mockLoginResponse = {
        success: true,
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          agent: mockAgent
        }
      }

      vi.mocked(authApi.login).mockResolvedValue(mockLoginResponse)

      // 執行登入
      const result = await authStore.login({ 
        email: 'test@example.com', 
        password: 'password' 
      })

      // 驗證狀態立即更新
      expect(result).toBe(true)
      expect(authStore.token).toBe('test-token')
      expect(authStore.refreshToken).toBe('test-refresh-token')
      expect(authStore.currentAgent).toEqual(mockAgent)
      expect(authStore.sessionStatus).toBe('authenticated')

      // 驗證 localStorage 同步
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'test-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'test-refresh-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('currentAgent', JSON.stringify(mockAgent))
      
      // 驗證 API 客戶端認證標頭設定
      expect(authApi.setAuthHeader).toHaveBeenCalledWith('test-token', 'test-refresh-token')
    })
  })

  describe('智能會話初始化 - 避免額外 API 請求', () => {
    it('當有有效快取資料時，應該跳過 /auth/me 請求', async () => {
      // 設定已有的認證狀態（模擬從 localStorage 恢復）
      authStore.token = 'existing-token'
      authStore.currentAgent = mockAgent
      authStore.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天後過期

      // 執行會話初始化
      await authStore.initializeSession()

      // 驗證：沒有調用 authApi.me
      expect(authApi.me).not.toHaveBeenCalled()
      expect(authStore.sessionStatus).toBe('authenticated')
    })

    it('當沒有快取資料時，才應該發送 /auth/me 請求', async () => {
      // 設定只有 token，沒有 currentAgent
      authStore.token = 'existing-token'
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
      // 設定無效的 agent 資料
      authStore.token = 'existing-token'
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
      authStore.token = 'test-token'
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
      // 1. 模擬登入成功
      const mockLoginResponse = {
        success: true,
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
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
      newStore.token = 'test-token'
      newStore.currentAgent = mockAgent
      newStore.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

      await newStore.initializeSession()

      // 3. 模擬多次 fetchCurrentAgent 調用
      await newStore.fetchCurrentAgent()
      await newStore.fetchCurrentAgent()
      await newStore.fetchCurrentAgent()

      // 驗證：整個流程中 /auth/me 最多只被調用 0 次（因為登入時已經獲得用戶資料）
      expect(authApi.me).toHaveBeenCalledTimes(0)
    })
  })
})