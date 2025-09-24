/**
 * Latest Message Background Worker
 * Processes queue jobs to update latest message cache
 */

import type { Bindings } from '../types';
import { LatestMessageCache } from '../services/latest-message-cache';

export interface LatestMessageJobPayload {
  type: 'update_latest_message' | 'invalidate_cache' | 'warmup_cache';
  conversationId?: string;
  messageId?: string;
  priority?: 'low' | 'normal' | 'high';
  timestamp?: string;
}

export class LatestMessageWorker {
  private readonly cache: LatestMessageCache;
  private readonly env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
    this.cache = new LatestMessageCache(env);
  }

  /**
   * Main queue consumer function
   */
  async handleQueueMessage(batch: MessageBatch<LatestMessageJobPayload>): Promise<void> {
    console.log(`🔄 [LatestMessageWorker] Processing batch of ${batch.messages.length} jobs`);

    const results = await Promise.allSettled(
      batch.messages.map(msg => this.processJob(msg))
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ [LatestMessageWorker] Batch completed: ${successful} success, ${failed} failed`);

    // Handle failures
    const failures = results
      .map((r, i) => ({ result: r, message: batch.messages[i] }))
      .filter(({ result, message }) => result.status === 'rejected' && message);

    for (const { result, message } of failures) {
      if (message) {
        console.error(`❌ [LatestMessageWorker] Job failed:`, {
          messageId: message.id,
          payload: message.body,
          error: (result as PromiseRejectedResult).reason
        });

        // Retry logic could go here
        await this.handleJobFailure(message);
      }
    }

    // Acknowledge all messages
    batch.ackAll();
  }

  /**
   * Process individual job
   */
  private async processJob(message: Message<LatestMessageJobPayload>): Promise<void> {
    const payload = message.body;
    const jobId = message.id;

    console.log(`🔧 [LatestMessageWorker] Processing job ${jobId}:`, payload.type);

    try {
      switch (payload.type) {
        case 'update_latest_message':
          await this.handleUpdateLatestMessage(payload);
          break;

        case 'invalidate_cache':
          await this.handleInvalidateCache(payload);
          break;

        case 'warmup_cache':
          await this.handleWarmupCache(payload);
          break;

        default:
          throw new Error(`Unknown job type: ${(payload as any).type}`);
      }

      console.log(`✅ [LatestMessageWorker] Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`❌ [LatestMessageWorker] Job ${jobId} failed:`, error);
      throw error; // Re-throw to mark as failed
    }
  }

  /**
   * Handle update latest message job
   */
  private async handleUpdateLatestMessage(payload: LatestMessageJobPayload): Promise<void> {
    if (!payload.conversationId) {
      throw new Error('conversationId is required for update_latest_message job');
    }

    const { conversationId } = payload;

    // Invalidate existing cache first
    await this.cache.invalidateLatestMessage(conversationId);

    // Query fresh data and populate cache
    const latestMessage = await this.cache.getLatestMessage(conversationId);

    if (latestMessage) {
      console.log(`📝 [LatestMessageWorker] Updated cache for conversation ${conversationId}`);

      // Optional: Broadcast to WebSocket clients that latest message changed
      await this.broadcastLatestMessageUpdate(conversationId, latestMessage);
    } else {
      console.warn(`⚠️ [LatestMessageWorker] No latest message found for conversation ${conversationId}`);
    }
  }

  /**
   * Handle cache invalidation job
   */
  private async handleInvalidateCache(payload: LatestMessageJobPayload): Promise<void> {
    if (!payload.conversationId) {
      throw new Error('conversationId is required for invalidate_cache job');
    }

    await this.cache.invalidateLatestMessage(payload.conversationId);
    console.log(`🗑️ [LatestMessageWorker] Invalidated cache for conversation ${payload.conversationId}`);
  }

  /**
   * Handle cache warmup job
   */
  private async handleWarmupCache(_payload: LatestMessageJobPayload): Promise<void> {
    const limit = 100; // Warm up top 100 conversations
    const warmedUp = await this.cache.warmupCache(limit);
    console.log(`🔥 [LatestMessageWorker] Cache warmup completed: ${warmedUp} conversations`);
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(message: Message<LatestMessageJobPayload>): Promise<void> {
    const retryCount = (message as any).retryCount || 0;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s

      console.log(`🔄 [LatestMessageWorker] Scheduling retry ${retryCount + 1}/${maxRetries} for job ${message.id} in ${retryDelay}ms`);

      // In a real implementation, you'd reschedule the job
      // For now, we'll just log it
      setTimeout(async () => {
        try {
          await this.processJob(message);
        } catch (error) {
          console.error(`❌ [LatestMessageWorker] Retry ${retryCount + 1} failed for job ${message.id}:`, error);
        }
      }, retryDelay);
    } else {
      console.error(`💀 [LatestMessageWorker] Job ${message.id} failed permanently after ${maxRetries} retries`);

      // Send to dead letter queue or alert monitoring
      await this.handlePermanentFailure(message);
    }
  }

  /**
   * Handle permanent job failure
   */
  private async handlePermanentFailure(message: Message<LatestMessageJobPayload>): Promise<void> {
    // Log to monitoring system
    console.error(`💀 [LatestMessageWorker] PERMANENT FAILURE:`, {
      messageId: message.id,
      payload: message.body,
      timestamp: new Date().toISOString()
    });

    // Could send alert to monitoring system here
    // Could write to dead letter queue
    // For now, just ensure we don't lose track
  }

  /**
   * Broadcast latest message update via WebSocket
   */
  private async broadcastLatestMessageUpdate(
    conversationId: string,
    latestMessage: any
  ): Promise<void> {
    try {
      // Use the existing WebSocket broadcast service
      const event = {
        type: 'latest_message_updated',
        conversationId,
        data: {
          content: latestMessage.content,
          createdAt: latestMessage.createdAt,
          senderType: latestMessage.senderType
        },
        timestamp: new Date().toISOString()
      };

      // Get the MessageBroadcaster Durable Object
      const broadcasterId = this.env.MESSAGE_BROADCASTER?.idFromName('global');
      const broadcaster = broadcasterId ? this.env.MESSAGE_BROADCASTER?.get(broadcasterId) : null;

      if (broadcaster) {
        await broadcaster.fetch('http://localhost/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: [event],
            targets: [
              {
                type: 'conversation',
                targets: [conversationId]
              }
            ]
          })
        });
      }

      console.log(`📡 [LatestMessageWorker] Broadcasted latest message update for conversation ${conversationId}`);
    } catch (error) {
      console.warn(`⚠️ [LatestMessageWorker] Failed to broadcast latest message update:`, error);
      // Don't fail the job for broadcast failures
    }
  }
}

/**
 * Queue consumer function for Cloudflare Workers
 */
export async function handleLatestMessageQueue(
  batch: MessageBatch<LatestMessageJobPayload>,
  env: Bindings
): Promise<void> {
  const worker = new LatestMessageWorker(env);
  await worker.handleQueueMessage(batch);
}

/**
 * Utility functions for enqueuing jobs
 */
export class LatestMessageJobQueue {
  private readonly queue: Queue<LatestMessageJobPayload>;

  constructor(env: Bindings) {
    this.queue = env.REALTIME_QUEUE; // Reuse existing queue
  }

  /**
   * Enqueue job to update latest message cache
   */
  async updateLatestMessage(
    conversationId: string,
    messageId?: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<void> {
    try {
      const payload: LatestMessageJobPayload = {
        type: 'update_latest_message',
        conversationId,
        priority,
        timestamp: new Date().toISOString()
      };

      if (messageId) {
        payload.messageId = messageId;
      }

      await this.queue.send(payload);

      console.log(`📤 [LatestMessageJobQueue] Enqueued update job for conversation ${conversationId}`);
    } catch (error) {
      console.error(`❌ [LatestMessageJobQueue] Failed to enqueue update job:`, error);
      throw error;
    }
  }

  /**
   * Enqueue job to invalidate cache
   */
  async invalidateCache(conversationId: string): Promise<void> {
    try {
      await this.queue.send({
        type: 'invalidate_cache',
        conversationId,
        timestamp: new Date().toISOString()
      });

      console.log(`📤 [LatestMessageJobQueue] Enqueued invalidation job for conversation ${conversationId}`);
    } catch (error) {
      console.error(`❌ [LatestMessageJobQueue] Failed to enqueue invalidation job:`, error);
      // Don't throw - invalidation is not critical
    }
  }

  /**
   * Enqueue cache warmup job
   */
  async warmupCache(): Promise<void> {
    try {
      await this.queue.send({
        type: 'warmup_cache',
        timestamp: new Date().toISOString()
      });

      console.log(`📤 [LatestMessageJobQueue] Enqueued cache warmup job`);
    } catch (error) {
      console.error(`❌ [LatestMessageJobQueue] Failed to enqueue warmup job:`, error);
      throw error;
    }
  }
}