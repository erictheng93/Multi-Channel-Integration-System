// Real-time 模組服務層統一導出

// 主要服務
export {
  RealtimeManager,
  ServiceStatus,
  type ServiceHealth
} from './realtime-manager';

export {
  SSEConnectionPool
} from './sse-connection-service';

export {
  EventQueueService,
  ProcessingStrategy
} from './event-queue-service';

// 服務實例創建工具
export const createRealtimeServices = async (env: any) => {
  const { RealtimeManager } = await import('./realtime-manager');
  const { SSEConnectionPool } = await import('./sse-connection-service');
  const { EventQueueService } = await import('./event-queue-service');

  const realtimeManager = RealtimeManager.getInstance();
  const sseConnectionPool = new SSEConnectionPool();
  const eventQueueService = new EventQueueService(env);

  return {
    realtimeManager,
    sseConnectionPool,
    eventQueueService
  };
};

// 便利函數
export async function getRealtimeServices() {
  const { RealtimeManager } = await import('./realtime-manager');
  const { SSEConnectionPool } = await import('./sse-connection-service');
  const { EventQueueService } = await import('./event-queue-service');

  return {
    manager: RealtimeManager.getInstance,
    createPool: (config?: any) => new SSEConnectionPool(config),
    createQueue: (env: any) => new EventQueueService(env)
  };
}