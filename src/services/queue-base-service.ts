// 隊列處理基礎服務類
// Queue Base Service - 提供共享的錯誤處理、日誌記錄和重試邏輯
// 專案名稱：Multi-Channel Support MVP - Queue Management System

import type { Bindings } from '../types';
import { nowISO, nowMs } from '@/utils/timestamp'

// 統一的隊列處理結果接口
export interface QueueProcessingResult {
  success: boolean;
  messageId: string;
  processingTime: number;
  error?: string;
  retryCount?: number;
  skipped?: boolean;
  metadata?: Record<string, unknown>;
}

// 錯誤類型枚舉
export enum QueueErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  VALIDATION_ERROR = 'validation_error',
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  SYSTEM_ERROR = 'system_error',
  TEMPORARY_FAILURE = 'temporary_failure',
  PERMANENT_FAILURE = 'permanent_failure'
}

// 重試策略配置
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // 毫秒
  maxDelay: number;  // 毫秒
  backoffMultiplier: number;
  retryableErrors: QueueErrorType[];
}

// 隊列處理統計
export interface QueueProcessingStats {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  retryCount: number;
  averageProcessingTime: number;
  lastProcessedAt: string;
}

export abstract class QueueBaseService {
  protected env: Bindings;
  protected queueName: string;
  protected retryConfig: RetryConfig;
  protected stats: QueueProcessingStats;

  constructor(env: Bindings, queueName: string, retryConfig?: Partial<RetryConfig>) {
    this.env = env;
    this.queueName = queueName;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        QueueErrorType.NETWORK_ERROR,
        QueueErrorType.TIMEOUT,
        QueueErrorType.RATE_LIMIT,
        QueueErrorType.TEMPORARY_FAILURE,
        QueueErrorType.SYSTEM_ERROR
      ],
      ...retryConfig
    };
    this.stats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      retryCount: 0,
      averageProcessingTime: 0,
      lastProcessedAt: nowISO()
    };
  }

  // 抽象方法：子類必須實現具體的處理邏輯
  protected abstract processMessage(messageBody: any): Promise<QueueProcessingResult>;

  // 統一的隊列消息處理入口
  async handleQueueMessage(message: MessageBatch<any>['messages'][0]): Promise<void> {
    const startTime = nowMs();
    let result: QueueProcessingResult;

    try {
      // 記錄開始處理
      this.logInfo(`開始處理消息`, { messageId: message.id, attempts: message.attempts });

      // 調用子類的具體處理邏輯
      result = await this.processMessage(message.body);
      
      // 更新處理時間
      result.processingTime = Date.now() - startTime;

      // 根據結果處理消息確認或重試
      if (result.success) {
        message.ack();
        this.updateStats(true, result.processingTime);
        this.logSuccess(`消息處理成功`, { messageId: result.messageId, processingTime: result.processingTime });
      } else {
        await this.handleProcessingError(message, result);
      }

    } catch (error) {
      // 未預期的錯誤處理
      const processingTime = Date.now() - startTime;
      result = {
        success: false,
        messageId: message.id || 'unknown',
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.logError(`消息處理發生異常`, error, { messageId: message.id });
      await this.handleProcessingError(message, result);
    }
  }

  // 處理錯誤情況：決定重試還是放棄
  private async handleProcessingError(
    message: MessageBatch<any>['messages'][0], 
    result: QueueProcessingResult
  ): Promise<void> {
    const errorType = this.classifyError(result.error || '');
    const shouldRetry = this.shouldRetry(errorType, message.attempts || 0);

    this.updateStats(false, result.processingTime);

    if (shouldRetry) {
      // 計算重試延遲
      const delay = this.calculateRetryDelay(message.attempts || 0);
      
      this.logWarning(`消息處理失敗，將重試`, {
        messageId: result.messageId,
        errorType,
        attempt: message.attempts,
        retryDelay: delay
      });

      // 執行重試
      message.retry({ delaySeconds: Math.floor(delay / 1000) });
      this.stats.retryCount++;
    } else {
      this.logError(`消息處理失敗，已達最大重試次數或不可重試錯誤`, result.error, {
        messageId: result.messageId,
        errorType,
        attempts: message.attempts
      });

      // 確認消息（不再重試）
      message.ack();
    }
  }

  // 錯誤分類
  private classifyError(errorMessage: string): QueueErrorType {
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('network') || lowerError.includes('connection')) {
      return QueueErrorType.NETWORK_ERROR;
    }
    if (lowerError.includes('timeout')) {
      return QueueErrorType.TIMEOUT;
    }
    if (lowerError.includes('rate limit') || lowerError.includes('throttle')) {
      return QueueErrorType.RATE_LIMIT;
    }
    if (lowerError.includes('validation') || lowerError.includes('invalid')) {
      return QueueErrorType.VALIDATION_ERROR;
    }
    if (lowerError.includes('temporary') || lowerError.includes('unavailable')) {
      return QueueErrorType.TEMPORARY_FAILURE;
    }

    // 預設為系統錯誤
    return QueueErrorType.SYSTEM_ERROR;
  }

  // 判斷是否應該重試
  private shouldRetry(errorType: QueueErrorType, currentAttempts: number): boolean {
    return currentAttempts < this.retryConfig.maxRetries && 
           this.retryConfig.retryableErrors.includes(errorType);
  }

  // 計算重試延遲（指數退避）
  private calculateRetryDelay(attempts: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempts);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  // 更新處理統計
  private updateStats(success: boolean, processingTime: number): void {
    this.stats.totalProcessed++;
    this.stats.lastProcessedAt = nowISO();

    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    // 更新平均處理時間
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime) / 
      this.stats.totalProcessed;
  }

  // 統一的日誌記錄方法
  protected logInfo(message: string, metadata?: Record<string, unknown>): void {
    console.log(`ℹ️ [${this.queueName}] ${message}`, metadata || {});
  }

  protected logSuccess(message: string, metadata?: Record<string, unknown>): void {
    console.log(`✅ [${this.queueName}] ${message}`, metadata || {});
  }

  protected logWarning(message: string, metadata?: Record<string, unknown>): void {
    console.warn(`⚠️ [${this.queueName}] ${message}`, metadata || {});
  }

  protected logError(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
    console.error(`❌ [${this.queueName}] ${message}`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      ...metadata
    });
  }

  // 獲取處理統計
  public getProcessingStats(): QueueProcessingStats {
    return { ...this.stats };
  }

  // 重置統計
  public resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      retryCount: 0,
      averageProcessingTime: 0,
      lastProcessedAt: nowISO()
    };
  }

  // 性能監控方法
  protected async measurePerformance<T>(
    operation: () => Promise<T>, 
    operationName: string
  ): Promise<T> {
    const startTime = nowMs();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.logInfo(`操作完成: ${operationName}`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logError(`操作失敗: ${operationName}`, error, { duration: `${duration}ms` });
      throw error;
    }
  }

  // 批次處理支持
  protected async processBatch<T>(
    items: T[], 
    processor: (item: T) => Promise<void>,
    batchSize: number = 5
  ): Promise<void> {
    this.logInfo(`開始批次處理`, { totalItems: items.length, batchSize });

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(item => processor(item));
      
      try {
        await Promise.all(batchPromises);
        this.logInfo(`批次處理完成`, { 
          batchNumber: Math.floor(i / batchSize) + 1,
          itemsProcessed: batch.length
        });
      } catch (error) {
        this.logError(`批次處理失敗`, error, {
          batchNumber: Math.floor(i / batchSize) + 1,
          batchSize: batch.length
        });
        throw error;
      }
    }
  }
}