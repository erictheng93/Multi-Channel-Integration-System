/**
 * Unit Tests for useConversationState Composable
 *
 * @module tests/unit/composables/conversation/useConversationState.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { Message, Conversation } from '@/types'

// ===== Mock Dependencies =====

// Mock useCustomerMessages
const mockHttpMessages = ref<Message[]>([])
const mockHttpLoading = ref(false)
const mockHttpHasMore = ref(true)
const mockHttpIsLoadingInitial = ref(false)
const mockHttpFetchMessages = vi.fn().mockResolvedValue(undefined)
const mockHttpRefreshMessages = vi.fn().mockResolvedValue(undefined)
const mockHttpLoadMoreMessages = vi.fn().mockResolvedValue(undefined)
const mockHttpAddMessage = vi.fn((message: Message) => {
  mockHttpMessages.value = [...mockHttpMessages.value, message]
})

vi.mock('@/composables/useCustomerMessages', () => ({
  useCustomerMessages: vi.fn(() => ({
    messages: mockHttpMessages,
    loading: mockHttpLoading,
    hasMore: mockHttpHasMore,
    isLoadingInitial: mockHttpIsLoadingInitial,
    fetchMessages: mockHttpFetchMessages,
    refreshMessages: mockHttpRefreshMessages,
    loadMoreMessages: mockHttpLoadMoreMessages,
    addMessage: mockHttpAddMessage
  }))
}))

// Mock useSmoothLoading
const mockSmoothMessages = ref<Message[]>([])
const mockIsUpdating = ref(false)
const mockUpdateMessages = vi.fn()
const mockSetMessagesImmediate = vi.fn((msgs: Message[]) => {
  mockSmoothMessages.value = [...msgs]
})

vi.mock('@/composables/useSmoothLoading', () => ({
  useSmoothLoading: vi.fn(() => ({
    messages: mockSmoothMessages,
    isUpdating: mockIsUpdating,
    updateMessages: mockUpdateMessages,
    setMessagesImmediate: mockSetMessagesImmediate
  }))
}))

// Mock useLoadingState
const mockHasLoadedInitially = ref(false)
const mockIsInitialLoading = ref(true)
const mockLoadingHistory = ref(false)
const mockSetHistoryLoading = vi.fn((val: boolean) => {
  mockLoadingHistory.value = val
})
const mockConfirmNoMessages = vi.fn()
const mockResetLoadingState = vi.fn()

vi.mock('@/composables/useLoadingState', () => ({
  useLoadingState: vi.fn(() => ({
    hasLoadedInitially: mockHasLoadedInitially,
    isInitialLoading: mockIsInitialLoading,
    loadingHistory: mockLoadingHistory,
    setHistoryLoading: mockSetHistoryLoading,
    confirmNoMessages: mockConfirmNoMessages,
    resetLoadingState: mockResetLoadingState
  }))
}))

// Mock conversations store
// Note: currentConversation must be a plain property (not a ref) because the composable
// accesses it as `conversationsStore.currentConversation` directly in a computed.
const mockStoreState = {
  currentConversation: null as Conversation | null
}
const mockFetchConversation = vi.fn().mockResolvedValue(undefined)
const mockMarkAsRead = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/conversations', () => ({
  useConversationsStore: vi.fn(() => ({
    get currentConversation() { return mockStoreState.currentConversation },
    fetchConversation: mockFetchConversation,
    markAsRead: mockMarkAsRead
  }))
}))

// Mock conversationCache
vi.mock('@/utils/conversationCache', () => ({
  conversationCache: {
    getEstimatedMessageCount: vi.fn(() => 5)
  }
}))

// ===== Test Helpers =====

function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-test-001',
    content: 'Test message',
    role: 'customer',
    senderId: 'sender-1',
    platform: 'line',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    ...overrides
  } as Message
}

function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-test-001',
    customerId: 'customer-1',
    customerName: 'Test Customer',
    platform: 'line',
    status: 'active',
    lastMessageAt: '2024-01-01T10:00:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    unreadCount: 0,
    ...overrides
  } as Conversation
}

// ===== Tests =====

describe('useConversationState', () => {
  const conversationId = 'conv-test-001'

  // Dynamic import to ensure mocks are in place
  let useConversationState: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Reset all mock refs
    mockHttpMessages.value = []
    mockHttpLoading.value = false
    mockHttpHasMore.value = true
    mockHttpIsLoadingInitial.value = false
    mockSmoothMessages.value = []
    mockIsUpdating.value = false
    mockHasLoadedInitially.value = false
    mockIsInitialLoading.value = true
    mockLoadingHistory.value = false
    mockStoreState.currentConversation = null

    // Dynamic import
    const mod = await import('@/composables/conversation/useConversationState')
    useConversationState = mod.useConversationState
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should return all expected properties and methods', () => {
      const state = useConversationState(conversationId)

      // Computed state
      expect(state.conversation).toBeDefined()
      expect(state.messages).toBeDefined()
      expect(state.displayedMessages).toBeDefined()
      expect(state.messageCount).toBeDefined()
      expect(state.loading).toBeDefined()
      expect(state.hasMore).toBeDefined()
      expect(state.skeletonCount).toBeDefined()
      expect(state.loadingText).toBeDefined()
      expect(state.isLoadingInitial).toBeDefined()

      // Loading state
      expect(state.hasLoadedInitially).toBeDefined()
      expect(state.isInitialLoading).toBeDefined()
      expect(state.loadingHistory).toBeDefined()
      expect(state.isUpdating).toBeDefined()

      // Search state
      expect(state.searchResults).toBeDefined()
      expect(state.isSearchActive).toBeDefined()

      // Unified connection state
      expect(state.unifiedMessages).toBeDefined()
      expect(state.unifiedIsConnected).toBeDefined()

      // Methods
      expect(typeof state.setUnifiedMessages).toBe('function')
      expect(typeof state.setUnifiedConnected).toBe('function')
      expect(typeof state.loadConversation).toBe('function')
      expect(typeof state.refreshMessages).toBe('function')
      expect(typeof state.refreshMessagesAfterReconnection).toBe('function')
      expect(typeof state.loadMoreMessages).toBe('function')
      expect(typeof state.addMessage).toBe('function')
      expect(typeof state.resetLoadingState).toBe('function')
      expect(typeof state.debouncedUpdateMessages).toBe('function')
      expect(typeof state.queueMessageUpdate).toBe('function')
      expect(typeof state.setSearchResults).toBe('function')
      expect(typeof state.clearSearch).toBe('function')
      expect(typeof state.setHistoryLoading).toBe('function')

      // Debug/test refs
      expect(state.updateQueue).toBeDefined()
      expect(state.isProcessingQueue).toBeDefined()
      expect(state.lastMessageTimestamp).toBeDefined()
    })

    it('should initialize with default options', () => {
      const state = useConversationState(conversationId)

      expect(state.unifiedIsConnected.value).toBe(false)
      expect(state.unifiedMessages.value).toEqual([])
      expect(state.searchResults.value).toEqual([])
      expect(state.isSearchActive.value).toBe(false)
      expect(state.lastMessageTimestamp.value).toBeNull()
      expect(state.updateQueue.value).toEqual([])
      expect(state.isProcessingQueue.value).toBe(false)
    })

    it('should accept custom options', () => {
      // Should not throw with custom options
      const state = useConversationState(conversationId, {
        enablePagination: false,
        pageSize: 50,
        enableProgressiveLoading: true
      })

      expect(state).toBeDefined()
    })
  })

  describe('computed: conversation', () => {
    it('should return current conversation from store', () => {
      const conv = createMockConversation()
      mockStoreState.currentConversation = conv

      const state = useConversationState(conversationId)
      expect(state.conversation.value).toEqual(conv)
    })

    it('should return undefined when no current conversation', () => {
      mockStoreState.currentConversation = null

      const state = useConversationState(conversationId)
      expect(state.conversation.value).toBeUndefined()
    })
  })

  describe('computed: messages', () => {
    it('should return HTTP messages when not connected', () => {
      const msgs = [createMockMessage({ id: 'msg-1' }), createMockMessage({ id: 'msg-2' })]
      mockHttpMessages.value = msgs

      const state = useConversationState(conversationId)
      expect(state.messages.value).toEqual(msgs)
    })

    it('should merge unified and HTTP messages when connected with messages', async () => {
      const httpMsg = createMockMessage({ id: 'msg-http-1', createdAt: '2024-01-01T09:00:00Z' })
      const unifiedMsg = createMockMessage({ id: 'msg-ws-1', createdAt: '2024-01-01T10:00:00Z' })

      mockHttpMessages.value = [httpMsg]

      const state = useConversationState(conversationId)
      state.unifiedIsConnected.value = true
      state.unifiedMessages.value = [unifiedMsg]

      await nextTick()

      const result = state.messages.value
      expect(result).toHaveLength(2)
      // Should be sorted by createdAt
      expect(result[0].id).toBe('msg-http-1')
      expect(result[1].id).toBe('msg-ws-1')
    })

    it('should deduplicate messages when merging unified and HTTP', async () => {
      const sharedMsg = createMockMessage({ id: 'msg-shared', createdAt: '2024-01-01T10:00:00Z' })

      mockHttpMessages.value = [sharedMsg]

      const state = useConversationState(conversationId)
      state.unifiedIsConnected.value = true
      state.unifiedMessages.value = [{ ...sharedMsg }]

      await nextTick()

      // Should not have duplicates
      expect(state.messages.value).toHaveLength(1)
      expect(state.messages.value[0].id).toBe('msg-shared')
    })

    it('should fallback to HTTP messages when connected but unified messages empty', async () => {
      const httpMsg = createMockMessage({ id: 'msg-http-1' })
      mockHttpMessages.value = [httpMsg]

      const state = useConversationState(conversationId)
      state.unifiedIsConnected.value = true
      state.unifiedMessages.value = []

      await nextTick()

      expect(state.messages.value).toEqual([httpMsg])
    })

    it('should return empty array when connected with no messages anywhere', async () => {
      mockHttpMessages.value = []

      const state = useConversationState(conversationId)
      state.unifiedIsConnected.value = true
      state.unifiedMessages.value = []

      await nextTick()

      expect(state.messages.value).toEqual([])
    })
  })

  describe('computed: displayedMessages', () => {
    it('should return smooth messages when search is not active', () => {
      const msgs = [createMockMessage({ id: 'msg-1' })]
      mockSmoothMessages.value = msgs

      const state = useConversationState(conversationId)
      expect(state.displayedMessages.value).toEqual(msgs)
    })

    it('should return search results when search is active', () => {
      const searchMsg = createMockMessage({ id: 'msg-search-1', content: 'found it' })
      mockSmoothMessages.value = [createMockMessage({ id: 'msg-1' })]

      const state = useConversationState(conversationId)
      state.setSearchResults([searchMsg])

      expect(state.displayedMessages.value).toEqual([searchMsg])
    })
  })

  describe('computed: messageCount', () => {
    it('should return the count of messages', () => {
      mockHttpMessages.value = [
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
        createMockMessage({ id: 'msg-3' })
      ]

      const state = useConversationState(conversationId)
      expect(state.messageCount.value).toBe(3)
    })

    it('should return 0 when there are no messages', () => {
      mockHttpMessages.value = []

      const state = useConversationState(conversationId)
      expect(state.messageCount.value).toBe(0)
    })
  })

  describe('computed: loading', () => {
    it('should return false when unified is connected', () => {
      mockHttpLoading.value = true

      const state = useConversationState(conversationId)
      state.unifiedIsConnected.value = true

      expect(state.loading.value).toBe(false)
    })

    it('should return HTTP loading state when not connected', () => {
      mockHttpLoading.value = true

      const state = useConversationState(conversationId)
      expect(state.loading.value).toBe(true)
    })

    it('should return false when not connected and not loading', () => {
      mockHttpLoading.value = false

      const state = useConversationState(conversationId)
      expect(state.loading.value).toBe(false)
    })
  })

  describe('computed: hasMore', () => {
    it('should reflect httpMessages hasMore', () => {
      mockHttpHasMore.value = true

      const state = useConversationState(conversationId)
      expect(state.hasMore.value).toBe(true)

      mockHttpHasMore.value = false
      expect(state.hasMore.value).toBe(false)
    })
  })

  describe('computed: skeletonCount', () => {
    it('should return estimated message count from cache', () => {
      const state = useConversationState(conversationId)
      expect(state.skeletonCount.value).toBe(5)
    })
  })

  describe('computed: loadingText', () => {
    it('should return initial loading text when loading initial', () => {
      mockHttpIsLoadingInitial.value = true

      const state = useConversationState(conversationId)
      expect(state.loadingText.value).toContain('載入最近消息')
    })

    it('should return history loading text when loading history', () => {
      mockHttpIsLoadingInitial.value = false
      mockLoadingHistory.value = true

      const state = useConversationState(conversationId)
      expect(state.loadingText.value).toContain('載入對話歷史')
    })

    it('should return default loading text', () => {
      mockHttpIsLoadingInitial.value = false
      mockLoadingHistory.value = false

      const state = useConversationState(conversationId)
      expect(state.loadingText.value).toContain('載入對話歷史')
    })
  })

  describe('computed: isLoadingInitial', () => {
    it('should reflect httpMessages isLoadingInitial', () => {
      mockHttpIsLoadingInitial.value = true

      const state = useConversationState(conversationId)
      expect(state.isLoadingInitial.value).toBe(true)

      mockHttpIsLoadingInitial.value = false
      expect(state.isLoadingInitial.value).toBe(false)
    })
  })

  describe('setUnifiedMessages', () => {
    it('should set unified messages from a ref', () => {
      const state = useConversationState(conversationId)
      const msgs = [createMockMessage({ id: 'ws-msg-1' })]
      const messagesRef = ref(msgs)

      state.setUnifiedMessages(messagesRef)
      expect(state.unifiedMessages.value).toEqual(msgs)
    })
  })

  describe('setUnifiedConnected', () => {
    it('should set unified connection state', () => {
      const state = useConversationState(conversationId)

      state.setUnifiedConnected(true)
      expect(state.unifiedIsConnected.value).toBe(true)

      state.setUnifiedConnected(false)
      expect(state.unifiedIsConnected.value).toBe(false)
    })
  })

  describe('setSearchResults', () => {
    it('should set search results and activate search', () => {
      const state = useConversationState(conversationId)
      const results = [createMockMessage({ id: 'search-1' })]

      state.setSearchResults(results)

      expect(state.searchResults.value).toEqual(results)
      expect(state.isSearchActive.value).toBe(true)
    })

    it('should deactivate search when results are empty', () => {
      const state = useConversationState(conversationId)

      // First activate search
      state.setSearchResults([createMockMessage({ id: 'search-1' })])
      expect(state.isSearchActive.value).toBe(true)

      // Then clear with empty array
      state.setSearchResults([])
      expect(state.isSearchActive.value).toBe(false)
    })
  })

  describe('clearSearch', () => {
    it('should clear search results and deactivate search', () => {
      const state = useConversationState(conversationId)

      state.setSearchResults([createMockMessage({ id: 'search-1' })])
      expect(state.isSearchActive.value).toBe(true)

      state.clearSearch()

      expect(state.searchResults.value).toEqual([])
      expect(state.isSearchActive.value).toBe(false)
    })
  })

  describe('loadConversation', () => {
    it('should fetch conversation and messages', async () => {
      const conv = createMockConversation({ unreadCount: 0 })
      mockStoreState.currentConversation = conv

      const state = useConversationState(conversationId)
      await state.loadConversation()

      expect(mockFetchConversation).toHaveBeenCalledWith(conversationId)
      expect(mockHttpFetchMessages).toHaveBeenCalled()
    })

    it('should mark conversation as read if there are unread messages', async () => {
      const conv = createMockConversation({ unreadCount: 5 })
      mockStoreState.currentConversation = conv

      const state = useConversationState(conversationId)
      await state.loadConversation()

      expect(mockMarkAsRead).toHaveBeenCalledWith(conversationId)
    })

    it('should not mark as read if unreadCount is 0', async () => {
      const conv = createMockConversation({ unreadCount: 0 })
      mockStoreState.currentConversation = conv

      const state = useConversationState(conversationId)
      await state.loadConversation()

      expect(mockMarkAsRead).not.toHaveBeenCalled()
    })

    it('should apply immediate messages update when messages are loaded', async () => {
      const msgs = [createMockMessage({ id: 'msg-1', createdAt: '2024-01-01T10:00:00Z' })]
      mockStoreState.currentConversation = createMockConversation()
      mockHttpFetchMessages.mockImplementation(async () => {
        mockHttpMessages.value = msgs
      })

      const state = useConversationState(conversationId)
      await state.loadConversation()

      expect(mockSetMessagesImmediate).toHaveBeenCalledWith(msgs)
    })

    it('should set lastMessageTimestamp from the last loaded message', async () => {
      const msgs = [
        createMockMessage({ id: 'msg-1', createdAt: '2024-01-01T09:00:00Z' }),
        createMockMessage({ id: 'msg-2', createdAt: '2024-01-01T10:00:00Z' })
      ]
      mockStoreState.currentConversation = createMockConversation()
      mockHttpFetchMessages.mockImplementation(async () => {
        mockHttpMessages.value = msgs
      })

      const state = useConversationState(conversationId)
      await state.loadConversation()

      expect(state.lastMessageTimestamp.value).toBe('2024-01-01T10:00:00.000Z')
    })

    it('should confirm no messages when no messages loaded', async () => {
      mockStoreState.currentConversation = createMockConversation()
      mockHttpFetchMessages.mockImplementation(async () => {
        mockHttpMessages.value = []
      })

      const state = useConversationState(conversationId)
      await state.loadConversation()

      expect(mockConfirmNoMessages).toHaveBeenCalled()
    })

    it('should throw when fetchConversation fails', async () => {
      mockFetchConversation.mockRejectedValueOnce(new Error('Network error'))

      const state = useConversationState(conversationId)
      await expect(state.loadConversation()).rejects.toThrow('Network error')
    })
  })

  describe('refreshMessages', () => {
    it('should call httpMessages.refreshMessages', async () => {
      const state = useConversationState(conversationId)
      await state.refreshMessages()

      expect(mockHttpRefreshMessages).toHaveBeenCalled()
    })

    it('should throw when refresh fails', async () => {
      mockHttpRefreshMessages.mockRejectedValueOnce(new Error('Refresh failed'))

      const state = useConversationState(conversationId)
      await expect(state.refreshMessages()).rejects.toThrow('Refresh failed')
    })
  })

  describe('refreshMessagesAfterReconnection', () => {
    it('should fetch messages and apply immediate update', async () => {
      const msgs = [createMockMessage({ id: 'msg-1' })]
      mockHttpFetchMessages.mockImplementation(async () => {
        mockHttpMessages.value = msgs
      })

      const state = useConversationState(conversationId)
      await state.refreshMessagesAfterReconnection()

      expect(mockHttpFetchMessages).toHaveBeenCalled()
      expect(mockSetMessagesImmediate).toHaveBeenCalledWith(msgs)
    })

    it('should not call setMessagesImmediate when no messages', async () => {
      mockHttpFetchMessages.mockImplementation(async () => {
        mockHttpMessages.value = []
      })

      const state = useConversationState(conversationId)
      await state.refreshMessagesAfterReconnection()

      expect(mockSetMessagesImmediate).not.toHaveBeenCalled()
    })

    it('should throw when fetch fails during reconnection', async () => {
      mockHttpFetchMessages.mockRejectedValueOnce(new Error('Fetch failed'))

      const state = useConversationState(conversationId)
      await expect(state.refreshMessagesAfterReconnection()).rejects.toThrow('Fetch failed')
    })
  })

  describe('loadMoreMessages', () => {
    it('should set history loading and call loadMoreMessages', async () => {
      const state = useConversationState(conversationId)
      await state.loadMoreMessages()

      expect(mockSetHistoryLoading).toHaveBeenCalledWith(true)
      expect(mockHttpLoadMoreMessages).toHaveBeenCalled()
      expect(mockSetHistoryLoading).toHaveBeenCalledWith(false)
    })

    it('should reset history loading even if loadMore fails', async () => {
      mockHttpLoadMoreMessages.mockRejectedValueOnce(new Error('Load more failed'))

      const state = useConversationState(conversationId)

      // The error propagates (try/finally without catch) but loading state is still reset
      try {
        await state.loadMoreMessages()
      } catch {
        // expected
      }

      // Should still reset loading state
      expect(mockSetHistoryLoading).toHaveBeenCalledWith(false)
    })
  })

  describe('addMessage', () => {
    it('should add message via httpMessages', () => {
      const state = useConversationState(conversationId)
      const msg = createMockMessage({ id: 'new-msg', createdAt: '2024-01-01T12:00:00Z' })

      state.addMessage(msg)

      expect(mockHttpAddMessage).toHaveBeenCalledWith(msg)
    })

    it('should update lastMessageTimestamp when message is newer', () => {
      const state = useConversationState(conversationId)

      const msg1 = createMockMessage({ id: 'msg-1', createdAt: '2024-01-01T10:00:00Z' })
      state.addMessage(msg1)
      expect(state.lastMessageTimestamp.value).toBe('2024-01-01T10:00:00.000Z')

      const msg2 = createMockMessage({ id: 'msg-2', createdAt: '2024-01-01T12:00:00Z' })
      state.addMessage(msg2)
      expect(state.lastMessageTimestamp.value).toBe('2024-01-01T12:00:00.000Z')
    })

    it('should not update lastMessageTimestamp when message is older', () => {
      const state = useConversationState(conversationId)

      const msg1 = createMockMessage({ id: 'msg-1', createdAt: '2024-01-01T12:00:00Z' })
      state.addMessage(msg1)

      const msg2 = createMockMessage({ id: 'msg-2', createdAt: '2024-01-01T08:00:00Z' })
      state.addMessage(msg2)

      expect(state.lastMessageTimestamp.value).toBe('2024-01-01T12:00:00.000Z')
    })
  })

  describe('queueMessageUpdate', () => {
    it('should queue messages and process them', async () => {
      const state = useConversationState(conversationId)
      const msgs = [createMockMessage({ id: 'msg-1' })]

      state.queueMessageUpdate(msgs)

      // Wait for nextTick processing
      await nextTick()
      await nextTick()

      expect(mockUpdateMessages).toHaveBeenCalledWith(msgs, true)
    })

    it('should skip update when message length is unchanged', async () => {
      const state = useConversationState(conversationId)
      const msgs1 = [createMockMessage({ id: 'msg-1' })]
      const msgs2 = [createMockMessage({ id: 'msg-2' })]

      // First call should queue
      state.queueMessageUpdate(msgs1)
      await nextTick()
      await nextTick()

      mockUpdateMessages.mockClear()

      // Second call with same length should skip
      state.queueMessageUpdate(msgs2)
      await nextTick()
      await nextTick()

      expect(mockUpdateMessages).not.toHaveBeenCalled()
    })

    it('should batch queue items and process the latest when queue is pre-populated', async () => {
      const state = useConversationState(conversationId)

      const msgs1 = [createMockMessage({ id: 'msg-1' })]
      const msgs2 = [createMockMessage({ id: 'msg-1' }), createMockMessage({ id: 'msg-2' })]
      const msgs3 = [
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
        createMockMessage({ id: 'msg-3' })
      ]

      // Directly populate the queue to simulate batched updates
      state.updateQueue.value = [msgs1, msgs2, msgs3]

      // Trigger a single update that will process the queue
      // queueMessageUpdate with a new length will call processUpdateQueue
      state.queueMessageUpdate([
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
        createMockMessage({ id: 'msg-3' }),
        createMockMessage({ id: 'msg-4' })
      ])

      await nextTick()
      await nextTick()

      // The processor takes the last item from the queue (the 4-message array)
      expect(mockUpdateMessages).toHaveBeenCalledTimes(1)
      const calledMessages = mockUpdateMessages.mock.calls[0][0] as Message[]
      expect(calledMessages).toHaveLength(4)
    })
  })

  describe('debouncedUpdateMessages', () => {
    it('should delegate to queueMessageUpdate', async () => {
      const state = useConversationState(conversationId)
      const msgs = [createMockMessage({ id: 'msg-1' })]

      state.debouncedUpdateMessages(msgs)

      await nextTick()
      await nextTick()

      expect(mockUpdateMessages).toHaveBeenCalledWith(msgs, true)
    })
  })

  describe('resetLoadingState', () => {
    it('should call loadingState.resetLoadingState', () => {
      const state = useConversationState(conversationId)
      state.resetLoadingState()

      expect(mockResetLoadingState).toHaveBeenCalled()
    })
  })

  describe('loading state refs', () => {
    it('should expose hasLoadedInitially from loadingState', () => {
      mockHasLoadedInitially.value = true

      const state = useConversationState(conversationId)
      expect(state.hasLoadedInitially.value).toBe(true)
    })

    it('should expose isInitialLoading from loadingState', () => {
      mockIsInitialLoading.value = false

      const state = useConversationState(conversationId)
      expect(state.isInitialLoading.value).toBe(false)
    })

    it('should expose loadingHistory from loadingState', () => {
      mockLoadingHistory.value = true

      const state = useConversationState(conversationId)
      expect(state.loadingHistory.value).toBe(true)
    })

    it('should expose isUpdating from smoothLoading', () => {
      mockIsUpdating.value = true

      const state = useConversationState(conversationId)
      expect(state.isUpdating.value).toBe(true)
    })
  })
})
