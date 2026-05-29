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
import { useConnectionState } from '@/composables/useConnectionState'
import { WS_EVENTS, normalizeEventType } from '@/constants/websocket-events'
import { createLogger } from '@/utils/logger'
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
  const log = createLogger('WebSocketIntegration')

  // ===== Unified Connection State =====
  // NOTE: Migration shim removed — system is 100% WebSocket
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
      log.info(
        `Initializing Customer WebSocket for conversation: ${conversationId}`
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

      log.info(
        `Customer WebSocket connection established: ${unifiedConnectionType.value}`
      )
    } catch (error) {
      log.error('Failed to initialize Customer WebSocket:', error)
      unifiedConnectionState.value = 'error'
    }
  }

  // FIX: 追蹤前一個連接狀態，用於檢測重連
  let previousConnectionState: ConnectionState = 'disconnected'
  // FIX: 追蹤是否已經首次連接成功，避免重複觸發
  let hasConnectedOnce = false

  /**
   * 處理統一連接狀態變化
   */
  function handleUnifiedStateChange(newState: ConnectionState) {
    log.debug(`Unified connection state changed: ${previousConnectionState} → ${newState}`)

    const wasReconnecting = previousConnectionState === 'reconnecting'
    const wasConnecting = previousConnectionState === 'connecting'
    previousConnectionState = newState

    unifiedConnectionState.value = newState
    unifiedIsConnected.value = newState === 'connected'

    // Update state composable
    state.setUnifiedConnected(newState === 'connected')

    // FIX: 重連成功後檢查並同步訊息
    // 當從 reconnecting 狀態變為 connected 時，觸發訊息同步
    if (newState === 'connected' && wasReconnecting) {
      log.info('Reconnected, checking message sync...')
      triggerMessageSyncAfterReconnection()
    }

    // FIX: 首次連接成功時，如果 HTTP 訊息為空，重新載入訊息
    // 解決問題：初始 HTTP 請求因權限失敗 (403) 後，WebSocket 連接成功但訊息未重新載入
    if (newState === 'connected' && wasConnecting && !hasConnectedOnce) {
      hasConnectedOnce = true
      log.info('First connection successful, checking if HTTP messages need refresh...')
      triggerMessageSyncOnFirstConnection()
    }
  }

  /**
   * 首次連接時觸發訊息同步
   * 當 WebSocket 首次連接成功且 HTTP 訊息為空時，重新載入訊息
   */
  async function triggerMessageSyncOnFirstConnection() {
    try {
      // 檢查 HTTP 訊息是否為空（可能是初始請求失敗導致）
      const httpMsgCount = state.messages.value?.length ?? 0

      if (httpMsgCount === 0) {
        log.info('HTTP messages empty on first connection, refreshing via HTTP...')
        await state.refreshMessagesAfterReconnection()
        log.info('First connection message refresh completed')
      } else {
        log.debug(`First connection: ${httpMsgCount} messages already loaded, no refresh needed`)
      }
    } catch (error) {
      log.error('First connection message refresh failed:', error)
    }
  }

  /**
   * 重連後觸發訊息同步（基於時間戳的智能同步）
   *
   * 舊邏輯：檢查 unifiedMessages.length === 0
   * 新邏輯：使用 serverLastMessageAt vs clientLastTs 時間戳比較
   *
   * 注意：這個方法現在作為 fallback，主要同步由 connection_established 事件驅動
   */
  async function triggerMessageSyncAfterReconnection() {
    try {
      log.debug('Triggering reconnection sync check...')

      // 新邏輯：基於時間戳的同步由 connection_established 事件處理
      // 這裡作為 fallback，當 connection_established 未觸發時使用
      const conn = unifiedConnection.value
      if (!conn) {
        log.warn('No connection for sync check')
        return
      }

      // 檢查 unifiedMessages 是否為空
      const unifiedMsgCount = conn.messages
        ? ((conn.messages as unknown) as Ref<Message[]>).value?.length ?? 0
        : 0

      if (unifiedMsgCount === 0) {
        // Fallback: 如果 unifiedMessages 為空，使用 HTTP 刷新
        log.info('Fallback: refreshing via HTTP (unifiedMessages is empty)')
        await state.refreshMessagesAfterReconnection()
        log.info('Fallback message sync completed')
      } else {
        // 主要同步邏輯：等待 connection_established 事件中的 serverLastMessageAt
        // 這裡只記錄狀態，實際同步由 handleConnectionEstablished 處理
        log.debug(`Reconnection sync check passed (${unifiedMsgCount} messages in buffer)`)
        log.debug('Note: Timestamp-based sync is handled by connection_established event')
      }
    } catch (error) {
      log.error('Reconnection sync check failed:', error)
    }
  }

  /**
   * 處理統一連接接收的消息
   * 方案 C: 使用小寫事件類型（customerWebSocketManager 已正規化）
   * Phase 2: 支援 Correlation ID 匹配
   * 重連同步: 支援 connection_established 和 sync_response 事件
   */
  function handleUnifiedMessage(message: unknown) {
    const msg = message as {
      type?: string
      message?: Message & { correlationId?: string }  //  Phase 2/3: 後端可能包含 correlationId
      data?: {
        type?: string
        serverLastMessageAt?: string | null
        missedMessages?: Message[]
        missedCount?: number
        syncedAt?: string
      }
    }

    // 防禦性編程：再次正規化以防萬一（defense-in-depth）
    const eventType = normalizeEventType(msg.type || '')
    log.debug('Received message:', eventType, message)

    // 重連同步: 處理連接建立事件（含 serverLastMessageAt）
    if (msg.data?.type === 'connection_established') {
      handleConnectionEstablished(msg.data.serverLastMessageAt)
      return
    }

    // 重連同步: 處理同步回應
    if (msg.data?.type === 'sync_response' && msg.data.missedMessages) {
      handleSyncResponse(msg.data.missedMessages)
      return
    }

    // Handle new_message events (小寫，由 customerWebSocketManager 正規化)
    if (eventType === WS_EVENTS.NEW_MESSAGE && msg.message) {
      const messageId = msg.message.id
      // Phase 2/3: 從訊息或 metadata 中獲取 correlationId
      const correlationId = msg.message.correlationId ||
        (msg.message.metadata as Record<string, unknown> | undefined)?.correlationId as string | undefined

      // 檢查是否是本標籤發送的訊息（避免重複）
      // Phase 2: 優先使用 correlationId 進行匹配（更可靠）
      if (handlers.isSentMessage(messageId, correlationId)) {
        log.debug(
          `Skipping own message: id=${messageId}, correlationId=${correlationId || 'N/A'}`
        )
        return
      }

      // Add message to state
      state.addMessage(msg.message)
      log.debug('New message added to conversation')
    }

    // Handle message_updated events. Two distinct payload shapes share this event:
    // (A) Media processing completes: { messageId, file_attachments: [...] }
    //     — fired by webhook-router-service after downloading LINE/Facebook media.
    // (B) Agent send completes background LINE push: { messageId, deliveryStatus, isSent, platformMessageId }
    //     — fired by message-service.processBackgroundSending after pushLineMessage.
    // The previous handler only processed (A), silently dropping (B), which left
    // the "傳送中..." badge stuck forever for agent-sent attachments and any other
    // status-only update.
    if (eventType === WS_EVENTS.MESSAGE_UPDATED && msg.data) {
      const updateData = msg.data as {
        messageId?: string;
        file_attachments?: Array<{
          id: string;
          filename: string;
          mimeType: string;
          fileSize: number;
          fileUrl: string;
        }>;
        deliveryStatus?: string;
        isSent?: boolean;
        platformMessageId?: string | null;
      }
      if (!updateData.messageId) {return}

      if (updateData.file_attachments) {
        state.updateMessageAttachments(updateData.messageId, updateData.file_attachments)
        log.debug('Message attachments updated', { messageId: updateData.messageId })
      }

      if (updateData.deliveryStatus !== undefined ||
          updateData.isSent !== undefined ||
          updateData.platformMessageId !== undefined) {
        state.updateMessageStatus(updateData.messageId, {
          deliveryStatus: updateData.deliveryStatus,
          isSent: updateData.isSent,
          platformMessageId: updateData.platformMessageId,
        })
        log.debug('Message status updated', { messageId: updateData.messageId, deliveryStatus: updateData.deliveryStatus })
      }
    }

    // Handle TYPING events (Phase 2)
    // if (eventType === WS_EVENTS.TYPING_START) { ... }
    // if (eventType === WS_EVENTS.TYPING_STOP) { ... }
  }

  // ===================  重連同步機制 ===================

  /**
   * 重連同步: 處理連接建立事件
   * 比較 serverLastMessageAt 和 clientLastTs，決定是否需要同步
   */
  function handleConnectionEstablished(serverLastMessageAt?: string | null) {
    log.info('Connection established', { serverLastMessageAt })

    const clientLastTs = state.lastMessageTimestamp.value

    // 比較時間戳
    if (serverLastMessageAt && clientLastTs) {
      const serverTime = new Date(serverLastMessageAt).getTime()
      const clientTime = new Date(clientLastTs).getTime()

      if (serverTime > clientTime) {
        log.info('Server has newer messages, requesting sync...', {
          serverTime: new Date(serverTime).toISOString(),
          clientTime: new Date(clientTime).toISOString(),
          diff: `${(serverTime - clientTime) / 1000}s`
        })
        requestMessageSync(clientLastTs)
      } else {
        log.debug('Client is up to date')
      }
    } else if (serverLastMessageAt && !clientLastTs) {
      // 客戶端沒有訊息但伺服器有，請求同步所有訊息
      log.info('Client has no messages, requesting full sync...')
      requestMessageSync(null)
    } else {
      log.debug('No sync needed (server has no messages)')
    }
  }

  /**
   * 重連同步: 發送同步請求
   * @param since - 客戶端最後訊息時間戳，null 表示請求所有訊息
   */
  function requestMessageSync(since: string | null) {
    const conn = unifiedConnection.value
    if (!conn) {
      log.warn('Cannot request sync - no connection')
      return
    }

    log.debug('Sending sync_request...', { since, conversationId })

    conn.send({
      type: 'sync_request',
      data: {
        since,
        conversationId
      }
    })
  }

  /**
   * 重連同步: 處理同步回應
   * 將遺漏的訊息加入狀態
   */
  function handleSyncResponse(missedMessages: Message[]) {
    log.info(`Received sync_response with ${missedMessages.length} missed messages`)

    if (missedMessages.length === 0) {
      log.debug('No missed messages')
      return
    }

    let addedCount = 0
    missedMessages.forEach(msg => {
      // 使用現有的去重邏輯
      // 注意：這裡使用 handlers.isSentMessage 檢查是否是本標籤發送的訊息
      const messageId = msg.id
      const correlationId = (msg.metadata as Record<string, unknown> | undefined)?.correlationId as string | undefined

      if (!handlers.isSentMessage(messageId, correlationId)) {
        state.addMessage(msg)
        addedCount++
      }
    })

    log.info(`Sync complete: added ${addedCount}/${missedMessages.length} messages`)
  }

  /**
   * 處理統一連接錯誤
   */
  function handleUnifiedError(error: Error) {
    log.error('Unified connection error:', error)
    unifiedConnectionState.value = 'error'
  }

  /**
   * 手動重連
   */
  async function reconnect() {
    try {
      log.info('Manual reconnection requested...')
      if (unifiedConnection.value) {
        await unifiedConnection.value.reconnect()
        log.info('Reconnection successful')
      }
    } catch (error) {
      log.error('Reconnection failed:', error)
      throw error
    }
  }

  /**
   * 斷開連接
   */
  function disconnect() {
    if (unifiedConnection.value) {
      log.debug('Disconnecting unified connection...')
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
    // Phase 2: WebSocket typing indicators (requires DO broadcast support)
    log.debug('Typing start requested')
  }

  /**
   * 停止輸入指示器
   */
  function stopTyping() {
    isTyping.value = false
    // Phase 2: WebSocket typing indicators (requires DO broadcast support)
    log.debug('Typing stop requested')
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
      return ` WebSocket 已連接 (${msgCount} 條訊息)`
    }

    if (unifiedConnectionState.value === 'connecting') {
      return ' WebSocket 連接中...'
    }

    if (unifiedConnectionState.value === 'reconnecting') {
      return ' WebSocket 重連中... (0/5)'
    }

    if (unifiedConnectionState.value === 'error') {
      return ' WebSocket 連接失敗'
    }

    return ' 未連接'
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
  const isWebSocketEnabled = computed(() => true) // 100% WebSocket — migration shim removed

  /**
   * 新消息數量
   * 添加双重保护避免 undefined 导致的 Race Condition
   */
  const newMessageCount = computed(() => {
    const conn = unifiedConnection.value
    if (!conn || !conn.messageCount) {return 0}
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

    // Migration Strategy (removed — 100% WebSocket)
  }
}

export type WebSocketIntegration = ReturnType<typeof useWebSocketIntegration>
