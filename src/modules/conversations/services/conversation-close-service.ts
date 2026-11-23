// 結案 / 重新開啟（單筆 POST /:id/close|reopen 與批量 POST /bulk 共用）
// 呼叫方負責可見性檢查；這裡只處理狀態真的需要改變的對話。

import type { Bindings } from '@/types';
import { ActivityCapture, ACTIVITY_ACTIONS, RESOURCE_TYPES, type CreateActivityRequest } from '@modules/activities';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';
import { AWAITING_EXPRESSION } from '@modules/dashboard/services/awaiting-service';

const log = createContextLogger('ConversationCloseService');

export type ActivityActor = Pick<CreateActivityRequest, 'userId' | 'userName' | 'userRole' | 'ipAddress' | 'userAgent'>;

export interface CloseTarget {
  id: string;
  status: string;
  assignedTeamId: number | null;
}

/** 重新開啟時依指派狀態回到 assigned / active，與 assign / unassign 的狀態語意一致 */
export function reopenedStatus(assignedTeamId: number | null): 'assigned' | 'active' {
  return assignedTeamId ? 'assigned' : 'active';
}

/**
 * Close or reopen conversations. Rows already in the target state are skipped,
 * so reopening never overwrites an in-progress / waiting status.
 * Returns the new status of every conversation this call actually changed
 * (targets that lost a race with a concurrent update are omitted).
 */
const IDLE_GUARD_SQL = ' AND last_customer_message_at <= ? AND (last_agent_message_at IS NULL OR last_agent_message_at <= ?)';
const NOT_WAITING_GUARD_SQL = ' AND awaiting_since IS NULL';
/**
 * A manual reopen undoes the close (restores the wait and unread it settled) only this soon after it: the
 * "closed by mistake" case. Later than this the close stands, so reopening a conversation the nightly
 * auto-close settled weeks ago does not bring back a months-old wait.
 */
export const REOPEN_UNDO_WINDOW_MS = 60 * 60 * 1000;
/** Ids per read-back query, well under D1's 100 bound parameters */
const READ_CHUNK = 50;

export interface SetClosedOptions {
  /** Activity action to record instead of conversation_close / conversation_reopen (e.g. the nightly auto-close) */
  action?: string;
  /** Extra fields merged into the activity details */
  details?: Record<string, unknown>;
  /**
   * Idle cutoff (ISO) the targets were selected with. The UPDATE re-checks it atomically: close only a conversation that is
   * not waiting for a reply and has had no customer or agent message after the cutoff, so any message that arrived
   * since selection (question, sign-off or reply) wins.
   */
  onlyIfIdleSince?: string;
  /** With onlyIfIdleSince: also close a conversation that is waiting for a reply (the stale-wait pass of the auto-close). */
  includeWaiting?: boolean;
}

export async function setConversationsClosed(
  env: Bindings,
  actor: ActivityActor,
  targets: CloseTarget[],
  closed: boolean,
  options: SetClosedOptions = {}
): Promise<Record<string, string>> {
  const changing = targets.filter(t => (t.status === 'closed') !== closed);
  if (changing.length === 0) {
    return {};
  }

  const timestamp = nowISO();
  const undoCutoff = new Date(Date.parse(timestamp) - REOPEN_UNDO_WINDOW_MS).toISOString();
  const capture = new ActivityCapture(env.DB);
  const guard = options.onlyIfIdleSince ? `${options.includeWaiting ? '' : NOT_WAITING_GUARD_SQL}${IDLE_GUARD_SQL}` : '';

  // Per target: the guarded UPDATE, then an activity row that exists only if that UPDATE
  // changed a row. The status guard exists because a customer message can reopen the
  // conversation concurrently; a target that lost that race is skipped, not reported.
  const statements = changing.flatMap(target => {
    const status = closed ? 'closed' : reopenedStatus(target.assignedTeamId);
    return [
      // 結案：記下未讀下限（unread_floor_at）並清除待回覆標記，結案前的客戶訊息不再算未讀或等待
      // （awaitingExpression 依 unread_floor_at 排除）。原本的下限存進 unread_floor_before_close。
      // 客戶下一則訊息自動重新開啟時下限保留，等待從那則訊息起算。
      //
      // 客服在結案後 REOPEN_UNDO_WINDOW_MS 內手動重新開啟＝復原這次結案（誤按結案）：下限還原成結案前的值，
      // 下面再重算待回覆標記，所以結案時還沒人回的來訊會回到待回覆，不會顯示成「已回覆」。
      // 超過這段時間才重新開啟：結案照舊有效，下限保留，舊訊息不再算等待。
      closed
        ? env.DB
          .prepare(`UPDATE conversations SET status = ?, closed_at = ?, unread_floor_before_close = unread_floor_at, unread_floor_at = ?, awaiting_since = NULL, updated_at = ? WHERE id = ? AND status <> 'closed'${guard}`)
          .bind(status, timestamp, timestamp, timestamp, target.id, ...(options.onlyIfIdleSince ? [options.onlyIfIdleSince, options.onlyIfIdleSince] : []))
        : env.DB
          .prepare("UPDATE conversations SET status = ?, closed_at = NULL, unread_floor_at = CASE WHEN closed_at >= ? THEN unread_floor_before_close ELSE unread_floor_at END, unread_floor_before_close = NULL, updated_at = ? WHERE id = ? AND status = 'closed'")
          .bind(status, undoCutoff, timestamp, target.id),
      capture.buildIrreversibleLog({
        ...actor,
        action: options.action ?? (closed ? ACTIVITY_ACTIONS.CONVERSATION_CLOSE : ACTIVITY_ACTIONS.CONVERSATION_REOPEN),
        resourceType: RESOURCE_TYPES.CONVERSATION,
        resourceId: target.id,
        details: { previousStatus: target.status, status, ...options.details },
        reason: closed ? 'Undo by reopening the conversation' : 'Undo by closing the conversation'
      }, { onlyIfPreviousChanged: true })
    ];
  });

  // Reopen: re-derive the wait marker from the messages under the floor now in place (restored or kept). Appended after the
  // UPDATE/activity pairs because each activity row depends on changes() of the statement right before it.
  // Harmless for a target that lost the race: it recomputes the same value the triggers maintain.
  if (!closed) {
    for (const target of changing) {
      statements.push(env.DB
        .prepare(`UPDATE conversations SET awaiting_since = ${AWAITING_EXPRESSION} WHERE id = ? AND status <> 'closed'`)
        .bind(target.id));
    }
  }

  const batchResults = await env.DB.batch(statements);

  const statuses: Record<string, string> = {};
  changing.forEach((target, i) => {
    if ((batchResults[i * 2]?.meta?.changes ?? 0) > 0) {
      statuses[target.id] = closed ? 'closed' : reopenedStatus(target.assignedTeamId);
    }
  });
  if (Object.keys(statuses).length === 0) {
    return statuses;
  }

  // The wait marker every client should now show: none after a close, the re-derived one after a reopen
  const awaiting = new Map<string, string | null>();
  if (!closed) {
    const ids = Object.keys(statuses);
    for (let i = 0; i < ids.length; i += READ_CHUNK) {
      const chunk = ids.slice(i, i + READ_CHUNK);
      const { results } = await env.DB
        .prepare(`SELECT id, awaiting_since FROM conversations WHERE id IN (${chunk.map(() => '?').join(', ')})`)
        .bind(...chunk)
        .all<{ id: string; awaiting_since: string | null }>();
      for (const row of results) {
        awaiting.set(row.id, row.awaiting_since);
      }
    }
  }

  const broadcastService = new WebSocketBroadcastService(env);
  const results = await Promise.allSettled(Object.entries(statuses).map(([conversationId, status]) =>
    broadcastService.broadcastConversationEvent({
      type: 'conversation_status_changed',
      conversationId,
      userId: actor.userId,
      data: { status, timestamp, awaitingSince: awaiting.get(conversationId) ?? null },
      priority: 'normal'
    })
  ));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) {
    log.warn('Status change broadcast failed, continuing', { failed, total: results.length });
  }

  return statuses;
}
