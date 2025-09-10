// 代理隊列服務 - 繼承基礎隊列服務
// Agent Queue Service - 處理代理延遲消息和撤回功能

import { QueueBaseService, QueueProcessingResult, QueueErrorType } from './queue-base-service';
import { MessageRecallService } from './message-recall-service';
import type { Bindings } from '../types';

interface AgentQueueMessage {
  messageId: string;
  action: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class AgentQueueService extends QueueBaseService {
  private recallService: MessageRecallService;

  constructor(env: Bindings) {
    super(env, 'AGENT_QUEUE', {
      maxRetries: 3,
      baseDelay: 2000,  // 代理隊列延遲較長，因為處理時間較長
      maxDelay: 60000,  // 最大1分鐘延遲
      backoffMultiplier: 2,
      retryableErrors: [
        QueueErrorType.NETWORK_ERROR,
        QueueErrorType.TIMEOUT,
        QueueErrorType.RATE_LIMIT,
        QueueErrorType.TEMPORARY_FAILURE
      ]
    });

    this.recallService = new MessageRecallService(env);
  }

  // 實現具體的消息處理邏輯
  protected async processMessage(messageBody: AgentQueueMessage): Promise<QueueProcessingResult> {
    const { messageId, action, timestamp } = messageBody;

    this.logInfo(`處理代理隊列消息`, { messageId, action, timestamp });

    switch (action) {
      case 'send_delayed_message':
        return await this.handleDelayedMessage(messageId);
      
      case 'cancel_delayed_message':
        return await this.handleCancelMessage(messageId);
      
      default:
        return {
          success: false,
          messageId,
          processingTime: 0,
          error: `未知的操作類型: ${action}`
        };
    }
  }

  // 處理延遲消息發送
  private async handleDelayedMessage(messageId: string): Promise<QueueProcessingResult> {
    try {
      const result = await this.measurePerformance(
        () => this.recallService.processQueueMessage(messageId),
        `處理延遲消息: ${messageId}`
      );

      if (result.success) {
        if (result.skipped) {
          this.logInfo(`消息已被撤回，跳過發送`, { messageId });
          return {
            success: true,
            messageId,
            processingTime: 0,
            skipped: true,
            metadata: { reason: 'message_cancelled' }
          };
        } else {
          this.logSuccess(`延遲消息發送成功`, { messageId });
          return {
            success: true,
            messageId,
            processingTime: 0,
            metadata: { action: 'message_sent' }
          };
        }
      } else {
        // 分析錯誤類型以決定重試策略
        const errorType = this.analyzeRecallServiceError(result.error || '');
        
        return {
          success: false,
          messageId,
          processingTime: 0,
          error: result.error || 'Unknown error',
          metadata: { errorType, originalError: result.error }
        };
      }

    } catch (error) {
      this.logError(`處理延遲消息時發生異常`, error, { messageId });
      return {
        success: false,
        messageId,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 處理消息撤回
  private async handleCancelMessage(messageId: string): Promise<QueueProcessingResult> {
    try {
      const result = await this.measurePerformance(
        () => this.recallService.recallMessage(messageId, 'system'),
        `撤回延遲消息: ${messageId}`
      );

      if ((result as any).success) {
        this.logSuccess(`消息撤回成功`, { messageId });
        return {
          success: true,
          messageId,
          processingTime: 0,
          metadata: { action: 'message_cancelled' }
        };
      } else {
        return {
          success: false,
          messageId,
          processingTime: 0,
          error: (result as any).error,
          metadata: { action: 'cancel_failed' }
        };
      }

    } catch (error) {
      this.logError(`撤回消息時發生異常`, error, { messageId });
      return {
        success: false,
        messageId,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 分析 MessageRecallService 的錯誤類型
  private analyzeRecallServiceError(errorMessage: string): QueueErrorType {
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('line api') || lowerError.includes('facebook api')) {
      return QueueErrorType.NETWORK_ERROR;
    }
    if (lowerError.includes('rate limit') || lowerError.includes('throttle')) {
      return QueueErrorType.RATE_LIMIT;
    }
    if (lowerError.includes('invalid message') || lowerError.includes('validation')) {
      return QueueErrorType.VALIDATION_ERROR;
    }
    if (lowerError.includes('temporary') || lowerError.includes('service unavailable')) {
      return QueueErrorType.TEMPORARY_FAILURE;
    }
    if (lowerError.includes('not found') || lowerError.includes('expired')) {
      return QueueErrorType.BUSINESS_LOGIC_ERROR;
    }

    return QueueErrorType.SYSTEM_ERROR;
  }

  // 批次處理代理隊列消息
  public async processMessageBatch(batch: MessageBatch<AgentQueueMessage>): Promise<void> {
    this.logInfo(`開始處理代理隊列批次`, { 
      batchSize: batch.messages.length,
      queueName: batch.queue
    });

    // 處理每個消息
    for (const message of batch.messages) {
      await this.handleQueueMessage(message);
    }

    this.logSuccess(`代理隊列批次處理完成`, {
      processedCount: batch.messages.length,
      stats: this.getProcessingStats()
    });
  }

  // 獲取代理隊列特定的統計信息
  public getAgentQueueStats() {
    const baseStats = this.getProcessingStats();
    return {
      ...baseStats,
      queueType: 'agent',
      purpose: '代理延遲消息處理和消息撤回功能',
      configuration: {
        maxRetries: this.retryConfig.maxRetries,
        baseDelay: this.retryConfig.baseDelay,
        maxDelay: this.retryConfig.maxDelay,
        backoffMultiplier: this.retryConfig.backoffMultiplier
      }
    };
  }
}