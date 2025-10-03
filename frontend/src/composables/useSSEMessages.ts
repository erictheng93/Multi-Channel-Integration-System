// SSE 訊息流 Composable
// Phase 1: 專用實時訊息系統
// Project: Multi-Channel Support MVP

import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Message } from '@/types'

export interface SSEConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  lastConnected: number | null
  reconnectAttempts: number
  error: string | null
}

export interface SSEMessageEvent {
  type: 'connection_established' | 'initial_messages' | 'new_messages' | 'heartbeat' | 'error'
  conversationId?: string
  messages?: Message[]
  count?: number
  lastMessageId?: string
  timestamp: string
  error?: string
}

export interface UseSSEMessagesOptions {
  autoConnect?: boolean
  reconnectOnError?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
  heartbeatTimeout?: number
}

const DEFAULT_OPTIONS: Required<UseSSEMessagesOptions> = {
  autoConnect: true,
  reconnectOnError: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000, // 3 seconds
  heartbeatTimeout: 60000 // 60 seconds
}

export function useSSEMessages(
  conversationId: Ref<string | undefined>,
  options: UseSSEMessagesOptions = {}
) {
  const authStore = useAuthStore()
  const config = { ...DEFAULT_OPTIONS, ...options }

  // State
  const messages = ref<Message[]>([])
  const connectionState = ref<SSEConnectionState>({
    status: 'disconnected',
    lastConnected: null,
    reconnectAttempts: 0,
    error: null
  })

  // 🎯 新消息追蹤：區分「歷史消息」和「新到達的消息」
  const newlyArrivedMessages = ref<Message[]>([])
  const initialLoadCompleted = ref(false)

  let eventSource: EventSource | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null
  let lastHeartbeat = 0

  // Computed properties
  const isConnected = computed(() => connectionState.value.status === 'connected')
  const isConnecting = computed(() => connectionState.value.status === 'connecting')
  const isReconnecting = computed(() => connectionState.value.status === 'reconnecting')
  const hasError = computed(() => connectionState.value.status === 'error')
  const canReconnect = computed(() =>
    connectionState.value.reconnectAttempts < config.maxReconnectAttempts
  )

  // Statistics
  const messageCount = computed(() => newlyArrivedMessages.value.length) // ✅ 只計算新到達的消息
  const totalMessageCount = computed(() => messages.value.length) // 總消息數（包含歷史）
  const latestMessage = computed(() =>
    messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  )
  const oldestMessage = computed(() =>
    messages.value.length > 0 ? messages.value[0] : null
  )

  // Connection management
  const connect = async (): Promise<void> => {
    if (!conversationId.value) {
      console.warn('[SSE] Cannot connect: no conversation ID')
      return
    }

    if (!authStore.token) {
      console.warn('[SSE] Cannot connect: no authentication token')
      return
    }

    if (eventSource?.readyState === EventSource.OPEN) {
      console.log('[SSE] Already connected')
      return
    }

    try {
      console.log(`📡 [SSE] Connecting to conversation stream: ${conversationId.value}`)

      updateConnectionState({
        status: 'connecting',
        error: null
      })

      // Build SSE URL with authentication
      const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
      const url = `${baseUrl}/api/conversations/${conversationId.value}/messages/stream?token=${authStore.token}`

      // Create EventSource connection
      eventSource = new EventSource(url)

      setupEventListeners()

    } catch (error) {
      console.error('[SSE] Connection error:', error)
      updateConnectionState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed'
      })

      if (config.reconnectOnError && canReconnect.value) {
        scheduleReconnect()
      }
    }
  }

  const disconnect = (): void => {
    console.log('[SSE] Disconnecting...')

    cleanupConnection()
    updateConnectionState({
      status: 'disconnected',
      reconnectAttempts: 0,
      error: null
    })
  }

  const reconnect = (): void => {
    if (!canReconnect.value) {
      console.warn('[SSE] Max reconnection attempts reached')
      return
    }

    console.log(`[SSE] Manual reconnection attempt ${connectionState.value.reconnectAttempts + 1}/${config.maxReconnectAttempts}`)

    cleanupConnection()
    updateConnectionState({
      status: 'reconnecting',
      reconnectAttempts: connectionState.value.reconnectAttempts + 1
    })

    connect()
  }

  // Event handling
  const setupEventListeners = (): void => {
    if (!eventSource) {return}

    eventSource.onopen = () => {
      console.log('[SSE] ✅ Connection established')
      updateConnectionState({
        status: 'connected',
        lastConnected: Date.now(),
        reconnectAttempts: 0,
        error: null
      })

      startHeartbeatMonitoring()
    }

    eventSource.onmessage = (event) => {
      try {
        const data: SSEMessageEvent = JSON.parse(event.data)
        handleMessage(data)
      } catch (error) {
        console.error('[SSE] Error parsing message:', error)
      }
    }

    eventSource.onerror = () => {
      console.error('[SSE] ❌ Connection error occurred')

      stopHeartbeatMonitoring()

      updateConnectionState({
        status: 'error',
        error: 'Connection lost'
      })

      if (config.reconnectOnError && canReconnect.value) {
        scheduleReconnect()
      }
    }
  }

  const handleMessage = (data: SSEMessageEvent): void => {
    console.log(`📨 [SSE] Received: ${data.type}`, data)

    switch (data.type) {
      case 'connection_established':
        console.log(`[SSE] Connection confirmed for conversation: ${data.conversationId}`)
        break

      case 'initial_messages':
        if (data.messages) {
          messages.value = [...data.messages]
          // 🎯 初始消息加載時，重置新消息追蹤
          newlyArrivedMessages.value = []
          initialLoadCompleted.value = true
          console.log(`[SSE] ✅ Loaded ${data.count || 0} initial messages (not counted as new)`)
        }
        break

      case 'new_messages':
        if (data.messages && data.messages.length > 0) {
          // Add new messages, avoiding duplicates
          const newMessages = data.messages.filter(newMsg =>
            !messages.value.some(existing => existing.id === newMsg.id)
          )

          if (newMessages.length > 0) {
            messages.value.push(...newMessages)

            // 🎯 只有在初始加載完成後，才計入新消息
            if (initialLoadCompleted.value) {
              newlyArrivedMessages.value.push(...newMessages)
              console.log(`[SSE] ✅ Added ${newMessages.length} NEW messages (total new: ${newlyArrivedMessages.value.length})`)
            } else {
              console.log(`[SSE] Added ${newMessages.length} messages during initial load (not counted as new)`)
            }
          }
        }
        break

      case 'heartbeat':
        lastHeartbeat = Date.now()
        console.log('[SSE] 💓 Heartbeat received')
        break

      case 'error':
        console.error('[SSE] Server error:', data.error)
        updateConnectionState({
          status: 'error',
          error: data.error || 'Server error'
        })
        break

      default:
        console.log('[SSE] Unknown message type:', data.type)
    }
  }

  // Heartbeat monitoring
  const startHeartbeatMonitoring = (): void => {
    lastHeartbeat = Date.now()

    heartbeatTimer = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat

      if (timeSinceLastHeartbeat > config.heartbeatTimeout) {
        console.warn('[SSE] ⚠️ Heartbeat timeout, reconnecting...')

        if (config.reconnectOnError && canReconnect.value) {
          scheduleReconnect()
        }
      }
    }, config.heartbeatTimeout / 2) // Check every 30 seconds
  }

  const stopHeartbeatMonitoring = (): void => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // Reconnection logic
  const scheduleReconnect = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    const delay = config.reconnectDelay * Math.pow(2, connectionState.value.reconnectAttempts)
    console.log(`[SSE] Scheduling reconnection in ${delay}ms (attempt ${connectionState.value.reconnectAttempts + 1}/${config.maxReconnectAttempts})`)

    reconnectTimer = setTimeout(() => {
      if (canReconnect.value) {
        reconnect()
      } else {
        console.error('[SSE] Max reconnection attempts reached, giving up')
        updateConnectionState({
          status: 'error',
          error: 'Max reconnection attempts reached'
        })
      }
    }, delay)
  }

  // Utility functions
  const updateConnectionState = (updates: Partial<SSEConnectionState>): void => {
    connectionState.value = {
      ...connectionState.value,
      ...updates
    }
  }

  const cleanupConnection = (): void => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    stopHeartbeatMonitoring()
  }

  const clearMessages = (): void => {
    messages.value = []
  }

  const clearNewMessageCount = (): void => {
    newlyArrivedMessages.value = []
    console.log('[SSE] 🔄 New message count cleared')
  }

  const addMessage = (message: Message): void => {
    // Add message if it doesn't already exist
    const exists = messages.value.some(existing => existing.id === message.id)
    if (!exists) {
      messages.value.push(message)
    }
  }

  // Message utilities
  const getMessageById = (messageId: string): Message | undefined => {
    return messages.value.find(msg => msg.id === messageId)
  }

  const getMessagesByType = (messageType: string): Message[] => {
    return messages.value.filter(msg => msg.messageType === messageType)
  }

  const getMessagesBySender = (senderType: 'customer' | 'agent' | 'system'): Message[] => {
    return messages.value.filter(msg => msg.senderType === senderType)
  }

  // Watch conversation ID changes
  watch(
    conversationId,
    async (newId, oldId) => {
      if (oldId && oldId !== newId) {
        console.log(`[SSE] Conversation changed from ${oldId} to ${newId}`)
        disconnect()
        clearMessages()
      }

      if (newId && config.autoConnect) {
        console.log(`[SSE] Auto-connecting to new conversation: ${newId}`)
        await connect()
      }
    },
    { immediate: true }
  )

  // Watch auth changes
  watch(
    () => authStore.isAuthenticated,
    (isAuth, wasAuth) => {
      if (!isAuth && wasAuth) {
        // User logged out
        console.log('[SSE] User logged out, disconnecting')
        disconnect()
        clearMessages()
      } else if (isAuth && !wasAuth && conversationId.value && config.autoConnect) {
        // User logged in
        console.log('[SSE] User logged in, auto-connecting')
        connect()
      }
    }
  )

  // Cleanup on unmount
  onUnmounted(() => {
    console.log('[SSE] Component unmounting, cleaning up')
    disconnect()
  })

  // Return reactive API
  return {
    // State
    messages: readonly(messages),
    connectionState: readonly(connectionState),
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    isReconnecting: readonly(isReconnecting),
    hasError: readonly(hasError),
    canReconnect: readonly(canReconnect),

    // Statistics
    messageCount: readonly(messageCount),
    totalMessageCount: readonly(totalMessageCount),
    latestMessage: readonly(latestMessage),
    oldestMessage: readonly(oldestMessage),

    // Methods
    connect,
    disconnect,
    reconnect,
    clearMessages,
    clearNewMessageCount,
    addMessage,

    // Utilities
    getMessageById,
    getMessagesByType,
    getMessagesBySender
  }
}

// Helper function to make refs readonly
function readonly<T>(ref: Ref<T>): Readonly<Ref<T>> {
  return ref as Readonly<Ref<T>>
}