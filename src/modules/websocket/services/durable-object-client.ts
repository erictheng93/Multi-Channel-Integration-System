// Durable Object Client
// Handles all communication with Durable Objects for WebSocket broadcasting
// Includes circuit breaker integration and target routing
// Extracted from websocket-broadcast-service.ts (Phase 4 refactor)

import type { Bindings } from '@/types';
import type {
  DurableObjectEvent,
  BroadcastTarget
} from '@/types/websocket-types';
import type { LogContext } from '@/services/logger-service';
import { Logger, createLogger, PerformanceTimer } from '@/services/logger-service';
import { getCircuitBreaker, type WebSocketCircuitBreaker, CircuitState } from '@/services/websocket-circuit-breaker';
import type { BroadcastConfig } from './broadcast-config';
import type { BatchQueueManager } from './batch-queue-manager';
import { nowISO } from '@/utils/timestamp'

/**
 * DurableObjectClient
 *
 * Manages all communication with Durable Objects for WebSocket event distribution.
 * Integrates circuit breaker for automatic degradation when errors exceed threshold.
 *
 * Routing logic:
 * - conversation targets → ConversationRoom DO
 * - user targets → UserConnection DO
 * - team targets → MessageBroadcaster DO
 * - global targets → MessageBroadcaster DO
 */
export class DurableObjectClient {
  private env: Bindings;
  private config: BroadcastConfig;
  private logger: Logger;
  private circuitBreaker: WebSocketCircuitBreaker;
  private batchManager: BatchQueueManager | null = null;

  constructor(
    env: Bindings,
    config: BroadcastConfig,
    circuitBreaker?: WebSocketCircuitBreaker
  ) {
    this.env = env;
    this.config = config;

    this.logger = createLogger({ service: 'DurableObjectClient' }, {
      serviceName: 'durable-object-client'
    });

    this.circuitBreaker = circuitBreaker ?? getCircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      errorRateThreshold: 0.25,
      volumeThreshold: 10
    });
    this.circuitBreaker.setEnv(env);
  }

  /**
   * Set the batch manager reference (for circuit breaker fallback queueing)
   */
  setBatchManager(batchManager: BatchQueueManager): void {
    this.batchManager = batchManager;
  }

  /**
   * Main broadcast method — routes event to appropriate DOs based on delivery targets.
   * Protected by circuit breaker with fallback to batch queue.
   */
  async broadcast(event: DurableObjectEvent): Promise<boolean> {
    const migrationConfig = await this.config.getMigrationConfig();

    if (!migrationConfig.enableWebSocket || !migrationConfig.featureFlags.durableObjectMessaging) {
      this.logger.warn('WebSocket disabled', {
        eventId: event.id,
        eventType: event.type
      });
      return false;
    }

    const context: LogContext = {
      eventId: event.id,
      userId: event.userId,
      conversationId: event.conversationId
    };

    return await this.circuitBreaker.execute(
      async () => {
        const timer = new PerformanceTimer(this.logger, 'websocket_broadcast', context);

        try {
          const promises: Promise<boolean>[] = [];

          if (event.deliveryOptions?.targets) {
            for (const target of event.deliveryOptions.targets) {
              switch (target.type) {
                case 'conversation':
                  promises.push(this.broadcastToConversationRooms(event, target.targets as string[]));
                  break;
                case 'user':
                  promises.push(this.broadcastToUserConnections(event, target.targets as string[]));
                  break;
                case 'team':
                  promises.push(this.broadcastToTeamMembers(event, target.targets as number[]));
                  break;
                case 'global':
                  promises.push(this.broadcastToGlobal(event, target));
                  break;
              }
            }
          }

          const results = await Promise.allSettled(promises);
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

          const duration = timer.end({
            targetCount: promises.length,
            successCount
          });

          this.logger.info('WebSocket broadcast completed', context, {
            duration,
            targetCount: promises.length,
            successCount,
            eventType: event.type,
            priority: event.priority
          });

          return successCount > 0;
        } catch (error) {
          this.logger.error('WebSocket broadcast error', error, context);
          throw error; // Re-throw to trigger circuit breaker
        }
      },
      // Fallback: queue for delayed processing
      async () => {
        this.logger.warn('Circuit OPEN - using fallback queue', context, {
          circuitState: this.circuitBreaker.getState()
        });

        if (this.batchManager) {
          this.batchManager.enqueue(event);
        }
        return true;
      },
      context
    );
  }

  /**
   * Broadcast multiple events in batch
   */
  async broadcastBatch(events: DurableObjectEvent[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: boolean[];
  }> {
    const results: boolean[] = [];
    let successful = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const result = await this.broadcast(event);
        results.push(result);
        if (result) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        this.logger.error('Batch event broadcast error', error, {
          eventId: event.id
        });
        results.push(false);
        failed++;
      }
    }

    return { total: events.length, successful, failed, results };
  }

  /**
   * Broadcast to ConversationRoom Durable Objects
   */
  async broadcastToConversationRooms(event: DurableObjectEvent, conversationIds: string[]): Promise<boolean> {
    try {
      const promises = conversationIds.map(async (conversationId) => {
        if (!this.env.CONVERSATION_ROOM) {
          console.warn('CONVERSATION_ROOM binding not available');
          return false;
        }

        const roomId = this.env.CONVERSATION_ROOM.idFromName(conversationId);
        const roomStub = this.env.CONVERSATION_ROOM.get(roomId);

        if (roomStub) {
          const response = await roomStub.fetch(new Request('https://conversation-room/broadcast', {
            method: 'POST',
            body: JSON.stringify(event),
            headers: { 'Content-Type': 'application/json' }
          }));

          return response.ok;
        }
        return false;
      });

      const results = await Promise.allSettled(promises);
      return results.some(r => r.status === 'fulfilled' && r.value);
    } catch (error) {
      console.error('❌ [DurableObjectClient] ConversationRoom broadcast error:', error);
      return false;
    }
  }

  /**
   * Broadcast to UserConnection Durable Objects
   */
  async broadcastToUserConnections(event: DurableObjectEvent, userIds: string[]): Promise<boolean> {
    try {
      const promises = userIds.map(async (userId) => {
        if (!this.env.USER_CONNECTION) {
          console.warn('USER_CONNECTION binding not available');
          return false;
        }

        const userConnectionId = this.env.USER_CONNECTION.idFromName(userId);
        const userConnectionStub = this.env.USER_CONNECTION.get(userConnectionId);

        if (userConnectionStub) {
          const response = await userConnectionStub.fetch(new Request('https://user-connection/broadcast', {
            method: 'POST',
            body: JSON.stringify(event),
            headers: { 'Content-Type': 'application/json' }
          }));

          return response.ok;
        }
        return false;
      });

      const results = await Promise.allSettled(promises);
      return results.some(r => r.status === 'fulfilled' && r.value);
    } catch (error) {
      console.error('❌ [DurableObjectClient] UserConnection broadcast error:', error);
      return false;
    }
  }

  /**
   * Broadcast to team members via MessageBroadcaster DO
   * @param includeAdmins - If true, also broadcast to all admin users
   */
  async broadcastToTeamMembers(event: DurableObjectEvent, teamIds: number[], includeAdmins: boolean = false): Promise<boolean> {
    try {
      if (!this.env.MESSAGE_BROADCASTER) {
        console.warn('MESSAGE_BROADCASTER binding not available');
        return false;
      }

      const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

      if (broadcasterStub) {
        console.log('📤 [DurableObjectClient] ===== TEAM BROADCAST INITIATED =====');
        console.log('📤 [DurableObjectClient] Broadcasting to teams', {
          eventId: event.id,
          eventType: event.type,
          eventAction: (event.data as Record<string, unknown>)?.action,
          targetTeamIds: teamIds,
          includeAdmins,
          conversationId: event.conversationId,
          fromTeamId: (event.data as Record<string, unknown>)?.fromTeamId,
          toTeamId: (event.data as Record<string, unknown>)?.toTeamId,
          timestamp: nowISO()
        });

        const endpoint = includeAdmins
          ? 'https://message-broadcaster/broadcast-to-teams-and-admins'
          : 'https://message-broadcaster/broadcast-to-teams';

        const response = await broadcasterStub.fetch(new Request(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            event,
            teamIds,
            ...(includeAdmins && { includeAdmins: true })
          }),
          headers: { 'Content-Type': 'application/json' }
        }));

        if (response.ok) {
          const result = await response.json() as { successful?: number; failed?: number };
          console.log('✅ [DurableObjectClient] Team broadcast completed', {
            eventId: event.id,
            eventAction: (event.data as Record<string, unknown>)?.action,
            targetTeamIds: teamIds,
            includeAdmins,
            successful: result.successful,
            failed: result.failed
          });
        }

        return response.ok;
      }
      return false;
    } catch (error) {
      console.error('❌ [DurableObjectClient] Team broadcast error:', error);
      return false;
    }
  }

  /**
   * Broadcast to global audience (admins, etc.) via MessageBroadcaster DO
   */
  async broadcastToGlobal(event: DurableObjectEvent, target: BroadcastTarget): Promise<boolean> {
    try {
      if (!this.env.MESSAGE_BROADCASTER) {
        console.warn('MESSAGE_BROADCASTER binding not available');
        return false;
      }

      const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

      if (broadcasterStub) {
        const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-global', {
          method: 'POST',
          body: JSON.stringify({
            event,
            target
          }),
          headers: { 'Content-Type': 'application/json' }
        }));

        return response.ok;
      }
      return false;
    } catch (error) {
      console.error('❌ [DurableObjectClient] Global broadcast error:', error);
      return false;
    }
  }
}
