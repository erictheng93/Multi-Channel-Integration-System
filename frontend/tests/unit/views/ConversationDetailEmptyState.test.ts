/**
 * ConversationDetail empty-state delay (isEmptyStateConfirmed).
 *
 * Mounts the real ConversationDetail view (controller and stores mocked) with fake timers and
 * checks that the empty state only appears 200ms after the first load finished with no messages,
 * and that late-arriving messages / unmount cancel it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import ConversationDetail from '@/views/ConversationDetail.vue'
import { ref, nextTick } from 'vue'

// ===== Mock Setup =====

// Track displayed messages for testing
const mockDisplayedMessages = ref<Array<{ id: string }>>([])
const mockHasLoadedInitially = ref(false)
const mockIsInitialLoading = ref(true)

// Mock stores used by ConversationDetail.vue
vi.mock('@/stores/conversations', () => ({
  useConversationsStore: vi.fn(() => ({
    currentConversation: ref(null),
    conversations: ref([]),
    loading: ref(false),
    fetchConversation: vi.fn(),
    updateConversationStatus: vi.fn(),
    addMessage: vi.fn(),
    transferredConversation: ref(null),
    receivedConversation: ref(null),
    clearTransferredState: vi.fn(),
    clearReceivedState: vi.fn(),
    initializeRealtime: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock composables used by ConversationDetail.vue
vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn()
  }))
}))

vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: vi.fn(() => ({
    showConfirm: vi.fn().mockResolvedValue(false),
    showDanger: vi.fn().mockResolvedValue(false),
    showWarning: vi.fn().mockResolvedValue(false),
    showInfo: vi.fn().mockResolvedValue(false)
  }))
}))

vi.mock('@/composables/useSearchPanel', () => ({
  useSearchPanel: vi.fn(() => ({
    isOpen: ref(false),
    searchRef: ref(null),
    toggle: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    handleSearchResults: vi.fn(),
    handleSearchClear: vi.fn()
  }))
}))

vi.mock('@/composables/useNewMessageNotification', () => ({
  useNewMessageNotification: vi.fn(() => ({
    isVisible: ref(false),
    scrollToNewest: vi.fn(),
    dismiss: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    handleScroll: vi.fn()
  }))
}))

vi.mock('@/composables/useDragAndDrop', () => ({
  useDragAndDrop: vi.fn(() => ({
    isDragging: ref(false),
    dragFiles: ref([]),
    onDragEnter: vi.fn(),
    onDragLeave: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn()
  }))
}))

vi.mock('@/composables/useQuickReplies', () => ({
  useQuickReplies: vi.fn(() => ({
    quickReplies: ref([]),
    showQuickReplies: ref(false),
    filteredReplies: ref([]),
    selectReply: vi.fn(),
    toggleQuickReplies: vi.fn()
  }))
}))

// Mock the controller composable
vi.mock('@/composables/conversation', () => ({
  useConversationController: vi.fn(() => ({
    conversation: ref({ id: '1', status: 'active', title: 'Test Conversation' }),
    messages: ref([]),
    displayedMessages: mockDisplayedMessages,
    loading: ref(false),
    skeletonCount: ref(5),
    loadingText: ref('Loading...'),
    isInitialLoading: mockIsInitialLoading,
    hasLoadedInitially: mockHasLoadedInitially,
    loadingHistory: ref(false),
    isUpdating: ref(false),
    isSearchActive: ref(false),
    searchResults: ref([]),
    setSearchResults: vi.fn(),
    clearSearch: vi.fn(),
    isWebSocketEnabled: ref(true),
    isConnected: ref(true),
    connectionState: ref('connected'),
    connectionProtocol: ref('websocket'),
    connectionQuality: ref('good'),
    connectionText: ref('Connected'),
    connectionStatusClass: ref('status-connected'),
    newMessageCount: ref(0),
    isTyping: ref(false),
    typingUsers: ref([]),
    scrollToBottom: vi.fn(),
    setScrollTarget: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
    onMessageSent: vi.fn(),
    onMessagePending: vi.fn(),
    onUploadProgress: vi.fn(),
    onMessageConfirmed: vi.fn(),
    onMessageFailed: vi.fn(),
    onTypingStart: vi.fn(),
    onTypingStop: vi.fn(),
    loadMoreMessages: vi.fn(),
    retryMessage: vi.fn(),
    refreshMessages: vi.fn().mockResolvedValue(undefined),
    onScroll: vi.fn(() => ({ isAtBottom: true })),
    recallMessage: vi.fn().mockResolvedValue(true),
    trackUserActivity: vi.fn(),
    _internals: {
      state: {
        httpMessages: {
          loading: ref(false),
          hasMore: ref(false),
          isHistoryPrepending: ref(false),
          historyPrependCount: ref(0)
        }
      }
    }
  }))
}))

const AppLayoutStub = {
  name: 'AppLayout',
  template: '<div class="app-layout-stub"><slot /></div>'
}

const EmptyStateStub = {
  name: 'EmptyState',
  template: '<div class="empty-state-stub">{{ title }}</div>',
  props: ['title', 'description']
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/conversations/:id', component: { template: '<div />' } }]
  })
  await router.push('/conversations/1')
  await router.isReady()
  const wrapper = mount(ConversationDetail, {
    global: {
      plugins: [pinia, router],
      stubs: {
        AppLayout: AppLayoutStub,
        ConversationHeader: true,
        ConversationSidePanel: true,
        ConversationWaitStrip: true,
        MessageListSkeleton: true,
        VirtualMessageList: true,
        MessageInput: true,
        MessageSearch: true,
        KeyboardShortcuts: true,
        EmptyState: EmptyStateStub,
        DragDropOverlay: true,
        ClosedConversationBanner: true,
        NewMessageNotification: true,
        QuickReplies: true,
        ConnectionStatusBar: true,
        ExportDialog: true,
        HistoryRetentionNotice: true
      }
    }
  })
  await flushPromises()
  return wrapper
}

// The wrapper uses v-show, i.e. inline display:none. isVisible() is unreliable on an element
// that is not attached to the document, so read the inline style directly.
const emptyWrapperVisible = (w: Awaited<ReturnType<typeof mountView>>) =>
  (w.find('.empty-state-wrapper').element as HTMLElement).style.display !== 'none'

describe('ConversationDetail empty state delay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockDisplayedMessages.value = []
    mockHasLoadedInitially.value = false
    mockIsInitialLoading.value = true
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('hides the empty state until 200ms after the load finished with no messages', async () => {
    const wrapper = await mountView()
    mockHasLoadedInitially.value = true
    mockIsInitialLoading.value = false
    await nextTick()

    expect(emptyWrapperVisible(wrapper)).toBe(false)

    vi.advanceTimersByTime(199)
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(false)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(true)

    wrapper.unmount()
  })

  it('never shows the empty state if messages arrive within the 200ms window', async () => {
    const wrapper = await mountView()
    mockHasLoadedInitially.value = true
    mockIsInitialLoading.value = false
    await nextTick()

    vi.advanceTimersByTime(100)
    mockDisplayedMessages.value = [{ id: 'msg-1' }]
    await nextTick()

    vi.advanceTimersByTime(500)
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(false)

    wrapper.unmount()
  })

  it('does not show the empty state while the first load has not finished', async () => {
    const wrapper = await mountView()

    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(false)

    wrapper.unmount()
  })

  it('hides the confirmed empty state again when a message arrives', async () => {
    const wrapper = await mountView()
    mockHasLoadedInitially.value = true
    mockIsInitialLoading.value = false
    await nextTick()
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(true)

    mockDisplayedMessages.value = [{ id: 'msg-1' }]
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(false)

    wrapper.unmount()
  })

  it('restarts the delay when the list empties again after messages', async () => {
    const wrapper = await mountView()
    mockHasLoadedInitially.value = true
    mockIsInitialLoading.value = false
    mockDisplayedMessages.value = [{ id: 'msg-1' }]
    await nextTick()

    mockDisplayedMessages.value = []
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(false)
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(emptyWrapperVisible(wrapper)).toBe(true)

    wrapper.unmount()
  })

  it('cancels the pending timer on unmount', async () => {
    const wrapper = await mountView()
    mockHasLoadedInitially.value = true
    mockIsInitialLoading.value = false
    await nextTick()

    const before = vi.getTimerCount()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBeLessThan(before)
  })
})
