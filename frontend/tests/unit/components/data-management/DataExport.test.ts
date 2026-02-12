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
import { nextTick } from 'vue'
import DataExport from '@/components/data-management/DataExport.vue'

// Mock ExportDialog to avoid deep component tree
vi.mock('@/components/conversation/ExportDialog.vue', () => ({
  default: {
    name: 'ExportDialog',
    props: {
      show: Boolean,
      conversationId: String,
      conversationTitle: String
    },
    emits: ['close', 'update:show'],
    template: '<div class="mock-export-dialog" v-if="show"><button class="close-btn" @click="$emit(\'close\')">Close</button></div>'
  }
}))

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
    return mount(DataExport)
  }

  // ==================== 頁面基礎渲染 ====================

  describe('頁面基礎渲染', () => {
    it('應該成功渲染頁面', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.data-export').exists()).toBe(true)
    })

    it('應該顯示頁面標題', () => {
      wrapper = createWrapper()
      const title = wrapper.find('.page-title')
      expect(title.exists()).toBe(true)
      expect(title.text()).toContain('匯出對話記錄')
    })

    it('應該顯示頁面描述', () => {
      wrapper = createWrapper()
      const subtitle = wrapper.find('.page-subtitle')
      expect(subtitle.exists()).toBe(true)
      expect(subtitle.text()).toContain('備份')
    })

    it('應該顯示「開始匯出」按鈕', () => {
      wrapper = createWrapper()
      const btn = wrapper.find('.header-actions .btn-primary')
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toContain('開始匯出')
    })
  })

  // ==================== 格式說明卡片 ====================

  describe('格式說明卡片', () => {
    it('應該渲染四張格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.format-card')
      expect(cards.length).toBe(4)
    })

    it('應該包含 JSON 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.format-card')
      const jsonCard = cards.find(c => c.text().includes('JSON'))
      expect(jsonCard).toBeTruthy()
      expect(jsonCard!.text()).toContain('結構化')
    })

    it('應該包含 CSV 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.format-card')
      const csvCard = cards.find(c => c.text().includes('CSV'))
      expect(csvCard).toBeTruthy()
      expect(csvCard!.text()).toContain('試算表')
    })

    it('應該包含 TXT 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.format-card')
      const txtCard = cards.find(c => c.text().includes('TXT'))
      expect(txtCard).toBeTruthy()
      expect(txtCard!.text()).toContain('純文字')
    })

    it('應該包含 PDF 格式卡片', () => {
      wrapper = createWrapper()
      const cards = wrapper.findAll('.format-card')
      const pdfCard = cards.find(c => c.text().includes('PDF'))
      expect(pdfCard).toBeTruthy()
      expect(pdfCard!.text()).toContain('可攜式')
    })

    it('每張卡片應該有使用場景標籤', () => {
      wrapper = createWrapper()
      const tags = wrapper.findAll('.usecase-tag')
      // 4 usecases per format * 4 formats = 16
      expect(tags.length).toBe(16)
    })

    it('每張卡片應該有「點擊匯出」提示', () => {
      wrapper = createWrapper()
      const actions = wrapper.findAll('.format-action')
      expect(actions.length).toBe(4)
      actions.forEach(action => {
        expect(action.text()).toContain('點擊匯出')
      })
    })
  })

  // ==================== 功能說明和使用提示 ====================

  describe('功能說明區', () => {
    it('應該渲染功能說明區標題', () => {
      wrapper = createWrapper()
      const titles = wrapper.findAll('.section-title')
      const featureTitle = titles.find(t => t.text().includes('匯出功能'))
      expect(featureTitle).toBeTruthy()
    })

    it('應該顯示四個功能項目', () => {
      wrapper = createWrapper()
      const features = wrapper.findAll('.feature-item')
      expect(features.length).toBe(4)
    })

    it('應該包含日期範圍篩選功能', () => {
      wrapper = createWrapper()
      const features = wrapper.findAll('.feature-item')
      const dateFeature = features.find(f => f.text().includes('日期範圍'))
      expect(dateFeature).toBeTruthy()
    })

    it('應該包含用戶篩選功能', () => {
      wrapper = createWrapper()
      const features = wrapper.findAll('.feature-item')
      const userFeature = features.find(f => f.text().includes('用戶篩選'))
      expect(userFeature).toBeTruthy()
    })
  })

  // ==================== ExportDialog 互動 ====================

  describe('ExportDialog 互動', () => {
    it('初始狀態不應該顯示 ExportDialog', () => {
      wrapper = createWrapper()
      const dialog = wrapper.findComponent({ name: 'ExportDialog' })
      expect(dialog.props('show')).toBe(false)
    })

    it('點擊「開始匯出」應該打開 ExportDialog', async () => {
      wrapper = createWrapper()
      const btn = wrapper.find('.header-actions .btn-primary')
      await btn.trigger('click')
      await nextTick()

      const dialog = wrapper.findComponent({ name: 'ExportDialog' })
      expect(dialog.props('show')).toBe(true)
    })

    it('點擊格式卡片應該打開 ExportDialog', async () => {
      wrapper = createWrapper()
      const card = wrapper.find('.format-card')
      await card.trigger('click')
      await nextTick()

      const dialog = wrapper.findComponent({ name: 'ExportDialog' })
      expect(dialog.props('show')).toBe(true)
    })

    it('ExportDialog close 事件應該關閉對話框', async () => {
      wrapper = createWrapper()

      // Open dialog first
      const btn = wrapper.find('.header-actions .btn-primary')
      await btn.trigger('click')
      await nextTick()

      // Trigger close
      const dialog = wrapper.findComponent({ name: 'ExportDialog' })
      dialog.vm.$emit('close')
      await nextTick()

      expect(dialog.props('show')).toBe(false)
    })

    it('不應該傳遞 conversationId（全域匯出模式）', () => {
      wrapper = createWrapper()
      const dialog = wrapper.findComponent({ name: 'ExportDialog' })
      // No conversationId prop should be passed
      expect(dialog.props('conversationId')).toBeUndefined()
    })
  })
})
