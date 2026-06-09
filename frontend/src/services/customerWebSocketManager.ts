// Customer WebSocket Manager - 連接到新的 Customer Conversation System
// 提供與 realtimeConnectionManager 兼容的接口
import { ref, computed, type Ref } from 'vue'
import type { Message } from '@/types'
import { getBackendUrl } from '@/config/runtime'
import { WS_EVENTS, normalizeEventType } from '@/constants/websocket-events'
import { createLogger } from '@/utils/logger'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface CustomerWebSocketConfig {
  conversationId: string
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectInterval?: number
}

export interface CustomerRealtimeConnection {
  type: 'websocket'
  messages: Ref<Message[]>
  messageCount: Ref<number>
  isConnected: Ref<boolean>
  connectionState: Ref<ConnectionState>

  connect(): Promise<void>
  disconnect(): void
  reconnect(): void
  send(_message: unknown): void
  clearMessages(): void

  onMessage(_callback: (_message: unknown) => void): void
  onStateChange(_callback: (_state: ConnectionState) => void): void
  onError(_callback: (_error: Error) => void): void
}

/**
 * 創建 Customer WebSocket 連接
 */
export function createCustomerWebSocketConnection(
  config: CustomerWebSocketConfig
): CustomerRealtimeConnection {
  const log = createLogger('CustomerWebSocket')

  // 狀態
  const ws = ref<globalThis.WebSocket | null>(null)
  const connectionState = ref<ConnectionState>('disconnected')
  const messages = ref<Message[]>([])
  const messageCount = ref(0)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = config.maxReconnectAttempts ?? 5
  const reconnectInterval = config.reconnectInterval ?? 1000

  // Computed
  const isConnected = computed(() => connectionState.value === 'connected')

  // 事件回調
  let messageCallback: ((_message: unknown) => void) | null = null
  let stateChangeCallback: ((_state: ConnectionState) => void) | null = null
  let errorCallback: ((_error: Error) => void) | null = null

  /**
   * 構建 WebSocket URL
   */
  const buildWebSocketUrl = (): string => {
    // 永遠使用遠端後端
    const apiUrl = getBackendUrl()
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws'
    const wsHost = apiUrl.replace(/^https?:\/\//, '')

    const url = new URL(`${wsProtocol}://${wsHost}/api/customer-ws`)
    url.searchParams.set('conversationId', config.conversationId)

    return url.toString()
  }

  /**
   * 更新連接狀態
   */
  const updateConnectionState = (newState: ConnectionState) => {
    connectionState.value = newState
    stateChangeCallback?.(newState)
    log.debug(`State changed: ${newState}`)
  }

  /**
   * 連接到 WebSocket
   */
  const connect = async (): Promise<void> => {
    if (ws.value && (ws.value.readyState === globalThis.WebSocket.CONNECTING || ws.value.readyState === globalThis.WebSocket.OPEN)) {
      log.debug('Already connected or connecting')
      return
    }

    try {
      updateConnectionState('connecting')

      const wsUrl = buildWebSocketUrl()
      log.debug('Connecting to:', wsUrl)

      ws.value = new globalThis.WebSocket(wsUrl)

      // 連接成功
      ws.value.onopen = () => {
        log.info('Connected successfully')
        updateConnectionState('connected')
        reconnectAttempts.value = 0
      }

      // 接收消息
      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // 方案 C: 防禦性編程 - 正規化事件類型為小寫
          // 遵循 Postel's Law: "Be liberal in what you accept"
          // 這樣無論後端發送 'new_message', 'NEW_MESSAGE', 或 'New_Message' 都能正確處理
          const eventType = normalizeEventType(data.type)

          log.debug('Received:', eventType, data)

          // 重連同步: 處理 event 類型訊息 (connection_established, sync_response)
          if (eventType === 'event' && data.data) {
            const innerType = data.data.type
            log.debug('Processing event:', innerType)

            // 直接傳遞給回調，由 useWebSocketIntegration 處理
            messageCallback?.(data)
            return
          }

          if (eventType === WS_EVENTS.NEW_MESSAGE && data.message) {
            // FIX: 不再基於 senderId 跳過訊息
            // 改由 useCustomerMessages.addMessage() 的 ID 去重機制處理
            // 這樣可以支援同一用戶多瀏覽器標籤的即時同步：
            // - 發送者標籤：handleMessageConfirmed 已更新 message.id 為 realId，addMessage 會跳過
            // - 其他標籤：沒有 realId，addMessage 會添加訊息
            log.debug('Processing new_message:', data.message.id)

            // 更新計數器
            messageCount.value++

            // 正規化後傳遞給回調，確保下游一致使用小寫
            const normalizedData = { ...data, type: eventType }
            // 通知回調（由 ConversationDetail.vue 的 handleUnifiedMessage 處理）
            // addMessage 會進行 ID 去重，確保發送者標籤不會重複顯示
            messageCallback?.(normalizedData)
          } else if (eventType === WS_EVENTS.USER_CONNECTED || eventType === WS_EVENTS.USER_DISCONNECTED) {
            // 用戶在線狀態變化
            log.debug(`User ${eventType}: ${data.userId}`)
            const normalizedData = { ...data, type: eventType }
            messageCallback?.(normalizedData)
          }
        } catch (_error) {
          log.error('Error parsing message:', _error)
          errorCallback?.(_error instanceof Error ? _error : new Error(String(_error)))
        }
      }

      // 連接錯誤
      ws.value.onerror = (event) => {
        log.error('Connection error:', event)
        updateConnectionState('error')
        const error = new Error('WebSocket connection error')
        errorCallback?.(error)
      }

      // 連接關閉
      ws.value.onclose = (event) => {
        log.debug('Connection closed:', event.code, event.reason)
        updateConnectionState('disconnected')

        // 自動重連
        if (config.autoReconnect !== false && event.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts.value), 10000)

          log.info(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})`)

          updateConnectionState('reconnecting')

          setTimeout(() => {
            connect()
          }, delay)
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
          log.error('Max reconnect attempts reached')
          updateConnectionState('error')
        }
      }

    } catch (_error) {
      log.error('Failed to create WebSocket:', _error)
      updateConnectionState('error')
      errorCallback?.(_error instanceof Error ? _error : new Error(String(_error)))
      throw _error
    }
  }

  /**
   * 斷開連接
   */
  const disconnect = () => {
    if (ws.value) {
      ws.value.close(1000, 'Client disconnect')
      ws.value = null
      updateConnectionState('disconnected')
      log.debug('Disconnected')
    }
  }

  /**
   * 手動重連
   */
  const reconnect = () => {
    log.info('Manual reconnect requested')
    reconnectAttempts.value = 0
    disconnect()
    connect()
  }

  /**
   * 發送消息到 WebSocket
   * 重連同步: 支援 sync_request 等控制訊息
   *
   * 注意：一般聊天訊息仍通過 HTTP POST 發送，這裡主要用於:
   * - sync_request: 重連後請求遺漏的訊息
   * - ping/pong: 心跳檢測
   * - typing indicators: 輸入狀態（Phase 2）
   */
  const send = (message: unknown) => {
    if (!ws.value || ws.value.readyState !== globalThis.WebSocket.OPEN) {
      log.warn('Cannot send - WebSocket not connected')
      return
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
      ws.value.send(messageStr)
      log.debug('Sent:', message)
    } catch (error) {
      log.error('Send error:', error)
      errorCallback?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 清空消息列表
   */
  const clearMessages = () => {
    messages.value = []
    messageCount.value = 0
  }

  /**
   * 註冊消息回調
   */
  const onMessage = (_callback: (_message: unknown) => void) => {
    messageCallback = _callback
  }

  /**
   * 註冊狀態變化回調
   */
  const onStateChange = (_callback: (_state: ConnectionState) => void) => {
    stateChangeCallback = _callback
  }

  /**
   * 註冊錯誤回調
   */
  const onError = (_callback: (_error: Error) => void) => {
    errorCallback = _callback
  }

  return {
    type: 'websocket',
    messages,
    messageCount,
    isConnected,
    connectionState,

    connect,
    disconnect,
    reconnect,
    send,
    clearMessages,

    onMessage,
    onStateChange,
    onError
  }
}

/**
 * 創建 Customer 實時連接（統一接口）
 */
export async function createCustomerRealtimeConnection(
  conversationId: string
): Promise<CustomerRealtimeConnection> {
  const log = createLogger('CustomerWebSocket')
  log.info(`Creating Customer WebSocket for conversation: ${conversationId}`)

  const connection = createCustomerWebSocketConnection({
    conversationId,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 1000
  })

  return connection
}
