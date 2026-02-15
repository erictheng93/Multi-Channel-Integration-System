// WebSocket Broadcasting Service — Compatibility Facade
// Delegates to focused modules while preserving the original public API.
// All 12+ callers continue using this import path unchanged.
//
// Internal modules:
//   - BatchQueueManager:   Batch queue + timers + metrics
//   - BroadcastConfig:     KV config + health checks
//   - DurableObjectClient: DO communication + circuit breaker
//   - EventBroadcaster:    10 public broadcast methods

import type { Bindings } from '../types';
import {
  BatchQueueManager,
  BroadcastConfig,
  DurableObjectClient,
  EventBroadcaster
} from '../modules/websocket/services';
import type { BatchConfig } from '../modules/websocket/services';

export class WebSocketBroadcastService {
  private broadcaster: EventBroadcaster;
  private batchManager: BatchQueueManager;
  private doClient: DurableObjectClient;
  private broadcastConfig: BroadcastConfig;

  constructor(env: Bindings, batchConfig?: Partial<BatchConfig>) {
    // 1. Config (KV + health)
    this.broadcastConfig = new BroadcastConfig(env);

    // 2. Batch queue (needs flush callback wired after doClient exists)
    this.batchManager = new BatchQueueManager(batchConfig);

    // 3. DO client (circuit breaker + routing)
    this.doClient = new DurableObjectClient(env, this.broadcastConfig);
    this.doClient.setBatchManager(this.batchManager);

    // 4. Wire batch flush → DO client
    this.batchManager.setFlushCallback(async (events) => {
      await this.doClient.broadcastBatch(events);
    });

    // 5. Event broadcaster (10 public methods)
    this.broadcaster = new EventBroadcaster(
      env,
      this.doClient,
      this.batchManager,
      this.broadcastConfig
    );
  }

  // =================== Delegated Public API ===================

  async broadcastMessageEvent(event: Parameters<EventBroadcaster['broadcastMessageEvent']>[0]) {
    return this.broadcaster.broadcastMessageEvent(event);
  }

  async broadcastTypingEvent(event: Parameters<EventBroadcaster['broadcastTypingEvent']>[0]) {
    return this.broadcaster.broadcastTypingEvent(event);
  }

  async broadcastConversationEvent(event: Parameters<EventBroadcaster['broadcastConversationEvent']>[0]) {
    return this.broadcaster.broadcastConversationEvent(event);
  }

  async broadcastConversationTransferred(event: Parameters<EventBroadcaster['broadcastConversationTransferred']>[0]) {
    return this.broadcaster.broadcastConversationTransferred(event);
  }

  async broadcastDelayedMessageEvent(event: Parameters<EventBroadcaster['broadcastDelayedMessageEvent']>[0]) {
    return this.broadcaster.broadcastDelayedMessageEvent(event);
  }

  async broadcastNotificationEvent(event: Parameters<EventBroadcaster['broadcastNotificationEvent']>[0]) {
    return this.broadcaster.broadcastNotificationEvent(event);
  }

  async broadcastPresenceEvent(event: Parameters<EventBroadcaster['broadcastPresenceEvent']>[0]) {
    return this.broadcaster.broadcastPresenceEvent(event);
  }

  async broadcastTeamMemberEvent(event: Parameters<EventBroadcaster['broadcastTeamMemberEvent']>[0]) {
    return this.broadcaster.broadcastTeamMemberEvent(event);
  }

  async broadcastTeamUpdateEvent(event: Parameters<EventBroadcaster['broadcastTeamUpdateEvent']>[0]) {
    return this.broadcaster.broadcastTeamUpdateEvent(event);
  }

  async broadcastNewMessage(params: Parameters<EventBroadcaster['broadcastNewMessage']>[0]) {
    return this.broadcaster.broadcastNewMessage(params);
  }

  // =================== Batch Queue Management ===================

  getBatchQueueStatus() {
    return this.batchManager.getStatus();
  }

  async manualFlush() {
    return this.batchManager.flush();
  }

  updateBatchConfig(config: Partial<BatchConfig>) {
    return this.batchManager.updateConfig(config);
  }

  // =================== Health & Config ===================

  async getHealthStatus() {
    return this.broadcastConfig.getHealthStatus();
  }

  // =================== Lifecycle ===================

  isHealthy() {
    return this.batchManager.isHealthy();
  }

  destroy() {
    this.batchManager.destroy();
  }
}
