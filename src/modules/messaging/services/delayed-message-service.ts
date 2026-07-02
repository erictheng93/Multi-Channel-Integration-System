// Delayed Message Service
// 延遲訊息處理服務

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, count, lte } from 'drizzle-orm';
import {
  delayedMessages,
  messages,
  conversations
} from '@/db/schema';
import {
  DelayedMessage,
  DelayedSendRequest,
  DelayedSendResponse,
  MessageNotFoundError,
  InvalidMessageDataError,
  Platform,
  MessageType,
  QueueProcessingResult
} from '../types/message-types';
import type { Bindings } from '@/types';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';
import { DELAYED_MESSAGE_LIMITS } from '@/constants/limits';

const log = createContextLogger('DelayedMessage');

type DelayedMessageRow = typeof delayedMessages.$inferSelect;
type MessageInsert = typeof messages.$inferInsert;

export class DelayedMessageService {
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(
    db: D1Database,
    private env: Bindings
  ) {
    this.drizzleDb = drizzle(db);
  }

  // ======================== 延遲發送操作 ========================

  /**
   * 發送延遲訊息
   * 核心流程：D1 儲存 → KV 標記 → Queue 排程
   */
  async sendDelayedMessage(
    request: DelayedSendRequest,
    senderId: string
  ): Promise<DelayedSendResponse> {
    try {
      // 驗證延遲時間範圍
      if (
        request.delaySeconds < DELAYED_MESSAGE_LIMITS.MIN_DELAY_SECONDS ||
        request.delaySeconds > DELAYED_MESSAGE_LIMITS.MAX_DELAY_SECONDS
      ) {
        throw new InvalidMessageDataError(
          `Delay seconds must be between ${DELAYED_MESSAGE_LIMITS.MIN_DELAY_SECONDS} and ${DELAYED_MESSAGE_LIMITS.MAX_DELAY_SECONDS}`,
          { delaySeconds: request.delaySeconds }
        );
      }

      // 驗證對話是否存在
      const conversation = await this.drizzleDb
        .select()
        .from(conversations)
        .where(eq(conversations.id, request.conversationId))
        .get();

      if (!conversation) {
        throw new InvalidMessageDataError('Conversation not found');
      }

      const messageId = crypto.randomUUID();
      const now = new Date();
      const scheduledAt = new Date(now.getTime() + request.delaySeconds * 1000);
      const recallDeadline = scheduledAt; // 召回截止時間等於發送時間

      // 1. 儲存到 D1 (持久化) - Map to actual schema fields
      const newDelayedMessage = {
        id: messageId,
        conversationId: request.conversationId,
        agentId: senderId, // Map senderId to agentId as per schema
        content: request.content,
        messageType: request.messageType || ('text' as MessageType),
        scheduledAt: scheduledAt.toISOString(),
        status: 'pending' as const,
        metadata: request.metadata ? JSON.stringify({
          // Store additional fields that don't exist in schema as metadata
          recipientPlatformId: request.recipientPlatformId || '',
          platform: request.platform || 'webchat',
          delaySeconds: request.delaySeconds,
          mediaUrl: request.mediaUrl || null,
          ...request.metadata
        }) : JSON.stringify({
          recipientPlatformId: request.recipientPlatformId || '',
          platform: request.platform || 'webchat',
          delaySeconds: request.delaySeconds,
          mediaUrl: request.mediaUrl || null
        }),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await this.drizzleDb.insert(delayedMessages).values(newDelayedMessage);

      // 2. KV 標記可召回 (快速查詢)
      const kvKey = `recallable:${messageId}`;
      await this.env.SESSIONS.put(
        kvKey,
        JSON.stringify({
          recallable: true,
          expiresAt: recallDeadline.toISOString(),
          conversationId: request.conversationId,
          senderId,
          platform: request.platform || 'webchat'
        }),
        {
          expirationTtl: request.delaySeconds + 60 // 稍長於延遲時間，確保清理
        }
      );

      return {
        success: true,
        delayedMessageId: messageId,
        scheduledSendTime: scheduledAt.toISOString(),
        recallDeadline: recallDeadline.toISOString(),
      };
    } catch (error) {
      log.error('Error sending delayed message:', {}, error instanceof Error ? error : new Error(String(error)));

      if (error instanceof InvalidMessageDataError) {
        throw error;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * 取消延遲訊息 (召回)
   */
  async cancelDelayedMessage(
    messageId: string,
    cancelReason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 檢查延遲訊息是否存在且可取消
      const delayedMessage = await this.findDelayedMessageById(messageId);
      if (!delayedMessage) {
        throw new MessageNotFoundError(messageId);
      }

      if (delayedMessage.status !== 'pending') {
        return {
          success: false,
          error: `Cannot cancel message with status: ${delayedMessage.status}`
        };
      }

      // 檢查是否還在可取消時間內
      const now = new Date();
      const scheduledTime = new Date(delayedMessage.scheduledAt);
      if (now >= scheduledTime) {
        return {
          success: false,
          error: 'Cannot cancel message after scheduled send time'
        };
      }

      // 更新狀態為已取消 - store failure reason in metadata
      const existingMessage = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, messageId))
        .get();

      const existingMetadata = existingMessage?.metadata ? JSON.parse(existingMessage.metadata) : {};
      const updatedMetadata = {
        ...existingMetadata,
        failureReason: cancelReason || 'Cancelled by user'
      };

      await this.drizzleDb
        .update(delayedMessages)
        .set({
          status: 'cancelled',
          metadata: JSON.stringify(updatedMetadata),
          updatedAt: now.toISOString(),
        })
        .where(eq(delayedMessages.id, messageId));

      // 清理 KV 標記
      const kvKey = `recallable:${messageId}`;
      await this.env.SESSIONS.delete(kvKey);

      return { success: true };
    } catch (error) {
      log.error('Error cancelling delayed message:', {}, error instanceof Error ? error : new Error(String(error)));

      if (error instanceof MessageNotFoundError) {
        return { success: false, error: error.message };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 處理 Queue 中的延遲發送任務
   */
  async processDelayedSend(messageId: string): Promise<QueueProcessingResult> {
    try {
      const delayedMessage = await this.findDelayedMessageById(messageId);
      if (!delayedMessage) {
        return {
          success: false,
          processedAt: nowISO(),
          error: 'Delayed message not found'
        };
      }

      if (delayedMessage.status !== 'pending') {
        return {
          success: false,
          processedAt: nowISO(),
          error: `Message status is ${delayedMessage.status}, cannot process`
        };
      }

      // 檢查是否到達發送時間
      const now = new Date();
      const scheduledTime = new Date(delayedMessage.scheduledAt);
      if (now < scheduledTime) {
        // 太早了，重新排程
        const delaySeconds = Math.ceil((scheduledTime.getTime() - now.getTime()) / 1000);
        return {
          success: false,
          processedAt: now.toISOString(),
          error: 'Too early to send',
          retryAfter: new Date(now.getTime() + delaySeconds * 1000).toISOString()
        };
      }

      const platform = this.getDelayedMessagePlatform(delayedMessage);
      if (platform === 'line' || platform === 'facebook') {
        const { MessageProcessorService } = await import('@modules/delayed-message/services/MessageProcessorService');
        const processor = new MessageProcessorService(this.env);
        const result = await processor.processQueueMessage(messageId);

        return {
          success: result.success,
          processedAt: nowISO(),
          error: result.error
        };
      }

      if (platform !== 'webchat') {
        await this.markDelayedMessageFailed(messageId, `Unsupported platform: ${platform}`);
        return {
          success: false,
          processedAt: now.toISOString(),
          error: `Unsupported platform: ${platform}`
        };
      }

      // 創建實際訊息
      const messageId_actual = crypto.randomUUID();
      const conversation = await this.drizzleDb
        .select()
        .from(conversations)
        .where(eq(conversations.id, delayedMessage.conversationId))
        .get();

      if (!conversation) {
        await this.markDelayedMessageFailed(messageId, 'Conversation not found');
        return {
          success: false,
          processedAt: now.toISOString(),
          error: 'Conversation not found'
        };
      }

      // 插入實際訊息到 messages 表
      const actualMessage: MessageInsert = {
        id: messageId_actual,
        conversationId: delayedMessage.conversationId,
        senderType: 'agent' as const,
        customerSenderId: null,
        agentSenderId: delayedMessage.agentId,
        content: delayedMessage.content,
        messageType: delayedMessage.messageType,
        platformMessageId: null,
        isRecalled: false,
        recallDeadline: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // 30分鐘召回期限
        recalledAt: null,
        isSent: true,
        sentAt: now.toISOString(),
        deliveryStatus: 'sent' as const,
        replyToMessageId: null,
        metadata: JSON.stringify(delayedMessage.metadata || {}),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await this.drizzleDb.insert(messages).values(actualMessage);

      // 更新延遲訊息狀態
      await this.drizzleDb
        .update(delayedMessages)
        .set({
          status: 'sent',
          updatedAt: now.toISOString(),
        })
        .where(eq(delayedMessages.id, messageId));

      // 清理 KV 標記
      const kvKey = `recallable:${messageId}`;
      await this.env.SESSIONS.delete(kvKey);

      return {
        success: true,
        processedAt: now.toISOString(),
      };
    } catch (error) {
      log.error('Error processing delayed send:', {}, error instanceof Error ? error : new Error(String(error)));

      await this.markDelayedMessageFailed(
        messageId,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        processedAt: nowISO(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ======================== 查詢操作 ========================

  /**
   * 根據ID查詢延遲訊息
   */
  async findDelayedMessageById(messageId: string): Promise<DelayedMessage | null> {
    try {
      const result = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, messageId))
        .get();

      if (!result) {
        return null;
      }

      return this.transformDbDelayedMessage(result);
    } catch (error) {
      log.error('Error finding delayed message by ID:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 獲取待發送的延遲訊息列表
   */
  async getPendingDelayedMessages(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: DelayedMessage[]; total: number }> {
    try {
      // 獲取總數
      const totalResult = await this.drizzleDb
        .select({ count: count() })
        .from(delayedMessages)
        .where(eq(delayedMessages.status, 'pending'))
        .get();

      const total = totalResult?.count || 0;

      // 獲取列表
      const results = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.status, 'pending'))
        .orderBy(desc(delayedMessages.scheduledAt))
        .limit(limit)
        .offset(offset);

      const messages = results.map(result => this.transformDbDelayedMessage(result));

      return { messages, total };
    } catch (error) {
      log.error('Error getting pending delayed messages:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 獲取對話的延遲訊息
   */
  async getConversationDelayedMessages(
    conversationId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ messages: DelayedMessage[]; total: number }> {
    try {
      // 獲取總數
      const totalResult = await this.drizzleDb
        .select({ count: count() })
        .from(delayedMessages)
        .where(eq(delayedMessages.conversationId, conversationId))
        .get();

      const total = totalResult?.count || 0;

      // 獲取列表
      const results = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.conversationId, conversationId))
        .orderBy(desc(delayedMessages.scheduledAt))
        .limit(limit)
        .offset(offset);

      const messages = results.map(result => this.transformDbDelayedMessage(result));

      return { messages, total };
    } catch (error) {
      log.error('Error getting conversation delayed messages:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // ======================== 清理和維護 ========================

  /**
   * 清理過期的延遲訊息
   */
  async cleanupExpiredDelayedMessages(): Promise<{ cleaned: number }> {
    try {
      // 清理失敗超過24小時的記錄
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const expiredMessages = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(
          and(
            eq(delayedMessages.status, 'failed'),
            lte(delayedMessages.updatedAt, expiredThreshold)
          )
      );

      if (expiredMessages.length > 0) {
        // Keep historical records for audit while excluding them from failed-message cleanup scans.
        await this.drizzleDb
          .update(delayedMessages)
          .set({
            status: 'archived',
            updatedAt: nowISO(),
          })
          .where(
            and(
              eq(delayedMessages.status, 'failed'),
              lte(delayedMessages.updatedAt, expiredThreshold)
            )
          );
      }

      return { cleaned: expiredMessages.length };
    } catch (error) {
      log.error('Error cleaning up expired delayed messages:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // ======================== 私有工具方法 ========================

  private getDelayedMessagePlatform(message: DelayedMessage): Platform {
    if (message.platform) {
      return message.platform;
    }

    if (message.metadata && typeof message.metadata === 'object' && 'platform' in message.metadata) {
      const platform = (message.metadata as { platform?: unknown }).platform;
      if (platform === 'line' || platform === 'facebook' || platform === 'webchat') {
        return platform;
      }
    }

    return 'webchat';
  }

  private async markDelayedMessageFailed(messageId: string, reason: string): Promise<void> {
    try {
      // Get existing message to preserve metadata
      const existingMessage = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, messageId))
        .get();

      const existingMetadata = existingMessage?.metadata ? JSON.parse(existingMessage.metadata) : {};
      const updatedMetadata = {
        ...existingMetadata,
        failureReason: reason
      };

      await this.drizzleDb
        .update(delayedMessages)
        .set({
          status: 'failed',
          metadata: JSON.stringify(updatedMetadata),
          updatedAt: nowISO(),
        })
        .where(eq(delayedMessages.id, messageId));
    } catch (error) {
      log.error('Error marking delayed message as failed:', {}, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private transformDbDelayedMessage(dbRecord: DelayedMessageRow): DelayedMessage {
    // Parse metadata to extract fields not in schema
    const metadata = dbRecord.metadata
      ? JSON.parse(dbRecord.metadata) as Record<string, unknown>
      : {};

    return {
      id: dbRecord.id,
      conversationId: dbRecord.conversationId,
      agentId: dbRecord.agentId,
      recipientPlatformId: typeof metadata.recipientPlatformId === 'string' ? metadata.recipientPlatformId : '',
      platform: (typeof metadata.platform === 'string' ? metadata.platform : 'webchat') as Platform,
      content: dbRecord.content,
      messageType: dbRecord.messageType as MessageType,
      delaySeconds: typeof metadata.delaySeconds === 'number' ? metadata.delaySeconds : 0,
      scheduledAt: dbRecord.scheduledAt,
      status: dbRecord.status as DelayedMessage['status'],
      failureReason: typeof metadata.failureReason === 'string' ? metadata.failureReason : undefined, // Store failure reason in metadata
      mediaUrl: typeof metadata.mediaUrl === 'string' ? metadata.mediaUrl : undefined,
      metadata: dbRecord.metadata ? JSON.parse(dbRecord.metadata) as Record<string, unknown> : undefined,
      createdAt: dbRecord.createdAt || nowISO(),
      updatedAt: dbRecord.updatedAt || nowISO(),
    };
  }
}
