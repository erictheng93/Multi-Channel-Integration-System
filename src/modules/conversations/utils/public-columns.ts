import { conversations } from '@/db/schema';

// Conversation columns that may reach the browser. An allowlist on purpose:
// line_reply_token is a live LINE credential (it can send a message to the
// customer) and must never be spread to clients; a new column stays private
// until it is added here.
export const publicConversationColumns = {
  id: conversations.id,
  customerId: conversations.customerId,
  assignedTeamId: conversations.assignedTeamId,
  status: conversations.status,
  priority: conversations.priority,
  firstResponseAt: conversations.firstResponseAt,
  closedAt: conversations.closedAt,
  unreadFloorAt: conversations.unreadFloorAt,
  lastMessageAt: conversations.lastMessageAt,
  lastReadAt: conversations.lastReadAt,
  markedUnreadAt: conversations.markedUnreadAt,
  createdAt: conversations.createdAt,
  updatedAt: conversations.updatedAt,
  deletedAt: conversations.deletedAt
} as const;

// Strips the private LINE reply credentials from a full conversation row that
// was read for internal use (e.g. before a status change) and is about to be
// returned to a client.
export function toPublicConversation<T extends object>(
  row: T
): Omit<T, 'lineReplyToken' | 'lineReplyTokenReceivedAt'> {
  const { lineReplyToken: _token, lineReplyTokenReceivedAt: _receivedAt, ...rest } = row as T & {
    lineReplyToken?: unknown;
    lineReplyTokenReceivedAt?: unknown;
  };
  return rest as Omit<T, 'lineReplyToken' | 'lineReplyTokenReceivedAt'>;
}
