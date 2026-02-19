// Delayed Message Module - Event Service
// 延遲訊息模組 - 事件處理服務

import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import type { Bindings } from '@/types';
import type {
  DelayedMessageEvent,
  DelayedMessageEntity,
  ProcessResult
} from '../types';
import { nowISO } from '@/utils/timestamp'

/**
 * EventService - 統一事件處理服務
 *
 * 職責：
 * - 統一管理所有延遲訊息相關事件
 * - 封裝 WebSocket 廣播邏輯
 * - 提供標準化事件格式
 * - 處理事件廣播錯誤
 */
export class EventService {
  private broadcastService: WebSocketBroadcastService;

  constructor(env: Bindings) {
    this.broadcastService = new WebSocketBroadcastService(env);
  }

  /**
   * 廣播延遲訊息已排程事件
   */
  async broadcastMessageScheduled(
    message: DelayedMessageEntity,
    schedulerInfo: {
      scheduledBy: { id: string; name: string; role: string };
      delaySeconds: number;
      scheduledSendTime: string;
      recallDeadline: string;
    }
  ): Promise<boolean> {
    try {
      const event: DelayedMessageEvent = {
        type: 'delayed_message_countdown',
        conversationId: message.conversationId,
        messageId: message.id,
        agentId: message.agentId,
        data: {
          content: this.truncateContent(message.content),
          messageType: message.messageType,
          platform: message.metadata.platform || 'unknown',
          delaySeconds: schedulerInfo.delaySeconds,
          scheduledSendTime: schedulerInfo.scheduledSendTime,
          recallDeadline: schedulerInfo.recallDeadline,
          countdownStarted: true,
          remainingSeconds: schedulerInfo.delaySeconds,
          canRecall: true,
          scheduledBy: schedulerInfo.scheduledBy,
          timestamp: nowISO()
        },
        priority: 'normal'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(event);
      console.log(`✅ [EventService] Message scheduled event broadcasted for ${message.id}`);
      return true;
    } catch (error) {
      console.warn('⚠️ [EventService] Failed to broadcast message scheduled event:', error);
      return false;
    }
  }

  /**
   * 廣播延遲訊息已撤回事件
   */
  async broadcastMessageRecalled(
    messageId: string,
    conversationId: string,
    recalledBy: { id: string; name: string; role: string },
    originalContent?: string
  ): Promise<boolean> {
    try {
      const event: DelayedMessageEvent = {
        type: 'delayed_message_recalled',
        conversationId,
        messageId,
        agentId: recalledBy.id,
        data: {
          recalledBy,
          recalledAt: nowISO(),
          originalContent: originalContent ? this.truncateContent(originalContent) : 'Content recalled',
          originalMessageType: 'text',
          wasSuccessful: true,
          reason: 'manual_recall',
          timestamp: nowISO()
        },
        priority: 'high'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(event);
      console.log(`✅ [EventService] Message recalled event broadcasted for ${messageId}`);
      return true;
    } catch (error) {
      console.warn('⚠️ [EventService] Failed to broadcast message recalled event:', error);
      return false;
    }
  }

  /**
   * 廣播延遲訊息發送成功事件
   */
  async broadcastMessageSent(
    message: DelayedMessageEntity,
    sentResult: { actualSentTime: string; queueProcessingId: string }
  ): Promise<boolean> {
    try {
      const event: DelayedMessageEvent = {
        type: 'delayed_message_sent',
        conversationId: message.conversationId,
        messageId: message.id,
        agentId: message.agentId,
        data: {
          content: this.truncateContent(message.content),
          messageType: message.messageType,
          platform: message.metadata.platform || 'unknown',
          processedAt: sentResult.actualSentTime,
          deliveryStatus: 'sent',
          delayCompleted: true,
          originalScheduledTime: message.scheduledAt,
          actualSentTime: sentResult.actualSentTime,
          queueProcessingId: sentResult.queueProcessingId,
          timestamp: nowISO()
        },
        priority: 'normal'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(event);
      console.log(`✅ [EventService] Message sent event broadcasted for ${message.id}`);
      return true;
    } catch (error) {
      console.warn('⚠️ [EventService] Failed to broadcast message sent event:', error);
      return false;
    }
  }

  /**
   * 廣播延遲訊息處理失敗事件
   */
  async broadcastMessageFailed(
    messageId: string,
    conversationId: string,
    agentId: string,
    error: string,
    operation: 'send' | 'recall' | 'queue_processing' = 'send'
  ): Promise<boolean> {
    try {
      const event: DelayedMessageEvent = {
        type: 'delayed_message_failed',
        conversationId,
        messageId,
        agentId,
        data: {
          failureReason: error,
          operation,
          failedAt: nowISO(),
          deliveryStatus: 'failed',
          timestamp: nowISO()
        },
        priority: 'high'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(event);
      console.log(`✅ [EventService] Message failed event broadcasted for ${messageId}`);
      return true;
    } catch (broadcastError) {
      console.warn('⚠️ [EventService] Failed to broadcast message failed event:', broadcastError);
      return false;
    }
  }

  /**
   * 廣播延遲訊息跳過事件（已被取消）
   */
  async broadcastMessageSkipped(
    messageId: string,
    conversationId: string,
    reason: string = 'Message was cancelled before processing'
  ): Promise<boolean> {
    try {
      const event: DelayedMessageEvent = {
        type: 'delayed_message_recalled',
        conversationId,
        messageId,
        agentId: 'system',
        data: {
          skippedReason: reason,
          processedAt: nowISO(),
          wasSkipped: true,
          originalScheduledTime: nowISO(),
          timestamp: nowISO()
        },
        priority: 'low'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(event);
      console.log(`✅ [EventService] Message skip event broadcasted for ${messageId}`);
      return true;
    } catch (error) {
      console.warn('⚠️ [EventService] Failed to broadcast message skip event:', error);
      return false;
    }
  }

  /**
   * 廣播撤回失敗事件
   */
  async broadcastRecallFailed(
    messageId: string,
    attemptedBy: { id: string; name: string; role: string },
    error: string
  ): Promise<boolean> {
    try {
      const event: DelayedMessageEvent = {
        type: 'delayed_message_failed',
        conversationId: 'unknown', // 撤回失敗時可能無法獲取對話ID
        messageId,
        agentId: attemptedBy.id,
        data: {
          failureReason: error,
          attemptedBy,
          failedAt: nowISO(),
          operation: 'recall',
          timestamp: nowISO()
        },
        priority: 'high'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(event);
      console.log(`✅ [EventService] Recall failed event broadcasted for ${messageId}`);
      return true;
    } catch (broadcastError) {
      console.warn('⚠️ [EventService] Failed to broadcast recall failed event:', broadcastError);
      return false;
    }
  }

  /**
   * 廣播佇列處理結果事件
   */
  async broadcastQueueProcessingResult(
    messageId: string,
    conversationId: string,
    result: ProcessResult
  ): Promise<boolean> {
    try {
      if (result.success && !result.skipped) {
        return await this.broadcastMessageSent(
          { id: messageId, conversationId } as DelayedMessageEntity,
          {
            actualSentTime: nowISO(),
            queueProcessingId: crypto.randomUUID()
          }
        );
      } else if (result.skipped) {
        return await this.broadcastMessageSkipped(
          messageId,
          conversationId,
          'Message was cancelled before processing'
        );
      } else {
        return await this.broadcastMessageFailed(
          messageId,
          conversationId,
          'system',
          result.error || 'Queue processing failed',
          'queue_processing'
        );
      }
    } catch (error) {
      console.warn('⚠️ [EventService] Failed to broadcast queue processing result:', error);
      return false;
    }
  }

  /**
   * 廣播倒數計時更新事件（可選功能，供 DelayedMessageProcessor DO 使用）
   */
  async broadcastCountdownUpdate(
    messageId: string,
    conversationId: string,
    agentId: string,
    remainingSeconds: number
  ): Promise<boolean> {
    try {
      const event: DelayedMessageEvent = {
        type: 'delayed_message_countdown',
        conversationId,
        messageId,
        agentId,
        data: {
          countdownUpdate: true,
          remainingSeconds,
          canRecall: remainingSeconds > 0,
          timestamp: nowISO()
        },
        priority: 'low'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(event);
      return true;
    } catch (error) {
      console.warn('⚠️ [EventService] Failed to broadcast countdown update:', error);
      return false;
    }
  }

  /**
   * 批量廣播事件
   */
  async broadcastBatch(events: DelayedMessageEvent[]): Promise<boolean[]> {
    const results = await Promise.allSettled(
      events.map(event => this.broadcastService.broadcastDelayedMessageEvent(event))
    );

    return results.map(result => result.status === 'fulfilled');
  }

  /**
   * 健康檢查 - 測試廣播服務是否正常
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 發送一個低優先級的測試事件
      const testEvent: DelayedMessageEvent = {
        type: 'delayed_message_countdown',
        conversationId: 'health-check',
        messageId: 'health-check',
        agentId: 'system',
        data: {
          healthCheck: true,
          timestamp: nowISO()
        },
        priority: 'low'
      };

      await this.broadcastService.broadcastDelayedMessageEvent(testEvent);
      return true;
    } catch (error) {
      console.error('❌ [EventService] Health check failed:', error);
      return false;
    }
  }

  /**
   * 截斷內容以避免事件過大
   */
  private truncateContent(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * 建立標準化的使用者資訊物件
   */
  createUserInfo(user: { id: string; displayName?: string; role?: string }): { id: string; name: string; role: string } {
    return {
      id: user.id,
      name: user.displayName || `User ${user.id}`,
      role: user.role || 'agent'
    };
  }

  /**
   * 建立標準化的錯誤事件資料
   */
  createErrorEventData(error: Error, operation: string, context?: Record<string, any>): Record<string, any> {
    return {
      failureReason: error.message,
      operation,
      errorType: error.constructor.name,
      failedAt: nowISO(),
      context,
      timestamp: nowISO()
    };
  }
}