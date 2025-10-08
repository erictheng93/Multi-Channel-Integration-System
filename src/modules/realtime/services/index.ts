// Real-time 模組服務層統一導出 (Phase 3: WebSocket only)

// 主要服務
export {
  RealtimeManager,
  ServiceStatus,
  type ServiceHealth
} from './realtime-manager';

// REMOVED: SSE connection service (Phase 3 cleanup - 100% WebSocket rollout)
// export {
//   SSEConnectionPool
// } from './sse-connection-service';

export {
  EventQueueService,
  ProcessingStrategy
} from './event-queue-service';

// 服務實例創建工具 (Phase 3: WebSocket only)
export const createRealtimeServices = async (env: any) => {
  const { RealtimeManager } = await import('./realtime-manager');
  const { EventQueueService } = await import('./event-queue-service');

  const realtimeManager = RealtimeManager.getInstance();
  // REMOVED: SSE connection pool (Phase 3 cleanup)
  const eventQueueService = new EventQueueService(env);

  return {
    realtimeManager,
    // REMOVED: sseConnectionPool (Phase 3 cleanup)
    eventQueueService
  };
};

// 便利函數 (Phase 3: WebSocket only)
export async function getRealtimeServices() {
  const { RealtimeManager } = await import('./realtime-manager');
  const { EventQueueService } = await import('./event-queue-service');

  return {
    manager: RealtimeManager.getInstance,
    // REMOVED: createPool (Phase 3 cleanup)
    createQueue: (env: any) => new EventQueueService(env)
  };
}