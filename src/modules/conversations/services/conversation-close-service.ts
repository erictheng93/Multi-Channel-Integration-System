// 結案 / 重新開啟（單筆 POST /:id/close|reopen 與批量 POST /bulk 共用）
// 呼叫方負責可見性檢查；這裡只處理狀態真的需要改變的對話。

import type { Bindings } from '@/types';
import { ActivityCapture, ACTIVITY_ACTIONS, RESOURCE_TYPES, type CreateActivityRequest } from '@modules/activities';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';

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
export interface SetClosedOptions {
  /** Activity action to record instead of conversation_close / conversation_reopen (e.g. the nightly auto-close) */
  action?: string;
  /** Extra fields merged into the activity details */
  details?: Record<string, unknown>;
  /** Close only conversations that are NOT waiting for a reply (awaiting_since IS NULL); a message that arrived since selection wins */
  onlyIfNotAwaiting?: boolean;
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
  const capture = new ActivityCapture(env.DB);

  // Per target: the guarded UPDATE, then an activity row that exists only if that UPDATE
  // changed a row. The status guard exists because a customer message can reopen the
  // conversation concurrently; a target that lost that race is skipped, not reported.
  const statements = changing.flatMap(target => {
    const status = closed ? 'closed' : reopenedStatus(target.assignedTeamId);
    return [
      // 結案時記下未讀下限（unread_floor_at），重新開啟時保留，結案前累積的訊息不會再算未讀
      closed
        ? env.DB
          .prepare(`UPDATE conversations SET status = ?, closed_at = ?, unread_floor_at = ?, updated_at = ? WHERE id = ? AND status <> 'closed'${options.onlyIfNotAwaiting ? ' AND awaiting_since IS NULL' : ''}`)
          .bind(status, timestamp, timestamp, timestamp, target.id)
        : env.DB
          .prepare("UPDATE conversations SET status = ?, closed_at = NULL, updated_at = ? WHERE id = ? AND status = 'closed'")
          .bind(status, timestamp, target.id),
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

  const broadcastService = new WebSocketBroadcastService(env);
  const results = await Promise.allSettled(Object.entries(statuses).map(([conversationId, status]) =>
    broadcastService.broadcastConversationEvent({
      type: 'conversation_status_changed',
      conversationId,
      userId: actor.userId,
      data: { status, timestamp },
      priority: 'normal'
    })
  ));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) {
    log.warn('Status change broadcast failed, continuing', { failed, total: results.length });
  }

  return statuses;
}
