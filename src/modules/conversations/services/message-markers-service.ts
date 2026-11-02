// conversations.last_customer_message_at / last_agent_message_at self-heal (migration 0071)
//
// Triggers on messages keep both markers exact (insert = max, soft delete / undelete =
// re-derive). This is the safety net for a dropped trigger or a direct SQL edit: the nightly
// cron re-derives the markers for conversations with a message in the last
// MARKER_HEAL_WINDOW_DAYS days and rewrites only the rows that disagree (IS NOT), so an
// already-correct database costs reads only.

import type { RowsReadMeter } from '@/utils/d1-rows-read';
import { DAY_MS, isoOf } from '@/utils/taipei-time';

export const MARKER_HEAL_WINDOW_DAYS = 2;

export async function healMessageMarkers(
  db: D1Database,
  nowMs: number,
  meter?: RowsReadMeter
): Promise<{ corrected: number }> {
  const since = isoOf(nowMs - MARKER_HEAL_WINDOW_DAYS * DAY_MS);
  const customer = `(SELECT MAX(m.created_at) FROM messages m
    WHERE m.conversation_id = conversations.id AND m.sender_type = 'customer' AND m.deleted_at IS NULL)`;
  const agent = `(SELECT MAX(m.created_at) FROM messages m
    WHERE m.conversation_id = conversations.id AND m.sender_type IN ('agent', 'system') AND m.deleted_at IS NULL)`;
  const result = await db.prepare(`
    UPDATE conversations
    SET last_customer_message_at = ${customer}, last_agent_message_at = ${agent}
    WHERE id IN (SELECT conversation_id FROM messages WHERE created_at >= ?)
      AND (last_customer_message_at IS NOT ${customer} OR last_agent_message_at IS NOT ${agent})
  `).bind(since).run();
  meter?.track(result);
  return { corrected: Number(result.meta?.changes ?? 0) };
}
