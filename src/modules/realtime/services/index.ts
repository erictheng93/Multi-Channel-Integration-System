// Real-time module service layer exports (WebSocket only)
import type { Bindings } from '@/types';

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
export const createRealtimeServices = async (env: Bindings) => {
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
    createQueue: (env: Bindings) => new EventQueueService(env)
  };
}
