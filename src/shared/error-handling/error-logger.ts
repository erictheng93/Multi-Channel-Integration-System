// 錯誤日誌記錄器
// Error Logger

import { BaseModuleError, ErrorSeverity } from '@shared/error-handling/module-errors';

/**
 * 錯誤日誌條目
 */
export interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  module: string;
  operation: string;
  error: {
    name: string;
    message: string;
    code: string;
    stack?: string;
    details?: Record<string, any>;
  };
  context: {
    severity: ErrorSeverity;
    requestId?: string;
    userId?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  };
  recovery?: {
    attempted: boolean;
    successful: boolean;
    method?: string;
    result?: any;
  };
}

/**
 * 錯誤恢復結果
 */
export interface RecoveryResult {
  recovered: boolean;
  method?: string;
  result?: any;
  message?: string;
}

/**
 * 錯誤日誌記錄器
 */
export class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs: number = 1000;

  constructor(maxLogs?: number) {
    if (maxLogs) {
      this.maxLogs = maxLogs;
    }
  }

  /**
   * 記錄錯誤
   */
  async logError(
    error: BaseModuleError,
    context: {
      module: string;
      operation: string;
      severity: ErrorSeverity;
      requestId?: string;
      userId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: this.getLogLevel(context.severity),
      module: context.module,
      operation: context.operation,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        ...(error.stack && { stack: error.stack }),
        ...(error.details && { details: error.details })
      },
      context: {
        severity: context.severity,
        ...(context.requestId && { requestId: context.requestId }),
        ...(context.userId && { userId: context.userId }),
        ...(context.correlationId && { correlationId: context.correlationId }),
        ...(context.metadata && { metadata: context.metadata })
      }
    };

    this.addLog(entry);
    await this.writeToConsole(entry);

    // 在生產環境中，這裡可以添加外部日誌系統的整合
    if (process.env.NODE_ENV === 'production') {
      await this.sendToExternalLogger(entry);
    }
  }

  /**
   * 記錄錯誤恢復
   */
  async logRecovery(
    error: BaseModuleError,
    recovery: RecoveryResult
  ): Promise<void> {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      module: error.module,
      operation: 'error_recovery',
      error: {
        name: error.name,
        message: error.message,
        code: error.code
      },
      context: {
        severity: ErrorSeverity.LOW
      },
      recovery: {
        attempted: true,
        successful: recovery.recovered,
        ...(recovery.method && { method: recovery.method }),
        ...(recovery.result && { result: recovery.result })
      }
    };

    this.addLog(entry);
    await this.writeToConsole(entry);
  }

  /**
   * 獲取錯誤日誌
   */
  getLogs(filter?: {
    module?: string;
    severity?: ErrorSeverity;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): ErrorLogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.module) {
        filteredLogs = filteredLogs.filter(log => log.module === filter.module);
      }

      if (filter.severity) {
        filteredLogs = filteredLogs.filter(log => log.context.severity === filter.severity);
      }

      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime!);
      }

      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * 清除日誌
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * 獲取錯誤統計
   */
  getStats(): {
    totalErrors: number;
    errorsByModule: Record<string, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: number; // 最近1小時
    recoveryRate: number; // 恢復成功率
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentLogs = this.logs.filter(log => log.timestamp >= oneHourAgo);

    const errorsByModule: Record<string, number> = {};
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };

    let totalRecoveryAttempts = 0;
    let successfulRecoveries = 0;

    for (const log of this.logs) {
      // 按模組統計
      errorsByModule[log.module] = (errorsByModule[log.module] || 0) + 1;

      // 按嚴重程度統計
      errorsBySeverity[log.context.severity]++;

      // 恢復統計
      if (log.recovery?.attempted) {
        totalRecoveryAttempts++;
        if (log.recovery.successful) {
          successfulRecoveries++;
        }
      }
    }

    return {
      totalErrors: this.logs.length,
      errorsByModule,
      errorsBySeverity,
      recentErrors: recentLogs.length,
      recoveryRate: totalRecoveryAttempts > 0 ? successfulRecoveries / totalRecoveryAttempts : 0
    };
  }

  /**
   * 添加日誌條目
   */
  private addLog(entry: ErrorLogEntry): void {
    this.logs.push(entry);

    // 保持日誌數量在限制內
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * 輸出到控制台
   */
  private async writeToConsole(entry: ErrorLogEntry): Promise<void> {
    const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.operation}: ${entry.error.message}`;

    switch (entry.level) {
      case 'error':
        console.error(logMessage, entry.error.details);
        break;
      case 'warn':
        console.warn(logMessage, entry.error.details);
        break;
      case 'info':
        console.info(logMessage, entry.error.details);
        break;
    }

    // 在開發環境下顯示堆棧資訊
    if (process.env.NODE_ENV !== 'production' && entry.error.stack) {
      console.error('Stack trace:', entry.error.stack);
    }
  }

  /**
   * 發送到外部日誌系統
   */
  private async sendToExternalLogger(entry: ErrorLogEntry): Promise<void> {
    try {
      // 這裡可以整合外部日誌服務，如 Cloudflare Analytics, Sentry 等
      // 暫時只在關鍵錯誤時進行通知
      if (entry.context.severity === ErrorSeverity.CRITICAL) {
        // 可以發送到監控系統
        console.error('CRITICAL ERROR DETECTED:', entry);
      }
    } catch (error) {
      // 避免日誌記錄本身的錯誤影響主要流程
      console.error('Failed to send error to external logger:', error);
    }
  }

  /**
   * 根據錯誤嚴重程度獲取日誌等級
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
      default:
        return 'info';
    }
  }
}