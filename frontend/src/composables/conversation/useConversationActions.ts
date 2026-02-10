/**
 * useConversationActions - 對話操作 Composable
 *
 * 職責：
 * - 對話狀態操作 (關閉/重新打開)
 * - UI 操作 (滾動/導航)
 * - 消息刷新/加載
 * - 消息撤回
 *
 * 不負責：
 * - 消息狀態管理 (由 useConversationState 處理)
 * - 消息發送邏輯 (由 useMessageHandlers 處理)
 * - WebSocket 連接 (由 useWebSocketIntegration 處理)
 */

import { ref } from 'vue'
import type { ConversationState } from './useConversationState'
import type { WebSocketIntegration } from './useWebSocketIntegration'

export interface ScrollTarget {
  scrollToBottom: () => void
}

// ===== Composable =====

export function useConversationActions(
  _conversationId: string,
  state: ConversationState,
  websocket: WebSocketIntegration
) {
  // ===== Scroll Target Reference =====
  const scrollTarget = ref<ScrollTarget | null>(null)

  // ===== Conversation Operations =====

  /**
   * 撤回消息
   */
  async function recallMessage(messageId: string): Promise<boolean> {
    try {
      console.log('🔄 [ConversationActions] Recalling message:', messageId)
      // TODO: Implement message recall API call
      // const success = await messageApi.recall(conversationId, messageId)

      // For now, just refresh messages to reflect server state
      await state.refreshMessages()

      console.log('✅ [ConversationActions] Message recalled (placeholder)')
      return true
    } catch (error) {
      console.error('❌ [ConversationActions] Failed to recall message:', error)
      return false
    }
  }

  // ===== UI Operations =====

  /**
   * 滾動到底部（最新消息）
   */
  function scrollToBottom() {
    if (scrollTarget.value?.scrollToBottom) {
      scrollTarget.value.scrollToBottom()
      console.log('📜 [ConversationActions] Scrolled to bottom')
    } else {
      console.warn('⚠️ [ConversationActions] Scroll target not available')
    }
  }

  /**
   * 設置滾動目標引用（由容器組件調用）
   */
  function setScrollTarget(target: ScrollTarget) {
    scrollTarget.value = target
  }

  // ===== Message Loading =====

  /**
   * 刷新消息
   */
  async function refreshMessages() {
    try {
      console.log('🔄 [ConversationActions] Refreshing messages...')

      // Priority 1: 如果 WebSocket 斷開，嘗試重連
      if (websocket.unifiedConnectionState.value === 'error' ||
          websocket.unifiedConnectionState.value === 'disconnected') {
        console.log('🔄 [ConversationActions] Reconnecting WebSocket...')
        await websocket.reconnect()
      }

      // Priority 2: 如果未連接，使用 HTTP 刷新
      if (!websocket.unifiedIsConnected.value) {
        console.log('🔄 [ConversationActions] Using HTTP API refresh...')
        await state.refreshMessages()
      }

      console.log('✅ [ConversationActions] Messages refreshed')
    } catch (error) {
      console.error('❌ [ConversationActions] Failed to refresh messages:', error)
      throw error
    }
  }

  /**
   * 加載更多歷史消息
   */
  async function loadMoreMessages() {
    try {
      console.log('🔄 [ConversationActions] Loading more messages...')
      await state.loadMoreMessages()
      console.log('✅ [ConversationActions] More messages loaded')
    } catch (error) {
      console.error('❌ [ConversationActions] Failed to load more messages:', error)
      throw error
    }
  }

  // ===== Scroll Event Handling =====

  /**
   * 處理虛擬滾動事件
   */
  function handleScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
    const threshold = 100
    const isAtBottom = scrollInfo.scrollHeight - scrollInfo.scrollTop - scrollInfo.clientHeight < threshold

    // 可以基於滾動位置做其他邏輯
    // 例如：標記為已讀、更新 UI 狀態等

    return { isAtBottom }
  }

  // ===== 返回接口 =====

  return {
    // Conversation Operations
    recallMessage,

    // UI Operations
    scrollToBottom,
    setScrollTarget,

    // Message Loading
    refreshMessages,
    loadMoreMessages,

    // Scroll Handling
    handleScroll
  }
}

export type ConversationActions = ReturnType<typeof useConversationActions>
