// conversations.awaiting_since self-heal (migration 0070)
//
// Triggers on messages keep the marker exact on every write path (customer message,
// accepted human reply, delivery, recall, soft delete). healAwaitingSince is the safety
// net: the nightly cron re-derives the marker for a bounded set of open conversations
// and rewrites only those that disagree, so a missed write path, a dropped trigger or a
// direct SQL edit converges within a day.
//
// The expression below is the single definition of the marker. It is the same
// definition the 0070 backfill and the triggers implement (see that file's header).

import { isoOf, DAY_MS } from '@/utils/taipei-time';
import type { RowsReadMeter } from '@/utils/d1-rows-read';

/** Conversations with messages newer than this many days are re-checked by the nightly heal. */
export const AWAITING_HEAL_WINDOW_DAYS = 2;

/** Correlated expression: the marker for the conversation row aliased `conversations`. */
export const AWAITING_EXPRESSION = `(
  SELECT MIN(cm.created_at)
  FROM messages cm
  WHERE cm.conversation_id = conversations.id
    AND cm.sender_type = 'customer'
    AND cm.deleted_at IS NULL
    AND cm.created_at > COALESCE((
      SELECT MAX(am.created_at)
      FROM messages am
      WHERE am.conversation_id = conversations.id
        AND am.sender_type = 'agent'
        AND am.deleted_at IS NULL
        AND COALESCE(am.is_recalled, 0) = 0
        AND COALESCE(am.is_sent, 1) = 1
        AND (am.metadata IS NULL OR am.metadata NOT LIKE '%"broadcastId"%')
    ), '')
)`;

export interface AwaitingHealResult {
  /** Rows whose stored marker disagreed with the messages and were rewritten. */
  corrected: number;
}

/**
 * Nightly self-heal. Bounded to open conversations that either carry a marker or had a
 * message in the last AWAITING_HEAL_WINDOW_DAYS days; writes only where the stored value
 * disagrees (IS NOT), so an already-correct database costs reads only.
 */
export async function healAwaitingSince(
  db: D1Database,
  nowMs: number,
  meter?: RowsReadMeter
): Promise<AwaitingHealResult> {
  const since = isoOf(nowMs - AWAITING_HEAL_WINDOW_DAYS * DAY_MS);
  const result = await db.prepare(`
    UPDATE conversations
    SET awaiting_since = ${AWAITING_EXPRESSION}
    WHERE status <> 'closed'
      AND deleted_at IS NULL
      AND (
        awaiting_since IS NOT NULL
        OR id IN (SELECT conversation_id FROM messages WHERE created_at >= ?)
      )
      AND awaiting_since IS NOT ${AWAITING_EXPRESSION}
  `).bind(since).run();
  meter?.track(result);
  return { corrected: Number(result.meta?.changes ?? 0) };
}
