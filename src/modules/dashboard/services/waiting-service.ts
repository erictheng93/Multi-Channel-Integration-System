// Waiting conversations
//
// DEFINITION (shared by GET /conversations/waiting and GET /dashboard/summary):
//   A conversation is WAITING when
//     - it is not closed (status <> 'closed') and not soft-deleted, AND
//     - the customer sent at least one message AFTER the last human agent
//       message (or no human agent ever replied).
//   "Human agent message" = messages.sender_type = 'agent' that the platform
//   accepted (is_sent = 1; a failed or still-held recall-window message does not
//   answer yet), is not recalled, not soft-deleted and not a broadcast (broadcast rows carry "broadcastId" in
//   metadata; a broadcast is not an answer). Auto-reply and other system
//   messages (sender_type 'system') never end a wait.
//   Only waits that started within the last WAITING_WINDOW_DAYS days (a rolling window,
//   awaiting_since >= now - 7 days) are listed and counted; older ones are the "stale" list
//   (stale-waiting-service.ts). Sign-offs (stickers / thanks after a reply) never start a wait
//   (awaiting-rules.ts).
//   Wait time = now - the EARLIEST customer message after that last agent
//   message, i.e. the oldest unanswered message.
//
// Scoped with the shared conversation visibility rule (admin: all; agent: own
// teams + unassigned pool).
//
// Cost: conversations.awaiting_since (migration 0070) is the stored answer, kept up to
// date by triggers on messages and healed nightly (awaiting-service.ts). The list reads
// ONLY waiting conversations through the partial index
// idx_conversations_awaiting_since; per page row it adds one small index range read for
// the unanswered count and the latest customer message. No history is scanned.
// Callers still cache the result in KV.

import { getConversationVisibilitySql, type ConversationVisibilityUser } from '@/services/conversation-visibility';
import type { WaitingConversation } from '@shared/api-contracts/conversations';
import { WAITING_WINDOW_DAYS } from '@shared/api-contracts/dashboard';
import { DAY_MS, isoOf } from '@/utils/taipei-time';
import type { RowsReadMeter } from '@/utils/d1-rows-read';
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

/** ISO instant before which a wait counts as stale (outside the 待回覆 window). */
export function waitingWindowStartIso(nowMs: number): string {
  return isoOf(nowMs - WAITING_WINDOW_DAYS * DAY_MS);
}

export function clampWaitingLimit(raw: number | undefined, fallback = 5): number {
  if (raw === undefined || !Number.isFinite(raw) || raw < 1) { return fallback; }
  return Math.min(Math.floor(raw), WAITING_MAX_LIMIT);
}

export async function getWaitingConversations(
  db: D1Database,
  user: ConversationVisibilityUser,
  limit: number,
  nowMs: number,
  meter?: RowsReadMeter
): Promise<WaitingResult> {
  const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');
  const totalVisibility = getConversationVisibilitySql(user, 'c2.assigned_team_id');
  const windowStart = waitingWindowStartIso(nowMs);

  // The page is cut inside the CTE so the per-row subqueries below run for at most
  // `limit` conversations, never for every waiting one. The total is a covering-index
  // count (idx_conversations_awaiting_since carries status, team and deleted_at).
  const result = await db.prepare(`
    WITH page AS (
      SELECT c.id AS id,
             c.customer_id AS customer_id,
             c.assigned_team_id AS assigned_team_id,
             c.awaiting_since AS waiting_since
      FROM conversations c
      WHERE c.awaiting_since IS NOT NULL
        AND c.awaiting_since >= ?
        AND c.status <> 'closed'
        AND c.deleted_at IS NULL
        AND ${visibility.clause}
      ORDER BY c.awaiting_since ASC, c.id ASC
      LIMIT ?
    )
    SELECT
      p.id AS conversationId,
      p.customer_id AS customerId,
      COALESCE(cu.custom_name, cu.display_name) AS customerName,
      cu.avatar_url AS avatarUrl,
      cu.platform AS platform,
      p.assigned_team_id AS assignedTeamId,
      p.waiting_since AS waitingSince,
      (SELECT COUNT(*) FROM messages cm
        WHERE cm.conversation_id = p.id AND cm.sender_type = 'customer'
          AND cm.deleted_at IS NULL AND cm.created_at >= p.waiting_since) AS unansweredCount,
      (SELECT lm.content FROM messages lm
        WHERE lm.conversation_id = p.id AND lm.sender_type = 'customer' AND lm.deleted_at IS NULL
        ORDER BY lm.created_at DESC LIMIT 1) AS lastCustomerContent,
      (SELECT lm.message_type FROM messages lm
        WHERE lm.conversation_id = p.id AND lm.sender_type = 'customer' AND lm.deleted_at IS NULL
        ORDER BY lm.created_at DESC LIMIT 1) AS lastCustomerType,
      (SELECT COUNT(*) FROM conversations c2
        WHERE c2.awaiting_since IS NOT NULL AND c2.awaiting_since >= ? AND c2.status <> 'closed' AND c2.deleted_at IS NULL
          AND ${totalVisibility.clause}) AS total
    FROM page p
    LEFT JOIN customers cu ON cu.id = p.customer_id
    ORDER BY p.waiting_since ASC, p.id ASC
  `).bind(windowStart, ...visibility.params, limit, windowStart, ...totalVisibility.params).all<WaitingRow>();
  meter?.track(result);
  const results = result.results;

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
