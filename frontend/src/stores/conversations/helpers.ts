import type { Conversation } from '@/types'
import { CONVERSATION_STATUS } from '@/constants/conversation-status'
import type { ConversationStats } from './types'

/**
 * Compare two conversations to detect meaningful changes.
 * Any field used for sorting MUST be included in keyFields.
 */
export function hasConversationChanged(existing: Conversation, updated: Conversation): boolean {
  if (!existing || !updated) { return true }

  // Compare key fields that would affect UI rendering or sorting
  // Note: assignedAgentId/assignedAgent removed - only team assignment is supported now
  const keyFields = [
    'id', 'status', 'unreadCount', 'lastMessageAt', 'lastMessage', 'priority',
    'assignedTeamId', 'assignedTeam', 'customerName', 'platform', 'firstResponseAt',
    'updatedAt', 'createdAt'
  ] as const

  return keyFields.some(field => {
    const existingValue = existing[field as keyof Conversation]
    const updatedValue = updated[field as keyof Conversation]
    return JSON.stringify(existingValue) !== JSON.stringify(updatedValue)
  })
}

/**
 * Compute stats from a conversation array.
 * Extracted to eliminate duplicated logic between updateStatsFromConversations and pollConversations.
 */
export function computeStatsFromConversations(conversationList: Conversation[]): ConversationStats {
  return {
    total: conversationList.length,
    active: conversationList.filter(c =>
      c.status === CONVERSATION_STATUS.ACTIVE
    ).length,
    assigned: conversationList.filter(c =>
      c.status === CONVERSATION_STATUS.IN_PROGRESS
    ).length,
    pending: conversationList.filter(c =>
      c.status === CONVERSATION_STATUS.PENDING
    ).length,
    unreadCount: conversationList.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  }
}
