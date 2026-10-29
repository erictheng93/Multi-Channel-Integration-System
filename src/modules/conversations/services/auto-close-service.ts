// Nightly auto-close of idle conversations (runs inside the existing daily cron, NO Durable
// Object alarm, no timer: one bounded pass per day).
//
// WHY: agents almost never press 結案 (414 of 428 conversations were open), so the open list is
// mostly finished conversations. A conversation whose last real exchange was a human reply (or a
// sign-off such as a sticker / thanks after one) and that has been silent for AUTO_CLOSE_IDLE_DAYS
// is done. Closing is reversible: the customer's next message reopens the SAME conversation
// (see setConversationsClosed / the inbound reopen path), so nothing is lost.
//
// RULES
//   - Never closes a conversation that is waiting for a reply (awaiting_since IS NOT NULL), also
//     re-checked inside the UPDATE so a message that arrives mid-run wins.
//   - Never touches closed or soft-deleted conversations.
//   - Idle = no customer message and no agent / system message for the whole window (the trigger
//     maintained markers last_customer_message_at / last_agent_message_at, migration 0071).
//     Conversations without any customer message are left alone.
//   - At most AUTO_CLOSE_MAX_PER_RUN per run, oldest first; the remainder is picked up tomorrow.
//   - Idempotent: closed rows no longer match.
//   - Closes through setConversationsClosed (the UI / bulk path): status, closed_at, unread floor,
//     an activity row attributed to 系統 (action conversation_auto_close) and the WebSocket broadcast.
//
// COST: reads the partial index idx_conversations_auto_close (migration 0072), which holds only open,
// not-waiting, not-deleted conversations ordered by last customer message: the qualifying prefix, at
// most LIMIT rows, no messages scan.

import type { Bindings } from '@/types';
import { ACTIVITY_ACTIONS } from '@modules/activities';
import { DAY_MS, isoOf } from '@/utils/taipei-time';
import { RowsReadMeter } from '@/utils/d1-rows-read';
import { createContextLogger } from '@/utils/logger';
import { setConversationsClosed, type ActivityActor, type CloseTarget } from './conversation-close-service';

const log = createContextLogger('AutoCloseService');

/** Default idle days before an open, not-waiting conversation is closed. Override with env AUTO_CLOSE_IDLE_DAYS (0 disables). */
export const AUTO_CLOSE_IDLE_DAYS = 14;
/** Upper bound of conversations closed by one run. */
export const AUTO_CLOSE_MAX_PER_RUN = 200;
/** Close in chunks so one D1 batch stays small. */
const CLOSE_CHUNK = 50;

export const AUTO_CLOSE_ACTOR: ActivityActor = {
  userId: 'system',
  userName: '系統',
  userRole: 'system'
};

/** Resolve the configured idle days: unset / invalid -> default, 0 -> disabled (returns 0). */
export function resolveAutoCloseIdleDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') { return AUTO_CLOSE_IDLE_DAYS; }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) { return AUTO_CLOSE_IDLE_DAYS; }
  return Math.floor(parsed);
}

export interface AutoCloseResult {
  /** false when AUTO_CLOSE_IDLE_DAYS = 0 */
  enabled: boolean;
  idleDays: number;
  /** Conversations selected this run (<= AUTO_CLOSE_MAX_PER_RUN) */
  candidates: number;
  /** Conversations actually closed (a candidate that received a message meanwhile is skipped) */
  closed: number;
}

interface CandidateRow {
  id: string;
  status: string;
  assigned_team_id: number | null;
}

export async function autoCloseIdleConversations(
  env: Bindings,
  nowMs: number,
  meter?: RowsReadMeter
): Promise<AutoCloseResult> {
  const idleDays = resolveAutoCloseIdleDays(env.AUTO_CLOSE_IDLE_DAYS);
  if (idleDays === 0) {
    return { enabled: false, idleDays: 0, candidates: 0, closed: 0 };
  }

  const cutoff = isoOf(nowMs - idleDays * DAY_MS);
  // The three literal predicates match idx_conversations_auto_close (partial index) exactly.
  const selected = await env.DB.prepare(`
    SELECT id, status, assigned_team_id
    FROM conversations
    WHERE awaiting_since IS NULL AND status <> 'closed' AND deleted_at IS NULL
      AND last_customer_message_at <= ?
      AND (last_agent_message_at IS NULL OR last_agent_message_at <= ?)
    ORDER BY last_customer_message_at ASC
    LIMIT ?
  `).bind(cutoff, cutoff, AUTO_CLOSE_MAX_PER_RUN).all<CandidateRow>();
  meter?.track(selected);

  const targets: CloseTarget[] = (selected.results ?? []).map(row => ({
    id: row.id,
    status: row.status,
    assignedTeamId: row.assigned_team_id
  }));

  let closed = 0;
  for (let offset = 0; offset < targets.length; offset += CLOSE_CHUNK) {
    const chunk = targets.slice(offset, offset + CLOSE_CHUNK);
    const statuses = await setConversationsClosed(env, AUTO_CLOSE_ACTOR, chunk, true, {
      action: ACTIVITY_ACTIONS.CONVERSATION_AUTO_CLOSE,
      details: { auto: true, idleDays },
      onlyIfNotAwaiting: true
    });
    closed += Object.keys(statuses).length;
  }

  log.info('Idle conversations auto-closed', { idleDays, candidates: targets.length, closed });
  return { enabled: true, idleDays, candidates: targets.length, closed };
}
