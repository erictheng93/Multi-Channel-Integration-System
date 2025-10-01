/**
 * 訊息撤回服務 - 優化版本
 * Message Recall Service - Optimized Version
 *
 * ⚠️ DEPRECATED: 此服務已棄用
 *
 * 原因：已從 Cloudflare Queues + KV 方案遷移到 Durable Objects
 * 替代方案：使用 DelayedMessageBuffer Durable Object
 *
 * 此文件保留僅用於向後兼容和參考，未來版本將移除
 *
 * @deprecated 使用 DelayedMessageBuffer 替代
 */

import type { Bindings } from '../types';
import type {
  PendingMessage,
  // MessageDeliveryResult
} from '../types/services';
import { drizzle } from 'drizzle-orm/d1';
import { delayedMessages, messageRecallLogs, conversations, messages, customers } from '../db/schema';
import { eq, and, count, sql } from 'drizzle-orm';
// 使用表的推斷類型而不是New*類型

export interface DelayedMessageRequest {
  conversationId: string; // 統一使用 string 類型
  content: string;
  delaySeconds: number; // 1-120 秒
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file';
  mediaUrl?: string;
  senderId: string; // 統一使用 string 類型
  recipientPlatformId: string;
  platform: 'line' | 'facebook';
}

export interface RecallResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recallDeadline?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  scheduledSendTime?: string;
  recallDeadline?: string;
}

export class MessageRecallService {
  constructor(private env: Bindings) {}

  /**
   * 發送延遲訊息
   * 核心流程：D1 儲存 → KV 標記 → Queue 排程
   */
  async sendDelayedMessage(request: DelayedMessageRequest): Promise<SendResult> {
    const messageId = crypto.randomUUID();
    const now = new Date();
    const scheduledSendTime = new Date(now.getTime() + request.delaySeconds * 1000);
    const recallDeadline = scheduledSendTime; // 撤回截止時間等於發送時間

    try {
      // 1. 儲存到 D1 (持久化) 
      const drizzleDb = drizzle(this.env.DB);
      
      const newDelayedMessage: any = {
        id: messageId,
        conversationId: request.conversationId,
        agentId: request.senderId,
        content: request.content,
        messageType: request.messageType || 'text',
        scheduledAt: scheduledSendTime.toISOString(),
        status: 'pending',
        metadata: JSON.stringify({
          recipientPlatformId: request.recipientPlatformId,
          platform: request.platform,
          delaySeconds: request.delaySeconds,
          mediaUrl: request.mediaUrl,
          originalSendTime: now.toISOString(),
          recallDeadline: recallDeadline.toISOString()
        }),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      
      await drizzleDb.insert(delayedMessages).values(newDelayedMessage);

      // 2. KV 標記可撤回 (快速查詢)
      const kvKey = `recallable:${messageId}`;
      await this.env.SESSIONS.put(kvKey, JSON.stringify({
        recallable: true,
        expiresAt: recallDeadline.toISOString(),
        conversationId: request.conversationId,
        senderId: request.senderId,
        platform: request.platform
      }), {
        expirationTtl: request.delaySeconds + 60 // 稍長於延遲時間，確保清理
      });

      // 3. Queue 排程延遲發送
      if (this.env.AGENT_QUEUE) {
        await this.env.AGENT_QUEUE.send({
          messageId,
          action: 'send_delayed_message',
          timestamp: now.toISOString()
        }, {
          delaySeconds: request.delaySeconds
        });
      }

      return {
        success: true,
        messageId,
        scheduledSendTime: scheduledSendTime.toISOString(),
        recallDeadline: recallDeadline.toISOString()
      };

    } catch (error) {
      console.error(`Failed to schedule delayed message:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 撤回延遲訊息
   * 核心流程：KV 檢查 → 快速標記取消 → D1 更新狀態
   */
  async recallMessage(messageId: string, userId: string): Promise<RecallResult> {
    try {
      // 1. 快速檢查 KV 中的撤回狀態
      const recallableKey = `recallable:${messageId}`;
      const recallableData = await this.env.SESSIONS.get(recallableKey);

      if (!recallableData) {
        return {
          success: false,
          error: 'Message not found or already processed'
        };
      }

      const recallInfo = JSON.parse(recallableData);
      
      // 檢查權限
      if (recallInfo.senderId !== userId) {
        return {
          success: false,
          error: 'Permission denied'
        };
      }

      // 檢查是否還在撤回期限內
      const now = new Date();
      const deadline = new Date(recallInfo.expiresAt);
      
      if (now > deadline) {
        return {
          success: false,
          error: 'Recall deadline has passed'
        };
      }

      // 2. 立即在 KV 標記為已撤回 (毫秒級響應)
      const cancelledKey = `cancelled:${messageId}`;
      await this.env.SESSIONS.put(cancelledKey, JSON.stringify({
        cancelled: true,
        cancelledAt: now.toISOString(),
        cancelledBy: userId
      }), {
        expirationTtl: 300 // 5 分鐘後清理
      });

      // 3. 異步更新 D1 狀態 (不阻塞響應)
      this.updateMessageStatusAsync(messageId, 'cancelled', userId, now);

      return {
        success: true,
        messageId
      };

    } catch (error) {
      console.error(`Failed to recall message ${messageId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 處理 Queue 中的延遲訊息
   * 核心流程：檢查 KV 取消狀態 → 發送或跳過 → 更新狀態
   */
  async processQueueMessage(messageId: string): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    try {
      // 1. 檢查是否已被撤回 (KV 快速查詢)
      const cancelledKey = `cancelled:${messageId}`;
      const isCancelled = await this.env.SESSIONS.get(cancelledKey);

      if (isCancelled) {
        console.log(`Message ${messageId} was cancelled, skipping send`);
        return { success: true, skipped: true };
      }

      // 2. 從 D1 獲取待發送訊息
      const drizzleDb = drizzle(this.env.DB);
      
      const pendingMessage = await drizzleDb
        .select()
        .from(delayedMessages)
        .where(and(
          eq(delayedMessages.id, messageId),
          eq(delayedMessages.status, 'pending')
        ))
        .get();

      if (!pendingMessage) {
        return { success: false, error: 'Pending message not found' };
      }

      // 3. 發送訊息到平台
      const sendSuccess = await this.sendMessageToPlatform(pendingMessage as unknown as PendingMessage);
      
      // 4. 更新狀態
      const now = new Date();
      const newStatus = sendSuccess ? 'sent' : 'failed';

      await this.updateMessageStatus(messageId, newStatus, String(pendingMessage.agentId), now, sendSuccess);

      // 5. 清理 KV 標記
      await this.cleanupKVMarkers(messageId);

      return { success: sendSuccess };

    } catch (error) {
      console.error(`Failed to process queue message ${messageId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 檢查訊息是否可撤回
   */
  async canRecallMessage(messageId: string, userId: string): Promise<boolean> {
    const recallableKey = `recallable:${messageId}`;
    const recallableData = await this.env.SESSIONS.get(recallableKey);

    if (!recallableData) {
      return false;
    }

    const recallInfo = JSON.parse(recallableData);
    
    // 檢查權限和時間
    return recallInfo.senderId === userId && 
           new Date() < new Date(recallInfo.expiresAt);
  }

  /**
   * 獲取用戶的待發送訊息
   */
  async getPendingMessages(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const drizzleDb = drizzle(this.env.DB);

    // 使用 Drizzle ORM 查詢待發送消息
    const messagesResult = await drizzleDb
      .select({
        // delayed_messages fields
        id: delayedMessages.id,
        conversationId: delayedMessages.conversationId,
        agentId: delayedMessages.agentId,
        content: delayedMessages.content,
        messageType: delayedMessages.messageType,
        scheduledAt: delayedMessages.scheduledAt,
        status: delayedMessages.status,
        metadata: delayedMessages.metadata,
        createdAt: delayedMessages.createdAt,
        updatedAt: delayedMessages.updatedAt,
        sentAt: delayedMessages.sentAt,
        cancelledAt: delayedMessages.cancelledAt,
        // joined fields
        conversation_id: conversations.id,
        customer_name: customers.displayName,
        // calculated field using sql template
        can_recall: sql<number>`
          CASE 
            WHEN ${delayedMessages.status} = 'pending' AND datetime('now') < ${delayedMessages.scheduledAt} THEN 1
            ELSE 0
          END
        `
      })
      .from(delayedMessages)
      .innerJoin(conversations, eq(delayedMessages.conversationId, conversations.id))
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .where(and(
        eq(delayedMessages.agentId, userId),
        eq(delayedMessages.status, 'pending')
      ))
      .orderBy(delayedMessages.scheduledAt)
      .limit(pageSize)
      .offset(offset)
      .all();

    // Use Drizzle for simple count query
    const totalResult = await drizzleDb
      .select({ total: count() })
      .from(delayedMessages)
      .where(and(
        eq(delayedMessages.agentId, userId),
        eq(delayedMessages.status, 'pending')
      ))
      .get();

    return {
      items: messagesResult,
      total: totalResult?.total || 0,
      page,
      pageSize
    };
  }

  // 私有方法

  private async updateMessageStatusAsync(messageId: string, status: string, userId: string, timestamp: Date) {
    // 異步執行，不阻塞主流程
    setTimeout(async () => {
      try {
        await this.updateMessageStatus(messageId, status, userId, timestamp, false);
      } catch (error) {
        console.error(`Failed to update message status async:`, error);
      }
    }, 0);
  }

  private async updateMessageStatus(
    messageId: string, 
    status: string, 
    userId: string, 
    timestamp: Date, 
    createMessageRecord = false
  ) {
    const drizzleDb = drizzle(this.env.DB);
    const timestampStr = timestamp.toISOString();
    
    // 更新 delayed_messages 狀態
    const updateData: Partial<typeof delayedMessages.$inferInsert> = {
      status,
      updatedAt: timestampStr
    };

    if (status === 'sent') {
      updateData.sentAt = timestampStr;
    } else if (status === 'cancelled') {
      updateData.cancelledAt = timestampStr;
    }

    await drizzleDb
      .update(delayedMessages)
      .set(updateData)
      .where(eq(delayedMessages.id, messageId));

    // 如果發送成功，創建正式訊息記錄
    if (createMessageRecord && status === 'sent') {
      const pendingMessage = await drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, messageId))
        .get();

      if (pendingMessage) {
        // 使用 Drizzle ORM 插入消息記錄
        await drizzleDb.insert(messages).values({
          id: messageId,
          conversationId: pendingMessage.conversationId,
          senderType: 'agent',
          agentSenderId: pendingMessage.agentId,
          content: pendingMessage.content,
          messageType: pendingMessage.messageType,
          isSent: true,
          deliveryStatus: 'sent',
          sentAt: timestampStr,
          createdAt: timestampStr
        });

        // 更新對話最後訊息時間
        await drizzleDb
          .update(conversations)
          .set({
            lastMessageAt: timestampStr,
            updatedAt: timestampStr
          })
          .where(eq(conversations.id, pendingMessage.conversationId));
      }
    }

    // 記錄操作日誌 - using Drizzle
    const logRecord: any = {
      messageId,
      userId,
      action: status,
      createdAt: timestampStr
    };

    await drizzleDb.insert(messageRecallLogs).values(logRecord);
  }

  private async cleanupKVMarkers(messageId: string) {
    try {
      await Promise.all([
        this.env.SESSIONS.delete(`recallable:${messageId}`),
        this.env.SESSIONS.delete(`cancelled:${messageId}`)
      ]);
    } catch (error) {
      console.error(`Failed to cleanup KV markers for ${messageId}:`, error);
    }
  }

  private async sendMessageToPlatform(pendingMessage: PendingMessage): Promise<boolean> {
    try {
      switch (pendingMessage.platform) {
        case 'line':
          return await this.sendLineMessage(pendingMessage);
        case 'facebook':
          return await this.sendFacebookMessage(pendingMessage);
        default:
          console.error(`Unsupported platform: ${pendingMessage.platform}`);
          return false;
      }
    } catch (error) {
      console.error(`Failed to send message ${pendingMessage.id}:`, error);
      return false;
    }
  }

  private async sendLineMessage(pendingMessage: PendingMessage): Promise<boolean> {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: pendingMessage.recipient_platform_id,
        messages: [{
          type: 'text',
          text: pendingMessage.content
        }]
      })
    });

    return response.ok;
  }

  private async sendFacebookMessage(pendingMessage: PendingMessage): Promise<boolean> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${this.env.FB_PAGE_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: { id: pendingMessage.recipient_platform_id },
          message: { text: pendingMessage.content }
        })
      }
    );

    return response.ok;
  }
}