/**
 * ExportDialog.vue 單元測試
 *
 * 測試覆蓋範圍：
 * - 基礎渲染（標題、表單元素）
 * - Props 傳遞（conversationId、conversationTitle）
 * - 格式選擇（JSON/CSV/TXT segmented control）
 * - 日期範圍選擇
 * - 客戶篩選下拉選單（placeholder + __all__ sentinel）
 * - 匯出流程（成功、失敗、loading 狀態）
 * - 智慧驗證（count-first approach）
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
const mockGetExportCount = vi.fn()

vi.mock('@/api/export', () => ({
  exportMessages: (...args: unknown[]) => mockExportMessages(...args),
  getExportCustomers: () => mockGetExportCustomers(),
  getExportCount: (...args: unknown[]) => mockGetExportCount(...args)
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

const mockShowWarning = vi.fn()

vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showConfirm: vi.fn(),
    showWarning: mockShowWarning,
    showDanger: vi.fn(),
    showInfo: vi.fn(),
    clearDialogs: vi.fn()
  })
}))

describe('ExportDialog.vue', () => {
  let wrapper: VueWrapper | null = null

  const defaultCustomers = [
    { id: 1, displayName: 'Customer A', platform: 'line', platformUserId: 'U001' },
    { id: 2, displayName: 'Customer B', platform: 'line', platformUserId: 'U002' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a div for Teleport target
    const app = document.createElement('div')
    app.setAttribute('id', 'app')
    document.body.appendChild(app)

    // Default mock responses
    mockGetExportCustomers.mockResolvedValue({ success: true, data: defaultCustomers })
    mockGetExportCount.mockResolvedValue({ success: true, data: { count: 50, limit: 5000, willBeTruncated: false } })
    mockShowWarning.mockResolvedValue(true)

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

    it('應該渲染格式 segmented control', async () => {
      wrapper = createWrapper()
      await nextTick()

      const segments = document.querySelectorAll('.segment')
      expect(segments.length).toBe(4) // JSON, CSV, TXT, PDF
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
      expect(buttons.length).toBe(2) // 匯出 + 取消
    })
  })

  // ==================== 對話資訊顯示 ====================

  describe('對話資訊 Card', () => {
    it('有 conversationTitle 時應該顯示 info card', async () => {
      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test Customer'
      })
      await nextTick()

      const card = document.querySelector('.export-info-card')
      expect(card).toBeTruthy()
      expect(card!.textContent).toContain('Test Customer')
    })

    it('沒有 conversationTitle 時不應該顯示 info card', async () => {
      wrapper = createWrapper()
      await nextTick()

      const card = document.querySelector('.export-info-card')
      expect(card).toBeNull()
    })
  })

  // ==================== 條件顯示邏輯 ====================

  describe('條件顯示邏輯', () => {
    it('沒有 conversationId 時應該顯示客戶篩選下拉', async () => {
      wrapper = createWrapper()
      await flushPromises()

      // 客戶篩選 select 應該存在
      const selects = document.querySelectorAll('.apple-select')
      expect(selects.length).toBe(1) // 客戶篩選
    })

    it('有 conversationId 時應該隱藏客戶篩選下拉', async () => {
      wrapper = createWrapper({ conversationId: 'conv-123' })
      await flushPromises()

      // 客戶篩選被隱藏，沒有 select 了
      const selects = document.querySelectorAll('.apple-select')
      expect(selects.length).toBe(0)
    })
  })

  // ==================== 客戶下拉選單 placeholder ====================

  describe('客戶下拉選單 placeholder', () => {
    it('預設應顯示「請選擇用戶」placeholder 而非「全部用戶」', async () => {
      wrapper = createWrapper()
      await flushPromises()

      const customerSelect = document.querySelector('.apple-select') as HTMLSelectElement
      expect(customerSelect).toBeTruthy()

      // 選中的值應為空字串（disabled placeholder）
      expect(customerSelect.value).toBe('')

      // 第一個 option 是 disabled placeholder
      const firstOption = customerSelect.querySelector('option') as HTMLOptionElement
      expect(firstOption.textContent).toContain('請選擇用戶')
      expect(firstOption.disabled).toBe(true)
    })

    it('應包含「全部用戶」作為可選選項', async () => {
      wrapper = createWrapper()
      await flushPromises()

      const customerSelect = document.querySelector('.apple-select')
      const options = customerSelect?.querySelectorAll('option')
      // placeholder + "全部用戶" + 2 customers = 4
      expect(options!.length).toBe(4)

      // 第二個 option 是「全部用戶」，value 為 __all__
      const allOption = options![1] as HTMLOptionElement
      expect(allOption.textContent).toContain('全部用戶')
      expect(allOption.value).toBe('__all__')
    })
  })

  // ==================== 篩選選項載入 ====================

  describe('篩選選項載入', () => {
    it('打開時應該載入客戶列表', async () => {
      wrapper = createWrapper()
      await flushPromises()

      expect(mockGetExportCustomers).toHaveBeenCalledTimes(1)
    })

    it('載入失敗時不應該崩潰', async () => {
      mockGetExportCustomers.mockResolvedValue({ success: false, error: 'Server error' })

      wrapper = createWrapper()
      await flushPromises()

      // 元件仍然應該正常渲染
      const modal = document.querySelector('.modal-overlay')
      expect(modal).toBeTruthy()
    })

    it('客戶列表載入後應該有正確的選項數量', async () => {
      wrapper = createWrapper()
      await flushPromises()

      // 找到客戶篩選 select：placeholder + "全部用戶" + 2 customers
      const customerSelect = document.querySelector('.apple-select')
      const options = customerSelect?.querySelectorAll('option')
      expect(options!.length).toBe(4)
    })
  })

  // ==================== 格式選擇 ====================

  describe('格式選擇', () => {
    it('預設格式應該是 JSON（active segment）', async () => {
      wrapper = createWrapper()
      await nextTick()

      const activeSegment = document.querySelector('.segment.active')
      expect(activeSegment).toBeTruthy()
      expect(activeSegment!.textContent).toContain('JSON')
    })

    it('應該顯示格式提示文字', async () => {
      wrapper = createWrapper()
      await nextTick()

      const hint = document.querySelector('.section-hint')
      expect(hint).toBeTruthy()
      expect(hint!.textContent).toContain('結構化')
    })
  })

  // ==================== 匯出流程 ====================

  describe('匯出流程', () => {
    it('成功匯出時應該顯示成功通知', async () => {
      const mockBlob = new Blob(['test data'], { type: 'application/json' })
      mockExportMessages.mockResolvedValue({ success: true, data: mockBlob })

      // Use conversationId to skip warning dialog (direct export)
      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test'
      })
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockExportMessages).toHaveBeenCalledTimes(1)
      expect(mockShowSuccess).toHaveBeenCalledWith('匯出成功', '對話記錄已開始下載')
    })

    it('匯出失敗時應該顯示錯誤通知', async () => {
      mockExportMessages.mockResolvedValue({ success: false, error: '伺服器錯誤' })

      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test'
      })
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockShowError).toHaveBeenCalledWith('匯出失敗', '伺服器錯誤')
    })

    it('匯出過程中匯出按鈕應該禁用', async () => {
      // 讓匯出永遠 pending
      mockExportMessages.mockImplementation(() => new Promise(() => {}))

      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test'
      })
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
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
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockExportMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-abc-123'
        })
      )
    })
  })

  // ==================== 智慧驗證（Warning Dialog） ====================

  describe('智慧驗證', () => {
    it('ConversationDetail 模式：不顯示 warning dialog，直接匯出', async () => {
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test'
      })
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      // warning dialog 不應被呼叫
      expect(mockShowWarning).not.toHaveBeenCalled()
      // 匯出應直接執行
      expect(mockExportMessages).toHaveBeenCalledTimes(1)
    })

    it('列表模式 + 無篩選：應顯示 warning dialog', async () => {
      mockShowWarning.mockResolvedValue(true)
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockShowWarning).toHaveBeenCalledTimes(1)
      expect(mockShowWarning).toHaveBeenCalledWith(
        '匯出全部記錄？',
        expect.any(String),
        expect.objectContaining({
          confirmText: '確認匯出全部',
          cancelText: '返回設定篩選'
        })
      )
    })

    it('列表模式 + 取消 warning：不應執行匯出', async () => {
      mockShowWarning.mockResolvedValue(false) // 使用者取消

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockShowWarning).toHaveBeenCalledTimes(1)
      expect(mockExportMessages).not.toHaveBeenCalled()
    })

    it('列表模式 + 確認 warning：應執行匯出', async () => {
      mockShowWarning.mockResolvedValue(true)
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockShowWarning).toHaveBeenCalledTimes(1)
      expect(mockExportMessages).toHaveBeenCalledTimes(1)
    })

    it('列表模式 + 設定日期篩選：不顯示 warning dialog', async () => {
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      // 模擬設定日期篩選
      const dateInputs = document.querySelectorAll('input[type="datetime-local"]')
      const _dateFromInput = dateInputs[0] as HTMLInputElement
      // Use Vue's reactivity via the wrapper
      await wrapper.vm.$nextTick()

      // Set date filter through the component's reactive state
      const vm = wrapper.vm as any
      vm.filters.dateFrom = '2025-01-01T00:00'
      await nextTick()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      // 有日期篩選，不需要 warning
      expect(mockShowWarning).not.toHaveBeenCalled()
      expect(mockExportMessages).toHaveBeenCalledTimes(1)
    })

    it('列表模式 + 選擇特定客戶：不顯示 warning dialog', async () => {
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      // 選擇特定客戶
      const vm = wrapper.vm as any
      vm.filters.customerId = '1'
      await nextTick()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      // 有客戶篩選，不需要 warning
      expect(mockShowWarning).not.toHaveBeenCalled()
      expect(mockExportMessages).toHaveBeenCalledTimes(1)
    })

    it('列表模式 + 選擇「全部用戶」（__all__）：仍應顯示 warning dialog', async () => {
      mockShowWarning.mockResolvedValue(true)
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      // 選擇「全部用戶」
      const vm = wrapper.vm as any
      vm.filters.customerId = '__all__'
      await nextTick()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      // __all__ 不算有篩選，仍然需要 warning
      expect(mockShowWarning).toHaveBeenCalledTimes(1)
    })

    it('warning dialog 應顯示記錄數量', async () => {
      mockGetExportCount.mockResolvedValue({
        success: true,
        data: { count: 500, limit: 5000, willBeTruncated: false }
      })
      mockShowWarning.mockResolvedValue(true)
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockGetExportCount).toHaveBeenCalledTimes(1)
      // 確認訊息包含數量
      const warningMessage = mockShowWarning.mock.calls[0][1] as string
      expect(warningMessage).toContain('500')
    })

    it('記錄數超過限制時應顯示截斷警告', async () => {
      mockGetExportCount.mockResolvedValue({
        success: true,
        data: { count: 2500, limit: 5000, willBeTruncated: true }
      })
      mockShowWarning.mockResolvedValue(true)
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      const warningMessage = mockShowWarning.mock.calls[0][1] as string
      expect(warningMessage).toContain('2,500')
      expect(warningMessage).toContain('截斷')
    })

    it('count API 失敗時應顯示通用警告訊息', async () => {
      mockGetExportCount.mockResolvedValue({
        success: false,
        error: 'Server error'
      })
      mockShowWarning.mockResolvedValue(true)
      mockExportMessages.mockResolvedValue({ success: true, data: new Blob(['data']) })

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      // 應顯示通用警告
      const warningMessage = mockShowWarning.mock.calls[0][1] as string
      expect(warningMessage).toContain('尚未設定任何篩選條件')
    })

    it('count API 拋出異常時應顯示錯誤通知', async () => {
      mockGetExportCount.mockRejectedValue(new Error('Network failure'))

      wrapper = createWrapper()
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      // 不應該嘗試 warning dialog 或匯出
      expect(mockShowWarning).not.toHaveBeenCalled()
      expect(mockExportMessages).not.toHaveBeenCalled()
      // 應顯示錯誤通知
      expect(mockShowError).toHaveBeenCalledWith('匯出失敗', '匯出過程中發生錯誤，請稍後再試')
    })
  })

  // ==================== 關閉行為 ====================

  describe('關閉行為', () => {
    it('點擊取消按鈕應該觸發 close 事件', async () => {
      wrapper = createWrapper()
      await nextTick()

      const footer = document.querySelector('.modal-footer')
      const cancelBtn = footer!.querySelector('.btn-apple-text') as HTMLButtonElement
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

      // 預設 segment 應為 JSON
      const activeSegment = document.querySelector('.segment.active')
      expect(activeSegment!.textContent).toContain('JSON')
    })
  })

  // ==================== 異常處理 ====================

  describe('異常處理', () => {
    it('exportMessages 拋出異常時應該顯示錯誤通知', async () => {
      mockExportMessages.mockRejectedValue(new Error('Unexpected error'))

      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test'
      })
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockShowError).toHaveBeenCalledWith('匯出失敗', '匯出過程中發生錯誤，請稍後再試')
    })

    it('exportMessages 回傳空 data 時應該顯示錯誤', async () => {
      mockExportMessages.mockResolvedValue({ success: true, data: null })

      wrapper = createWrapper({
        conversationId: 'conv-123',
        conversationTitle: 'Test'
      })
      await flushPromises()

      const footer = document.querySelector('.modal-footer')
      const exportBtn = footer!.querySelector('.btn-apple-primary') as HTMLButtonElement
      exportBtn.click()
      await flushPromises()

      expect(mockShowError).toHaveBeenCalled()
    })
  })
})
