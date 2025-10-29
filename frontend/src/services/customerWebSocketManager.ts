// Customer WebSocket Manager - 連接到新的 Customer Conversation System
// 提供與 realtimeConnectionManager 兼容的接口
import { ref, computed, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Message } from '@/types'

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
  const authStore = useAuthStore()

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
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com'
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws'
    const wsHost = apiUrl.replace(/^https?:\/\//, '')

    const sessionId = authStore.token || localStorage.getItem('token')

    const url = new URL(`${wsProtocol}://${wsHost}/api/customer-ws`)
    url.searchParams.set('conversationId', config.conversationId)
    url.searchParams.set('sessionId', sessionId || '')

    return url.toString()
  }

  /**
   * 更新連接狀態
   */
  const updateConnectionState = (newState: ConnectionState) => {
    connectionState.value = newState
    stateChangeCallback?.(newState)
    console.log(`🔌 [CustomerWebSocket] State changed: ${newState}`)
  }

  /**
   * 連接到 WebSocket
   */
  const connect = async (): Promise<void> => {
    if (ws.value && (ws.value.readyState === globalThis.WebSocket.CONNECTING || ws.value.readyState === globalThis.WebSocket.OPEN)) {
      console.log('🔌 [CustomerWebSocket] Already connected or connecting')
      return
    }

    try {
      updateConnectionState('connecting')

      const wsUrl = buildWebSocketUrl()
      console.log('🔌 [CustomerWebSocket] Connecting to:', wsUrl)

      ws.value = new globalThis.WebSocket(wsUrl)

      // 連接成功
      ws.value.onopen = () => {
        console.log('✅ [CustomerWebSocket] Connected successfully')
        updateConnectionState('connected')
        reconnectAttempts.value = 0
      }

      // 接收消息
      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 [CustomerWebSocket] Received:', data.type, data)

          if (data.type === 'NEW_MESSAGE' && data.message) {
            // 添加新消息到列表
            messages.value.push(data.message as Message)
            messageCount.value++

            // 通知回調
            messageCallback?.(data)
          } else if (data.type === 'USER_CONNECTED' || data.type === 'USER_DISCONNECTED') {
            // 用戶在線狀態變化
            console.log(`👤 [CustomerWebSocket] User ${data.type}: ${data.userId}`)
            messageCallback?.(data)
          }
        } catch (_error) {
          console.error('❌ [CustomerWebSocket] Error parsing message:', _error)
          errorCallback?.(_error instanceof Error ? _error : new Error(String(_error)))
        }
      }

      // 連接錯誤
      ws.value.onerror = (event) => {
        console.error('❌ [CustomerWebSocket] Connection error:', event)
        updateConnectionState('error')
        const error = new Error('WebSocket connection error')
        errorCallback?.(error)
      }

      // 連接關閉
      ws.value.onclose = (event) => {
        console.log('🔌 [CustomerWebSocket] Connection closed:', event.code, event.reason)
        updateConnectionState('disconnected')

        // 自動重連
        if (config.autoReconnect !== false && event.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts.value), 10000)

          console.log(`🔄 [CustomerWebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})`)

          updateConnectionState('reconnecting')

          setTimeout(() => {
            connect()
          }, delay)
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
          console.error('❌ [CustomerWebSocket] Max reconnect attempts reached')
          updateConnectionState('error')
        }
      }

    } catch (_error) {
      console.error('❌ [CustomerWebSocket] Failed to create WebSocket:', _error)
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
      console.log('🔌 [CustomerWebSocket] Disconnected')
    }
  }

  /**
   * 手動重連
   */
  const reconnect = () => {
    console.log('🔄 [CustomerWebSocket] Manual reconnect requested')
    reconnectAttempts.value = 0
    disconnect()
    connect()
  }

  /**
   * 發送消息（Customer API 不通過 WebSocket 發送，而是通過 HTTP POST）
   */
  const send = (_message: unknown) => {
    console.warn('⚠️ [CustomerWebSocket] send() not supported - use HTTP API to send messages')
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
  console.log(`[CustomerWebSocketManager] Creating Customer WebSocket for conversation: ${conversationId}`)

  const connection = createCustomerWebSocketConnection({
    conversationId,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 1000
  })

  return connection
}
