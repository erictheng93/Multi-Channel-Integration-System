/**
 * File Management Error Handler
 * 統一的錯誤處理和日誌系統
 */

import type { ErrorCode } from '@modules/file-management/constants/error-codes';
import { ERROR_MESSAGES } from '@modules/file-management/constants/error-codes';
import { nowISO } from '@/utils/timestamp'

/**
 * 錯誤嚴重性等級
 */
export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * 錯誤上下文資訊
 */
export interface ErrorContext {
  /** 操作類型 */
  operation: string;
  /** 檔案 ID */
  fileId?: string;
  /** 檔案名稱 */
  filename?: string;
  /** 使用者 ID */
  userId?: string;
  /** 平台 */
  platform?: string;
  /** 額外的元數據 */
  metadata?: Record<string, unknown>;
  /** 嘗試次數 */
  attempt?: number;
  /** 堆疊追蹤 */
  stack?: string;
}

/**
 * 錯誤詳情介面
 */
export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: string;
  recoverable: boolean;
  retryable: boolean;
}

/**
 * 自定義檔案管理錯誤類別
 */
export class FileManagementError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly timestamp: string;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    context: ErrorContext,
    options: {
      severity?: ErrorSeverity;
      recoverable?: boolean;
      retryable?: boolean;
      originalError?: Error;
      customMessage?: string;
    } = {}
  ) {
    const message = options.customMessage || ERROR_MESSAGES[code] || code;
    super(message);

    this.name = 'FileManagementError';
    this.code = code;
    this.context = {
      ...context,
      stack: options.originalError?.stack || new Error().stack
    };
    this.severity = options.severity || this.determineSeverity(code);
    this.timestamp = nowISO();
    this.recoverable = options.recoverable ?? this.isRecoverable(code);
    this.retryable = options.retryable ?? this.isRetryable(code);
    this.originalError = options.originalError;

    // 維持正確的 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileManagementError);
    }
  }

  /**
   * 根據錯誤代碼判斷嚴重性
   */
  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const criticalErrors = [
      'STORAGE_UNAVAILABLE',
      'DATABASE_ERROR',
      'TRANSACTION_FAILED',
      'VIRUS_DETECTED',
      'MALICIOUS_CONTENT',
      'DATA_CORRUPTION'
    ];

    const warningErrors = [
      'FILE_TOO_LARGE',
      'FILE_TOO_SMALL',
      'INVALID_FILE_TYPE',
      'QUOTA_EXCEEDED',
      'DUPLICATE_FILE'
    ];

    if (criticalErrors.includes(code)) {
      return 'critical';
    } else if (warningErrors.includes(code)) {
      return 'warning';
    } else {
      return 'error';
    }
  }

  /**
   * 判斷錯誤是否可恢復
   */
  private isRecoverable(code: ErrorCode): boolean {
    const unrecoverableErrors = [
      'FILE_DELETED',
      'RECORD_NOT_FOUND',
      'CORRUPTED_FILE',
      'VIRUS_DETECTED',
      'MALICIOUS_CONTENT',
      'PROHIBITED_FILE_TYPE'
    ];

    return !unrecoverableErrors.includes(code);
  }

  /**
   * 判斷錯誤是否可重試
   */
  private isRetryable(code: ErrorCode): boolean {
    const retryableErrors = [
      'UPLOAD_TIMEOUT',
      'UPLOAD_INTERRUPTED',
      'NETWORK_ERROR',
      'DOWNLOAD_TIMEOUT',
      'STORAGE_UNAVAILABLE',
      'CONNECTION_ERROR',
      'QUERY_TIMEOUT',
      'PROCESSING_TIMEOUT'
    ];

    return retryableErrors.includes(code);
  }

  /**
   * 轉換為詳細錯誤資訊
   */
  toDetails(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      retryable: this.retryable
    };
  }

  /**
   * 轉換為 JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

/**
 * 錯誤處理器類別
 */
export class ErrorHandler {
  /**
   * 包裝錯誤為 FileManagementError
   */
  static wrap(
    error: unknown,
    code: ErrorCode,
    context: ErrorContext
  ): FileManagementError {
    if (error instanceof FileManagementError) {
      return error;
    }

    const originalError = error instanceof Error ? error : undefined;
    return new FileManagementError(code, context, {
      originalError,
      customMessage: originalError?.message
    });
  }

  /**
   * 處理錯誤並記錄
   */
  static async handle(
    error: unknown,
    context: ErrorContext
  ): Promise<FileManagementError> {
    const fileError = error instanceof FileManagementError
      ? error
      : this.wrap(error, 'PROCESSING_FAILED', context);

    // 記錄錯誤
    await this.logError(fileError);

    return fileError;
  }

  /**
   * 記錄錯誤
   */
  private static async logError(error: FileManagementError): Promise<void> {
    const logData = {
      level: error.severity,
      error: error.toJSON(),
      timestamp: error.timestamp
    };

    // 根據嚴重性使用不同的日誌級別
    switch (error.severity) {
      case 'critical':
        console.error('[CRITICAL]', logData);
        // TODO: 發送告警通知
        break;
      case 'error':
        console.error('[ERROR]', logData);
        break;
      case 'warning':
        console.warn('[WARNING]', logData);
        break;
      case 'info':
        console.info('[INFO]', logData);
        break;
    }
  }

  /**
   * 執行帶重試的操作
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelay = options.retryDelay ?? 1000;
    const backoffMultiplier = options.backoffMultiplier ?? 2;

    let lastError: FileManagementError | undefined;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        context.attempt = attempt + 1;
        return await operation();
      } catch (error) {
        const fileError = await this.handle(error, context);
        lastError = fileError;

        // 如果不可重試或已達最大重試次數，直接拋出
        if (!fileError.retryable || attempt === maxRetries) {
          throw fileError;
        }

        // 等待後重試
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }

    throw lastError!;
  }

  /**
   * 執行帶恢復的操作
   */
  static async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    recoveryFn?: (error: FileManagementError) => Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const fileError = await this.handle(error, context);

      // 如果可恢復且提供了恢復函數，嘗試恢復
      if (fileError.recoverable && recoveryFn) {
        try {
          return await recoveryFn(fileError);
        } catch (recoveryError) {
          // 恢復失敗，拋出原始錯誤
          throw fileError;
        }
      }

      throw fileError;
    }
  }

  /**
   * 批量操作錯誤處理
   */
  static async handleBatch<T>(
    items: T[],
    operation: (item: T) => Promise<void>,
    context: ErrorContext
  ): Promise<{
    successful: T[];
    failed: Array<{ item: T; error: FileManagementError }>;
  }> {
    const successful: T[] = [];
    const failed: Array<{ item: T; error: FileManagementError }> = [];

    await Promise.all(
      items.map(async (item) => {
        try {
          await operation(item);
          successful.push(item);
        } catch (error) {
          const fileError = await this.handle(error, {
            ...context,
            metadata: { ...context.metadata, item }
          });
          failed.push({ item, error: fileError });
        }
      })
    );

    return { successful, failed };
  }
}

/**
 * 結構化日誌服務
 */
export class FileLogger {
  private context: Partial<ErrorContext>;

  constructor(context: Partial<ErrorContext> = {}) {
    this.context = context;
  }

  /**
   * 記錄訊息
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>
  ): void {
    const logEntry = {
      level,
      message,
      timestamp: nowISO(),
      context: this.context,
      ...data
    };

    // debug 使用 console.log, 其他使用對應的 console[level]
    const logFn = level === 'debug' ? console.log : (console[level] || console.log);
    logFn(`[${level.toUpperCase()}]`, logEntry);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | FileManagementError, data?: Record<string, unknown>): void {
    this.log('error', message, {
      ...data,
      error: error instanceof FileManagementError ? error.toJSON() : {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      }
    });
  }

  /**
   * 建立子日誌器（繼承上下文）
   */
  child(additionalContext: Partial<ErrorContext>): FileLogger {
    return new FileLogger({
      ...this.context,
      ...additionalContext
    });
  }
}