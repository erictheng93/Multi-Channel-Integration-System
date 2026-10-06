import type { Conversation, CustomerUpdatedPayload } from '@/types'
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

type NamedCustomer = NonNullable<Conversation['customer']> & { displayName?: string }

/**
 * Patch every conversation (list + current) whose customer matches the payload.
 * Mutates in place; returns the number of conversations touched.
 */
export function applyCustomerUpdate(
  list: Conversation[],
  current: Conversation | null,
  p: CustomerUpdatedPayload
): number {
  const id = String(p.customerId)
  let count = 0
  const patch = (conv: Conversation) => {
    let hit = false
    for (const c of [conv.customer, conv.user] as (NamedCustomer | undefined)[]) {
      if (!c || String(c.id) !== id) { continue }
      hit = true
      c.customName = p.customName
      c.platformName = p.platformName
      if (p.name) {
        c.name = p.name
        if ('displayName' in c) { c.displayName = p.name }
      }
    }
    const flat = conv as Conversation & { customerName?: string }
    if (hit && p.name && 'customerName' in flat) { flat.customerName = p.name }
    return hit
  }
  for (const conv of list) { if (patch(conv)) { count++ } }
  if (current && !list.includes(current) && patch(current)) { count++ }
  return count
}
