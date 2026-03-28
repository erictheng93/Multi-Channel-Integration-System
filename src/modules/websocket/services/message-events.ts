// Message Event Broadcasters
// Handles: broadcastMessageEvent, broadcastTypingEvent, broadcastDelayedMessageEvent, broadcastNewMessage
// Extracted from event-broadcaster.ts

import type { DurableObjectEvent } from '@/types/websocket-types';
import { nowMs } from '@/utils/timestamp';
import { EventBroadcasterBase } from './event-broadcaster-deps';

/**
 * Handles all message-related event broadcasts:
 * - Message CRUD events (sent, delivered, read, recall, updated)
 * - Typing indicators
 * - Delayed message events (countdown, sent, recalled, failed)
 * - Unified new message broadcast (Phase B4)
 */
export class MessageEventBroadcaster extends EventBroadcasterBase {

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
      this.logger.error('Message event error', undefined, { error: error instanceof Error ? error.message : String(error) });
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
      this.logger.error('Typing event error', undefined, { error: error instanceof Error ? error.message : String(error) });
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
      this.logger.error('Delayed message event error', undefined, { error: error instanceof Error ? error.message : String(error) });
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
