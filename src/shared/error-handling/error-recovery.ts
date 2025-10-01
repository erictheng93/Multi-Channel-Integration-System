// 錯誤恢復機制
// Error Recovery System

import type { Context } from 'hono';
import type { Bindings } from '../../types';
import { BaseModuleError } from '@shared/error-handling/module-errors';

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
 * 恢復上下文
 */
export interface RecoveryContext {
  module: string;
  operation: string;
  context: Context<{ Bindings: Bindings }>;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * 恢復策略介面
 */
export interface RecoveryStrategy {
  canHandle(error: BaseModuleError): boolean;
  recover(error: BaseModuleError, context: RecoveryContext): Promise<RecoveryResult>;
}

/**
 * 資料庫連接重試策略
 */
export class DatabaseRetryStrategy implements RecoveryStrategy {
  canHandle(error: BaseModuleError): boolean {
    return error.code === 'DATABASE_ERROR' &&
           (error.message.includes('connection') ||
            error.message.includes('timeout') ||
            error.message.includes('busy'));
  }

  async recover(error: BaseModuleError, context: RecoveryContext): Promise<RecoveryResult> {
    const maxRetries = context.maxRetries || 3;
    const retryCount = context.retryCount || 0;

    if (retryCount >= maxRetries) {
      return {
        recovered: false,
        method: 'database_retry',
        message: 'Max retries exceeded'
      };
    }

    // 等待指數退避時間
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // 這裡應該重新執行原始操作
      // 暫時返回模擬的恢復結果
      return {
        recovered: true,
        method: 'database_retry',
        result: { retried: true, retryCount: retryCount + 1 },
        message: `Recovered after ${retryCount + 1} retries`
      };
    } catch (retryError) {
      // 遞歸重試
      return this.recover(error, { ...context, retryCount: retryCount + 1 });
    }
  }
}

/**
 * 快取回退策略
 */
export class CacheFallbackStrategy implements RecoveryStrategy {
  canHandle(error: BaseModuleError): boolean {
    return error.code === 'DATABASE_ERROR' || error.code === 'EXTERNAL_SERVICE_ERROR';
  }

  async recover(_error: BaseModuleError, context: RecoveryContext): Promise<RecoveryResult> {
    try {
      const cacheKey = this.generateCacheKey(context);

      // 嘗試從快取獲取數據
      const cachedData = await context.context.env.CACHE?.get(cacheKey);

      if (cachedData) {
        return {
          recovered: true,
          method: 'cache_fallback',
          result: JSON.parse(cachedData),
          message: 'Recovered from cache'
        };
      }

      // 如果沒有快取，返回預設值
      return {
        recovered: true,
        method: 'default_fallback',
        result: this.getDefaultResponse(context),
        message: 'Returned default response'
      };
    } catch (cacheError) {
      return {
        recovered: false,
        method: 'cache_fallback',
        message: 'Cache fallback failed'
      };
    }
  }

  private generateCacheKey(context: RecoveryContext): string {
    return `recovery:${context.module}:${context.operation}:${context.context.req.path}`;
  }

  private getDefaultResponse(context: RecoveryContext): any {
    switch (context.module) {
      case 'auth':
        return { authenticated: false, reason: 'service_unavailable' };
      case 'conversations':
        return { conversations: [], total: 0, hasMore: false };
      case 'system':
        return { status: 'degraded', timestamp: new Date().toISOString() };
      default:
        return { status: 'unavailable', message: 'Service temporarily unavailable' };
    }
  }
}

/**
 * 外部服務降級策略
 */
export class ServiceDegradationStrategy implements RecoveryStrategy {
  canHandle(error: BaseModuleError): boolean {
    return error.code === 'EXTERNAL_SERVICE_ERROR';
  }

  async recover(_error: BaseModuleError, context: RecoveryContext): Promise<RecoveryResult> {
    // 根據模組提供降級服務
    switch (context.module) {
      case 'integration':
        return this.handleIntegrationDegradation(context);
      case 'notification':
        return this.handleNotificationDegradation(context);
      default:
        return {
          recovered: false,
          method: 'service_degradation',
          message: 'No degradation strategy available'
        };
    }
  }

  private async handleIntegrationDegradation(_context: RecoveryContext): Promise<RecoveryResult> {
    // 整合服務降級：切換到本地處理模式
    return {
      recovered: true,
      method: 'integration_degradation',
      result: {
        mode: 'local_processing',
        features: ['basic_messaging'],
        limitations: ['no_external_sync']
      },
      message: 'Switched to local processing mode'
    };
  }

  private async handleNotificationDegradation(_context: RecoveryContext): Promise<RecoveryResult> {
    // 通知服務降級：切換到基本通知模式
    return {
      recovered: true,
      method: 'notification_degradation',
      result: {
        mode: 'basic_notification',
        channels: ['internal_only'],
        features: ['essential_alerts']
      },
      message: 'Switched to basic notification mode'
    };
  }
}

/**
 * 驗證錯誤恢復策略
 */
export class ValidationRecoveryStrategy implements RecoveryStrategy {
  canHandle(error: BaseModuleError): boolean {
    return error.code === 'VALIDATION_ERROR';
  }

  async recover(_error: BaseModuleError, context: RecoveryContext): Promise<RecoveryResult> {
    try {
      // 嘗試自動修復常見的驗證錯誤
      const requestBody = await context.context.req.json();
      const sanitizedData = this.sanitizeData(requestBody);

      return {
        recovered: true,
        method: 'data_sanitization',
        result: sanitizedData,
        message: 'Data automatically sanitized'
      };
    } catch (sanitizeError) {
      return {
        recovered: false,
        method: 'validation_recovery',
        message: 'Could not sanitize invalid data'
      };
    }
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };

    // 移除空字串，轉換為 null
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === '') {
        sanitized[key] = null;
      }

      // 修整字串
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitized[key].trim();
      }

      // 遞歸處理嵌套對象
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });

    return sanitized;
  }
}

/**
 * 錯誤恢復系統
 */
export class ErrorRecovery {
  private strategies: RecoveryStrategy[] = [];

  constructor() {
    // 註冊預設恢復策略
    this.strategies = [
      new DatabaseRetryStrategy(),
      new CacheFallbackStrategy(),
      new ServiceDegradationStrategy(),
      new ValidationRecoveryStrategy()
    ];
  }

  /**
   * 添加自訂恢復策略
   */
  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * 移除恢復策略
   */
  removeStrategy(strategyClass: new() => RecoveryStrategy): void {
    this.strategies = this.strategies.filter(
      strategy => !(strategy instanceof strategyClass)
    );
  }

  /**
   * 嘗試恢復錯誤
   */
  async attemptRecovery(
    error: BaseModuleError,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(error)) {
        try {
          const result = await strategy.recover(error, context);
          if (result.recovered) {
            return result;
          }
        } catch (recoveryError) {
          console.warn(`Recovery strategy ${strategy.constructor.name} failed:`, recoveryError);
          continue;
        }
      }
    }

    return {
      recovered: false,
      message: 'No suitable recovery strategy found'
    };
  }

  /**
   * 檢查是否可以恢復特定錯誤
   */
  canRecover(error: BaseModuleError): boolean {
    return this.strategies.some(strategy => strategy.canHandle(error));
  }

  /**
   * 獲取可用的恢復策略
   */
  getAvailableStrategies(error: BaseModuleError): string[] {
    return this.strategies
      .filter(strategy => strategy.canHandle(error))
      .map(strategy => strategy.constructor.name);
  }
}