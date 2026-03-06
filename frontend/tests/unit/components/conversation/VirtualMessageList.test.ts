/**
 * VirtualMessageList.vue Unit Tests
 *
 * Tests:
 * - Basic rendering with messages
 * - Empty state (no messages)
 * - Loading indicator (loading + hasMore)
 * - Load-more trigger visibility
 * - Search results header and clear button
 * - Typing indicator
 * - History loading state
 * - Emits: searchClear, retry
 * - isUpdating class binding
 * - Date separator insertion via useVirtualList composable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VueWrapper } from '@vue/test-utils';
import { mount } from '@vue/test-utils'
import { ref, computed, type Ref } from 'vue'
import type { Message } from '@/types'
import type { VirtualItem } from '@/composables/message/useVirtualList'

// --- Mock return values (mutable per-test) ---

let mockVirtualItems: Ref<VirtualItem[]>
let mockDisplayedMessages: Ref<Message[]>
let mockIsNewMessage: (_id: string) => boolean
let mockShowLoadMoreTrigger: Ref<boolean>
let mockHandleManualLoadMore: ReturnType<typeof vi.fn>

// Track virtualizer calls
const mockGetTotalSize = vi.fn(() => 500)
const mockGetVirtualItems = vi.fn(() => [] as Array<{ key: string; index: number; size: number; start: number }>)
const mockMeasureElement = vi.fn()

const mockVirtualizer = {
  getTotalSize: mockGetTotalSize,
  getVirtualItems: mockGetVirtualItems,
  measureElement: mockMeasureElement,
}

// --- Mock composables ---

vi.mock('@/composables/message/useVirtualList', () => ({
  useVirtualList: () => ({
    displayedMessages: mockDisplayedMessages,
    virtualItems: mockVirtualItems,
    virtualizer: mockVirtualizer,
  }),
}))

vi.mock('@/composables/message/useVirtualScroll', () => ({
  useVirtualScroll: () => ({
    isUserAtBottom: ref(true),
    isProgrammaticScrolling: ref(false),
    isInitialScrollDone: ref(true),
    recentlyScrolledToBottom: ref(false),
    scrollToMessageByIndex: vi.fn(),
    scrollToTop: vi.fn(),
    scrollToBottom: vi.fn(),
    checkIfUserAtBottom: vi.fn(),
    checkIfUserAtTop: vi.fn(),
    waitForStableScrollHeight: vi.fn(),
    cleanupGracePeriod: vi.fn(),
  }),
}))

vi.mock('@/composables/message/useScrollEventHandlers', () => ({
  useScrollEventHandlers: () => ({
    showLoadMoreTrigger: mockShowLoadMoreTrigger,
    handleScroll: vi.fn(),
    handleManualLoadMore: (...args: unknown[]) => mockHandleManualLoadMore(...args),
    cleanupTimeouts: vi.fn(),
  }),
}))

vi.mock('@/composables/message/useResizeObserver', () => ({
  useResizeObserver: () => ({
    setupContentResizeObserver: vi.fn(),
    cleanupContentResizeObserver: vi.fn(),
  }),
}))

vi.mock('@/composables/message/useScrollWatchers', () => ({
  useScrollWatchers: () => ({
    isNewMessage: (id: string) => mockIsNewMessage(id),
  }),
}))

// Stub child components
const MessageBubbleStub = {
  name: 'MessageBubble',
  template: '<div class="message-bubble-stub" :data-message-id="message.id">{{ message.content }}</div>',
  props: ['message', 'delivered'],
  emits: ['copy', 'reply', 'forward', 'recall', 'select', 'retry'],
}

const DateSeparatorStub = {
  name: 'DateSeparator',
  template: '<div class="date-separator-stub">{{ date }}</div>',
  props: ['date'],
}

const HamsterLoaderStub = {
  name: 'HamsterLoader',
  template: '<div class="hamster-loader-stub">{{ message }}</div>',
  props: ['message'],
}

// Import component under test (AFTER mocks are set up)
import VirtualMessageList from '@/components/conversation/VirtualMessageList.vue'

// --- Helpers ---

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-1',
    senderType: 'customer',
    senderId: 'customer-1',
    content: 'Hello',
    messageType: 'text',
    platform: 'line',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Message
}

function createVirtualItemsFromMessages(msgs: Message[], withDates = false): VirtualItem[] {
  const items: VirtualItem[] = []
  let currentDate = ''

  for (const msg of msgs) {
    if (withDates) {
      const d = new Date(msg.createdAt as string).toDateString()
      if (d !== currentDate) {
        currentDate = d
        items.push({ type: 'date', data: new Date(msg.createdAt as string), id: `date-${d}` })
      }
    }
    items.push({ type: 'message', data: msg, id: `message-${msg.id}` })
  }
  return items
}

interface MountOptions {
  messages?: Message[]
  loading?: boolean
  hasMore?: boolean
  loadingHistory?: boolean
  isSearchActive?: boolean
  isUpdating?: boolean
  isTyping?: boolean
  showDateSeparators?: boolean
  // Override virtualItems / displayedMessages if needed
  virtualItemsOverride?: VirtualItem[]
  virtualRenderedItems?: Array<{ key: string; index: number; size: number; start: number }>
}

function mountComponent(opts: MountOptions = {}): VueWrapper {
  const messages = opts.messages ?? []

  // Set up mock refs for this mount
  const vitems = opts.virtualItemsOverride ?? createVirtualItemsFromMessages(messages)
  mockVirtualItems = computed(() => vitems)
  mockDisplayedMessages = computed(() => messages)

  // Set up virtual rendered items (what the virtualizer reports as visible)
  const rendered = opts.virtualRenderedItems ?? vitems.map((_, i) => ({
    key: String(i),
    index: i,
    size: 80,
    start: i * 80,
  }))
  mockGetVirtualItems.mockReturnValue(rendered)
  mockGetTotalSize.mockReturnValue(rendered.length * 80)

  return mount(VirtualMessageList, {
    props: {
      messages,
      loading: opts.loading ?? false,
      hasMore: opts.hasMore ?? false,
      loadingHistory: opts.loadingHistory ?? false,
      isSearchActive: opts.isSearchActive ?? false,
      isUpdating: opts.isUpdating ?? false,
      isTyping: opts.isTyping ?? false,
      showDateSeparators: opts.showDateSeparators ?? true,
    },
    global: {
      stubs: {
        MessageBubble: MessageBubbleStub,
        DateSeparator: DateSeparatorStub,
        HamsterLoader: HamsterLoaderStub,
        Transition: false,
      },
    },
  })
}

// --- Tests ---

describe('VirtualMessageList.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockShowLoadMoreTrigger = ref(false)
    mockHandleManualLoadMore = vi.fn()
    mockIsNewMessage = () => false
  })

  // ========================================
  // Basic Rendering
  // ========================================
  describe('basic rendering', () => {
    it('renders the root container with virtual-message-list class', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.virtual-message-list').exists()).toBe(true)
    })

    it('renders virtual-content container with correct height style', () => {
      const msgs = [createMessage()]
      const wrapper = mountComponent({ messages: msgs })
      const content = wrapper.find('.virtual-content')
      expect(content.exists()).toBe(true)
      // Height should come from virtualizer.getTotalSize()
      expect(content.attributes('style')).toContain('height')
    })

    it('renders message items via virtualizer', () => {
      const msgs = [
        createMessage({ id: 'msg-1', content: 'First message' }),
        createMessage({ id: 'msg-2', content: 'Second message' }),
      ]
      const wrapper = mountComponent({ messages: msgs })
      const bubbles = wrapper.findAll('.message-bubble-stub')
      expect(bubbles.length).toBe(2)
      expect(bubbles[0].text()).toContain('First message')
      expect(bubbles[1].text()).toContain('Second message')
    })
  })

  // ========================================
  // Empty State
  // ========================================
  describe('empty state', () => {
    it('renders no message items when messages array is empty', () => {
      const wrapper = mountComponent({ messages: [] })
      expect(wrapper.findAll('.message-bubble-stub').length).toBe(0)
    })

    it('renders virtual-content container even with no messages', () => {
      const wrapper = mountComponent({ messages: [] })
      expect(wrapper.find('.virtual-content').exists()).toBe(true)
    })
  })

  // ========================================
  // Loading Indicator
  // ========================================
  describe('loading indicator', () => {
    it('shows loading indicator when loading=true and hasMore=true', () => {
      const wrapper = mountComponent({ loading: true, hasMore: true })
      const indicator = wrapper.find('.loading-indicator.loading-top')
      expect(indicator.exists()).toBe(true)
      expect(indicator.text()).toContain('載入中')
    })

    it('hides loading indicator when loading=false', () => {
      const wrapper = mountComponent({ loading: false, hasMore: true })
      expect(wrapper.find('.loading-indicator.loading-top').exists()).toBe(false)
    })

    it('hides loading indicator when hasMore=false', () => {
      const wrapper = mountComponent({ loading: true, hasMore: false })
      expect(wrapper.find('.loading-indicator.loading-top').exists()).toBe(false)
    })
  })

  // ========================================
  // Load More Trigger
  // ========================================
  describe('load-more trigger', () => {
    it('shows load-more trigger when hasMore=true, loading=false, showLoadMoreTrigger=true', () => {
      mockShowLoadMoreTrigger = ref(true)
      const wrapper = mountComponent({ hasMore: true, loading: false })
      const trigger = wrapper.find('.load-more-trigger.load-more-top')
      expect(trigger.exists()).toBe(true)
      expect(trigger.text()).toContain('載入更早的訊息')
    })

    it('hides load-more trigger when hasMore=false', () => {
      mockShowLoadMoreTrigger = ref(true)
      const wrapper = mountComponent({ hasMore: false, loading: false })
      expect(wrapper.find('.load-more-trigger.load-more-top').exists()).toBe(false)
    })

    it('hides load-more trigger when loading=true', () => {
      mockShowLoadMoreTrigger = ref(true)
      const wrapper = mountComponent({ hasMore: true, loading: true })
      expect(wrapper.find('.load-more-trigger.load-more-top').exists()).toBe(false)
    })

    it('hides load-more trigger when showLoadMoreTrigger=false', () => {
      mockShowLoadMoreTrigger = ref(false)
      const wrapper = mountComponent({ hasMore: true, loading: false })
      expect(wrapper.find('.load-more-trigger.load-more-top').exists()).toBe(false)
    })

    it('calls handleManualLoadMore when trigger is clicked', async () => {
      mockShowLoadMoreTrigger = ref(true)
      const wrapper = mountComponent({ hasMore: true, loading: false })
      await wrapper.find('.load-more-trigger.load-more-top').trigger('click')
      expect(mockHandleManualLoadMore).toHaveBeenCalled()
    })
  })

  // ========================================
  // Search Results Header
  // ========================================
  describe('search results header', () => {
    it('shows search results header when isSearchActive=true', () => {
      const msgs = [createMessage()]
      const wrapper = mountComponent({ messages: msgs, isSearchActive: true })
      const header = wrapper.find('.search-results-header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('搜索結果')
    })

    it('hides search results header when isSearchActive=false', () => {
      const wrapper = mountComponent({ isSearchActive: false })
      expect(wrapper.find('.search-results-header').exists()).toBe(false)
    })

    it('displays displayed message count in search header', () => {
      const msgs = [createMessage(), createMessage()]
      const wrapper = mountComponent({ messages: msgs, isSearchActive: true })
      const header = wrapper.find('.search-results-header')
      expect(header.text()).toContain('2')
    })

    it('emits searchClear when clear button is clicked', async () => {
      const msgs = [createMessage()]
      const wrapper = mountComponent({ messages: msgs, isSearchActive: true })
      const btn = wrapper.find('.clear-search-btn')
      expect(btn.exists()).toBe(true)
      await btn.trigger('click')
      expect(wrapper.emitted('searchClear')).toBeTruthy()
      expect(wrapper.emitted('searchClear')!.length).toBe(1)
    })
  })

  // ========================================
  // Date Separators
  // ========================================
  describe('date separators', () => {
    it('renders date separator items from virtualItems', () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const msgs = [
        createMessage({ id: 'msg-1', createdAt: yesterday.toISOString() }),
        createMessage({ id: 'msg-2', createdAt: today.toISOString() }),
      ]
      const vitems = createVirtualItemsFromMessages(msgs, true)
      // Should be: date-sep, msg-1, date-sep, msg-2
      expect(vitems.length).toBe(4)
      expect(vitems[0].type).toBe('date')
      expect(vitems[2].type).toBe('date')

      const wrapper = mountComponent({
        messages: msgs,
        showDateSeparators: true,
        virtualItemsOverride: vitems,
        virtualRenderedItems: vitems.map((_, i) => ({
          key: String(i),
          index: i,
          size: 40,
          start: i * 40,
        })),
      })

      const separators = wrapper.findAll('.date-separator-stub')
      expect(separators.length).toBe(2)
    })

    it('does not render date separators for messages on the same day', () => {
      const now = new Date()
      const msgs = [
        createMessage({ id: 'msg-1', createdAt: now.toISOString() }),
        createMessage({ id: 'msg-2', createdAt: now.toISOString() }),
      ]
      const vitems = createVirtualItemsFromMessages(msgs, true)
      // Same day: date-sep, msg-1, msg-2
      expect(vitems.length).toBe(3)
      expect(vitems.filter(v => v.type === 'date').length).toBe(1)

      const wrapper = mountComponent({
        messages: msgs,
        virtualItemsOverride: vitems,
        virtualRenderedItems: vitems.map((_, i) => ({
          key: String(i),
          index: i,
          size: 40,
          start: i * 40,
        })),
      })

      expect(wrapper.findAll('.date-separator-stub').length).toBe(1)
    })
  })

  // ========================================
  // Typing Indicator
  // ========================================
  describe('typing indicator', () => {
    it('renders typing indicator when virtualItems includes a typing item', () => {
      const typingItem: VirtualItem = {
        type: 'typing',
        data: new Date(),
        id: 'typing-indicator',
      }
      const vitems = [typingItem]

      const wrapper = mountComponent({
        virtualItemsOverride: vitems,
        virtualRenderedItems: [{ key: '0', index: 0, size: 60, start: 0 }],
      })

      const typingEl = wrapper.find('.typing-indicator')
      expect(typingEl.exists()).toBe(true)
      expect(typingEl.text()).toContain('對方正在輸入')
    })

    it('renders three typing dots', () => {
      const typingItem: VirtualItem = {
        type: 'typing',
        data: new Date(),
        id: 'typing-indicator',
      }

      const wrapper = mountComponent({
        virtualItemsOverride: [typingItem],
        virtualRenderedItems: [{ key: '0', index: 0, size: 60, start: 0 }],
      })

      const dots = wrapper.findAll('.typing-dots span')
      expect(dots.length).toBe(3)
    })
  })

  // ========================================
  // History Loading
  // ========================================
  describe('history loading', () => {
    it('shows history loading when loadingHistory=true and messages exist', () => {
      const msgs = [createMessage()]
      const wrapper = mountComponent({ messages: msgs, loadingHistory: true })
      const loader = wrapper.find('.history-loading-wrapper')
      expect(loader.exists()).toBe(true)
    })

    it('renders HamsterLoader with correct message', () => {
      const msgs = [createMessage()]
      const wrapper = mountComponent({ messages: msgs, loadingHistory: true })
      const hamster = wrapper.find('.hamster-loader-stub')
      expect(hamster.exists()).toBe(true)
      expect(hamster.text()).toContain('載入更多歷史訊息')
    })

    it('hides history loading when loadingHistory=false', () => {
      const msgs = [createMessage()]
      const wrapper = mountComponent({ messages: msgs, loadingHistory: false })
      expect(wrapper.find('.history-loading-wrapper').exists()).toBe(false)
    })

    it('hides history loading when messages are empty', () => {
      const wrapper = mountComponent({ messages: [], loadingHistory: true })
      expect(wrapper.find('.history-loading-wrapper').exists()).toBe(false)
    })
  })

  // ========================================
  // isUpdating class
  // ========================================
  describe('isUpdating', () => {
    it('adds updating class to virtual-content when isUpdating=true', () => {
      const wrapper = mountComponent({ isUpdating: true })
      expect(wrapper.find('.virtual-content.updating').exists()).toBe(true)
    })

    it('does not add updating class when isUpdating=false', () => {
      const wrapper = mountComponent({ isUpdating: false })
      expect(wrapper.find('.virtual-content.updating').exists()).toBe(false)
    })
  })

  // ========================================
  // Emits
  // ========================================
  describe('emits', () => {
    it('emits retry event via handleRetry when MessageBubble emits retry', async () => {
      const msg = createMessage({ id: 'msg-retry-1' })
      const vitems: VirtualItem[] = [{ type: 'message', data: msg, id: `message-${msg.id}` }]

      const wrapper = mountComponent({
        messages: [msg],
        virtualItemsOverride: vitems,
        virtualRenderedItems: [{ key: '0', index: 0, size: 80, start: 0 }],
      })

      const bubble = wrapper.findComponent(MessageBubbleStub)
      expect(bubble.exists()).toBe(true)
      bubble.vm.$emit('retry', 'msg-retry-1')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('retry')).toBeTruthy()
      expect(wrapper.emitted('retry')![0]).toEqual(['msg-retry-1'])
    })

    it('emits messageCopy when MessageBubble emits copy', async () => {
      const msg = createMessage({ id: 'msg-copy-1' })
      const vitems: VirtualItem[] = [{ type: 'message', data: msg, id: `message-${msg.id}` }]

      const wrapper = mountComponent({
        messages: [msg],
        virtualItemsOverride: vitems,
        virtualRenderedItems: [{ key: '0', index: 0, size: 80, start: 0 }],
      })

      const bubble = wrapper.findComponent(MessageBubbleStub)
      bubble.vm.$emit('copy', msg)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('messageCopy')).toBeTruthy()
    })

    it('emits messageReply when MessageBubble emits reply', async () => {
      const msg = createMessage({ id: 'msg-reply-1' })
      const vitems: VirtualItem[] = [{ type: 'message', data: msg, id: `message-${msg.id}` }]

      const wrapper = mountComponent({
        messages: [msg],
        virtualItemsOverride: vitems,
        virtualRenderedItems: [{ key: '0', index: 0, size: 80, start: 0 }],
      })

      const bubble = wrapper.findComponent(MessageBubbleStub)
      bubble.vm.$emit('reply', msg)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('messageReply')).toBeTruthy()
    })
  })

  // ========================================
  // Exposed methods
  // ========================================
  describe('exposed methods', () => {
    it('exposes scrollToMessage method', () => {
      const wrapper = mountComponent()
      expect(typeof wrapper.vm.scrollToMessage).toBe('function')
    })

    it('exposes scrollToTop method', () => {
      const wrapper = mountComponent()
      expect(typeof wrapper.vm.scrollToTop).toBe('function')
    })

    it('exposes scrollToBottom method', () => {
      const wrapper = mountComponent()
      expect(typeof wrapper.vm.scrollToBottom).toBe('function')
    })
  })

  // ========================================
  // Virtual item CSS classes
  // ========================================
  describe('virtual item classes', () => {
    it('applies date-separator-item class for date type items', () => {
      const dateItem: VirtualItem = {
        type: 'date',
        data: new Date(),
        id: 'date-test',
      }
      const wrapper = mountComponent({
        virtualItemsOverride: [dateItem],
        virtualRenderedItems: [{ key: '0', index: 0, size: 40, start: 0 }],
      })
      expect(wrapper.find('.date-separator-item').exists()).toBe(true)
    })

    it('applies message-item class for message type items', () => {
      const msg = createMessage()
      const msgItem: VirtualItem = { type: 'message', data: msg, id: `message-${msg.id}` }
      const wrapper = mountComponent({
        messages: [msg],
        virtualItemsOverride: [msgItem],
        virtualRenderedItems: [{ key: '0', index: 0, size: 80, start: 0 }],
      })
      expect(wrapper.find('.message-item').exists()).toBe(true)
    })
  })

  // ========================================
  // New message animation class
  // ========================================
  describe('new message animation', () => {
    it('adds message-new class when isNewMessage returns true', () => {
      const msg = createMessage({ id: 'new-msg-1' })
      mockIsNewMessage = (id: string) => id === 'new-msg-1'

      const msgItem: VirtualItem = { type: 'message', data: msg, id: `message-${msg.id}` }
      const wrapper = mountComponent({
        messages: [msg],
        virtualItemsOverride: [msgItem],
        virtualRenderedItems: [{ key: '0', index: 0, size: 80, start: 0 }],
      })

      expect(wrapper.find('.message-new').exists()).toBe(true)
    })

    it('does not add message-new class when isNewMessage returns false', () => {
      const msg = createMessage({ id: 'old-msg-1' })
      mockIsNewMessage = () => false

      const msgItem: VirtualItem = { type: 'message', data: msg, id: `message-${msg.id}` }
      const wrapper = mountComponent({
        messages: [msg],
        virtualItemsOverride: [msgItem],
        virtualRenderedItems: [{ key: '0', index: 0, size: 80, start: 0 }],
      })

      expect(wrapper.find('.message-new').exists()).toBe(false)
    })
  })
})
