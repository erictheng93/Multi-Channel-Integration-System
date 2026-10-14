/* eslint-disable vue/one-component-per-file -- tiny render stubs for the view under test */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import type { Conversation } from '@/types'

const store = reactive({
  loading: false,
  loadError: null as string | null,
  error: null as string | null,
  conversations: [] as Conversation[],
  pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
  $state: {},
  fetchConversations: vi.fn(),
  loadWithCache: vi.fn(),
  setActiveFilters: vi.fn(),
  initializeRealtime: vi.fn(),
  cleanup: vi.fn(),
  bulkSetConversationsClosed: vi.fn()
})

vi.mock('@/stores/conversations', () => ({ useConversationsStore: () => store }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/tagCacheService', () => ({
  tagCacheService: { ensureTagsLoaded: vi.fn().mockResolvedValue([]) }
}))

import ConversationsTable from '@/views/ConversationsTable.vue'

const SlotStub = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
const TableStub = defineComponent({
  name: 'ConversationDesktopTable',
  props: { conversations: { type: Array, default: () => [] } },
  setup: () => () => h('div')
})
const FiltersStub = defineComponent({
  name: 'ConversationFilters',
  emits: ['update:filter'],
  setup: () => () => h('div')
})

function conv(id: string, status: Conversation['status']): Conversation {
  return { id, status, unreadCount: 0, userId: id, lastMessageAt: 1, createdAt: 1, updatedAt: 1 } as Conversation
}

const mounted: Array<{ unmount: () => void }> = []
function mountView() {
  const wrapper = mount(ConversationsTable, {
    global: {
      stubs: {
        AppLayout: SlotStub,
        ErrorBoundary: SlotStub,
        ConversationDesktopTable: TableStub,
        ConversationMobileCards: true,
        ConversationFilters: FiltersStub,
        RefreshButton: true,
        HamsterLoader: true,
        ConversationSyncIndicator: true
      }
    }
  })
  mounted.push(wrapper)
  return wrapper
}

const lastScope = () => store.fetchConversations.mock.calls[store.fetchConversations.mock.calls.length - 1]?.[0]?.scope
const lastCall = () => store.fetchConversations.mock.calls[store.fetchConversations.mock.calls.length - 1]?.[0]
const shownIds = (wrapper: ReturnType<typeof mountView>) =>
  (wrapper.findComponent(TableStub).props('conversations') as Conversation[]).map(c => c.id)

describe('ConversationsTable scope tabs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    store.conversations = [conv('open-1', 'active'), conv('closed-1', 'closed'), conv('open-2', 'assigned')]
  })
  afterEach(() => {
    mounted.splice(0).forEach(w => w.unmount())
    vi.useRealTimers()
  })

  it('defaults to 處理中: first load and polling filters ask for scope=open, closed rows are hidden', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(store.loadWithCache.mock.calls[0]?.[0]?.scope).toBe('open')
    expect(store.setActiveFilters.mock.calls[0]?.[0]?.scope).toBe('open')
    expect(wrapper.find('.scope-tab.active').text()).toBe('處理中')
    expect(shownIds(wrapper)).toEqual(['open-1', 'open-2'])
  })

  it('switching to 已結案 refetches with scope=closed and shows only closed rows', async () => {
    const wrapper = mountView()
    await flushPromises()

    const closedTab = wrapper.findAll('.scope-tab').find(t => t.text() === '已結案')
    await closedTab?.trigger('click')
    vi.advanceTimersByTime(350)
    await flushPromises()

    expect(lastScope()).toBe('closed')
    expect(shownIds(wrapper)).toEqual(['closed-1'])
  })

  it('drops the status filter on 已結案 so the tab is not intersected into emptiness', async () => {
    const wrapper = mountView()
    await flushPromises()

    wrapper.findComponent(FiltersStub).vm.$emit('update:filter', 'status', 'active')
    await flushPromises()
    vi.advanceTimersByTime(350)
    await flushPromises()
    expect(lastCall()?.status).toBe('active')

    await wrapper.findAll('.scope-tab').find(t => t.text() === '已結案')?.trigger('click')
    vi.advanceTimersByTime(350)
    await flushPromises()

    expect(lastScope()).toBe('closed')
    expect(lastCall()?.status).toBeUndefined()
  })

  it('refetches to refill the page when a row leaves the scope and more pages exist', async () => {
    store.pagination.totalPages = 3
    mountView()
    await flushPromises()
    vi.advanceTimersByTime(600)
    await flushPromises()
    store.fetchConversations.mockClear()

    store.conversations = store.conversations.map((c: Conversation) => (c.id === 'open-1' ? conv('open-1', 'closed') : c))
    await flushPromises()
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(store.fetchConversations).toHaveBeenCalledTimes(1)
    expect(store.fetchConversations.mock.calls[0]?.[0]?.scope).toBe('open')
    store.pagination.totalPages = 1
  })

  it('searching a customer name searches 全部 so closed cases are still found, and says so', async () => {
    const wrapper = mountView()
    await flushPromises()

    wrapper.findComponent(FiltersStub).vm.$emit('update:filter', 'customerName', '王')
    await flushPromises()
    vi.advanceTimersByTime(350)
    await flushPromises()

    expect(lastScope()).toBe('all')
    expect(shownIds(wrapper)).toContain('closed-1')
    expect(wrapper.find('.scope-hint').text()).toContain('已結案')
  })
})
