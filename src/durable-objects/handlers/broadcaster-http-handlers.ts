// Broadcaster HTTP Handlers
// All HTTP API endpoint handlers for MessageBroadcaster

import type { DurableObjectEvent, BroadcastTarget } from '../../types/websocket-types';
import type { BroadcasterContext } from '../services/broadcaster-helpers';
import type { BroadcasterHelpers } from '../services/broadcaster-helpers';
import type { BroadcasterDeliveryService } from '../services/broadcaster-delivery-service';
import { createContextLogger } from '../../utils/logger';
import { nowMs } from '@/utils/timestamp'

const log = createContextLogger('MessageBroadcaster');

/**
 * HTTP API handlers for MessageBroadcaster.
 * Parses requests, delegates to delivery service, formats responses.
 */
export class BroadcasterHttpHandlers {
  constructor(
    private ctx: BroadcasterContext,
    private delivery: BroadcasterDeliveryService,
    private helpers: BroadcasterHelpers
  ) {}

  async handleBroadcast(request: Request): Promise<Response> {
    try {
      const { event, targets, options } = await request.json() as {
        event: DurableObjectEvent;
        targets: BroadcastTarget[];
        options?: any;
      };

      if (!this.helpers.validateEvent(event)) {
        return new Response(JSON.stringify({ error: 'Invalid event format' }), { status: 400 });
      }

      await this.delivery.queueEvent(event, targets, options);

      return new Response(JSON.stringify({
        success: true,
        eventId: event.id,
        queuedAt: nowMs(),
        queueDepth: this.ctx.eventQueue.length
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Broadcast error:', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
    }
  }

  async handleBroadcastToConversations(request: Request): Promise<Response> {
    try {
      const startTime = nowMs();
      const { event, targets } = await request.json() as { event: DurableObjectEvent; targets: string[] };

      if (!event || !targets || !Array.isArray(targets)) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }

      const { successful, failed } = await this.delivery.batchDeliverToConversations(event, targets);

      const processingTime = Date.now() - startTime;
      this.ctx.stats.totalEvents++;
      this.ctx.stats.successfulDeliveries += successful;
      this.ctx.stats.failedDeliveries += failed;
      this.helpers.updateAverageLatency(processingTime);

      return new Response(JSON.stringify({
        success: true,
        eventId: event.id,
        targetCount: targets.length,
        successful,
        failed,
        processingTime
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Broadcast to conversations error:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
    }
  }

  async handleBroadcastToUsers(request: Request): Promise<Response> {
    try {
      const startTime = nowMs();
      const { event, userIds } = await request.json() as { event: DurableObjectEvent; userIds: string[] };

      if (!event || !userIds || !Array.isArray(userIds)) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }

      const { successful, failed } = await this.delivery.batchDeliverToUsers(event, userIds);

      const processingTime = Date.now() - startTime;
      this.ctx.stats.totalEvents++;
      this.ctx.stats.successfulDeliveries += successful;
      this.ctx.stats.failedDeliveries += failed;
      this.helpers.updateAverageLatency(processingTime);

      return new Response(JSON.stringify({
        success: true,
        eventId: event.id,
        targetCount: userIds.length,
        successful,
        failed,
        processingTime
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Broadcast to users error:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
    }
  }

  async handleBroadcastToTeams(request: Request): Promise<Response> {
    try {
      const startTime = nowMs();
      const { event, teamIds } = await request.json() as { event: DurableObjectEvent; teamIds: number[] };

      if (!event || !teamIds || !Array.isArray(teamIds)) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }

      const { successful, failed } = await this.delivery.batchDeliverToTeams(event, teamIds);

      const processingTime = Date.now() - startTime;
      this.ctx.stats.totalEvents++;
      this.ctx.stats.successfulDeliveries += successful;
      this.ctx.stats.failedDeliveries += failed;
      this.helpers.updateAverageLatency(processingTime);

      return new Response(JSON.stringify({
        success: true,
        eventId: event.id,
        targetCount: teamIds.length,
        successful,
        failed,
        processingTime
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Broadcast to teams error:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
    }
  }

  /**
   * Security Enhancement (P1): Broadcast to specific teams AND all admin users
   * Ensures team-scoped data isolation while allowing admins to monitor all conversations
   */
  async handleBroadcastToTeamsAndAdmins(request: Request): Promise<Response> {
    try {
      const startTime = nowMs();
      const { event, teamIds, includeAdmins = true } = await request.json() as {
        event: DurableObjectEvent;
        teamIds: number[];
        includeAdmins?: boolean;
      };

      if (!event || !teamIds || !Array.isArray(teamIds)) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }

      let successful = 0;
      let failed = 0;

      // 1. Deliver to specified teams
      const { successful: teamSuccess, failed: teamFailed } = await this.delivery.batchDeliverToTeams(event, teamIds);
      successful += teamSuccess;
      failed += teamFailed;

      // 2. Deliver to all admin users (if includeAdmins is true)
      if (includeAdmins) {
        try {
          const adminUsers = await this.helpers.getAdminUsers();
          log.info(' [Security] Broadcasting to admin users', { adminCount: adminUsers.length, teamIds });

          const adminPromises = adminUsers.map(async (userId: string) => {
            try {
              const delivered = await this.delivery.deliverToUser(userId, [event]);
              return delivered;
            } catch (error) {
              log.error('Admin user delivery error', { userId, error: error instanceof Error ? error.message : String(error) });
              return 0;
            }
          });

          const adminResults = await Promise.allSettled(adminPromises);
          adminResults.forEach(result => {
            if (result.status === 'fulfilled') {
              successful += result.value;
            } else {
              failed++;
            }
          });
        } catch (adminError) {
          log.error('Failed to broadcast to admins', { error: adminError instanceof Error ? adminError.message : String(adminError) });
        }
      }

      const processingTime = Date.now() - startTime;
      this.ctx.stats.totalEvents++;
      this.ctx.stats.successfulDeliveries += successful;
      this.ctx.stats.failedDeliveries += failed;
      this.helpers.updateAverageLatency(processingTime);

      return new Response(JSON.stringify({
        success: true,
        eventId: event.id,
        teamCount: teamIds.length,
        includeAdmins,
        successful,
        failed,
        processingTime
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Broadcast to teams and admins error:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
    }
  }

  async handleBroadcastGlobal(request: Request): Promise<Response> {
    try {
      const { event, target } = await request.json() as { event: DurableObjectEvent; target?: BroadcastTarget };

      if (!event) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }

      let successful = 0;
      let failed = 0;

      try {
        const deliveredCount = await this.delivery.deliverGlobalBroadcast([
          { ...event, targets: [target || { type: 'global', targets: ['all'] }] }
        ]);
        successful = deliveredCount;
      } catch (error) {
        log.error('Failed global broadcast', { error: error instanceof Error ? error.message : String(error) });
        failed = 1;
      }

      this.ctx.stats.totalEvents++;
      this.ctx.stats.successfulDeliveries += successful;
      this.ctx.stats.failedDeliveries += failed;

      return new Response(JSON.stringify({
        success: true,
        eventId: event.id,
        successful,
        failed
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Global broadcast error:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
    }
  }

  async handleBatchBroadcast(request: Request): Promise<Response> {
    try {
      const startTime = nowMs();
      const { events, targets } = await request.json() as { events: DurableObjectEvent[]; targets: BroadcastTarget[] };

      if (!events || !Array.isArray(events) || !targets || !Array.isArray(targets)) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }

      let processed = 0;
      let successful = 0;
      let failed = 0;

      // Group events by target for efficient delivery
      const eventsByTarget = new Map<string, any[]>();

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const eventTargets = targets[i] || targets[0];

        if (eventTargets.type === 'conversation') {
          for (const conversationId of eventTargets.targets) {
            const key = String(conversationId);
            if (!eventsByTarget.has(key)) eventsByTarget.set(key, []);
            eventsByTarget.get(key)!.push(event);
          }
        } else if (eventTargets.type === 'user') {
          for (const userId of eventTargets.targets) {
            const key = `user:${String(userId)}`;
            if (!eventsByTarget.has(key)) eventsByTarget.set(key, []);
            eventsByTarget.get(key)!.push(event);
          }
        } else if (eventTargets.type === 'team') {
          for (const teamId of eventTargets.targets) {
            const key = `team:${String(teamId)}`;
            if (!eventsByTarget.has(key)) eventsByTarget.set(key, []);
            eventsByTarget.get(key)!.push(event);
          }
        }
        processed++;
      }

      // Deliver to each target
      const deliveryPromises = Array.from(eventsByTarget.entries()).map(async ([targetKey, targetEvents]) => {
        try {
          if (targetKey.startsWith('user:')) {
            const userId = targetKey.substring(5);
            await this.delivery.deliverToUser(userId, targetEvents);
            return { success: targetEvents.length, failed: 0 };
          } else if (targetKey.startsWith('team:')) {
            const teamId = targetKey.substring(5);
            await this.delivery.deliverToTeam(teamId, targetEvents);
            return { success: targetEvents.length, failed: 0 };
          } else {
            // Conversation
            await this.delivery.deliverToConversation(targetKey, targetEvents);
            return { success: targetEvents.length, failed: 0 };
          }
        } catch (error) {
          log.error('Failed to deliver to target', { targetKey, error: error instanceof Error ? error.message : String(error) });
          return { success: 0, failed: targetEvents.length };
        }
      });

      const results = await Promise.allSettled(deliveryPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successful += result.value.success;
          failed += result.value.failed;
        } else {
          failed += 1;
        }
      });

      const processingTime = Date.now() - startTime;
      this.ctx.stats.totalEvents += processed;
      this.ctx.stats.successfulDeliveries += successful;
      this.ctx.stats.failedDeliveries += failed;
      this.helpers.updateAverageLatency(processingTime);

      return new Response(JSON.stringify({
        success: true,
        processed,
        successful,
        failed
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Batch broadcast error:', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: 'Batch broadcast failed' }), { status: 500 });
    }
  }

  async handleQueueEvent(request: Request): Promise<Response> {
    return this.handleBroadcast(request);
  }

  async handleFlushQueue(request: Request): Promise<Response> {
    const { priority } = await request.json() as { priority?: string };

    if (priority === 'high') {
      await this.delivery.processHighPriorityQueue();
    } else {
      await this.delivery.processEventQueue();
    }

    return new Response(JSON.stringify({
      success: true,
      remainingEvents: this.ctx.eventQueue.length + this.ctx.highPriorityQueue.length
    }));
  }

  async handleUpdateFilters(request: Request): Promise<Response> {
    const { target, subscriptions } = await request.json() as { target: string; subscriptions: any };
    this.ctx.targetFilters.set(target, subscriptions);

    return new Response(JSON.stringify({ success: true }));
  }

  async handleSystemBroadcast(request: Request): Promise<Response> {
    const { message, priority = 'normal' } = await request.json() as {
      message: string;
      priority?: 'low' | 'high' | 'urgent' | 'normal';
    };

    const systemEvent: DurableObjectEvent = {
      id: this.helpers.generateEventId(),
      type: 'system_notification',
      source: 'system',
      timestamp: nowMs(),
      data: message,
      priority,
      deliveryOptions: {
        broadcast: true,
        targets: [{ type: 'global', targets: ['all'] }]
      }
    };

    await this.delivery.queueEvent(systemEvent, [{ type: 'global', targets: ['all'] }]);

    return new Response(JSON.stringify({
      success: true,
      eventId: systemEvent.id
    }));
  }

  async handleGetMetrics(_request: Request): Promise<Response> {
    const metrics = {
      totalEvents: this.ctx.stats.totalEvents,
      successfulBroadcasts: this.ctx.stats.successfulDeliveries,
      successfulDeliveries: this.ctx.stats.successfulDeliveries,
      failedBroadcasts: this.ctx.stats.failedDeliveries,
      failedDeliveries: this.ctx.stats.failedDeliveries,
      averageLatency: this.ctx.stats.averageLatency,
      eventsPerSecond: this.ctx.stats.eventsPerSecond,
      lastProcessed: this.ctx.stats.lastProcessed,
      queueDepth: this.ctx.stats.queueDepth,
      activeConnections: this.ctx.stats.activeConnections,
      conversationRooms: this.ctx.conversationRooms.size,
      userConnections: this.ctx.userConnections.size,
      eventQueueDepth: this.ctx.eventQueue.length,
      highPriorityQueueDepth: this.ctx.highPriorityQueue.length,
      activeLocks: this.ctx.locks.size,
      uptime: Date.now() - (this.ctx.stats.lastProcessed - 3600000),
      memoryUsage: (process as any).memoryUsage?.() || { heapUsed: 0, heapTotal: 0 }
    };

    return new Response(JSON.stringify(metrics));
  }

  async handleGetStatus(_request: Request): Promise<Response> {
    const isHealthy = this.ctx.eventQueue.length < this.ctx.config.MAX_QUEUE_SIZE * 0.8;
    const errorRate = this.ctx.stats.totalEvents > 0
      ? this.ctx.stats.failedDeliveries / this.ctx.stats.totalEvents
      : 0;

    const status = {
      isHealthy,
      queueDepth: this.ctx.stats.queueDepth,
      processingRate: this.ctx.stats.eventsPerSecond,
      lastProcessed: this.ctx.stats.lastProcessed,
      activeConnections: this.ctx.stats.activeConnections,
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: Date.now() - (this.ctx.stats.lastProcessed - 3600000),
      eventProcessingRate: this.ctx.stats.eventsPerSecond,
      errorRate: errorRate,
      averageLatency: this.ctx.stats.averageLatency,
      memoryUsage: (process as any).memoryUsage?.() || { heapUsed: 0, heapTotal: 0 },
      timestamp: nowMs()
    };

    return new Response(JSON.stringify(status));
  }
}
