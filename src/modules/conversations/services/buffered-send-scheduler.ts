// Buffered Send Scheduler
// 撤回窗口排程：把 buffered 訊息交給 DelayedMessageScheduler DO（每對話一實例），
// 窗口到期由 DO alarm 回呼 MessageDeliveryService.deliver()。
// 排程失敗時呼叫端應降級為立即發送（downgradeBufferedMessage + deliver）。

import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { messages } from '@/db/schema';
import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { nowMs } from '@/utils/timestamp';

const log = createContextLogger('BufferedSendScheduler');

export interface BufferedScheduleParams {
  messageId: string;
  conversationId: string;
  delaySeconds: number;
}

export interface ScheduleOrDeliverNowParams {
  messageId: string;
  conversationId: string;
  recallWindowSeconds: number;
  canBuffer: boolean;
}

export interface ScheduleOrDeliverNowResult {
  deliveryStatus: 'buffered' | 'pending';
  isSent: false;
  recallDeadline: string | null;
  /**
   * True when buffering wasn't used (disabled/ineligible) or scheduling
   * failed. The caller owns *when* to actually run delivery — this function
   * only decides whether it's needed, so a caller that broadcasts a
   * "message created" event first can trigger delivery after that broadcast,
   * keeping the state-update event ordered behind the creation event.
   */
  needsImmediateDelivery: boolean;
}

/**
 * Schedule a buffered message on the conversation's DelayedMessageScheduler DO.
 *
 * @returns true when the DO accepted the schedule; false on any failure
 *          (caller must downgrade to immediate delivery — a message must
 *          never be left stranded in 'buffered').
 */
export async function scheduleBufferedDelivery(
  env: Bindings,
  params: BufferedScheduleParams
): Promise<boolean> {
  try {
    if (!env.DELAYED_MESSAGE_SCHEDULER) {
      log.error('DELAYED_MESSAGE_SCHEDULER binding missing', { messageId: params.messageId });
      return false;
    }

    const doId = env.DELAYED_MESSAGE_SCHEDULER.idFromName(params.conversationId);
    const doStub = env.DELAYED_MESSAGE_SCHEDULER.get(doId);

    const response = await doStub.fetch('https://delayed-message-scheduler/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'deliver-by-ref',
        messageId: params.messageId,
        conversationId: params.conversationId,
        delaySeconds: params.delaySeconds,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      log.error('DO schedule rejected', {
        messageId: params.messageId,
        status: response.status,
        body: body.substring(0, 200),
      });
      return false;
    }

    log.info('Buffered delivery scheduled', {
      messageId: params.messageId,
      conversationId: params.conversationId,
      delaySeconds: params.delaySeconds,
    });
    return true;
  } catch (error) {
    log.error('DO schedule call failed', {
      messageId: params.messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Cancel a buffered message on the conversation's DelayedMessageScheduler DO.
 *
 * The DO is the single arbiter of the recall race: cancel succeeds only while
 * the message is still pending there (it rejects once the send time has
 * passed), and the per-conversation DO serializes cancel against the alarm.
 *
 * @returns true when the pending send was cancelled — the platform will never
 *          receive the message; false when it is too late (or the DO call failed).
 */
export async function cancelBufferedDelivery(
  env: Bindings,
  params: { messageId: string; conversationId: string; reason?: string }
): Promise<boolean> {
  try {
    if (!env.DELAYED_MESSAGE_SCHEDULER) {
      log.error('DELAYED_MESSAGE_SCHEDULER binding missing', { messageId: params.messageId });
      return false;
    }

    const doId = env.DELAYED_MESSAGE_SCHEDULER.idFromName(params.conversationId);
    const doStub = env.DELAYED_MESSAGE_SCHEDULER.get(doId);

    const response = await doStub.fetch('https://delayed-message-scheduler/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: params.messageId,
        reason: params.reason || 'agent-recall',
      }),
    });

    const result = await response.json().catch(() => null) as { success?: boolean; reason?: string } | null;
    const success = response.ok && result?.success === true;

    log.info('Buffered delivery cancel attempted', {
      messageId: params.messageId,
      success,
      reason: result?.reason,
    });
    return success;
  } catch (error) {
    log.error('DO cancel call failed', {
      messageId: params.messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Downgrade a buffered message back to the immediate-send shape
 * ('pending', no recall deadline) before falling back to direct delivery.
 */
export async function downgradeBufferedMessage(
  env: Bindings,
  messageId: string
): Promise<void> {
  try {
    const db = createDbClient(env.DB);
    await db
      .update(messages)
      .set({ deliveryStatus: 'pending', recallDeadline: null })
      .where(eq(messages.id, messageId));
    log.warn('Buffered message downgraded to immediate send', { messageId });
  } catch (error) {
    // Delivery still proceeds; the row stays 'buffered' but deliver() will
    // flip it to sent/failed, so this is cosmetic-only on failure.
    log.error('Failed to downgrade buffered message', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function persistRecallDeadline(
  env: Bindings,
  messageId: string,
  recallDeadline: string
): Promise<void> {
  try {
    const db = createDbClient(env.DB);
    await db
      .update(messages)
      .set({ recallDeadline })
      .where(eq(messages.id, messageId));
  } catch (error) {
    log.error('Failed to persist buffered recall deadline', {
      messageId,
      recallDeadline,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Owns the "never stranded in buffered" invariant for send paths.
 *
 * If the message is eligible for recall buffering, schedule it and stamp the
 * recall deadline from the actual scheduling attempt. If scheduling fails (or
 * the message is not eligible for buffering), downgrade/keep it as pending
 * and report `needsImmediateDelivery: true` — this function never invokes
 * delivery itself. Callers that broadcast a "message created" event must run
 * delivery *after* that broadcast so a delivery-status update can never race
 * ahead of the creation event on the wire (see ADR-0003 follow-up: the
 * buffered-fallback ordering bug).
 */
export async function scheduleOrDeliverNow(
  env: Bindings,
  params: ScheduleOrDeliverNowParams
): Promise<ScheduleOrDeliverNowResult> {
  if (params.recallWindowSeconds <= 0 || !params.canBuffer) {
    return {
      deliveryStatus: 'pending',
      isSent: false,
      recallDeadline: null,
      needsImmediateDelivery: true,
    };
  }

  const recallDeadline = new Date(nowMs() + params.recallWindowSeconds * 1000).toISOString();
  const scheduled = await scheduleBufferedDelivery(env, {
    messageId: params.messageId,
    conversationId: params.conversationId,
    delaySeconds: params.recallWindowSeconds,
  });

  if (scheduled) {
    await persistRecallDeadline(env, params.messageId, recallDeadline);
    return {
      deliveryStatus: 'buffered',
      isSent: false,
      recallDeadline,
      needsImmediateDelivery: false,
    };
  }

  await downgradeBufferedMessage(env, params.messageId);
  return {
    deliveryStatus: 'pending',
    isSent: false,
    recallDeadline: null,
    needsImmediateDelivery: true,
  };
}
