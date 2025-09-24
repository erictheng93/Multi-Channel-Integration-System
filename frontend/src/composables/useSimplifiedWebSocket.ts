// Simplified WebSocket Composable - Reduces Vue integration complexity
// Project: Multi-Channel Support MVP

import { ref, onUnmounted, type Ref } from 'vue'
import { SimplifiedWebSocketClient, type WebSocketMessage, type ConnectionState } from '@/services/websocketClientSimplified'

export interface UseWebSocketOptions {
  url?: string
  conversationId?: string
  autoConnect?: boolean
}

export interface UseWebSocketReturn {
  // State (simplified to essentials)
  connectionState: Ref<ConnectionState>
  isConnected: Ref<boolean>
  lastError: Ref<Error | null>

  // Methods (simplified interface)
  connect: () => Promise<boolean>
  disconnect: () => void
  sendMessage: (_type: string, _data?: unknown) => boolean

  // Event handlers (simplified)
  onMessage: (_handler: (_message: WebSocketMessage) => void) => void
  onError: (_handler: (_error: Error) => void) => void
}

/**
 * Simplified WebSocket composable that reduces complexity while maintaining functionality
 * Eliminates complex state management and provides clean Vue integration
 */
export function useSimplifiedWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const client = new SimplifiedWebSocketClient({
    url: options.url,
    conversationId: options.conversationId,
    autoReconnect: true,
    maxReconnectAttempts: 5
  })

  // Reactive state (only essential properties)
  const connectionState = client.connectionState
  const isConnected = ref(false)
  const lastError = client.lastError

  // Update isConnected based on connectionState
  client.setEventHandlers({
    onStateChange: (state) => {
      isConnected.value = state === 'connected'
    }
  })

  // Simplified methods
  const connect = async (): Promise<boolean> => {
    return await client.connect()
  }

  const disconnect = (): void => {
    client.disconnect()
  }

  const sendMessage = (type: string, data?: unknown): boolean => {
    return client.send({ type, data })
  }

  // Simplified event handlers
  const onMessage = (handler: (_message: WebSocketMessage) => void): void => {
    client.setEventHandlers({
      ...client['handlers'], // Access existing handlers
      onMessage: handler
    })
  }

  const onError = (handler: (_error: Error) => void): void => {
    client.setEventHandlers({
      ...client['handlers'], // Access existing handlers
      onError: handler
    })
  }

  // Auto-connect if requested
  if (options.autoConnect) {
    connect()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    client.destroy()
  })

  return {
    connectionState,
    isConnected,
    lastError,
    connect,
    disconnect,
    sendMessage,
    onMessage,
    onError
  }
}

/**
 * Simplified conversation-specific WebSocket hook
 * Provides ready-to-use methods for conversation interactions
 */
export function useConversationWebSocket(conversationId: string) {
  const ws = useSimplifiedWebSocket({
    conversationId,
    autoConnect: true
  })

  // Conversation-specific message helpers
  const sendChatMessage = (content: string, messageType: string = 'text'): boolean => {
    return ws.sendMessage('message', {
      content,
      messageType,
      conversationId
    })
  }

  const sendTypingIndicator = (isTyping: boolean): boolean => {
    return ws.sendMessage(isTyping ? 'typing_start' : 'typing_stop', {
      conversationId
    })
  }

  const sendReadReceipt = (messageId: string): boolean => {
    return ws.sendMessage('message_read', {
      messageId,
      conversationId
    })
  }

  return {
    ...ws,
    sendChatMessage,
    sendTypingIndicator,
    sendReadReceipt
  }
}

/**
 * Simplified presence tracking hook
 * Provides user presence status with minimal complexity
 */
export function usePresenceWebSocket() {
  const ws = useSimplifiedWebSocket({
    autoConnect: true
  })

  const updatePresence = (status: 'online' | 'away' | 'offline'): boolean => {
    return ws.sendMessage('presence_update', { status })
  }

  const setAgentStatus = (status: 'available' | 'busy' | 'offline'): boolean => {
    return ws.sendMessage('agent_status', { status })
  }

  return {
    ...ws,
    updatePresence,
    setAgentStatus
  }
}