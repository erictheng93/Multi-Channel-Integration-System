// Core WebSocket Composable
// Project: Multi-Channel Support MVP
// Created by: WebSocket Migration Developer

import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { getWebSocketManager, type WebSocketEventCallbacks } from '@/services/websocketManager'
import { useAuthStore } from '@/stores/auth'
import type { WebSocketConnectionState } from '@/services/websocketClient'

export interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectOnAuth?: boolean
  enableLogging?: boolean
}

export interface WebSocketStats {
  connectedConversations: number
  onlineUsers: number
  totalMessages: number
  uptime: number
  queueSize: number
  connectionState: WebSocketConnectionState
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectOnAuth = true,
    enableLogging = import.meta.env.DEV
  } = options

  const authStore = useAuthStore()
  const manager = getWebSocketManager()

  // State
  const isInitialized = ref(false)
  const connectionAttempts = ref(0)
  const lastConnectionError: Ref<Error | null> = ref(null)

  // Computed properties from manager
  const connectionState = computed(() => manager.connectionState.value)
  const isConnected = computed(() => manager.isConnected.value)
  const connectedConversations = computed(() => manager.connectedConversations.value)
  const onlineUsers = computed(() => manager.onlineUsers.value)
  const typingUsers = computed(() => manager.typingUsers.value)
  const stats = computed(() => manager.stats.value)

  // Connection status helpers
  const isConnecting = computed(() => connectionState.value === 'connecting')
  const isReconnecting = computed(() => connectionState.value === 'reconnecting')
  const isDisconnected = computed(() => connectionState.value === 'disconnected')
  const hasError = computed(() => connectionState.value === 'error')

  // Connection quality indicator
  const connectionQuality = computed(() => {
    if (!isConnected.value) {return 'offline'}
    if (stats.value.queueSize > 10) {return 'poor'}
    if (stats.value.queueSize > 5) {return 'fair'}
    return 'good'
  })

  // Methods
  const connect = async (): Promise<void> => {
    if (!authStore.isAuthenticated) {
      throw new Error('User must be authenticated to connect WebSocket')
    }

    try {
      connectionAttempts.value++
      lastConnectionError.value = null

      if (enableLogging) {
        console.log(`[useWebSocket] Connecting (attempt ${connectionAttempts.value})...`)
      }

      await manager.connect()
      isInitialized.value = true

      if (enableLogging) {
        console.log('[useWebSocket] Connected successfully')
      }
    } catch (error) {
      lastConnectionError.value = error as Error

      if (enableLogging) {
        console.error('[useWebSocket] Connection failed:', error)
      }

      throw error
    }
  }

  const disconnect = (): void => {
    if (enableLogging) {
      console.log('[useWebSocket] Disconnecting...')
    }

    manager.disconnect()
    isInitialized.value = false
  }

  const reconnect = async (): Promise<void> => {
    if (enableLogging) {
      console.log('[useWebSocket] Reconnecting...')
    }

    disconnect()
    await new Promise(resolve => setTimeout(resolve, 1000)) // Brief delay
    await connect()
  }

  // Event handling
  const setEventCallbacks = (callbacks: WebSocketEventCallbacks): void => {
    manager.setEventCallbacks(callbacks)
  }

  const clearEventCallbacks = (): void => {
    manager.clearEventCallbacks()
  }

  // Conversation management
  const joinConversation = (conversationId: string): void => {
    if (!isConnected.value) {
      console.warn('[useWebSocket] Cannot join conversation: not connected')
      return
    }

    manager.joinConversation(conversationId)
  }

  const leaveConversation = (conversationId: string): void => {
    manager.leaveConversation(conversationId)
  }

  const isJoinedToConversation = (conversationId: string): boolean => {
    return manager.isJoinedToConversation(conversationId)
  }

  // Messaging
  const sendMessage = (conversationId: string, content: string, messageType = 'text'): boolean => {
    if (!isConnected.value) {
      console.warn('[useWebSocket] Cannot send message: not connected')
      return false
    }

    return manager.sendMessage(conversationId, content, messageType)
  }

  // Typing indicators
  const startTyping = (conversationId: string): void => {
    if (isConnected.value) {
      manager.startTyping(conversationId)
    }
  }

  const stopTyping = (conversationId: string): void => {
    if (isConnected.value) {
      manager.stopTyping(conversationId)
    }
  }

  const getTypingUsers = (conversationId: string): string[] => {
    return manager.getTypingUsers(conversationId)
  }

  const isUserTyping = (conversationId: string, userId: string): boolean => {
    return manager.isUserTyping(conversationId, userId)
  }

  // Presence
  const updatePresence = (status: 'online' | 'away' | 'busy', conversationId?: string): void => {
    if (isConnected.value) {
      manager.updatePresence(status, conversationId)
    }
  }

  const getUserPresence = (userId: string) => {
    return manager.getUserPresence(userId)
  }

  // Auto-connection logic
  const handleAutoConnect = async (): Promise<void> => {
    if (!autoConnect || !authStore.isAuthenticated) {return}

    try {
      await connect()
    } catch (error) {
      console.error('[useWebSocket] Auto-connect failed:', error)
    }
  }

  // Watch for authentication changes
  if (reconnectOnAuth) {
    watch(
      () => authStore.isAuthenticated,
      async (isAuth, wasAuth) => {
        if (isAuth && !wasAuth) {
          // User just logged in
          await handleAutoConnect()
        } else if (!isAuth && wasAuth) {
          // User logged out
          disconnect()
        }
      },
      { immediate: false }
    )
  }

  // Lifecycle
  onMounted(async () => {
    if (enableLogging) {
      console.log('[useWebSocket] Composable mounted')
    }

    await handleAutoConnect()
  })

  onUnmounted(() => {
    if (enableLogging) {
      console.log('[useWebSocket] Composable unmounted')
    }

    // Don't disconnect the global manager on component unmount
    // Just clear our event callbacks
    clearEventCallbacks()
  })

  // Return reactive API
  return {
    // State
    connectionState: readonly(connectionState),
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    isReconnecting: readonly(isReconnecting),
    isDisconnected: readonly(isDisconnected),
    hasError: readonly(hasError),
    connectionQuality: readonly(connectionQuality),
    isInitialized: readonly(isInitialized),
    connectionAttempts: readonly(connectionAttempts),
    lastConnectionError: readonly(lastConnectionError),

    // Data
    connectedConversations: readonly(connectedConversations),
    onlineUsers: readonly(onlineUsers),
    typingUsers: readonly(typingUsers),
    stats: readonly(stats),

    // Connection methods
    connect,
    disconnect,
    reconnect,

    // Event handling
    setEventCallbacks,
    clearEventCallbacks,

    // Conversation management
    joinConversation,
    leaveConversation,
    isJoinedToConversation,

    // Messaging
    sendMessage,

    // Typing indicators
    startTyping,
    stopTyping,
    getTypingUsers,
    isUserTyping,

    // Presence
    updatePresence,
    getUserPresence
  }
}

// Helper function to make refs readonly
function readonly<T>(ref: Ref<T>): Readonly<Ref<T>> {
  return ref as Readonly<Ref<T>>
}