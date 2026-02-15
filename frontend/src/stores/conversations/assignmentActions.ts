import type { Ref } from 'vue'
import type { Conversation } from '@/types'
import { conversationApi } from '@/api/conversations'
import { CONVERSATION_STATUS } from '@/constants/conversation-status'

export interface AssignmentActionsDeps {
  conversations: Ref<Conversation[]>
  currentConversation: Ref<Conversation | null>
  error: Ref<string | null>
  handleError: (_err: unknown, _defaultMessage: string) => void
}

/**
 * Shared optimistic assignment pattern.
 * 1. Find conversation + save snapshot
 * 2. Apply optimistic update to both conversations[] and currentConversation
 * 3. Call API
 * 4. On success: merge API response (or fallback fetch)
 * 5. On failure: rollback snapshot + handleError
 */
async function withOptimisticAssignment(
  deps: AssignmentActionsDeps,
  conversationId: string,
  optimisticUpdates: Partial<Conversation>,
  apiCall: () => Promise<{ success: boolean; data?: Conversation; error?: unknown }>,
  errorMessage: string,
  fallbackFetch?: () => Promise<{ success: boolean; data?: Conversation }>
): Promise<boolean> {
  const { conversations, currentConversation, error, handleError } = deps

  // 1. Find + snapshot
  const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
  let originalConversation: Conversation | null = null

  // 2. Optimistic update on list
  if (conversationIndex !== -1) {
    const current = conversations.value[conversationIndex]
    if (current) {
      originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
      conversations.value[conversationIndex] = {
        ...current,
        ...optimisticUpdates
      } as Conversation
      console.log(`⚡ [ConversationsStore] Optimistic update applied to list`)
    }
  }

  // Optimistic update on currentConversation
  if (currentConversation.value && currentConversation.value.id === conversationId) {
    currentConversation.value = {
      ...currentConversation.value,
      ...optimisticUpdates
    }
    console.log(`⚡ [ConversationsStore] Optimistic update applied to currentConversation`)
  }

  error.value = null

  try {
    // 3. API call
    const response = await apiCall()
    if (response.success) {
      console.log(`✅ [ConversationsStore] Assignment API call succeeded`)

      // 4. Merge API response
      let updatedConv = response.data
      if (!updatedConv && fallbackFetch) {
        console.warn(`⚠️ [ConversationsStore] API didn't return data, fetching conversation`)
        const detailResponse = await fallbackFetch()
        if (detailResponse.success && detailResponse.data) {
          updatedConv = detailResponse.data
        }
      }

      if (updatedConv) {
        if (conversationIndex !== -1) {
          conversations.value[conversationIndex] = updatedConv
          console.log(`✨ [ConversationsStore] Updated conversation in list`)
        }
        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value = updatedConv
          console.log(`✨ [ConversationsStore] Updated currentConversation`)
        }
      }

      return true
    } else {
      console.error(`❌ [ConversationsStore] Assignment API call failed:`, response.error)
      // 5. Rollback
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
        currentConversation.value = originalConversation
      }
      handleError(response.error, errorMessage)
      return false
    }
  } catch (err) {
    console.error(`❌ [ConversationsStore] Assignment failed with exception:`, err)
    // 5. Rollback
    if (originalConversation && conversationIndex !== -1) {
      conversations.value[conversationIndex] = originalConversation
    }
    if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
      currentConversation.value = originalConversation
    }
    handleError(err, errorMessage)
    return false
  }
}

export function createAssignmentActions(deps: AssignmentActionsDeps) {
  const { handleError } = deps

  /**
   * @deprecated Individual assignment is no longer supported. Use assignConversationToTeam instead.
   */
  const assignConversation = async (_conversationId: string, _agentId: string) => {
    console.error('❌ [ConversationsStore] Individual assignment (assignConversation) is deprecated. Use assignConversationToTeam instead.')
    handleError(new Error('Individual assignment is no longer supported'), '請使用團隊指派功能')
    return false
  }

  // 🆕 指派對話給團隊（僅管理員）
  const assignConversationToTeam = async (conversationId: string, teamId: number, teamName?: string) => {
    if (!conversationId || !teamId) { return false }

    console.log(`📝 [ConversationsStore] Assigning conversation ${conversationId} to team ${teamId} (${teamName || 'Unknown'})`)

    return withOptimisticAssignment(
      deps,
      conversationId,
      {
        status: 'assigned' as const,
        assignedTeamId: teamId,
        assignedTeam: teamName ? { id: teamId, name: teamName, description: null } : undefined
      },
      () => conversationApi.assignConversation(conversationId, { teamId }),
      '團隊指派失敗',
      () => conversationApi.getConversation(conversationId)
    )
  }

  // 🆕 取消指派對話（僅管理員）
  const unassignConversation = async (conversationId: string, reason?: string) => {
    if (!conversationId) { return false }

    console.log(`📝 [ConversationsStore] Unassigning conversation ${conversationId}`, reason ? `(reason: ${reason})` : '')

    return withOptimisticAssignment(
      deps,
      conversationId,
      {
        status: CONVERSATION_STATUS.PENDING,
        assignedTeamId: undefined,
        assignedTeam: undefined
      },
      () => conversationApi.unassignConversation(conversationId, reason),
      '取消指派失敗',
      () => conversationApi.getConversation(conversationId)
    )
  }

  // 🆕 轉移對話到另一個團隊
  const transferConversationToTeam = async (
    conversationId: string,
    fromTeamId: number | undefined,
    toTeamId: number,
    toTeamName?: string,
    reason?: string
  ) => {
    if (!conversationId || !toTeamId) { return false }

    console.log(`📝 [ConversationsStore] Transferring conversation ${conversationId} from team ${fromTeamId} to team ${toTeamId} (${toTeamName || 'Unknown'})`)

    return withOptimisticAssignment(
      deps,
      conversationId,
      {
        assignedTeamId: toTeamId,
        assignedTeam: {
          id: toTeamId,
          name: toTeamName || `Team ${toTeamId}`,
          description: null
        }
      },
      () => conversationApi.transferConversation(conversationId, { fromTeamId, toTeamId, reason }),
      '轉移對話失敗'
    )
  }

  return {
    assignConversation,
    assignConversationToTeam,
    unassignConversation,
    transferConversationToTeam
  }
}
