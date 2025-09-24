// Conversation-Specific WebSocket Composable
// Project: Multi-Channel Support MVP
// Created by: WebSocket Migration Developer

import { ref, computed, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'
import { useWebSocket } from './useWebSocket'
import { useMessages } from './useMessages'
import { useConversationsStore } from '@/stores/conversations'
import type { Message, Conversation } from '@/types'

export interface UseConversationWebSocketOptions {
  autoJoin?: boolean
  enableTypingIndicators?: boolean
  enableMessageQueue?: boolean
  typingDebounceMs?: number
}

export interface ConversationPresence {
  activeUsers: string[]
  typingUsers: string[]
  isUserTyping: boolean
}

export function useConversationWebSocket(
  conversationId: Ref<string | undefined> | string,
  options: UseConversationWebSocketOptions = {}
) {
  const {
    autoJoin = true,
    enableTypingIndicators = true,
    enableMessageQueue = true,
    typingDebounceMs = 1000
  } = options

  // Normalize conversationId to ref
  const conversationIdRef = typeof conversationId === 'string'
    ? ref(conversationId)
    : conversationId

  // Core composables
  const webSocket = useWebSocket({
    autoConnect: true,
    reconnectOnAuth: true
  })

  const messagesComposable = useMessages(conversationIdRef.value, {
    enablePagination: true,
    pageSize: 30
  })

  const conversationsStore = useConversationsStore()

  // Local state
  const isJoined = ref(false)
  const newMessagesCount = ref(0)
  const lastSeenMessage: Ref<Message | null> = ref(null)
  const isTypingLocally = ref(false)
  const typingTimeout: Ref<NodeJS.Timeout | null> = ref(null)
  const messageQueue: Ref<Message[]> = ref([])

  // Computed properties
  const currentConversationId = computed(() => conversationIdRef.value)

  const presence = computed((): ConversationPresence => {
    const conversationId = currentConversationId.value
    if (!conversationId) {
      return {
        activeUsers: [],
        typingUsers: [],
        isUserTyping: false
      }
    }

    return {
      activeUsers: webSocket.onlineUsers.value,
      typingUsers: webSocket.getTypingUsers(conversationId),
      isUserTyping: webSocket.getTypingUsers(conversationId).length > 0
    }
  })

  const hasNewMessages = computed(() => newMessagesCount.value > 0)

  const conversationStats = computed(() => {
    const conversationId = currentConversationId.value
    if (!conversationId || !webSocket.isConnected.value) {
      return null
    }

    return {
      isJoined: isJoined.value,
      newMessages: newMessagesCount.value,
      queuedMessages: messageQueue.value.length,
      typingUsers: presence.value.typingUsers.length,
      activeUsers: presence.value.activeUsers.length
    }
  })

  // Methods
  const joinConversation = async (): Promise<void> => {
    const conversationId = currentConversationId.value
    if (!conversationId || !webSocket.isConnected.value) {
      console.warn('[useConversationWebSocket] Cannot join: no conversation ID or not connected')
      return
    }

    if (isJoined.value) {
      console.log(`[useConversationWebSocket] Already joined to conversation: ${conversationId}`)
      return
    }

    try {
      webSocket.joinConversation(conversationId)
      isJoined.value = true
      newMessagesCount.value = 0

      console.log(`[useConversationWebSocket] Joined conversation: ${conversationId}`)

      // Load initial messages if not already loaded
      if (messagesComposable.messages.value.length === 0) {
        await messagesComposable.fetchMessages()
      }

      // Mark as current conversation for presence
      webSocket.updatePresence('online', conversationId)

    } catch (error) {
      console.error('[useConversationWebSocket] Failed to join conversation:', error)
      throw error
    }
  }

  const leaveConversation = (): void => {
    const conversationId = currentConversationId.value
    if (!conversationId) {return}

    webSocket.leaveConversation(conversationId)
    isJoined.value = false
    stopTyping()

    console.log(`[useConversationWebSocket] Left conversation: ${conversationId}`)
  }

  const sendMessage = async (content: string, messageType = 'text'): Promise<boolean> => {
    const conversationId = currentConversationId.value
    if (!conversationId) {
      console.warn('[useConversationWebSocket] Cannot send message: no conversation ID')
      return false
    }

    // Stop typing when sending message
    stopTyping()

    if (webSocket.isConnected.value && isJoined.value) {
      // Send via WebSocket
      const success = webSocket.sendMessage(conversationId, content, messageType)
      if (success) {
        console.log('[useConversationWebSocket] Message sent via WebSocket')
        return true
      }
    }

    // Fallback to HTTP API
    if (enableMessageQueue) {
      try {
        const success = await messagesComposable.sendMessage(content)
        if (success) {
          console.log('[useConversationWebSocket] Message sent via HTTP fallback')
          return true
        }
      } catch (error) {
        console.error('[useConversationWebSocket] Failed to send message via HTTP:', error)
      }
    }

    return false
  }

  const startTyping = (): void => {
    if (!enableTypingIndicators || !isJoined.value) {return}

    const conversationId = currentConversationId.value
    if (!conversationId) {return}

    // Clear existing timeout
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }

    // Send typing start if not already typing
    if (!isTypingLocally.value) {
      webSocket.startTyping(conversationId)
      isTypingLocally.value = true
    }

    // Auto-stop typing after delay
    typingTimeout.value = setTimeout(() => {
      stopTyping()
    }, typingDebounceMs)
  }

  const stopTyping = (): void => {
    if (!enableTypingIndicators) {return}

    const conversationId = currentConversationId.value
    if (!conversationId) {return}

    // Clear timeout
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }

    // Send typing stop if currently typing
    if (isTypingLocally.value) {
      webSocket.stopTyping(conversationId)
      isTypingLocally.value = false
    }
  }

  const markAsRead = (): void => {
    newMessagesCount.value = 0
    const latestMessage = messagesComposable.latestMessage.value
    if (latestMessage) {
      lastSeenMessage.value = latestMessage
    }
  }

  const refreshMessages = async (): Promise<void> => {
    try {
      await messagesComposable.refreshMessages()
    } catch (error) {
      console.error('[useConversationWebSocket] Failed to refresh messages:', error)
    }
  }

  const loadMoreMessages = async (): Promise<boolean> => {
    try {
      return await messagesComposable.loadMoreMessages()
    } catch (error) {
      console.error('[useConversationWebSocket] Failed to load more messages:', error)
      return false
    }
  }

  // Event handlers
  const handleNewMessage = (receivedConversationId: string, message: Message): void => {
    if (receivedConversationId !== currentConversationId.value) {return}

    console.log(`[useConversationWebSocket] New message received: ${message.content?.substring(0, 50)}...`)

    // Add to messages (this will trigger reactivity)
    const currentMessages = messagesComposable.messages.value
    const messageExists = currentMessages.some(m => m.id === message.id)

    if (!messageExists) {
      // Update messages store/composable
      messagesComposable.messages.value.push(message)

      // Update new message counter
      newMessagesCount.value++
    }
  }

  const handleConversationUpdate = (receivedConversationId: string, conversation: Conversation): void => {
    if (receivedConversationId !== currentConversationId.value) {return}

    console.log(`[useConversationWebSocket] Conversation updated: ${conversation.id}`)

    // Update conversation in store
    conversationsStore.updateConversationInList(conversation)
  }

  const handleTypingStart = (receivedConversationId: string, userId: string): void => {
    if (receivedConversationId !== currentConversationId.value) {return}
    console.log(`[useConversationWebSocket] User ${userId} started typing`)
  }

  const handleTypingStop = (receivedConversationId: string, userId: string): void => {
    if (receivedConversationId !== currentConversationId.value) {return}
    console.log(`[useConversationWebSocket] User ${userId} stopped typing`)
  }

  const handleConnectionStateChange = (state: string): void => {
    console.log(`[useConversationWebSocket] Connection state: ${state}`)

    if (state === 'connected' && currentConversationId.value && autoJoin) {
      // Rejoin conversation on reconnection
      nextTick(() => {
        joinConversation()
      })
    } else if (state === 'disconnected' || state === 'error') {
      isJoined.value = false
      stopTyping()
    }
  }

  // Setup event callbacks
  const setupEventHandlers = (): void => {
    webSocket.setEventCallbacks({
      onConversationMessage: handleNewMessage,
      onConversationUpdate: handleConversationUpdate,
      onTypingStart: handleTypingStart,
      onTypingStop: handleTypingStop,
      onConnectionStateChange: handleConnectionStateChange,
      onError: (error: Error) => {
        console.error('[useConversationWebSocket] WebSocket error:', error)
      }
    })
  }

  // Watch conversation ID changes
  watch(
    currentConversationId,
    async (newId, oldId) => {
      if (oldId && oldId !== newId) {
        // Leave old conversation
        webSocket.leaveConversation(oldId)
        isJoined.value = false
        stopTyping()
      }

      if (newId && autoJoin && webSocket.isConnected.value) {
        // Join new conversation
        await joinConversation()
      }
    },
    { immediate: false }
  )

  // Watch connection state
  watch(
    () => webSocket.isConnected.value,
    async (isConnected) => {
      if (isConnected && currentConversationId.value && autoJoin && !isJoined.value) {
        // Auto-join when connection is established
        await joinConversation()
      }
    }
  )

  // Lifecycle
  onMounted(async () => {
    console.log('[useConversationWebSocket] Mounted for conversation:', currentConversationId.value)

    setupEventHandlers()

    if (currentConversationId.value && autoJoin && webSocket.isConnected.value) {
      await joinConversation()
    }
  })

  onUnmounted(() => {
    console.log('[useConversationWebSocket] Unmounting for conversation:', currentConversationId.value)

    // Clean up
    if (currentConversationId.value) {
      leaveConversation()
    }

    stopTyping()
    webSocket.clearEventCallbacks()
  })

  return {
    // State
    isJoined: readonly(isJoined),
    isTypingLocally: readonly(isTypingLocally),
    hasNewMessages: readonly(hasNewMessages),
    newMessagesCount: readonly(newMessagesCount),
    presence: readonly(presence),
    conversationStats: readonly(conversationStats),

    // Connection state from WebSocket
    isConnected: webSocket.isConnected,
    connectionState: webSocket.connectionState,
    connectionQuality: webSocket.connectionQuality,

    // Messages from useMessages composable
    messages: messagesComposable.messages,
    oldestMessage: messagesComposable.oldestMessage,
    latestMessage: messagesComposable.latestMessage,
    loading: messagesComposable.loading,
    loadingHistory: messagesComposable.loadingHistory,
    hasMore: messagesComposable.hasMore,
    totalMessages: messagesComposable.totalMessages,

    // Methods
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    refreshMessages,
    loadMoreMessages,

    // Utilities
    getTypingUsers: (conversationId: string) => webSocket.getTypingUsers(conversationId),
    isUserTyping: (userId: string) => webSocket.isUserTyping(currentConversationId.value || '', userId)
  }
}

// Helper function to make refs readonly
function readonly<T>(ref: Ref<T>): Readonly<Ref<T>> {
  return ref as Readonly<Ref<T>>
}