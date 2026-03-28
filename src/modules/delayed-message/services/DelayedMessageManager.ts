// Delayed Message Module - Delayed Message Manager
// 延遲訊息模組 - 核心管理器

import type { Bindings } from '@/types';
import type {
  DelayedMessageRequest,
  SendResult,
  RecallResult,
  ProcessResult,
  PendingMessagesResult
} from '../types';
import { DelayedMessageError } from '@modules/delayed-message/types';

import { StorageService } from '@modules/delayed-message/infrastructure/StorageService';
import { ValidationService } from '@modules/delayed-message/infrastructure/ValidationService';
import { EventService } from '@modules/delayed-message/infrastructure/EventService';
import { MessageSchedulerService } from '@modules/delayed-message/services/MessageSchedulerService';
import { MessageProcessorService } from '@modules/delayed-message/services/MessageProcessorService';
import { PermissionService } from '@/services/permission-service';
import { nowISO } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('DelayedMessageManager');

/**
 * DelayedMessageManager - 延遲訊息核心管理器
 *
 * 職責：
 * - 協調整個延遲訊息流程
 * - 管理訊息生命週期
 * - 統一錯誤處理策略
 * - 提供統一的業務介面
 */
export class DelayedMessageManager {
  private storageService: StorageService;
  private validationService: ValidationService;
  private eventService: EventService;
  private schedulerService: MessageSchedulerService;
  private processorService: MessageProcessorService;

  constructor(env: Bindings) {
    // 初始化所有服務
    this.storageService = new StorageService(env);
    this.validationService = new ValidationService();
    this.eventService = new EventService(env);
    this.schedulerService = new MessageSchedulerService(env);
    this.processorService = new MessageProcessorService(env);
  }

  /**
   * 發送延遲訊息 - 主要業務流程
   */
  async sendDelayedMessage(
    request: DelayedMessageRequest,
    user: { id: string; displayName?: string; role?: string }
  ): Promise<SendResult> {
    try {
      log.info('Processing delayed message request', { userId: user.id });

      // 1. 業務驗證
      const validation = this.validationService.validateDelayedMessageRequest(request);
      if (!validation.isValid) {
        return this.createFailureResult('Validation failed', validation.errors.join(', '));
      }

      // 2. 權限檢查
      const hasPermission = await this.checkSendPermission(user, request);
      if (!hasPermission) {
        return this.createFailureResult('Permission denied', 'Insufficient permissions to send delayed messages');
      }

      // 3. 排程訊息
      const scheduleResult = await this.schedulerService.scheduleMessage(request);
      if (!scheduleResult.success) {
        return this.createFailureResult('Scheduling failed', scheduleResult.error || 'Unknown scheduling error');
      }

      // 4. 廣播排程事件
      try {
        const message = await this.storageService.getMessageById(scheduleResult.messageId!);
        if (message) {
          await this.eventService.broadcastMessageScheduled(message, {
            scheduledBy: this.eventService.createUserInfo(user),
            delaySeconds: request.delaySeconds,
            scheduledSendTime: scheduleResult.scheduledSendTime!,
            recallDeadline: scheduleResult.recallDeadline!
          });
        }
      } catch (eventError) {
        log.warn('Failed to broadcast scheduled event', { error: eventError instanceof Error ? eventError.message : String(eventError) });
        // 事件廣播失敗不影響主要功能
      }

      log.info('Delayed message scheduled successfully', { messageId: scheduleResult.messageId });

      return {
        success: true,
        messageId: scheduleResult.messageId!,
        scheduledSendTime: scheduleResult.scheduledSendTime!,
        recallDeadline: scheduleResult.recallDeadline!
      };

    } catch (error) {
      log.error('Failed to send delayed message', {}, error instanceof Error ? error : new Error(String(error)));
      return this.createFailureResult(
        'Internal error',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * 撤回延遲訊息
   */
  async recallDelayedMessage(
    messageId: string,
    user: { id: string; displayName?: string; role?: string }
  ): Promise<RecallResult> {
    try {
      log.info('Processing recall request', { messageId, userId: user.id });

      // 1. 基本驗證
      if (!messageId?.trim()) {
        return {
          success: false,
          error: 'Message ID is required'
        };
      }

      // 2. 取消排程
      const cancelResult = await this.schedulerService.cancelScheduledMessage(messageId, user.id);
      if (!cancelResult.success) {
        // 廣播撤回失敗事件
        await this.eventService.broadcastRecallFailed(
          messageId,
          this.eventService.createUserInfo(user),
          cancelResult.error || 'Recall failed'
        );

        return {
          success: false,
          error: cancelResult.error || 'Recall failed'
        };
      }

      // 3. 獲取訊息資訊以用於事件廣播
      let conversationId = 'unknown';
      let originalContent = '';
      try {
        const message = await this.storageService.getMessageById(messageId);
        if (message) {
          conversationId = message.conversationId;
          originalContent = message.content;
        }
      } catch {
        // 忽略獲取訊息資訊失敗
      }

      // 4. 廣播撤回成功事件
      try {
        await this.eventService.broadcastMessageRecalled(
          messageId,
          conversationId,
          this.eventService.createUserInfo(user),
          originalContent
        );
      } catch (eventError) {
        log.warn('Failed to broadcast recall event', { error: eventError instanceof Error ? eventError.message : String(eventError) });
        // 事件廣播失敗不影響主要功能
      }

      log.info('Message recalled successfully', { messageId });

      return {
        success: true,
        messageId
      };

    } catch (error) {
      log.error('Failed to recall message', { messageId }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 處理佇列中的延遲訊息
   */
  async processQueueMessage(messageId: string, conversationId?: string): Promise<ProcessResult> {
    try {
      log.info('Processing queue message', { messageId });

      // 1. 處理訊息
      const processResult = await this.processorService.processQueueMessage(messageId);

      // 2. 廣播處理結果
      try {
        const finalConversationId = conversationId || await this.getConversationIdFromMessage(messageId) || 'unknown';
        await this.eventService.broadcastQueueProcessingResult(
          messageId,
          finalConversationId,
          processResult
        );
      } catch (eventError) {
        log.warn('Failed to broadcast processing result', { error: eventError instanceof Error ? eventError.message : String(eventError) });
        // 事件廣播失敗不影響主要功能
      }

      const status = processResult.success ? 'succeeded' : processResult.skipped ? 'skipped' : 'failed';
      log.info(`Queue message processing ${status}`, { messageId });

      return processResult;

    } catch (error) {
      log.error('Failed to process queue message', { messageId }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 獲取待發送訊息列表
   */
  async getPendingMessages(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PendingMessagesResult> {
    try {
      log.info('Getting pending messages', { userId });

      // 驗證分頁參數
      if (page < 1 || pageSize < 1 || pageSize > 100) {
        throw new DelayedMessageError('Invalid pagination parameters', 'INVALID_PARAMS');
      }

      const result = await this.storageService.getPendingMessages(userId, page, pageSize);

      log.info('Retrieved pending messages', { count: result.items.length });

      return result;

    } catch (error) {
      log.error('Failed to get pending messages', { userId }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 重新排程訊息
   */
  async rescheduleMessage(
    messageId: string,
    newDelaySeconds: number,
    user: { id: string; displayName?: string; role?: string }
  ): Promise<SendResult> {
    try {
      log.info('Rescheduling message', { messageId, userId: user.id });

      // 重新排程
      const rescheduleResult = await this.schedulerService.rescheduleMessage(
        messageId,
        newDelaySeconds,
        user.id
      );

      if (!rescheduleResult.success) {
        return this.createFailureResult('Rescheduling failed', rescheduleResult.error || 'Rescheduling failed');
      }

      // 廣播重新排程事件
      try {
        const message = await this.storageService.getMessageById(messageId);
        if (message) {
          await this.eventService.broadcastMessageScheduled(message, {
            scheduledBy: this.eventService.createUserInfo(user),
            delaySeconds: newDelaySeconds,
            scheduledSendTime: rescheduleResult.newScheduledTime!,
            recallDeadline: rescheduleResult.newScheduledTime!
          });
        }
      } catch (eventError) {
        log.warn('Failed to broadcast reschedule event', { error: eventError instanceof Error ? eventError.message : String(eventError) });
      }

      log.info('Message rescheduled successfully', { messageId });

      return {
        success: true,
        messageId,
        scheduledSendTime: rescheduleResult.newScheduledTime!
      };

    } catch (error) {
      log.error('Failed to reschedule message', { messageId }, error instanceof Error ? error : new Error(String(error)));
      return this.createFailureResult(
        'Internal error',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * 批量處理操作
   */
  async processBatch(messageIds: string[]): Promise<Array<{
    messageId: string;
    result: ProcessResult;
  }>> {
    try {
      log.info('Processing batch', { count: messageIds.length });

      const results = await this.processorService.processBatch(messageIds);

      const successCount = results.filter(r => r.result.success).length;
      log.info('Batch processing completed', { successful: successCount, total: messageIds.length });

      return results;

    } catch (error) {
      log.error('Batch processing failed', {}, error instanceof Error ? error : new Error(String(error)));
      return messageIds.map(messageId => ({
        messageId,
        result: {
          success: false,
          error: 'Batch processing failed'
        }
      }));
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    try {
      const serviceChecks = await Promise.allSettled([
        this.storageService.healthCheck(),
        this.schedulerService.healthCheck(),
        this.processorService.healthCheck(),
        this.eventService.healthCheck()
      ]);

      const services = {
        storage: serviceChecks[0]?.status === 'fulfilled' ? serviceChecks[0].value : false,
        scheduler: serviceChecks[1]?.status === 'fulfilled' ? serviceChecks[1].value : false,
        processor: serviceChecks[2]?.status === 'fulfilled' ? serviceChecks[2].value : false,
        event: serviceChecks[3]?.status === 'fulfilled' ? serviceChecks[3].value : false
      };

      const healthy = Object.values(services).every(Boolean);

      return {
        healthy,
        services,
        timestamp: nowISO()
      };
    } catch (error) {
      log.error('Health check failed', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        healthy: false,
        services: {
          storage: false,
          scheduler: false,
          processor: false,
          event: false
        },
        timestamp: nowISO()
      };
    }
  }

  // 私有輔助方法

  /**
   * 檢查發送權限
   */
  private async checkSendPermission(
    user: { id: string; role?: string },
    request: DelayedMessageRequest
  ): Promise<boolean> {
    try {
      return await PermissionService.checkPermission(
        user.id,
        'message',
        'send',
        {
          userId: user.id, //  保持字符串類型，與修正一致
          role: user.role || 'agent',
          resourceId: request.conversationId || ''
        }
      );
    } catch (error) {
      log.error('Permission check failed', {}, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 從訊息ID獲取對話ID
   */
  private async getConversationIdFromMessage(messageId: string): Promise<string | null> {
    try {
      const message = await this.storageService.getMessageById(messageId);
      return message?.conversationId || null;
    } catch (error) {
      log.warn('Failed to get conversation ID for message', { messageId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * 創建失敗結果
   */
  private createFailureResult(type: string, details: string): SendResult {
    return {
      success: false,
      error: `${type}: ${details}`
    };
  }
}

// 導出所有錯誤類別
export {
  DelayedMessageError,
  ValidationError,
  StorageError,
  SchedulingError,
  ProcessingError
} from '../types';