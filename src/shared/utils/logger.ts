/**
 * Centralized Logging System
 * Replaces all console.log statements with structured logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
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

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: false, // Disabled in production
      enableStructuredLogs: true,
      enablePerformanceTracking: true,
      maxLogEntries: 1000,
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level];
  }

  // Reserved for future structured log formatting
  // private formatMessage(entry: LogEntry): string {
  //   const timestamp = entry.timestamp;
  //   const level = entry.level.toUpperCase().padEnd(5);
  //   const context = entry.context ? `[${entry.context}]` : '';
  //   const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
  //   return `${timestamp} ${level} ${context} ${entry.message}${metadata}`;
  // }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.config.maxLogEntries) {
      this.logBuffer.shift(); // Remove oldest entry
    }
  }

  private log(level: LogLevel, message: string, context?: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
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
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...(context && { context }),
      ...(metadata && { metadata }),
      ...(error && { error: error instanceof Error ? error.message : error })
    };

    this.addToBuffer(entry);

    if (this.config.enableStructuredLogs) {
      if (this.config.enableConsole) {
        console.error(JSON.stringify(entry));
      }
    }
  }

  fatal(message: string, context?: string, metadata?: Record<string, unknown>, error?: Error | string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'fatal',
      message,
      ...(context && { context }),
      ...(metadata && { metadata }),
      ...(error && { error: error instanceof Error ? error.message : error })
    };

    this.addToBuffer(entry);

    if (this.config.enableStructuredLogs) {
      if (this.config.enableConsole) {
        console.error(JSON.stringify(entry));
      }
    }
  }

  // Performance tracking
  startTimer(context: string): () => void {
    if (!this.config.enablePerformanceTracking) return () => {};

    const startTime = Date.now();
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

// Create singleton logger instance
const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'production';
const isDevelopment = environment === 'development';

export const logger = new Logger({
  level: isDevelopment ? 'debug' : 'info',
  enableConsole: isDevelopment,
  enableStructuredLogs: true,
  enablePerformanceTracking: true
});

// Convenience functions for different contexts
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

export default logger;