// Real-time module service layer exports (WebSocket only)

// Main services
export {
  RealtimeManager,
  ServiceStatus,
  type ServiceHealth
} from './realtime-manager';

export {
  EventQueueService,
  ProcessingStrategy
} from './event-queue-service';

// Service instance creation utility (WebSocket only)
export const createRealtimeServices = async (env: any) => {
  const { RealtimeManager } = await import('./realtime-manager');
  const { EventQueueService } = await import('./event-queue-service');

  const realtimeManager = RealtimeManager.getInstance();
  const eventQueueService = new EventQueueService(env);

  return {
    realtimeManager,
    eventQueueService
  };
};

// Convenience functions (WebSocket only)
export async function getRealtimeServices() {
  const { RealtimeManager } = await import('./realtime-manager');
  const { EventQueueService } = await import('./event-queue-service');

  return {
    manager: RealtimeManager.getInstance,
    createQueue: (env: any) => new EventQueueService(env)
  };
}
