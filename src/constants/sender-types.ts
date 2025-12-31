/**
 * Sender Type Constants
 *
 * Centralized sender type definitions for the messaging system.
 * These constants identify who sent a message in the conversation.
 *
 * @module constants/sender-types
 */

/**
 * Sender type enum
 *
 * Identifies the sender of a message:
 * - CUSTOMER: Message sent by a customer through external platforms (LINE, Facebook, etc.)
 * - AGENT: Message sent by a customer service agent
 * - SYSTEM: Automated message sent by the system (notifications, auto-replies, etc.)
 */
export const SENDER_TYPES = {
  /** Message sent by a customer */
  CUSTOMER: 'customer',

  /** Message sent by an agent */
  AGENT: 'agent',

  /** Automated system message */
  SYSTEM: 'system'
} as const;

/**
 * Type-safe sender type
 *
 * Usage:
 * ```typescript
 * import { SENDER_TYPES, type SenderType } from '@/constants/sender-types';
 *
 * function createMessage(senderId: string, type: SenderType, content: string) {
 *   // Type-safe sender type handling
 * }
 * ```
 */
export type SenderType = typeof SENDER_TYPES[keyof typeof SENDER_TYPES];

/**
 * Array of all valid sender type values
 */
export const SENDER_TYPE_VALUES = Object.values(SENDER_TYPES) as SenderType[];

/**
 * Sender type display labels for UI
 */
export const SENDER_TYPE_LABELS: Record<SenderType, string> = {
  [SENDER_TYPES.CUSTOMER]: 'Customer',
  [SENDER_TYPES.AGENT]: 'Agent',
  [SENDER_TYPES.SYSTEM]: 'System'
};

/**
 * Sender type descriptions
 */
export const SENDER_TYPE_DESCRIPTIONS: Record<SenderType, string> = {
  [SENDER_TYPES.CUSTOMER]: 'Message sent by a customer through external messaging platforms',
  [SENDER_TYPES.AGENT]: 'Message sent by a customer service agent',
  [SENDER_TYPES.SYSTEM]: 'Automated message sent by the system'
};

/**
 * Sender type colors for UI (Tailwind CSS classes)
 */
export const SENDER_TYPE_COLORS: Record<SenderType, string> = {
  [SENDER_TYPES.CUSTOMER]: 'bg-blue-100 text-blue-800',
  [SENDER_TYPES.AGENT]: 'bg-green-100 text-green-800',
  [SENDER_TYPES.SYSTEM]: 'bg-gray-100 text-gray-800'
};

/**
 * Sender type icons
 */
export const SENDER_TYPE_ICONS: Record<SenderType, string> = {
  [SENDER_TYPES.CUSTOMER]: '👤',
  [SENDER_TYPES.AGENT]: '👨‍💼',
  [SENDER_TYPES.SYSTEM]: '🤖'
};

/**
 * Human sender types (excludes system)
 */
export const HUMAN_SENDER_TYPES = [
  SENDER_TYPES.CUSTOMER,
  SENDER_TYPES.AGENT
] as const;

/**
 * Automated sender types
 */
export const AUTOMATED_SENDER_TYPES = [
  SENDER_TYPES.SYSTEM
] as const;

/**
 * Check if a string is a valid sender type
 */
export function isValidSenderType(type: string): type is SenderType {
  return SENDER_TYPE_VALUES.includes(type as SenderType);
}

/**
 * Check if a sender type is human (not automated)
 */
export function isHumanSender(type: SenderType): boolean {
  return HUMAN_SENDER_TYPES.includes(type as typeof HUMAN_SENDER_TYPES[number]);
}

/**
 * Check if a sender type is automated
 */
export function isAutomatedSender(type: SenderType): boolean {
  return AUTOMATED_SENDER_TYPES.includes(type as typeof AUTOMATED_SENDER_TYPES[number]);
}

/**
 * Check if sender is a customer
 */
export function isCustomer(type: SenderType): boolean {
  return type === SENDER_TYPES.CUSTOMER;
}

/**
 * Check if sender is an agent
 */
export function isAgent(type: SenderType): boolean {
  return type === SENDER_TYPES.AGENT;
}

/**
 * Check if sender is the system
 */
export function isSystem(type: SenderType): boolean {
  return type === SENDER_TYPES.SYSTEM;
}

/**
 * Get sender type display label
 */
export function getSenderTypeLabel(type: SenderType): string {
  return SENDER_TYPE_LABELS[type] || type;
}

/**
 * Get sender type description
 */
export function getSenderTypeDescription(type: SenderType): string {
  return SENDER_TYPE_DESCRIPTIONS[type] || '';
}

/**
 * Get sender type color class
 */
export function getSenderTypeColor(type: SenderType): string {
  return SENDER_TYPE_COLORS[type] || 'bg-gray-100 text-gray-800';
}

/**
 * Get sender type icon
 */
export function getSenderTypeIcon(type: SenderType): string {
  return SENDER_TYPE_ICONS[type] || '•';
}
