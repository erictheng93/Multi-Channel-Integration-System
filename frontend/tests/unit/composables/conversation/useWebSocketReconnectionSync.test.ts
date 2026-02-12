/**
 * Unit Tests for WebSocket Reconnection Sync Mechanism
 *
 * 測試範圍：
 * 1. handleUnifiedStateChange 重連檢測
 * 2. triggerMessageSyncAfterReconnection 訊息同步邏輯
 * 3. messages computed 的 HTTP fallback 邏輯
 *
 * 這些測試驗證 2025-01-19 修復的「暫無訊息」競態條件
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref, nextTick, computed } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// ===== Mock Setup =====

// Mock useCustomerMessages
const mockHttpMessages = ref<Array<{ id: string; content: string }>>([])
const mockFetchMessages = vi.fn()

vi.mock('@/composables/useCustomerMessages', () => ({
  useCustomerMessages: vi.fn(() => ({
    messages: mockHttpMessages,
    hasMore: ref(false),
    loading: ref(false),
    error: ref(null),
    fetchMessages: mockFetchMessages,
    refreshMessages: vi.fn(),
    addMessage: vi.fn()
  }))
}))

// Mock conversations store
vi.mock('@/stores/conversations', () => ({
  useConversationsStore: vi.fn(() => ({
    currentConversation: ref({ id: 'conv-1', status: 'open' }),
    conversations: ref([]),
    loading: ref(false),
    fetchConversation: vi.fn(),
    markAsRead: vi.fn()
  }))
}))

// Mock customerWebSocketManager
const mockUnifiedMessages = ref<Array<{ id: string; content: string }>>([])
const mockConnectionState = ref<'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('disconnected')
const mockIsConnected = ref(false)
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockReconnect = vi.fn()

vi.mock('@/services/customerWebSocketManager', () => ({
  createCustomerRealtimeConnection: vi.fn(() => ({
    messages: mockUnifiedMessages,
    messageCount: ref(mockUnifiedMessages.value.length),
    type: 'websocket',
    connect: mockConnect,
    disconnect: mockDisconnect,
    reconnect: mockReconnect,
    onMessage: vi.fn(),
    onStateChange: vi.fn((callback: (_state: string) => void) => {
      // Store callback for testing state changes
      (global as unknown as { wsStateChangeCallback: (_state: string) => void }).wsStateChangeCallback = callback
    }),
    onError: vi.fn()
  }))
}))

// Mock useSmoothLoading
const mockSmoothMessages = ref<Array<{ id: string; content: string }>>([])
const mockSetMessagesImmediate = vi.fn((messages) => {
  mockSmoothMessages.value = [...messages]
})

vi.mock('@/composables/useSmoothLoading', () => ({
  useSmoothLoading: vi.fn(() => ({
    messages: computed(() => mockSmoothMessages.value),
    isUpdating: ref(false),
    updateMessages: vi.fn(),
    setMessagesImmediate: mockSetMessagesImmediate,
    clearMessages: vi.fn()
  }))
}))

// Mock useLoadingState
const mockHasLoadedInitially = ref(false)
const mockIsInitialLoading = ref(true)
const mockConfirmNoMessages = vi.fn()

vi.mock('@/composables/useLoadingState', () => ({
  useLoadingState: vi.fn(() => ({
    hasLoadedInitially: mockHasLoadedInitially,
    isInitialLoading: mockIsInitialLoading,
    loadingHistory: ref(false),
    setHistoryLoading: vi.fn(),
    confirmNoMessages: mockConfirmNoMessages,
    markAsLoaded: vi.fn(),
    resetLoadingState: vi.fn(),
    isFullyLoaded: computed(() => true),
    loadingProgress: computed(() => 100)
  }))
}))

// ===== Tests =====

describe('WebSocket Reconnection Sync Mechanism', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Reset all mock states
    mockHttpMessages.value = []
    mockUnifiedMessages.value = []
    mockSmoothMessages.value = []
    mockConnectionState.value = 'disconnected'
    mockIsConnected.value = false
    mockHasLoadedInitially.value = false
    mockIsInitialLoading.value = true
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useConversationState - messages computed fallback', () => {
    it('should use HTTP messages as fallback when WebSocket connected but unifiedMessages is empty', async () => {
      // Dynamically import to apply mocks
      const { useConversationState } = await import('@/composables/conversation/useConversationState')

      // Setup: HTTP has messages, unified is empty but connected
      mockHttpMessages.value = [
        { id: 'http-1', content: 'HTTP Message 1' },
        { id: 'http-2', content: 'HTTP Message 2' }
      ]
      mockUnifiedMessages.value = []

      const state = useConversationState('conv-test-001')

      // Simulate WebSocket connected
      state.setUnifiedConnected(true)
      state.setUnifiedMessages(ref([]))

      await nextTick()

      // Verify: messages should use HTTP fallback
      expect(state.messages.value.length).toBe(2)
      expect(state.messages.value[0].id).toBe('http-1')
    })

    it('should merge unified and HTTP messages when both have data', async () => {
      const { useConversationState } = await import('@/composables/conversation/useConversationState')

      // Setup: Both have messages
      mockHttpMessages.value = [
        { id: 'http-1', content: 'HTTP Message', createdAt: new Date('2025-01-01').toISOString() }
      ]

      const state = useConversationState('conv-test-001')

      // Simulate WebSocket connected with messages
      state.setUnifiedConnected(true)
      state.setUnifiedMessages(ref([
        { id: 'ws-1', content: 'WebSocket Message', createdAt: new Date('2025-01-02').toISOString() }
      ]))

      await nextTick()

      // Verify: messages should be merged
      expect(state.messages.value.length).toBe(2)
    })
  })

  describe('useConversationState - refreshMessagesAfterReconnection', () => {
    it('should fetch messages and use setMessagesImmediate on reconnection', async () => {
      const { useConversationState } = await import('@/composables/conversation/useConversationState')

      // Setup: HTTP will return messages after fetch
      mockFetchMessages.mockImplementation(() => {
        mockHttpMessages.value = [
          { id: 'new-1', content: 'Refreshed Message 1' },
          { id: 'new-2', content: 'Refreshed Message 2' }
        ]
        return Promise.resolve()
      })

      const state = useConversationState('conv-test-001')

      // Execute reconnection refresh
      await state.refreshMessagesAfterReconnection()

      // Verify: fetchMessages was called
      expect(mockFetchMessages).toHaveBeenCalled()

      // Verify: setMessagesImmediate was called with new messages
      expect(mockSetMessagesImmediate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'new-1' }),
          expect.objectContaining({ id: 'new-2' })
        ])
      )
    })

    it('should not call setMessagesImmediate when no messages returned', async () => {
      const { useConversationState } = await import('@/composables/conversation/useConversationState')

      // Setup: HTTP returns empty
      mockFetchMessages.mockImplementation(() => {
        mockHttpMessages.value = []
        return Promise.resolve()
      })

      const state = useConversationState('conv-test-001')

      // Execute reconnection refresh
      await state.refreshMessagesAfterReconnection()

      // Verify: setMessagesImmediate was NOT called (no messages to set)
      expect(mockSetMessagesImmediate).not.toHaveBeenCalled()
    })
  })

  describe('useConversationState - loadConversation with confirmNoMessages', () => {
    it('should call confirmNoMessages when HTTP returns empty', async () => {
      const { useConversationState } = await import('@/composables/conversation/useConversationState')

      // Setup: HTTP returns empty
      mockFetchMessages.mockImplementation(() => {
        mockHttpMessages.value = []
        return Promise.resolve()
      })

      const state = useConversationState('conv-test-001')

      // Execute load
      await state.loadConversation()

      // Verify: confirmNoMessages was called
      expect(mockConfirmNoMessages).toHaveBeenCalled()
    })

    it('should call setMessagesImmediate when HTTP returns messages', async () => {
      const { useConversationState } = await import('@/composables/conversation/useConversationState')

      // Setup: HTTP returns messages
      mockFetchMessages.mockImplementation(() => {
        mockHttpMessages.value = [{ id: 'msg-1', content: 'Test' }]
        return Promise.resolve()
      })

      const state = useConversationState('conv-test-001')

      // Execute load
      await state.loadConversation()

      // Verify: setMessagesImmediate was called
      expect(mockSetMessagesImmediate).toHaveBeenCalled()

      // Verify: confirmNoMessages was NOT called
      expect(mockConfirmNoMessages).not.toHaveBeenCalled()
    })
  })
})

describe('useLoadingState - confirmNoMessages mechanism', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should have confirmNoMessages function exported', async () => {
    // Reset mock to use real implementation for this test
    vi.doUnmock('@/composables/useLoadingState')

    const { useLoadingState } = await import('@/composables/useLoadingState')

    const loadingState = useLoadingState({
      sseIsConnected: ref(false),
      wsIsJoined: ref(false),
      httpMessagesCount: ref(0),
      shouldUseWebSocket: ref(false),
      isLoading: ref(false)
    })

    // Verify: confirmNoMessages exists
    expect(loadingState.confirmNoMessages).toBeDefined()
    expect(typeof loadingState.confirmNoMessages).toBe('function')
  })

  it('should allow marking loaded when confirmNoMessages is called with no messages', async () => {
    vi.doUnmock('@/composables/useLoadingState')

    const { useLoadingState } = await import('@/composables/useLoadingState')

    const isLoadingRef = ref(true)

    const loadingState = useLoadingState({
      sseIsConnected: ref(false),
      wsIsJoined: ref(false),
      httpMessagesCount: ref(0), // No messages
      shouldUseWebSocket: ref(false),
      isLoading: isLoadingRef
    })

    // Initially not loaded
    expect(loadingState.hasLoadedInitially.value).toBe(false)

    // Confirm no messages FIRST (before loading completes)
    loadingState.confirmNoMessages()
    await nextTick()

    // Now simulate loading complete
    isLoadingRef.value = false
    await nextTick()

    // Wait for watch to settle
    await nextTick()
    await nextTick()

    // Should now be marked as loaded
    // Note: The watch depends on hasEverLoaded being true first (set when loading=true)
    // Since we started with loading=true, hasEverLoaded should be true
    // Then when loading=false + messagesConfirmed=true, it should mark as loaded
    expect(loadingState.hasLoadedInitially.value).toBe(true)
  })

  it('should reset messagesConfirmed on resetLoadingState', async () => {
    vi.doUnmock('@/composables/useLoadingState')

    const { useLoadingState } = await import('@/composables/useLoadingState')

    const isLoadingRef = ref(true)

    const loadingState = useLoadingState({
      sseIsConnected: ref(false),
      wsIsJoined: ref(false),
      httpMessagesCount: ref(0),
      shouldUseWebSocket: ref(false),
      isLoading: isLoadingRef
    })

    // Confirm no messages
    loadingState.confirmNoMessages()
    isLoadingRef.value = false
    await nextTick()

    expect(loadingState.hasLoadedInitially.value).toBe(true)

    // Reset
    loadingState.resetLoadingState()
    await nextTick()

    // Should be reset
    expect(loadingState.hasLoadedInitially.value).toBe(false)
    expect(loadingState.isInitialLoading.value).toBe(true)
  })
})

/**
 * 測試總結：
 *
 * ✅ 已測試：
 * - messages computed 的 HTTP fallback 邏輯
 * - refreshMessagesAfterReconnection 訊息同步
 * - loadConversation 的 confirmNoMessages 調用
 * - useLoadingState 的 confirmNoMessages 機制
 *
 * 🎯 覆蓋的修復場景：
 * - 長時間閒置後 WebSocket 重連
 * - 重連時 unifiedMessages 為空的 fallback
 * - 載入完成但無訊息時的正確空狀態顯示
 *
 * 📝 注意事項：
 * - useWebSocketIntegration 的 handleUnifiedStateChange 需要集成測試
 * - ConversationDetail.vue 的 isEmptyStateConfirmed 需要組件測試
 */
