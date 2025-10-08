// Real-time 模組類型統一導出 (Phase 3: WebSocket only)

// 核心類型
export * from './realtime-types';
// REMOVED: SSE types (Phase 3 cleanup - 100% WebSocket rollout)
// export * from './sse-types';
export * from './event-types';

// 重新導出常用類型組合 (Phase 3: WebSocket only)
export type {
  RealtimeEvent,
  RealtimeConfig,
  TypingStatus,
  ConversationStatus,
  QueueMessage,
  // REMOVED: SSE-specific types (Phase 3 cleanup)
  // SSEConnectionInfo,
  // SSEPushData,
  // SSEConnectionStats,
  EventDrivenHandler,
  // REMOVED: SSEManager (Phase 3 cleanup)
  QueueHandler,
  RealtimeServiceConfig
} from './realtime-types';

// REMOVED: SSE-specific types from sse-types.ts (Phase 3 cleanup - 100% WebSocket rollout)
// export type {
//   SSEConnection,
//   SSEEvent,
//   SSEHeaders,
//   SSEConnectionMetrics,
//   SSEManagerStats,
//   SSEConfig,
//   SSEAuthPayload
// } from './sse-types';

export type {
  EventType,
  EventPriority,
  EventSource,
  MessageEventData,
  TypingEventData,
  StatusEventData,
  AssignmentEventData,
  NotificationEventData,
  ConnectionEventData,
  SystemEventData,
  EventTargets,
  EventProcessingResult,
  EventFilter,
  EventStats
} from './event-types';