// Buffered Send Scheduler
// 撤回窗口排程：把 buffered 訊息交給 DelayedMessageScheduler DO（每對話一實例），
// 窗口到期由 DO alarm 回呼 MessageDeliveryService.deliver()。
// 排程失敗時呼叫端應降級為立即發送（downgradeBufferedMessage + deliver）。

import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { messages } from '@/db/schema';
import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('BufferedSendScheduler');

export interface BufferedScheduleParams {
  messageId: string;
  conversationId: string;
  delaySeconds: number;
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
