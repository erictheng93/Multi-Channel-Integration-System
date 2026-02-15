// Real-time module type exports (WebSocket only)

// Core types
export * from './realtime-types';
export * from './event-types';

// Re-export commonly used type combinations
export type {
  RealtimeEvent,
  RealtimeConfig,
  TypingStatus,
  ConversationStatus,
  QueueMessage,
  EventDrivenHandler,
  QueueHandler,
  RealtimeServiceConfig
} from './realtime-types';

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
