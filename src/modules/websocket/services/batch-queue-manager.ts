// Batch Queue Manager
// Manages event batching, timers, and metrics for WebSocket broadcast optimization
// Extracted from websocket-broadcast-service.ts (Phase 2 refactor)

import type { DurableObjectEvent } from '@/types/websocket-types';
import { Logger, createLogger } from '@/services/logger-service';

/**
 * Batch Configuration
 * Controls the batching behavior for optimizing Durable Objects calls
 */
export interface BatchConfig {
  enabled: boolean; // Enable/disable batching
  maxBatchSize: number; // Maximum events per batch
  batchWindowMs: number; // Time window for collecting events (ms)
  urgentBypass: boolean; // Urgent events bypass batching
}

/**
 * Batch queue status snapshot
 */
export interface BatchQueueStatus {
  queueSize: number;
  timerActive: boolean;
  config: BatchConfig;
  metrics: {
    totalEvents: number;
    batchedEvents: number;
    immediateEvents: number;
    batchesSent: number;
    avgBatchSize: number;
  };
}

/**
 * BatchQueueManager
 *
 * Manages event batching to reduce Durable Objects calls by 60-80%.
 * Events are collected into a queue and flushed either when:
 * - The batch window timer fires (batchWindowMs)
 * - The queue reaches maxBatchSize
 * - flush() is called explicitly
 *
 * Takes a flushCallback to decouple from the DO client, avoiding
 * circular dependencies between batch manager and DO client.
 */
export class BatchQueueManager {
  private batchQueue: DurableObjectEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private batchConfig: BatchConfig;
  private flushCallback: ((events: DurableObjectEvent[]) => Promise<void>) | null;

  // Performance metrics
  private metrics = {
    totalEvents: 0,
    batchedEvents: 0,
    immediateEvents: 0,
    batchesSent: 0,
    avgBatchSize: 0
  };

  // Memory leak prevention
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly METRICS_RESET_INTERVAL = 3600000; // 1 hour
  private metricsResetTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  private logger: Logger;

  constructor(
    config?: Partial<BatchConfig>,
    flushCallback?: (events: DurableObjectEvent[]) => Promise<void>
  ) {
    this.logger = createLogger({ service: 'BatchQueueManager' }, {
      serviceName: 'batch-queue-manager'
    });

    this.batchConfig = {
      enabled: true,
      maxBatchSize: 50,
      batchWindowMs: 300,
      urgentBypass: true,
      ...config
    };

    this.flushCallback = flushCallback ?? null;

    // Schedule periodic metrics reset
    this.scheduleMetricsReset();
  }

  /**
   * Set or update the flush callback (allows deferred wiring)
   */
  setFlushCallback(callback: (events: DurableObjectEvent[]) => Promise<void>): void {
    this.flushCallback = callback;
  }

  /**
   * Enqueue event for batch processing.
   * Returns true if enqueued, false if service is destroyed or queue overflow.
   */
  enqueue(event: DurableObjectEvent): boolean {
    try {
      if (this.isDestroyed) {
        this.logger.warn('Cannot enqueue event - service destroyed', {
          eventId: event.id,
          eventType: event.type
        });
        return false;
      }

      // Memory leak prevention: hard limit
      if (this.batchQueue.length >= this.MAX_QUEUE_SIZE) {
        this.logger.error('Queue overflow - dropping oldest events', undefined, {
          queueSize: this.batchQueue.length,
          maxSize: this.MAX_QUEUE_SIZE
        });
        const dropCount = Math.floor(this.MAX_QUEUE_SIZE * 0.1);
        this.batchQueue.splice(0, dropCount);
      }

      this.batchQueue.push(event);
      this.metrics.totalEvents++;
      this.metrics.batchedEvents++;

      this.logger.debug('Event enqueued', {
        eventId: event.id,
        eventType: event.type
      }, {
        queueSize: this.batchQueue.length,
        maxBatchSize: this.batchConfig.maxBatchSize
      });

      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.scheduleBatchFlush();
      }

      // Force flush if queue reaches max size
      if (this.batchQueue.length >= this.batchConfig.maxBatchSize) {
        this.logger.info('Max batch size reached, flushing immediately');
        this.flushInternal();
      }

      return true;
    } catch (error) {
      this.logger.error('Enqueue error', error);
      return false;
    }
  }

  /**
   * Flush the batch queue immediately.
   * Combines manualFlush() and flushBatchQueue() from the original.
   */
  async flush(): Promise<void> {
    await this.flushInternal();
  }

  /**
   * Update batch configuration at runtime
   */
  updateConfig(config: Partial<BatchConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config };
    this.logger.info('Batch config updated', undefined, { config: this.batchConfig });

    // If batching was disabled, flush current queue
    if (!this.batchConfig.enabled && this.batchQueue.length > 0) {
      this.logger.info('Batching disabled, flushing queue');
      this.flushInternal();
    }
  }

  /**
   * Get current batch queue status
   */
  getStatus(): BatchQueueStatus {
    return {
      queueSize: this.batchQueue.length,
      timerActive: this.batchTimer !== null,
      config: { ...this.batchConfig },
      metrics: { ...this.metrics }
    };
  }

  /**
   * Check if the batch manager is healthy and not destroyed
   */
  isHealthy(): boolean {
    return !this.isDestroyed && this.batchQueue.length < this.MAX_QUEUE_SIZE;
  }

  /**
   * Check whether an event should be batched based on current config
   */
  shouldBatch(event: DurableObjectEvent): boolean {
    return this.batchConfig.enabled &&
      (!this.batchConfig.urgentBypass || event.priority !== 'urgent');
  }

  /**
   * Record that an event was sent immediately (bypassed batching).
   * Also increments totalEvents so callers only need one call.
   */
  recordImmediateEvent(): void {
    this.metrics.totalEvents++;
    this.metrics.immediateEvents++;
  }

  /**
   * Cleanup resources to prevent memory leaks
   */
  destroy(): void {
    this.isDestroyed = true;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.metricsResetTimer) {
      clearTimeout(this.metricsResetTimer);
      this.metricsResetTimer = null;
    }

    // Flush remaining events before destruction
    if (this.batchQueue.length > 0) {
      this.logger.warn('Destroying service with queued events', undefined, {
        queuedEvents: this.batchQueue.length
      });
      this.flushInternal().catch(() => {});
    }

    this.batchQueue = [];
    this.logger.info('BatchQueueManager destroyed');
  }

  // =================== Private Methods ===================

  private scheduleBatchFlush(): void {
    this.batchTimer = setTimeout(() => {
      this.flushInternal();
    }, this.batchConfig.batchWindowMs);
  }

  private async flushInternal(): Promise<void> {
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.batchQueue.length === 0) {
      return;
    }

    const eventsToSend = [...this.batchQueue];
    this.batchQueue = [];

    // Update metrics
    this.metrics.batchesSent++;
    this.metrics.avgBatchSize = Math.round(
      (this.metrics.avgBatchSize * (this.metrics.batchesSent - 1) + eventsToSend.length) /
      this.metrics.batchesSent
    );

    // Broadcast the batch via callback
    if (this.flushCallback) {
      try {
        await this.flushCallback(eventsToSend);
      } catch (error) {
        this.logger.error('Batch flush error', error, {
          batchSize: eventsToSend.length
        });
      }
    } else {
      this.logger.warn('No flush callback set, dropping batch', undefined, {
        droppedEvents: eventsToSend.length
      });
    }
  }

  private scheduleMetricsReset(): void {
    if (this.metricsResetTimer) {
      clearTimeout(this.metricsResetTimer);
    }

    this.metricsResetTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.resetMetrics();
        this.scheduleMetricsReset();
      }
    }, this.METRICS_RESET_INTERVAL);
  }

  private resetMetrics(): void {
    const oldMetrics = { ...this.metrics };

    this.metrics = {
      totalEvents: 0,
      batchedEvents: 0,
      immediateEvents: 0,
      batchesSent: 0,
      avgBatchSize: oldMetrics.avgBatchSize // Keep rolling average
    };

    this.logger.info('Metrics reset (hourly)', undefined, {
      previousMetrics: oldMetrics
    });
  }
}
