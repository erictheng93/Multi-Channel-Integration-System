// 現代化 WebSocket Composable
import { ref, computed, onUnmounted, watch } from 'vue'
import { useError } from './useError'

export interface UseWebSocketOptions {
  protocols?: string | string[]
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeat?: {
    message?: string | object
    interval?: number
  }
  onConnected?: (ws: WebSocket) => void
  onDisconnected?: (ws: WebSocket, event: CloseEvent) => void
  onError?: (ws: WebSocket, event: Event) => void
  onMessage?: (ws: WebSocket, event: MessageEvent) => void
}

export enum WebSocketStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const {
    protocols,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeat,
    onConnected,
    onDisconnected,
    onError,
    onMessage
  } = options

  // 狀態管理
  const ws = ref<WebSocket | null>(null)
  const status = ref<WebSocketStatus>(WebSocketStatus.DISCONNECTED)
  const data = ref<unknown>(null)
  const lastMessage = ref<MessageEvent | null>(null)
  const { error, handleError, clearError } = useError()

  // 重連狀態
  const reconnectAttempts = ref(0)
  const isReconnecting = ref(false)

  // 計算屬性
  const isConnected = computed(() => status.value === WebSocketStatus.CONNECTED)
  const isConnecting = computed(() => status.value === WebSocketStatus.CONNECTING)
  const canReconnect = computed(() => 
    autoReconnect && reconnectAttempts.value < maxReconnectAttempts
  )

  // 定時器引用
  let reconnectTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null

  // 清理定時器
  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // 啟動心跳
  const startHeartbeat = () => {
    if (!heartbeat || !ws.value) {return}

    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        const message = typeof heartbeat.message === 'string' 
          ? heartbeat.message 
          : JSON.stringify(heartbeat.message || { type: 'ping' })
        ws.value.send(message)
      }
    }, heartbeat.interval || 30000)
  }

  // 連接 WebSocket
  const connect = () => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      return
    }

    clearError()
    status.value = WebSocketStatus.CONNECTING

    try {
      ws.value = new WebSocket(url, protocols)

      ws.value.onopen = (_event) => {
        status.value = WebSocketStatus.CONNECTED
        reconnectAttempts.value = 0
        isReconnecting.value = false
        
        startHeartbeat()
        if (ws.value) {
          onConnected?.(ws.value)
        }
      }

      ws.value.onmessage = (event) => {
        lastMessage.value = event
        
        try {
          data.value = JSON.parse(event.data)
        } catch {
          data.value = event.data
        }

        if (ws.value) {
          onMessage?.(ws.value, event)
        }
      }

      ws.value.onclose = (event) => {
        status.value = WebSocketStatus.DISCONNECTED
        clearTimers()
        
        if (ws.value) {
          onDisconnected?.(ws.value, event)
        }

        // 自動重連
        if (canReconnect.value && !event.wasClean) {
          scheduleReconnect()
        }
      }

      ws.value.onerror = (event) => {
        status.value = WebSocketStatus.ERROR
        const error = new Error('WebSocket connection error')
        handleError(error)
        if (ws.value) {
          onError?.(ws.value, event)
        }
      }

    } catch (err) {
      status.value = WebSocketStatus.ERROR
      handleError(err)
    }
  }

  // 安排重連
  const scheduleReconnect = () => {
    if (!canReconnect.value || isReconnecting.value) {return}

    isReconnecting.value = true
    reconnectAttempts.value++

    reconnectTimer = setTimeout(() => {
      if (canReconnect.value) {
        connect()
      }
    }, reconnectInterval)
  }

  // 斷開連接
  const disconnect = () => {
    clearTimers()
    isReconnecting.value = false
    
    if (ws.value) {
      ws.value.close(1000, 'Manual disconnect')
      ws.value = null
    }
    
    status.value = WebSocketStatus.DISCONNECTED
  }

  // 發送消息
  const send = (message: string | object) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message)
    ws.value.send(data)
  }

  // 安全發送消息（不會拋出錯誤）
  const sendSafe = (message: string | object): boolean => {
    try {
      send(message)
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  // 重置重連計數
  const resetReconnectAttempts = () => {
    reconnectAttempts.value = 0
  }

  // 手動重連
  const reconnect = () => {
    disconnect()
    resetReconnectAttempts()
    connect()
  }

  // 組件卸載時清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    // WebSocket 實例
    ws: computed(() => ws.value),
    
    // 狀態
    status: computed(() => status.value),
    data: computed(() => data.value),
    lastMessage: computed(() => lastMessage.value),
    error,
    
    // 連接狀態
    isConnected,
    isConnecting,
    isReconnecting: computed(() => isReconnecting.value),
    reconnectAttempts: computed(() => reconnectAttempts.value),
    canReconnect,
    
    // 方法
    connect,
    disconnect,
    reconnect,
    send,
    sendSafe,
    resetReconnectAttempts
  }
}

// 專門用於聊天的 WebSocket composable
export function useChatWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const ws = useWebSocket(url, options)
  
  // 聊天消息歷史
  const messages = ref<unknown[]>([])
  
  // 監聽新消息
  watch(ws.data, (newData) => {
    if (newData && typeof newData === 'object' && 'type' in newData && newData.type === 'message') {
      messages.value.push(newData)
    }
  })
  
  // 發送聊天消息
  const sendMessage = (content: string, type: string = 'text') => {
    const message = {
      type: 'message',
      content,
      messageType: type,
      timestamp: Date.now()
    }
    
    return ws.sendSafe(message)
  }
  
  // 清空消息歷史
  const clearMessages = () => {
    messages.value = []
  }
  
  return {
    ...ws,
    messages: computed(() => messages.value),
    sendMessage,
    clearMessages
  }
}