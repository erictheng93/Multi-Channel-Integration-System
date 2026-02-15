/**
 * Latest Message Cache Coordinator Durable Object
 *
 * Manages Latest Message Cache updates using alarm-based batch processing
 */

import type { DurableObjectState } from '@cloudflare/workers-types';
import type { Bindings } from '../types';
import { LatestMessageCache } from '../services/latest-message-cache';

/**
 * Update request stored in queue
 */
interface UpdateRequest {
  conversationId: string;
  timestamp: number;
  priority: 'low' | 'normal' | 'high';
  retryCount?: number;
}

/**
 * Processing statistics
 */
interface ProcessingStats {
  totalProcessed: number;
  successfulUpdates: number;
  failedUpdates: number;
  lastProcessedAt: number;
  averageProcessingTime: number;
}

/**
 * Coordinator for managing Latest Message Cache updates
 * Batches updates and processes them via alarm mechanism
 */
export class LatestMessageCacheCoordinator {
  private state: DurableObjectState;
  private env: Bindings;
  private updateQueue: Map<string, UpdateRequest> = new Map();
  private cache: LatestMessageCache;
  private stats: ProcessingStats;
  private alarmScheduled: boolean = false;

  // Configuration
  private readonly BATCH_DELAY_MS = 5000; // 5 seconds batch window
  private readonly MAX_RETRY_COUNT = 3;
  private readonly ALARM_RETRY_DELAY_MS = 60000; // 1 minute retry for failed alarms

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;
    this.cache = new LatestMessageCache(env);
    this.stats = {
      totalProcessed: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      lastProcessedAt: 0,
      averageProcessingTime: 0
    };

    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  /**
   * Load state from Durable Object storage
   */
  private async loadState(): Promise<void> {
    try {
      const storedStats = await this.state.storage.get<ProcessingStats>('stats');
      if (storedStats) {
        this.stats = storedStats;
      }

      const storedQueue = await this.state.storage.get<Array<[string, UpdateRequest]>>('updateQueue');
      if (storedQueue) {
        this.updateQueue = new Map(storedQueue);
        console.log(`📦 [LatestMessageCacheCoordinator] Restored ${this.updateQueue.size} pending updates from storage`);
      }
    } catch (error) {
      console.error('⚠️ [LatestMessageCacheCoordinator] Failed to load state from storage:', error);
      // Initialize with default values if storage load fails
      // This ensures the coordinator can still function
    }
  }

  /**
   * Save state to Durable Object storage
   */
  private async saveState(): Promise<void> {
    try {
      await this.state.storage.put('stats', this.stats);
      await this.state.storage.put('updateQueue', Array.from(this.updateQueue.entries()));
    } catch (error) {
      console.error('⚠️ [LatestMessageCacheCoordinator] Failed to save state to storage:', error);
      // Non-fatal error - state will be reconstructed from operations
    }
  }

  /**
   * Main fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/schedule':
          return await this.handleScheduleUpdate(request);

        case '/invalidate':
          return await this.handleInvalidate(request);

        case '/warmup':
          return await this.handleWarmup(request);

        case '/status':
          return await this.handleGetStatus(request);

        case '/stats':
          return await this.handleGetStats(request);

        case '/queue':
          return await this.handleGetQueue(request);

        case '/trigger-alarm':
          // Manual alarm trigger for testing
          return await this.handleManualAlarmTrigger(request);

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('[LatestMessageCacheCoordinator] Request error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle schedule update request
   */
  private async handleScheduleUpdate(request: Request): Promise<Response> {
    const body = await request.json() as { conversationId?: string; priority?: 'low' | 'normal' | 'high' };
    const { conversationId, priority = 'normal' } = body;

    if (!conversationId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'conversationId is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add or update in queue
    const existingRequest = this.updateQueue.get(conversationId);
    this.updateQueue.set(conversationId, {
      conversationId,
      timestamp: Date.now(),
      priority,
      retryCount: existingRequest?.retryCount || 0
    });

    console.log(`📝 [LatestMessageCacheCoordinator] Scheduled update for conversation ${conversationId} (queue size: ${this.updateQueue.size})`);

    // Schedule alarm if not already scheduled
    await this.scheduleAlarmIfNeeded();

    // Save state
    await this.saveState();

    return new Response(JSON.stringify({
      success: true,
      conversationId,
      queueSize: this.updateQueue.size,
      scheduledAlarm: this.alarmScheduled
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle immediate invalidation request
   */
  private async handleInvalidate(request: Request): Promise<Response> {
    const body = await request.json() as { conversationId?: string };
    const { conversationId } = body;

    if (!conversationId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'conversationId is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      await this.cache.invalidateLatestMessage(conversationId);
      console.log(`🗑️ [LatestMessageCacheCoordinator] Invalidated cache for conversation ${conversationId}`);

      return new Response(JSON.stringify({
        success: true,
        conversationId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[LatestMessageCacheCoordinator] Invalidation error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle cache warmup request
   */
  private async handleWarmup(request: Request): Promise<Response> {
    try {
      const body = await request.json().catch(() => ({})) as { limit?: number };
      const { limit = 100 } = body;
      const warmedUp = await this.cache.warmupCache(limit);

      console.log(`🔥 [LatestMessageCacheCoordinator] Cache warmup completed: ${warmedUp} conversations`);

      return new Response(JSON.stringify({
        success: true,
        warmedUp
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[LatestMessageCacheCoordinator] Warmup error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get coordinator status
   */
  private async handleGetStatus(request: Request): Promise<Response> {
    const currentAlarm = await this.state.storage.getAlarm();

    return new Response(JSON.stringify({
      success: true,
      status: 'healthy',
      queueSize: this.updateQueue.size,
      alarmScheduled: this.alarmScheduled,
      nextAlarmAt: currentAlarm ? new Date(currentAlarm).toISOString() : null,
      stats: this.stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get processing statistics
   */
  private async handleGetStats(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      success: true,
      stats: {
        ...this.stats,
        currentQueueSize: this.updateQueue.size,
        successRate: this.stats.totalProcessed > 0
          ? (this.stats.successfulUpdates / this.stats.totalProcessed * 100).toFixed(2) + '%'
          : 'N/A'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get current queue contents
   */
  private async handleGetQueue(request: Request): Promise<Response> {
    const queueContents = Array.from(this.updateQueue.values()).map(req => ({
      conversationId: req.conversationId,
      priority: req.priority,
      timestamp: new Date(req.timestamp).toISOString(),
      retryCount: req.retryCount || 0
    }));

    return new Response(JSON.stringify({
      success: true,
      queueSize: this.updateQueue.size,
      queue: queueContents
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Manual alarm trigger for testing
   */
  private async handleManualAlarmTrigger(request: Request): Promise<Response> {
    console.log('🔔 [LatestMessageCacheCoordinator] Manual alarm trigger requested');
    await this.alarm();

    return new Response(JSON.stringify({
      success: true,
      message: 'Alarm triggered manually'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Schedule alarm if needed
   */
  private async scheduleAlarmIfNeeded(): Promise<void> {
    if (this.alarmScheduled) {
      // Alarm already scheduled
      return;
    }

    const currentAlarm = await this.state.storage.getAlarm();
    if (currentAlarm) {
      // Alarm already exists
      this.alarmScheduled = true;
      return;
    }

    // Schedule new alarm
    const alarmTime = Date.now() + this.BATCH_DELAY_MS;
    await this.state.storage.setAlarm(alarmTime);
    this.alarmScheduled = true;

    console.log(`⏰ [LatestMessageCacheCoordinator] Alarm scheduled for ${new Date(alarmTime).toISOString()}`);
  }

  /**
   * Alarm handler - process batched updates
   */
  async alarm(): Promise<void> {
    const startTime = Date.now();
    console.log(`🔔 [LatestMessageCacheCoordinator] Alarm triggered - processing ${this.updateQueue.size} updates`);

    this.alarmScheduled = false;

    if (this.updateQueue.size === 0) {
      console.log('📭 [LatestMessageCacheCoordinator] Queue is empty, nothing to process');
      return;
    }

    // Process all queued updates
    const updates = Array.from(this.updateQueue.entries());
    const results = await Promise.allSettled(
      updates.map(([conversationId, request]) => this.processUpdate(conversationId, request))
    );

    // Analyze results
    let successCount = 0;
    let failureCount = 0;
    const failedUpdates: Array<[string, UpdateRequest]> = [];

    results.forEach((result, index) => {
      const [conversationId, request] = updates[index];

      if (result.status === 'fulfilled') {
        successCount++;
        this.updateQueue.delete(conversationId);
      } else {
        failureCount++;
        console.error(`❌ [LatestMessageCacheCoordinator] Failed to update ${conversationId}:`, result.reason);

        // Retry logic
        const retryCount = (request.retryCount || 0) + 1;
        if (retryCount < this.MAX_RETRY_COUNT) {
          failedUpdates.push([conversationId, { ...request, retryCount }]);
        } else {
          console.error(`💀 [LatestMessageCacheCoordinator] Max retries exceeded for ${conversationId}`);
          this.updateQueue.delete(conversationId);
        }
      }
    });

    // Re-add failed updates for retry
    failedUpdates.forEach(([conversationId, request]) => {
      this.updateQueue.set(conversationId, request);
    });

    // Update statistics
    const processingTime = Date.now() - startTime;
    this.stats.totalProcessed += updates.length;
    this.stats.successfulUpdates += successCount;
    this.stats.failedUpdates += failureCount;
    this.stats.lastProcessedAt = Date.now();
    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime * (this.stats.totalProcessed - updates.length) + processingTime) /
      this.stats.totalProcessed;

    console.log(`✅ [LatestMessageCacheCoordinator] Batch completed: ${successCount} success, ${failureCount} failed, ${this.updateQueue.size} remaining`);
    console.log(`📊 [LatestMessageCacheCoordinator] Processing time: ${processingTime}ms, Average: ${this.stats.averageProcessingTime.toFixed(2)}ms`);

    // Save state
    await this.saveState();

    // Reschedule alarm if there are remaining updates
    if (this.updateQueue.size > 0) {
      console.log(`🔄 [LatestMessageCacheCoordinator] Rescheduling alarm for ${this.updateQueue.size} remaining updates`);
      await this.state.storage.setAlarm(Date.now() + this.ALARM_RETRY_DELAY_MS);
      this.alarmScheduled = true;
    }
  }

  /**
   * Process a single cache update
   */
  private async processUpdate(conversationId: string, request: UpdateRequest): Promise<void> {
    try {
      // Invalidate existing cache
      await this.cache.invalidateLatestMessage(conversationId);

      // Query fresh data and populate cache
      const latestMessage = await this.cache.getLatestMessage(conversationId);

      if (latestMessage) {
        console.log(`📝 [LatestMessageCacheCoordinator] Updated cache for conversation ${conversationId}`);

        // Broadcast update via WebSocket
        await this.broadcastLatestMessageUpdate(conversationId, latestMessage);
      } else {
        console.warn(`⚠️ [LatestMessageCacheCoordinator] No latest message found for conversation ${conversationId}`);
      }
    } catch (error) {
      console.error(`❌ [LatestMessageCacheCoordinator] Failed to process update for ${conversationId}:`, error);
      throw error; // Re-throw to mark as failed
    }
  }

  /**
   * Broadcast latest message update via WebSocket
   */
  private async broadcastLatestMessageUpdate(conversationId: string, latestMessage: any): Promise<void> {
    try {
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

        console.log(`📡 [LatestMessageCacheCoordinator] Broadcasted update for conversation ${conversationId}`);
      }
    } catch (error) {
      console.warn(`⚠️ [LatestMessageCacheCoordinator] Failed to broadcast update:`, error);
      // Don't fail the entire update for broadcast failures
    }
  }
}
