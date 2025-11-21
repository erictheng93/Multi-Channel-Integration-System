/**
 * Test-Safe Logging Utilities
 *
 * Provides logging functions that are safe to use in both test and production environments.
 * In test environments, these functions suppress output to avoid cluttering test results,
 * while in production they delegate to the standard logger.
 */

import { logger } from './logger';

// Detect if we're in a test environment
const isTestEnvironment = (): boolean => {
  return process.env.NODE_ENV === 'test' ||
         process.env.VITEST === 'true' ||
         typeof global.it === 'function' ||
         typeof global.describe === 'function';
};

/**
 * Emoji prefixes for different log contexts
 * Merged from both versions for comprehensive coverage
 */
export const getEmojiPrefix = (context: string): string => {
  const emojiMap: Record<string, string> = {
    'BUILD': '🏗️',
    'INFO': 'ℹ️',
    'CHECK': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
    'WARNING': '⚠️',
    'SUCCESS': '🎉',
    'FAIL': '💥',
    'START': '🚀',
    'STOP': '🛑',
    'SAVE': '💾',
    'LOAD': '📥',
    'SEND': '📤',
    'RECEIVE': '📨',
    'CONNECT': '🔌',
    'DISCONNECT': '🔌❌',
    'AUTH': '🔐',
    'SECURITY': '🔒',
    'DATABASE': '💿',
    'NETWORK': '🌐',
    'WEBSOCKET': '🔄',
    'MESSAGE': '💬',
    'USER': '👤',
    'TEAM': '👥',
    'ADMIN': '👑',
    'CONFIG': '⚙️',
    'MONITOR': '📊',
    'DEBUG': '🐛',
    'TIME': '⏱️',
    'CACHE': '🗄️',
    'QUEUE': '📋',
    'LOCK': '🔐',
    'UNLOCK': '🔓',
    'API': '🌐',
    'INIT': '🚀',
    'CLEANUP': '🧹',
    'HEARTBEAT': '💓',
    'ALARM': '⏰',
    'BROADCAST': '📡',
    'ROOM': '🏠'
  };

  return emojiMap[context.toUpperCase()] || '📝';
};

/**
 * Test-safe log function
 * Suppresses output in test environments to avoid cluttering test results
 */
export const testSafeLog = (message: string, ...args: any[]): void => {
  if (!isTestEnvironment()) {
    // In production, use the centralized logger
    logger.info(message, 'test-safe', args.length > 0 ? { args } : undefined);
  }
  // In test environment, do nothing (suppress output)
};

/**
 * Test-safe error logging function
 * Suppresses output in test environments but still tracks errors internally
 */
export const testSafeError = (message: string, error?: any, ...args: any[]): void => {
  if (!isTestEnvironment()) {
    // In production, use the centralized logger
    logger.error(
      message,
      'test-safe',
      args.length > 0 ? { args } : undefined,
      error
    );
  } else {
    // In test environment, store for potential inspection but don't output
    // This allows tests to verify error handling without cluttering output
    if (global.__TEST_ERRORS__) {
      global.__TEST_ERRORS__.push({ message, error, args });
    }
  }
};

/**
 * Test-safe warning logging function
 */
export const testSafeWarn = (message: string, ...args: any[]): void => {
  if (!isTestEnvironment()) {
    logger.warn(message, 'test-safe', args.length > 0 ? { args } : undefined);
  }
};

/**
 * Test-safe debug logging function
 */
export const testSafeDebug = (message: string, ...args: any[]): void => {
  if (!isTestEnvironment()) {
    logger.debug(message, 'test-safe', args.length > 0 ? { args } : undefined);
  }
};

/**
 * Log with timestamp
 * Enhanced version that uses centralized logger
 */
export function logWithTimestamp(message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  testSafeLog(`[${timestamp}] ${message}`, ...args);
}

/**
 * Log error with timestamp
 * Enhanced version that uses centralized logger
 */
export function logErrorWithTimestamp(message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  testSafeError(`[${timestamp}] ${message}`, undefined, ...args);
}

/**
 * Log with emoji and timestamp
 * Enhanced version that uses centralized logger
 */
export function logWithEmoji(type: string, message: string, ...args: any[]): void {
  const emoji = getEmojiPrefix(type);
  const timestamp = new Date().toISOString();
  testSafeLog(`${emoji} [${timestamp}] ${message}`, ...args);
}

/**
 * Create a test-safe logger with context
 * Unified version combining both approaches
 */
export const createTestSafeLogger = (context: string) => ({
  log: (message: string, ...args: any[]) =>
    testSafeLog(`[${context}] ${message}`, ...args),
  error: (message: string, error?: any, ...args: any[]) =>
    testSafeError(`[${context}] ${message}`, error, ...args),
  warn: (message: string, ...args: any[]) =>
    testSafeWarn(`[${context}] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    testSafeDebug(`[${context}] ${message}`, ...args),
  info: (type: string, message: string, ...args: any[]) => {
    const emoji = getEmojiPrefix(type);
    testSafeLog(`${emoji} [${context}] ${message}`, ...args);
  }
});

/**
 * Alias for backward compatibility
 */
export const createLogger = createTestSafeLogger;

// Global type extension for test error tracking
declare global {
  var __TEST_ERRORS__: Array<{ message: string; error?: any; args: any[] }>;
}
