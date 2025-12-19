/**
 * useConversationState - 對話狀態管理 Composable
 *
 * 職責：
 * - 管理對話基本信息 (conversation metadata)
 * - 管理消息列表狀態 (messages, displayedMessages)
 * - 管理加載狀態 (loading, hasLoadedInitially)
 * - 管理搜索狀態 (searchResults, isSearchActive)
 * - 管理新消息計數
 *
 * 不負責：
 * - 消息發送/接收邏輯 (由 useMessageHandlers 處理)
 * - WebSocket 連接管理 (由 useWebSocketIntegration 處理)
 * - 對話操作 (由 useConversationActions 處理)
 */

import { ref, computed, type Ref } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { useCustomerMessages } from '@/composables/useCustomerMessages'
import { useSmoothLoading } from '@/composables/useSmoothLoading'
import { useLoadingState } from '@/composables/useLoadingState'
import { conversationCache } from '@/utils/conversationCache'
import type { Message } from '@/types'

export interface ConversationStateOptions {
  enablePagination?: boolean
  pageSize?: number
  enableProgressiveLoading?: boolean
}

export function useConversationState(
  conversationId: string,
  options: ConversationStateOptions = {}
) {
  const {
    enablePagination = true,
    pageSize = 30,
    enableProgressiveLoading = false
  } = options

  // ===== Stores =====
  const conversationsStore = useConversationsStore()

  // ===== HTTP Messages API =====
  const httpMessages = useCustomerMessages(conversationId, {
    enablePagination,
    pageSize,
    enableProgressiveLoading
  })

  // ===== Unified Connection State =====
  // 這些引用將由 useWebSocketIntegration 設置
  const unifiedMessages = ref<Message[]>([])
  const unifiedIsConnected = ref(false)

  // ===== Search State =====
  const searchResults = ref<Message[]>([])
  const isSearchActive = ref(false)

  // ===== Smooth Loading =====
  const {
    messages: smoothMessages,
    isUpdating,
    updateMessages
  } = useSmoothLoading({
    animationDuration: 400,
    enableAnimations: false, // 禁用動畫避免遞歸問題
    debounceDelay: 50
  })

  // Recursion guard
  let isUpdatingMessages = false
  let lastMessagesLength = 0

  // ===== Loading State Management =====
  const loadingState = useLoadingState({
    sseIsConnected: unifiedIsConnected,
    wsIsJoined: computed(() => false),
    httpMessagesCount: computed(() => httpMessages.messages.value.length),
    shouldUseWebSocket: computed(() => unifiedIsConnected.value),
    isLoading: computed(() => httpMessages.loading.value)
  })

  const {
    hasLoadedInitially,
    isInitialLoading,
    loadingHistory,
    setHistoryLoading
  } = loadingState

  // ===== Computed Properties =====

  /**
   * 當前對話信息
   */
  const conversation = computed(() => conversationsStore.currentConversation || undefined)

  /**
   * 混合消息源：Unified Connection (WebSocket/SSE) + HTTP History
   */
  const messages = computed((): Message[] => {
    // Priority 1: Unified Connection (WebSocket or SSE)
    if (unifiedIsConnected.value && unifiedMessages.value.length > 0) {
      const unifiedMessageIds = new Set(unifiedMessages.value.map(m => m.id))

      // 過濾 HTTP 歷史消息（避免重複）
      const httpHistoryMessages = httpMessages.messages.value.filter(
        m => !unifiedMessageIds.has(m.id)
      )

      // 合併並排序
      const merged = [...httpHistoryMessages, ...unifiedMessages.value].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      return merged
    }

    // Priority 2: HTTP API Messages (fallback)
    return httpMessages.messages.value
  })

  /**
   * 顯示的消息列表（搜索過濾 or 平滑加載）
   */
  const displayedMessages = computed(() => {
    return isSearchActive.value ? searchResults.value : smoothMessages.value
  })

  /**
   * 消息總數
   */
  const messageCount = computed(() => messages.value.length)

  /**
   * 是否正在加載
   */
  const loading = computed(() => {
    if (unifiedIsConnected.value) {return false}
    return httpMessages.loading.value
  })

  /**
   * 是否有更多歷史消息
   */
  const hasMore = computed(() => httpMessages.hasMore.value)

  /**
   * 骨架屏數量（基於緩存估算）
   */
  const skeletonCount = computed(() =>
    conversationCache.getEstimatedMessageCount(conversationId)
  )

  /**
   * 動態加載文本
   */
  const loadingText = computed(() => {
    if (httpMessages.isLoadingInitial?.value) {
      return '正在載入最近消息...'
    }
    if (loadingHistory.value) {
      return '載入對話歷史...'
    }
    return '載入對話歷史...'
  })

  /**
   * 是否正在進行初始載入
   */
  const isLoadingInitial = computed(() => httpMessages.isLoadingInitial?.value || false)

  // ===== Methods =====

  /**
   * 設置統一連接的消息引用（由 useWebSocketIntegration 調用）
   */
  function setUnifiedMessages(messagesRef: Ref<Message[]>) {
    unifiedMessages.value = messagesRef.value
  }

  /**
   * 設置統一連接狀態（由 useWebSocketIntegration 調用）
   */
  function setUnifiedConnected(isConnected: boolean) {
    unifiedIsConnected.value = isConnected
  }

  /**
   * 更新平滑加載消息（debounced）
   */
  function debouncedUpdateMessages(newMessages: Message[]) {
    // Prevent recursive calls
    if (isUpdatingMessages) {return}

    // Skip if messages array hasn't actually changed
    if (newMessages.length === lastMessagesLength && lastMessagesLength > 0) {
      return
    }

    isUpdatingMessages = true
    lastMessagesLength = newMessages.length

    try {
      updateMessages(newMessages, true)
    } finally {
      setTimeout(() => {
        isUpdatingMessages = false
      }, 300)
    }
  }

  /**
   * 設置搜索結果
   */
  function setSearchResults(results: Message[]) {
    searchResults.value = results
    isSearchActive.value = results.length > 0
  }

  /**
   * 清除搜索
   */
  function clearSearch() {
    searchResults.value = []
    isSearchActive.value = false
  }

  /**
   * 加載對話
   */
  async function loadConversation() {
    try {
      await conversationsStore.fetchConversation(conversationId)
      const currentConversation = conversation.value
      if (currentConversation?.unreadCount) {
        await conversationsStore.markAsRead(conversationId)
      }

      // Load HTTP messages
      console.log('📥 [useConversationState] Loading HTTP messages...')
      await httpMessages.fetchMessages()
      console.log(
        `✅ [useConversationState] HTTP messages loaded: ${httpMessages.messages.value.length} messages`
      )
    } catch (error) {
      console.error('❌ [useConversationState] Failed to load conversation:', error)
      throw error
    }
  }

  /**
   * 刷新消息
   */
  async function refreshMessages() {
    try {
      await httpMessages.refreshMessages()
      console.log('✅ [useConversationState] Messages refreshed')
    } catch (error) {
      console.error('❌ [useConversationState] Failed to refresh messages:', error)
      throw error
    }
  }

  /**
   * 加載更多消息
   */
  async function loadMoreMessages() {
    try {
      setHistoryLoading(true)
      await httpMessages.loadMoreMessages()
    } finally {
      setHistoryLoading(false)
    }
  }

  /**
   * 添加消息到列表（由 useMessageHandlers 調用）
   */
  function addMessage(message: Message) {
    httpMessages.addMessage(message)
  }

  /**
   * 重置加載狀態
   */
  function resetLoadingState() {
    loadingState.resetLoadingState()
  }

  // ===== 返回接口 =====

  return {
    // Stores
    conversationsStore,

    // HTTP Messages API
    httpMessages,

    // Computed State
    conversation,
    messages,
    displayedMessages,
    messageCount,
    loading,
    hasMore,
    skeletonCount,
    loadingText,
    isLoadingInitial,

    // Loading State
    hasLoadedInitially,
    isInitialLoading,
    loadingHistory,
    isUpdating,

    // Search State
    searchResults,
    isSearchActive,
    setSearchResults,
    clearSearch,

    // Unified Connection State (managed by useWebSocketIntegration)
    unifiedMessages,
    unifiedIsConnected,
    setUnifiedMessages,
    setUnifiedConnected,

    // Methods
    loadConversation,
    refreshMessages,
    loadMoreMessages,
    addMessage,
    resetLoadingState,
    debouncedUpdateMessages,
    setHistoryLoading
  }
}

export type ConversationState = ReturnType<typeof useConversationState>
