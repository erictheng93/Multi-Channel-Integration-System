// Delayed Message Module - Message Scheduler Service
// 延遲訊息模組 - 訊息排程服務

import type { Bindings } from '@/types';
import type {
  DelayedMessageRequest,
  DelayedMessageEntity
} from '../types';
import { SchedulingError } from '@modules/delayed-message/types';
import { StorageService } from '@modules/delayed-message/infrastructure/StorageService';
import { ValidationService } from '@modules/delayed-message/infrastructure/ValidationService';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('MessageScheduler')

/**
 * MessageSchedulerService - 訊息排程專家
 *
 * 職責：
 * - 處理延遲訊息的時間計算
 * - 管理 Queue 排程操作
 * - 維護撤回期限管理
 * - 處理排程衝突
 */
export class MessageSchedulerService {
  private storageService: StorageService;
  private validationService: ValidationService;

  constructor(env: Bindings) {
    this.storageService = new StorageService(env);
    this.validationService = new ValidationService();
  }

  /**
   * 排程延遲訊息
   */
  async scheduleMessage(request: DelayedMessageRequest): Promise<{
    success: boolean;
    messageId?: string;
    scheduledSendTime?: string;
    recallDeadline?: string;
    error?: string;
  }> {
    try {
      // 驗證請求
      const validation = this.validationService.validateDelayedMessageRequest(request);
      if (!validation.isValid) {
        throw new SchedulingError(`Validation failed: ${validation.errors.join(', ')}`, {
          validationErrors: validation.errors
        });
      }

      // 計算時間
      const timeCalculation = this.calculateScheduleTimes(request.delaySeconds);

      // 建立訊息實體
      const messageEntity = this.createMessageEntity(request, timeCalculation);

      // 儲存到資料庫
      const saved = await this.storageService.saveMessage(messageEntity);
      if (!saved) {
        throw new SchedulingError('Failed to save message to database');
      }

      // 設定 KV 撤回標記
      const recallInfo = this.createRecallInfo(request, timeCalculation.recallDeadline);
      await this.storageService.markAsRecallable(messageEntity.id, recallInfo);

      log.info('Message scheduled', { messageId: messageEntity.id, scheduledSendTime: timeCalculation.scheduledSendTime });

      return {
        success: true,
        messageId: messageEntity.id,
        scheduledSendTime: timeCalculation.scheduledSendTime,
        recallDeadline: timeCalculation.recallDeadline
      };

    } catch (error) {
      log.error('Failed to schedule message', {}, error instanceof Error ? error : String(error));

      if (error instanceof SchedulingError) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown scheduling error'
      };
    }
  }

  /**
   * 取消已排程的訊息
   */
  async cancelScheduledMessage(messageId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // 檢查撤回權限
      const recallInfo = await this.storageService.checkRecallable(messageId);
      const validation = this.validationService.validateRecallPermission(messageId, userId, recallInfo);

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // 在 KV 中標記為已取消（立即生效）
      const cancelInfo = {
        cancelled: true,
        cancelledAt: nowISO(),
        cancelledBy: userId
      };

      await this.storageService.markAsCancelled(messageId, cancelInfo);

      // 異步更新資料庫狀態
      this.updateMessageStatusAsync(messageId, 'cancelled', userId, new Date());

      log.info('Message cancelled', { messageId });

      return {
        success: true
      };

    } catch (error) {
      log.error('Failed to cancel message', { messageId }, error instanceof Error ? error : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cancellation error'
      };
    }
  }

  /**
   * 重新排程訊息
   */
  async rescheduleMessage(
    messageId: string,
    newDelaySeconds: number,
    userId: string
  ): Promise<{
    success: boolean;
    newScheduledTime?: string;
    error?: string;
  }> {
    try {
      // 驗證新的延遲時間
      const delayValidation = this.validationService.validateDelaySeconds(newDelaySeconds);
      if (!delayValidation.isValid) {
        return {
          success: false,
          error: delayValidation.errors.join(', ')
        };
      }

      // 檢查訊息狀態和權限
      const message = await this.storageService.getMessageById(messageId);
      if (!message) {
        return {
          success: false,
          error: 'Message not found'
        };
      }

      if (message.status !== 'pending') {
        return {
          success: false,
          error: 'Message cannot be rescheduled'
        };
      }

      if (message.agentId !== userId) {
        return {
          success: false,
          error: 'Permission denied'
        };
      }

      // 計算新的時間
      const timeCalculation = this.calculateScheduleTimes(newDelaySeconds);

      // 更新訊息的排程時間
      message.scheduledAt = timeCalculation.scheduledSendTime;
      message.updatedAt = nowISO();
      message.metadata = {
        ...message.metadata,
        originalScheduledAt: message.scheduledAt,
        rescheduledAt: nowISO(),
        rescheduledBy: userId,
        newDelaySeconds
      };

      // 更新資料庫
      await this.storageService.updateMessageStatus(messageId, 'pending', new Date());

      // 更新 KV 撤回標記
      const recallInfo = this.createRecallInfo(
        { platform: message.metadata.platform, senderId: message.agentId } as any,
        timeCalculation.recallDeadline
      );
      await this.storageService.markAsRecallable(messageId, recallInfo);

      // Rescheduled message will be picked up by DelayedMessageBuffer DO alarm

      log.info('Message rescheduled', { messageId, newScheduledTime: timeCalculation.scheduledSendTime });

      return {
        success: true,
        newScheduledTime: timeCalculation.scheduledSendTime
      };

    } catch (error) {
      log.error('Failed to reschedule message', { messageId }, error instanceof Error ? error : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown rescheduling error'
      };
    }
  }

  /**
   * 獲取排程統計資訊
   */
  async getSchedulingStats(_agentId?: string): Promise<{
    pendingCount: number;
    scheduledForNext24Hours: number;
    averageDelaySeconds: number;
  }> {
    try {
      // 從 StorageService 獲取真實統計數據
      const stats = await this.storageService.getSchedulingStats();

      log.info('Scheduling stats retrieved', { stats });

      return stats;
    } catch (error) {
      log.error('Failed to get scheduling stats', {}, error instanceof Error ? error : String(error));
      // 發生錯誤時返回默認值
      return {
        pendingCount: 0,
        scheduledForNext24Hours: 0,
        averageDelaySeconds: 0
      };
    }
  }

  /**
   * 檢查排程衝突
   */
  async checkSchedulingConflicts(
    _conversationId: string,
    _scheduledTime: Date
  ): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{
      messageId: string;
      scheduledAt: string;
      timeDifference: number;
    }>;
  }> {
    try {
      // 這裡可以實現衝突檢查邏輯
      // 例如：同一對話中相近時間的訊息
      return {
        hasConflicts: false,
        conflicts: []
      };
    } catch (error) {
      log.error('Failed to check scheduling conflicts', {}, error instanceof Error ? error : String(error));
      return {
        hasConflicts: false,
        conflicts: []
      };
    }
  }

  /**
   * 批量排程訊息
   */
  async scheduleBatch(requests: DelayedMessageRequest[]): Promise<Array<{
    request: DelayedMessageRequest;
    success: boolean;
    messageId?: string;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      requests.map(request => this.scheduleMessage(request))
    );

    return results.map((result, index) => {
      const request = requests[index]!;

      if (result.status === 'fulfilled' && result.value.success) {
        return {
          request,
          success: true,
          messageId: result.value.messageId || undefined
        };
      } else {
        return {
          request,
          success: false,
          error: result.status === 'fulfilled'
            ? (result.value.error || 'Unknown error')
            : 'Batch scheduling failed'
        };
      }
    });
  }

  /**
   * 健康檢查
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.storageService.healthCheck();
    } catch (error) {
      log.error('Health check failed', {}, error instanceof Error ? error : String(error));
      return false;
    }
  }

  // 私有方法

  /**
   * 計算排程時間
   */
  private calculateScheduleTimes(delaySeconds: number): {
    scheduledSendTime: string;
    recallDeadline: string;
    now: string;
  } {
    const now = new Date();
    const scheduledSendTime = new Date(now.getTime() + delaySeconds * 1000);
    const recallDeadline = scheduledSendTime; // 撤回截止時間等於發送時間

    return {
      scheduledSendTime: scheduledSendTime.toISOString(),
      recallDeadline: recallDeadline.toISOString(),
      now: now.toISOString()
    };
  }

  /**
   * 建立訊息實體
   */
  private createMessageEntity(
    request: DelayedMessageRequest,
    timeCalculation: ReturnType<typeof this.calculateScheduleTimes>
  ): DelayedMessageEntity {
    const messageId = crypto.randomUUID();

    return {
      id: messageId,
      conversationId: request.conversationId,
      agentId: request.senderId,
      content: request.content,
      messageType: request.messageType || 'text',
      scheduledAt: timeCalculation.scheduledSendTime,
      status: 'pending',
      metadata: {
        recipientPlatformId: request.recipientPlatformId,
        platform: request.platform,
        delaySeconds: request.delaySeconds,
        mediaUrl: request.mediaUrl,
        originalSendTime: timeCalculation.now,
        recallDeadline: timeCalculation.recallDeadline
      },
      createdAt: timeCalculation.now,
      updatedAt: timeCalculation.now
    };
  }

  /**
   * 建立撤回資訊
   */
  private createRecallInfo(
    request: Pick<DelayedMessageRequest, 'platform' | 'senderId'>,
    recallDeadline: string
  ) {
    return {
      recallable: true,
      expiresAt: recallDeadline,
      conversationId: '',
      senderId: request.senderId,
      platform: request.platform
    };
  }

  /**
   * 異步更新訊息狀態
   */
  private updateMessageStatusAsync(
    messageId: string,
    status: string,
    userId: string,
    timestamp: Date
  ): void {
    setTimeout(async () => {
      try {
        await this.storageService.updateMessageStatus(messageId, status, timestamp);
        await this.storageService.logOperation(messageId, userId, status, timestamp);
      } catch (error) {
        log.error('Failed to update message status async', { messageId }, error instanceof Error ? error : String(error));
      }
    }, 0);
  }
}

// 導出自定義錯誤類別
export { SchedulingError } from '../types';
