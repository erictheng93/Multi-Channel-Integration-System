// Message Persistence Service
// 訊息持久化與重播系統 - 確保零訊息遺失

import type { Bindings } from '../types';
import type { WebSocketMessage } from '../types/websocket-types';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * 持久化訊息結構
 */
export interface PersistedMessage {
  id: string;
  userId: number;
  conversationId: number;
  message: WebSocketMessage;
  timestamp: string;
  delivered: boolean;
  retryCount: number;
  expiresAt: string;
}

/**
 * 重播配置
 */
export interface ReplayConfig {
  maxMessages?: number; // 最多重播訊息數
  since?: Date; // 重播起始時間
  includeDelivered?: boolean; // 是否包含已送達訊息
}

/**
 * 重播統計
 */
export interface ReplayStats {
  totalMessages: number;
  deliveredMessages: number;
  pendingMessages: number;
  expiredMessages: number;
}

/**
 * Message Persistence Service
 * 提供訊息持久化、離線緩存和自動重播功能
 */
export class MessagePersistenceService {
  private env: Bindings;
  private defaultTTL = 604800; // 7 天 (秒)

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * 緩存訊息 (用於離線用戶)
   */
  async bufferMessage(
    userId: number,
    conversationId: number,
    message: WebSocketMessage
  ): Promise<void> {
    try {
      const messageId = message.id || `msg-${nowMs()}-${Math.random().toString(36).substring(2)}`;

      const persistedMessage: PersistedMessage = {
        id: messageId,
        userId,
        conversationId,
        message,
        timestamp: nowISO(),
        delivered: false,
        retryCount: 0,
        expiresAt: new Date(Date.now() + this.defaultTTL * 1000).toISOString()
      };

      // 儲存到 KV
      const key = `offline_msg:${userId}:${messageId}`;
      await this.env.SESSIONS.put(
        key,
        JSON.stringify(persistedMessage),
        { expirationTtl: this.defaultTTL }
      );

      // 添加到用戶的訊息索引
      await this.addToUserIndex(userId, messageId);

      console.log(`[Persistence] Message buffered for user ${userId}: ${messageId}`);
    } catch (error) {
      console.error('[Persistence] Failed to buffer message:', error);
      throw error;
    }
  }

  /**
   * 批量緩存訊息
   */
  async bufferMessages(
    messages: Array<{
      userId: number;
      conversationId: number;
      message: WebSocketMessage;
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        await this.bufferMessage(msg.userId, msg.conversationId, msg.message);
        success++;
      } catch (error) {
        failed++;
        console.error(`[Persistence] Failed to buffer message for user ${msg.userId}:`, error);
      }
    }

    console.log(`[Persistence] Batch buffer completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * 重播用戶的未送達訊息
   */
  async replayMessages(
    userId: number,
    config: ReplayConfig = {}
  ): Promise<PersistedMessage[]> {
    try {
      const {
        maxMessages = 100,
        since,
        includeDelivered = false
      } = config;

      // 獲取用戶的訊息索引
      const messageIds = await this.getUserMessageIds(userId);

      if (messageIds.length === 0) {
        console.log(`[Persistence] No messages to replay for user ${userId}`);
        return [];
      }

      const messages: PersistedMessage[] = [];

      for (const messageId of messageIds) {
        if (messages.length >= maxMessages) break;

        const key = `offline_msg:${userId}:${messageId}`;
        const data = await this.env.SESSIONS.get(key);

        if (data) {
          const persistedMsg = JSON.parse(data) as PersistedMessage;

          // 過濾條件
          if (!includeDelivered && persistedMsg.delivered) continue;

          if (since && new Date(persistedMsg.timestamp) < since) continue;

          // 檢查是否過期
          if (new Date(persistedMsg.expiresAt) < new Date()) {
            await this.deleteMessage(userId, messageId);
            continue;
          }

          messages.push(persistedMsg);
        }
      }

      console.log(`[Persistence] Replaying ${messages.length} messages for user ${userId}`);
      return messages;
    } catch (error) {
      console.error('[Persistence] Failed to replay messages:', error);
      return [];
    }
  }

  /**
   * 標記訊息為已送達
   */
  async markAsDelivered(userId: number, messageId: string): Promise<void> {
    try {
      const key = `offline_msg:${userId}:${messageId}`;
      const data = await this.env.SESSIONS.get(key);

      if (data) {
        const persistedMsg = JSON.parse(data) as PersistedMessage;
        persistedMsg.delivered = true;

        await this.env.SESSIONS.put(
          key,
          JSON.stringify(persistedMsg),
          { expirationTtl: 3600 } // 已送達訊息保留 1 小時
        );

        console.log(`[Persistence] Message marked as delivered: ${messageId}`);
      }
    } catch (error) {
      console.error('[Persistence] Failed to mark message as delivered:', error);
    }
  }

  /**
   * 批量標記為已送達
   */
  async markBatchAsDelivered(userId: number, messageIds: string[]): Promise<void> {
    const promises = messageIds.map(id => this.markAsDelivered(userId, id));
    await Promise.all(promises);
    console.log(`[Persistence] Batch marked ${messageIds.length} messages as delivered`);
  }

  /**
   * 刪除訊息
   */
  async deleteMessage(userId: number, messageId: string): Promise<void> {
    try {
      const key = `offline_msg:${userId}:${messageId}`;
      await this.env.SESSIONS.delete(key);

      // 從索引移除
      await this.removeFromUserIndex(userId, messageId);

      console.log(`[Persistence] Message deleted: ${messageId}`);
    } catch (error) {
      console.error('[Persistence] Failed to delete message:', error);
    }
  }

  /**
   * 清理用戶的所有訊息
   */
  async clearUserMessages(userId: number): Promise<number> {
    try {
      const messageIds = await this.getUserMessageIds(userId);
      let deletedCount = 0;

      for (const messageId of messageIds) {
        await this.deleteMessage(userId, messageId);
        deletedCount++;
      }

      // 清理索引
      const indexKey = `offline_msg_index:${userId}`;
      await this.env.SESSIONS.delete(indexKey);

      console.log(`[Persistence] Cleared ${deletedCount} messages for user ${userId}`);
      return deletedCount;
    } catch (error) {
      console.error('[Persistence] Failed to clear user messages:', error);
      return 0;
    }
  }

  /**
   * 獲取用戶的訊息統計
   */
  async getUserStats(userId: number): Promise<ReplayStats> {
    try {
      const messageIds = await this.getUserMessageIds(userId);
      const stats: ReplayStats = {
        totalMessages: 0,
        deliveredMessages: 0,
        pendingMessages: 0,
        expiredMessages: 0
      };

      for (const messageId of messageIds) {
        const key = `offline_msg:${userId}:${messageId}`;
        const data = await this.env.SESSIONS.get(key);

        if (data) {
          const msg = JSON.parse(data) as PersistedMessage;
          stats.totalMessages++;

          if (msg.delivered) {
            stats.deliveredMessages++;
          } else {
            if (new Date(msg.expiresAt) < new Date()) {
              stats.expiredMessages++;
            } else {
              stats.pendingMessages++;
            }
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('[Persistence] Failed to get user stats:', error);
      return {
        totalMessages: 0,
        deliveredMessages: 0,
        pendingMessages: 0,
        expiredMessages: 0
      };
    }
  }

  /**
   * 清理過期訊息
   */
  async cleanupExpiredMessages(userId: number): Promise<number> {
    try {
      const messageIds = await this.getUserMessageIds(userId);
      let cleanedCount = 0;

      for (const messageId of messageIds) {
        const key = `offline_msg:${userId}:${messageId}`;
        const data = await this.env.SESSIONS.get(key);

        if (data) {
          const msg = JSON.parse(data) as PersistedMessage;

          if (new Date(msg.expiresAt) < new Date()) {
            await this.deleteMessage(userId, messageId);
            cleanedCount++;
          }
        } else {
          // KV 已自動過期,從索引移除
          await this.removeFromUserIndex(userId, messageId);
        }
      }

      if (cleanedCount > 0) {
        console.log(`[Persistence] Cleaned ${cleanedCount} expired messages for user ${userId}`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('[Persistence] Failed to cleanup expired messages:', error);
      return 0;
    }
  }

  /**
   * 重試送達失敗的訊息
   */
  async retryFailedMessages(userId: number, maxRetries = 3): Promise<PersistedMessage[]> {
    try {
      const messages = await this.replayMessages(userId, { includeDelivered: false });
      const toRetry: PersistedMessage[] = [];

      for (const msg of messages) {
        if (msg.retryCount < maxRetries) {
          msg.retryCount++;

          // 更新到 KV
          const key = `offline_msg:${userId}:${msg.id}`;
          await this.env.SESSIONS.put(
            key,
            JSON.stringify(msg),
            { expirationTtl: this.defaultTTL }
          );

          toRetry.push(msg);
        } else {
          console.warn(`[Persistence] Message ${msg.id} exceeded max retries, marking as expired`);
          await this.deleteMessage(userId, msg.id);
        }
      }

      console.log(`[Persistence] Retrying ${toRetry.length} messages for user ${userId}`);
      return toRetry;
    } catch (error) {
      console.error('[Persistence] Failed to retry failed messages:', error);
      return [];
    }
  }

  // =================== 私有方法 ===================

  /**
   * 添加到用戶訊息索引
   */
  private async addToUserIndex(userId: number, messageId: string): Promise<void> {
    try {
      const indexKey = `offline_msg_index:${userId}`;
      const data = await this.env.SESSIONS.get(indexKey);

      const messageIds: string[] = data ? JSON.parse(data) : [];

      if (!messageIds.includes(messageId)) {
        messageIds.push(messageId);

        await this.env.SESSIONS.put(
          indexKey,
          JSON.stringify(messageIds),
          { expirationTtl: this.defaultTTL }
        );
      }
    } catch (error) {
      console.error('[Persistence] Failed to add to user index:', error);
    }
  }

  /**
   * 從用戶訊息索引移除
   */
  private async removeFromUserIndex(userId: number, messageId: string): Promise<void> {
    try {
      const indexKey = `offline_msg_index:${userId}`;
      const data = await this.env.SESSIONS.get(indexKey);

      if (data) {
        const messageIds: string[] = JSON.parse(data);
        const filtered = messageIds.filter(id => id !== messageId);

        if (filtered.length > 0) {
          await this.env.SESSIONS.put(
            indexKey,
            JSON.stringify(filtered),
            { expirationTtl: this.defaultTTL }
          );
        } else {
          await this.env.SESSIONS.delete(indexKey);
        }
      }
    } catch (error) {
      console.error('[Persistence] Failed to remove from user index:', error);
    }
  }

  /**
   * 獲取用戶的訊息 ID 列表
   */
  private async getUserMessageIds(userId: number): Promise<string[]> {
    try {
      const indexKey = `offline_msg_index:${userId}`;
      const data = await this.env.SESSIONS.get(indexKey);

      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Persistence] Failed to get user message IDs:', error);
      return [];
    }
  }
}

/**
 * 創建訊息持久化服務實例
 */
export function createMessagePersistenceService(env: Bindings): MessagePersistenceService {
  return new MessagePersistenceService(env);
}
