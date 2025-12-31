/**
 * Platform Constants
 *
 * Centralized platform/channel definitions for multi-channel integration.
 * These constants identify the messaging platforms and internal channels.
 *
 * @module constants/platforms
 */

/**
 * Platform enum
 *
 * Supported messaging platforms and internal channels:
 * - LINE: LINE Official Account messaging platform
 * - FACEBOOK: Facebook Messenger platform
 * - SYSTEM: Internal system messages and notifications
 * - ADMIN: Administrative messages and actions
 */
export const PLATFORMS = {
  /** LINE Official Account */
  LINE: 'line',

  /** Facebook Messenger */
  FACEBOOK: 'facebook',

  /** Internal system */
  SYSTEM: 'system',

  /** Administrative actions */
  ADMIN: 'admin'
} as const;

/**
 * Type-safe platform type
 *
 * Usage:
 * ```typescript
 * import { PLATFORMS, type Platform } from '@/constants/platforms';
 *
 * function sendMessage(platform: Platform, message: string) {
 *   // Type-safe platform handling
 * }
 * ```
 */
export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

/**
 * Array of all valid platform values
 */
export const PLATFORM_VALUES = Object.values(PLATFORMS) as Platform[];

/**
 * Platform display names for UI
 */
export const PLATFORM_LABELS: Record<Platform, string> = {
  [PLATFORMS.LINE]: 'LINE',
  [PLATFORMS.FACEBOOK]: 'Facebook Messenger',
  [PLATFORMS.SYSTEM]: 'System',
  [PLATFORMS.ADMIN]: 'Admin'
};

/**
 * Platform descriptions
 */
export const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  [PLATFORMS.LINE]: 'LINE Official Account messaging platform for customer communications',
  [PLATFORMS.FACEBOOK]: 'Facebook Messenger platform for customer communications',
  [PLATFORMS.SYSTEM]: 'Internal system notifications and automated messages',
  [PLATFORMS.ADMIN]: 'Administrative operations and internal communications'
};

/**
 * Platform colors for UI (Tailwind CSS classes)
 */
export const PLATFORM_COLORS: Record<Platform, string> = {
  [PLATFORMS.LINE]: 'bg-green-500 text-white',
  [PLATFORMS.FACEBOOK]: 'bg-blue-600 text-white',
  [PLATFORMS.SYSTEM]: 'bg-gray-600 text-white',
  [PLATFORMS.ADMIN]: 'bg-purple-600 text-white'
};

/**
 * Platform icons/emojis
 */
export const PLATFORM_ICONS: Record<Platform, string> = {
  [PLATFORMS.LINE]: '💬',
  [PLATFORMS.FACEBOOK]: '📘',
  [PLATFORMS.SYSTEM]: '⚙️',
  [PLATFORMS.ADMIN]: '👨‍💼'
};

/**
 * External messaging platforms (connected to third-party services)
 */
export const EXTERNAL_PLATFORMS = [
  PLATFORMS.LINE,
  PLATFORMS.FACEBOOK
] as const;

/**
 * Internal platforms (system-only)
 */
export const INTERNAL_PLATFORMS = [
  PLATFORMS.SYSTEM,
  PLATFORMS.ADMIN
] as const;

/**
 * Platforms that support rich media (images, videos, etc.)
 */
export const RICH_MEDIA_PLATFORMS = [
  PLATFORMS.LINE,
  PLATFORMS.FACEBOOK
] as const;

/**
 * Platforms that support read receipts
 */
export const READ_RECEIPT_PLATFORMS = [
  PLATFORMS.LINE,
  PLATFORMS.FACEBOOK
] as const;

/**
 * Platforms that support typing indicators
 */
export const TYPING_INDICATOR_PLATFORMS = [
  PLATFORMS.LINE,
  PLATFORMS.FACEBOOK
] as const;

/**
 * Platform-specific file size limits (in bytes)
 */
export const PLATFORM_FILE_SIZE_LIMITS: Record<Platform, number> = {
  [PLATFORMS.LINE]: 10 * 1024 * 1024,      // 10 MB for LINE
  [PLATFORMS.FACEBOOK]: 25 * 1024 * 1024,  // 25 MB for Facebook
  [PLATFORMS.SYSTEM]: 50 * 1024 * 1024,    // 50 MB for system
  [PLATFORMS.ADMIN]: 50 * 1024 * 1024      // 50 MB for admin
};

/**
 * Platform-specific message length limits (in characters)
 */
export const PLATFORM_MESSAGE_LENGTH_LIMITS: Record<Platform, number> = {
  [PLATFORMS.LINE]: 5000,       // LINE supports up to 5000 characters
  [PLATFORMS.FACEBOOK]: 2000,   // Facebook Messenger ~2000 characters
  [PLATFORMS.SYSTEM]: 10000,    // System messages can be longer
  [PLATFORMS.ADMIN]: 10000      // Admin messages can be longer
};

/**
 * Platform-specific supported file types
 */
export const PLATFORM_SUPPORTED_FILE_TYPES: Record<Platform, string[]> = {
  [PLATFORMS.LINE]: ['image/jpeg', 'image/png', 'video/mp4', 'audio/m4a'],
  [PLATFORMS.FACEBOOK]: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/pdf'],
  [PLATFORMS.SYSTEM]: ['*/*'],  // System supports all file types
  [PLATFORMS.ADMIN]: ['*/*']    // Admin supports all file types
};

/**
 * Check if a string is a valid platform
 */
export function isValidPlatform(platform: string): platform is Platform {
  return PLATFORM_VALUES.includes(platform as Platform);
}

/**
 * Check if a platform is external (third-party)
 */
export function isExternalPlatform(platform: Platform): boolean {
  return EXTERNAL_PLATFORMS.includes(platform as typeof EXTERNAL_PLATFORMS[number]);
}

/**
 * Check if a platform is internal
 */
export function isInternalPlatform(platform: Platform): boolean {
  return INTERNAL_PLATFORMS.includes(platform as typeof INTERNAL_PLATFORMS[number]);
}

/**
 * Check if a platform supports rich media
 */
export function supportsRichMedia(platform: Platform): boolean {
  return RICH_MEDIA_PLATFORMS.includes(platform as typeof RICH_MEDIA_PLATFORMS[number]);
}

/**
 * Check if a platform supports read receipts
 */
export function supportsReadReceipts(platform: Platform): boolean {
  return READ_RECEIPT_PLATFORMS.includes(platform as typeof READ_RECEIPT_PLATFORMS[number]);
}

/**
 * Check if a platform supports typing indicators
 */
export function supportsTypingIndicators(platform: Platform): boolean {
  return TYPING_INDICATOR_PLATFORMS.includes(platform as typeof TYPING_INDICATOR_PLATFORMS[number]);
}

/**
 * Get platform display label
 */
export function getPlatformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform] || platform;
}

/**
 * Get platform description
 */
export function getPlatformDescription(platform: Platform): string {
  return PLATFORM_DESCRIPTIONS[platform] || '';
}

/**
 * Get platform color class
 */
export function getPlatformColor(platform: Platform): string {
  return PLATFORM_COLORS[platform] || 'bg-gray-600 text-white';
}

/**
 * Get platform icon
 */
export function getPlatformIcon(platform: Platform): string {
  return PLATFORM_ICONS[platform] || '•';
}

/**
 * Get platform file size limit
 */
export function getPlatformFileSizeLimit(platform: Platform): number {
  return PLATFORM_FILE_SIZE_LIMITS[platform] || 10 * 1024 * 1024;
}

/**
 * Get platform message length limit
 */
export function getPlatformMessageLengthLimit(platform: Platform): number {
  return PLATFORM_MESSAGE_LENGTH_LIMITS[platform] || 5000;
}

/**
 * Get platform supported file types
 */
export function getPlatformSupportedFileTypes(platform: Platform): string[] {
  return PLATFORM_SUPPORTED_FILE_TYPES[platform] || ['*/*'];
}

/**
 * Check if a file type is supported by a platform
 */
export function isPlatformFileTypeSupported(platform: Platform, fileType: string): boolean {
  const supportedTypes = getPlatformSupportedFileTypes(platform);
  return supportedTypes.includes('*/*') || supportedTypes.includes(fileType);
}

/**
 * Validate message length for platform
 */
export function isMessageLengthValid(platform: Platform, messageLength: number): boolean {
  return messageLength <= getPlatformMessageLengthLimit(platform);
}

/**
 * Validate file size for platform
 */
export function isFileSizeValid(platform: Platform, fileSize: number): boolean {
  return fileSize <= getPlatformFileSizeLimit(platform);
}
