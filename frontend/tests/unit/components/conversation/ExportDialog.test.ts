/**
 * ExportDialog.vue 單元測試
 *
 * 測試覆蓋範圍：
 * - 基礎渲染（標題、表單元素）
 * - Props 傳遞（conversationId、conversationTitle）
 * - 格式選擇（JSON/CSV/TXT）
 * - 日期範圍選擇
 * - 客戶/客服篩選下拉選單
 * - 最大筆數選擇
 * - 匯出流程（成功、失敗、loading 狀態）
 * - 關閉行為
 * - 條件顯示邏輯
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ExportDialog from '@/components/conversation/ExportDialog.vue'

// Mock dependencies
const mockExportMessages = vi.fn()
const mockGetExportCustomers = vi.fn()
const mockGetExportAgents = vi.fn()

vi.mock('@/api/export', () => ({
  exportMessages: (...args: unknown[]) => mockExportMessages(...args),
  getExportCustomers: () => mockGetExportCustomers(),
  getExportAgents: () => mockGetExportAgents()
}))

const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: vi.fn(),
    showWarning: vi.fn()
  })
}))

describe('ExportDialog.vue', () => {
  let wrapper: VueWrapper | null = null

  const defaultCustomers = [
    { id: 1, displayName: 'Customer A', platform: 'line', platformUserId: 'U001' },
    { id: 2, displayName: 'Customer B', platform: 'line', platformUserId: 'U002' }
  ]

  const defaultAgents = [
    { id: 'agent-1', displayName: 'Agent A', role: 'admin' },
    { id: 'agent-2', displayName: 'Agent B', role: 'agent' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a div for Teleport target
    const app = document.createElement('div')
    app.setAttribute('id', 'app')
    document.body.appendChild(app)

    // Default mock responses
    mockGetExportCustomers.mockResolvedValue({ success: true, data: defaultCustomers })
    mockGetExportAgents.mockResolvedValue({ success: true, data: defaultAgents })

    // Mock URL.createObjectURL / revokeObjectURL (not available in JSDOM)
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-blob')
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn()
    }
  })

  afterEach(async () => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    await flushPromises()
    vi.clearAllTimers()
    document.body.innerHTML = ''
  })

  function createWrapper(props: Record<string, unknown> = {}) {
    return mount(ExportDialog, {
      props: {
        show: true,
        ...props
      },
      attachTo: document.body
    })
  }

  // ==================== 基礎渲染 ====================

  describe('基礎渲染', () => {
    it('show=true 時應該渲染 Modal', async () => {
      wrapper = createWrapper()
      await nextTick()

      const modal = document.querySelector('.modal-overlay')
      expect(modal).toBeTruthy()
    })

    it('show=false 時不應該渲染 Modal', async () => {
      wrapper = mount(ExportDialog, {
        props: { show: false },
        attachTo: document.body
      })
      await nextTick()

      const modal = document.querySelector('.modal-overlay')
      expect(modal).toBeNull()
    })

    it('應該渲染格式選擇下拉選單', async () => {
      wrapper = createWrapper()
      await nextTick()

      const selects = document.querySelectorAll('.form-select')
      expect(selects.length).toBeGreaterThanOrEqual(1)
    })

    it('應該渲染日期範圍輸入', async () => {
      wrapper = createWrapper()
      await nextTick()

      const dateInputs = document.querySelectorAll('input[type="datetime-local"]')
      expect(dateInputs.length).toBe(2)
    })

    it('應該渲染匯出和取消按鈕', async () => {
      wrapper = createWrapper()
      await nextTick()

      const footer = document.querySelector('.modal-footer')
      expect(footer).toBeTruthy()

      const buttons = footer!.querySelectorAll('button')
      expect(buttons.length).toBe(2) // 取消 + 匯出
    })
  })

  // ==================== 對話資訊顯示 ====================

  describe('對話資訊 Banner', () => {
    it('有 conversationTitle 時應該顯示 Banner', async () => {
      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test Customer'
      })
      await nextTick()

      const banner = document.querySelector('.export-info-banner')
      expect(banner).toBeTruthy()
      expect(banner!.textContent).toContain('Test Customer')
    })

    it('沒有 conversationTitle 時不應該顯示 Banner', async () => {
      wrapper = createWrapper()
      await nextTick()

      const banner = document.querySelector('.export-info-banner')
      expect(banner).toBeNull()
    })
  })

  // ==================== 條件顯示邏輯 ====================

  describe('條件顯示邏輯', () => {
    it('沒有 conversationId 時應該顯示客戶篩選下拉', async () => {
      wrapper = createWrapper()
      await flushPromises()

      // 全部的 select 數量（格式 + 客戶 + 客服 + 筆數 = 4）
      const selects = document.querySelectorAll('.form-select')
      expect(selects.length).toBe(4)
    })

    it('有 conversationId 時應該隱藏客戶篩選下拉', async () => {
      wrapper = createWrapper({ conversationId: 'conv-123' })
      await flushPromises()

      // 格式 + 客服 + 筆數 = 3（客戶篩選被隱藏）
      const selects = document.querySelectorAll('.form-select')
      expect(selects.length).toBe(3)
    })
  })

  // ==================== 篩選選項載入 ====================

  describe('篩選選項載入', () => {
    it('打開時應該載入客戶和客服列表', async () => {
      wrapper = createWrapper()
      await flushPromises()

      expect(mockGetExportCustomers).toHaveBeenCalledTimes(1)
      expect(mockGetExportAgents).toHaveBeenCalledTimes(1)
    })

    it('載入失敗時不應該崩潰', async () => {
      mockGetExportCustomers.mockResolvedValue({ success: false, error: 'Server error' })
      mockGetExportAgents.mockResolvedValue({ success: false, error: 'Server error' })

      wrapper = createWrapper()
      await flushPromises()

      // 元件仍然應該正常渲染
      const modal = document.querySelector('.modal-overlay')
      expect(modal).toBeTruthy()
    })

    it('客戶列表載入後應該有正確的選項數量', async () => {
      wrapper = createWrapper()
      await flushPromises()

      // 找到第二個 select（客戶篩選），包含 "全部用戶" + 2 customers
      const selects = document.querySelectorAll('.form-select')
      const customerSelect = selects[1] // 第二個是客戶下拉
      const options = customerSelect?.querySelectorAll('option')
      expect(options!.length).toBe(3) // "全部用戶" + 2 customers
    })
  })

  // ==================== 格式選擇 ====================

  describe('格式選擇', () => {
    it('預設格式應該是 JSON', async () => {
      wrapper = createWrapper()
      await nextTick()

      const formatSelect = document.querySelector('.form-select') as HTMLSelectElement
      expect(formatSelect.value).toBe('json')
    })

    it('應該顯示格式提示文字', async () => {
      wrapper = createWrapper()
      await nextTick()

      const hint = document.querySelector('.form-hint')
      expect(hint).toBeTruthy()
      expect(hint!.textContent).toContain('結構化')
    })
  })

  // ==================== 匯出流程 ====================

  describe('匯出流程', () => {
    it('成功匯出時應該顯示成功通知', async () => {
      const mockBlob = new Blob(['test data'], { type: 'application/json' })
      mockExportMessages.mockResolvedValue({ success: true, data: mockBlob })

      wrapper = createWrapper()
      await flushPromises()

      // 點擊匯出按鈕
      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelectorAll('button')[1]
      exportBtn.click()
      await flushPromises()

      expect(mockExportMessages).toHaveBeenCalledTimes(1)
      expect(mockShowSuccess).toHaveBeenCalledWith('匯出成功', '對話記錄已開始下載')
    })

    it('匯出失敗時應該顯示錯誤通知', async () => {
      mockExportMessages.mockResolvedValue({ success: false, error: '伺服器錯誤' })

      wrapper = createWrapper()
      await flushPromises()

      // 點擊匯出按鈕
      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelectorAll('button')[1]
      exportBtn.click()
      await flushPromises()

      expect(mockShowError).toHaveBeenCalledWith('匯出失敗', '伺服器錯誤')
    })

    it('匯出過程中匯出按鈕應該禁用', async () => {
      // 讓匯出永遠 pending
      mockExportMessages.mockImplementation(() => new Promise(() => {}))

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelectorAll('button')[1]
      exportBtn.click()
      await nextTick()

      // 按鈕應該被禁用
      expect(exportBtn.getAttribute('disabled')).not.toBeNull()
    })

    it('有 conversationId 時匯出參數應該包含它', async () => {
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper({
        conversationId: 'conv-abc-123',
        conversationTitle: 'Test Customer'
      })
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelectorAll('button')[1]
      exportBtn.click()
      await flushPromises()

      expect(mockExportMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-abc-123'
        })
      )
    })
  })

  // ==================== 關閉行為 ====================

  describe('關閉行為', () => {
    it('點擊取消按鈕應該觸發 close 事件', async () => {
      wrapper = createWrapper()
      await nextTick()

      const footer = document.querySelector('.modal-footer')
      const cancelBtn = footer!.querySelectorAll('button')[0]
      cancelBtn.click()
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('打開時應該重置篩選條件', async () => {
      // 先創建為 hidden
      wrapper = mount(ExportDialog, {
        props: { show: false },
        attachTo: document.body
      })

      // 切換為顯示
      await wrapper.setProps({ show: true })
      await flushPromises()

      // 格式應該重置為 json
      const formatSelect = document.querySelector('.form-select') as HTMLSelectElement
      expect(formatSelect?.value).toBe('json')
    })
  })

  // ==================== 異常處理 ====================

  describe('異常處理', () => {
    it('exportMessages 拋出異常時應該顯示錯誤通知', async () => {
      mockExportMessages.mockRejectedValue(new Error('Unexpected error'))

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelectorAll('button')[1]
      exportBtn.click()
      await flushPromises()

      expect(mockShowError).toHaveBeenCalledWith('匯出失敗', '匯出過程中發生錯誤，請稍後再試')
    })

    it('exportMessages 回傳空 data 時應該顯示錯誤', async () => {
      mockExportMessages.mockResolvedValue({ success: true, data: null })

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelectorAll('button')[1]
      exportBtn.click()
      await flushPromises()

      expect(mockShowError).toHaveBeenCalled()
    })
  })
})
