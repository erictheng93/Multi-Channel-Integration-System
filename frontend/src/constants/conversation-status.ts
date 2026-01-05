/**
 * Conversation Status Constants (Frontend)
 *
 * Frontend mirror of backend conversation status constants.
 * Must be kept in sync with src/constants/conversation-status.ts
 *
 * @module constants/conversation-status
 */

import type { ConversationStatus as SharedConversationStatus } from '@shared/types/core'

/**
 * Conversation status enum
 */
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  CLOSED: 'closed',
  RESOLVED: 'resolved',
  WAITING: 'waiting'
} as const;

/**
 * Type-safe conversation status type
 */
export type ConversationStatus = typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS];

/**
 * Array of all valid conversation status values
 */
export const CONVERSATION_STATUS_VALUES = Object.values(CONVERSATION_STATUS) as ConversationStatus[];

/**
 * Conversation status display labels for UI
 */
export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  [CONVERSATION_STATUS.ACTIVE]: '進行中',
  [CONVERSATION_STATUS.PENDING]: '待處理',
  [CONVERSATION_STATUS.IN_PROGRESS]: '處理中',
  [CONVERSATION_STATUS.CLOSED]: '已關閉',
  [CONVERSATION_STATUS.RESOLVED]: '已解決',
  [CONVERSATION_STATUS.WAITING]: '等待中'
};

/**
 * Conversation status colors for UI (Tailwind CSS classes)
 */
export const CONVERSATION_STATUS_COLORS: Record<ConversationStatus, string> = {
  [CONVERSATION_STATUS.ACTIVE]: 'text-green-600 bg-green-50 border-green-200',
  [CONVERSATION_STATUS.PENDING]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  [CONVERSATION_STATUS.IN_PROGRESS]: 'text-blue-600 bg-blue-50 border-blue-200',
  [CONVERSATION_STATUS.CLOSED]: 'text-gray-600 bg-gray-50 border-gray-200',
  [CONVERSATION_STATUS.RESOLVED]: 'text-purple-600 bg-purple-50 border-purple-200',
  [CONVERSATION_STATUS.WAITING]: 'text-orange-600 bg-orange-50 border-orange-200'
};

/**
 * Conversation status icons
 */
export const CONVERSATION_STATUS_ICONS: Record<ConversationStatus, string> = {
  [CONVERSATION_STATUS.ACTIVE]: '🟢',
  [CONVERSATION_STATUS.PENDING]: '🟡',
  [CONVERSATION_STATUS.IN_PROGRESS]: '🔵',
  [CONVERSATION_STATUS.CLOSED]: '⚫',
  [CONVERSATION_STATUS.RESOLVED]: '✅',
  [CONVERSATION_STATUS.WAITING]: '⏸️'
};

/**
 * Open statuses (conversation can receive messages)
 */
export const OPEN_CONVERSATION_STATUSES = [
  CONVERSATION_STATUS.ACTIVE,
  CONVERSATION_STATUS.PENDING,
  CONVERSATION_STATUS.IN_PROGRESS,
  CONVERSATION_STATUS.WAITING
] as const;

/**
 * Closed statuses (conversation archived)
 */
export const CLOSED_CONVERSATION_STATUSES = [
  CONVERSATION_STATUS.CLOSED,
  CONVERSATION_STATUS.RESOLVED
] as const;

/**
 * Check if a string is a valid conversation status
 */
export function isValidConversationStatus(status: string): status is ConversationStatus {
  return CONVERSATION_STATUS_VALUES.includes(status as ConversationStatus);
}

/**
 * Check if a conversation is open (accepts both frontend and shared types)
 */
export function isOpenConversation(status: ConversationStatus | SharedConversationStatus): boolean {
  return OPEN_CONVERSATION_STATUSES.includes(status as typeof OPEN_CONVERSATION_STATUSES[number]);
}

/**
 * Check if a conversation is closed (accepts both frontend and shared types)
 */
export function isClosedConversation(status: ConversationStatus | SharedConversationStatus): boolean {
  return CLOSED_CONVERSATION_STATUSES.includes(status as typeof CLOSED_CONVERSATION_STATUSES[number]);
}

/**
 * Get conversation status display label
 */
export function getConversationStatusLabel(status: ConversationStatus): string {
  return CONVERSATION_STATUS_LABELS[status] || status;
}

/**
 * Get conversation status color class
 */
export function getConversationStatusColor(status: ConversationStatus): string {
  return CONVERSATION_STATUS_COLORS[status] || 'text-gray-600 bg-gray-50 border-gray-200';
}

/**
 * Get conversation status icon
 */
export function getConversationStatusIcon(status: ConversationStatus): string {
  return CONVERSATION_STATUS_ICONS[status] || '•';
}
