/**
 * useWebSocketIntegration - WebSocket/SSE 整合 Composable
 *
 * 職責：
 * - 管理 Unified Connection (WebSocket/SSE 自動切換)
 * - 處理實時消息接收
 * - 追蹤連接狀態和質量
 * - 處理自動重連
 * - 管理輸入指示器 (typing indicators)
 *
 * 不負責：
 * - 消息列表狀態 (由 useConversationState 處理)
 * - 消息發送邏輯 (由 useMessageHandlers 處理)
 * - UI 操作 (由 useConversationActions 處理)
 */

import { ref, computed, type Ref } from 'vue'
import {
  createCustomerRealtimeConnection,
  type CustomerRealtimeConnection,
  type ConnectionState
} from '@/services/customerWebSocketManager'
import { useWebSocketMigration } from '@/composables/useWebSocketMigration'
import { useConnectionState } from '@/composables/useConnectionState'
import { WS_EVENTS, normalizeEventType } from '@/constants/websocket-events'
import type { Message } from '@/types'
import type { ConversationState } from './useConversationState'
import type { MessageHandlers } from './useMessageHandlers'

type ConnectionType = 'websocket'

// ===== Composable =====

export function useWebSocketIntegration(
  conversationId: string,
  state: ConversationState,
  handlers: MessageHandlers
) {
  // ===== WebSocket Migration Strategy =====
  const migration = useWebSocketMigration({
    strategy: 'websocket_only', // 100% WebSocket (后端完全支持)
    fallbackToSSE: false,
    rolloutPercentage: 100
  })

  // ===== Unified Connection State =====
  const unifiedConnection = ref<CustomerRealtimeConnection | null>(null)
  const unifiedConnectionType = ref<ConnectionType>('websocket')
  const unifiedConnectionState = ref<ConnectionState>('disconnected')
  const unifiedIsConnected = ref(false)

  // ===== Connection State Composable =====
  const connectionState = useConnectionState({
    sseIsConnected: unifiedIsConnected,
    sseIsConnecting: computed(() => unifiedConnectionState.value === 'connecting'),
    sseIsReconnecting: computed(() => unifiedConnectionState.value === 'reconnecting'),
    sseHasError: computed(() => unifiedConnectionState.value === 'error'),
    wsIsJoined: computed(() => false),
    wsIsConnecting: computed(() => false),
    shouldUseWebSocket: computed(() => unifiedConnectionType.value === 'websocket')
  })

  const { currentProtocol, connectionQuality } = connectionState

  // ===== Typing State (Phase 1 disabled, Phase 2 will enable) =====
  const isTyping = ref(false)
  const typingUsers = ref<string[]>([])

  // ===== Connection Management =====

  /**
   * 初始化統一連接 (WebSocket/SSE)
   */
  async function initialize() {
    try {
      console.log(
        `✅ [WebSocketIntegration] Initializing Customer WebSocket for conversation: ${conversationId}`
      )

      // 創建 Customer WebSocket 連接
      const conn = await createCustomerRealtimeConnection(conversationId)
      unifiedConnection.value = conn

      // Store connection type
      unifiedConnectionType.value = conn.type

      // Setup event handlers
      conn.onMessage(handleUnifiedMessage)
      conn.onStateChange(handleUnifiedStateChange)
      conn.onError(handleUnifiedError)

      // Connect
      await conn.connect()

      // 將 unified messages 引用傳給 state
      if (conn.messages) {
        state.setUnifiedMessages((conn.messages as unknown) as Ref<Message[]>)
      }

      console.log(
        `✅ [WebSocketIntegration] Customer WebSocket connection established: ${unifiedConnectionType.value}`
      )
    } catch (error) {
      console.error('❌ [WebSocketIntegration] Failed to initialize Customer WebSocket:', error)
      unifiedConnectionState.value = 'error'
    }
  }

  // 🔧 FIX: 追蹤前一個連接狀態，用於檢測重連
  let previousConnectionState: ConnectionState = 'disconnected'

  /**
   * 處理統一連接狀態變化
   */
  function handleUnifiedStateChange(newState: ConnectionState) {
    console.log(`[WebSocketIntegration] Unified connection state changed: ${previousConnectionState} → ${newState}`)

    const wasReconnecting = previousConnectionState === 'reconnecting'
    previousConnectionState = newState

    unifiedConnectionState.value = newState
    unifiedIsConnected.value = newState === 'connected'

    // Update state composable
    state.setUnifiedConnected(newState === 'connected')

    // 🔧 FIX: 重連成功後檢查並同步訊息
    // 當從 reconnecting 狀態變為 connected 時，觸發訊息同步
    if (newState === 'connected' && wasReconnecting) {
      console.log('🔄 [WebSocketIntegration] Reconnected, checking message sync...')
      triggerMessageSyncAfterReconnection()
    }
  }

  /**
   * 🔧 FIX: 重連後觸發訊息同步
   * 解決問題：長時間閒置後 WebSocket 重連，但 unifiedMessages 為空
   */
  async function triggerMessageSyncAfterReconnection() {
    try {
      // 檢查 unifiedMessages 是否為空
      const conn = unifiedConnection.value
      const unifiedMsgCount = conn?.messages
        ? ((conn.messages as unknown) as Ref<Message[]>).value?.length ?? 0
        : 0

      if (unifiedMsgCount === 0) {
        console.log('📥 [WebSocketIntegration] Triggering message sync after reconnection (unifiedMessages is empty)')
        await state.refreshMessagesAfterReconnection()
        console.log('✅ [WebSocketIntegration] Message sync completed after reconnection')
      } else {
        console.log(`✅ [WebSocketIntegration] Reconnection sync skipped (${unifiedMsgCount} messages already loaded)`)
      }
    } catch (error) {
      console.error('❌ [WebSocketIntegration] Message sync failed after reconnection:', error)
    }
  }

  /**
   * 處理統一連接接收的消息
   * 🛡️ 方案 C: 使用小寫事件類型（customerWebSocketManager 已正規化）
   * 🔧 Phase 2: 支援 Correlation ID 匹配
   */
  function handleUnifiedMessage(message: unknown) {
    const msg = message as {
      type?: string
      message?: Message & { correlationId?: string }  // 🔧 Phase 2/3: 後端可能包含 correlationId
    }

    // 🛡️ 防禦性編程：再次正規化以防萬一（defense-in-depth）
    const eventType = normalizeEventType(msg.type || '')
    console.log('✅ [WebSocketIntegration] Received message:', eventType, message)

    // Handle new_message events (小寫，由 customerWebSocketManager 正規化)
    if (eventType === WS_EVENTS.NEW_MESSAGE && msg.message) {
      const messageId = msg.message.id
      // 🔧 Phase 2/3: 從訊息或 metadata 中獲取 correlationId
      const correlationId = msg.message.correlationId ||
        (msg.message.metadata as Record<string, unknown> | undefined)?.correlationId as string | undefined

      // 檢查是否是本標籤發送的訊息（避免重複）
      // 🔧 Phase 2: 優先使用 correlationId 進行匹配（更可靠）
      if (handlers.isSentMessage(messageId, correlationId)) {
        console.log(
          `⏭️ [WebSocketIntegration] Skipping own message: id=${messageId}, correlationId=${correlationId || 'N/A'}`
        )
        return
      }

      // Add message to state
      state.addMessage(msg.message)
      console.log('📨 [WebSocketIntegration] New message added to conversation')
    }

    // Handle TYPING events (Phase 2)
    // if (eventType === WS_EVENTS.TYPING_START) { ... }
    // if (eventType === WS_EVENTS.TYPING_STOP) { ... }
  }

  /**
   * 處理統一連接錯誤
   */
  function handleUnifiedError(error: Error) {
    console.error('[WebSocketIntegration] Unified connection error:', error)
    unifiedConnectionState.value = 'error'
  }

  /**
   * 手動重連
   */
  async function reconnect() {
    try {
      console.log('🔄 [WebSocketIntegration] Manual reconnection requested...')
      if (unifiedConnection.value) {
        await unifiedConnection.value.reconnect()
        console.log('✅ [WebSocketIntegration] Reconnection successful')
      }
    } catch (error) {
      console.error('❌ [WebSocketIntegration] Reconnection failed:', error)
      throw error
    }
  }

  /**
   * 斷開連接
   */
  function disconnect() {
    if (unifiedConnection.value) {
      console.log('[WebSocketIntegration] Disconnecting unified connection...')
      unifiedConnection.value.disconnect()
      unifiedConnection.value = null
      unifiedConnectionState.value = 'disconnected'
      unifiedIsConnected.value = false
    }
  }

  // ===== Typing Indicators (Phase 2 - currently disabled) =====

  /**
   * 發送正在輸入指示器
   */
  function startTyping() {
    isTyping.value = true
    // TODO: Send WebSocket typing start event
    console.debug('[WebSocketIntegration] Typing start requested (not yet implemented)')
  }

  /**
   * 停止輸入指示器
   */
  function stopTyping() {
    isTyping.value = false
    // TODO: Send WebSocket typing stop event
    console.debug('[WebSocketIntegration] Typing stop requested (not yet implemented)')
  }

  // ===== Computed Properties =====

  /**
   * 連接狀態文本
   */
  const connectionText = computed(() => {
    if (unifiedIsConnected.value) {
      const conn = unifiedConnection.value
      const msgCount = conn
        ? (((conn.messages as unknown) as Ref<Message[]>).value?.length ?? 0)
        : 0
      return `🔌 WebSocket 已連接 (${msgCount} 條訊息)`
    }

    if (unifiedConnectionState.value === 'connecting') {
      return '🔌 WebSocket 連接中...'
    }

    if (unifiedConnectionState.value === 'reconnecting') {
      return '🔌 WebSocket 重連中... (0/5)'
    }

    if (unifiedConnectionState.value === 'error') {
      return '❌ WebSocket 連接失敗'
    }

    return '⚠️ 未連接'
  })

  /**
   * 連接狀態 CSS 類
   */
  const connectionStatusClass = computed(() => {
    if (unifiedIsConnected.value) {
      return 'status-connected status-sse'
    }

    if (
      unifiedConnectionState.value === 'connecting' ||
      unifiedConnectionState.value === 'reconnecting'
    ) {
      return 'status-connecting status-sse'
    }

    if (unifiedConnectionState.value === 'error') {
      return 'status-error status-sse'
    }

    return 'status-disconnected'
  })

  /**
   * 是否啟用 WebSocket
   */
  const isWebSocketEnabled = computed(() => migration.shouldUseWebSocket.value)

  /**
   * 新消息數量
   * 添加双重保护避免 undefined 导致的 Race Condition
   */
  const newMessageCount = computed(() => {
    const conn = unifiedConnection.value
    if (!conn || !conn.messageCount) return 0
    const count = ((conn.messageCount as unknown) as Ref<number>).value
    return count ?? 0  // 双重保护：确保返回值永远是数字
  })

  // ===== 返回接口 =====

  return {
    // Connection Management
    initialize,
    reconnect,
    disconnect,

    // Connection State
    unifiedConnection,
    unifiedConnectionType,
    unifiedConnectionState,
    unifiedIsConnected,
    currentProtocol,
    connectionQuality,
    connectionText,
    connectionStatusClass,
    isWebSocketEnabled,

    // Typing Indicators
    isTyping,
    typingUsers,
    startTyping,
    stopTyping,

    // Message Count
    newMessageCount,

    // Migration Strategy
    migration
  }
}

export type WebSocketIntegration = ReturnType<typeof useWebSocketIntegration>
