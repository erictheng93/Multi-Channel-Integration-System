/**
 * Conversation Status Constants
 *
 * Centralized conversation status definitions for the conversation management system.
 * These constants should be used throughout the codebase instead of hardcoded strings.
 *
 * @module constants/conversation-status
 */

/**
 * Conversation status enum
 *
 * Represents the lifecycle states of a conversation:
 * - ACTIVE: Conversation is currently active and can receive messages
 * - PENDING: Conversation is waiting for assignment or initial response
 * - IN_PROGRESS: Conversation is being actively handled by an agent
 * - CLOSED: Conversation has been closed and archived
 * - RESOLVED: Conversation issue has been resolved
 * - WAITING: Conversation is waiting for customer response
 */
export const CONVERSATION_STATUS = {
  /** Conversation is currently active */
  ACTIVE: 'active',

  /** Conversation is waiting for assignment */
  PENDING: 'pending',

  /** Conversation is being handled by an agent */
  IN_PROGRESS: 'in-progress',

  /** Conversation has been assigned to an agent */
  ASSIGNED: 'assigned',

  /** Conversation has been closed */
  CLOSED: 'closed',

  /** Conversation issue resolved */
  RESOLVED: 'resolved',

  /** Waiting for customer response */
  WAITING: 'waiting'
} as const;

/**
 * Type-safe conversation status type
 *
 * Usage:
 * ```typescript
 * import { CONVERSATION_STATUS, type ConversationStatus } from '@/constants/conversation-status';
 *
 * function updateConversation(id: string, status: ConversationStatus) {
 *   // Type-safe conversation status handling
 * }
 * ```
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
  [CONVERSATION_STATUS.ACTIVE]: 'Active',
  [CONVERSATION_STATUS.PENDING]: 'Pending',
  [CONVERSATION_STATUS.IN_PROGRESS]: 'In Progress',
  [CONVERSATION_STATUS.ASSIGNED]: 'Assigned',
  [CONVERSATION_STATUS.CLOSED]: 'Closed',
  [CONVERSATION_STATUS.RESOLVED]: 'Resolved',
  [CONVERSATION_STATUS.WAITING]: 'Waiting'
};

/**
 * Conversation status descriptions
 */
export const CONVERSATION_STATUS_DESCRIPTIONS: Record<ConversationStatus, string> = {
  [CONVERSATION_STATUS.ACTIVE]: 'Conversation is currently active and can receive messages',
  [CONVERSATION_STATUS.PENDING]: 'Conversation is waiting for agent assignment or initial response',
  [CONVERSATION_STATUS.IN_PROGRESS]: 'Conversation is being actively handled by an agent',
  [CONVERSATION_STATUS.ASSIGNED]: 'Conversation has been assigned to an agent',
  [CONVERSATION_STATUS.CLOSED]: 'Conversation has been closed and archived',
  [CONVERSATION_STATUS.RESOLVED]: 'Customer issue has been resolved',
  [CONVERSATION_STATUS.WAITING]: 'Waiting for customer response'
};

/**
 * Conversation status colors for UI (Tailwind CSS classes)
 */
export const CONVERSATION_STATUS_COLORS: Record<ConversationStatus, string> = {
  [CONVERSATION_STATUS.ACTIVE]: 'text-green-600 bg-green-50 border-green-200',
  [CONVERSATION_STATUS.PENDING]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  [CONVERSATION_STATUS.IN_PROGRESS]: 'text-blue-600 bg-blue-50 border-blue-200',
  [CONVERSATION_STATUS.ASSIGNED]: 'text-cyan-600 bg-cyan-50 border-cyan-200',
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
  [CONVERSATION_STATUS.ASSIGNED]: '👤',
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
  CONVERSATION_STATUS.ASSIGNED,
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
 * Actionable statuses (requires agent action)
 */
export const ACTIONABLE_CONVERSATION_STATUSES = [
  CONVERSATION_STATUS.PENDING,
  CONVERSATION_STATUS.IN_PROGRESS,
  CONVERSATION_STATUS.ASSIGNED
] as const;

/**
 * Waiting statuses (waiting for external action)
 */
export const WAITING_CONVERSATION_STATUSES = [
  CONVERSATION_STATUS.WAITING
] as const;

/**
 * Check if a string is a valid conversation status
 */
export function isValidConversationStatus(status: string): status is ConversationStatus {
  return CONVERSATION_STATUS_VALUES.includes(status as ConversationStatus);
}

/**
 * Check if a conversation is open (can receive messages)
 */
export function isOpenConversation(status: ConversationStatus): boolean {
  return OPEN_CONVERSATION_STATUSES.includes(status as typeof OPEN_CONVERSATION_STATUSES[number]);
}

/**
 * Check if a conversation is closed (archived)
 */
export function isClosedConversation(status: ConversationStatus): boolean {
  return CLOSED_CONVERSATION_STATUSES.includes(status as typeof CLOSED_CONVERSATION_STATUSES[number]);
}

/**
 * Check if a conversation requires agent action
 */
export function requiresAgentAction(status: ConversationStatus): boolean {
  return ACTIONABLE_CONVERSATION_STATUSES.includes(status as typeof ACTIONABLE_CONVERSATION_STATUSES[number]);
}

/**
 * Check if a conversation is waiting for external action
 */
export function isWaitingForAction(status: ConversationStatus): boolean {
  return WAITING_CONVERSATION_STATUSES.includes(status as typeof WAITING_CONVERSATION_STATUSES[number]);
}

/**
 * Get conversation status display label
 */
export function getConversationStatusLabel(status: ConversationStatus): string {
  return CONVERSATION_STATUS_LABELS[status] || status;
}

/**
 * Get conversation status description
 */
export function getConversationStatusDescription(status: ConversationStatus): string {
  return CONVERSATION_STATUS_DESCRIPTIONS[status] || '';
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

/**
 * Valid status transitions
 * Maps current status to allowed next statuses
 */
export const CONVERSATION_STATUS_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  [CONVERSATION_STATUS.PENDING]: [
    CONVERSATION_STATUS.ACTIVE,
    CONVERSATION_STATUS.ASSIGNED,
    CONVERSATION_STATUS.IN_PROGRESS,
    CONVERSATION_STATUS.CLOSED
  ],
  [CONVERSATION_STATUS.ACTIVE]: [
    CONVERSATION_STATUS.IN_PROGRESS,
    CONVERSATION_STATUS.ASSIGNED,
    CONVERSATION_STATUS.WAITING,
    CONVERSATION_STATUS.CLOSED,
    CONVERSATION_STATUS.RESOLVED
  ],
  [CONVERSATION_STATUS.ASSIGNED]: [
    CONVERSATION_STATUS.ACTIVE,
    CONVERSATION_STATUS.IN_PROGRESS,
    CONVERSATION_STATUS.WAITING,
    CONVERSATION_STATUS.RESOLVED,
    CONVERSATION_STATUS.CLOSED
  ],
  [CONVERSATION_STATUS.IN_PROGRESS]: [
    CONVERSATION_STATUS.ACTIVE,
    CONVERSATION_STATUS.ASSIGNED,
    CONVERSATION_STATUS.WAITING,
    CONVERSATION_STATUS.RESOLVED,
    CONVERSATION_STATUS.CLOSED
  ],
  [CONVERSATION_STATUS.WAITING]: [
    CONVERSATION_STATUS.ACTIVE,
    CONVERSATION_STATUS.ASSIGNED,
    CONVERSATION_STATUS.IN_PROGRESS,
    CONVERSATION_STATUS.CLOSED,
    CONVERSATION_STATUS.RESOLVED
  ],
  [CONVERSATION_STATUS.RESOLVED]: [
    CONVERSATION_STATUS.CLOSED,
    CONVERSATION_STATUS.ACTIVE
  ],
  [CONVERSATION_STATUS.CLOSED]: [
    CONVERSATION_STATUS.ACTIVE
  ]
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(from: ConversationStatus, to: ConversationStatus): boolean {
  return CONVERSATION_STATUS_TRANSITIONS[from]?.includes(to) || false;
}

/**
 * Get allowed next statuses for a given status
 */
export function getAllowedNextStatuses(currentStatus: ConversationStatus): ConversationStatus[] {
  return CONVERSATION_STATUS_TRANSITIONS[currentStatus] || [];
}
