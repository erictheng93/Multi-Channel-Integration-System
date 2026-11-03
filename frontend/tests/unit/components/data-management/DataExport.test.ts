/**
 * DataExport.vue 單元測試
 *
 * 測試覆蓋範圍：
 * - 頁面基礎渲染（標題、描述、按鈕）
 * - 四種格式說明卡片（JSON, CSV, TXT, PDF）
 * - 功能說明區和使用提示
 * - 點擊「開始匯出」按鈕打開 ExportDialog
 * - 點擊格式卡片打開 ExportDialog
 * - ExportDialog 關閉行為
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import DataExport from '@/components/data-management/DataExport.vue'

const exportMessages = vi.hoisted(() => vi.fn())
const getExportCount = vi.hoisted(() => vi.fn())

vi.mock('@/api/export', () => ({
  exportMessages,
  getExportCount,
  fetchExportData: vi.fn(),
  getExportCustomers: vi.fn().mockResolvedValue({ success: true, data: [{ id: 7, displayName: '林志明', platform: 'line', platformUserId: 'U1' }] }),
  getExportAgents: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'a1', displayName: '陳怡君', role: 'admin' }] })
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }))
vi.mock('@/services/pdfExportService', () => ({ generatePdfExport: vi.fn() }))

describe('DataExport.vue', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
  })

  function createWrapper() {
    return mount(DataExport, {
      global: { stubs: { UiSectionNav: true } }
    })
  }

  // ==================== 頁面基礎渲染 ====================

  describe('頁面基礎渲染', () => {
    it('應該成功渲染頁面', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.data-export').exists()).toBe(true)
    })

    it('應該顯示頁面標題', () => {
      wrapper = createWrapper()
      const title = wrapper.find('.ui-page-title')
      expect(title.exists()).toBe(true)
      expect(title.text()).toContain('匯出對話')
    })

    it('應該顯示頁面描述', () => {
      wrapper = createWrapper()
      const subtitle = wrapper.find('.ui-page-sub')
      expect(subtitle.exists()).toBe(true)
      expect(subtitle.text()).toContain('5,000')
    })

    it('應該顯示「開始匯出」按鈕', () => {
      wrapper = createWrapper()
      const btn = wrapper.find('.lead-cta')
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toContain('開始匯出')
    })
  })

  // ==================== 格式說明卡片 ====================

  describe('格式說明卡片', () => {
    it('應該渲染四張格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.ex-row')
      expect(cards.length).toBe(4)
    })

    it('應該包含 JSON 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.ex-row')
      const jsonCard = cards.find(c => c.text().includes('JSON'))
      expect(jsonCard).toBeTruthy()
      expect(jsonCard!.text()).toContain('結構化')
    })

    it('應該包含 CSV 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.ex-row')
      const csvCard = cards.find(c => c.text().includes('CSV'))
      expect(csvCard).toBeTruthy()
      expect(csvCard!.text()).toContain('試算表')
    })

    it('應該包含 TXT 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.ex-row')
      const txtCard = cards.find(c => c.text().includes('TXT'))
      expect(txtCard).toBeTruthy()
      expect(txtCard!.text()).toContain('純文字')
    })

    it('應該包含 PDF 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.ex-row')
      const pdfCard = cards.find(c => c.text().includes('PDF'))
      expect(pdfCard).toBeTruthy()
      expect(pdfCard!.text()).toContain('可攜式')
    })

    it('每張卡片應該列出適用場景', () => {
      wrapper = createWrapper()
      const uses = wrapper.findAll('.ex-use')
      expect(uses.length).toBe(4)
      expect(uses[0]!.text()).toContain('API 整合')
    })
  })

  // ==================== 匯出範圍與動作 ====================

  describe('匯出範圍', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      exportMessages.mockReset()
      getExportCount.mockReset()
      getExportCount.mockResolvedValue({ success: true, data: { count: 842, limit: 5000, willBeTruncated: false } })
      exportMessages.mockResolvedValue({ success: true, data: new Blob(['x']) })
      Object.assign(window.URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('提供日期、客戶、客服三個真正的篩選控制項', async () => {
      wrapper = createWrapper()
      await vi.runAllTimersAsync()
      expect(wrapper.find('#ex-from').exists()).toBe(true)
      expect(wrapper.find('#ex-to').exists()).toBe(true)
      expect(wrapper.find('#ex-customer').text()).toContain('林志明')
      expect(wrapper.find('#ex-agent').text()).toContain('陳怡君')
    })

    it('顯示符合條件的筆數', async () => {
      wrapper = createWrapper()
      await vi.runAllTimersAsync()
      expect(wrapper.find('.foot-count').text()).toContain('842')
    })

    it('按下開始匯出時帶入選取的格式與篩選', async () => {
      wrapper = createWrapper()
      await vi.runAllTimersAsync()
      await wrapper.findAll('.ex-row')[1]!.trigger('click')
      await wrapper.find('#ex-customer').setValue('7')
      await wrapper.find('.lead-cta').trigger('click')
      await vi.runAllTimersAsync()
      expect(exportMessages).toHaveBeenCalledTimes(1)
      expect(exportMessages.mock.calls[0]![0]).toMatchObject({ format: 'csv', customerId: '7' })
    })
  })
})
