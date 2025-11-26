// Delayed Message Module - Storage Service
// 延遲訊息模組 - 資料存取服務

import { createDbClient, type Database } from '@/db/drizzle-factory';
import { eq, and, count, sql } from 'drizzle-orm';
import { delayedMessages, messageRecallLogs, conversations, customers, messages } from '@/db/schema';
import type { Bindings } from '@/types';
import type {
  DelayedMessageStorage,
  DelayedMessageEntity,
  RecallInfo,
  CancelInfo,
  PendingMessagesResult
} from '../types';
import { StorageError } from '@modules/delayed-message/types';

/**
 * StorageService - 統一資料存取服務
 *
 * 職責：
 * - 封裝所有 D1 資料庫操作
 * - 管理 KV 快取操作
 * - 提供資料一致性保證
 * - 處理儲存相關錯誤
 */
export class StorageService implements DelayedMessageStorage {
  private db: Database;
  private kv: KVNamespace;

  constructor(env: Bindings) {
    this.db = createDbClient(env.DB);
    this.kv = env.SESSIONS;
  }

  /**
   * 儲存延遲訊息到 D1
   */
  async saveMessage(message: DelayedMessageEntity): Promise<boolean> {
    try {
      await this.db.insert(delayedMessages).values({
        id: message.id,
        conversationId: message.conversationId,
        agentId: message.agentId,
        content: message.content,
        messageType: message.messageType,
        scheduledAt: message.scheduledAt,
        status: message.status,
        metadata: JSON.stringify(message.metadata),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      });

      return true;
    } catch (error) {
      console.error('❌ [StorageService] Failed to save message:', error);
      throw new StorageError('Failed to save delayed message', { messageId: message.id, error });
    }
  }

  /**
   * 根據 ID 獲取延遲訊息
   */
  async getMessageById(messageId: string): Promise<DelayedMessageEntity | null> {
    try {
      const result = await this.db
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, messageId))
        .get();

      if (!result) {
        return null;
      }

      return this.mapToEntity(result);
    } catch (error) {
      console.error('❌ [StorageService] Failed to get message by ID:', error);
      throw new StorageError('Failed to get message by ID', { messageId, error });
    }
  }

  /**
   * 更新訊息狀態
   */
  async updateMessageStatus(messageId: string, status: string, timestamp: Date): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        updatedAt: timestamp.toISOString()
      };

      // 根據狀態設定相應的時間戳
      if (status === 'sent') {
        updateData.sentAt = timestamp.toISOString();
      } else if (status === 'cancelled') {
        updateData.cancelledAt = timestamp.toISOString();
      }

      await this.db
        .update(delayedMessages)
        .set(updateData)
        .where(eq(delayedMessages.id, messageId));

      return true;
    } catch (error) {
      console.error('❌ [StorageService] Failed to update message status:', error);
      throw new StorageError('Failed to update message status', { messageId, status, error });
    }
  }

  /**
   * 獲取用戶的待發送訊息
   */
  async getPendingMessages(agentId: string, page: number, pageSize: number): Promise<PendingMessagesResult> {
    try {
      const offset = (page - 1) * pageSize;

      // 查詢待發送訊息
      const messagesResult = await this.db
        .select({
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
          customerName: customers.displayName,
          canRecall: sql<number>`
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
          eq(delayedMessages.agentId, agentId),
          eq(delayedMessages.status, 'pending')
        ))
        .orderBy(delayedMessages.scheduledAt)
        .limit(pageSize)
        .offset(offset)
        .all();

      // 查詢總數
      const totalResult = await this.db
        .select({ total: count() })
        .from(delayedMessages)
        .where(and(
          eq(delayedMessages.agentId, agentId),
          eq(delayedMessages.status, 'pending')
        ))
        .get();

      const items = messagesResult.map(item => this.mapToEntity(item as any));

      return {
        items,
        total: totalResult?.total || 0,
        page,
        pageSize
      };
    } catch (error) {
      console.error('❌ [StorageService] Failed to get pending messages:', error);
      throw new StorageError('Failed to get pending messages', { agentId, page, pageSize, error });
    }
  }

  /**
   * 在 KV 中標記訊息為可撤回
   */
  async markAsRecallable(messageId: string, recallInfo: RecallInfo): Promise<boolean> {
    try {
      const kvKey = `recallable:${messageId}`;
      const ttl = Math.floor((new Date(recallInfo.expiresAt).getTime() - Date.now()) / 1000) + 60; // 稍長於延遲時間

      await this.kv.put(kvKey, JSON.stringify(recallInfo), {
        expirationTtl: ttl > 0 ? ttl : 60 // 至少保留60秒
      });

      return true;
    } catch (error) {
      console.error('❌ [StorageService] Failed to mark as recallable:', error);
      throw new StorageError('Failed to mark as recallable', { messageId, error });
    }
  }

  /**
   * 檢查訊息是否可撤回
   */
  async checkRecallable(messageId: string): Promise<RecallInfo | null> {
    try {
      const kvKey = `recallable:${messageId}`;
      const data = await this.kv.get(kvKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as RecallInfo;
    } catch (error) {
      console.error('❌ [StorageService] Failed to check recallable:', error);
      throw new StorageError('Failed to check recallable', { messageId, error });
    }
  }

  /**
   * 在 KV 中標記訊息為已取消
   */
  async markAsCancelled(messageId: string, cancelInfo: CancelInfo): Promise<boolean> {
    try {
      const kvKey = `cancelled:${messageId}`;
      await this.kv.put(kvKey, JSON.stringify(cancelInfo), {
        expirationTtl: 300 // 5分鐘後清理
      });

      return true;
    } catch (error) {
      console.error('❌ [StorageService] Failed to mark as cancelled:', error);
      throw new StorageError('Failed to mark as cancelled', { messageId, error });
    }
  }

  /**
   * 檢查訊息是否已被取消
   */
  async isCancelled(messageId: string): Promise<boolean> {
    try {
      const kvKey = `cancelled:${messageId}`;
      const data = await this.kv.get(kvKey);
      return data !== null;
    } catch (error) {
      console.error('❌ [StorageService] Failed to check cancelled:', error);
      return false; // 檢查失敗時假設未取消，確保訊息可以發送
    }
  }

  /**
   * 清理 KV 中的標記
   */
  async cleanup(messageId: string): Promise<boolean> {
    try {
      await Promise.all([
        this.kv.delete(`recallable:${messageId}`),
        this.kv.delete(`cancelled:${messageId}`)
      ]);

      return true;
    } catch (error) {
      console.error('❌ [StorageService] Failed to cleanup KV markers:', error);
      throw new StorageError('Failed to cleanup KV markers', { messageId, error });
    }
  }

  /**
   * 儲存正式訊息記錄（當延遲訊息發送成功時）
   */
  async saveMessageRecord(messageId: string, conversationId: string, agentId: string, content: string, messageType: string, timestamp: Date): Promise<boolean> {
    try {
      await this.db.insert(messages).values({
        id: messageId,
        conversationId,
        senderType: 'agent',
        agentSenderId: agentId,
        content,
        messageType,
        isSent: true,
        deliveryStatus: 'sent',
        sentAt: timestamp.toISOString(),
        createdAt: timestamp.toISOString()
      });

      // 更新對話最後訊息時間
      await this.db
        .update(conversations)
        .set({
          lastMessageAt: timestamp.toISOString(),
          updatedAt: timestamp.toISOString()
        })
        .where(eq(conversations.id, conversationId));

      return true;
    } catch (error) {
      console.error('❌ [StorageService] Failed to save message record:', error);
      throw new StorageError('Failed to save message record', { messageId, error });
    }
  }

  /**
   * 記錄操作日誌
   */
  async logOperation(messageId: string, userId: string, action: string, timestamp: Date): Promise<boolean> {
    try {
      await this.db.insert(messageRecallLogs).values({
        messageId,
        userId,
        action,
        createdAt: timestamp.toISOString()
      });

      return true;
    } catch (error) {
      console.error('❌ [StorageService] Failed to log operation:', error);
      // 日誌記錄失敗不應該影響主要功能
      return false;
    }
  }

  /**
   * 將資料庫記錄映射為實體物件
   */
  private mapToEntity(record: any): DelayedMessageEntity {
    return {
      id: record.id,
      conversationId: record.conversationId,
      agentId: record.agentId,
      content: record.content,
      messageType: record.messageType,
      scheduledAt: record.scheduledAt,
      status: record.status,
      metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      sentAt: record.sentAt,
      cancelledAt: record.cancelledAt
    };
  }

  /**
   * 檢查資料庫連接狀態
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 執行簡單查詢檢查資料庫連接
      await this.db.select({ count: count() }).from(delayedMessages).limit(1).get();
      return true;
    } catch (error) {
      console.error('❌ [StorageService] Health check failed:', error);
      return false;
    }
  }
}

// 導出自定義錯誤類別
export { StorageError } from '../types';