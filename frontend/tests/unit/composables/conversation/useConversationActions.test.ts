/**
 * Unit Tests for useConversationActions Composable
 *
 * @module tests/unit/composables/conversation/useConversationActions.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useConversationActions } from '@/composables/conversation/useConversationActions'
import { messageApi } from '@/api/message'
import type { ConversationState } from '@/composables/conversation/useConversationState'
import type { WebSocketIntegration } from '@/composables/conversation/useWebSocketIntegration'

vi.mock('@/api/message', () => ({
  messageApi: {
    recallMessage: vi.fn().mockResolvedValue({ success: true })
  }
}))

// ===== Mock State & WebSocket =====

function createMockState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    refreshMessages: vi.fn().mockResolvedValue(undefined),
    loadMoreMessages: vi.fn().mockResolvedValue(undefined),
    markMessageRecalled: vi.fn(() => undefined),
    // Provide minimal required properties
    conversationsStore: {} as any,
    httpMessages: {} as any,
    conversation: computed(() => null),
    messages: ref([]),
    displayedMessages: ref([]),
    messageCount: computed(() => 0),
    loading: ref(false),
    hasMore: ref(true),
    skeletonCount: computed(() => 0),
    loadingText: computed(() => ''),
    isLoadingInitial: ref(false),
    hasLoadedInitially: ref(false),
    isInitialLoading: ref(true),
    loadingHistory: ref(false),
    isUpdating: ref(false),
    searchResults: ref([]),
    isSearchActive: ref(false),
    setSearchResults: vi.fn(),
    clearSearch: vi.fn(),
    lastMessageTimestamp: ref(null),
    unifiedMessages: ref([]),
    unifiedIsConnected: ref(false),
    setUnifiedMessages: vi.fn(),
    setUnifiedConnected: vi.fn(),
    loadConversation: vi.fn(),
    refreshMessagesAfterReconnection: vi.fn(),
    addMessage: vi.fn(),
    resetLoadingState: vi.fn(),
    debouncedUpdateMessages: vi.fn(),
    queueMessageUpdate: vi.fn(),
    setHistoryLoading: vi.fn(),
    updateQueue: ref([]),
    isProcessingQueue: ref(false),
    ...overrides
  } as unknown as ConversationState
}

function createMockWebSocket(overrides: Partial<WebSocketIntegration> = {}): WebSocketIntegration {
  return {
    unifiedConnectionState: ref('connected'),
    unifiedIsConnected: ref(true),
    reconnect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    unifiedConnection: ref(null),
    unifiedConnectionType: ref('websocket'),
    currentProtocol: ref('websocket'),
    connectionQuality: ref('good'),
    connectionText: computed(() => ''),
    connectionStatusClass: computed(() => ''),
    isWebSocketEnabled: ref(true),
    isTyping: ref(false),
    typingUsers: ref([]),
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    newMessageCount: ref(0),
    ...overrides
  } as unknown as WebSocketIntegration
}

describe('useConversationActions', () => {
  let mockState: ConversationState
  let mockWebSocket: WebSocketIntegration

  beforeEach(() => {
    vi.clearAllMocks()
    mockState = createMockState()
    mockWebSocket = createMockWebSocket()
  })

  describe('recallMessage', () => {
    it('should mark the message recalled optimistically and return success', async () => {
      const undo = vi.fn()
      mockState = createMockState({ markMessageRecalled: vi.fn(() => undo) })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      const result = await actions.recallMessage('msg-1')

      expect(mockState.markMessageRecalled).toHaveBeenCalledWith('msg-1')
      expect(undo).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('should roll back the optimistic mark and return the error when the API rejects the recall', async () => {
      const undo = vi.fn()
      mockState = createMockState({ markMessageRecalled: vi.fn(() => undo) })
      vi.mocked(messageApi.recallMessage).mockResolvedValueOnce({
        success: false,
        error: '已超過可撤回時間'
      })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      const result = await actions.recallMessage('msg-1')

      expect(undo).toHaveBeenCalled()
      expect(result).toEqual({ success: false, error: '已超過可撤回時間' })
    })
  })

  describe('scrollToBottom', () => {
    it('should call scrollTarget.scrollToBottom when target is set', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)
      const mockScrollTarget = { scrollToBottom: vi.fn() }

      actions.setScrollTarget(mockScrollTarget)
      actions.scrollToBottom()

      expect(mockScrollTarget.scrollToBottom).toHaveBeenCalled()
    })

    it('should not throw when scroll target is not set', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      expect(() => actions.scrollToBottom()).not.toThrow()
    })
  })

  describe('setScrollTarget', () => {
    it('should set the scroll target', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)
      const mockScrollTarget = { scrollToBottom: vi.fn() }

      actions.setScrollTarget(mockScrollTarget)
      actions.scrollToBottom()

      expect(mockScrollTarget.scrollToBottom).toHaveBeenCalled()
    })
  })

  describe('refreshMessages', () => {
    it('should reconnect WebSocket when connection state is error', async () => {
      mockWebSocket = createMockWebSocket({
        unifiedConnectionState: ref('error'),
        unifiedIsConnected: ref(false)
      })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      await actions.refreshMessages()

      expect(mockWebSocket.reconnect).toHaveBeenCalled()
    })

    it('should reconnect WebSocket when connection state is disconnected', async () => {
      mockWebSocket = createMockWebSocket({
        unifiedConnectionState: ref('disconnected'),
        unifiedIsConnected: ref(false)
      })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      await actions.refreshMessages()

      expect(mockWebSocket.reconnect).toHaveBeenCalled()
    })

    it('should use HTTP refresh when not connected', async () => {
      mockWebSocket = createMockWebSocket({
        unifiedConnectionState: ref('connecting'),
        unifiedIsConnected: ref(false)
      })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      await actions.refreshMessages()

      expect(mockState.refreshMessages).toHaveBeenCalled()
    })

    it('should not use HTTP refresh when WebSocket is connected', async () => {
      mockWebSocket = createMockWebSocket({
        unifiedConnectionState: ref('connected'),
        unifiedIsConnected: ref(true)
      })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      await actions.refreshMessages()

      expect(mockState.refreshMessages).not.toHaveBeenCalled()
    })

    it('should throw when reconnect fails', async () => {
      mockWebSocket = createMockWebSocket({
        unifiedConnectionState: ref('error'),
        unifiedIsConnected: ref(false),
        reconnect: vi.fn().mockRejectedValue(new Error('reconnect failed'))
      })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      await expect(actions.refreshMessages()).rejects.toThrow('reconnect failed')
    })
  })

  describe('loadMoreMessages', () => {
    it('should call state.loadMoreMessages', async () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      await actions.loadMoreMessages()

      expect(mockState.loadMoreMessages).toHaveBeenCalled()
    })

    it('should throw when loadMoreMessages fails', async () => {
      mockState = createMockState({
        loadMoreMessages: vi.fn().mockRejectedValue(new Error('load more failed'))
      })
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      await expect(actions.loadMoreMessages()).rejects.toThrow('load more failed')
    })
  })

  describe('handleScroll', () => {
    it('should return isAtBottom true when near bottom', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      const result = actions.handleScroll({
        scrollTop: 900,
        scrollHeight: 1000,
        clientHeight: 50
      })

      // scrollHeight - scrollTop - clientHeight = 1000 - 900 - 50 = 50 < 100
      expect(result.isAtBottom).toBe(true)
    })

    it('should return isAtBottom false when far from bottom', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      const result = actions.handleScroll({
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 50
      })

      // scrollHeight - scrollTop - clientHeight = 1000 - 100 - 50 = 850 >= 100
      expect(result.isAtBottom).toBe(false)
    })

    it('should return isAtBottom true at exact threshold', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      // 1000 - 850 - 50 = 100, which is NOT < 100
      const result = actions.handleScroll({
        scrollTop: 850,
        scrollHeight: 1000,
        clientHeight: 50
      })

      expect(result.isAtBottom).toBe(false)
    })

    it('should return isAtBottom true when exactly at bottom', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      const result = actions.handleScroll({
        scrollTop: 500,
        scrollHeight: 500,
        clientHeight: 0
      })

      // 500 - 500 - 0 = 0 < 100
      expect(result.isAtBottom).toBe(true)
    })
  })

  describe('return interface', () => {
    it('should return all expected methods', () => {
      const actions = useConversationActions('conv-1', mockState, mockWebSocket)

      expect(actions).toHaveProperty('recallMessage')
      expect(actions).toHaveProperty('scrollToBottom')
      expect(actions).toHaveProperty('setScrollTarget')
      expect(actions).toHaveProperty('refreshMessages')
      expect(actions).toHaveProperty('loadMoreMessages')
      expect(actions).toHaveProperty('handleScroll')
    })
  })
})
