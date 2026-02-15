// Real-time module handler exports (WebSocket only)

// Main handlers
export {
  realtimeMainHandler,
  realtimeManagementHandler,
  createRealtimeEvent,
  RealtimeConfigManager
} from './realtime-main';

// Event handler
export {
  eventHandler,
  eventStats,
  EventValidator
} from './event-handler';

// Convenience function exports (WebSocket only)
export async function getRealtimeHandlers() {
  const { realtimeMainHandler, realtimeManagementHandler } = await import('./realtime-main');
  const { eventHandler } = await import('./event-handler');

  return {
    main: realtimeMainHandler,
    management: realtimeManagementHandler,
    event: eventHandler
  };
}

// Manager exports (WebSocket only)
export async function getRealtimeManagers() {
  const { RealtimeConfigManager } = await import('./realtime-main');

  return {
    config: RealtimeConfigManager
  };
}

// Utility exports
export async function getRealtimeUtils() {
  const { createRealtimeEvent } = await import('./realtime-main');
  const { EventValidator } = await import('./event-handler');
  const { eventStats } = await import('./event-handler');

  return {
    createEvent: createRealtimeEvent,
    validateEvent: EventValidator,
    getStats: eventStats
  };
}
