// UserConnection Subscription Manager
// Manages conversation subscriptions, permission checks, and broadcaster registration

import type { WebSocketMessage, WebSocketSubscription } from '../types/websocket-types';
import { nowMs } from '@/utils/timestamp';

/**
 * Manages conversation subscriptions and permission checks for a user.
 */
export class UserSubscriptionManager {
  private subscriptions = new Set<string>(); // conversation IDs

  readonly MAX_SUBSCRIPTIONS = 50;

  get subscriptionCount(): number {
    return this.subscriptions.size;
  }

  get subscribedConversations(): string[] {
    return Array.from(this.subscriptions);
  }

  isSubscribed(conversationId: string): boolean {
    return this.subscriptions.has(conversationId);
  }

  isAtLimit(): boolean {
    return this.subscriptions.size >= this.MAX_SUBSCRIPTIONS;
  }

  addSubscription(conversationId: string): boolean {
    if (this.subscriptions.size >= this.MAX_SUBSCRIPTIONS) {
      return false;
    }
    this.subscriptions.add(conversationId);
    return true;
  }

  removeSubscription(conversationId: string): void {
    this.subscriptions.delete(conversationId);
  }

  // =================== Storage Operations ===================

  async initializeFromStorage(storage: DurableObjectStorage): Promise<void> {
    try {
      const subscriptions = (await storage.get('subscriptions')) as string[];
      if (subscriptions) {
        this.subscriptions = new Set(subscriptions);
      }
    } catch (error) {
      console.error('[UserSubscriptionManager] Subscription restoration error:', error);
    }
  }

  async persistSubscriptions(storage: DurableObjectStorage): Promise<void> {
    await storage.put('subscriptions', Array.from(this.subscriptions));
  }

  // =================== Permission Checks ===================

  async checkConversationPermission(
    env: Record<string, unknown>,
    userId: string,
    conversationId: string,
    action: string
  ): Promise<boolean> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { eq, and } = await import('drizzle-orm');
      const schema = await import('../db/schema');

      const db = drizzle(env.DB as D1Database, { schema });

      // Get the conversation
      const conversation = await db
        .select({
          id: schema.conversations.id,
          assignedTeamId: schema.conversations.assignedTeamId,
        })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .get();

      if (!conversation) {
        console.warn(`[UserSubscriptionManager] Conversation ${conversationId} not found`);
        return false;
      }

      // Get the user's role
      const user = await db
        .select({
          id: schema.agents.id,
          role: schema.agents.role,
        })
        .from(schema.agents)
        .where(eq(schema.agents.id, userId))
        .get();

      if (!user) {
        console.warn(`[UserSubscriptionManager] User ${userId} not found`);
        return false;
      }

      // Admin has full access
      if (user.role === 'admin') {
        return true;
      }

      // For unassigned conversations, allow access (queue management)
      if (!conversation.assignedTeamId) {
        return action === 'read';
      }

      // Check if user is in the assigned team (via agent_teams)
      if (conversation.assignedTeamId) {
        const membership = await db
          .select({ id: schema.agentTeams.id })
          .from(schema.agentTeams)
          .where(
            and(eq(schema.agentTeams.agentId, userId), eq(schema.agentTeams.teamId, conversation.assignedTeamId))
          )
          .limit(1);

        if (membership.length > 0) {
          return true;
        }
      }

      console.warn(
        `[UserSubscriptionManager] User ${userId} denied ${action} access to conversation ${conversationId}`
      );
      return false;
    } catch (error) {
      console.error(`[UserSubscriptionManager] Permission check failed:`, error);
      return false; // Fail secure - deny access on error
    }
  }

  // =================== Broadcaster Registration ===================

  async registerWithMessageBroadcaster(env: Record<string, unknown>, userId: string): Promise<void> {
    console.log(`[UserSubscriptionManager] registerWithMessageBroadcaster called for user: ${userId}`);
    try {
      const broadcasterBinding = env.MESSAGE_BROADCASTER as
        | { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } }
        | undefined;

      if (!broadcasterBinding) {
        console.warn('[UserSubscriptionManager] MESSAGE_BROADCASTER binding not available');
        return;
      }

      const broadcasterId = broadcasterBinding.idFromName('global');
      const broadcasterStub = broadcasterBinding.get(broadcasterId);

      if (broadcasterStub) {
        console.log(`[UserSubscriptionManager] Sending registration request for user ${userId}`);
        const response = await broadcasterStub.fetch(
          new Request('https://message-broadcaster/register-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'user', id: userId }),
          })
        );

        if (response.ok) {
          const result = (await response.json()) as { activeConnections?: number };
          console.log(
            `[UserSubscriptionManager] Registered user ${userId} with MessageBroadcaster for global broadcasts (total active: ${result.activeConnections})`
          );
        } else {
          console.error(`[UserSubscriptionManager] Failed to register with MessageBroadcaster: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('[UserSubscriptionManager] MessageBroadcaster registration error:', error);
    }
  }

  async unregisterFromMessageBroadcaster(env: Record<string, unknown>, userId: string): Promise<void> {
    try {
      const broadcasterBinding = env.MESSAGE_BROADCASTER as
        | { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } }
        | undefined;

      if (!broadcasterBinding) {
        return;
      }

      const broadcasterId = broadcasterBinding.idFromName('global');
      const broadcasterStub = broadcasterBinding.get(broadcasterId);

      if (broadcasterStub) {
        const response = await broadcasterStub.fetch(
          new Request('https://message-broadcaster/unregister-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'user', id: userId }),
          })
        );

        if (response.ok) {
          console.log(`[UserSubscriptionManager] Unregistered user ${userId} from MessageBroadcaster`);
        } else {
          console.error(
            `[UserSubscriptionManager] Failed to unregister from MessageBroadcaster: ${response.status}`
          );
        }
      }
    } catch (error) {
      console.error('[UserSubscriptionManager] MessageBroadcaster unregistration error:', error);
    }
  }

  // =================== WebSocket Subscription Message Helpers ===================

  buildSubscriptionAddedMessage(subscription: WebSocketSubscription): WebSocketMessage {
    return {
      type: 'event',
      data: {
        type: 'subscription_added',
        subscription,
        subscriptionCount: this.subscriptions.size,
      },
      timestamp: nowMs(),
    };
  }

  buildSubscriptionRemovedMessage(subscription: WebSocketSubscription): WebSocketMessage {
    return {
      type: 'event',
      data: {
        type: 'subscription_removed',
        subscription,
        subscriptionCount: this.subscriptions.size,
      },
      timestamp: nowMs(),
    };
  }

  buildConversationSubscribedMessage(conversationId: string): WebSocketMessage {
    return {
      type: 'event',
      data: {
        type: 'conversation_subscribed',
        conversationId,
        subscriptionCount: this.subscriptions.size,
      },
      timestamp: nowMs(),
    };
  }

  buildConversationUnsubscribedMessage(conversationId: string): WebSocketMessage {
    return {
      type: 'event',
      data: {
        type: 'conversation_unsubscribed',
        conversationId,
        subscriptionCount: this.subscriptions.size,
      },
      timestamp: nowMs(),
    };
  }
}
