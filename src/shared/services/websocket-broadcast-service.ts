// WebSocket Broadcasting Service
// Integrates with Durable Objects for real-time event broadcasting
// Provides fallback to existing SSE/Queue system for backward compatibility

import type { Bindings } from '../../types';
import type {
  DurableObjectEvent,
  BroadcastTarget,
  MigrationConfig
} from '../../types/websocket-types';
import { DistributedLockService } from '../../services/distributed-lock-service';

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
    this.lockService = new DistributedLockService(env);
  }

  // =================== Core Broadcasting Methods ===================

  /**
   * Broadcast message-related events
   */
  async broadcastMessageEvent(event: {
    type: 'message_sent' | 'message_delivered' | 'message_read' | 'message_recall_success' | 'message_recall_failed' | 'message_updated';
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
    type: 'conversation_assigned' | 'conversation_unassigned' | 'conversation_transferred' | 'conversation_status_changed' | 'conversation_tags_updated' | 'participant_joined' | 'participant_left';
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
   * 🆕 Broadcast conversation transferred events with dual-team notification
   *
   * This method handles the complete transfer workflow:
   * 1. Notifies the OLD team that the conversation was removed from them
   * 2. Notifies the NEW team that the conversation was assigned to them
   * 3. Notifies anyone viewing the conversation that the team changed
   */
  async broadcastConversationTransferred(event: {
    conversationId: string;
    fromTeamId: number | null;
    toTeamId: number;
    fromTeamName?: string;
    toTeamName?: string;
    conversation: {
      id: string;
      customerId?: number;
      customerName?: string;
      platform?: string;
      status?: string;
      lastMessage?: {
        content?: string;
        timestamp?: number;
      };
      unreadCount?: number;
    };
    transferredBy: {
      id: string;
      name: string;
    };
    reason?: string;
  }): Promise<{ oldTeamNotified: boolean; newTeamNotified: boolean; conversationRoomNotified: boolean }> {
    const {
      conversationId,
      fromTeamId,
      toTeamId,
      fromTeamName,
      toTeamName,
      conversation,
      transferredBy,
      reason
    } = event;

    const timestamp = Date.now();
    const results = {
      oldTeamNotified: false,
      newTeamNotified: false,
      conversationRoomNotified: false
    };

    console.log('📦 [WebSocket Broadcast] Broadcasting conversation transfer', {
      conversationId,
      fromTeamId: fromTeamId || 'none',
      toTeamId,
      transferredBy: transferredBy.id
    });

    // 1. Notify OLD team that conversation was removed (if there was a previous team)
    if (fromTeamId) {
      try {
        const removeEvent: DurableObjectEvent = {
          id: crypto.randomUUID(),
          type: 'conversation_transferred',
          source: 'api',
          timestamp,
          conversationId,
          data: {
            action: 'removed',
            conversationId,
            fromTeamId,
            toTeamId,
            fromTeamName,
            toTeamName,
            transferredBy,
            reason,
            timestamp
          },
          priority: 'high',
          deliveryOptions: {
            broadcast: true,
            targets: [
              {
                type: 'team' as const,
                targets: [fromTeamId] as (string | number)[]
              }
            ],
            persistent: false,
            ttl: 300000 // 5 minutes
          }
        };

        results.oldTeamNotified = await this.broadcastToTeamMembers(removeEvent, [fromTeamId]);
        console.log('📤 [WebSocket Broadcast] Old team notified of removal', { conversationId, fromTeamId, success: results.oldTeamNotified });
      } catch (error) {
        console.error('❌ [WebSocket Broadcast] Failed to notify old team', { conversationId, fromTeamId, error });
      }
    }

    // 2. Notify NEW team that conversation was assigned to them
    try {
      const assignEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: 'conversation_transferred',
        source: 'api',
        timestamp,
        conversationId,
        data: {
          action: 'assigned',
          conversationId,
          fromTeamId,
          toTeamId,
          fromTeamName,
          toTeamName,
          // Include full conversation data for new team to add to their list
          conversation: {
            ...conversation,
            assignedTeamId: toTeamId,
            assignedTeam: {
              id: toTeamId,
              name: toTeamName || `Team ${toTeamId}`
            }
          },
          transferredBy,
          reason,
          timestamp
        },
        priority: 'high',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'team' as const,
              targets: [toTeamId] as (string | number)[]
            },
            // Also notify admins
            {
              type: 'global' as const,
              targets: ['admin'] as (string | number)[],
              filters: {
                roles: ['admin']
              }
            }
          ],
          persistent: true,
          ttl: 3600000 // 1 hour
        }
      };

      results.newTeamNotified = await this.broadcastToTeamMembers(assignEvent, [toTeamId]);

      // Also broadcast to admins
      await this.broadcastToGlobal(assignEvent, {
        type: 'global',
        targets: ['admin'],
        filters: { roles: ['admin'] }
      });

      console.log('📤 [WebSocket Broadcast] New team notified of assignment', { conversationId, toTeamId, success: results.newTeamNotified });
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Failed to notify new team', { conversationId, toTeamId, error });
    }

    // 3. Notify the conversation room (anyone currently viewing the chat)
    try {
      const teamChangedEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: 'conversation_transferred',
        source: 'api',
        timestamp,
        conversationId,
        data: {
          action: 'team_changed',
          conversationId,
          fromTeamId,
          toTeamId,
          fromTeamName,
          toTeamName,
          assignedTeamId: toTeamId,
          assignedTeamName: toTeamName,
          newTeam: {
            id: toTeamId,
            name: toTeamName || `Team ${toTeamId}`
          },
          transferredBy,
          reason,
          timestamp
        },
        priority: 'high',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'conversation' as const,
              targets: [conversationId]
            }
          ],
          persistent: false,
          ttl: 300000 // 5 minutes
        }
      };

      results.conversationRoomNotified = await this.broadcastToConversationRooms(teamChangedEvent, [conversationId]);
      console.log('📤 [WebSocket Broadcast] Conversation room notified of team change', { conversationId, success: results.conversationRoomNotified });
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] Failed to notify conversation room', { conversationId, error });
    }

    console.log('✅ [WebSocket Broadcast] Conversation transfer broadcast completed', { conversationId, results });

    return results;
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

  // =================== 🚀 Phase B4: Unified New Message Broadcasting ===================

  /**
   * 🚀 Phase B4: Unified New Message Broadcast
   *
   * This method handles broadcasting new messages to BOTH:
   * 1. CustomerConversationDO - for conversation detail page real-time updates
   * 2. MessageBroadcaster (global) - for conversation list page lastMessage updates
   *
   * USE THIS METHOD for all new message broadcasts instead of manually broadcasting
   * to multiple Durable Objects. This ensures consistent behavior and reduces code duplication.
   *
   * @param params.conversationId - The conversation ID
   * @param params.message - Message details (id, content, type, sender info)
   * @param params.source - Source of the message ('webhook' for customer, 'api' for agent)
   * @returns Promise<{ conversationBroadcast: boolean; globalBroadcast: boolean }>
   */
  async broadcastNewMessage(params: {
    conversationId: string;
    message: {
      id: string;
      content: string;
      messageType: string;
      senderType: 'customer' | 'agent';
      senderId: string;
      senderName?: string;
      platform: string;
      timestamp?: number;
      deliveryStatus?: string;
    };
    source: 'webhook' | 'api';
    // 🔒 Security: Team-scoped broadcast (P1 fix - prevent cross-team data leakage)
    teamId?: number;
  }): Promise<{ conversationBroadcast: boolean; globalBroadcast: boolean }> {
    const { conversationId, message, source, teamId } = params;
    const timestamp = message.timestamp || Date.now();

    console.log('📡 [WebSocket Broadcast] Broadcasting new message', {
      conversationId,
      messageId: message.id,
      senderType: message.senderType,
      source,
      teamId: teamId || 'global'
    });

    let conversationBroadcast = false;
    let globalBroadcast = false;

    // 1. Broadcast to CustomerConversationDO (for conversation detail page)
    try {
      if (this.env.CUSTOMER_CONVERSATION_DO) {
        const conversationDOId = this.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
        const conversationDO = this.env.CUSTOMER_CONVERSATION_DO.get(conversationDOId);

        const broadcastMessage = {
          id: message.id,
          conversationId,
          senderType: message.senderType,
          senderId: message.senderId,
          content: message.content,
          messageType: message.messageType,
          platform: message.platform,
          timestamp,
          createdAt: new Date(timestamp).toISOString(),
          deliveryStatus: message.deliveryStatus || 'delivered',
          senderName: message.senderName
        };

        const notifyRequest = new Request('https://customer-conversation-do/notify-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: broadcastMessage
          })
        });

        const response = await conversationDO.fetch(notifyRequest);
        conversationBroadcast = response.ok;

        if (conversationBroadcast) {
          console.log('✅ [WebSocket Broadcast] CustomerConversationDO broadcast successful');
        } else {
          console.warn('⚠️ [WebSocket Broadcast] CustomerConversationDO broadcast failed', {
            status: response.status
          });
        }
      }
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] CustomerConversationDO broadcast error:', error);
    }

    // 2. Broadcast via MessageBroadcaster (for conversation list page)
    // 🔒 Security Fix (P1): Team-scoped broadcast to prevent cross-team data leakage
    try {
      if (this.env.MESSAGE_BROADCASTER) {
        const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
        const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

        const broadcastEvent: DurableObjectEvent = {
          id: crypto.randomUUID(),
          type: 'new_message',
          source,
          timestamp,
          conversationId,
          data: {
            conversationId,
            content: message.content,
            messageType: message.messageType,
            senderType: message.senderType,
            senderId: message.senderId,
            senderName: message.senderName,
            platform: message.platform,
            timestamp,
            // 🔒 Include teamId for filtering at client side as backup
            teamId: teamId || null
          },
          priority: 'normal'
        };

        // 🔒 Security: Use team-scoped broadcast when teamId is provided
        if (teamId) {
          // Team-scoped broadcast: Only send to team members + admins
          const teamResponse = await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-to-teams-and-admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: broadcastEvent,
              teamIds: [teamId],
              includeAdmins: true  // Admins can see all conversations
            })
          }));

          globalBroadcast = teamResponse.ok;

          if (globalBroadcast) {
            console.log('✅ [WebSocket Broadcast] Team-scoped broadcast successful', { teamId });
          } else {
            console.warn('⚠️ [WebSocket Broadcast] Team-scoped broadcast failed', {
              teamId,
              status: teamResponse.status
            });
          }
        } else {
          // Fallback to global broadcast when no teamId (legacy behavior, should be rare)
          console.warn('⚠️ [WebSocket Broadcast] No teamId provided, using global broadcast (security risk)', {
            conversationId,
            source
          });

          const globalResponse = await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: broadcastEvent,
              target: { type: 'global', targets: ['all'] }
            })
          }));

          globalBroadcast = globalResponse.ok;

          if (globalBroadcast) {
            console.log('✅ [WebSocket Broadcast] MessageBroadcaster global broadcast successful');
          } else {
            console.warn('⚠️ [WebSocket Broadcast] MessageBroadcaster global broadcast failed', {
              status: globalResponse.status
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ [WebSocket Broadcast] MessageBroadcaster broadcast error:', error);
    }

    console.log('📡 [WebSocket Broadcast] New message broadcast completed', {
      conversationId,
      messageId: message.id,
      conversationBroadcast,
      globalBroadcast
    });

    return { conversationBroadcast, globalBroadcast };
  }

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

      if (!config.enableWebSocket) {
        status = 'unhealthy';
      } else if (!durableObjectsAvailable) {
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