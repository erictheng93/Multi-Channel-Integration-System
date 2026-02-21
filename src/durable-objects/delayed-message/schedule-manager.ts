/**
 * Schedule Manager for DelayedMessageScheduler
 *
 * Handles alarm scheduling, ready-message collection, cancel logic,
 * and batch processing orchestration. Pure helper functions that
 * operate on the provided state rather than owning it.
 */

import { nowMs } from '@/utils/timestamp';
import type { PendingMessage, CancelResult, SchedulerLogger, SchedulerMetrics } from './types';

// ---------------------------------------------------------------------------
// Alarm management
// ---------------------------------------------------------------------------

/**
 * Update the Cloudflare Alarm to fire at the earliest pending message time.
 *
 * - Finds the minimum `scheduledAt` among all pending messages
 * - Sets the alarm if the earliest time changed
 * - Deletes the alarm when no messages remain
 *
 * @returns The new `nextAlarmTime` value (or null if cleared)
 */
export async function updateAlarm(
  storage: DurableObjectStorage,
  pendingMessages: Map<string, PendingMessage>,
  currentAlarmTime: number | null,
  logger: SchedulerLogger
): Promise<number | null> {
  let earliestTime: number | null = null;

  for (const message of pendingMessages.values()) {
    if (message.status === 'pending') {
      if (!earliestTime || message.scheduledAt < earliestTime) {
        earliestTime = message.scheduledAt;
      }
    }
  }

  if (earliestTime && earliestTime !== currentAlarmTime) {
    await storage.setAlarm(earliestTime);
    logger.info('Alarm set', {
      scheduledTime: new Date(earliestTime).toISOString(),
      timeUntilAlarm: earliestTime - Date.now(),
      pendingMessagesCount: pendingMessages.size,
    });
    return earliestTime;
  }

  if (!earliestTime && currentAlarmTime) {
    await storage.deleteAlarm();
    logger.info('Alarm cancelled', { reason: 'No pending messages' });
    return null;
  }

  return currentAlarmTime;
}

// ---------------------------------------------------------------------------
// Ready-message collection
// ---------------------------------------------------------------------------

/**
 * Collect all pending messages whose `scheduledAt` has passed.
 */
export function collectReadyMessages(
  pendingMessages: Map<string, PendingMessage>,
  logger: SchedulerLogger
): PendingMessage[] {
  const now = nowMs();
  const allPending = Array.from(pendingMessages.values());
  const ready = allPending.filter(
    (msg) => msg.status === 'pending' && msg.scheduledAt <= now
  );

  logger.info('Ready messages collected', {
    readyCount: ready.length,
    totalPending: allPending.length,
  });

  return ready;
}

// ---------------------------------------------------------------------------
// Batch result processing
// ---------------------------------------------------------------------------

export interface BatchResultsDeps {
  logger: SchedulerLogger;
  addToDeadLetterQueue: (message: PendingMessage, reason: any) => Promise<void>;
}

/**
 * Process `Promise.allSettled` results from a batch send.
 *
 * - Counts successes / failures
 * - Writes failed messages to DLQ
 */
export async function processBatchResults(
  messages: PendingMessage[],
  results: PromiseSettledResult<void>[],
  deps: BatchResultsDeps
): Promise<void> {
  let successCount = 0;
  let failureCount = 0;
  const dlqPromises: Promise<void>[] = [];

  results.forEach((result, index) => {
    const message = messages[index];

    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      failureCount++;
      const reason = result.reason ?? new Error('Unknown rejection reason');

      dlqPromises.push(deps.addToDeadLetterQueue(message, reason));

      deps.logger.error('Message send failed', reason, {
        messageId: message.id,
        platform: message.platform,
        retryCount: message.retryCount,
      });
    }
  });

  // Ensure all DLQ writes complete
  await Promise.allSettled(dlqPromises);

  deps.logger.info('Batch send complete', {
    successCount,
    failureCount,
    totalProcessed: successCount + failureCount,
  });
}

// ---------------------------------------------------------------------------
// Cancel logic
// ---------------------------------------------------------------------------

/**
 * Core cancel-message logic.
 *
 * Removes the message from both in-memory map and durable storage,
 * then triggers an alarm update.
 */
export async function cancelMessage(
  messageId: string,
  reason: string | undefined,
  pendingMessages: Map<string, PendingMessage>,
  storage: DurableObjectStorage,
  metrics: SchedulerMetrics,
  logger: SchedulerLogger,
  doUpdateAlarm: () => Promise<void>
): Promise<CancelResult> {
  const message = pendingMessages.get(messageId);

  if (!message) {
    return { success: false, reason: 'Message not found or already processed' };
  }

  if (message.status !== 'pending') {
    return { success: false, reason: `Message already ${message.status}` };
  }

  const now = nowMs();
  if (now >= message.scheduledAt) {
    return { success: false, reason: 'Message send time has passed' };
  }

  // Mark cancelled
  message.status = 'cancelled';
  if (reason) {
    message.metadata = { ...message.metadata, cancelReason: reason };
  }

  // Remove from memory and storage
  pendingMessages.delete(messageId);
  await storage.delete(`msg:${messageId}`);

  // Re-evaluate alarm
  await doUpdateAlarm();

  const cancelledAt = nowMs();
  metrics.messagesCancelledTotal++;

  logger.success('Message cancelled', {
    messageId,
    cancelReason: reason || 'none',
    cancelledAt,
    timeBeforeSend: message.scheduledAt - cancelledAt,
  });

  return { success: true, cancelledAt };
}

// ---------------------------------------------------------------------------
// State restoration
// ---------------------------------------------------------------------------

/**
 * Restore pending messages and alarm state from Durable Object storage.
 */
export async function restoreState(
  storage: DurableObjectStorage,
  pendingMessages: Map<string, PendingMessage>,
  logger: SchedulerLogger
): Promise<number | null> {
  try {
    const allMessages = await storage.list<PendingMessage>({ prefix: 'msg:' });

    for (const [_key, message] of allMessages) {
      if (message.status === 'pending') {
        pendingMessages.set(message.id, message);
      }
    }

    const currentAlarm = await storage.getAlarm();

    logger.info('State restored', {
      pendingMessagesCount: pendingMessages.size,
      nextAlarmTime: currentAlarm ? new Date(currentAlarm).toISOString() : null,
    });

    return currentAlarm;
  } catch (error) {
    logger.error('State restoration error', error);
    return null;
  }
}
