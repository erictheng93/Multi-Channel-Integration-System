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

import { ref, computed, nextTick, type Ref } from 'vue'
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

  // ===== 🔧 重連同步: 追蹤最後訊息時間戳 =====
  const lastMessageTimestamp = ref<string | null>(null)

  // ===== Smooth Loading =====
  const {
    messages: smoothMessages,
    isUpdating,
    updateMessages,
    setMessagesImmediate // 🔧 FIX: 用於初始載入的即時更新，避免防抖延遲導致的競態條件
  } = useSmoothLoading({
    animationDuration: 400,
    enableAnimations: false, // 禁用動畫避免遞歸問題
    debounceDelay: 50
  })

  // 🔧 FIX: 使用消息更新隊列替代固定窗口遞歸保護
  const updateQueue = ref<Message[][]>([])
  const isProcessingQueue = ref(false)
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
    setHistoryLoading,
    confirmNoMessages  // 🔧 FIX: 確認訊息狀態
  } = loadingState

  // ===== Computed Properties =====

  /**
   * 當前對話信息
   */
  const conversation = computed(() => conversationsStore.currentConversation || undefined)

  /**
   * 混合消息源：Unified Connection (WebSocket/SSE) + HTTP History
   *
   * 🔧 FIX: 優化優先級邏輯，處理 WebSocket 重連後訊息為空的情況
   */
  const messages = computed((): Message[] => {
    // Priority 1: Unified Connection (WebSocket or SSE) with messages
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

    // 🔧 FIX: Priority 1.5 - WebSocket 連接但訊息為空時，使用 HTTP 訊息作為 fallback
    // 這處理了重連後 unifiedMessages 尚未同步的情況，避免短暫顯示「暫無訊息」
    if (unifiedIsConnected.value && unifiedMessages.value.length === 0) {
      if (httpMessages.messages.value.length > 0) {
        console.log('⚠️ [useConversationState] WebSocket connected but no messages, using HTTP fallback')
      }
      return httpMessages.messages.value
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
   * 🔧 FIX Phase 1: 批量消息更新機制 - 使用 Vue nextTick 優化
   */
  function queueMessageUpdate(newMessages: Message[]) {
    // 過濾：只有當消息真的變化時才入隊
    if (newMessages.length === lastMessagesLength && lastMessagesLength > 0) {
      console.log('📝 [useConversationState] Messages length unchanged, skipping queue')
      return
    }

    console.log(`📝 [useConversationState] Queuing message update: ${newMessages.length} messages`)
    updateQueue.value.push(newMessages)
    lastMessagesLength = newMessages.length

    // 觸發隊列處理
    processUpdateQueue()
  }

  /**
   * 🔧 FIX Phase 1: 批量處理消息更新隊列 - 使用 nextTick 代替 setTimeout
   */
  async function processUpdateQueue() {
    // 如果已經在處理或隊列為空，直接返回
    if (isProcessingQueue.value || updateQueue.value.length === 0) {
      return
    }

    isProcessingQueue.value = true
    console.log(`📝 [useConversationState] Processing update queue: ${updateQueue.value.length} items`)

    try {
      // 🔧 FIX Phase 1: 批量處理所有待更新的消息
      // 取最新的消息數據（隊列中最後一個）
      const latestMessages = updateQueue.value[updateQueue.value.length - 1]

      // ✅ TypeScript safety check
      if (!latestMessages) {
        console.warn('⚠️ [useConversationState] No messages in queue, skipping update')
        return
      }

      // 清空隊列
      updateQueue.value = []

      // 使用 nextTick 確保在 Vue 的下一個更新週期統一應用
      await nextTick()

      try {
        updateMessages(latestMessages, true)
        console.log(`✅ [useConversationState] Batch update applied: ${latestMessages.length} messages`)
      } catch (error) {
        console.error('❌ [useConversationState] Error updating messages:', error)
      }
    } finally {
      isProcessingQueue.value = false
      console.log('✅ [useConversationState] Queue processing completed')
    }
  }

  /**
   * 🔧 DEPRECATED: 保留舊函數名以兼容，但內部使用新的隊列機制
   */
  function debouncedUpdateMessages(newMessages: Message[]) {
    queueMessageUpdate(newMessages)
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

      // 🔧 FIX: 初始載入時立即更新 smoothMessages，避免防抖延遲導致的競態條件
      // 問題：hasLoadedInitially 在 loading=false 時立即設為 true
      //       但 smoothMessages 因防抖延遲還是空的，導致顯示「暫無訊息」
      // 解決：使用 setMessagesImmediate 同步設置訊息，繞過防抖機制
      if (httpMessages.messages.value.length > 0) {
        console.log('🔧 [useConversationState] Applying immediate messages update to prevent race condition')
        setMessagesImmediate(httpMessages.messages.value)

        // 🔧 FIX Phase 2: 同步更新 lastMessagesLength，防止 queueMessageUpdate 重複觸發
        // 問題：setMessagesImmediate 後，flush:'post' watch 會調用 queueMessageUpdate
        //       因為 lastMessagesLength 仍為 0，檢查 30 === 0 失敗，導致重複更新
        // 解決：立即更新 lastMessagesLength，讓後續的 queueMessageUpdate 能正確跳過
        lastMessagesLength = httpMessages.messages.value.length
        console.log(`🔧 [useConversationState] Updated lastMessagesLength to ${lastMessagesLength} to prevent duplicate updates`)

        // 🔧 重連同步: 初始化 lastMessageTimestamp
        const lastMsg = httpMessages.messages.value[httpMessages.messages.value.length - 1]
        if (lastMsg?.createdAt) {
          lastMessageTimestamp.value = new Date(lastMsg.createdAt).toISOString()
          console.log('📝 [useConversationState] Initialized lastMessageTimestamp:', lastMessageTimestamp.value)
        }
      } else {
        // 🔧 FIX: 確認真的沒有訊息
        console.log('📭 [useConversationState] No messages found, confirming empty state')
        confirmNoMessages()
      }
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
   * 🔧 FIX: 重連後強制刷新訊息
   * 解決問題：WebSocket 重連後 unifiedMessages 為空，導致顯示「暫無訊息」
   *
   * 與普通 refreshMessages 的區別：
   * 1. 使用 setMessagesImmediate 立即更新（繞過防抖）
   * 2. 專門用於重連場景的訊息同步
   */
  async function refreshMessagesAfterReconnection() {
    console.log('🔄 [useConversationState] Refreshing messages after reconnection...')

    try {
      // 1. 重新載入 HTTP 訊息
      await httpMessages.fetchMessages()

      // 2. 立即更新 smoothMessages（繞過防抖）
      if (httpMessages.messages.value.length > 0) {
        setMessagesImmediate(httpMessages.messages.value)
        // 🔧 FIX: 同步更新 lastMessagesLength，防止 queueMessageUpdate 重複觸發
        lastMessagesLength = httpMessages.messages.value.length
        console.log(`✅ [useConversationState] Refreshed ${httpMessages.messages.value.length} messages after reconnection (lastMessagesLength updated)`)
      } else {
        console.log('📭 [useConversationState] No messages found after reconnection refresh')
      }
    } catch (error) {
      console.error('❌ [useConversationState] Failed to refresh messages after reconnection:', error)
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
   * 🔧 重連同步: 同時更新 lastMessageTimestamp
   */
  function addMessage(message: Message) {
    httpMessages.addMessage(message)

    // 🔧 重連同步: 更新最後訊息時間戳
    if (message.createdAt) {
      const newTimestamp = new Date(message.createdAt).toISOString()
      // 只有當新訊息比目前記錄的更新時才更新
      if (!lastMessageTimestamp.value || newTimestamp > lastMessageTimestamp.value) {
        lastMessageTimestamp.value = newTimestamp
        console.log('📝 [useConversationState] Updated lastMessageTimestamp:', newTimestamp)
      }
    }
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

    // 🔧 重連同步: 追蹤最後訊息時間戳
    lastMessageTimestamp,

    // Unified Connection State (managed by useWebSocketIntegration)
    unifiedMessages,
    unifiedIsConnected,
    setUnifiedMessages,
    setUnifiedConnected,

    // Methods
    loadConversation,
    refreshMessages,
    refreshMessagesAfterReconnection,  // 🔧 FIX: 重連後訊息同步
    loadMoreMessages,
    addMessage,
    resetLoadingState,
    debouncedUpdateMessages,  // 🔧 向後兼容（內部使用隊列）
    queueMessageUpdate,        // 🔧 新增：新的隊列 API
    setHistoryLoading,

    // 🔧 新增：供測試和調試
    updateQueue,
    isProcessingQueue
  }
}

export type ConversationState = ReturnType<typeof useConversationState>
