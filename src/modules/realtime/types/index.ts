// Real-time 模組類型統一導出

// 核心類型
export * from './realtime-types';
export * from './sse-types';
export * from './event-types';

// 重新導出常用類型組合
export type {
  RealtimeEvent,
  RealtimeConfig,
  TypingStatus,
  ConversationStatus,
  QueueMessage,
  SSEConnectionInfo,
  SSEPushData,
  SSEConnectionStats,
  EventDrivenHandler,
  SSEManager,
  QueueHandler,
  RealtimeServiceConfig
} from './realtime-types';

export type {
  SSEConnection,
  SSEEvent,
  SSEHeaders,
  SSEConnectionMetrics,
  SSEManagerStats,
  SSEConfig,
  SSEAuthPayload
} from './sse-types';

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