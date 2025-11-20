/**
 * Test-safe logging utilities
 * Provides safe logging functions that work in both test and production environments
 */

/**
 * Safe console.log wrapper
 * Suppresses output during tests to reduce noise
 */
export function testSafeLog(...args: any[]): void {
  // Check if running in test environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return; // Suppress logs in test environment
  }

  console.log(...args);
}

/**
 * Safe console.error wrapper
 * Always outputs errors even in test environment
 */
export function testSafeError(...args: any[]): void {
  console.error(...args);
}

/**
 * Get emoji prefix for log messages
 * Provides visual indicators for different log types
 */
export function getEmojiPrefix(type: string): string {
  const emojiMap: Record<string, string> = {
    'BUILD': '🏗️',
    'INFO': 'ℹ️',
    'CHECK': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
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
    'UNLOCK': '🔓'
  };

  return emojiMap[type.toUpperCase()] || '📝';
}

/**
 * Log with timestamp
 */
export function logWithTimestamp(message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  testSafeLog(`[${timestamp}] ${message}`, ...args);
}

/**
 * Log error with timestamp
 */
export function logErrorWithTimestamp(message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  testSafeError(`[${timestamp}] ${message}`, ...args);
}

/**
 * Log with emoji and timestamp
 */
export function logWithEmoji(type: string, message: string, ...args: any[]): void {
  const emoji = getEmojiPrefix(type);
  const timestamp = new Date().toISOString();
  testSafeLog(`${emoji} [${timestamp}] ${message}`, ...args);
}

/**
 * Create a logger instance with prefix
 */
export function createLogger(prefix: string) {
  return {
    log: (...args: any[]) => testSafeLog(`[${prefix}]`, ...args),
    error: (...args: any[]) => testSafeError(`[${prefix}]`, ...args),
    info: (type: string, ...args: any[]) => {
      const emoji = getEmojiPrefix(type);
      testSafeLog(`${emoji} [${prefix}]`, ...args);
    }
  };
}
