// Event Broadcaster — Facade
// Delegates to sub-module classes:
//   - MessageEventBroadcaster (message-events.ts)
//   - ConversationEventBroadcaster (conversation-events.ts)
//   - SystemEventBroadcaster (system-events.ts)

import type { Bindings } from '@/types';
import type { DurableObjectClient } from './durable-object-client';
import type { BatchQueueManager } from './batch-queue-manager';
import type { BroadcastConfig } from './broadcast-config';
import { MessageEventBroadcaster } from './message-events';
import { ConversationEventBroadcaster } from './conversation-events';
import { SystemEventBroadcaster } from './system-events';

/**
 * EventBroadcaster
 *
 * Thin facade that delegates to domain-specific sub-modules.
 * All public method signatures are preserved for zero-change callers.
 */
export class EventBroadcaster {
  private messageEvents: MessageEventBroadcaster;
  private conversationEvents: ConversationEventBroadcaster;
  private systemEvents: SystemEventBroadcaster;

  constructor(
    env: Bindings,
    doClient: DurableObjectClient,
    batchManager: BatchQueueManager,
    _config: BroadcastConfig
  ) {
    this.messageEvents = new MessageEventBroadcaster(env, doClient, batchManager, 'MessageEvents');
    this.conversationEvents = new ConversationEventBroadcaster(env, doClient, batchManager, 'ConversationEvents');
    this.systemEvents = new SystemEventBroadcaster(env, doClient, batchManager, 'SystemEvents');
  }

  // === Message Events ===

  broadcastMessageEvent(
    ...args: Parameters<MessageEventBroadcaster['broadcastMessageEvent']>
  ): ReturnType<MessageEventBroadcaster['broadcastMessageEvent']> {
    return this.messageEvents.broadcastMessageEvent(...args);
  }

  broadcastTypingEvent(
    ...args: Parameters<MessageEventBroadcaster['broadcastTypingEvent']>
  ): ReturnType<MessageEventBroadcaster['broadcastTypingEvent']> {
    return this.messageEvents.broadcastTypingEvent(...args);
  }

  broadcastDelayedMessageEvent(
    ...args: Parameters<MessageEventBroadcaster['broadcastDelayedMessageEvent']>
  ): ReturnType<MessageEventBroadcaster['broadcastDelayedMessageEvent']> {
    return this.messageEvents.broadcastDelayedMessageEvent(...args);
  }

  broadcastNewMessage(
    ...args: Parameters<MessageEventBroadcaster['broadcastNewMessage']>
  ): ReturnType<MessageEventBroadcaster['broadcastNewMessage']> {
    return this.messageEvents.broadcastNewMessage(...args);
  }

  // === Conversation Events ===

  broadcastConversationEvent(
    ...args: Parameters<ConversationEventBroadcaster['broadcastConversationEvent']>
  ): ReturnType<ConversationEventBroadcaster['broadcastConversationEvent']> {
    return this.conversationEvents.broadcastConversationEvent(...args);
  }

  broadcastConversationTransferred(
    ...args: Parameters<ConversationEventBroadcaster['broadcastConversationTransferred']>
  ): ReturnType<ConversationEventBroadcaster['broadcastConversationTransferred']> {
    return this.conversationEvents.broadcastConversationTransferred(...args);
  }

  // === System Events ===

  broadcastNotificationEvent(
    ...args: Parameters<SystemEventBroadcaster['broadcastNotificationEvent']>
  ): ReturnType<SystemEventBroadcaster['broadcastNotificationEvent']> {
    return this.systemEvents.broadcastNotificationEvent(...args);
  }

  broadcastPresenceEvent(
    ...args: Parameters<SystemEventBroadcaster['broadcastPresenceEvent']>
  ): ReturnType<SystemEventBroadcaster['broadcastPresenceEvent']> {
    return this.systemEvents.broadcastPresenceEvent(...args);
  }

  broadcastTeamMemberEvent(
    ...args: Parameters<SystemEventBroadcaster['broadcastTeamMemberEvent']>
  ): ReturnType<SystemEventBroadcaster['broadcastTeamMemberEvent']> {
    return this.systemEvents.broadcastTeamMemberEvent(...args);
  }

  broadcastTeamUpdateEvent(
    ...args: Parameters<SystemEventBroadcaster['broadcastTeamUpdateEvent']>
  ): ReturnType<SystemEventBroadcaster['broadcastTeamUpdateEvent']> {
    return this.systemEvents.broadcastTeamUpdateEvent(...args);
  }

  broadcastCustomerTagEvent(
    ...args: Parameters<SystemEventBroadcaster['broadcastCustomerTagEvent']>
  ): ReturnType<SystemEventBroadcaster['broadcastCustomerTagEvent']> {
    return this.systemEvents.broadcastCustomerTagEvent(...args);
  }
}
