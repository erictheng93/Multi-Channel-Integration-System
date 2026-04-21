/**
 * WebSocket Event Type Definitions
 *
 * This file provides TypeScript discriminated union types for WebSocket events,
 * enabling type-safe event handling with exhaustive pattern matching.
 *
 * @module types/websocket-events
 */

import type { Message } from './index'
import { WS_EVENTS, type WebSocketEventType } from '@/constants/websocket-events'

// ==========================================
// Base Event Interface
// ==========================================

/**
 * Base interface for all WebSocket events
 */
interface BaseWebSocketEvent {
  type: WebSocketEventType
  timestamp?: number
  conversationId?: string
}

// ==========================================
// Message Events
// ==========================================

/**
 * New message event payload
 */
export interface NewMessageEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.NEW_MESSAGE
  message: Message
  conversationId: string
  data?: {
    conversationId: string
    message: Message
  }
}

/**
 * Message read event payload
 */
export interface MessageReadEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.MESSAGE_READ
  messageId: string
  readBy: string
  readAt: string
}

/**
 * Message recalled event payload
 */
export interface MessageRecalledEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.MESSAGE_RECALLED
  messageId: string
  recalledBy: string
  recalledAt: string
}

// ==========================================
// Presence Events
// ==========================================

/**
 * User connected event payload
 */
export interface UserConnectedEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.USER_CONNECTED
  userId: string
  userName?: string
  connectedAt?: string
}

/**
 * User disconnected event payload
 */
export interface UserDisconnectedEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.USER_DISCONNECTED
  userId: string
  disconnectedAt?: string
}

/**
 * Typing start event payload
 */
export interface TypingStartEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.TYPING_START
  userId: string
  userName?: string
}

/**
 * Typing stop event payload
 */
export interface TypingStopEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.TYPING_STOP
  userId: string
}

// ==========================================
// Connection Events
// ==========================================

/**
 * Connection state changed event payload
 */
export interface ConnectionStateEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.CONNECTION_STATE
  state: 'connected' | 'disconnected' | 'reconnecting' | 'error'
  previousState?: string
}

/**
 * Heartbeat event payload
 */
export interface HeartbeatEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.HEARTBEAT
  serverTime?: number
}

/**
 * Error event payload
 */
export interface ErrorEvent extends BaseWebSocketEvent {
  type: typeof WS_EVENTS.ERROR
  error: string
  code?: string
  details?: unknown
}

// ==========================================
// Discriminated Union Type
// ==========================================

/**
 * Discriminated union of all WebSocket events
 *
 * Usage with exhaustive pattern matching:
 * ```typescript
 * function handleEvent(event: WebSocketEvent) {
 * switch (event.type) {
 * case WS_EVENTS.NEW_MESSAGE:
 * // TypeScript knows event is NewMessageEvent
 * logger.debug(event.message.content)
 * break
 * case WS_EVENTS.USER_CONNECTED:
 * // TypeScript knows event is UserConnectedEvent
 * logger.debug(event.userId)
 * break
 * // ... other cases
 * default:
 * // Exhaustive check
 * const _exhaustive: never = event
 * throw new Error(`Unhandled event type: ${_exhaustive}`)
 * }
 * }
 * ```
 */
export type WebSocketEvent =
  | NewMessageEvent
  | MessageReadEvent
  | MessageRecalledEvent
  | UserConnectedEvent
  | UserDisconnectedEvent
  | TypingStartEvent
  | TypingStopEvent
  | ConnectionStateEvent
  | HeartbeatEvent
  | ErrorEvent

// ==========================================
// Type Guards
// ==========================================

/**
 * Type guard for NewMessageEvent
 */
export function isNewMessageEvent(event: WebSocketEvent): event is NewMessageEvent {
  return event.type === WS_EVENTS.NEW_MESSAGE
}

/**
 * Type guard for MessageReadEvent
 */
export function isMessageReadEvent(event: WebSocketEvent): event is MessageReadEvent {
  return event.type === WS_EVENTS.MESSAGE_READ
}

/**
 * Type guard for MessageRecalledEvent
 */
export function isMessageRecalledEvent(event: WebSocketEvent): event is MessageRecalledEvent {
  return event.type === WS_EVENTS.MESSAGE_RECALLED
}

/**
 * Type guard for UserConnectedEvent
 */
export function isUserConnectedEvent(event: WebSocketEvent): event is UserConnectedEvent {
  return event.type === WS_EVENTS.USER_CONNECTED
}

/**
 * Type guard for UserDisconnectedEvent
 */
export function isUserDisconnectedEvent(event: WebSocketEvent): event is UserDisconnectedEvent {
  return event.type === WS_EVENTS.USER_DISCONNECTED
}

/**
 * Type guard for TypingStartEvent
 */
export function isTypingStartEvent(event: WebSocketEvent): event is TypingStartEvent {
  return event.type === WS_EVENTS.TYPING_START
}

/**
 * Type guard for TypingStopEvent
 */
export function isTypingStopEvent(event: WebSocketEvent): event is TypingStopEvent {
  return event.type === WS_EVENTS.TYPING_STOP
}

/**
 * Type guard for ConnectionStateEvent
 */
export function isConnectionStateEvent(event: WebSocketEvent): event is ConnectionStateEvent {
  return event.type === WS_EVENTS.CONNECTION_STATE
}

/**
 * Type guard for HeartbeatEvent
 */
export function isHeartbeatEvent(event: WebSocketEvent): event is HeartbeatEvent {
  return event.type === WS_EVENTS.HEARTBEAT
}

/**
 * Type guard for ErrorEvent
 */
export function isErrorEvent(event: WebSocketEvent): event is ErrorEvent {
  return event.type === WS_EVENTS.ERROR
}

// ==========================================
// Helper Types
// ==========================================

/**
 * Extract payload type from event type
 */
export type EventPayload<T extends WebSocketEventType> =
  T extends typeof WS_EVENTS.NEW_MESSAGE ? NewMessageEvent :
  T extends typeof WS_EVENTS.MESSAGE_READ ? MessageReadEvent :
  T extends typeof WS_EVENTS.MESSAGE_RECALLED ? MessageRecalledEvent :
  T extends typeof WS_EVENTS.USER_CONNECTED ? UserConnectedEvent :
  T extends typeof WS_EVENTS.USER_DISCONNECTED ? UserDisconnectedEvent :
  T extends typeof WS_EVENTS.TYPING_START ? TypingStartEvent :
  T extends typeof WS_EVENTS.TYPING_STOP ? TypingStopEvent :
  T extends typeof WS_EVENTS.CONNECTION_STATE ? ConnectionStateEvent :
  T extends typeof WS_EVENTS.HEARTBEAT ? HeartbeatEvent :
  T extends typeof WS_EVENTS.ERROR ? ErrorEvent :
  never

/**
 * Message-related events union type
 */
export type MessageRelatedEvent = NewMessageEvent | MessageReadEvent | MessageRecalledEvent

/**
 * Presence-related events union type
 */
export type PresenceRelatedEvent = UserConnectedEvent | UserDisconnectedEvent | TypingStartEvent | TypingStopEvent

/**
 * Connection-related events union type
 */
export type ConnectionRelatedEvent = ConnectionStateEvent | HeartbeatEvent | ErrorEvent

/**
 * Type guard for message-related events
 */
export function isMessageRelatedEvent(event: WebSocketEvent): event is MessageRelatedEvent {
  const messageEventTypes: string[] = [WS_EVENTS.NEW_MESSAGE, WS_EVENTS.MESSAGE_READ, WS_EVENTS.MESSAGE_RECALLED]
  return messageEventTypes.includes(event.type)
}

/**
 * Type guard for presence-related events
 */
export function isPresenceRelatedEvent(event: WebSocketEvent): event is PresenceRelatedEvent {
  const presenceEventTypes: string[] = [WS_EVENTS.USER_CONNECTED, WS_EVENTS.USER_DISCONNECTED, WS_EVENTS.TYPING_START, WS_EVENTS.TYPING_STOP]
  return presenceEventTypes.includes(event.type)
}

/**
 * Type guard for connection-related events
 */
export function isConnectionRelatedEvent(event: WebSocketEvent): event is ConnectionRelatedEvent {
  const connectionEventTypes: string[] = [WS_EVENTS.CONNECTION_STATE, WS_EVENTS.HEARTBEAT, WS_EVENTS.ERROR]
  return connectionEventTypes.includes(event.type)
}
