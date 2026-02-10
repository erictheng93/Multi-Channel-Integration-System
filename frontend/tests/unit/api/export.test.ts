/**
 * Export API Module 單元測試
 *
 * 測試覆蓋範圍：
 * - exportMessages(): 參數驗證、Blob 下載、錯誤處理
 * - getExportCustomers(): API 呼叫與回傳
 * - getExportAgents(): API 呼叫與回傳
 * - 輸入清理 (sanitization)
 * - 邊緣情況
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock apiClient before importing the module
vi.mock('@/api/base', () => ({
  apiClient: {
    get: vi.fn()
  }
}))

// Mock runtime config
vi.mock('@/config/runtime', () => ({
  getBackendUrl: vi.fn(() => 'https://test-backend.example.com')
}))

import { exportMessages, getExportCustomers, getExportAgents } from '@/api/export'
import { apiClient } from '@/api/base'

describe('Export API Module', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = global.fetch
    // Mock localStorage.getItem for auth token (vitest.setup.ts replaces localStorage with a mock)
    if (window.localStorage && typeof window.localStorage.getItem === 'function') {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'token') return 'test-token-123'
        return null
      })
    }
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ==================== exportMessages ====================

  describe('exportMessages()', () => {
    it('應該使用預設參數成功匯出', async () => {
      const mockBlob = new Blob(['test data'], { type: 'application/json' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })

      const result = await exportMessages()

      expect(result.success).toBe(true)
      expect(result.data).toBeInstanceOf(Blob)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // 驗證 URL 包含 format=json（預設值）
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('format=json')
    })

    it('應該正確傳遞所有篩選參數', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })

      await exportMessages({
        format: 'csv',
        conversationId: 'conv-123',
        dateFrom: '2025-01-01T00:00:00Z',
        dateTo: '2025-12-31T23:59:59Z',
        customerId: '42',
        agentId: 'agent-abc',
        limit: 500
      })

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('format=csv')
      expect(url).toContain('conversationId=conv-123')
      expect(url).toContain('dateFrom=')
      expect(url).toContain('dateTo=')
      expect(url).toContain('customerId=42')
      expect(url).toContain('agentId=agent-abc')
      expect(url).toContain('limit=500')
    })

    it('應該傳送 Authorization header', async () => {
      const mockBlob = new Blob(['data'])
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })

      await exportMessages({ format: 'json' })

      const headers = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers
      expect(headers['Authorization']).toBe('Bearer test-token-123')
    })

    it('應該支援 txt 格式', async () => {
      const mockBlob = new Blob(['text data'], { type: 'text/plain' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })

      const result = await exportMessages({ format: 'txt' })

      expect(result.success).toBe(true)
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('format=txt')
    })

    it('應該在 HTTP 403 時回傳權限不足錯誤', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403
      })

      const result = await exportMessages()

      expect(result.success).toBe(false)
      expect(result.error).toBe('權限不足')
    })

    it('應該在 HTTP 404 時回傳端點不存在錯誤', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await exportMessages()

      expect(result.success).toBe(false)
      expect(result.error).toBe('匯出端點不存在')
    })

    it('應該在 HTTP 500 時回傳匯出失敗錯誤', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await exportMessages()

      expect(result.success).toBe(false)
      expect(result.error).toBe('匯出失敗')
    })

    it('應該在網路錯誤時回傳錯誤', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await exportMessages()

      expect(result.success).toBe(false)
      expect(result.error).toBe('匯出請求失敗，請檢查網路連線')
    })

    // ==================== 輸入清理 ====================

    describe('輸入清理 (Sanitization)', () => {
      beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(new Blob(['data']))
        })
      })

      it('應該過濾不合法的 conversationId', async () => {
        await exportMessages({ conversationId: '<script>alert(1)</script>' })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).not.toContain('conversationId')
      })

      it('應該接受合法的 conversationId', async () => {
        await exportMessages({ conversationId: 'conv-123_abc' })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).toContain('conversationId=conv-123_abc')
      })

      it('應該過濾不合法的 customerId（非數字）', async () => {
        await exportMessages({ customerId: 'abc' })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).not.toContain('customerId')
      })

      it('應該接受合法的 customerId（純數字）', async () => {
        await exportMessages({ customerId: '42' })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).toContain('customerId=42')
      })

      it('應該過濾不合法的日期', async () => {
        await exportMessages({ dateFrom: 'not-a-date' })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).not.toContain('dateFrom')
      })

      it('應該接受合法的 ISO 日期', async () => {
        await exportMessages({ dateFrom: '2025-01-01T00:00:00Z' })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).toContain('dateFrom=')
      })

      it('應該限制 limit 範圍（過大值不傳遞）', async () => {
        await exportMessages({ limit: 5000 })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).not.toContain('limit=5000')
      })

      it('應該接受合法的 limit 值', async () => {
        await exportMessages({ limit: 500 })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).toContain('limit=500')
      })

      it('應該不傳遞空字串參數', async () => {
        await exportMessages({
          conversationId: '',
          customerId: '',
          agentId: ''
        })

        const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(url).not.toContain('conversationId')
        expect(url).not.toContain('customerId')
        expect(url).not.toContain('agentId')
      })
    })
  })

  // ==================== getExportCustomers ====================

  describe('getExportCustomers()', () => {
    it('應該呼叫正確的端點', async () => {
      const mockItems = [
        { id: 1, displayName: 'Customer A', platform: 'line', platformUserId: 'U123' },
        { id: 2, displayName: 'Customer B', platform: 'line', platformUserId: 'U456' }
      ]
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: { items: mockItems, total: 2 } })

      const result = await getExportCustomers()

      expect(apiClient.get).toHaveBeenCalledWith('/customers?pageSize=200')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockItems)
    })

    it('應該處理 API 錯誤', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: false, error: 'Server error' })

      const result = await getExportCustomers()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Server error')
    })

    it('應該處理空列表', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: { items: [], total: 0 } })

      const result = await getExportCustomers()

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  // ==================== getExportAgents ====================

  describe('getExportAgents()', () => {
    it('應該呼叫正確的端點', async () => {
      const mockData = [
        { id: 'agent-1', displayName: 'Agent A', role: 'admin' },
        { id: 'agent-2', displayName: 'Agent B', role: 'agent' }
      ]
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: mockData })

      const result = await getExportAgents()

      expect(apiClient.get).toHaveBeenCalledWith('/messages/export/agents')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
    })

    it('應該處理 API 錯誤', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: false, error: 'Unauthorized' })

      const result = await getExportAgents()

      expect(result.success).toBe(false)
    })
  })
})
