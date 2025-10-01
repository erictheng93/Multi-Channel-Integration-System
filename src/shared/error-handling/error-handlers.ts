// 統一錯誤處理器
// Unified Error Handlers

import type { Context } from 'hono';
import type { Bindings } from '../../types';
import { BaseModuleError, ErrorMapper } from '@shared/error-handling/module-errors';
import { ErrorLogger } from '@shared/error-handling/error-logger';
import { ErrorRecovery } from '@shared/error-handling/error-recovery';

/**
 * 錯誤處理響應格式
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * 錯誤處理配置
 */
export interface ErrorHandlerConfig {
  includeStack: boolean;
  includeDetails: boolean;
  enableLogging: boolean;
  enableRecovery: boolean;
  notifyOnCritical: boolean;
}

/**
 * 預設錯誤處理配置
 */
export const DEFAULT_ERROR_CONFIG: ErrorHandlerConfig = {
  includeStack: false,
  includeDetails: true,
  enableLogging: true,
  enableRecovery: true,
  notifyOnCritical: true
};

/**
 * 統一模組錯誤處理器
 */
export class ModuleErrorHandler {
  private config: ErrorHandlerConfig;
  private logger: ErrorLogger;
  private recovery: ErrorRecovery;

  constructor(
    config: Partial<ErrorHandlerConfig> = {},
    logger?: ErrorLogger,
    recovery?: ErrorRecovery
  ) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
    this.logger = logger || new ErrorLogger();
    this.recovery = recovery || new ErrorRecovery();
  }

  /**
   * 處理模組錯誤並返回統一響應
   */
  async handleError(
    error: unknown,
    context: Context<{ Bindings: Bindings }>,
    module: string,
    operation: string
  ): Promise<Response> {
    // 轉換為模組錯誤
    const user = context.get('user');
    const requestId = context.req.header('x-request-id');
    const userId = user?.id?.toString();
    const moduleError = ErrorMapper.mapToModuleError(error, module, {
      module,
      operation,
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      metadata: {
        path: context.req.path,
        method: context.req.method,
        userAgent: context.req.header('user-agent')
      }
    });

    // 記錄錯誤
    if (this.config.enableLogging) {
      await this.logger.logError(moduleError, {
        module,
        operation,
        severity: ErrorMapper.getSeverity(moduleError)
      });
    }

    // 嘗試錯誤恢復
    if (this.config.enableRecovery) {
      const recoveryResult = await this.recovery.attemptRecovery(moduleError, {
        module,
        operation,
        context: context
      });

      if (recoveryResult.recovered) {
        // 如果恢復成功，記錄並返回成功響應
        await this.logger.logRecovery(moduleError, recoveryResult);
        return context.json({
          success: true,
          data: recoveryResult.result,
          message: 'Operation recovered from error'
        });
      }
    }

    // 生成錯誤響應
    const statusCode = this.getHttpStatusCode(moduleError);
    const errorResponse = this.createErrorResponse(moduleError, context);

    return context.json(errorResponse, statusCode as any);
  }

  /**
   * 創建錯誤響應
   */
  private createErrorResponse(
    error: BaseModuleError,
    context: Context<{ Bindings: Bindings }>
  ): ErrorResponse {
    const requestId = context.req.header('x-request-id');
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
        ...(requestId && { requestId })
      }
    };

    // 添加詳細資訊（根據配置）
    if (this.config.includeDetails && error.details) {
      response.error.details = error.details;
    }

    // 開發環境下包含堆棧資訊
    if (this.config.includeStack && process.env.NODE_ENV !== 'production') {
      (response.error as any).stack = error.stack;
    }

    return response;
  }

  /**
   * 根據錯誤類型返回對應的 HTTP 狀態碼
   */
  private getHttpStatusCode(error: BaseModuleError): number {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return 400;
      case 'AUTHENTICATION_ERROR':
        return 401;
      case 'AUTHORIZATION_ERROR':
        return 403;
      case 'NOT_FOUND_ERROR':
        return 404;
      case 'BUSINESS_LOGIC_ERROR':
        return 422;
      case 'RATE_LIMIT_ERROR':
        return 429;
      case 'EXTERNAL_SERVICE_ERROR':
        return 502;
      case 'DATABASE_ERROR':
      case 'SYSTEM_ERROR':
      case 'CONFIGURATION_ERROR':
      default:
        return 500;
    }
  }
}

/**
 * 創建模組錯誤處理中間件
 */
export function createErrorHandlingMiddleware(
  module: string,
  config?: Partial<ErrorHandlerConfig>
) {
  const handler = new ModuleErrorHandler(config);

  return async (c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) => {
    try {
      return await next();
    } catch (error) {
      const operation = `${c.req.method} ${c.req.path}`;
      return await handler.handleError(error, c, module, operation);
    }
  };
}

/**
 * 處理特定模組的錯誤包裝器
 */
export function withErrorHandling<T extends any[], R>(
  module: string,
  operation: string,
  handler: (...args: T) => Promise<R>,
  config?: Partial<ErrorHandlerConfig>
): (...args: T) => Promise<R> {
  const errorHandler = new ModuleErrorHandler(config);

  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      // 如果有 Context 參數，使用統一錯誤處理
      const contextArg = args.find(arg =>
        arg && typeof arg === 'object' && 'req' in arg && 'json' in arg
      ) as Context<{ Bindings: Bindings }> | undefined;

      if (contextArg) {
        throw await errorHandler.handleError(error, contextArg, module, operation);
      }

      // 否則重新拋出原始錯誤
      throw error;
    }
  };
}

/**
 * 快速錯誤處理函數
 */
export async function handleModuleError(
  error: unknown,
  context: Context<{ Bindings: Bindings }>,
  module: string,
  operation: string = 'unknown'
): Promise<Response> {
  const handler = new ModuleErrorHandler();
  return await handler.handleError(error, context, module, operation);
}