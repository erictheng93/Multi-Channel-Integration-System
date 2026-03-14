// 統一錯誤處理系統 - 改善使用者體驗
import type { Context } from 'hono';
import { nowISO, nowMs } from '@/utils/timestamp'

// 錯誤類型定義
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_EXCEEDED',
  SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR'
}

// 錯誤級別
export enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 標準化錯誤接口
export interface StandardizedError {
  type: ErrorType;
  level: ErrorLevel;
  code: string;
  message: string;
  userMessage: string; // 用戶友好的訊息
  details?: any;
  context?: {
    userId?: string;
    requestId?: string;
    ip?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
  };
  timestamp: string;
  stack?: string;
  retryable: boolean;
  suggestions?: string[]; // 給用戶的建議
}

// 錯誤回應格式
interface ErrorResponse {
  success: false;
  error: {
    type: string;
    code: string;
    message: string;
    details?: any;
    suggestions?: string[];
    requestId?: string;
  };
  timestamp: string;
  retryAfter?: number; // 對於速率限制錯誤
}

// 錯誤統計
interface ErrorStats {
  total: number;
  byType: Record<string, number>;
  byLevel: Record<string, number>;
  recentErrors: StandardizedError[];
  errorRate: number;
}

export class ErrorHandler {
  private errorHistory: StandardizedError[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * 處理並標準化錯誤
   */
  handleError(
    c: Context<any, any, any>,
    error: any,
    errorType?: ErrorType,
    userMessage?: string
  ): Response {
    const standardizedError = this.standardizeError(error, errorType, userMessage);

    // 添加請求上下文
    standardizedError.context = {
      requestId: this.generateRequestId(),
      ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown',
      endpoint: c.req.url,
      method: c.req.method,
      userId: c.get('user')?.id?.toString()
    };

    // 記錄錯誤
    this.logError(standardizedError);

    // 添加到歷史記錄
    this.addToHistory(standardizedError);

    // 創建回應
    return this.createErrorResponse(c, standardizedError);
  }

  /**
   * 標準化錯誤
   */
  private standardizeError(
    error: any,
    errorType?: ErrorType,
    userMessage?: string
  ): StandardizedError {
    // 如果已經是標準化錯誤，直接返回
    if (error && error.type && error.level) {
      return error as StandardizedError;
    }

    let standardError: StandardizedError;

    if (error instanceof Error) {
      standardError = this.categorizeError(error, errorType, userMessage);
    } else if (typeof error === 'string') {
      standardError = {
        type: errorType || ErrorType.SERVER_ERROR,
        level: ErrorLevel.ERROR,
        code: 'GENERIC_ERROR',
        message: error,
        userMessage: userMessage || '操作失敗，請稍後再試',
        timestamp: nowISO(),
        retryable: true,
        suggestions: ['請稍後再試', '如果問題持續存在，請聯繫技術支援']
      };
    } else {
      standardError = {
        type: ErrorType.SERVER_ERROR,
        level: ErrorLevel.ERROR,
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred',
        userMessage: userMessage || '發生未知錯誤，請聯繫技術支援',
        timestamp: nowISO(),
        retryable: false,
        suggestions: ['請聯繫技術支援團隊']
      };
    }

    return standardError;
  }

  /**
   * 根據錯誤類型進行分類
   */
  private categorizeError(
    error: Error,
    suggestedType?: ErrorType,
    userMessage?: string
  ): StandardizedError {
    let type = suggestedType || ErrorType.SERVER_ERROR;
    let level = ErrorLevel.ERROR;
    let code = 'GENERIC_ERROR';
    let message = error.message;
    let userMsg = userMessage;
    let retryable = true;
    let suggestions: string[] = [];

    // 根據錯誤訊息和類型進行智能分類
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
      type = ErrorType.VALIDATION;
      level = ErrorLevel.WARNING;
      code = 'VALIDATION_FAILED';
      userMsg = userMsg || '輸入資料有誤，請檢查並重新提交';
      retryable = false;
      suggestions = ['請檢查輸入資料的格式和內容', '確保所有必填欄位已填寫'];
    } else if (errorMsg.includes('unauthorized') || errorMsg.includes('authentication')) {
      type = ErrorType.AUTHENTICATION;
      level = ErrorLevel.WARNING;
      code = 'AUTH_REQUIRED';
      userMsg = userMsg || '請先登入系統';
      retryable = false;
      suggestions = ['請重新登入', '檢查登入憑證是否有效'];
    } else if (errorMsg.includes('forbidden') || errorMsg.includes('permission')) {
      type = ErrorType.AUTHORIZATION;
      level = ErrorLevel.WARNING;
      code = 'ACCESS_DENIED';
      userMsg = userMsg || '您沒有執行此操作的權限';
      retryable = false;
      suggestions = ['請聯繫管理員申請相關權限'];
    } else if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
      type = ErrorType.NOT_FOUND;
      level = ErrorLevel.WARNING;
      code = 'RESOURCE_NOT_FOUND';
      userMsg = userMsg || '請求的資源不存在';
      retryable = false;
      suggestions = ['請檢查資源ID或路徑是否正確'];
    } else if (errorMsg.includes('conflict') || errorMsg.includes('already exists')) {
      type = ErrorType.CONFLICT;
      level = ErrorLevel.WARNING;
      code = 'RESOURCE_CONFLICT';
      userMsg = userMsg || '資源衝突，該項目可能已存在';
      retryable = false;
      suggestions = ['請檢查是否已存在相同的項目', '嘗試使用不同的名稱或標識'];
    } else if (errorMsg.includes('database') || errorMsg.includes('connection')) {
      type = ErrorType.DATABASE_ERROR;
      level = ErrorLevel.ERROR;
      code = 'DATABASE_ERROR';
      userMsg = userMsg || '資料庫連線異常，請稍後再試';
      retryable = true;
      suggestions = ['請稍後再試', '如果問題持續，請聯繫技術支援'];
    } else if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
      type = ErrorType.EXTERNAL_API_ERROR;
      level = ErrorLevel.WARNING;
      code = 'NETWORK_ERROR';
      userMsg = userMsg || '網路連線異常，請檢查網路狀態';
      retryable = true;
      suggestions = ['請檢查網路連線', '稍後再試'];
    } else if (errorMsg.includes('file') || errorMsg.includes('upload')) {
      type = ErrorType.FILE_UPLOAD_ERROR;
      level = ErrorLevel.WARNING;
      code = 'FILE_UPLOAD_ERROR';
      userMsg = userMsg || '檔案上傳失敗';
      retryable = true;
      suggestions = ['請檢查檔案大小和格式', '確保網路連線穩定'];
    }

    return {
      type,
      level,
      code,
      message,
      userMessage: userMsg || '操作失敗，請稍後再試',
      timestamp: nowISO(),
      stack: error.stack,
      retryable,
      suggestions
    };
  }

  /**
   * 創建錯誤響應
   */
  private createErrorResponse(
    c: Context<any>,
    error: StandardizedError
  ): Response {
    const httpStatus = this.getHttpStatus(error.type);

    const response: ErrorResponse = {
      success: false,
      error: {
        type: error.type,
        code: error.code,
        message: error.userMessage, // 使用用戶友好的訊息
        details: error.details,
        suggestions: error.suggestions,
        requestId: error.context?.requestId
      },
      timestamp: error.timestamp
    };

    // 對於速率限制錯誤，添加 Retry-After 頭
    if (error.type === ErrorType.RATE_LIMIT) {
      response.retryAfter = 60; // 60秒後重試
      return c.json(response, httpStatus as any, {
        'Retry-After': '60'
      });
    }

    return c.json(response, httpStatus as any);
  }

  /**
   * 根據錯誤類型獲取HTTP狀態碼
   */
  private getHttpStatus(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.VALIDATION:
        return 400;
      case ErrorType.AUTHENTICATION:
        return 401;
      case ErrorType.AUTHORIZATION:
        return 403;
      case ErrorType.NOT_FOUND:
        return 404;
      case ErrorType.CONFLICT:
        return 409;
      case ErrorType.RATE_LIMIT:
        return 429;
      case ErrorType.SERVICE_UNAVAILABLE:
        return 503;
      case ErrorType.DATABASE_ERROR:
      case ErrorType.EXTERNAL_API_ERROR:
      case ErrorType.FILE_UPLOAD_ERROR:
      case ErrorType.BUSINESS_LOGIC_ERROR:
      case ErrorType.SERVER_ERROR:
      default:
        return 500;
    }
  }

  /**
   * 記錄錯誤
   */
  private logError(error: StandardizedError): void {
    const logMessage = `[${error.type}] ${error.code}: ${error.message}`;

    // 根據錯誤級別使用不同的日誌方法
    switch (error.level) {
      case ErrorLevel.INFO:
        console.info(` ${logMessage}`, {
          context: error.context,
          details: error.details
        });
        break;
      case ErrorLevel.WARNING:
        console.warn(` ${logMessage}`, {
          context: error.context,
          details: error.details
        });
        break;
      case ErrorLevel.ERROR:
        console.error(` ${logMessage}`, {
          context: error.context,
          details: error.details,
          stack: error.stack
        });
        break;
      case ErrorLevel.CRITICAL:
        console.error(` CRITICAL: ${logMessage}`, {
          context: error.context,
          details: error.details,
          stack: error.stack
        });
        break;
    }
  }

  /**
   * 添加到歷史記錄
   */
  private addToHistory(error: StandardizedError): void {
    this.errorHistory.push(error);

    // 維護歷史記錄大小
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize / 2);
    }
  }

  /**
   * 生成請求ID
   */
  private generateRequestId(): string {
    return `req_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 獲取錯誤統計
   */
  getErrorStats(): ErrorStats {
    const now = nowMs();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentErrors = this.errorHistory.filter(error =>
      new Date(error.timestamp).getTime() > oneHourAgo
    );

    const byType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};

    for (const error of recentErrors) {
      byType[error.type] = (byType[error.type] || 0) + 1;
      byLevel[error.level] = (byLevel[error.level] || 0) + 1;
    }

    return {
      total: this.errorHistory.length,
      byType,
      byLevel,
      recentErrors: recentErrors.slice(-10), // 最近10個錯誤
      errorRate: recentErrors.length // 每小時錯誤率
    };
  }

  /**
   * 清理舊的錯誤記錄
   */
  cleanup(): void {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.errorHistory = this.errorHistory.filter(error =>
      new Date(error.timestamp).getTime() > oneDayAgo
    );
  }

  /**
   * 創建業務邏輯錯誤
   */
  static createBusinessError(
    message: string,
    userMessage?: string,
    details?: any
  ): StandardizedError {
    return {
      type: ErrorType.BUSINESS_LOGIC_ERROR,
      level: ErrorLevel.WARNING,
      code: 'BUSINESS_RULE_VIOLATION',
      message,
      userMessage: userMessage || message,
      details,
      timestamp: nowISO(),
      retryable: false,
      suggestions: ['請檢查操作是否符合業務規則', '如有疑問請聯繫管理員']
    };
  }

  /**
   * 創建驗證錯誤
   */
  static createValidationError(
    field: string,
    message: string,
    value?: any
  ): StandardizedError {
    return {
      type: ErrorType.VALIDATION,
      level: ErrorLevel.WARNING,
      code: 'VALIDATION_ERROR',
      message: `Validation failed for field '${field}': ${message}`,
      userMessage: `${field} 欄位驗證失敗：${message}`,
      details: { field, value },
      timestamp: nowISO(),
      retryable: false,
      suggestions: ['請檢查輸入格式', '確保所有必填欄位都已正確填寫']
    };
  }
}

// 全域錯誤處理器實例
export const globalErrorHandler = new ErrorHandler();

// 中間件：全域錯誤捕獲
export function errorHandlingMiddleware() {
  return async (c: Context<any, any, any>, next: () => Promise<void>) => {
    try {
      return await next();
    } catch (error) {
      console.error('Unhandled error caught by middleware:', error);
      return globalErrorHandler.handleError(c, error);
    }
  };
}

// 便利方法：包裝處理器以自動捕獲錯誤
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const context = args[0] as Context<any, any, any>;
      return globalErrorHandler.handleError(context, error);
    }
  };
}