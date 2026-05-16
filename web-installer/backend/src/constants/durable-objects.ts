/**
 * Durable Object Bindings — Single Source of Truth
 *
 * Used by both WorkerBundleService (for Worker bindings) and
 * DeploymentOrchestrator (for DO migration class list).
 */

export interface DurableObjectBinding {
  /** Worker binding name (e.g., 'CONVERSATION_ROOM') */
  name: string;
  /** Durable Object class name (e.g., 'ConversationRoom') */
  class_name: string;
}

export const DURABLE_OBJECT_BINDINGS: readonly DurableObjectBinding[] = [
  { name: 'CONVERSATION_ROOM', class_name: 'ConversationRoom' },
  { name: 'USER_CONNECTION', class_name: 'UserConnection' },
  { name: 'MESSAGE_BROADCASTER', class_name: 'MessageBroadcaster' },
  { name: 'DELAYED_MESSAGE_SCHEDULER', class_name: 'DelayedMessageBuffer' },
  { name: 'DISTRIBUTED_LOCK', class_name: 'LockCoordinator' },
  { name: 'LATEST_MESSAGE_COORDINATOR', class_name: 'LatestMessageCacheCoordinator' },
  { name: 'CUSTOMER_CONVERSATION_DO', class_name: 'CustomerConversationDO' },
  { name: 'CUSTOMER_MESSAGE_DO', class_name: 'CustomerMessageDO' },
  { name: 'RATE_LIMITER', class_name: 'RateLimiterDO' },
  { name: 'METRICS_COLLECTOR', class_name: 'MetricsCollectorDO' }
] as const;

/** All DO class names — used for SQLite migration steps */
export const DURABLE_OBJECT_CLASS_NAMES = DURABLE_OBJECT_BINDINGS.map(b => b.class_name);
