// 現代化對話管理 Composable
import { computed, ref } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { useAsyncData } from './useAsyncData'
import { useError } from './useError'
import type { Conversation } from '@/types'

export function useConversations() {
  const conversationsStore = useConversationsStore()
  const { error, handleError, clearError } = useError()
  
  // 狀態
  const selectedConversationId = ref<string | null>(null)

  // 異步數據 - 設置 immediate: false 避免自動觸發
  const {
    data: conversations,
    pending: loading,
    execute: fetchConversations,
    refresh: refreshConversations
  } = useAsyncData(
    'conversations',
    () => conversationsStore.fetchConversations(),
    {
      immediate: false,  // 改為 false，避免自動觸發造成循環
      transform: () => conversationsStore.conversations
    }
  )

  // 計算屬性
  const selectedConversation = computed(() => {
    if (!selectedConversationId.value) {return null}
    return conversations.value?.find((c: Conversation) => c.id === selectedConversationId.value) || null
  })

  const openConversations = computed(() => 
    conversations.value?.filter((c: Conversation) => c.status === 'open') || []
  )

  const assignedConversations = computed(() => 
    conversations.value?.filter((c: Conversation) => c.status === 'assigned') || []
  )

  const closedConversations = computed(() => 
    conversations.value?.filter((c: Conversation) => c.status === 'closed') || []
  )

  const unreadCount = computed(() => 
    conversations.value?.reduce((sum: number, c: Conversation) => sum + (c.unreadCount || 0), 0) || 0
  )

  // 方法
  const selectConversation = (conversationId: string) => {
    selectedConversationId.value = conversationId
  }

  const assignConversation = async (conversationId: string, agentId?: string) => {
    clearError()
    try {
      if (!agentId) {
        throw new Error('Agent ID is required')
      }
      await conversationsStore.assignConversation(conversationId, agentId)
      await refreshConversations()
    } catch (err) {
      handleError(err)
    }
  }

  const closeConversation = async (conversationId: string) => {
    clearError()
    try {
      await conversationsStore.closeConversation(conversationId)
      await refreshConversations()
    } catch (err) {
      handleError(err)
    }
  }

  const getConversationById = (id: string) => {
    return conversations.value?.find((c: Conversation) => c.id === id) || null
  }

  const filterConversations = (filters: {
    status?: string
    platform?: string
    assignedTo?: string
    search?: string
  }) => {
    if (!conversations.value) {return []}
    
    return conversations.value.filter((conversation: Conversation) => {
      if (filters.status && conversation.status !== filters.status) {return false}
      if (filters.platform && conversation.platform !== filters.platform) {return false}
      if (filters.assignedTo && conversation.assignedAgentId !== filters.assignedTo) {return false}
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const userName = conversation.customer?.name?.toLowerCase() || ''
        const lastMessage = conversation.lastMessage?.content?.toLowerCase() || ''
        if (!userName.includes(searchLower) && !lastMessage.includes(searchLower)) {
          return false
        }
      }
      return true
    })
  }

  return {
    // 數據
    conversations,
    selectedConversation,
    openConversations,
    assignedConversations,
    closedConversations,
    unreadCount,
    loading,
    error,

    // 方法
    fetchConversations,
    refreshConversations,
    selectConversation,
    assignConversation,
    closeConversation,
    getConversationById,
    filterConversations,
    clearError
  }
}