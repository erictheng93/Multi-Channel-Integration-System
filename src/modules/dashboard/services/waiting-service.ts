// Waiting conversations
//
// DEFINITION (shared by GET /conversations/waiting and GET /dashboard/summary):
//   A conversation is WAITING when
//     - it is not closed (status <> 'closed') and not soft-deleted, AND
//     - the customer sent at least one message AFTER the last human agent
//       message (or no human agent ever replied).
//   "Human agent message" = messages.sender_type = 'agent' that is not recalled,
//   not soft-deleted and not a broadcast (broadcast rows carry "broadcastId" in
//   metadata; a broadcast is not an answer). Auto-reply and other system
//   messages (sender_type 'system') never end a wait.
//   Wait time = now - the EARLIEST customer message after that last agent
//   message, i.e. the oldest unanswered message.
//
// Scoped with the shared conversation visibility rule (admin: all; agent: own
// teams + unassigned pool).
//
// Cost: one scan over the messages of the caller's open conversations, served by
// idx_messages_conv_sender_deleted_created. Callers cache the result in KV.

import { getConversationVisibilitySql, type ConversationVisibilityUser } from '@/services/conversation-visibility';
import type { WaitingConversation } from '@shared/api-contracts/conversations';
import { getDisplayContent } from '@/modules/conversations/utils/message-helpers';

interface WaitingRow {
  conversationId: string;
  customerId: number;
  customerName: string | null;
  avatarUrl: string | null;
  platform: string | null;
  assignedTeamId: number | null;
  waitingSince: string;
  unansweredCount: number | string;
  lastCustomerContent: string | null;
  lastCustomerType: string | null;
  total: number | string;
}

export interface WaitingResult {
  total: number;
  items: WaitingConversation[];
}

export const WAITING_MAX_LIMIT = 50;
const PREVIEW_MAX_CHARS = 120;

function truncatePreview(text: string | null): string | null {
  if (text === null) { return null; }
  return text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS)}...` : text;
}

export function clampWaitingLimit(raw: number | undefined, fallback = 5): number {
  if (raw === undefined || !Number.isFinite(raw) || raw < 1) { return fallback; }
  return Math.min(Math.floor(raw), WAITING_MAX_LIMIT);
}

export async function getWaitingConversations(
  db: D1Database,
  user: ConversationVisibilityUser,
  limit: number,
  nowMs: number
): Promise<WaitingResult> {
  const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');

  const { results } = await db.prepare(`
    WITH vis AS (
      SELECT c.id AS id
      FROM conversations c
      WHERE ${visibility.clause}
        AND c.status <> 'closed'
        AND c.deleted_at IS NULL
    ),
    last_agent AS (
      SELECT m.conversation_id AS conversation_id, MAX(m.created_at) AS at
      FROM messages m
      INNER JOIN vis ON vis.id = m.conversation_id
      WHERE m.sender_type = 'agent'
        AND m.deleted_at IS NULL
        AND COALESCE(m.is_recalled, 0) = 0
        AND (m.metadata IS NULL OR m.metadata NOT LIKE '%"broadcastId"%')
      GROUP BY m.conversation_id
    ),
    waiting AS (
      SELECT vis.id AS conversation_id,
             MIN(cm.created_at) AS waiting_since,
             COUNT(cm.id) AS unanswered
      FROM vis
      LEFT JOIN last_agent la ON la.conversation_id = vis.id
      INNER JOIN messages cm
        ON cm.conversation_id = vis.id
       AND cm.sender_type = 'customer'
       AND cm.deleted_at IS NULL
       AND cm.created_at > COALESCE(la.at, '')
      GROUP BY vis.id
    )
    SELECT
      w.conversation_id AS conversationId,
      c.customer_id AS customerId,
      COALESCE(cu.custom_name, cu.display_name) AS customerName,
      cu.avatar_url AS avatarUrl,
      cu.platform AS platform,
      c.assigned_team_id AS assignedTeamId,
      w.waiting_since AS waitingSince,
      w.unanswered AS unansweredCount,
      (SELECT lm.content FROM messages lm
        WHERE lm.conversation_id = w.conversation_id AND lm.sender_type = 'customer' AND lm.deleted_at IS NULL
        ORDER BY lm.created_at DESC LIMIT 1) AS lastCustomerContent,
      (SELECT lm.message_type FROM messages lm
        WHERE lm.conversation_id = w.conversation_id AND lm.sender_type = 'customer' AND lm.deleted_at IS NULL
        ORDER BY lm.created_at DESC LIMIT 1) AS lastCustomerType,
      COUNT(*) OVER () AS total
    FROM waiting w
    INNER JOIN conversations c ON c.id = w.conversation_id
    LEFT JOIN customers cu ON cu.id = c.customer_id
    ORDER BY w.waiting_since ASC, w.conversation_id ASC
    LIMIT ?
  `).bind(...visibility.params, limit).all<WaitingRow>();

  const rows = results ?? [];
  const items: WaitingConversation[] = rows.map(row => {
    const sinceMs = Date.parse(row.waitingSince);
    return {
      conversationId: row.conversationId,
      customerId: Number(row.customerId),
      customerName: row.customerName ?? null,
      avatarUrl: row.avatarUrl ?? null,
      platform: row.platform ?? null,
      assignedTeamId: row.assignedTeamId ?? null,
      waitingSince: row.waitingSince,
      waitingSeconds: Number.isFinite(sinceMs) ? Math.max(0, Math.floor((nowMs - sinceMs) / 1000)) : 0,
      unansweredCount: Number(row.unansweredCount) || 0,
      lastCustomerMessage: truncatePreview(row.lastCustomerContent !== null
        ? getDisplayContent(row.lastCustomerContent, row.lastCustomerType ?? 'text')
        : null)
    };
  });

  return { total: rows.length > 0 ? Number(rows[0]!.total) || 0 : 0, items };
}
