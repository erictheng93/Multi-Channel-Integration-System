/**
 * Shared types for the DelayedMessageScheduler Durable Object.
 *
 * These interfaces are used across schedule-manager, retry-handler,
 * and the main DO class.
 */

/**
 * A message waiting to be sent after a delay.
 */
export interface PendingMessage {
  id: string;
  conversationId: string;
  agentId: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file';
  platform: 'line' | 'facebook';
  recipientPlatformId: string;
  scheduledAt: number; // timestamp ms
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  metadata?: Record<string, any>;
  createdAt: number;
  retryCount?: number;
  lastRetryAt?: number;
  failureReason?: string;
}

/**
 * Result of a cancel operation.
 */
export interface CancelResult {
  success: boolean;
  reason?: string;
  cancelledAt?: number;
}

/**
 * Result of a status query.
 */
export interface StatusResult {
  exists: boolean;
  status?: 'pending' | 'sent' | 'cancelled' | 'failed' | 'not_found';
  timeRemaining?: number; // seconds remaining
  canCancel?: boolean;
  scheduledAt?: number;
}

/**
 * Result of a send-with-retry attempt.
 */
export interface SendResult {
  success: boolean;
  error?: any;
  attempt?: number;
  duration?: number;
}

/**
 * Structured logger interface used by scheduler helpers.
 */
export interface SchedulerLogger {
  info(action: string, context?: Record<string, any>): void;
  success(action: string, context?: Record<string, any>): void;
  warn(action: string, context?: Record<string, any>): void;
  error(action: string, error: any, context?: Record<string, any>): void;
  critical(action: string, error: any, context?: Record<string, any>): void;
}

/**
 * Metrics collector interface used by scheduler helpers.
 */
export interface SchedulerMetrics {
  // Counter Metrics
  messagesSentTotal: number;
  messagesFailedTotal: number;
  messagesCancelledTotal: number;
  messagesScheduledTotal: number;
  retryAttemptsTotal: number;
  dlqWritesTotal: number;
  dlqWriteFailuresTotal: number;
  alarmTriggersTotal: number;
  idempotencyPreventionsTotal: number;

  // Platform-specific counters
  platformSuccesses: {
    line: number;
    facebook: number;
  };
  platformFailures: {
    line: number;
    facebook: number;
  };

  // Histogram data
  sendDurations: number[];
  retryCounts: number[];

  // Helpers
  recordSendDuration(durationMs: number): void;
  recordRetryCount(count: number): void;
  getPercentile(data: number[], percentile: number): number;
}
