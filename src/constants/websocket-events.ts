/**
 * WebSocket Event Constants
 *
 * Centralized WebSocket event type definitions for real-time communication.
 * These constants should be used throughout the codebase instead of hardcoded strings.
 *
 * IMPORTANT: All event types use lowercase to ensure consistency.
 * Frontend normalizes incoming events to lowercase (Postel's Law / defense-in-depth).
 *
 * @module constants/websocket-events
 */

/**
 * WebSocket event types enum
 *
 * Represents the different types of real-time events:
 * - NEW_MESSAGE: New message received in a conversation
 * - USER_CONNECTED: User connected to a conversation
 * - USER_DISCONNECTED: User disconnected from a conversation
 * - TYPING_START: User started typing
 * - TYPING_STOP: User stopped typing
 * - MESSAGE_READ: Message was read by recipient
 * - MESSAGE_RECALLED: Message was recalled by sender
 * - CONNECTION_STATE: Connection state changed
 */
export const WS_EVENTS = {
  /** New message received */
  NEW_MESSAGE: 'new_message',

  /** User connected to conversation */
  USER_CONNECTED: 'user_connected',

  /** User disconnected from conversation */
  USER_DISCONNECTED: 'user_disconnected',

  /** User started typing */
  TYPING_START: 'typing_start',

  /** User stopped typing */
  TYPING_STOP: 'typing_stop',

  /** Message was read by recipient */
  MESSAGE_READ: 'message_read',

  /** Message was recalled */
  MESSAGE_RECALLED: 'message_recalled',

  /** Connection state changed */
  CONNECTION_STATE: 'connection_state',

  /** Heartbeat/ping for connection health */
  HEARTBEAT: 'heartbeat',

  /** Error event */
  ERROR: 'error'
} as const;

/**
 * Type-safe WebSocket event type
 *
 * Usage:
 * ```typescript
 * import { WS_EVENTS, type WebSocketEventType } from '@/constants/websocket-events';
 *
 * function handleEvent(type: WebSocketEventType, payload: unknown) {
 * if (type === WS_EVENTS.NEW_MESSAGE) {
 * // Type-safe event handling
 * }
 * }
 * ```
 */
export type WebSocketEventType = typeof WS_EVENTS[keyof typeof WS_EVENTS];

/**
 * Array of all valid WebSocket event types
 */
export const WS_EVENT_VALUES = Object.values(WS_EVENTS) as WebSocketEventType[];

/**
 * WebSocket connection states
 */
export const WS_CONNECTION_STATES = {
  /** Not connected */
  DISCONNECTED: 'disconnected',

  /** Connecting in progress */
  CONNECTING: 'connecting',

  /** Successfully connected */
  CONNECTED: 'connected',

  /** Reconnecting after disconnect */
  RECONNECTING: 'reconnecting',

  /** Error state */
  ERROR: 'error'
} as const;

/**
 * Type-safe connection state type
 */
export type WebSocketConnectionState = typeof WS_CONNECTION_STATES[keyof typeof WS_CONNECTION_STATES];

/**
 * WebSocket event labels for logging/debugging
 */
export const WS_EVENT_LABELS: Record<WebSocketEventType, string> = {
  [WS_EVENTS.NEW_MESSAGE]: 'New Message',
  [WS_EVENTS.USER_CONNECTED]: 'User Connected',
  [WS_EVENTS.USER_DISCONNECTED]: 'User Disconnected',
  [WS_EVENTS.TYPING_START]: 'Typing Started',
  [WS_EVENTS.TYPING_STOP]: 'Typing Stopped',
  [WS_EVENTS.MESSAGE_READ]: 'Message Read',
  [WS_EVENTS.MESSAGE_RECALLED]: 'Message Recalled',
  [WS_EVENTS.CONNECTION_STATE]: 'Connection State',
  [WS_EVENTS.HEARTBEAT]: 'Heartbeat',
  [WS_EVENTS.ERROR]: 'Error'
};

/**
 * WebSocket event descriptions
 */
export const WS_EVENT_DESCRIPTIONS: Record<WebSocketEventType, string> = {
  [WS_EVENTS.NEW_MESSAGE]: 'A new message was received in the conversation',
  [WS_EVENTS.USER_CONNECTED]: 'A user connected to the conversation',
  [WS_EVENTS.USER_DISCONNECTED]: 'A user disconnected from the conversation',
  [WS_EVENTS.TYPING_START]: 'A user started typing a message',
  [WS_EVENTS.TYPING_STOP]: 'A user stopped typing',
  [WS_EVENTS.MESSAGE_READ]: 'A message was marked as read',
  [WS_EVENTS.MESSAGE_RECALLED]: 'A message was recalled by the sender',
  [WS_EVENTS.CONNECTION_STATE]: 'The WebSocket connection state changed',
  [WS_EVENTS.HEARTBEAT]: 'Heartbeat signal for connection health monitoring',
  [WS_EVENTS.ERROR]: 'An error occurred in the WebSocket connection'
};

/**
 * Check if a string is a valid WebSocket event type
 */
export function isValidWsEvent(event: string): event is WebSocketEventType {
  return WS_EVENT_VALUES.includes(event as WebSocketEventType);
}

/**
 * Normalize event type to lowercase (defense-in-depth)
 * Follows Postel's Law: "Be liberal in what you accept"
 */
export function normalizeEventType(event: string): string {
  return (event || '').toLowerCase();
}

/**
 * Get event label for display/logging
 */
export function getWsEventLabel(event: WebSocketEventType): string {
  return WS_EVENT_LABELS[event] || event;
}

/**
 * Get event description
 */
export function getWsEventDescription(event: WebSocketEventType): string {
  return WS_EVENT_DESCRIPTIONS[event] || '';
}

/**
 * Events that trigger UI updates
 */
export const UI_UPDATE_EVENTS = [
  WS_EVENTS.NEW_MESSAGE,
  WS_EVENTS.MESSAGE_READ,
  WS_EVENTS.MESSAGE_RECALLED
] as const;

/**
 * Events related to user presence
 */
export const PRESENCE_EVENTS = [
  WS_EVENTS.USER_CONNECTED,
  WS_EVENTS.USER_DISCONNECTED,
  WS_EVENTS.TYPING_START,
  WS_EVENTS.TYPING_STOP
] as const;

/**
 * Connection-related events
 */
export const CONNECTION_EVENTS = [
  WS_EVENTS.CONNECTION_STATE,
  WS_EVENTS.HEARTBEAT,
  WS_EVENTS.ERROR
] as const;
