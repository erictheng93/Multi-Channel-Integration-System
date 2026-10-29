// Stale waiting: open conversations whose oldest unanswered customer message is OLDER than the
// 待回覆 window (WAITING_WINDOW_DAYS). They are no longer counted as 待回覆 but stay reviewable
// ("逾期待回覆") so an admin can close them in bulk. Closing is reversible: the customer's next
// message reopens the same conversation.
//
// Cost: both queries use the partial index idx_conversations_awaiting_since (only waiting rows are
// stored; status / team / deleted_at are in the index). The never-replied test is one indexed
// probe per stale row on idx_messages_conv_sender_deleted_created; no message history is scanned.

import { getConversationVisibilitySql, type ConversationVisibilityUser } from '@/services/conversation-visibility';
import type { RowsReadMeter } from '@/utils/d1-rows-read';
import { neverRepliedSql } from './awaiting-rules';
import { waitingWindowStartIso } from './waiting-service';

export interface StaleWaitingSummary {
  count: number;
  /** Stale conversations in which no human agent ever replied */
  neverRepliedCount: number;
}

interface StaleRow {
  n: number | string | null;
  neverReplied: number | string | null;
}

export async function getStaleWaitingSummary(
  db: D1Database,
  user: ConversationVisibilityUser,
  nowMs: number,
  meter?: RowsReadMeter
): Promise<StaleWaitingSummary> {
  const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');
  const result = await db.prepare(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(CASE WHEN ${neverRepliedSql('c.id')} THEN 1 ELSE 0 END), 0) AS neverReplied
    FROM conversations c
    WHERE c.awaiting_since IS NOT NULL
      AND c.awaiting_since < ?
      AND c.status <> 'closed'
      AND c.deleted_at IS NULL
      AND ${visibility.clause}
  `).bind(waitingWindowStartIso(nowMs), ...visibility.params).all<StaleRow>();
  meter?.track(result);
  const row = result.results?.[0];
  return { count: Number(row?.n ?? 0) || 0, neverRepliedCount: Number(row?.neverReplied ?? 0) || 0 };
}

/** Conversation ids (of the given page) in which no human agent ever replied. One indexed probe per id. */
export async function getNeverRepliedIds(db: D1Database, conversationIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const CHUNK = 90;
  for (let offset = 0; offset < conversationIds.length; offset += CHUNK) {
    const chunk = conversationIds.slice(offset, offset + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const result = await db.prepare(`
      SELECT c.id AS id FROM conversations c
      WHERE c.id IN (${placeholders}) AND ${neverRepliedSql('c.id')}
    `).bind(...chunk).all<{ id: string }>();
    for (const row of result.results ?? []) { out.add(row.id); }
  }
  return out;
}
