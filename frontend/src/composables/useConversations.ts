// 現代化對話管理 Composable
import { computed, ref } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { useAsyncData } from './useAsyncData'
import { useError } from './useError'
import type { Conversation } from '@/types'
import { CONVERSATION_STATUS, isOpenConversation } from '@/constants/conversation-status'

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
    conversations.value?.filter((c: Conversation) => isOpenConversation(c.status)) || []
  )

  const assignedConversations = computed(() =>
    conversations.value?.filter((c: Conversation) => c.status === CONVERSATION_STATUS.IN_PROGRESS) || []
  )

  const unreadCount = computed(() =>
    conversations.value?.reduce((sum: number, c: Conversation) => sum + (c.unreadCount || 0), 0) || 0
  )

  // 方法
  const selectConversation = (conversationId: string) => {
    selectedConversationId.value = conversationId
  }

  /**
   * 指派對話給團隊
   * Note: Individual assignment (agentId) removed - only team-based assignment is supported now
   */
  const assignConversationToTeam = async (conversationId: string, teamId: number, teamName?: string) => {
    clearError()
    try {
      if (!teamId) {
        throw new Error('Team ID is required')
      }
      await conversationsStore.assignConversationToTeam(conversationId, teamId, teamName)
      await refreshConversations()
    } catch (err) {
      handleError(err)
    }
  }

  const getConversationById = (id: string) => {
    return conversations.value?.find((c: Conversation) => c.id === id) || null
  }

  // Note: Individual assignment filter (assignedTo) removed - only team-based filtering is supported now
  const filterConversations = (filters: {
    status?: string
    platform?: string
    teamId?: number
    search?: string
  }) => {
    if (!conversations.value) {return []}

    return conversations.value.filter((conversation: Conversation) => {
      if (filters.status && conversation.status !== filters.status) {return false}
      if (filters.platform && conversation.platform !== filters.platform) {return false}
      if (filters.teamId && conversation.assignedTeamId !== filters.teamId) {return false}
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
    unreadCount,
    loading,
    error,

    // 方法
    fetchConversations,
    refreshConversations,
    selectConversation,
    assignConversationToTeam,
    getConversationById,
    filterConversations,
    clearError
  }
}
