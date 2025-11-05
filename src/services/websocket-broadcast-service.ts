// WebSocket Broadcasting Service
// Integrates with Durable Objects for real-time event broadcasting
// Provides fallback to existing SSE/Queue system for backward compatibility

import type { Bindings } from '../types';
import type {
  DurableObjectEvent,
  BroadcastTarget,
  MigrationConfig
} from '../types/websocket-types';
import { DistributedLockService } from './distributed-lock-service';

/**
 * WebSocket Broadcasting Service
 *
 * Architecture:
 * 1. ConversationRoom DO - Conversation-specific events
 * 2. UserConnection DO - User-specific cross-conversation events
 * 3. MessageBroadcaster DO - Efficient event distribution
 * 4. DelayedMessageProcessor DO - Batch processing updates
 * 5. Fallback to existing SSE/Queue system
 */
export class WebSocketBroadcastService {
  private env: Bindings;
  private lockService: DistributedLockService;
  private migrationConfig: MigrationConfig | null = null;

  constructor(env: Bindings) {
    this.env = env;
    try {
      this.lockService = new DistributedLockService(env);
    } catch (error) {
      console.warn('⚠️ [WebSocket Broadcast] Failed to initialize DistributedLockService, using fallback mode');
      // 在測試環境或 DISTRIBUTED_LOCK 不可用時，創建一個 null lockService
      this.lockService = null as any;
    }
  }

  // =================== Core Broadcasting Methods ===================

  /**
   * Broadcast message-related events
   */
  async broadcastMessageEvent(event: {
    type: 'message_sent' | 'message_delivered' | 'message_read' | 'message_recall_success' | 'message_recall_failed';
    conversationId: string;
    messageId: string;
    userId?: string;
    agentId?: string;
    data: any;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: event.type,
        source: 'api',
        timestamp: Date.now(),
        userId: event.userId || event.agentId,
        conversationId: event.conversationId,
        data: {
          messageId: event.messageId,
          ...event.data
        },
        priority: event.priority || 'normal',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'conversation' as const,
              targets: [event.conversationId],
              priority: event.priority || 'normal'
            }
          ],
          persistent: false,
          ttl: 300000 // 5 minutes
        }
      };

      // WebSocket broadcasting (100% rollout, SSE fallback removed in Phase 4)
      const wsSuccess = await this.broadcastToWebSocket(wsEvent);

      // REMOVED: SSE fallback (Phase 4 cleanup - 100% WebSocket rollout)
      // if (!wsSuccess) {
      //   await this.fallbackToSSE(wsEvent);
      // }

      return wsSuccess;
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Message event error:', error);
      return false;
    }
  }

  /**
   * Broadcast typing indicators
   */
  async broadcastTypingEvent(event: {
    type: 'typing_start' | 'typing_stop';
    conversationId: string;
    userId: string;
    userName?: string;
    data?: any;
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: event.type,
        source: 'websocket',
        timestamp: Date.now(),
        userId: event.userId,
        conversationId: event.conversationId,
        data: {
          userName: event.userName,
          ...event.data
        },
        priority: 'low',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'conversation',
              targets: [event.conversationId],
              filters: {
                roles: ['admin', 'team', 'agent'] // Only notify other agents
              }
            }
          ],
          persistent: false,
          ttl: 30000 // 30 seconds
        }
      };

      return await this.broadcastToWebSocket(wsEvent);
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Typing event error:', error);
      return false;
    }
  }

  /**
   * Broadcast conversation events
   */
  async broadcastConversationEvent(event: {
    type: 'conversation_assigned' | 'conversation_unassigned' | 'conversation_transferred' | 'conversation_status_changed' | 'participant_joined' | 'participant_left';
    conversationId: string;
    userId?: string;
    data: any;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: event.type,
        source: 'api' as const,
        timestamp: Date.now(),
        conversationId: event.conversationId,
        data: event.data,
        priority: event.priority || 'normal' as const,
        userId: event.userId,
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'conversation' as const,
              targets: [event.conversationId]
            },
            // Also broadcast to team/admin level for assignment changes
            ...(event.type.includes('assigned') || event.type.includes('transferred') ? [
              {
                type: 'global' as const,
                targets: ['admin', 'team'] as (string | number)[],
                filters: {
                  roles: ['admin', 'team']
                }
              }
            ] : [])
          ],
          persistent: true,
          ttl: 3600000 // 1 hour
        }
      };

      // WebSocket broadcasting (100% rollout, SSE fallback removed in Phase 4)
      const wsSuccess = await this.broadcastToWebSocket(wsEvent);

      // REMOVED: SSE fallback for conversation events (Phase 4 cleanup - 100% WebSocket rollout)
      // if (!wsSuccess && (event.type.includes('assigned') || event.type.includes('transferred'))) {
      //   await this.fallbackToSSE(wsEvent);
      // }

      return wsSuccess;
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Conversation event error:', error);
      return false;
    }
  }

  /**
   * Broadcast delayed message events
   */
  async broadcastDelayedMessageEvent(event: {
    type: 'delayed_message_countdown' | 'delayed_message_sent' | 'delayed_message_recalled' | 'delayed_message_failed';
    conversationId: string;
    messageId: string;
    agentId: string;
    data: any;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: event.type,
        source: 'queue',
        timestamp: Date.now(),
        userId: event.agentId,
        conversationId: event.conversationId,
        data: {
          messageId: event.messageId,
          ...event.data
        },
        priority: event.priority || 'normal',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'conversation',
              targets: [event.conversationId]
            },
            {
              type: 'user',
              targets: [event.agentId] // Notify the agent who sent the delayed message
            }
          ],
          persistent: event.type !== 'delayed_message_countdown', // Don't persist countdown events
          ttl: event.type === 'delayed_message_countdown' ? 30000 : 600000 // 30s for countdown, 10min for others
        }
      };

      return await this.broadcastToWebSocket(wsEvent);
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Delayed message event error:', error);
      return false;
    }
  }

  /**
   * Broadcast presence events
   */
  async broadcastPresenceEvent(event: {
    type: 'user_online' | 'user_offline' | 'user_away' | 'agent_available' | 'agent_busy' | 'agent_offline';
    userId: string;
    teamId?: number;
    data?: any;
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: event.type,
        source: 'websocket',
        timestamp: Date.now(),
        userId: event.userId,
        data: {
          teamId: event.teamId,
          ...event.data
        },
        priority: 'low',
        deliveryOptions: {
          broadcast: true,
          targets: [
            // Broadcast to all team members
            ...(event.teamId ? [
              {
                type: 'team' as const,
                targets: [event.teamId] as (string | number)[]
              }
            ] : []),
            // Broadcast to admins
            {
              type: 'global' as const,
              targets: ['admin'] as (string | number)[],
              filters: {
                roles: ['admin']
              }
            }
          ],
          persistent: false,
          ttl: 300000 // 5 minutes
        }
      };

      return await this.broadcastToWebSocket(wsEvent);
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Presence event error:', error);
      return false;
    }
  }

  // =================== Core WebSocket Broadcasting ===================

  /**
   * Main WebSocket broadcasting method
   *
   * Week 3-4 Optimization: Removed distributed lock for broadcast operations
   * Rationale: Event IDs are UUIDs (guaranteed unique), so lock is unnecessary
   * Performance gain: 15-20ms reduction per broadcast
   */
  private async broadcastToWebSocket(event: DurableObjectEvent): Promise<boolean> {
    const config = await this.getMigrationConfig();

    // Check if WebSocket is enabled
    if (!config.enableWebSocket || !config.featureFlags.durableObjectMessaging) {
      return false;
    }

    try {
      // ✅ Week 3-4: Direct broadcast without lock
      // Event ID uniqueness (UUID) prevents duplicate broadcasts
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

      // Wait for all broadcasts to complete
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      return successCount > 0;
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Broadcasting error:', error);
      return false;
    }
  }

  /**
   * Broadcast to ConversationRoom Durable Objects
   */
  private async broadcastToConversationRooms(event: DurableObjectEvent, conversationIds: string[]): Promise<boolean> {
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
      console.error('❌ [WebSocket Broadcast] ConversationRoom broadcast error:', error);
      return false;
    }
  }

  /**
   * Broadcast to UserConnection Durable Objects
   */
  private async broadcastToUserConnections(event: DurableObjectEvent, userIds: string[]): Promise<boolean> {
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
      console.error('❌ [WebSocket Broadcast] UserConnection broadcast error:', error);
      return false;
    }
  }

  /**
   * Broadcast to team members
   */
  private async broadcastToTeamMembers(event: DurableObjectEvent, teamIds: number[]): Promise<boolean> {
    try {
      // Use MessageBroadcaster for efficient team-wide distribution
      if (!this.env.MESSAGE_BROADCASTER) {
        console.warn('MESSAGE_BROADCASTER binding not available');
        return false;
      }

      const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

      if (broadcasterStub) {
        const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-to-teams', {
          method: 'POST',
          body: JSON.stringify({
            event,
            teamIds
          }),
          headers: { 'Content-Type': 'application/json' }
        }));

        return response.ok;
      }
      return false;
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Team broadcast error:', error);
      return false;
    }
  }

  /**
   * Broadcast to global audience (admins, etc.)
   */
  private async broadcastToGlobal(event: DurableObjectEvent, target: BroadcastTarget): Promise<boolean> {
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
      console.error('❌ [WebSocket Broadcast] Global broadcast error:', error);
      return false;
    }
  }

  // REMOVED: SSE Fallback System (Phase 4 cleanup - 100% WebSocket rollout)
  // The fallbackToSSE method has been removed as we are now at 100% WebSocket rollout
  // All events are handled exclusively through WebSocket broadcasting via Durable Objects

  // =================== Configuration and Health ===================

  /**
   * Get migration configuration
   */
  private async getMigrationConfig(): Promise<MigrationConfig> {
    if (this.migrationConfig) {
      return this.migrationConfig;
    }

    try {
      const configStr = await this.env.SESSIONS.get('websocket_migration_config');
      if (configStr) {
        this.migrationConfig = JSON.parse(configStr);
        return this.migrationConfig!;
      }
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Config error:', error);
    }

    // Default configuration
    // ✅ Phase 4 Complete: 100% WebSocket rollout with Durable Objects
    this.migrationConfig = {
      enableWebSocket: true,
      migrationStrategy: 'immediate', // All users get WebSocket immediately
      rolloutPercentage: 100,         // 100% WebSocket adoption
      featureFlags: {
        websocketConnections: true,
        durableObjectMessaging: true,
        distributedLocking: true,
        batchMessageProcessing: true,
        realTimeTypingIndicators: true
      }
    };

    return this.migrationConfig;
  }

  /**
   * Check if WebSocket broadcasting is available
   */
  async isWebSocketAvailable(): Promise<boolean> {
    const config = await this.getMigrationConfig();
    return config.enableWebSocket && config.featureFlags.durableObjectMessaging;
  }

  /**
   * Get broadcasting service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    websocketEnabled: boolean;
    durableObjectsAvailable: boolean;
    lastError?: string;
    timestamp: number;
  }> {
    try {
      const config = await this.getMigrationConfig();

      // Check Durable Objects availability
      let durableObjectsAvailable = false;
      try {
        if (!this.env.MESSAGE_BROADCASTER) {
          throw new Error('MESSAGE_BROADCASTER binding not available');
        }

        const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('health-check');
        const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

        if (broadcasterStub) {
          const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/ping', {
            method: 'GET'
          }));
          durableObjectsAvailable = response.ok;
        }
      } catch (error) {
        console.error('❌ [WebSocket Broadcast] Durable Objects health check failed:', error);
      }

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // ⚠️ Phase 4 Note: SSE check removed - WebSocket-only architecture
      if (!config.enableWebSocket) {
        status = 'unhealthy';
      } else if (!durableObjectsAvailable && config.enableWebSocket) {
        status = 'degraded';
      }

      return {
        status,
        websocketEnabled: config.enableWebSocket,
        durableObjectsAvailable,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        websocketEnabled: false,
        durableObjectsAvailable: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  // =================== Batch Processing Support ===================

  /**
   * Broadcast multiple events in batch for efficiency
   */
  async broadcastBatch(events: DurableObjectEvent[]): Promise<{
    successful: number;
    failed: number;
    results: boolean[];
  }> {
    const results: boolean[] = [];
    let successful = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const result = await this.broadcastToWebSocket(event);
        results.push(result);
        if (result) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('❌ [WebSocket Broadcast] Batch event error:', error);
        results.push(false);
        failed++;
      }
    }

    return { successful, failed, results };
  }

  // =================== Testing and Diagnostics ===================

  /**
   * Send a test event for diagnostics
   */
  async sendTestEvent(target: {
    type: 'conversation' | 'user' | 'team' | 'global';
    id: string | number;
  }): Promise<boolean> {
    const testEvent: DurableObjectEvent = {
      id: crypto.randomUUID(),
      type: 'system_notification',
      source: 'system',
      timestamp: Date.now(),
      data: {
        message: 'WebSocket test event',
        timestamp: Date.now()
      },
      priority: 'low',
      deliveryOptions: {
        broadcast: true,
        targets: [
          {
            type: target.type,
            targets: [target.id],
            priority: 'low'
          }
        ],
        persistent: false,
        ttl: 60000 // 1 minute
      }
    };

    return await this.broadcastToWebSocket(testEvent);
  }
}