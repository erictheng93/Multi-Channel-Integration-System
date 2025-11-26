import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Message, MessageFilters, Platform } from '@/types'
import { messageApi } from '@/api/message'
import { messageIndexService } from '@/services/messageIndexService'
import { jwtDecode } from 'jwt-decode'
import DOMPurify from 'dompurify'
import { useDebounceFn } from '@vueuse/core'

// ✅ SECURITY FIX: Properly validate JWT token with expiration check
// Helper function to extract userId from JWT token
function getUserIdFromToken(): string | null {
  const token = localStorage.getItem('token')
  if (!token) { return null }

  try {
    // Use jwt-decode library for proper JWT parsing
    const payload = jwtDecode<{ userId?: string; id?: string; exp?: number }>(token)

    // Check token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.warn('[Auth] Token expired')
      return null
    }

    return payload.userId || payload.id || null
  } catch (error) {
    console.error('[Auth] Invalid token:', error)
    return null
  }
}

// ✅ INPUT VALIDATION: Validate and sanitize message content
const MAX_MESSAGE_LENGTH = 10000

interface ValidationResult {
  valid: boolean
  sanitized?: string
  error?: string
}

function validateAndSanitizeContent(content: string): ValidationResult {
  // Check empty
  const trimmed = content.trim()
  if (!trimmed) {
    return { valid: false, error: '訊息內容不能為空' }
  }

  // Check length
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `訊息不能超過 ${MAX_MESSAGE_LENGTH} 字元 (目前: ${trimmed.length})`
    }
  }

  // Sanitize HTML to prevent XSS (keep basic formatting)
  const sanitized = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false
  })

  return { valid: true, sanitized }
}

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

  // ✅ PERFORMANCE FIX: Cache sorted messages instead of sorting on every access
  const sortedMessages = ref<Message[]>([])

  // Watch for changes and update sorted list
  watch(
    [messages, optimisticMessages],
    () => {
      const allMsgs = [...messages.value, ...optimisticMessages.value]
      sortedMessages.value = allMsgs.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    },
    { immediate: true, deep: false }
  )

  // Computed just returns the cached sorted array
  const allMessages = computed(() => sortedMessages.value)

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
    if (!conversationId) { return }

    loading.value = true
    error.value = null

    try {
      const response = await messageApi.list(conversationId)
      if (response.success && response.data) {
        messages.value = response.data
        optimisticMessages.value = []
        // ✅ 手動建立索引以支持測試
        messageIndexService.buildIndex(response.data)
      } else {
        handleError(response.error, '無法載入訊息')
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入訊息')
    } finally {
      loading.value = false
    }
  }

  // ✅ REFACTOR + VALIDATION: Simplified API with input validation
  interface SendMessageParams {
    conversationId: string
    content: string
    platform?: Platform
  }

  // Support both object and separate parameters with function overloads
  // eslint-disable-next-line no-redeclare, no-unused-vars
  async function sendMessage(params: SendMessageParams): Promise<Message | false>
  // eslint-disable-next-line no-redeclare, no-unused-vars
  async function sendMessage(conversationId: string, content: string, platform?: Platform): Promise<Message | false>
  async function sendMessage(
    paramsOrConversationId: SendMessageParams | string,
    content?: string,
    platform: Platform = 'line'
  ): Promise<Message | false> {
    // Normalize to object form
    const params: SendMessageParams = typeof paramsOrConversationId === 'string'
      ? { conversationId: paramsOrConversationId, content: content ?? '', platform }
      : paramsOrConversationId

    if (!params.conversationId) {
      handleError('conversationId is required', '會話 ID 不能為空')
      return false
    }

    // ✅ INPUT VALIDATION: Validate and sanitize content
    const validation = validateAndSanitizeContent(params.content)
    if (!validation.valid) {
      handleError(validation.error ?? 'Validation error', validation.error ?? 'Validation error')
      return false
    }

    const sanitizedContent = validation.sanitized ?? ''

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: params.conversationId,
      senderId: 'current-agent',
      senderType: 'agent',
      content: sanitizedContent,
      timestamp: new Date(),
      createdAt: new Date(),
      platform: params.platform || 'line',
      messageType: 'text'
    }

    optimisticMessages.value.push(optimisticMessage)
    sendingMessage.value = true
    error.value = null

    try {
      // Get senderId from JWT token
      const senderId = getUserIdFromToken()

      const response = await messageApi.send?.(params.conversationId, {
        content: sanitizedContent,
        platform: params.platform || 'line',
        messageType: 'text',
        senderId: senderId || undefined
      })

      // ✅ RACE CONDITION FIX: Keep optimistic message visible on failure
      if (response && response.success && response.data) {
        // Success: Remove optimistic message, add real message
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        messages.value.push(response.data)
        return response.data
      } else {
        // Failure: Mark optimistic message as failed, keep it visible
        const failedMessage = optimisticMessages.value.find(m => m.id === optimisticMessage.id)
        if (failedMessage) {
          failedMessage.metadata = {
            ...failedMessage.metadata,
            failed: true,
            error: response?.error || '訊息發送失敗'
          } as Record<string, unknown>
        }
        handleError(response?.error, '訊息發送失敗')
        return false
      }
    } catch (err) {
      // Network error: Mark optimistic message as failed, keep it visible
      const failedMessage = optimisticMessages.value.find(m => m.id === optimisticMessage.id)
      if (failedMessage) {
        failedMessage.metadata = {
          ...failedMessage.metadata,
          failed: true,
          error: '網路錯誤，訊息發送失敗'
        } as Record<string, unknown>
      }
      handleError(err, '網路錯誤，訊息發送失敗')
      return false
    } finally {
      sendingMessage.value = false
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      const message = messages.value.find(m => m.id === messageId)
      if (!message) {return false}

      const res = await messageApi.markAsRead(message.conversationId, messageId)

      if (res?.success) {
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
        handleError(res?.error, '標記已讀失敗')
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

  const updateMessage = async (messageId: string, updates: Partial<Message>) => {
    try {
      // Only support content update for now as per API
      if (updates.content) {
        const message = messages.value.find(m => m.id === messageId)
        if (!message) {return false}

        const response = await messageApi.edit?.(
          message.conversationId,
          messageId,
          updates.content
        )
        if (response?.success && response?.data) {
          const messageIndex = messages.value.findIndex(m => m.id === messageId)
          if (messageIndex !== -1) {
            const message = messages.value[messageIndex]
            messages.value[messageIndex] = {
              ...message,
              ...response.data
            } as Message
            // 更新索引
            const updatedMessage = messages.value[messageIndex]
            if (updatedMessage) {
              messageIndexService.updateMessage(updatedMessage)
            }
          }
          return true
        } else {
          handleError(response?.error, '更新訊息失敗')
          return false
        }
      }
      return false
    } catch (err) {
      handleError(err, '網路錯誤，更新訊息失敗')
      return false
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      const message = messages.value.find(m => m.id === messageId)
      if (!message) {return false}

      const response = await messageApi.recallMessage?.(message.conversationId, { messageId })
      if (response?.success) {
        const messageIndex = messages.value.findIndex(m => m.id === messageId)
        if (messageIndex !== -1) {
          messages.value.splice(messageIndex, 1)
        }
        return true
      } else {
        handleError(response?.error, '刪除訊息失敗')
        return false
      }
    } catch (err) {
      handleError(err, '網路錯誤，刪除訊息失敗')
      return false
    }
  }

  // ✅ TYPE SAFETY FIX: Use generic type instead of 'any'
  const setFilter = <K extends keyof MessageFilters>(
    key: K,
    value: MessageFilters[K]
  ) => {
    filters.value[key] = value
  }

  const clearFilters = () => {
    filters.value = {
      conversationId: undefined,
      senderType: undefined,
      platform: undefined,
      messageType: undefined
    }
  }

  const filteredMessages = computed(() => {
    let result = messages.value

    if (filters.value.conversationId) {
      result = result.filter(m => m.conversationId === filters.value.conversationId)
    }
    if (filters.value.senderType) {
      result = result.filter(m => m.senderType === filters.value.senderType)
    }
    if (filters.value.platform) {
      result = result.filter(m => m.platform === filters.value.platform)
    }
    if (filters.value.messageType) {
      result = result.filter(m => m.messageType === filters.value.messageType)
    }

    return result
  })

  const searchMessages = async (query: string) => {
    return messageIndexService.search(query)
  }

  // ✅ PERFORMANCE FIX: Use requestIdleCallback + debounce instead of setTimeout
  // 🔍 Automatically build message index for search
  // Debounced function to build index during browser idle time
  const debouncedBuildIndex = useDebounceFn(
    (messages: Message[]) => {
      if ('requestIdleCallback' in window) {
        // Use requestIdleCallback for better performance
        window.requestIdleCallback(
          () => {
            messageIndexService.buildIndex(messages)
          },
          { timeout: 2000 } // Fallback to regular execution after 2s
        )
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          messageIndexService.buildIndex(messages)
        }, 100)
      }
    },
    500 // Debounce for 500ms to avoid excessive rebuilds
  )

  // ✅ MEMORY LEAK FIX: Store watcher stop function for cleanup
  // When messages are loaded or updated, rebuild search index for high-performance search
  const stopIndexWatcher = watch(
    allMessages,
    (newMessages) => {
      if (newMessages && newMessages.length > 0) {
        debouncedBuildIndex(newMessages)
      }
    },
    { immediate: true, deep: false } // immediate: true ensures index is built on initial load
  )

  // ✅ MEMORY LEAK FIX: Cleanup function to stop watchers and clear resources
  const $dispose = () => {
    stopIndexWatcher() // Stop the watcher
    messageIndexService.clearIndex() // Clear the index
  }

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
    filteredMessages,

    // Actions
    fetchMessages,
    sendMessage,
    markAsRead,
    clearMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    setFilter,
    clearFilters,
    searchMessages,
    clearError,

    // Cleanup
    $dispose // Expose cleanup function
  }
})