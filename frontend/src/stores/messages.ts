import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Message, MessageFilters, Platform } from '@/types'
import { messageApi } from '@/api/message'
import { messageIndexService } from '@/services/messageIndexService'

export const useMessagesStore = defineStore('messages', () => {
  // State
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sendingMessage = ref(false)
  const optimisticMessages = ref<Message[]>([])

  // Filters
  const filters = ref<MessageFilters>({
    conversationId: undefined,
    senderType: undefined,
    platform: undefined,
    messageType: undefined
  })

  // Computed
  const allMessages = computed(() => {
    const allMsgs = [...messages.value, ...optimisticMessages.value]
    return allMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  })

  const unreadMessages = computed(() =>
    messages.value.filter(m => !(m.metadata as Record<string, unknown>)?.isRead)
  )

  const messagesByConversation = computed(() => (conversationId: string) =>
    messages.value.filter(m => m.conversationId === conversationId)
  )

  // Utility functions
  const clearError = () => {
    error.value = null
  }

  const handleError = (err: unknown, defaultMessage: string) => {
    console.error(err)
    error.value = typeof err === 'string' ? err : ((err as Error)?.message || String(err) || defaultMessage)
    setTimeout(clearError, 5000)
  }

  // Actions
  const fetchMessages = async (conversationId: string) => {
    if (!conversationId) {return}

    loading.value = true
    error.value = null

    try {
      const response = await messageApi.list(conversationId)
      if (response.success && response.data) {
        messages.value = response.data
        optimisticMessages.value = []
      } else {
        handleError(response.error, '無法載入訊息')
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入訊息')
    } finally {
      loading.value = false
    }
  }

  const sendMessage = async (conversationId: string, content: string, platform: Platform = 'line') => {
    if (!conversationId || !content?.trim()) {return false}

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: 'current-agent',
      senderType: 'agent',
      content: content.trim(),
      timestamp: new Date(),
      createdAt: new Date(),
      platform,
      messageType: 'text'
    }

    optimisticMessages.value.push(optimisticMessage)
    sendingMessage.value = true
    error.value = null

    try {
      const response = await messageApi.send(conversationId, {
        content: content.trim(),
        platform,
        messageType: 'text'
      })

      if (response.success && response.data) {
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        messages.value.push(response.data)
        return true
      } else {
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        handleError(response.error, '訊息發送失敗')
        return false
      }
    } catch (err) {
      optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
      handleError(err, '網路錯誤，訊息發送失敗')
      return false
    } finally {
      sendingMessage.value = false
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      const response = await messageApi.markAsRead?.(messageId)
      if (response?.success) {
        const messageIndex = messages.value.findIndex(m => m.id === messageId)
        if (messageIndex !== -1) {
          const message = messages.value[messageIndex]
          if (message) {
            messages.value[messageIndex] = {
              ...message,
              metadata: {
                ...message.metadata,
                isRead: true
              } as Record<string, unknown>
            }
          }
        }
        return true
      } else {
        handleError(response?.error, '標記已讀失敗')
        return false
      }
    } catch (err) {
      handleError(err, '網路錯誤，標記已讀失敗')
      return false
    }
  }

  const clearMessages = () => {
    messages.value = []
    optimisticMessages.value = []
  }

  const addMessage = (message: Message) => {
    messages.value.push(message)
  }

  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    const messageIndex = messages.value.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      const message = messages.value[messageIndex]
      messages.value[messageIndex] = {
        ...message,
        ...updates
      } as Message
      // 更新索引
      const updatedMessage = messages.value[messageIndex]
      if (updatedMessage) {
        messageIndexService.updateMessage(updatedMessage)
      }
    }
  }

  // 🔍 自动构建消息索引
  // 当消息加载或更新时，自动重建搜索索引以支持高性能搜索
  watch(
    allMessages,
    (newMessages) => {
      if (newMessages && newMessages.length > 0) {
        // 使用 setTimeout 避免阻塞主线程
        setTimeout(() => {
          messageIndexService.buildIndex(newMessages)
        }, 0)
      }
    },
    { immediate: true, deep: false } // immediate: true 确保初始加载时也构建索引
  )

  return {
    // State
    messages,
    loading,
    error,
    sendingMessage,
    optimisticMessages,
    filters,

    // Computed
    allMessages,
    unreadMessages,
    messagesByConversation,

    // Actions
    fetchMessages,
    sendMessage,
    markAsRead,
    clearMessages,
    addMessage,
    updateMessage,
    clearError
  }
})