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
 */
export const getEmojiPrefix = (context: string): string => {
  const emojiMap: Record<string, string> = {
    'BUILD': '🏗️',
    'ERROR': '❌',
    'WARNING': '⚠️',
    'SUCCESS': '✅',
    'INFO': 'ℹ️',
    'DEBUG': '🐛',
    'WEBSOCKET': '🔌',
    'DATABASE': '🗄️',
    'AUTH': '🔐',
    'CACHE': '💾',
    'API': '🌐',
    'QUEUE': '📬',
    'INIT': '🚀',
    'CLEANUP': '🧹',
    'CONNECT': '🔗',
    'DISCONNECT': '⚡',
    'MESSAGE': '💬',
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
 * Create a test-safe logger with context
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
});

// Global type extension for test error tracking
declare global {
  var __TEST_ERRORS__: Array<{ message: string; error?: any; args: any[] }>;
}
