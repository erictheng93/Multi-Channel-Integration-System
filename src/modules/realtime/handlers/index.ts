// Real-time 模組處理器統一導出 (Phase 3: WebSocket only)

// 主要處理器
export {
  realtimeMainHandler,
  realtimeManagementHandler,
  createRealtimeEvent,
  RealtimeConfigManager
} from './realtime-main';

// REMOVED: SSE 專用處理器 (Phase 3 cleanup - 100% WebSocket rollout)
// export {
//   sseHandler,
//   enhancedSSEManager,
//   sseConfig
// } from './sse-handler';

// 事件處理器
export {
  eventHandler,
  eventStats,
  EventValidator
} from './event-handler';

// 便利函數導出 (Phase 3: WebSocket only)
export async function getRealtimeHandlers() {
  const { realtimeMainHandler, realtimeManagementHandler } = await import('./realtime-main');
  const { eventHandler } = await import('./event-handler');

  return {
    main: realtimeMainHandler,
    management: realtimeManagementHandler,
    // REMOVED: sse handler (Phase 3 cleanup)
    event: eventHandler
  };
}

// 管理器導出 (Phase 3: WebSocket only)
export async function getRealtimeManagers() {
  const { RealtimeConfigManager } = await import('./realtime-main');

  return {
    config: RealtimeConfigManager
    // REMOVED: sse manager (Phase 3 cleanup)
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