import { nowISO, nowMs } from '@/utils/timestamp'
/**
 * Centralized Logging System for Cloudflare Workers
 * Replaces all console.log statements with structured logging
 *
 * @module utils/logger
 * @description
 * Enterprise-grade logging system that:
 * - Supports environment-based log level configuration
 * - Works with Cloudflare Workers (no process.env dependency)
 * - Provides structured JSON logging
 * - Includes performance tracking capabilities
 *
 * Usage:
 * ```ts
 * import { logger, configureLogger } from '@/utils/logger';
 *
 * // Configure with Cloudflare Worker bindings
 * configureLogger({ logLevel: c.env.LOG_LEVEL, environment: c.env.ENVIRONMENT });
 *
 * // Use the logger
 * logger.info('Operation completed', 'MyContext', { userId: 123 });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

export interface LogEntry {
  timestamp: string;
  level: Exclude<LogLevel, 'silent'>;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
  error?: Error | string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStructuredLogs: boolean;
  enablePerformanceTracking: boolean;
  maxLogEntries: number;
}

/**
 * Runtime configuration options for the logger
 * Can be set from Cloudflare Worker environment bindings
 */
export interface LoggerRuntimeConfig {
  logLevel?: LogLevel;
  environment?: string;
}

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private static readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
    silent: 99 // Silent level - nothing gets logged
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: false, // Disabled in production by default
      enableStructuredLogs: true,
      enablePerformanceTracking: true,
      maxLogEntries: 1000,
      ...config
    };
  }

  /**
   * Configure the logger at runtime with Cloudflare Worker environment bindings
   * This method allows dynamic configuration based on environment variables
   *
   * @param options - Runtime configuration options
   */
  configure(options: LoggerRuntimeConfig): void {
    if (options.logLevel) {
      this.config.level = options.logLevel;
    }

    // Automatically enable console for non-production environments
    const isDevelopment = options.environment === 'development' || options.environment === 'dev';
    this.config.enableConsole = isDevelopment || this.config.level === 'debug';
  }

  /**
   * Get current configuration (for debugging/monitoring)
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.config.level === 'silent') return false;
    if (level === 'silent') return false;
    return Logger.levels[level] >= Logger.levels[this.config.level];
  }

  // Reserved for future structured log formatting
  // private formatMessage(entry: LogEntry): string {
  // const timestamp = entry.timestamp;
  // const level = entry.level.toUpperCase().padEnd(5);
  // const context = entry.context ? `[${entry.context}]` : '';
  // const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
  // return `${timestamp} ${level} ${context} ${entry.message}${metadata}`;
  // }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.config.maxLogEntries) {
      this.logBuffer.shift(); // Remove oldest entry
    }
  }

  private log(level: Exclude<LogLevel, 'silent'>, message: string, context?: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: nowISO(),
      level,
      message,
      ...(context && { context }),
      ...(metadata && { metadata })
    };

    this.addToBuffer(entry);

    if (this.config.enableStructuredLogs) {
      // In production, this would go to structured logging service
      // For now, we'll use console only in development
      if (this.config.enableConsole) {
        console.log(JSON.stringify(entry));
      }
    }
  }

  debug(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, context, metadata);
  }

  info(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, context, metadata);
  }

  warn(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, context, metadata);
  }

  error(message: string, context?: string, metadata?: Record<string, unknown>, error?: Error | string): void {
    // Respect `silent` log level (opt-out escape hatch for tests) and the
    // configured level threshold, but do NOT gate on enableConsole — errors
    // must never be silently dropped in production. See 2026-04-14 incident
    // where a D1 query failure was invisible for weeks because enableConsole
    // was false and there was no structured-logging sink wired up.
    if (!this.shouldLog('error')) return;

    const entry: LogEntry = {
      timestamp: nowISO(),
      level: 'error',
      message,
      ...(context && { context }),
      ...(metadata && { metadata }),
      ...(error && { error: error instanceof Error ? error.message : error })
    };

    this.addToBuffer(entry);

    if (this.config.enableStructuredLogs) {
      console.error(JSON.stringify(entry));
    }
  }

  fatal(message: string, context?: string, metadata?: Record<string, unknown>, error?: Error | string): void {
    // See error() comment — fatal must also bypass enableConsole.
    if (!this.shouldLog('fatal')) return;

    const entry: LogEntry = {
      timestamp: nowISO(),
      level: 'fatal',
      message,
      ...(context && { context }),
      ...(metadata && { metadata }),
      ...(error && { error: error instanceof Error ? error.message : error })
    };

    this.addToBuffer(entry);

    if (this.config.enableStructuredLogs) {
      console.error(JSON.stringify(entry));
    }
  }

  // Performance tracking
  startTimer(context: string): () => void {
    if (!this.config.enablePerformanceTracking) return () => {};

    const startTime = nowMs();
    return () => {
      const duration = Date.now() - startTime;
      this.info(`Operation completed`, context, { duration_ms: duration });
    };
  }

  // Get recent logs
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level === level);
  }

  // Clear log buffer
  clearLogs(): void {
    this.logBuffer = [];
  }

  // Export logs
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }
}

// Create singleton logger instance with safe defaults
// In Cloudflare Workers, we cannot rely on process.env
// Use configureLogger() to set runtime configuration from env bindings
export const logger = new Logger({
  level: 'info', // Default to info level (safest for production)
  enableConsole: false, // Disabled by default, enable via configureLogger
  enableStructuredLogs: true,
  enablePerformanceTracking: true
});

/**
 * Configure the global logger instance with Cloudflare Worker environment bindings
 *
 * Call this early in your request handler to set the log level based on environment
 *
 * @example
 * ```ts
 * // In your Hono app or Worker fetch handler
 * app.use('*', async (c, next) => {
 * configureLogger({
 * logLevel: c.env.LOG_LEVEL,
 * environment: c.env.ENVIRONMENT
 * });
 * await next();
 * });
 * ```
 */
export function configureLogger(options: LoggerRuntimeConfig): void {
  logger.configure(options);
}

/**
 * Create a context-specific logger that automatically includes the context in all log entries
 *
 * @param context - The context string (e.g., module name, handler name)
 * @returns An object with logging methods bound to the specified context
 *
 * @example
 * ```ts
 * const log = createContextLogger('AuthHandler');
 * log.info('User logged in', { userId: 123 });
 * // Output: { timestamp: '...', level: 'info', context: 'AuthHandler', message: 'User logged in', metadata: { userId: 123 } }
 * ```
 */
export const createContextLogger = (context: string) => ({
  debug: (message: string, metadata?: Record<string, unknown>) =>
    logger.debug(message, context, metadata),
  info: (message: string, metadata?: Record<string, unknown>) =>
    logger.info(message, context, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    logger.warn(message, context, metadata),
  error: (message: string, metadata?: Record<string, unknown>, error?: Error | string) =>
    logger.error(message, context, metadata, error),
  fatal: (message: string, metadata?: Record<string, unknown>, error?: Error | string) =>
    logger.fatal(message, context, metadata, error),
  timer: () => logger.startTimer(context)
});

/**
 * Type-safe context logger type for use in handler definitions
 */
export type ContextLogger = ReturnType<typeof createContextLogger>;

export default logger;