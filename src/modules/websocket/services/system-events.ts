// System, Team, Presence, and Notification Event Broadcasters
// Handles: broadcastPresenceEvent, broadcastNotificationEvent, broadcastTeamMemberEvent,
//          broadcastTeamUpdateEvent, broadcastCustomerTagEvent
// Extracted from event-broadcaster.ts

import type { DurableObjectEvent } from '@/types/websocket-types';
import { nowMs } from '@/utils/timestamp';
import { EventBroadcasterBase } from './event-broadcaster-deps';

/**
 * Handles system-level event broadcasts:
 * - Presence events (online/offline/away/available/busy)
 * - Notification events (user-targeted notifications)
 * - Team member events (added/removed)
 * - Team update events (name/status changes)
 * - Customer tag events (add/remove/set)
 */
export class SystemEventBroadcaster extends EventBroadcasterBase {

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
        this.logger.info('Notification sent to user', undefined, {
          userId: event.userId,
          notificationId: event.notification.id,
          type: event.notification.type
        });
      }

      return success;
    } catch (error) {
      this.logger.error('Notification event error', undefined, { error: error instanceof Error ? error.message : String(error) });
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
      this.logger.error('Presence event error', undefined, { error: error instanceof Error ? error.message : String(error) });
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

      this.logger.info('Team member event', undefined, {
        type: event.type,
        teamId: event.teamId,
        teamName: event.teamName,
        memberCount: event.memberCount
      });

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      this.logger.error('Team member event error', undefined, { error: error instanceof Error ? error.message : String(error) });
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

      this.logger.info('Team update event', undefined, {
        teamId: event.teamId,
        changes: event.changes as Record<string, unknown>
      });

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      this.logger.error('Team update event error', undefined, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Broadcast customer tag events (add/remove/set tags on customers)
   */
  async broadcastCustomerTagEvent(event: {
    customerId: number;
    operation: 'add' | 'remove' | 'set';
    tagIds: number[];
    changedBy: string;
  }): Promise<boolean> {
    try {
      const wsEvent: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: 'customer_tags_updated',
        source: 'api',
        timestamp: nowMs(),
        data: {
          customerId: event.customerId,
          operation: event.operation,
          tagIds: event.tagIds,
          changedBy: event.changedBy
        },
        priority: 'normal',
        deliveryOptions: {
          broadcast: true,
          targets: [
            {
              type: 'global' as const,
              targets: ['admin', 'team'] as (string | number)[],
              filters: {
                roles: ['admin', 'agent']
              }
            }
          ],
          persistent: false,
          ttl: 60000 // 1 minute
        }
      };

      this.logger.info('Customer tag event', undefined, {
        customerId: event.customerId,
        operation: event.operation,
        tagCount: event.tagIds.length
      });

      return await this.doClient.broadcast(wsEvent);
    } catch (error) {
      this.logger.error('Customer tag event error', undefined, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
}
