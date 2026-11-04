import { AUTO_REPLY_SENDER_ID, isSignOffMessage } from '@shared/api-contracts'

interface SpokenMessage {
  senderType?: string
  senderId?: string
  content?: string
  messageType?: string
}

/**
 * Drop the customer messages that never start a wait: a sign-off (sticker, thanks) that comes after an agent
 * reply. Same rule as the backend awaiting marker (awaiting-rules.ts); `isSignOffMessage` is the single
 * implementation. `ordered` must be sorted by time, oldest first.
 */
export function withoutSignOffs<T extends SpokenMessage>(ordered: ReadonlyArray<T>): T[] {
  let agentReplied = false
  return ordered.filter(m => {
    // Auto-replies arrive as 'agent' but answer nobody (same rule as the store's nextAwaitingSince).
    if (m.senderType === 'agent') { if (m.senderId !== AUTO_REPLY_SENDER_ID) { agentReplied = true } return true }
    return !(agentReplied && m.senderType === 'customer' && isSignOffMessage(m.messageType, m.content))
  })
}
