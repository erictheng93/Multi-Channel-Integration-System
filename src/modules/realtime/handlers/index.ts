// Real-time 模組處理器統一導出

// 主要處理器
export {
  realtimeMainHandler,
  realtimeManagementHandler,
  createRealtimeEvent,
  RealtimeConfigManager
} from './realtime-main';

// SSE 專用處理器
export {
  sseHandler,
  enhancedSSEManager,
  sseConfig
} from './sse-handler';

// 事件處理器
export {
  eventHandler,
  eventStats,
  EventValidator
} from './event-handler';

// 便利函數導出
export async function getRealtimeHandlers() {
  const { realtimeMainHandler, realtimeManagementHandler } = await import('./realtime-main');
  const { sseHandler } = await import('./sse-handler');
  const { eventHandler } = await import('./event-handler');

  return {
    main: realtimeMainHandler,
    management: realtimeManagementHandler,
    sse: sseHandler,
    event: eventHandler
  };
}

// 管理器導出
export async function getRealtimeManagers() {
  const { RealtimeConfigManager } = await import('./realtime-main');
  const { enhancedSSEManager } = await import('./sse-handler');

  return {
    config: RealtimeConfigManager,
    sse: enhancedSSEManager
  };
}

// 實用工具導出
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