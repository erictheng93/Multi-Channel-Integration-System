/**
 * useConversationController - 對話主控制器 Composable
 *
 * 這是對話業務邏輯的核心協調器，整合以下子模塊：
 * - useConversationState: 狀態管理
 * - useMessageHandlers: 消息處理
 * - useWebSocketIntegration: 實時通信
 * - useConversationActions: 對話操作
 *
 * 職責：
 * - 初始化和清理所有子模塊
 * - 協調子模塊之間的事件流
 * - 提供統一的對外接口
 * - 管理組件生命週期
 *
 * 使用示例：
 * ```typescript
 * const controller = useConversationController(conversationId.value)
 *
 * // 初始化
 * onMounted(async () => {
 *   await controller.initialize()
 * })
 *
 * // 清理
 * onUnmounted(() => {
 *   controller.cleanup()
 * })
 *
 * // 使用
 * <template>
 *   <MessageInput @message-pending="controller.onMessagePending" />
 * </template>
 * ```
 */

import { watch } from 'vue'
import { useConversationState } from './useConversationState'
import { useMessageHandlers } from './useMessageHandlers'
import { useWebSocketIntegration } from './useWebSocketIntegration'
import { useConversationActions } from './useConversationActions'

export interface ConversationControllerOptions {
  enablePagination?: boolean
  pageSize?: number
  enableProgressiveLoading?: boolean
}

/**
 * 對話主控制器
 */
export function useConversationController(
  conversationId: string,
  options: ConversationControllerOptions = {}
) {
  // ===== 1️⃣ 初始化子模塊（按依賴順序） =====

  // 狀態管理（最底層，無依賴）
  const state = useConversationState(conversationId, options)

  // 消息處理（依賴 state）
  const handlers = useMessageHandlers(conversationId, state)

  // WebSocket 整合（依賴 state 和 handlers）
  const websocket = useWebSocketIntegration(conversationId, state, handlers)

  // 對話操作（依賴 state 和 websocket）
  const actions = useConversationActions(conversationId, state, websocket)

  // ===== 2️⃣ 設置響應式監聽（協調事件流） =====

  /**
   * 監聽 messages 變化，自動更新平滑加載
   */
  watch(
    () => state.messages.value,
    newMessages => {
      if (newMessages && newMessages.length >= 0) {
        state.debouncedUpdateMessages(newMessages)
      }
    },
    { flush: 'post' }
  )

  /**
   * 監聽 unified connection messages 變化，確保響應式更新
   */
  watch(
    () => {
      const conn = websocket.unifiedConnection.value
      if (!conn || !conn.messages) {return 0}
      return ((conn.messages as any).value?.length ?? 0)
    },
    (newCount, oldCount) => {
      if (newCount !== undefined && newCount !== oldCount) {
        console.log(
          `📊 [ConversationController] Unified messages count changed: ${oldCount} → ${newCount}`
        )
      }
    }
  )

  // ===== 3️⃣ 生命週期管理 =====

  /**
   * 初始化對話（在 onMounted 中調用）
   */
  async function initialize() {
    try {
      console.log('🚀 [ConversationController] Initializing conversation:', conversationId)

      // 1. 初始化 WebSocket 連接
      await websocket.initialize()

      // 2. 加載對話和消息
      await state.loadConversation()

      console.log('✅ [ConversationController] Conversation initialized successfully')
    } catch (error) {
      console.error('❌ [ConversationController] Failed to initialize conversation:', error)
      throw error
    }
  }

  /**
   * 清理資源（在 onUnmounted 中調用）
   */
  function cleanup() {
    console.log('🧹 [ConversationController] Cleaning up conversation resources')

    // 1. 斷開 WebSocket 連接
    websocket.disconnect()

    // 2. 清理其他資源（如果需要）
    // state, handlers, actions 都是純函數，會自動被垃圾回收

    console.log('✅ [ConversationController] Cleanup completed')
  }

  // ===== 4️⃣ 對外暴露的統一接口 =====

  return {
    // ===== 生命週期 =====
    initialize,
    cleanup,

    // ===== 狀態（Computed - 只讀） =====
    conversation: state.conversation,
    messages: state.messages,
    displayedMessages: state.displayedMessages,
    messageCount: state.messageCount,
    loading: state.loading,
    hasMore: state.hasMore,
    skeletonCount: state.skeletonCount,
    loadingText: state.loadingText,
    isLoadingInitial: state.isLoadingInitial,
    hasLoadedInitially: state.hasLoadedInitially,
    isInitialLoading: state.isInitialLoading,
    loadingHistory: state.loadingHistory,
    isUpdating: state.isUpdating,

    // ===== 搜索狀態 =====
    searchResults: state.searchResults,
    isSearchActive: state.isSearchActive,
    setSearchResults: state.setSearchResults,
    clearSearch: state.clearSearch,

    // ===== WebSocket 狀態 =====
    isWebSocketEnabled: websocket.isWebSocketEnabled,
    isConnected: websocket.unifiedIsConnected,
    connectionState: websocket.unifiedConnectionState,
    connectionProtocol: websocket.currentProtocol,
    connectionQuality: websocket.connectionQuality,
    connectionText: websocket.connectionText,
    connectionStatusClass: websocket.connectionStatusClass,
    newMessageCount: websocket.newMessageCount,

    // ===== 輸入指示器 =====
    isTyping: websocket.isTyping,
    typingUsers: websocket.typingUsers,

    // ===== 消息處理器（事件處理） =====
    onMessageSent: handlers.handleMessageSent,
    onMessagePending: handlers.handleMessagePending,
    onUploadProgress: handlers.handleUploadProgress,
    onMessageConfirmed: handlers.handleMessageConfirmed,
    onMessageFailed: handlers.handleMessageFailed,

    // ===== 消息操作 =====
    retryMessage: handlers.retryFailedMessage,
    recallMessage: actions.recallMessage,

    // ===== 對話操作 =====
    refreshMessages: actions.refreshMessages,
    loadMoreMessages: actions.loadMoreMessages,

    // ===== UI 操作 =====
    scrollToBottom: actions.scrollToBottom,
    setScrollTarget: actions.setScrollTarget,

    // ===== Typing 操作 =====
    onTypingStart: websocket.startTyping,
    onTypingStop: websocket.stopTyping,

    // ===== Scroll 處理 =====
    onScroll: actions.handleScroll,

    // ===== 用戶活動追蹤 =====
    trackUserActivity: handlers.trackUserActivity,

    // ===== 內部子模塊（用於測試或高級用例） =====
    _internals: {
      state,
      handlers,
      websocket,
      actions
    }
  }
}

/**
 * Controller 返回類型（用於 TypeScript 類型推斷）
 */
export type ConversationController = ReturnType<typeof useConversationController>

/**
 * 導出子模塊類型（方便單獨測試）
 */
export type { ConversationState } from './useConversationState'
export type { MessageHandlers } from './useMessageHandlers'
export type { WebSocketIntegration } from './useWebSocketIntegration'
export type { ConversationActions } from './useConversationActions'

/**
 * 導出消息處理相關類型
 */
export type {
  MessagePendingData,
  UploadProgressData,
  MessageConfirmedData,
  MessageFailedData,
  MessageSentData,
  RetryAttachment
} from './useMessageHandlers'
