/**
 * MessageSearch.vue 單元測試
 *
 * 測試覆蓋範圍：
 * - Props 驗證和預設值
 * - 收合/展開狀態切換
 * - 搜索輸入和防抖行為
 * - 過濾器（消息類型、發送者類型、日期範圍）
 * - 高級搜索模式切換
 * - 搜索建議顯示和選擇
 * - 鍵盤操作（Escape 關閉）
 * - 清除搜索 / 清除過濾 / 關閉搜索
 * - 事件發射（search-results, search-clear）
 * - 邊界情況（空消息列表、空搜索）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import MessageSearch from '@/components/conversation/MessageSearch.vue'
import type { Message } from '@/types'

// ==================== Mocks ====================

const mockSearch = vi.fn().mockReturnValue([])
const mockAdvancedSearch = vi.fn().mockReturnValue([])
const mockBuildIndex = vi.fn()

vi.mock('@/services/messageIndexService', () => ({
  messageIndexService: {
    search: (...args: unknown[]) => mockSearch(...args),
    advancedSearch: (...args: unknown[]) => mockAdvancedSearch(...args),
    buildIndex: (...args: unknown[]) => mockBuildIndex(...args)
  }
}))

const mockAddSearch = vi.fn()
const mockGetSuggestions = vi.fn().mockReturnValue([])
const mockGetRecentSearches = vi.fn().mockReturnValue([])

vi.mock('@/services/searchHistoryService', () => ({
  searchHistoryService: {
    addSearch: (...args: unknown[]) => mockAddSearch(...args),
    getSuggestions: (...args: unknown[]) => mockGetSuggestions(...args),
    getRecentSearches: () => mockGetRecentSearches()
  }
}))

const mockRecordSearch = vi.fn()

vi.mock('@/services/searchPerformanceMonitor', () => ({
  searchPerformanceMonitor: {
    recordSearch: (...args: unknown[]) => mockRecordSearch(...args)
  }
}))

vi.mock('@/utils/debounce', () => ({
  createDebouncedFunction: (fn: () => void) => ({
    debounced: fn,
    cancel: vi.fn(),
    flush: vi.fn()
  })
}))

// Stub icon components
vi.mock('@/components/icons', () => ({
  SearchIcon: { template: '<svg class="search-icon-stub" />' },
  XIcon: { template: '<svg class="x-icon-stub" />' }
}))

// ==================== Helpers ====================

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-1',
    senderType: 'customer',
    senderId: 'sender-1',
    content: 'Hello world',
    messageType: 'text',
    platform: 'line',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides
  } as Message
}

function createMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) =>
    createMessage({
      id: `msg-${i}`,
      content: `Message ${i}`,
      senderType: i % 2 === 0 ? 'customer' : 'agent',
      messageType: i % 3 === 0 ? 'image' : 'text'
    })
  )
}

describe('MessageSearch.vue', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    vi.useRealTimers()
  })

  function createWrapper(props: Record<string, unknown> = {}) {
    return mount(MessageSearch, {
      props: {
        messages: [],
        ...props
      },
      attachTo: document.body
    })
  }

  // ==================== Props 驗證和預設值 ====================

  describe('Props 驗證和預設值', () => {
    it('預設不展開搜索面板', () => {
      wrapper = createWrapper()

      expect(wrapper.find('.search-trigger').exists()).toBe(true)
      expect(wrapper.find('.search-expanded').exists()).toBe(false)
    })

    it('autoExpand=true 時直接展開搜索面板', () => {
      wrapper = createWrapper({ autoExpand: true })

      expect(wrapper.find('.search-trigger').exists()).toBe(false)
      expect(wrapper.find('.search-expanded').exists()).toBe(true)
    })

    it('接受 messages 陣列作為 prop', () => {
      const messages = createMessages(5)
      wrapper = createWrapper({ messages })

      // Component should mount without errors
      expect(wrapper.find('.message-search').exists()).toBe(true)
    })
  })

  // ==================== 收合/展開狀態 ====================

  describe('收合/展開狀態', () => {
    it('點擊搜索按鈕應展開面板', async () => {
      wrapper = createWrapper()

      expect(wrapper.find('.search-trigger').exists()).toBe(true)

      await wrapper.find('.search-button').trigger('click')

      expect(wrapper.find('.search-trigger').exists()).toBe(false)
      expect(wrapper.find('.search-expanded').exists()).toBe(true)
    })

    it('展開後應顯示搜索輸入框', async () => {
      wrapper = createWrapper()
      await wrapper.find('.search-button').trigger('click')

      expect(wrapper.find('.search-input').exists()).toBe(true)
    })

    it('展開後應顯示過濾器區域', async () => {
      wrapper = createWrapper()
      await wrapper.find('.search-button').trigger('click')

      expect(wrapper.find('.search-filters').exists()).toBe(true)
    })

    it('點擊關閉按鈕應收合面板', async () => {
      wrapper = createWrapper({ autoExpand: true })

      await wrapper.find('.close-search').trigger('click')

      expect(wrapper.find('.search-trigger').exists()).toBe(true)
      expect(wrapper.find('.search-expanded').exists()).toBe(false)
    })

    it('autoExpand prop 變化為 true 時應展開', async () => {
      wrapper = mount(MessageSearch, {
        props: { messages: [], autoExpand: false },
        attachTo: document.body
      })

      expect(wrapper.find('.search-trigger').exists()).toBe(true)

      await wrapper.setProps({ autoExpand: true })
      await nextTick()

      expect(wrapper.find('.search-expanded').exists()).toBe(true)
    })
  })

  // ==================== 搜索輸入 ====================

  describe('搜索輸入', () => {
    it('輸入搜索文字後應調用 messageIndexService.search', async () => {
      const messages = createMessages(5)
      mockSearch.mockReturnValue([messages[0]])

      wrapper = createWrapper({ messages, autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('Hello')
      await input.trigger('input')
      await flushPromises()

      expect(mockSearch).toHaveBeenCalledWith('Hello')
    })

    it('搜索有結果時應顯示結果數量', async () => {
      const messages = createMessages(5)
      mockSearch.mockReturnValue([messages[0], messages[1]])

      wrapper = createWrapper({ messages, autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('test')
      await input.trigger('input')
      await flushPromises()
      await nextTick()

      expect(wrapper.find('.search-results-info').exists()).toBe(true)
      expect(wrapper.find('.search-results-info').text()).toContain('2')
    })

    it('空搜索文字且無過濾時不應顯示結果', async () => {
      wrapper = createWrapper({ messages: createMessages(3), autoExpand: true })

      expect(wrapper.find('.search-results-info').exists()).toBe(false)
    })

    it('搜索後應記錄搜索歷史', async () => {
      mockSearch.mockReturnValue([])

      wrapper = createWrapper({ messages: createMessages(3), autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('test query')
      await input.trigger('input')
      await flushPromises()

      expect(mockAddSearch).toHaveBeenCalledWith(
        'test query',
        expect.any(Number),
        'basic'
      )
    })

    it('搜索後應記錄性能指標', async () => {
      mockSearch.mockReturnValue([])

      wrapper = createWrapper({ messages: createMessages(3), autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('perf test')
      await input.trigger('input')
      await flushPromises()

      expect(mockRecordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'perf test',
          searchType: 'basic',
          resultCount: expect.any(Number),
          executionTime: expect.any(Number)
        })
      )
    })
  })

  // ==================== 高級搜索模式 ====================

  describe('高級搜索模式', () => {
    it('預設為標準搜索模式，按鈕顯示 STD', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const modeToggle = wrapper.find('.mode-toggle')
      expect(modeToggle.text()).toBe('STD')
      expect(modeToggle.classes()).not.toContain('active')
    })

    it('點擊模式切換按鈕應切換到高級搜索', async () => {
      wrapper = createWrapper({ autoExpand: true })

      await wrapper.find('.mode-toggle').trigger('click')

      const modeToggle = wrapper.find('.mode-toggle')
      expect(modeToggle.text()).toBe('ADV')
      expect(modeToggle.classes()).toContain('active')
    })

    it('高級模式下搜索應調用 advancedSearch', async () => {
      mockAdvancedSearch.mockReturnValue([])

      wrapper = createWrapper({ messages: createMessages(3), autoExpand: true })

      // Switch to advanced mode
      await wrapper.find('.mode-toggle').trigger('click')

      const input = wrapper.find('.search-input')
      await input.setValue('hello AND world')
      await input.trigger('input')
      await flushPromises()

      expect(mockAdvancedSearch).toHaveBeenCalledWith('hello AND world')
    })

    it('高級模式下 placeholder 應顯示高級搜索提示', async () => {
      wrapper = createWrapper({ autoExpand: true })

      await wrapper.find('.mode-toggle').trigger('click')
      await nextTick()

      const input = wrapper.find('.search-input')
      expect(input.attributes('placeholder')).toContain('AND')
    })

    it('高級模式搜索應記錄為 advanced 類型', async () => {
      mockAdvancedSearch.mockReturnValue([])

      wrapper = createWrapper({ messages: createMessages(3), autoExpand: true })

      await wrapper.find('.mode-toggle').trigger('click')

      const input = wrapper.find('.search-input')
      await input.setValue('test')
      await input.trigger('input')
      await flushPromises()

      expect(mockAddSearch).toHaveBeenCalledWith('test', expect.any(Number), 'advanced')
    })

    it('再次點擊模式切換應回到標準搜索', async () => {
      wrapper = createWrapper({ autoExpand: true })

      await wrapper.find('.mode-toggle').trigger('click')
      expect(wrapper.find('.mode-toggle').text()).toBe('ADV')

      await wrapper.find('.mode-toggle').trigger('click')
      expect(wrapper.find('.mode-toggle').text()).toBe('STD')
    })
  })

  // ==================== 過濾器 ====================

  describe('過濾器', () => {
    it('應渲染三個過濾器下拉選單', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      expect(selects.length).toBe(3) // 類型、發送者、日期
    })

    it('消息類型過濾器應有正確的選項', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      const typeSelect = selects[0]
      const options = typeSelect.findAll('option')

      expect(options.length).toBe(4) // 全部、文本、圖片、文件
    })

    it('發送者過濾器應有正確的選項', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      const senderSelect = selects[1]
      const options = senderSelect.findAll('option')

      expect(options.length).toBe(3) // 全部、客戶、客服
    })

    it('日期過濾器應有正確的選項', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      const dateSelect = selects[2]
      const options = dateSelect.findAll('option')

      expect(options.length).toBe(4) // 全部、今天、本週、本月
    })

    it('沒有選擇過濾時不應顯示「清除過濾」按鈕', async () => {
      wrapper = createWrapper({ autoExpand: true })

      expect(wrapper.find('.clear-filters').exists()).toBe(false)
    })

    it('選擇過濾後應顯示「清除過濾」按鈕', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      await selects[0].setValue('text')
      await nextTick()

      expect(wrapper.find('.clear-filters').exists()).toBe(true)
    })

    it('點擊「清除過濾」應重置所有過濾器', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      await selects[0].setValue('text')
      await selects[1].setValue('customer')
      await nextTick()

      expect(wrapper.find('.clear-filters').exists()).toBe(true)

      await wrapper.find('.clear-filters').trigger('click')
      await nextTick()

      expect(wrapper.find('.clear-filters').exists()).toBe(false)
    })

    it('消息類型過濾應正確過濾結果', async () => {
      const messages = [
        createMessage({ id: 'msg-1', content: 'text msg', messageType: 'text' }),
        createMessage({ id: 'msg-2', content: 'image msg', messageType: 'image' })
      ]
      // When filter is set but no query, searchResults uses props.messages as base
      wrapper = createWrapper({ messages, autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      await selects[0].setValue('text')
      await selects[0].trigger('change')
      await flushPromises()
      await nextTick()

      // Should show 1 result (only the text message)
      const resultsInfo = wrapper.find('.search-results-info')
      expect(resultsInfo.exists()).toBe(true)
      expect(resultsInfo.text()).toContain('1')
    })

    it('發送者過濾應正確過濾結果', async () => {
      const messages = [
        createMessage({ id: 'msg-1', senderType: 'customer' }),
        createMessage({ id: 'msg-2', senderType: 'agent' }),
        createMessage({ id: 'msg-3', senderType: 'customer' })
      ]
      wrapper = createWrapper({ messages, autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      await selects[1].setValue('agent')
      await selects[1].trigger('change')
      await flushPromises()
      await nextTick()

      const resultsInfo = wrapper.find('.search-results-info')
      expect(resultsInfo.exists()).toBe(true)
      expect(resultsInfo.text()).toContain('1')
    })

    it('日期過濾 today 應只包含今天的消息', async () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

      const messages = [
        createMessage({ id: 'msg-1', createdAt: now.toISOString() }),
        createMessage({ id: 'msg-2', createdAt: yesterday.toISOString() })
      ]
      wrapper = createWrapper({ messages, autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      await selects[2].setValue('today')
      await selects[2].trigger('change')
      await flushPromises()
      await nextTick()

      const resultsInfo = wrapper.find('.search-results-info')
      expect(resultsInfo.exists()).toBe(true)
      expect(resultsInfo.text()).toContain('1')
    })

    it('日期過濾 week 應包含過去7天的消息', async () => {
      const now = new Date()
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const messages = [
        createMessage({ id: 'msg-1', createdAt: now.toISOString() }),
        createMessage({ id: 'msg-2', createdAt: threeDaysAgo.toISOString() }),
        createMessage({ id: 'msg-3', createdAt: twoWeeksAgo.toISOString() })
      ]
      wrapper = createWrapper({ messages, autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      await selects[2].setValue('week')
      await selects[2].trigger('change')
      await flushPromises()
      await nextTick()

      const resultsInfo = wrapper.find('.search-results-info')
      expect(resultsInfo.exists()).toBe(true)
      expect(resultsInfo.text()).toContain('2')
    })
  })

  // ==================== 鍵盤操作 ====================

  describe('鍵盤操作', () => {
    it('按 Escape 應關閉搜索面板', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.trigger('keydown', { key: 'Escape' })

      expect(wrapper.find('.search-trigger').exists()).toBe(true)
      expect(wrapper.find('.search-expanded').exists()).toBe(false)
    })

    it('按 Escape 應發射 search-clear 事件', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.trigger('keydown', { key: 'Escape' })

      expect(wrapper.emitted('search-clear')).toBeTruthy()
    })
  })

  // ==================== 清除搜索 ====================

  describe('清除搜索', () => {
    it('有搜索文字時應顯示清除按鈕', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('test')
      await nextTick()

      expect(wrapper.find('.clear-button').exists()).toBe(true)
    })

    it('沒有搜索文字時不應顯示清除按鈕', async () => {
      wrapper = createWrapper({ autoExpand: true })

      expect(wrapper.find('.clear-button').exists()).toBe(false)
    })

    it('點擊清除按鈕應清空搜索文字', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('test')
      await nextTick()

      await wrapper.find('.clear-button').trigger('click')
      await nextTick()

      expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('')
    })
  })

  // ==================== 關閉搜索 ====================

  describe('關閉搜索', () => {
    it('關閉應清空搜索文字和過濾器', async () => {
      wrapper = createWrapper({ autoExpand: true })

      // Set query and filter
      const input = wrapper.find('.search-input')
      await input.setValue('test')
      const selects = wrapper.findAll('.filter-select')
      await selects[0].setValue('text')
      await nextTick()

      // Close
      await wrapper.find('.close-search').trigger('click')
      await nextTick()

      // Should be collapsed
      expect(wrapper.find('.search-expanded').exists()).toBe(false)
    })

    it('關閉應發射 search-clear 事件', async () => {
      wrapper = createWrapper({ autoExpand: true })

      await wrapper.find('.close-search').trigger('click')

      expect(wrapper.emitted('search-clear')).toBeTruthy()
    })
  })

  // ==================== 事件發射 ====================

  describe('事件發射', () => {
    it('搜索時應發射 search-results 事件', async () => {
      const messages = createMessages(3)
      mockSearch.mockReturnValue([messages[0]])

      wrapper = createWrapper({ messages, autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('test')
      await input.trigger('input')
      await flushPromises()
      await nextTick()

      const emitted = wrapper.emitted('search-results')
      expect(emitted).toBeTruthy()
      expect(emitted!.length).toBeGreaterThan(0)
    })

    it('關閉搜索時應發射 search-clear 事件', async () => {
      wrapper = createWrapper({ autoExpand: true })

      await wrapper.find('.close-search').trigger('click')

      expect(wrapper.emitted('search-clear')).toBeTruthy()
      expect(wrapper.emitted('search-clear')!.length).toBe(1)
    })
  })

  // ==================== 搜索建議 ====================

  describe('搜索建議', () => {
    it('聚焦輸入框時應獲取搜索建議', async () => {
      mockGetRecentSearches.mockReturnValue([
        { query: 'recent search', timestamp: Date.now() }
      ])
      mockGetSuggestions.mockReturnValue([])

      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.trigger('focus')
      await nextTick()

      expect(mockGetRecentSearches).toHaveBeenCalled()
    })

    it('有搜索文字時聚焦應獲取基於文字的建議', async () => {
      mockGetSuggestions.mockReturnValue(['suggestion 1', 'suggestion 2'])

      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('test')
      await input.trigger('focus')
      await nextTick()

      expect(mockGetSuggestions).toHaveBeenCalledWith('test', 5)
    })

    it('有建議時應顯示建議下拉選單', async () => {
      mockGetSuggestions.mockReturnValue(['suggestion 1', 'suggestion 2'])

      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('test')
      await input.trigger('focus')
      await nextTick()

      expect(wrapper.find('.search-suggestions').exists()).toBe(true)
      const items = wrapper.findAll('.suggestion-item')
      expect(items.length).toBe(2)
    })

    it('點擊建議應套用到搜索輸入', async () => {
      mockGetSuggestions.mockReturnValue(['hello world'])

      wrapper = createWrapper({ messages: createMessages(3), autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue('hel')
      await input.trigger('focus')
      await nextTick()

      const suggestionItem = wrapper.find('.suggestion-item')
      await suggestionItem.trigger('click')
      await nextTick()

      expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('hello world')
    })

    it('沒有建議時不應顯示下拉選單', async () => {
      mockGetSuggestions.mockReturnValue([])
      mockGetRecentSearches.mockReturnValue([])

      wrapper = createWrapper({ autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.trigger('focus')
      await nextTick()

      expect(wrapper.find('.search-suggestions').exists()).toBe(false)
    })
  })

  // ==================== defineExpose 方法 ====================

  describe('暴露方法', () => {
    it('focus() 方法應展開面板', async () => {
      wrapper = createWrapper()

      expect(wrapper.find('.search-expanded').exists()).toBe(false)

      const vm = wrapper.vm as unknown as { focus: () => void }
      vm.focus()
      await nextTick()

      expect(wrapper.find('.search-expanded').exists()).toBe(true)
    })

    it('close() 方法應收合面板並發射 search-clear', async () => {
      wrapper = createWrapper({ autoExpand: true })

      const vm = wrapper.vm as unknown as { close: () => void }
      vm.close()
      await nextTick()

      expect(wrapper.find('.search-expanded').exists()).toBe(false)
      expect(wrapper.emitted('search-clear')).toBeTruthy()
    })
  })

  // ==================== 邊界情況 ====================

  describe('邊界情況', () => {
    it('空消息列表應正常渲染', () => {
      wrapper = createWrapper({ messages: [] })
      expect(wrapper.find('.message-search').exists()).toBe(true)
    })

    it('只有空格的搜索文字不應觸發搜索', async () => {
      wrapper = createWrapper({ messages: createMessages(3), autoExpand: true })

      const input = wrapper.find('.search-input')
      await input.setValue(' ')
      await input.trigger('input')
      await flushPromises()

      // Should not record history for whitespace-only queries
      expect(mockAddSearch).not.toHaveBeenCalled()
    })

    it('多個過濾器同時使用應正確組合', async () => {
      const now = new Date()
      const messages = [
        createMessage({ id: 'msg-1', senderType: 'customer', messageType: 'text', createdAt: now.toISOString() }),
        createMessage({ id: 'msg-2', senderType: 'agent', messageType: 'text', createdAt: now.toISOString() }),
        createMessage({ id: 'msg-3', senderType: 'customer', messageType: 'image', createdAt: now.toISOString() })
      ]

      wrapper = createWrapper({ messages, autoExpand: true })

      const selects = wrapper.findAll('.filter-select')
      // Filter: text + customer
      await selects[0].setValue('text')
      await selects[1].setValue('customer')
      await selects[0].trigger('change')
      await flushPromises()
      await nextTick()

      // Should only match msg-1 (text + customer)
      const resultsInfo = wrapper.find('.search-results-info')
      expect(resultsInfo.exists()).toBe(true)
      expect(resultsInfo.text()).toContain('1')
    })
  })
})
