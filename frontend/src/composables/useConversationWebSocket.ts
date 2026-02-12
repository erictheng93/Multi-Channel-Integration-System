// Conversation-Specific WebSocket Composable
// Project: Multi-Channel Support MVP
// Created by: WebSocket Migration Developer
// Phase B5: Migrated to Global WebSocket Store Architecture

import { ref, computed, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'
import { useWebSocketStore, type SubscriptionId } from '@/stores/websocket'
import type { WebSocketMessage } from '@/services/websocketClient'
import { useMessages } from './useMessages'
import { useConversationsStore } from '@/stores/conversations'
import { useAuthStore } from '@/stores/auth'
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

  // Core composables - Phase B5: Using Global WebSocket Store
  const wsStore = useWebSocketStore()
  const authStore = useAuthStore()

  const messagesComposable = useMessages(conversationIdRef.value, {
    enablePagination: true,
    pageSize: 30
  })

  const conversationsStore = useConversationsStore()

  // Phase B5: Subscription tracking
  let conversationSubscriptionId: SubscriptionId | null = null

  // Local state
  const isJoined = ref(false)
  const newMessagesCount = ref(0)
  const lastSeenMessage: Ref<Message | null> = ref(null)
  const isTypingLocally = ref(false)
  const typingTimeout: Ref<NodeJS.Timeout | null> = ref(null)
  const messageQueue: Ref<Message[]> = ref([])

  // Phase B5: Presence tracking (replacing old webSocket.onlineUsers)
  const typingUsers = ref<string[]>([])
  const activeUsers = ref<string[]>([])

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

    // Phase B5: Using local presence tracking
    return {
      activeUsers: activeUsers.value,
      typingUsers: typingUsers.value,
      isUserTyping: typingUsers.value.length > 0
    }
  })

  const hasNewMessages = computed(() => newMessagesCount.value > 0)

  const conversationStats = computed(() => {
    const conversationId = currentConversationId.value
    if (!conversationId || !wsStore.isConnected) {
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

  // Phase B5: Message handler for conversation-specific channel
  const handleConversationMessage = (message: WebSocketMessage): void => {
    const conversationId = currentConversationId.value
    if (!conversationId) {return}

    console.log(`[useConversationWebSocket] Received message:`, message.type)

    switch (message.type) {
      case 'new_message':
        if (message.conversationId === conversationId && message.data) {
          handleNewMessage(conversationId, message.data as Message)
        }
        break

      case 'conversation_updated':
        if (message.conversationId === conversationId && message.data) {
          handleConversationUpdate(conversationId, message.data as Conversation)
        }
        break

      case 'typing_start':
        if (message.conversationId === conversationId && message.userId) {
          handleTypingStart(conversationId, message.userId)
        }
        break

      case 'typing_stop':
        if (message.conversationId === conversationId && message.userId) {
          handleTypingStop(conversationId, message.userId)
        }
        break

      case 'presence_update':
        if (message.conversationId === conversationId && message.data) {
          // Update active users list
          const presenceData = message.data as { activeUsers?: string[] }
          activeUsers.value = presenceData.activeUsers || []
        }
        break

      default:
        console.log(`[useConversationWebSocket] Unhandled message type: ${message.type}`)
    }
  }

  // Methods
  const joinConversation = async (): Promise<void> => {
    const conversationId = currentConversationId.value
    if (!conversationId || !wsStore.isConnected) {
      console.warn('[useConversationWebSocket] Cannot join: no conversation ID or not connected')
      return
    }

    if (isJoined.value) {
      console.log(`[useConversationWebSocket] Already joined to conversation: ${conversationId}`)
      return
    }

    try {
      // Phase B5: Subscribe to conversation-specific channel
      const channel = `conversation:${conversationId}`
      conversationSubscriptionId = wsStore.subscribe(channel, handleConversationMessage)

      console.log(`[useConversationWebSocket] Subscribed to channel: ${channel} (ID: ${conversationSubscriptionId})`)

      // Send join message to backend
      wsStore.send({
        type: 'conversation_join',
        conversationId,
        userId: authStore.currentAgent?.id,
        data: {
          agentId: authStore.currentAgent?.id
        }
      })

      isJoined.value = true
      newMessagesCount.value = 0

      console.log(`[useConversationWebSocket] Joined conversation: ${conversationId}`)

      // Load initial messages if not already loaded
      if (messagesComposable.messages.value.length === 0) {
        await messagesComposable.fetchMessages()
      }

      // Send presence update
      wsStore.send({
        type: 'presence_update',
        conversationId,
        userId: authStore.currentAgent?.id,
        data: {
          status: 'online',
          agentId: authStore.currentAgent?.id
        }
      })

    } catch (error) {
      console.error('[useConversationWebSocket] Failed to join conversation:', error)
      throw error
    }
  }

  const leaveConversation = (): void => {
    const conversationId = currentConversationId.value
    if (!conversationId) {return}

    // Phase B5: Unsubscribe from conversation channel
    if (conversationSubscriptionId) {
      wsStore.unsubscribe(conversationSubscriptionId)
      console.log(`[useConversationWebSocket] Unsubscribed from conversation: ${conversationId} (ID: ${conversationSubscriptionId})`)
      conversationSubscriptionId = null
    }

    // Send leave message to backend
    wsStore.send({
      type: 'conversation_leave',
      conversationId,
      userId: authStore.currentAgent?.id,
      data: {
        agentId: authStore.currentAgent?.id
      }
    })

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

    if (wsStore.isConnected && isJoined.value) {
      // Phase B5: Send via global WebSocket Store
      try {
        wsStore.send({
          type: 'send_message',
          conversationId,
          data: {
            content,
            messageType,
            agentId: authStore.currentAgent?.id
          }
        })
        console.log('[useConversationWebSocket] Message sent via WebSocket')
        return true
      } catch (error) {
        console.error('[useConversationWebSocket] WebSocket send failed:', error)
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
      // Phase B5: Send via global WebSocket Store
      wsStore.send({
        type: 'typing_start',
        conversationId,
        userId: authStore.currentAgent?.id,
        data: {
          agentId: authStore.currentAgent?.id
        }
      })
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
      // Phase B5: Send via global WebSocket Store
      wsStore.send({
        type: 'typing_stop',
        conversationId,
        userId: authStore.currentAgent?.id,
        data: {
          agentId: authStore.currentAgent?.id
        }
      })
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

    // Phase B5: Update local typing users
    if (!typingUsers.value.includes(userId)) {
      typingUsers.value.push(userId)
    }
  }

  const handleTypingStop = (receivedConversationId: string, userId: string): void => {
    if (receivedConversationId !== currentConversationId.value) {return}
    console.log(`[useConversationWebSocket] User ${userId} stopped typing`)

    // Phase B5: Update local typing users
    const index = typingUsers.value.indexOf(userId)
    if (index > -1) {
      typingUsers.value.splice(index, 1)
    }
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

  // Watch conversation ID changes
  watch(
    currentConversationId,
    async (newId, oldId) => {
      if (oldId && oldId !== newId) {
        // Leave old conversation
        leaveConversation()
      }

      if (newId && autoJoin && wsStore.isConnected) {
        // Join new conversation
        await joinConversation()
      }
    },
    { immediate: false }
  )

  // Watch connection state
  watch(
    () => wsStore.isConnected,
    async (isConnected) => {
      if (isConnected && currentConversationId.value && autoJoin && !isJoined.value) {
        // Auto-join when connection is established
        await joinConversation()
      } else if (!isConnected) {
        // Handle disconnection
        handleConnectionStateChange('disconnected')
      }
    }
  )

  // Lifecycle
  onMounted(async () => {
    console.log('[useConversationWebSocket] Mounted for conversation:', currentConversationId.value)

    // Phase B5: Auto-join if conditions are met
    if (currentConversationId.value && autoJoin && wsStore.isConnected) {
      await joinConversation()
    }
  })

  onUnmounted(() => {
    console.log('[useConversationWebSocket] Unmounting for conversation:', currentConversationId.value)

    // Phase B5: Clean up subscription
    if (currentConversationId.value) {
      leaveConversation()
    }

    stopTyping()

    // Clear local state
    typingUsers.value = []
    activeUsers.value = []
  })

  return {
    // State
    isJoined: readonly(isJoined),
    isTypingLocally: readonly(isTypingLocally),
    hasNewMessages: readonly(hasNewMessages),
    newMessagesCount: readonly(newMessagesCount),
    presence: readonly(presence),
    conversationStats: readonly(conversationStats),

    // Phase B5: Connection state from global WebSocket Store
    isConnected: computed(() => wsStore.isConnected),
    connectionState: computed(() => wsStore.connectionState),
    connectionQuality: computed(() => 'good' as const), // Simplified for Phase B5

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

    // Phase B5: Updated utilities using local state
    getTypingUsers: (conversationId: string) => {
      if (conversationId === currentConversationId.value) {
        return typingUsers.value
      }
      return []
    },
    isUserTyping: (userId: string) => typingUsers.value.includes(userId)
  }
}

// Helper function to make refs readonly
function readonly<T>(ref: Ref<T>): Readonly<Ref<T>> {
  return ref as Readonly<Ref<T>>
}