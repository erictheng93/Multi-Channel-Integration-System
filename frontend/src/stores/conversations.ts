import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, ConversationFilters, Message, Platform, PaginatedResponse } from '@/types'
import { conversationApi } from '@/api/conversations'
import { messageApi } from '@/api/message'
import { useAuthStore } from './auth'
import { translateError } from '@/utils/error-handler'

// Interface removed as it's not used

export const useConversationsStore = defineStore('conversations', () => {
  // State
  const conversations = ref<Conversation[]>([])
  const currentConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const messagesLoading = ref(false)
  const sendingMessage = ref(false)
  const optimisticMessages = ref<Message[]>([])

  // Filters and Pagination
  const filters = ref<ConversationFilters>({
    status: undefined,
    platform: undefined,
    assignedTo: undefined
  })
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })

  // Stats
  const stats = ref({
    total: 0,
    open: 0,
    assigned: 0,
    closed: 0,
    unreadCount: 0
  })

  // Computed
  const allMessages = computed(() => {
    // Combine real messages with optimistic messages
    const allMsgs = [...messages.value, ...optimisticMessages.value]
    return allMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  })

  const unreadConversations = computed(() =>
    conversations.value.filter(c => c.unreadCount && c.unreadCount > 0)
  )

  const assignedToMeConversations = computed(() => {
    const authStore = useAuthStore()
    return conversations.value.filter(c => c.assignedAgentId === authStore.currentAgent?.id)
  })

  // Utility functions
  const clearError = () => {
    error.value = null
  }

  const handleError = (err: unknown, defaultMessage: string) => {
    console.error(err)
    // 使用錯誤處理工具來翻譯錯誤訊息
    error.value = translateError(err, defaultMessage)
    setTimeout(clearError, 5000) // Auto clear error after 5 seconds
  }

  const updateConversationInList = (updatedConversation: Conversation) => {
    const index = conversations.value.findIndex(c => c.id === updatedConversation.id)
    if (index !== -1) {
      conversations.value[index] = updatedConversation
    }
  }

  // Enhanced fetch methods with better error handling
  const fetchConversations = async (newFilters?: ConversationFilters, page = 1, append = false) => {
    if (newFilters) {
      filters.value = { ...newFilters }
    }

    loading.value = true
    error.value = null

    try {
      // Clean undefined values for API call
      const cleanFilters: Record<string, unknown> = {}
      if (filters.value.status) {cleanFilters.status = filters.value.status}
      if (filters.value.platform) {cleanFilters.platform = filters.value.platform}
      if (filters.value.assignedTo) {cleanFilters.assignedTo = filters.value.assignedTo}

      const response = await conversationApi.list({
        page,
        pageSize: pagination.value.pageSize,
        ...cleanFilters
      })

      if (response.success && response.data) {
        // Handle both response formats: array directly or paginated object
        let conversationList: Conversation[]
        let paginationData: Omit<PaginatedResponse<unknown>, 'items'>

        if (Array.isArray(response.data)) {
          // Direct array format from backend
          conversationList = response.data as Conversation[]
          paginationData = {
            page: typeof page === 'string' ? parseInt(page) : page,
            pageSize: pagination.value.pageSize,
            total: conversationList.length,
            totalPages: Math.ceil(conversationList.length / pagination.value.pageSize)
          }
        } else {
          // Paginated response format
          const data = response.data as PaginatedResponse<Conversation>
          conversationList = data.items || []
          paginationData = {
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            totalPages: data.totalPages
          }
        }

        if (append) {
          conversations.value = [...conversations.value, ...conversationList]
        } else {
          conversations.value = conversationList
        }

        pagination.value = paginationData
      } else {
        handleError(response.error, '獲取對話列表失敗')

        // Only fallback to mock data if no specific error from API
        if (import.meta.env.DEV && !append && !response.error) {
          const { generateMockConversations } = await import('@/utils/mockData')
          let mockConversations = generateMockConversations(20)

          if (filters.value.status) {
            mockConversations = mockConversations.filter(c => c.status === filters.value.status)
          }
          if (filters.value.platform) {
            mockConversations = mockConversations.filter(c => c.platform === filters.value.platform)
          }

          conversations.value = mockConversations
        }
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入對話列表')

      // Only fallback to mock data in development if not in test environment
      if (import.meta.env.DEV && !append && !import.meta.env.VITEST) {
        try {
          const { generateMockConversations } = await import('@/utils/mockData')
          conversations.value = generateMockConversations(20)
        } catch (mockError) {
          console.error('Failed to load mock data:', mockError)
        }
      }
    } finally {
      loading.value = false
    }
  }

  const fetchConversation = async (id: string) => {
    if (!id) {return}

    // Check if conversation already exists in the list
    const existing = conversations.value.find(c => c.id === id)
    if (existing) {
      currentConversation.value = existing
    }

    loading.value = true
    error.value = null

    try {
      const response = await conversationApi.getConversation(id)
      if (response.success && response.data) {
        currentConversation.value = response.data
        // Update in conversations list if it exists
        updateConversationInList(response.data)
      } else {
        handleError(response.error, '無法載入對話詳情')
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入對話')
    } finally {
      loading.value = false
    }
  }

  const fetchMessages = async (conversationId: string, append = false) => {
    if (!conversationId) {return}

    messagesLoading.value = true
    error.value = null

    try {
      const response = await messageApi.list(conversationId)
      if (response.success && response.data) {
        if (append) {
          messages.value = [...messages.value, ...response.data]
        } else {
          messages.value = response.data
        }
        // Clear optimistic messages after successful fetch
        optimisticMessages.value = []
      } else {
        handleError(response.error, '無法載入訊息')

        // Only fallback to mock data if no specific error from API
        if (import.meta.env.DEV && !append && !response.error && !import.meta.env.VITEST) {
          const { generateMockMessages } = await import('@/utils/mockData')
          messages.value = generateMockMessages(conversationId, 15)
        }
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入訊息')

      // Only fallback to mock data in development if not in test environment
      if (import.meta.env.DEV && !append && !import.meta.env.VITEST) {
        try {
          const { generateMockMessages } = await import('@/utils/mockData')
          messages.value = generateMockMessages(conversationId, 15)
        } catch (mockError) {
          console.error('Failed to load mock messages:', mockError)
        }
      }
    } finally {
      messagesLoading.value = false
    }
  }

  const sendMessage = async (conversationId: string, content: string, platform?: Platform) => {
    if (!conversationId) {
      error.value = '沒有選擇對話'
      return false
    }
    
    if (!content || !content.trim()) {
      return false
    }

    const authStore = useAuthStore()
    if (!authStore.currentAgent) {return false}

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: authStore.currentAgent.id,
      senderType: 'agent',
      content: content.trim(),
      timestamp: new Date(),
      createdAt: new Date(),
      platform: platform || 'line',
      messageType: 'text'
    }

    // Add optimistic message
    optimisticMessages.value.push(optimisticMessage)
    sendingMessage.value = true
    error.value = null

    try {
      const response = await messageApi.send(conversationId, {
        content: content.trim(),
        platform: platform || 'line',
        messageType: 'text'
      })

      if (response.success && response.data) {
        // Remove optimistic message and add real message
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        messages.value.push(response.data)

        // Update conversation's last message
        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value.lastMessage = response.data
          updateConversationInList(currentConversation.value)
        }

        return true
      } else {
        // Remove failed optimistic message
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        handleError(response.error, '訊息發送失敗')
        return false
      }
    } catch (err) {
      // Remove failed optimistic message
      optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
      handleError(err, '網路錯誤，訊息發送失敗')
      return false
    } finally {
      sendingMessage.value = false
    }
  }

  const assignConversation = async (conversationId: string, agentId: string) => {
    if (!conversationId || !agentId) {return false}

    // Optimistic update
    const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
    let originalConversation: Conversation | null = null

    if (conversationIndex !== -1) {
      const current = conversations.value[conversationIndex]
      if (current) {
        originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
        const updatedConversation: Conversation = {
          ...current,
          id: current.id,
          userId: current.userId,
          customer: current.customer,
          assignedTo: agentId,
          status: 'assigned' as const
        }
        conversations.value[conversationIndex] = updatedConversation
      }
    }

    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = {
        ...currentConversation.value,
        assignedAgentId: agentId,
        status: 'assigned' as const
      }
    }

    error.value = null

    try {
      const response = await conversationApi.assignConversation(conversationId, agentId)
      if (response.success) {
        // Refresh the specific conversation to get updated data
        await fetchConversation(conversationId)
        return true
      } else {
        // Revert optimistic update
        if (originalConversation && conversationIndex !== -1) {
          conversations.value[conversationIndex] = originalConversation
        }
        handleError(response.error, '對話指派失敗')
        return false
      }
    } catch (err) {
      // Revert optimistic update
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      handleError(err, '網路錯誤，對話指派失敗')
      return false
    }
  }

  const closeConversation = async (conversationId: string, reason?: string) => {
    if (!conversationId) {return false}

    // Optimistic update
    const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
    let originalConversation: Conversation | null = null

    if (conversationIndex !== -1) {
      const current = conversations.value[conversationIndex]
      if (current) {
        originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
        const updatedConversation: Conversation = {
          ...current,
          id: current.id,
          userId: current.userId,
          customer: current.customer,
          status: 'closed' as const
        }
        conversations.value[conversationIndex] = updatedConversation
      }
    }

    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = {
        ...currentConversation.value,
        status: 'closed' as const
      }
    }

    error.value = null

    try {
      const response = await conversationApi.closeConversation(conversationId, reason)
      if (response.success) {
        return true
      } else {
        // Revert optimistic update
        if (originalConversation && conversationIndex !== -1) {
          conversations.value[conversationIndex] = originalConversation
        }
        handleError(response.error, '對話結束失敗')
        return false
      }
    } catch (err) {
      // Revert optimistic update
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      handleError(err, '網路錯誤，對話結束失敗')
      return false
    }
  }

  const markAsRead = async (conversationId: string) => {
    if (!conversationId) {return false}

    try {
      const response = await conversationApi.markAsRead(conversationId)
      if (response.success) {
        // Update unread count optimistically
        const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
        if (conversationIndex !== -1) {
          const current = conversations.value[conversationIndex]
          if (current) {
            const updatedConversation: Conversation = {
              ...current,
              id: current.id,
              userId: current.userId,
              customer: current.customer,
              unreadCount: 0
            }
            conversations.value[conversationIndex] = updatedConversation
          }
        }

        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value.unreadCount = 0
        }

        return true
      } else {
        handleError(response.error, '標記已讀失敗')
        return false
      }
    } catch (err) {
      handleError(err, '網路錯誤，標記已讀失敗')
      return false
    }
  }

  const loadMore = async () => {
    if (pagination.value.page >= pagination.value.totalPages) {return}
    await fetchConversations(filters.value, pagination.value.page + 1, true)
  }

  const refresh = async () => {
    await fetchConversations(filters.value)
  }

  const clearMessages = () => {
    messages.value = []
    optimisticMessages.value = []
  }

  const setConversations = (newConversations: Conversation[]) => {
    conversations.value = newConversations
  }

  // Add missing methods for tests
  const loadConversations = fetchConversations
  const loadMessages = fetchMessages
  const loadStats = async () => {
    try {
      // Try to load stats from API first
      const response = await conversationApi.getStats?.()
      if (response?.success && response.data) {
        stats.value = response.data
      } else {
        // Fallback to calculating from local conversations
        stats.value = {
          total: conversations.value.length,
          open: conversations.value.filter(c => c.status === 'open').length,
          assigned: conversations.value.filter(c => c.status === 'assigned').length,
          closed: conversations.value.filter(c => c.status === 'closed').length,
          unreadCount: conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        }
      }
    } catch (err) {
      // Fallback to calculating from local conversations
      stats.value = {
        total: conversations.value.length,
        open: conversations.value.filter(c => c.status === 'open').length,
        assigned: conversations.value.filter(c => c.status === 'assigned').length,
        closed: conversations.value.filter(c => c.status === 'closed').length,
        unreadCount: conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
      }
      handleError(err, '統計資料載入失敗')
    }
  }

  return {
    // State
    conversations,
    currentConversation,
    messages,
    loading,
    error,
    messagesLoading,
    sendingMessage,
    optimisticMessages,
    filters,
    pagination,
    stats,

    // Computed
    allMessages,
    unreadConversations,
    assignedToMeConversations,

    // Actions
    fetchConversations,
    fetchConversation,
    fetchMessages,
    sendMessage,
    assignConversation,
    closeConversation,
    markAsRead,
    loadMore,
    refresh,
    clearMessages,
    setConversations,
    clearError,

    // Test compatibility methods
    loadConversations,
    loadMessages,
    loadStats,

    // Utilities
    updateConversationInList
  }
})