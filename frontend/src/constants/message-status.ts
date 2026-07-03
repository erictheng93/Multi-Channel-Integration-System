/**
 * Message Status Constants (Frontend)
 *
 * Frontend mirror of backend message status constants.
 * Must be kept in sync with src/constants/message-status.ts
 *
 * @module constants/message-status
 */

/**
 * Message status enum
 */
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  /** 撤回窗口內暫存：尚未推送平台，recallDeadline 前可撤回 */
  BUFFERED: 'buffered',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RECALLED: 'recalled',
  READ: 'read'
} as const;

/**
 * Type-safe message status type
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
  [MESSAGE_STATUS.PENDING]: '待發送',
  [MESSAGE_STATUS.BUFFERED]: '可撤回',
  [MESSAGE_STATUS.SENT]: '已發送',
  [MESSAGE_STATUS.DELIVERED]: '已送達',
  [MESSAGE_STATUS.FAILED]: '失敗',
  [MESSAGE_STATUS.RECALLED]: '已收回',
  [MESSAGE_STATUS.READ]: '已讀'
};

/**
 * Message status colors for UI (Tailwind CSS classes)
 */
export const MESSAGE_STATUS_COLORS: Record<MessageStatus, string> = {
  [MESSAGE_STATUS.PENDING]: 'text-yellow-600 bg-yellow-50',
  [MESSAGE_STATUS.BUFFERED]: 'text-orange-600 bg-orange-50',
  [MESSAGE_STATUS.SENT]: 'text-blue-600 bg-blue-50',
  [MESSAGE_STATUS.DELIVERED]: 'text-green-600 bg-green-50',
  [MESSAGE_STATUS.FAILED]: 'text-red-600 bg-red-50',
  [MESSAGE_STATUS.RECALLED]: 'text-gray-600 bg-gray-50',
  [MESSAGE_STATUS.READ]: 'text-purple-600 bg-purple-50'
};

/**
 * Message status icons
 */
export const MESSAGE_STATUS_ICONS: Record<MessageStatus, string> = {
  [MESSAGE_STATUS.PENDING]: '',
  [MESSAGE_STATUS.BUFFERED]: '⏱',
  [MESSAGE_STATUS.SENT]: '',
  [MESSAGE_STATUS.DELIVERED]: '',
  [MESSAGE_STATUS.FAILED]: '',
  [MESSAGE_STATUS.RECALLED]: '↶',
  [MESSAGE_STATUS.READ]: ''
};

/**
 * Check if a string is a valid message status
 */
export function isValidMessageStatus(status: string): status is MessageStatus {
  return MESSAGE_STATUS_VALUES.includes(status as MessageStatus);
}

/**
 * Get message status display label
 */
export function getMessageStatusLabel(status: MessageStatus): string {
  return MESSAGE_STATUS_LABELS[status] || status;
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
