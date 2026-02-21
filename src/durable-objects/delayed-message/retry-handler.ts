/**
 * Retry Handler for DelayedMessageScheduler
 *
 * Handles retry logic with exponential backoff, platform-specific sending
 * (LINE / Facebook), Dead Letter Queue management, idempotency checks,
 * and database persistence.
 */

import type { Bindings } from '../../types';
import { nowISO, nowMs } from '@/utils/timestamp';
import type { PendingMessage, SendResult, SchedulerLogger, SchedulerMetrics } from './types';

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s exponential backoff
export const API_TIMEOUT_MS = 10_000; // 10s

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Dependencies passed from the DO class
// ---------------------------------------------------------------------------

export interface RetryHandlerDeps {
  env: Bindings;
  storage: DurableObjectStorage;
  doId: string;
  pendingMessages: Map<string, PendingMessage>;
  metrics: SchedulerMetrics;
  logger: SchedulerLogger;
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

/**
 * Check whether a message already exists in the database to prevent duplicate sends.
 */
export async function isMessageAlreadySent(
  messageId: string,
  env: Bindings,
  logger: SchedulerLogger
): Promise<boolean> {
  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const { messages } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');

    const db = drizzle(env.DB);
    const existing = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    return existing.length > 0;
  } catch (error) {
    logger.error('Idempotency check error', error, { messageId });
    return false; // Assume not sent; let downstream logic handle it
  }
}

// ---------------------------------------------------------------------------
// Platform senders
// ---------------------------------------------------------------------------

/**
 * Send a message via the LINE Push API with a 10-second timeout.
 */
export async function sendLineMessage(
  message: PendingMessage,
  env: Bindings,
  logger: SchedulerLogger
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: message.recipientPlatformId,
        messages: [{ type: 'text', text: message.content }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('LINE API timeout', error, { timeout: API_TIMEOUT_MS });
      throw new Error('LINE API request timeout after 10s');
    }

    logger.error('LINE API error', error);
    return false;
  }
}

/**
 * Send a message via the Facebook Messenger API with a 10-second timeout.
 */
export async function sendFacebookMessage(
  message: PendingMessage,
  env: Bindings,
  logger: SchedulerLogger
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${env.FB_PAGE_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: message.recipientPlatformId },
          message: { text: message.content },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Facebook API timeout', error, { timeout: API_TIMEOUT_MS });
      throw new Error('Facebook API request timeout after 10s');
    }

    logger.error('Facebook API error', error);
    return false;
  }
}

/**
 * Route a message to the correct platform sender.
 */
export async function sendToPlatform(
  message: PendingMessage,
  env: Bindings,
  logger: SchedulerLogger
): Promise<boolean> {
  if (message.platform === 'line') {
    return sendLineMessage(message, env, logger);
  }
  if (message.platform === 'facebook') {
    return sendFacebookMessage(message, env, logger);
  }
  throw new Error(`Unsupported platform: ${message.platform}`);
}

// ---------------------------------------------------------------------------
// Retry orchestration
// ---------------------------------------------------------------------------

/**
 * Check whether a message should be skipped (e.g. already sent).
 * If skipped, removes the message from pending state.
 *
 * @returns `true` if the message was skipped
 */
export async function shouldSkipMessage(
  message: PendingMessage,
  deps: RetryHandlerDeps
): Promise<boolean> {
  const alreadySent = await isMessageAlreadySent(message.id, deps.env, deps.logger);

  if (alreadySent) {
    deps.metrics.idempotencyPreventionsTotal++;
    deps.logger.warn('Message already sent', {
      messageId: message.id,
      reason: 'Idempotency check prevented duplicate send',
    });
    deps.pendingMessages.delete(message.id);
    await deps.storage.delete(`msg:${message.id}`);
    return true;
  }

  return false;
}

/**
 * Wait before the next retry with exponential backoff.
 * Persists retry state to durable storage.
 */
async function waitBeforeRetry(
  message: PendingMessage,
  attempt: number,
  deps: RetryHandlerDeps
): Promise<void> {
  const delay = RETRY_DELAYS[attempt] || 4000;

  deps.logger.info('Waiting before retry', {
    messageId: message.id,
    delayMs: delay,
    nextAttempt: attempt + 2,
  });

  // Persist retry state
  message.retryCount = attempt + 1;
  message.lastRetryAt = nowMs();
  await deps.storage.put(`msg:${message.id}`, message);

  await sleep(delay);
}

/**
 * Execute send-with-retry using exponential backoff.
 */
export async function sendWithRetry(
  message: PendingMessage,
  deps: RetryHandlerDeps
): Promise<SendResult> {
  if (!message.retryCount) {
    message.retryCount = 0;
  }

  let lastError: any = null;
  const sendStartTime = nowMs();

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      deps.metrics.retryAttemptsTotal++;
    }

    try {
      deps.logger.info('Retry attempt', {
        messageId: message.id,
        attempt: attempt + 1,
        maxAttempts: MAX_RETRY_ATTEMPTS + 1,
        platform: message.platform,
      });

      const success = await sendToPlatform(message, deps.env, deps.logger);

      if (success) {
        return { success: true, attempt, duration: Date.now() - sendStartTime };
      }

      lastError = new Error(`Platform API returned failure for message ${message.id}`);
    } catch (error) {
      lastError = error;
      deps.logger.error('Send attempt failed', error, {
        messageId: message.id,
        attempt: attempt + 1,
        platform: message.platform,
      });
    }

    if (attempt < MAX_RETRY_ATTEMPTS) {
      await waitBeforeRetry(message, attempt, deps);
    }
  }

  return { success: false, error: lastError };
}

// ---------------------------------------------------------------------------
// Send result handlers
// ---------------------------------------------------------------------------

/**
 * Handle a successful message send: clean up state, persist to DB, update metrics.
 */
export async function handleSendSuccess(
  message: PendingMessage,
  result: SendResult,
  deps: RetryHandlerDeps
): Promise<void> {
  message.status = 'sent';
  deps.pendingMessages.delete(message.id);
  await deps.storage.delete(`msg:${message.id}`);

  await storeMessageInDatabase(message, deps.env, deps.logger);

  deps.metrics.messagesSentTotal++;
  deps.metrics.platformSuccesses[message.platform]++;
  deps.metrics.recordSendDuration(result.duration || 0);
  deps.metrics.recordRetryCount(result.attempt || 0);

  deps.logger.success('Message sent successfully', {
    messageId: message.id,
    attempt: (result.attempt || 0) + 1,
    totalRetries: result.attempt || 0,
    platform: message.platform,
    durationMs: result.duration,
  });
}

/**
 * Handle a permanent failure: mark failed, persist, write to DLQ.
 */
export async function handlePermanentFailure(
  message: PendingMessage,
  error: any,
  deps: RetryHandlerDeps
): Promise<void> {
  message.status = 'failed';
  message.failureReason = error instanceof Error ? error.message : String(error);

  deps.pendingMessages.delete(message.id);
  await deps.storage.put(`msg:${message.id}`, message);

  await addToDeadLetterQueue(message, error, deps);

  deps.metrics.messagesFailedTotal++;
  deps.metrics.platformFailures[message.platform]++;

  deps.logger.critical('Message permanently failed', error, {
    messageId: message.id,
    totalAttempts: MAX_RETRY_ATTEMPTS + 1,
    platform: message.platform,
    conversationId: message.conversationId,
  });
}

/**
 * Handle a catastrophic / unexpected error.
 */
export async function handleCatastrophicError(
  message: PendingMessage,
  error: any,
  deps: RetryHandlerDeps
): Promise<void> {
  deps.logger.critical('Fatal error sending message', error, {
    messageId: message.id,
    platform: message.platform,
  });

  message.status = 'failed';
  message.failureReason = error instanceof Error ? error.message : String(error);

  await addToDeadLetterQueue(message, error, deps);
  deps.pendingMessages.delete(message.id);
  await deps.storage.put(`msg:${message.id}`, message);
}

/**
 * Top-level send orchestrator called from the alarm handler.
 */
export async function sendMessage(
  message: PendingMessage,
  deps: RetryHandlerDeps
): Promise<void> {
  try {
    deps.logger.info('Sending message', {
      messageId: message.id,
      platform: message.platform,
      conversationId: message.conversationId,
    });

    if (await shouldSkipMessage(message, deps)) {
      return;
    }

    const sendResult = await sendWithRetry(message, deps);

    if (sendResult.success) {
      await handleSendSuccess(message, sendResult, deps);
    } else {
      await handlePermanentFailure(message, sendResult.error, deps);
    }
  } catch (error) {
    await handleCatastrophicError(message, error, deps);
  }
}

// ---------------------------------------------------------------------------
// Dead Letter Queue
// ---------------------------------------------------------------------------

/**
 * Write a permanently-failed message to the DLQ with retry.
 */
export async function addToDeadLetterQueue(
  message: PendingMessage,
  reason: any,
  deps: RetryHandlerDeps
): Promise<void> {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const dlqKey = `dlq:${message.id}`;
      const dlqEntry = {
        ...message,
        failedAt: nowMs(),
        failureReason: reason instanceof Error ? reason.message : String(reason),
        failureStack: reason instanceof Error ? reason.stack : undefined,
        retryCount: message.retryCount || 0,
        dlqWriteAttempt: attempt + 1,
        environmentInfo: {
          durableObjectId: deps.doId,
          timestamp: nowISO(),
        },
      };

      await deps.storage.put(dlqKey, dlqEntry);

      deps.metrics.dlqWritesTotal++;

      deps.logger.success('DLQ write successful', {
        messageId: message.id,
        attempt: attempt + 1,
        retryCount: message.retryCount,
        failureReason: dlqEntry.failureReason,
      });
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      deps.logger.error('DLQ write attempt failed', error, {
        messageId: message.id,
        attempt: attempt + 1,
        maxAttempts,
      });

      if (attempt < maxAttempts - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  // Permanent DLQ write failure
  deps.metrics.dlqWriteFailuresTotal++;

  deps.logger.critical('DLQ write permanently failed', lastError, {
    messageId: message.id,
    maxAttempts,
    platform: message.platform,
    conversationId: message.conversationId,
  });
}

// ---------------------------------------------------------------------------
// Database persistence
// ---------------------------------------------------------------------------

/**
 * Store a successfully-sent message in the D1 `messages` table and
 * update the conversation's `lastMessageAt`.
 */
export async function storeMessageInDatabase(
  message: PendingMessage,
  env: Bindings,
  logger: SchedulerLogger
): Promise<void> {
  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const { messages, conversations, agents } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');

    const db = drizzle(env.DB);
    const now = nowISO();

    // Lookup sender display name (best-effort)
    let senderName: string | null = null;
    try {
      const agent = await db
        .select({ displayName: agents.displayName })
        .from(agents)
        .where(eq(agents.id, message.agentId))
        .get();
      senderName = agent?.displayName || null;
    } catch {
      /* query failure does not block message send */
    }

    await db.batch([
      // 1. Insert message record
      db.insert(messages).values({
        id: message.id,
        conversationId: message.conversationId,
        senderType: 'agent',
        agentSenderId: message.agentId,
        content: message.content,
        messageType: message.messageType,
        isSent: true,
        deliveryStatus: 'sent',
        sentAt: now,
        metadata: JSON.stringify({
          ...message.metadata,
          wasDelayed: true,
          originalScheduledAt: message.scheduledAt,
          retryCount: message.retryCount || 0,
        }),
        senderName,
        createdAt: now,
      }),

      // 2. Update conversation last-message timestamp
      db
        .update(conversations)
        .set({ lastMessageAt: now, updatedAt: now })
        .where(eq(conversations.id, message.conversationId)),
    ]);

    logger.success('Message stored in database', {
      messageId: message.id,
      conversationId: message.conversationId,
      retryCount: message.retryCount,
      wasDelayed: true,
    });
  } catch (error) {
    logger.error('Database transaction error', error, {
      messageId: message.id,
      conversationId: message.conversationId,
    });
    throw new Error(
      `Database storage failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
