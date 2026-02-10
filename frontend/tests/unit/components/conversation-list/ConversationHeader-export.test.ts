/**
 * ConversationHeader (conversation-list) - 匯出按鈕測試
 *
 * 測試覆蓋範圍：
 * - 匯出按鈕渲染
 * - 點擊觸發 export 事件
 * - 與 refresh 按鈕共存
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConversationHeader from '@/components/conversation-list/ConversationHeader.vue'

// Mock sub-components
vi.mock('@/components/conversation-list/CacheStatusIndicator.vue', () => ({
  default: { template: '<div class="mock-cache-indicator" />' }
}))

vi.mock('@/components/conversation-list/SyncStatusIndicator.vue', () => ({
  default: { template: '<div class="mock-sync-indicator" />' }
}))

describe('ConversationHeader (List) - 匯出按鈕', () => {
  let wrapper: VueWrapper | null = null

  const defaultProps = {
    cacheHitRate: 0,
    syncStatus: 'disconnected' as const,
    isSyncing: false,
    isRefreshing: false
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
  })

  it('應該渲染匯出按鈕', () => {
    wrapper = mount(ConversationHeader, { props: defaultProps })

    const buttons = wrapper.findAll('button.btn')
    const exportBtn = buttons.find(btn => btn.text().includes('匯出記錄'))
    expect(exportBtn).toBeTruthy()
  })

  it('匯出按鈕應該包含 DownloadIcon', () => {
    wrapper = mount(ConversationHeader, { props: defaultProps })

    const buttons = wrapper.findAll('button.btn')
    const exportBtn = buttons.find(btn => btn.text().includes('匯出記錄'))
    // DownloadIcon 透過 createIcon 渲染為 SVG
    const svg = exportBtn!.find('svg')
    expect(svg.exists()).toBe(true)
  })

  it('點擊匯出按鈕應該觸發 export 事件', async () => {
    wrapper = mount(ConversationHeader, { props: defaultProps })

    const buttons = wrapper.findAll('button.btn')
    const exportBtn = buttons.find(btn => btn.text().includes('匯出記錄'))
    await exportBtn!.trigger('click')

    expect(wrapper.emitted('export')).toBeTruthy()
    expect(wrapper.emitted('export')!.length).toBe(1)
  })

  it('匯出按鈕和重新整理按鈕應該同時存在', () => {
    wrapper = mount(ConversationHeader, { props: defaultProps })

    const buttons = wrapper.findAll('button.btn')
    const exportBtn = buttons.find(btn => btn.text().includes('匯出記錄'))
    const refreshBtn = buttons.find(btn => btn.text().includes('重新整理'))

    expect(exportBtn).toBeTruthy()
    expect(refreshBtn).toBeTruthy()
  })

  it('點擊匯出按鈕不應該觸發 refresh 事件', async () => {
    wrapper = mount(ConversationHeader, { props: defaultProps })

    const buttons = wrapper.findAll('button.btn')
    const exportBtn = buttons.find(btn => btn.text().includes('匯出記錄'))
    await exportBtn!.trigger('click')

    expect(wrapper.emitted('export')).toBeTruthy()
    expect(wrapper.emitted('refresh')).toBeFalsy()
  })

  it('點擊重新整理按鈕不應該觸發 export 事件', async () => {
    wrapper = mount(ConversationHeader, { props: defaultProps })

    const buttons = wrapper.findAll('button.btn')
    const refreshBtn = buttons.find(btn => btn.text().includes('重新整理'))
    await refreshBtn!.trigger('click')

    expect(wrapper.emitted('refresh')).toBeTruthy()
    expect(wrapper.emitted('export')).toBeFalsy()
  })
})
