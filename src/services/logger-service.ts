// Structured Logging Service
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 提供統一的結構化日誌系統，支持性能追蹤、上下文管理和告警

/**
 * 日誌級別
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * 日誌上下文 - 提供請求/事件的完整上下文信息
 */
export interface LogContext {
  // 核心識別符
  userId?: string;
  conversationId?: string;
  messageId?: string;
  eventId?: string;
  connectionId?: string;

  // 組織信息
  teamId?: number;
  role?: string;

  // 請求信息
  requestId?: string;
  endpoint?: string;
  method?: string;

  // Durable Objects 信息
  durableObjectType?: 'ConversationRoom' | 'UserConnection' | 'MessageBroadcaster' | 'DelayedMessageProcessor';
  durableObjectId?: string;

  // 性能信息
  duration?: number;
  latency?: number;

  // 自定義屬性
  [key: string]: unknown;
}

/**
 * 結構化日誌條目
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * 日誌配置
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableStructured: boolean;
  includeStackTrace: boolean;
  maxContextSize: number;
  serviceName: string;
  environment: 'development' | 'production' | 'test';
}

/**
 * 日誌級別優先級
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.CRITICAL]: 4
};

/**
 * 統一結構化日誌服務
 *
 * 特性：
 * - 結構化 JSON 日誌輸出
 * - 上下文管理和傳遞
 * - 性能追蹤
 * - 錯誤詳情記錄
 * - 告警級別支持
 */
export class Logger {
  private config: LoggerConfig;
  private defaultContext: LogContext;

  constructor(config?: Partial<LoggerConfig>, defaultContext?: LogContext) {
    this.config = {
      minLevel: LogLevel.INFO,
      enableConsole: true,
      enableStructured: true,
      includeStackTrace: true,
      maxContextSize: 10000, // 10KB
      serviceName: 'websocket-service',
      environment: 'production',
      ...config
    };
    this.defaultContext = defaultContext || {};
  }

  /**
   * 創建子 Logger，繼承父 Logger 的上下文
   */
  child(context: LogContext): Logger {
    return new Logger(this.config, { ...this.defaultContext, ...context });
  }

  /**
   * DEBUG 級別日誌
   */
  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context, undefined, metadata);
  }

  /**
   * INFO 級別日誌
   */
  info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context, undefined, metadata);
  }

  /**
   * WARN 級別日誌
   */
  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context, undefined, metadata);
  }

  /**
   * ERROR 級別日誌
   */
  error(message: string, error?: Error | unknown, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error, metadata);
  }

  /**
   * CRITICAL 級別日誌 - 嚴重錯誤，需要立即關注
   */
  critical(message: string, error?: Error | unknown, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, message, context, error, metadata);
  }

  /**
   * 通用日誌方法 - 允許指定日誌級別
   */
  log(level: LogLevel, message: string, context?: LogContext, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    // 檢查日誌級別
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
      return;
    }

    // 合併上下文
    const mergedContext = this.mergeContext(context);

    // 構建結構化日誌
    const logEntry = this.buildLogEntry(level, message, mergedContext, error, metadata);

    // 輸出日誌
    if (this.config.enableStructured) {
      this.outputStructured(logEntry);
    }
    if (this.config.enableConsole) {
      this.outputConsole(logEntry);
    }

    // 關鍵錯誤需要額外處理
    if (level === LogLevel.CRITICAL) {
      this.handleCriticalError(logEntry);
    }
  }

  /**
   * 性能追蹤日誌
   */
  performance(operation: string, duration: number, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      duration,
      operation
    }, {
      ...metadata,
      performanceLog: true
    });
  }

  /**
   * 合併上下文信息
   */
  private mergeContext(context?: LogContext): LogContext {
    const merged = { ...this.defaultContext, ...context };

    // 限制上下文大小，防止內存洩漏
    const serialized = JSON.stringify(merged);
    if (serialized.length > this.config.maxContextSize) {
      console.warn(`[Logger] Context size exceeds limit (${serialized.length} > ${this.config.maxContextSize}), truncating...`);
      return {
        userId: merged.userId,
        conversationId: merged.conversationId,
        eventId: merged.eventId,
        _truncated: true
      };
    }

    return merged;
  }

  /**
   * 構建日誌條目
   */
  private buildLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext,
    error?: Error | unknown,
    metadata?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        service: this.config.serviceName,
        environment: this.config.environment
      }
    };

    // 添加錯誤信息
    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: this.config.includeStackTrace ? error.stack : undefined,
          code: (error as any).code
        };
      } else {
        entry.error = {
          name: 'UnknownError',
          message: String(error)
        };
      }
    }

    // 添加元數據
    if (metadata) {
      entry.metadata = metadata;
    }

    return entry;
  }

  /**
   * 輸出結構化 JSON 日誌
   */
  private outputStructured(entry: LogEntry): void {
    // Cloudflare Workers 會自動捕獲 console.log 並轉為結構化日誌
    console.log(JSON.stringify(entry));
  }

  /**
   * 輸出人類可讀的控制台日誌
   */
  private outputConsole(entry: LogEntry): void {
    const emoji = this.getLevelEmoji(entry.level);
    const color = this.getLevelColor(entry.level);

    // 構建簡潔的控制台消息
    const contextStr = this.formatContextForConsole(entry.context);
    const consoleMessage = `${emoji} [${entry.level}] ${entry.message}${contextStr}`;

    // 根據級別選擇 console 方法
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage, entry.error || '');
        break;
      case LogLevel.INFO:
        console.info(consoleMessage);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage, entry.error || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(consoleMessage, entry.error || '');
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  /**
   * 格式化上下文為控制台字符串
   */
  private formatContextForConsole(context: LogContext): string {
    const parts: string[] = [];

    if (context.userId) parts.push(`user=${context.userId}`);
    if (context.conversationId) parts.push(`conv=${context.conversationId}`);
    if (context.eventId) parts.push(`event=${context.eventId}`);
    if (context.duration) parts.push(`duration=${context.duration}ms`);
    if (context.durableObjectType) parts.push(`DO=${context.durableObjectType}`);

    return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
  }

  /**
   * 獲取日誌級別 emoji
   */
  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return '📘';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      case LogLevel.CRITICAL: return '🚨';
      default: return '📝';
    }
  }

  /**
   * 獲取日誌級別顏色（用於終端輸出）
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m';  // Green
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.CRITICAL: return '\x1b[35m'; // Magenta
      default: return '\x1b[0m';
    }
  }

  /**
   * 處理關鍵錯誤 - 可以集成告警系統
   */
  private handleCriticalError(entry: LogEntry): void {
    // Phase 2: Integrate alerting (PagerDuty/Slack) for critical errors
    console.error('🚨🚨🚨 CRITICAL ERROR DETECTED 🚨🚨🚨');
    console.error(JSON.stringify(entry, null, 2));

    // 可以在這裡添加：
    // - 發送 Slack 通知
    // - 觸發 PagerDuty 告警
    // - 發送郵件
    // - 寫入錯誤追蹤系統（Sentry, Rollbar等）
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 獲取當前配置
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * 創建默認 Logger 實例
 */
export function createLogger(context?: LogContext, config?: Partial<LoggerConfig>): Logger {
  return new Logger(config, context);
}

/**
 * 全局 Logger 單例（可選）
 */
let globalLogger: Logger | null = null;

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger({
      minLevel: LogLevel.INFO,
      enableConsole: true,
      enableStructured: true,
      serviceName: 'websocket-service',
      environment: 'production'
    });
  }
  return globalLogger;
}

/**
 * 性能計時器輔助工具
 */
export class PerformanceTimer {
  private startTime: number;
  private logger: Logger;
  private operation: string;
  private context?: LogContext;

  constructor(logger: Logger, operation: string, context?: LogContext) {
    this.logger = logger;
    this.operation = operation;
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * 結束計時並記錄
   */
  end(additionalContext?: LogContext): number {
    const duration = Date.now() - this.startTime;
    this.logger.performance(this.operation, duration, {
      ...this.context,
      ...additionalContext
    });
    return duration;
  }

  /**
   * 記錄中間檢查點
   */
  checkpoint(label: string): number {
    const duration = Date.now() - this.startTime;
    this.logger.debug(`${this.operation} - ${label}`, {
      ...this.context,
      checkpoint: label,
      duration
    });
    return duration;
  }
}

/**
 * 輔助函數：安全序列化錯誤對象
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  return {
    error: String(error)
  };
}

/**
 * 輔助函數：從 Request 提取日誌上下文
 */
export function extractRequestContext(request: Request): LogContext {
  const url = new URL(request.url);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  return {
    requestId,
    endpoint: url.pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent') || undefined
  };
}
