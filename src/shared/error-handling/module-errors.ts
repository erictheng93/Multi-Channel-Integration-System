// 統一模組錯誤定義
// Unified Module Error Definitions

/**
 * 基礎模組錯誤類
 */
export abstract class BaseModuleError extends Error {
  public readonly code: string;
  public readonly module: string;
  public readonly timestamp: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    module: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.module = module;
    this.timestamp = new Date().toISOString();
    if (details) {
      this.details = details;
    }

    // 確保錯誤堆棧正確
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      module: this.module,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack
    };
  }
}

/**
 * 驗證錯誤
 */
export class ValidationError extends BaseModuleError {
  constructor(message: string, module: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', module, details);
  }
}

/**
 * 認證錯誤
 */
export class AuthenticationError extends BaseModuleError {
  constructor(message: string, module: string, details?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', module, details);
  }
}

/**
 * 權限錯誤
 */
export class AuthorizationError extends BaseModuleError {
  constructor(message: string, module: string, details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', module, details);
  }
}

/**
 * 資源未找到錯誤
 */
export class NotFoundError extends BaseModuleError {
  constructor(resource: string, module: string, details?: Record<string, any>) {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', module, details);
  }
}

/**
 * 業務邏輯錯誤
 */
export class BusinessLogicError extends BaseModuleError {
  constructor(message: string, module: string, details?: Record<string, any>) {
    super(message, 'BUSINESS_LOGIC_ERROR', module, details);
  }
}

/**
 * 資料庫操作錯誤
 */
export class DatabaseError extends BaseModuleError {
  constructor(message: string, module: string, details?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', module, details);
  }
}

/**
 * 外部服務錯誤
 */
export class ExternalServiceError extends BaseModuleError {
  constructor(service: string, message: string, module: string, details?: Record<string, any>) {
    super(`External service error (${service}): ${message}`, 'EXTERNAL_SERVICE_ERROR', module, details);
  }
}

/**
 * 配置錯誤
 */
export class ConfigurationError extends BaseModuleError {
  constructor(message: string, module: string, details?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', module, details);
  }
}

/**
 * 限流錯誤
 */
export class RateLimitError extends BaseModuleError {
  constructor(limit: number, module: string, details?: Record<string, any>) {
    super(`Rate limit exceeded: ${limit}`, 'RATE_LIMIT_ERROR', module, details);
  }
}

/**
 * 系統錯誤
 */
export class SystemError extends BaseModuleError {
  constructor(message: string, module: string, details?: Record<string, any>) {
    super(message, 'SYSTEM_ERROR', module, details);
  }
}

/**
 * 錯誤嚴重程度
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 模組錯誤上下文
 */
export interface ModuleErrorContext {
  module: string;
  operation: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

/**
 * 錯誤映射器 - 將標準錯誤轉換為模組錯誤
 */
export class ErrorMapper {
  static mapToModuleError(error: unknown, module: string, context?: ModuleErrorContext): BaseModuleError {
    if (error instanceof BaseModuleError) {
      return error;
    }

    if (error instanceof Error) {
      // 根據錯誤訊息判斷錯誤類型
      const message = error.message.toLowerCase();

      if (message.includes('validation') || message.includes('invalid')) {
        return new ValidationError(error.message, module, context?.metadata);
      }

      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return new AuthenticationError(error.message, module, context?.metadata);
      }

      if (message.includes('not found')) {
        return new NotFoundError(error.message, module, context?.metadata);
      }

      if (message.includes('database') || message.includes('sql')) {
        return new DatabaseError(error.message, module, context?.metadata);
      }

      if (message.includes('rate limit')) {
        return new RateLimitError(100, module, context?.metadata);
      }

      // 預設為系統錯誤
      return new SystemError(error.message, module, context?.metadata);
    }

    // 非 Error 物件，創建通用系統錯誤
    return new SystemError(`Unknown error: ${String(error)}`, module, context?.metadata);
  }

  static getSeverity(error: BaseModuleError): ErrorSeverity {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return ErrorSeverity.LOW;
      case 'AUTHENTICATION_ERROR':
      case 'AUTHORIZATION_ERROR':
        return ErrorSeverity.MEDIUM;
      case 'DATABASE_ERROR':
      case 'EXTERNAL_SERVICE_ERROR':
        return ErrorSeverity.HIGH;
      case 'SYSTEM_ERROR':
      case 'CONFIGURATION_ERROR':
        return ErrorSeverity.CRITICAL;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }
}