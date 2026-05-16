/**
 * DelayedMessageScheduler Durable Object
 *
 * Unified delayed message scheduler (consolidates DelayedMessageBuffer + DelayedMessageProcessor)
 *
 * Core Features:
 * - Schedule messages with 1-120 second delays using Alarm API
 * - Instant cancellation capability (<100ms response time)
 * - Platform support: LINE OA, Facebook Messenger
 * - Automatic retry with exponential backoff (1s, 2s, 4s)
 * - Dead Letter Queue (DLQ) for permanently failed messages
 * - Comprehensive metrics and structured logging
 * - Idempotency checks prevent duplicate sends
 *
 * Architecture:
 * - One DO instance per conversation for isolation
 * - Uses Cloudflare Alarm API for efficient scheduling
 * - Stateful with Durable Object Storage persistence
 * - Event-driven with precise timing guarantees
 *
 * Module split:
 * - ./delayed-message/types.ts - Shared type definitions
 * - ./delayed-message/schedule-manager.ts - Alarm scheduling, cancel, state restore
 * - ./delayed-message/retry-handler.ts  - Retry logic, platform senders, DLQ, DB persistence
 */

import type { Bindings } from '../types';
import { nowISO, nowMs } from '@/utils/timestamp';

import type {
  PendingMessage,
  StatusResult,
  SchedulerLogger,
  SchedulerMetrics,
} from './delayed-message/types';

import {
  updateAlarm,
  collectReadyMessages,
  processBatchResults,
  cancelMessage,
  restoreState,
} from './delayed-message/schedule-manager';

import {
  sendMessage,
  addToDeadLetterQueue,
  type RetryHandlerDeps,
} from './delayed-message/retry-handler';

interface SchedulerMetricsSnapshot extends SchedulerMetrics {
  startTime?: number;
}

interface DeadLetterMessageSummary {
  id: string;
  content: string;
  platform: PendingMessage['platform'];
  failedAt: number;
  failureReason?: string;
  retryCount?: number;
  scheduledAt: number;
  conversationId: string;
}

/**
 * DelayedMessageScheduler Durable Object
 *
 * One instance per conversation for isolation.
 * Uses Alarm API for precise delayed delivery.
 */
export class DelayedMessageScheduler implements DurableObject {
  private state: DurableObjectState;
  private env: Bindings;

  // In-memory pending messages (fast access)
  private pendingMessages: Map<string, PendingMessage> = new Map();

  // Next scheduled alarm time
  private nextAlarmTime: number | null = null;

  // ---------------------------------------------------------------------------
  // Metrics collector
  // ---------------------------------------------------------------------------

  private metrics: SchedulerMetrics = {
    messagesSentTotal: 0,
    messagesFailedTotal: 0,
    messagesCancelledTotal: 0,
    messagesScheduledTotal: 0,
    retryAttemptsTotal: 0,
    dlqWritesTotal: 0,
    dlqWriteFailuresTotal: 0,
    alarmTriggersTotal: 0,
    idempotencyPreventionsTotal: 0,

    platformSuccesses: { line: 0, facebook: 0 },
    platformFailures: { line: 0, facebook: 0 },

    sendDurations: [],
    retryCounts: [],

    recordSendDuration: (durationMs: number) => {
      this.metrics.sendDurations.push(durationMs);
      if (this.metrics.sendDurations.length > 1000) {
        this.metrics.sendDurations.shift();
      }
    },

    recordRetryCount: (count: number) => {
      this.metrics.retryCounts.push(count);
      if (this.metrics.retryCounts.length > 1000) {
        this.metrics.retryCounts.shift();
      }
    },

    getPercentile: (data: number[], percentile: number): number => {
      if (data.length === 0) return 0;
      const sorted = [...data].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[index] || 0;
    },
  };

  // ---------------------------------------------------------------------------
  // Structured logger
  // ---------------------------------------------------------------------------

  private logger: SchedulerLogger = {
    info: (action: string, context?: Record<string, unknown>) => {
      console.log(JSON.stringify({
        timestamp: nowISO(), level: 'info',
        service: 'DelayedMessageScheduler', doId: this.state.id.toString(),
        action, ...context,
      }));
    },
    success: (action: string, context?: Record<string, unknown>) => {
      console.log(JSON.stringify({
        timestamp: nowISO(), level: 'success',
        service: 'DelayedMessageScheduler', doId: this.state.id.toString(),
        action, ...context,
      }));
    },
    warn: (action: string, context?: Record<string, unknown>) => {
      console.warn(JSON.stringify({
        timestamp: nowISO(), level: 'warn',
        service: 'DelayedMessageScheduler', doId: this.state.id.toString(),
        action, ...context,
      }));
    },
    error: (action: string, error: unknown, context?: Record<string, unknown>) => {
      console.error(JSON.stringify({
        timestamp: nowISO(), level: 'error',
        service: 'DelayedMessageScheduler', doId: this.state.id.toString(),
        action,
        error: error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : String(error),
        ...context,
      }));
    },
    critical: (action: string, error: unknown, context?: Record<string, unknown>) => {
      console.error(JSON.stringify({
        timestamp: nowISO(), level: 'CRITICAL',
        service: 'DelayedMessageScheduler', doId: this.state.id.toString(),
        action,
        error: error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : String(error),
        alert: true,
        ...context,
      }));
    },
  };

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;

    this.state.blockConcurrencyWhile(async () => {
      this.nextAlarmTime = await restoreState(
        this.state.storage,
        this.pendingMessages,
        this.logger
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Helper: build RetryHandlerDeps from current instance state
  // ---------------------------------------------------------------------------

  private getRetryDeps(): RetryHandlerDeps {
    return {
      env: this.env,
      storage: this.state.storage,
      doId: this.state.id.toString(),
      pendingMessages: this.pendingMessages,
      metrics: this.metrics,
      logger: this.logger,
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: update alarm and store the returned value
  // ---------------------------------------------------------------------------

  private async doUpdateAlarm(): Promise<void> {
    this.nextAlarmTime = await updateAlarm(
      this.state.storage,
      this.pendingMessages,
      this.nextAlarmTime,
      this.logger
    );
  }

  // ---------------------------------------------------------------------------
  // HTTP request handler
  // ---------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      switch (url.pathname) {
        case '/schedule': return await this.handleSchedule(request);
        case '/cancel': return await this.handleCancel(request);
        case '/status': return await this.handleStatus(request);
        case '/list': return await this.handleList();
        case '/dlq': return await this.handleDLQ();
        case '/metrics':  return await this.handleMetrics();
        default: return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      this.logger.error('Request error', error, {
        url: request.url,
        method: request.method,
      });
      return this.errorResponse(error);
    }
  }

  // ---------------------------------------------------------------------------
  // /schedule
  // ---------------------------------------------------------------------------

  private async handleSchedule(request: Request): Promise<Response> {
    const data = await request.json() as {
      messageId: string;
      conversationId: string;
      agentId: string;
      content: string;
      messageType?: string;
      platform: string;
      recipientPlatformId: string;
      delaySeconds: number;
      metadata?: Record<string, unknown>;
    };

    if (!data.messageId || !data.conversationId || !data.content || !data.agentId) {
      return this.badRequestResponse('Missing required fields');
    }

    const delaySeconds = data.delaySeconds || 5;
    if (delaySeconds < 1 || delaySeconds > 120) {
      return this.badRequestResponse('Delay must be between 1-120 seconds');
    }

    const now = nowMs();
    const scheduledAt = now + delaySeconds * 1000;

    const message: PendingMessage = {
      id: data.messageId,
      conversationId: data.conversationId,
      agentId: data.agentId,
      content: data.content,
      messageType: (data.messageType as PendingMessage['messageType']) || 'text',
      platform: data.platform as PendingMessage['platform'],
      recipientPlatformId: data.recipientPlatformId,
      scheduledAt,
      status: 'pending',
      metadata: data.metadata,
      createdAt: now,
    };

    // 1. Store in memory
    this.pendingMessages.set(message.id, message);

    // 2. Persist to Durable Object Storage
    await this.state.storage.put(`msg:${message.id}`, message);

    // 3. Set or update alarm
    await this.doUpdateAlarm();

    this.metrics.messagesScheduledTotal++;

    this.logger.success('Message scheduled', {
      messageId: message.id,
      delaySeconds,
      scheduledAt,
      platform: message.platform,
      conversationId: message.conversationId,
    });

    return this.jsonResponse({
      success: true,
      messageId: message.id,
      scheduledAt,
      canCancelUntil: scheduledAt,
      delaySeconds,
    });
  }

  // ---------------------------------------------------------------------------
  // /cancel
  // ---------------------------------------------------------------------------

  private async handleCancel(request: Request): Promise<Response> {
    const data = await request.json() as {
      messageId: string;
      reason?: string;
    };

    if (!data.messageId) {
      return this.badRequestResponse('Message ID required');
    }

    const result = await cancelMessage(
      data.messageId,
      data.reason,
      this.pendingMessages,
      this.state.storage,
      this.metrics,
      this.logger,
      () => this.doUpdateAlarm()
    );

    return this.jsonResponse(result, result.success ? 200 : 400);
  }

  // ---------------------------------------------------------------------------
  // /status
  // ---------------------------------------------------------------------------

  private async handleStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId');

    if (!messageId) {
      return this.badRequestResponse('Message ID required');
    }

    const message = this.pendingMessages.get(messageId);

    if (!message) {
      return this.jsonResponse({ exists: false, status: 'not_found' } as StatusResult);
    }

    const now = nowMs();
    const timeRemaining = Math.max(0, message.scheduledAt - now);
    const canCancel = message.status === 'pending' && timeRemaining > 0;

    return this.jsonResponse({
      exists: true,
      status: message.status,
      timeRemaining: Math.ceil(timeRemaining / 1000),
      canCancel,
      scheduledAt: message.scheduledAt,
    } as StatusResult);
  }

  // ---------------------------------------------------------------------------
  // /list
  // ---------------------------------------------------------------------------

  private async handleList(): Promise<Response> {
    const messages = Array.from(this.pendingMessages.values())
      .filter((msg) => msg.status === 'pending')
      .map((msg) => ({
        id: msg.id,
        content: msg.content.substring(0, 100),
        scheduledAt: msg.scheduledAt,
        timeRemaining: Math.max(0, msg.scheduledAt - Date.now()),
      }));

    return this.jsonResponse({ success: true, count: messages.length, messages });
  }

  // ---------------------------------------------------------------------------
  // /dlq
  // ---------------------------------------------------------------------------

  private async handleDLQ(): Promise<Response> {
    try {
      const dlqEntries = await this.state.storage.list<PendingMessage>({ prefix: 'dlq:' });
      const failedMessages: DeadLetterMessageSummary[] = [];

      for (const [_key, entry] of dlqEntries) {
        failedMessages.push({
          id: entry.id,
          content: entry.content?.substring(0, 100) || '',
          platform: entry.platform,
          failedAt: entry.failedAt ?? 0,
          failureReason: entry.failureReason,
          retryCount: entry.retryCount,
          scheduledAt: entry.scheduledAt,
          conversationId: entry.conversationId,
        });
      }

      failedMessages.sort((a, b) => b.failedAt - a.failedAt);

      return this.jsonResponse({
        success: true,
        count: failedMessages.length,
        messages: failedMessages,
        timestamp: nowMs(),
      });
    } catch (error) {
      this.logger.error('DLQ query error', error);
      return this.errorResponse(error);
    }
  }

  // ---------------------------------------------------------------------------
  // /metrics
  // ---------------------------------------------------------------------------

  private async handleMetrics(): Promise<Response> {
    try {
      const m = this.metrics;
      const totalMessages = m.messagesSentTotal + m.messagesFailedTotal;
      const successRate = totalMessages > 0
        ? ((m.messagesSentTotal / totalMessages) * 100).toFixed(2)
        : '0.00';

      const lineTotal = m.platformSuccesses.line + m.platformFailures.line;
      const lineSuccessRate = lineTotal > 0
        ? ((m.platformSuccesses.line / lineTotal) * 100).toFixed(2)
        : '0.00';

      const fbTotal = m.platformSuccesses.facebook + m.platformFailures.facebook;
      const fbSuccessRate = fbTotal > 0
        ? ((m.platformSuccesses.facebook / fbTotal) * 100).toFixed(2)
        : '0.00';

      const p50Duration = m.getPercentile(m.sendDurations, 50);
      const p95Duration = m.getPercentile(m.sendDurations, 95);
      const p99Duration = m.getPercentile(m.sendDurations, 99);
      const p50Retry = m.getPercentile(m.retryCounts, 50);
      const p95Retry = m.getPercentile(m.retryCounts, 95);

      const pendingCount = this.pendingMessages.size;
      const dlqSize = await this.getDLQSize();

      return this.jsonResponse({
        counters: {
          messagesScheduledTotal: m.messagesScheduledTotal,
          messagesSentTotal: m.messagesSentTotal,
          messagesFailedTotal: m.messagesFailedTotal,
          messagesCancelledTotal: m.messagesCancelledTotal,
          retryAttemptsTotal: m.retryAttemptsTotal,
          dlqWritesTotal: m.dlqWritesTotal,
          dlqWriteFailuresTotal: m.dlqWriteFailuresTotal,
          alarmTriggersTotal: m.alarmTriggersTotal,
          idempotencyPreventionsTotal: m.idempotencyPreventionsTotal,
        },
        platformMetrics: {
          line: {
            successes: m.platformSuccesses.line,
            failures: m.platformFailures.line,
            total: lineTotal,
            successRatePercent: lineSuccessRate,
          },
          facebook: {
            successes: m.platformSuccesses.facebook,
            failures: m.platformFailures.facebook,
            total: fbTotal,
            successRatePercent: fbSuccessRate,
          },
        },
        gauges: {
          pendingMessagesCount: pendingCount,
          dlqSize,
          nextAlarmScheduled: this.nextAlarmTime
            ? new Date(this.nextAlarmTime).toISOString()
            : null,
        },
        histograms: {
          sendDurationMs: {
            p50: p50Duration, p95: p95Duration, p99: p99Duration,
            sampleCount: m.sendDurations.length,
          },
          retryCount: {
            p50: p50Retry, p95: p95Retry,
            sampleCount: m.retryCounts.length,
          },
        },
        derived: {
          overallSuccessRatePercent: successRate,
          totalMessagesProcessed: totalMessages,
          retryRatePercent: totalMessages > 0
            ? ((m.retryAttemptsTotal / totalMessages) * 100).toFixed(2)
            : '0.00',
        },
        metadata: {
          durableObjectId: this.state.id.toString(),
          timestamp: nowISO(),
          uptimeSeconds: Math.floor(
            (Date.now() - ((m as SchedulerMetricsSnapshot).startTime || nowMs())) / 1000
          ),
        },
      });
    } catch (error) {
      this.logger.error('Metrics query error', error);
      return this.errorResponse(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Alarm handler
  // ---------------------------------------------------------------------------

  async alarm(): Promise<void> {
    this.metrics.alarmTriggersTotal++;

    this.logger.info('Alarm triggered', {
      pendingCount: this.pendingMessages.size,
      nextAlarmTime: this.nextAlarmTime,
    });

    // 1. Collect ready messages
    const readyMessages = collectReadyMessages(this.pendingMessages, this.logger);

    if (readyMessages.length === 0) {
      this.logger.info('No messages ready to send');
      await this.doUpdateAlarm();
      return;
    }

    // 2. Send batch
    const deps = this.getRetryDeps();
    const sendPromises = readyMessages.map((msg) => sendMessage(msg, deps));
    const results = await Promise.allSettled(sendPromises);

    // 3. Process batch results
    await processBatchResults(readyMessages, results, {
      logger: this.logger,
      addToDeadLetterQueue: (msg, reason) => addToDeadLetterQueue(msg, reason, deps),
    });

    // 4. Update alarm
    await this.doUpdateAlarm();
  }

  // ---------------------------------------------------------------------------
  // Private helpers (response builders, DLQ size)
  // ---------------------------------------------------------------------------

  private async getDLQSize(): Promise<number> {
    try {
      const dlqEntries = await this.state.storage.list({ prefix: 'dlq:' });
      return dlqEntries.size;
    } catch (error) {
      this.logger.error('DLQ size query error', error);
      return 0;
    }
  }

  private jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private errorResponse(error: unknown, status: number = 500): Response {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  private badRequestResponse(message: string): Response {
    return this.errorResponse(message, 400);
  }
}
