// Conversation & Assignment Event Broadcasters
// Handles: broadcastConversationEvent, broadcastConversationTransferred
// Extracted from event-broadcaster.ts

import type { DurableObjectEvent } from '@/types/websocket-types';
import { nowMs } from '@/utils/timestamp';
import { EventBroadcasterBase } from './event-broadcaster-deps';

/**
 * Handles conversation lifecycle and assignment event broadcasts:
 * - Conversation assigned/unassigned/transferred/status changed/tags updated
 * - Participant joined/left
 * - Dual-team transfer notifications
 */
export class ConversationEventBroadcaster extends EventBroadcasterBase {

  /**
   * Broadcast conversation events
   */
  async broadcastConversationEvent(event: {
    type: 'conversation_assigned' | 'conversation_unassigned' | 'conversation_transferred' | 'conversation_status_changed' | 'conversation_tags_updated' | 'customer_profile_updated' | 'participant_joined' | 'participant_left';
    conversationId: string;
    userId?: string;
    data: unknown;
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
      this.logger.error('Conversation event error', undefined, { error: error instanceof Error ? error.message : String(error) });
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
      _liffMetadata?: Record<string, unknown>;
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
}
