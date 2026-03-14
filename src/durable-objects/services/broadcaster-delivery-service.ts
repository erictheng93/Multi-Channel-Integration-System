// Broadcaster Delivery Service
// Event queuing, processing, target delivery, and batch operations

import type { DurableObjectEvent, BroadcastTarget } from '../../types/websocket-types';
import type { BroadcasterContext } from './broadcaster-helpers';
import type { BroadcasterHelpers } from './broadcaster-helpers';
import type { BroadcasterLockService } from './broadcaster-lock-service';
import { createContextLogger } from '../../utils/logger';
import { nowISO, nowMs } from '@/utils/timestamp'

const log = createContextLogger('MessageBroadcaster');

/**
 * Handles all event delivery for MessageBroadcaster:
 * - Queue management with priority-aware overflow eviction
 * - Batch processing of normal and high-priority queues
 * - Target-specific delivery (conversation, user, team, global)
 * - Parallel batch delivery optimization
 */
export class BroadcasterDeliveryService {
  constructor(
    private ctx: BroadcasterContext,
    private helpers: BroadcasterHelpers,
    private lockService: BroadcasterLockService
  ) {}

  // =================== Queue Management ===================

  async queueEvent(event: DurableObjectEvent, targets: BroadcastTarget[], options: any = {}): Promise<void> {
    const enrichedEvent = {
      ...event,
      targets,
      options,
      queuedAt: nowMs(),
      retryCount: 0
    };

    // Route to appropriate queue based on priority
    if (event.priority === 'urgent' || event.priority === 'high') {
      this.ctx.highPriorityQueue.push(enrichedEvent);
    } else {
      this.ctx.eventQueue.push(enrichedEvent);
    }

    // Prevent queue overflow with priority-aware eviction
    if (this.ctx.eventQueue.length > this.ctx.config.MAX_QUEUE_SIZE) {
      const evictionCount = Math.min(
        this.ctx.config.BATCH_SIZE,
        this.ctx.eventQueue.length - this.ctx.config.MAX_QUEUE_SIZE + this.ctx.config.BATCH_SIZE
      );

      const lowPriorityIndices: number[] = [];
      for (let i = 0; i < this.ctx.eventQueue.length && lowPriorityIndices.length < evictionCount; i++) {
        const ev = this.ctx.eventQueue[i];
        if (!ev.priority || ev.priority === 'low' || ev.priority === 'normal') {
          lowPriorityIndices.push(i);
        }
      }

      let removedCount = 0;
      if (lowPriorityIndices.length >= evictionCount) {
        for (let i = lowPriorityIndices.length - 1; i >= 0 && removedCount < evictionCount; i--) {
          this.ctx.eventQueue.splice(lowPriorityIndices[i], 1);
          removedCount++;
        }
      } else {
        const removedEvents = this.ctx.eventQueue.splice(0, evictionCount);
        removedCount = removedEvents.length;
      }

      log.warn('Queue overflow, evicted events (priority-aware)', { removedCount });
      this.ctx.stats.evictedEvents = (this.ctx.stats.evictedEvents || 0) + removedCount;
    }

    if (this.ctx.highPriorityQueue.length > this.ctx.config.MAX_QUEUE_SIZE / 2) {
      log.error('High priority queue overflow', { size: this.ctx.highPriorityQueue.length });
    }

    // Update metrics
    this.ctx.stats.totalEvents++;
    this.ctx.stats.queueDepth = this.ctx.eventQueue.length + this.ctx.highPriorityQueue.length;

    await this.helpers.persistQueueState();
    console.log(`[MessageBroadcaster] Event queued: ${event.id} (Priority: ${event.priority})`);
  }

  // =================== Queue Processing ===================

  async processHighPriorityQueue(): Promise<void> {
    if (this.ctx.highPriorityQueue.length === 0) return;

    const lockId = await this.lockService.acquireLock('high_priority_processing', { ttl: 5000 });

    try {
      const batch = this.ctx.highPriorityQueue.splice(0, this.ctx.config.HIGH_PRIORITY_BATCH_SIZE);
      await this.processBatch(batch, 'high_priority');
    } finally {
      await this.lockService.releaseLock(lockId);
    }
  }

  async processEventQueue(): Promise<void> {
    if (this.ctx.eventQueue.length === 0) return;

    const lockId = await this.lockService.acquireLock('normal_processing', { ttl: 10000 });

    try {
      const batch = this.ctx.eventQueue.splice(0, this.ctx.config.BATCH_SIZE);
      await this.processBatch(batch, 'normal');
    } finally {
      await this.lockService.releaseLock(lockId);
    }
  }

  private async processBatch(events: any[], batchType: string): Promise<void> {
    const startTime = nowMs();
    let successCount = 0;
    let failureCount = 0;

    console.log(`[MessageBroadcaster] Processing ${batchType} batch: ${events.length} events`);

    const targetGroups = this.groupEventsByTarget(events);

    const processingPromises = Array.from(targetGroups.entries()).map(async ([target, targetEvents]) => {
      try {
        const deliveryCount = await this.deliverToTarget(target, targetEvents);
        successCount += deliveryCount;
      } catch (error) {
        log.error('Failed to deliver to target', { target, error: error instanceof Error ? error.message : String(error) });
        failureCount += targetEvents.length;
        await this.retryFailedEvents(targetEvents);
      }
    });

    await Promise.allSettled(processingPromises);

    const processingTime = Date.now() - startTime;
    this.ctx.stats.successfulDeliveries += successCount;
    this.ctx.stats.failedDeliveries += failureCount;
    this.ctx.stats.lastProcessed = nowMs();
    this.ctx.stats.averageLatency =
      (this.ctx.stats.averageLatency + processingTime) / 2;

    console.log(`[MessageBroadcaster] Batch processed: ${successCount} success, ${failureCount} failed, ${processingTime}ms`);
  }

  // =================== Event Grouping ===================

  groupEventsByTarget(events: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const event of events) {
      const targets = event.targets as BroadcastTarget[];

      for (const target of targets) {
        if (target.type === 'conversation') {
          for (const conversationId of target.targets) {
            const key = `conversation:${conversationId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(event);
          }
        } else if (target.type === 'user') {
          for (const userId of target.targets) {
            const key = `user:${userId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(event);
          }
        } else if (target.type === 'team') {
          for (const teamId of target.targets) {
            const key = `team:${teamId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(event);
          }
        } else if (target.type === 'global') {
          const key = 'global:broadcast';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(event);
        }
      }
    }

    return groups;
  }

  // =================== Target-Specific Delivery ===================

  async deliverToTarget(target: string, events: any[]): Promise<number> {
    const [targetType, targetId] = target.split(':');

    if (!targetId && targetType !== 'global') {
      log.warn('Invalid target format', { target });
      return 0;
    }

    switch (targetType) {
      case 'conversation':
        return this.deliverToConversation(targetId!, events);
      case 'user':
        return this.deliverToUser(targetId!, events);
      case 'team':
        return this.deliverToTeam(targetId!, events);
      case 'global':
        return this.deliverGlobalBroadcast(events);
      default:
        log.warn('Unknown target type', { targetType });
        return 0;
    }
  }

  async deliverToConversation(conversationId: string, events: any[]): Promise<number> {
    try {
      let roomStub = this.ctx.conversationRooms.get(conversationId);

      if (!roomStub) {
        const id = this.ctx.env.CONVERSATION_ROOM.idFromName(conversationId);
        roomStub = this.ctx.env.CONVERSATION_ROOM.get(id);
        if (roomStub) {
          this.ctx.conversationRooms.set(conversationId, roomStub);
        }
      }

      if (!roomStub) {
        throw new Error(`Failed to get conversation room stub for ${conversationId}`);
      }

      const response = await roomStub.fetch(new Request('https://conversation-room/batch-events', {
        method: 'POST',
        body: JSON.stringify({ events }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (response.ok) {
        const result = await response.json() as { deliveredCount?: number };
        return result.deliveredCount || events.length;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      log.error('Conversation delivery error', { conversationId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async deliverToUser(userId: string, events: any[]): Promise<number> {
    try {
      let userStub = this.ctx.userConnections.get(userId);

      if (!userStub) {
        const id = this.ctx.env.USER_CONNECTION.idFromName(userId);
        userStub = this.ctx.env.USER_CONNECTION.get(id);
        if (userStub) {
          this.ctx.userConnections.set(userId, userStub);
        }
      }

      if (!userStub) {
        throw new Error(`Failed to get user connection stub for ${userId}`);
      }

      const response = await userStub.fetch(new Request('https://user-connection/batch-events', {
        method: 'POST',
        body: JSON.stringify({ events }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (response.ok) {
        const result = await response.json() as { deliveredCount?: number };
        return result.deliveredCount || events.length;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      log.error('User delivery error', { userId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async deliverToTeam(teamId: string, events: any[]): Promise<number> {
    try {
      const teamMembers = await this.helpers.getTeamMembers(teamId);
      let totalDelivered = 0;

      // Detailed logging for team broadcast debugging
      const eventAction = events[0]?.data?.action;
      const eventId = events[0]?.id;
      const conversationId = events[0]?.conversationId;
      console.log('[MessageBroadcaster] ===== TEAM DELIVERY START =====');
      console.log('[MessageBroadcaster] Delivering to team', {
        teamId,
        memberCount: teamMembers.length,
        memberIds: teamMembers,
        eventId,
        eventAction,
        eventType: events[0]?.type,
        conversationId,
        timestamp: nowISO()
      });

      const deliveryPromises = teamMembers.map(async (userId: string) => {
        try {
          const delivered = await this.deliverToUser(userId, events);
          console.log('[MessageBroadcaster] Delivered to user', {
            userId,
            teamId,
            eventAction,
            delivered
          });
          return delivered;
        } catch (error) {
          log.error('Team member delivery error', { userId, error: error instanceof Error ? error.message : String(error) });
          return 0;
        }
      });

      const results = await Promise.allSettled(deliveryPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          totalDelivered += result.value;
        }
      });

      return totalDelivered;
    } catch (error) {
      log.error('Team delivery error', { teamId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async deliverGlobalBroadcast(events: any[]): Promise<number> {
    try {
      let totalDelivered = 0;

      // DEBUG: Log registered connections before broadcast
      const registeredUsers = Array.from(this.ctx.userConnections.keys());
      const registeredConversations = Array.from(this.ctx.conversationRooms.keys());
      console.log(`[MessageBroadcaster] deliverGlobalBroadcast called:`, {
        eventCount: events.length,
        eventTypes: events.map(e => e.type),
        registeredUserCount: registeredUsers.length,
        registeredUsers: registeredUsers.slice(0, 10),
        registeredConversationCount: registeredConversations.length
      });

      // Broadcast to all active conversation rooms
      const conversationPromises = Array.from(this.ctx.conversationRooms.entries()).map(async ([conversationId, _stub]) => {
        try {
          return await this.deliverToConversation(conversationId, events);
        } catch (error) {
          log.error('Global conversation delivery error', { conversationId, error: error instanceof Error ? error.message : String(error) });
          return 0;
        }
      });

      // Broadcast to all active user connections
      const userPromises = Array.from(this.ctx.userConnections.entries()).map(async ([userId, _stub]) => {
        try {
          console.log(`[MessageBroadcaster] Delivering to user: ${userId}`);
          const result = await this.deliverToUser(userId, events);
          console.log(`[MessageBroadcaster] Delivered to user ${userId}: ${result} events`);
          return result;
        } catch (error) {
          log.error('Global user delivery error', { userId, error: error instanceof Error ? error.message : String(error) });
          return 0;
        }
      });

      const allResults = await Promise.allSettled([...conversationPromises, ...userPromises]);
      allResults.forEach(result => {
        if (result.status === 'fulfilled') {
          totalDelivered += result.value;
        }
      });

      console.log(`[MessageBroadcaster] Global broadcast complete: ${totalDelivered} total deliveries`);
      return totalDelivered;
    } catch (error) {
      log.error('Global broadcast error', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // =================== Retry Logic ===================

  private async retryFailedEvents(events: any[]): Promise<void> {
    const retryableEvents = events.filter(event =>
      (event.retryCount || 0) < 3 &&
      event.priority !== 'low'
    );

    for (const event of retryableEvents) {
      event.retryCount = (event.retryCount || 0) + 1;
      event.retryAt = Date.now() + (event.retryCount * 1000);
      this.ctx.eventQueue.push(event);
    }

    if (retryableEvents.length > 0) {
      console.log(`[MessageBroadcaster] Queued ${retryableEvents.length} events for retry`);
    }
  }

  // =================== Batch Delivery Utilities ===================

  /**
   * Split array into chunks of specified size for parallel batch delivery
   */
  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Parallel batch delivery to conversations
   * Performance: 100 targets × 50ms sequential → 10 batches × 50ms parallel = 90% reduction
   */
  async batchDeliverToConversations(
    event: DurableObjectEvent,
    conversationIds: string[]
  ): Promise<{ successful: number; failed: number }> {
    const startTime = nowMs();
    let successful = 0;
    let failed = 0;

    const batches = this.chunkArray(conversationIds, this.ctx.config.DELIVERY_BATCH_SIZE);
    console.log(`[MessageBroadcaster] Processing ${conversationIds.length} conversations in ${batches.length} batches`);

    for (const batch of batches) {
      const batchPromises = batch.map(async (conversationId) => {
        try {
          await this.deliverToConversation(conversationId, [
            { ...event, targets: [{ type: 'conversation', targets: [conversationId] }] }
          ]);
          return { success: true };
        } catch (error) {
          log.error('Failed to deliver to conversation', { conversationId, error: error instanceof Error ? error.message : String(error) });
          return { success: false };
        }
      });

      const results = await Promise.allSettled(batchPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          successful++;
        } else {
          failed++;
        }
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[MessageBroadcaster] Batch delivery complete: ${successful} success, ${failed} failed in ${processingTime}ms`);
    return { successful, failed };
  }

  /**
   * Parallel batch delivery to users
   */
  async batchDeliverToUsers(
    event: DurableObjectEvent,
    userIds: string[]
  ): Promise<{ successful: number; failed: number }> {
    const startTime = nowMs();
    let successful = 0;
    let failed = 0;

    const batches = this.chunkArray(userIds, this.ctx.config.DELIVERY_BATCH_SIZE);
    console.log(`[MessageBroadcaster] Processing ${userIds.length} users in ${batches.length} batches`);

    for (const batch of batches) {
      const batchPromises = batch.map(async (userId) => {
        try {
          await this.deliverToUser(userId, [
            { ...event, targets: [{ type: 'user', targets: [userId] }] }
          ]);
          return { success: true };
        } catch (error) {
          log.error('Failed to deliver to user', { userId, error: error instanceof Error ? error.message : String(error) });
          return { success: false };
        }
      });

      const results = await Promise.allSettled(batchPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          successful++;
        } else {
          failed++;
        }
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[MessageBroadcaster] Batch delivery complete: ${successful} success, ${failed} failed in ${processingTime}ms`);
    return { successful, failed };
  }

  /**
   * Parallel batch delivery to teams (two-level parallelization)
   */
  async batchDeliverToTeams(
    event: DurableObjectEvent,
    teamIds: number[]
  ): Promise<{ successful: number; failed: number }> {
    const startTime = nowMs();
    let successful = 0;
    let failed = 0;

    const batches = this.chunkArray(teamIds, this.ctx.config.DELIVERY_BATCH_SIZE);
    console.log(`[MessageBroadcaster] Processing ${teamIds.length} teams in ${batches.length} batches`);

    for (const batch of batches) {
      const batchPromises = batch.map(async (teamId) => {
        try {
          await this.deliverToTeam(String(teamId), [
            { ...event, targets: [{ type: 'team', targets: [String(teamId)] }] }
          ]);
          return { success: true };
        } catch (error) {
          log.error('Failed to deliver to team', { teamId, error: error instanceof Error ? error.message : String(error) });
          return { success: false };
        }
      });

      const results = await Promise.allSettled(batchPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          successful++;
        } else {
          failed++;
        }
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[MessageBroadcaster] Batch delivery complete: ${successful} success, ${failed} failed in ${processingTime}ms`);
    return { successful, failed };
  }
}
