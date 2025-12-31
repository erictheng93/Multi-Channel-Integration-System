/**
 * Message Status Constants
 *
 * Centralized message status definitions for the messaging system.
 * These constants should be used throughout the codebase instead of hardcoded strings.
 *
 * @module constants/message-status
 */

/**
 * Message status enum
 *
 * Represents the lifecycle states of a message:
 * - PENDING: Message created but not yet sent to external platform
 * - SENT: Message successfully sent to external platform (LINE, Facebook, etc.)
 * - DELIVERED: Message confirmed delivered to recipient (if platform supports delivery receipts)
 * - FAILED: Message failed to send or deliver
 * - RECALLED: Message was recalled/deleted by sender
 * - READ: Message was read by recipient (if platform supports read receipts)
 */
export const MESSAGE_STATUS = {
  /** Message created but not yet sent */
  PENDING: 'pending',

  /** Message successfully sent to platform */
  SENT: 'sent',

  /** Message delivered to recipient */
  DELIVERED: 'delivered',

  /** Message failed to send or deliver */
  FAILED: 'failed',

  /** Message recalled by sender */
  RECALLED: 'recalled',

  /** Message read by recipient */
  READ: 'read'
} as const;

/**
 * Type-safe message status type
 *
 * Usage:
 * ```typescript
 * import { MESSAGE_STATUS, type MessageStatus } from '@/constants/message-status';
 *
 * function updateMessage(messageId: string, status: MessageStatus) {
 *   // Type-safe message status handling
 * }
 * ```
 */
export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];

/**
 * Array of all valid message status values
 */
export const MESSAGE_STATUS_VALUES = Object.values(MESSAGE_STATUS) as MessageStatus[];

/**
 * Message status display labels for UI
 */
export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  [MESSAGE_STATUS.PENDING]: 'Pending',
  [MESSAGE_STATUS.SENT]: 'Sent',
  [MESSAGE_STATUS.DELIVERED]: 'Delivered',
  [MESSAGE_STATUS.FAILED]: 'Failed',
  [MESSAGE_STATUS.RECALLED]: 'Recalled',
  [MESSAGE_STATUS.READ]: 'Read'
};

/**
 * Message status descriptions
 */
export const MESSAGE_STATUS_DESCRIPTIONS: Record<MessageStatus, string> = {
  [MESSAGE_STATUS.PENDING]: 'Message is queued and waiting to be sent',
  [MESSAGE_STATUS.SENT]: 'Message has been sent to the messaging platform',
  [MESSAGE_STATUS.DELIVERED]: 'Message has been delivered to the recipient',
  [MESSAGE_STATUS.FAILED]: 'Message failed to send or deliver',
  [MESSAGE_STATUS.RECALLED]: 'Message has been recalled by the sender',
  [MESSAGE_STATUS.READ]: 'Message has been read by the recipient'
};

/**
 * Message status colors for UI (Tailwind CSS classes)
 */
export const MESSAGE_STATUS_COLORS: Record<MessageStatus, string> = {
  [MESSAGE_STATUS.PENDING]: 'text-yellow-600 bg-yellow-50',
  [MESSAGE_STATUS.SENT]: 'text-blue-600 bg-blue-50',
  [MESSAGE_STATUS.DELIVERED]: 'text-green-600 bg-green-50',
  [MESSAGE_STATUS.FAILED]: 'text-red-600 bg-red-50',
  [MESSAGE_STATUS.RECALLED]: 'text-gray-600 bg-gray-50',
  [MESSAGE_STATUS.READ]: 'text-purple-600 bg-purple-50'
};

/**
 * Message status icons (for UI)
 */
export const MESSAGE_STATUS_ICONS: Record<MessageStatus, string> = {
  [MESSAGE_STATUS.PENDING]: '⏳',
  [MESSAGE_STATUS.SENT]: '📤',
  [MESSAGE_STATUS.DELIVERED]: '✓',
  [MESSAGE_STATUS.FAILED]: '✗',
  [MESSAGE_STATUS.RECALLED]: '↶',
  [MESSAGE_STATUS.READ]: '✓✓'
};

/**
 * Terminal statuses that won't change
 */
export const TERMINAL_MESSAGE_STATUSES = [
  MESSAGE_STATUS.DELIVERED,
  MESSAGE_STATUS.FAILED,
  MESSAGE_STATUS.RECALLED,
  MESSAGE_STATUS.READ
] as const;

/**
 * Active statuses (can still be updated)
 */
export const ACTIVE_MESSAGE_STATUSES = [
  MESSAGE_STATUS.PENDING,
  MESSAGE_STATUS.SENT
] as const;

/**
 * Success statuses
 */
export const SUCCESS_MESSAGE_STATUSES = [
  MESSAGE_STATUS.SENT,
  MESSAGE_STATUS.DELIVERED,
  MESSAGE_STATUS.READ
] as const;

/**
 * Error statuses
 */
export const ERROR_MESSAGE_STATUSES = [
  MESSAGE_STATUS.FAILED
] as const;

/**
 * Check if a string is a valid message status
 */
export function isValidMessageStatus(status: string): status is MessageStatus {
  return MESSAGE_STATUS_VALUES.includes(status as MessageStatus);
}

/**
 * Check if a status is terminal (won't change)
 */
export function isTerminalStatus(status: MessageStatus): boolean {
  return TERMINAL_MESSAGE_STATUSES.includes(status as typeof TERMINAL_MESSAGE_STATUSES[number]);
}

/**
 * Check if a status is active (can still be updated)
 */
export function isActiveStatus(status: MessageStatus): boolean {
  return ACTIVE_MESSAGE_STATUSES.includes(status as typeof ACTIVE_MESSAGE_STATUSES[number]);
}

/**
 * Check if a status indicates success
 */
export function isSuccessStatus(status: MessageStatus): boolean {
  return SUCCESS_MESSAGE_STATUSES.includes(status as typeof SUCCESS_MESSAGE_STATUSES[number]);
}

/**
 * Check if a status indicates error
 */
export function isErrorStatus(status: MessageStatus): boolean {
  return ERROR_MESSAGE_STATUSES.includes(status as typeof ERROR_MESSAGE_STATUSES[number]);
}

/**
 * Get message status display label
 */
export function getMessageStatusLabel(status: MessageStatus): string {
  return MESSAGE_STATUS_LABELS[status] || status;
}

/**
 * Get message status description
 */
export function getMessageStatusDescription(status: MessageStatus): string {
  return MESSAGE_STATUS_DESCRIPTIONS[status] || '';
}

/**
 * Get message status color class
 */
export function getMessageStatusColor(status: MessageStatus): string {
  return MESSAGE_STATUS_COLORS[status] || 'text-gray-600 bg-gray-50';
}

/**
 * Get message status icon
 */
export function getMessageStatusIcon(status: MessageStatus): string {
  return MESSAGE_STATUS_ICONS[status] || '•';
}
