// Event Broadcaster
// Contains all 10 public broadcast methods for different event types
// Each method creates a DurableObjectEvent and routes it through DurableObjectClient
// Extracted from websocket-broadcast-service.ts (Phase 5 refactor)

import type { Bindings } from '@/types';
import type { DurableObjectEvent } from '@/types/websocket-types';
import { Logger, createLogger } from '@/services/logger-service';
import type { DurableObjectClient } from './durable-object-client';
import type { BatchQueueManager } from './batch-queue-manager';
import type { BroadcastConfig } from './broadcast-config';
import { nowMs } from '@/utils/timestamp'

/**
 * EventBroadcaster
 *
 * Contains all 10 public broadcast methods for different event types.
 * Each method:
 * 1. Constructs a DurableObjectEvent with appropriate targets
 * 2. Routes through DurableObjectClient (or batch queue for non-urgent)
 *
 * Method signatures are identical to the original WebSocketBroadcastService
 * so all callers need zero changes.
 */
export class EventBroadcaster {
  private env: Bindings;
  private doClient: DurableObjectClient;
  private batchManager: BatchQueueManager;
  private logger: Logger;

  constructor(
    env: Bindings,
    doClient: DurableObjectClient,
    batchManager: BatchQueueManager,
    _config: BroadcastConfig
  ) {
    this.env = env;
    this.doClient = doClient;
    this.batchManager = batchManager;

    this.logger = createLogger({ service: 'EventBroadcaster' }, {
      serviceName: 'event-broadcaster'
    });
  }

  /**
   * Broadcast message-related events
   * Uses batch queueing to reduce DO calls for non-urgent events
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
        timestamp: nowMs(),
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

      if (this.batchManager.shouldBatch(wsEvent)) {
        // enqueue() increments totalEvents + batchedEvents
        return this.batchManager.enqueue(wsEvent);
      } else {
        // recordImmediateEvent() increments totalEvents + immediateEvents
        this.batchManager.recordImmediateEvent();
        return await this.doClient.broadcast(wsEvent);
      }
    } catch (error) {
      console.error('❌ [EventBroadcaster] Message event error:', error);
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
        timestamp: nowMs(),
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
                roles: ['admin', 'team', 'agent']
              }
            }
          ],
          persistent: false,
          ttl: 30000 // 30 seconds
        }
      };

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      console.error('❌ [EventBroadcaster] Typing event error:', error);
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
        timestamp: nowMs(),
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

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      console.error('❌ [EventBroadcaster] Conversation event error:', error);
      return false;
    }
  }

  /**
   * Broadcast conversation transferred events with dual-team notification
   *
   * Handles the complete transfer workflow:
   * 1. Notifies OLD team that the conversation was removed
   * 2. Notifies NEW team that the conversation was assigned
   * 3. Notifies conversation room that the team changed
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
      assignedTeamId?: number;
      assignedTeam?: {
        id: number;
        name: string;
      };
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

    const timestamp = nowMs();
    const results = {
      oldTeamNotified: false,
      newTeamNotified: false,
      conversationRoomNotified: false
    };

    this.logger.info('Broadcasting conversation transfer', undefined, {
      conversationId,
      fromTeamId: fromTeamId || 'none',
      toTeamId,
      transferredBy: transferredBy.id
    });

    // 1. OLD team removal event
    const removeEvent: DurableObjectEvent | null = fromTeamId ? {
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
      priority: 'urgent',
      deliveryOptions: {
        broadcast: true,
        targets: [
          {
            type: 'team' as const,
            targets: [fromTeamId] as (string | number)[]
          }
        ],
        persistent: false,
        ttl: 300000
      }
    } : null;

    // 2. NEW team assignment event
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
      priority: 'urgent',
      deliveryOptions: {
        broadcast: true,
        targets: [
          {
            type: 'team' as const,
            targets: [toTeamId] as (string | number)[]
          }
        ],
        persistent: true,
        ttl: 3600000
      }
    };

    // 3. Conversation room team_changed event
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
      priority: 'urgent',
      deliveryOptions: {
        broadcast: true,
        targets: [
          {
            type: 'conversation' as const,
            targets: [conversationId]
          }
        ],
        persistent: false,
        ttl: 300000
      }
    };

    // Execute all broadcasts in PARALLEL
    const broadcastPromises: Promise<{ type: string; success: boolean }>[] = [];

    if (removeEvent && fromTeamId) {
      broadcastPromises.push(
        this.doClient.broadcastToTeamMembers(removeEvent, [fromTeamId], true)
          .then(success => ({ type: 'oldTeam', success }))
          .catch(error => {
            this.logger.error('Failed to notify old team', undefined, {
              conversationId,
              fromTeamId,
              error: error instanceof Error ? error.message : String(error)
            });
            return { type: 'oldTeam', success: false };
          })
      );
    }

    broadcastPromises.push(
      this.doClient.broadcastToTeamMembers(assignEvent, [toTeamId], true)
        .then(success => ({ type: 'newTeam', success }))
        .catch(error => {
          this.logger.error('Failed to notify new team', undefined, {
            conversationId,
            toTeamId,
            error: error instanceof Error ? error.message : String(error)
          });
          return { type: 'newTeam', success: false };
        })
    );

    broadcastPromises.push(
      this.doClient.broadcastToConversationRooms(teamChangedEvent, [conversationId])
        .then(success => ({ type: 'conversationRoom', success }))
        .catch(error => {
          this.logger.error('Failed to notify conversation room', undefined, {
            conversationId,
            error: error instanceof Error ? error.message : String(error)
          });
          return { type: 'conversationRoom', success: false };
        })
    );

    const broadcastResults = await Promise.all(broadcastPromises);

    for (const result of broadcastResults) {
      if (result.type === 'oldTeam') {
        results.oldTeamNotified = result.success;
        this.logger.debug('Old team notified of removal', undefined, {
          conversationId,
          fromTeamId,
          success: result.success
        });
      } else if (result.type === 'newTeam') {
        results.newTeamNotified = result.success;
        this.logger.debug('New team notified of assignment', undefined, {
          conversationId,
          toTeamId,
          success: result.success
        });
      } else if (result.type === 'conversationRoom') {
        results.conversationRoomNotified = result.success;
        this.logger.debug('Conversation room notified of team change', undefined, {
          conversationId,
          success: result.success
        });
      }
    }

    this.logger.info('Conversation transfer broadcast completed (parallel)', undefined, {
      conversationId,
      fromTeamId: fromTeamId || 'none',
      toTeamId,
      results,
      parallelBroadcasts: broadcastPromises.length
    });

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
        timestamp: nowMs(),
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
              targets: [event.agentId]
            }
          ],
          persistent: event.type !== 'delayed_message_countdown',
          ttl: event.type === 'delayed_message_countdown' ? 30000 : 600000
        }
      };

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      console.error('❌ [EventBroadcaster] Delayed message event error:', error);
      return false;
    }
  }

  /**
   * Broadcast notification events to specific users
   */
  async broadcastNotificationEvent(event: {
    type: 'notification';
    userId: string;
    notification: {
      id: string;
      type: string;
      title: string;
      content: string;
      priority: string;
      data?: Record<string, any>;
      createdAt: string;
    };
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: 'notification',
        source: 'api',
        timestamp: nowMs(),
        userId: event.userId,
        data: {
          notification: event.notification
        },
        priority: event.notification.priority === 'urgent' ? 'urgent' :
                  event.notification.priority === 'high' ? 'high' : 'normal',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'user' as const,
              targets: [event.userId],
              priority: event.notification.priority === 'urgent' ? 'urgent' : 'normal'
            }
          ],
          persistent: false,
          ttl: 300000
        }
      };

      // Broadcast directly to user's connections via UserConnection DO
      const success = await this.doClient.broadcastToUserConnections(wsEvent, [event.userId]);

      if (success) {
        console.log(`✅ [EventBroadcaster] Notification sent to user ${event.userId}:`, {
          notificationId: event.notification.id,
          type: event.notification.type
        });
      }

      return success;
    } catch (error) {
      console.error('❌ [EventBroadcaster] Notification event error:', error);
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
        timestamp: nowMs(),
        userId: event.userId,
        data: {
          teamId: event.teamId,
          ...event.data
        },
        priority: 'low',
        deliveryOptions: {
          broadcast: true,
          targets: [
            ...(event.teamId ? [
              {
                type: 'team' as const,
                targets: [event.teamId] as (string | number)[]
              }
            ] : []),
            {
              type: 'global' as const,
              targets: ['admin'] as (string | number)[],
              filters: {
                roles: ['admin']
              }
            }
          ],
          persistent: false,
          ttl: 300000
        }
      };

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      console.error('❌ [EventBroadcaster] Presence event error:', error);
      return false;
    }
  }

  /**
   * Broadcast team member events (added/removed)
   */
  async broadcastTeamMemberEvent(event: {
    type: 'team_member_added' | 'team_member_removed';
    teamId: number;
    teamName: string;
    agentId: string;
    agentName?: string;
    memberCount: number;
    changedBy: string;
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: event.type,
        source: 'api',
        timestamp: nowMs(),
        data: {
          teamId: event.teamId,
          teamName: event.teamName,
          agentId: event.agentId,
          agentName: event.agentName,
          memberCount: event.memberCount,
          changedBy: event.changedBy
        },
        priority: 'normal',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'global' as const,
              targets: ['admin'] as (string | number)[],
              filters: {
                roles: ['admin']
              }
            },
            {
              type: 'team' as const,
              targets: [event.teamId] as (string | number)[]
            }
          ],
          persistent: false,
          ttl: 300000
        }
      };

      console.log('📡 [EventBroadcaster] Team member event:', {
        type: event.type,
        teamId: event.teamId,
        teamName: event.teamName,
        memberCount: event.memberCount
      });

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      console.error('❌ [EventBroadcaster] Team member event error:', error);
      return false;
    }
  }

  /**
   * Broadcast team update events (name, status, etc.)
   */
  async broadcastTeamUpdateEvent(event: {
    teamId: number;
    teamName: string;
    changes: {
      name?: string;
      description?: string;
      isActive?: boolean;
      memberCount?: number;
    };
    changedBy: string;
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: 'team_updated',
        source: 'api',
        timestamp: nowMs(),
        data: {
          teamId: event.teamId,
          teamName: event.teamName,
          changes: event.changes,
          changedBy: event.changedBy
        },
        priority: 'normal',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'global' as const,
              targets: ['admin'] as (string | number)[],
              filters: {
                roles: ['admin']
              }
            },
            {
              type: 'team' as const,
              targets: [event.teamId] as (string | number)[]
            }
          ],
          persistent: false,
          ttl: 300000
        }
      };

      console.log('📡 [EventBroadcaster] Team update event:', {
        teamId: event.teamId,
        changes: event.changes
      });

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      console.error('❌ [EventBroadcaster] Team update event error:', error);
      return false;
    }
  }

  /**
   * Unified New Message Broadcast (Phase B4)
   *
   * Broadcasts new messages to BOTH:
   * 1. CustomerConversationDO - for conversation detail page
   * 2. MessageBroadcaster (global) - for conversation list page
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
      file_attachments?: Array<{
        id: string;
        filename: string;
        mimeType: string;
        fileSize: number;
        fileUrl: string;
      }>;
    };
    source: 'webhook' | 'api';
    teamId?: number;
  }): Promise<{ conversationBroadcast: boolean; globalBroadcast: boolean }> {
    const { conversationId, message, source, teamId } = params;
    const timestamp = message.timestamp || nowMs();

    this.logger.info('Broadcasting new message', undefined, {
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
          senderName: message.senderName,
          file_attachments: message.file_attachments || []
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
          this.logger.debug('CustomerConversationDO broadcast successful', undefined, { conversationId });
        } else {
          this.logger.warn('CustomerConversationDO broadcast failed', undefined, {
            conversationId,
            status: response.status
          });
        }
      }
    } catch (error) {
      this.logger.error('CustomerConversationDO broadcast error', undefined, {
        conversationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 2. Broadcast via MessageBroadcaster (for conversation list page)
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
            teamId: teamId || null
          },
          priority: 'normal'
        };

        if (teamId) {
          const teamResponse = await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-to-teams-and-admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: broadcastEvent,
              teamIds: [teamId],
              includeAdmins: true
            })
          }));

          globalBroadcast = teamResponse.ok;

          if (globalBroadcast) {
            this.logger.debug('Team-scoped broadcast successful', undefined, {
              conversationId,
              teamId,
              broadcastType: 'team-scoped'
            });
          } else {
            this.logger.warn('Team-scoped broadcast failed', undefined, {
              conversationId,
              teamId,
              status: teamResponse.status
            });
          }
        } else {
          this.logger.warn('No teamId provided, using global broadcast (security risk)', undefined, {
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
            this.logger.debug('MessageBroadcaster global broadcast successful', undefined, { conversationId });
          } else {
            this.logger.warn('MessageBroadcaster global broadcast failed', undefined, {
              conversationId,
              status: globalResponse.status
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('MessageBroadcaster broadcast error', undefined, {
        conversationId,
        teamId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.logger.info('New message broadcast completed', undefined, {
      conversationId,
      messageId: message.id,
      conversationBroadcast,
      globalBroadcast
    });

    return { conversationBroadcast, globalBroadcast };
  }
}
