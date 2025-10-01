// Message Recall Service
// 訊息召回處理服務

import { eq, and, desc, count, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  messages,
  messageRecallLogs,
  delayedMessages,
  conversations
} from '@/db/schema';
import {
  MessageRecall,
  RecallRequest,
  RecallResponse,
  MessageNotFoundError,
  RecallDeadlineExceededError,
  InvalidMessageDataError
} from '../types/message-types';
import type { Bindings } from '@/types';

export class MessageRecallService {
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(
    private db: D1Database,
    private env: Bindings
  ) {
    this.drizzleDb = drizzle(db);
  }

  // ======================== 訊息召回操作 ========================

  /**
   * 召回已發送的訊息
   */
  async recallMessage(
    messageId: string,
    requestedBy: string,
    reason?: string
  ): Promise<RecallResponse> {
    try {
      // 檢查訊息是否存在
      const message = await this.drizzleDb
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .get();

      if (!message) {
        return {
          success: false,
          messageId,
          error: 'Message not found',
          canRecall: false
        };
      }

      // 檢查是否已經被召回
      if (message.isRecalled) {
        return {
          success: false,
          messageId,
          error: 'Message already recalled',
          canRecall: false,
          recallDeadline: message.recallDeadline || undefined
        };
      }

      // 檢查召回截止時間
      const now = new Date();
      if (message.recallDeadline && now > new Date(message.recallDeadline)) {
        return {
          success: false,
          messageId,
          error: 'Recall deadline exceeded',
          canRecall: false,
          recallDeadline: message.recallDeadline
        };
      }

      // 執行召回
      const recalledAt = now.toISOString();
      const recallLogId = crypto.randomUUID();

      // 更新訊息狀態
      await this.drizzleDb
        .update(messages)
        .set({
          isRecalled: true,
          recalledAt,
        })
        .where(eq(messages.id, messageId));

      // 記錄召回日誌 - Map to actual schema fields
      await this.drizzleDb.insert(messageRecallLogs).values({
        // id is auto-generated (integer primaryKey)
        messageId,
        userId: requestedBy, // Map requestedBy to userId
        action: 'successful', // Map status to action
        createdAt: recalledAt,
      });

      // TODO: 通知平台撤回訊息 (LINE, Facebook 等)
      // await this.notifyPlatformRecall(message);

      return {
        success: true,
        messageId,
        recalledAt,
        canRecall: true
      };
    } catch (error) {
      console.error('Error recalling message:', error);

      // 記錄失敗的召回嘗試
      try {
        await this.drizzleDb.insert(messageRecallLogs).values({
          // id is auto-generated (integer primaryKey)
          messageId,
          userId: requestedBy, // Map requestedBy to userId
          action: 'failed', // Map status to action
          createdAt: new Date().toISOString(),
        });
      } catch (logError) {
        console.error('Error logging failed recall attempt:', logError);
      }

      return {
        success: false,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        canRecall: false
      };
    }
  }

  /**
   * 召回延遲訊息 (取消未發送的延遲訊息)
   */
  async recallDelayedMessage(
    delayedMessageId: string,
    requestedBy: string,
    reason?: string
  ): Promise<RecallResponse> {
    try {
      // 檢查延遲訊息是否存在
      const delayedMessage = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, delayedMessageId))
        .get();

      if (!delayedMessage) {
        return {
          success: false,
          messageId: delayedMessageId,
          error: 'Delayed message not found',
          canRecall: false
        };
      }

      // 檢查是否還可以取消
      if (delayedMessage.status !== 'pending') {
        return {
          success: false,
          messageId: delayedMessageId,
          error: `Cannot recall delayed message with status: ${delayedMessage.status}`,
          canRecall: false
        };
      }

      // 檢查是否還在可取消時間內
      const now = new Date();
      const scheduledTime = new Date(delayedMessage.scheduledAt);
      if (now >= scheduledTime) {
        return {
          success: false,
          messageId: delayedMessageId,
          error: 'Cannot recall delayed message after scheduled send time',
          canRecall: false,
          recallDeadline: delayedMessage.scheduledAt
        };
      }

      const recalledAt = now.toISOString();

      // 更新延遲訊息狀態 - store failure reason in metadata
      const existingMessage = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, delayedMessageId))
        .get();

      const existingMetadata = existingMessage?.metadata ? JSON.parse(existingMessage.metadata) : {};
      const updatedMetadata = {
        ...existingMetadata,
        failureReason: reason || 'Recalled by user'
      };

      await this.drizzleDb
        .update(delayedMessages)
        .set({
          status: 'cancelled',
          metadata: JSON.stringify(updatedMetadata),
          updatedAt: recalledAt,
        })
        .where(eq(delayedMessages.id, delayedMessageId));

      // 清理 KV 標記
      const kvKey = `recallable:${delayedMessageId}`;
      await this.env.SESSIONS.delete(kvKey);

      // 記錄召回日誌 - Map to actual schema fields
      await this.drizzleDb.insert(messageRecallLogs).values({
        // id is auto-generated (integer primaryKey)
        messageId: delayedMessageId,
        userId: requestedBy, // Map requestedBy to userId
        action: 'successful', // Map status to action
        createdAt: recalledAt,
      });

      return {
        success: true,
        messageId: delayedMessageId,
        recalledAt,
        canRecall: true
      };
    } catch (error) {
      console.error('Error recalling delayed message:', error);

      // 記錄失敗的召回嘗試
      try {
        await this.drizzleDb.insert(messageRecallLogs).values({
          // id is auto-generated (integer primaryKey)
          messageId: delayedMessageId,
          userId: requestedBy, // Map requestedBy to userId
          action: 'failed', // Map status to action
          createdAt: new Date().toISOString(),
        });
      } catch (logError) {
        console.error('Error logging failed delayed recall attempt:', logError);
      }

      return {
        success: false,
        messageId: delayedMessageId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        canRecall: false
      };
    }
  }

  /**
   * 批量召回訊息
   */
  async batchRecallMessages(
    messageIds: string[],
    requestedBy: string,
    reason?: string
  ): Promise<{
    success: boolean;
    results: RecallResponse[];
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const results: RecallResponse[] = [];
    let successful = 0;
    let failed = 0;

    for (const messageId of messageIds) {
      const result = await this.recallMessage(messageId, requestedBy, reason);
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      success: successful > 0,
      results,
      summary: {
        total: messageIds.length,
        successful,
        failed,
      },
    };
  }

  // ======================== 查詢操作 ========================

  /**
   * 檢查訊息是否可召回
   */
  async canRecallMessage(messageId: string): Promise<{
    canRecall: boolean;
    reason?: string;
    recallDeadline?: string;
  }> {
    try {
      // 先檢查是否為延遲訊息
      const delayedMessage = await this.drizzleDb
        .select()
        .from(delayedMessages)
        .where(eq(delayedMessages.id, messageId))
        .get();

      if (delayedMessage) {
        if (delayedMessage.status !== 'pending') {
          return {
            canRecall: false,
            reason: `Delayed message status is ${delayedMessage.status}`
          };
        }

        const now = new Date();
        const scheduledTime = new Date(delayedMessage.scheduledAt);
        if (now >= scheduledTime) {
          return {
            canRecall: false,
            reason: 'Delayed message has already been sent',
            recallDeadline: delayedMessage.scheduledAt
          };
        }

        return {
          canRecall: true,
          recallDeadline: delayedMessage.scheduledAt
        };
      }

      // 檢查一般訊息
      const message = await this.drizzleDb
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .get();

      if (!message) {
        return { canRecall: false, reason: 'Message not found' };
      }

      if (message.isRecalled) {
        return { canRecall: false, reason: 'Message already recalled' };
      }

      if (message.recallDeadline && new Date() > new Date(message.recallDeadline)) {
        return {
          canRecall: false,
          reason: 'Recall deadline exceeded',
          recallDeadline: message.recallDeadline
        };
      }

      return {
        canRecall: true,
        recallDeadline: message.recallDeadline || undefined
      };
    } catch (error) {
      console.error('Error checking recall eligibility:', error);
      return { canRecall: false, reason: 'Error checking recall eligibility' };
    }
  }

  /**
   * 獲取訊息召回歷史
   */
  async getRecallHistory(
    filters?: {
      conversationId?: string;
      requestedBy?: string;
      status?: 'successful' | 'failed';
      dateFrom?: string;
      dateTo?: string;
    },
    limit: number = 50,
    offset: number = 0
  ): Promise<{ recalls: MessageRecall[]; total: number }> {
    try {
      const conditions = [];

      if (filters?.conversationId) {
        // conversationId should be obtained through JOIN with messages table
        // conditions.push(eq(messageRecallLogs.conversationId, filters.conversationId));
      }

      if (filters?.requestedBy) {
        conditions.push(eq(messageRecallLogs.userId, filters.requestedBy));
      }

      if (filters?.status) {
        conditions.push(eq(messageRecallLogs.action, filters.status));
      }

      if (filters?.dateFrom) {
        conditions.push(sql`${messageRecallLogs.createdAt} >= ${filters.dateFrom}`);
      }

      if (filters?.dateTo) {
        conditions.push(sql`${messageRecallLogs.createdAt} <= ${filters.dateTo}`);
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // 獲取總數
      const totalResult = await this.drizzleDb
        .select({ count: count() })
        .from(messageRecallLogs)
        .where(whereCondition)
        .get();

      const total = totalResult?.count || 0;

      // 獲取列表
      const results = await this.drizzleDb
        .select()
        .from(messageRecallLogs)
        .where(whereCondition)
        .orderBy(desc(messageRecallLogs.createdAt))
        .limit(limit)
        .offset(offset);

      const recalls: MessageRecall[] = results.map(result => ({
        id: result.id.toString(),
        messageId: result.messageId,
        conversationId: '', // Not available in current schema
        requestedBy: result.userId,
        reason: undefined, // Not available in current schema
        status: result.action as 'successful' | 'failed',
        failureReason: undefined, // Not available in current schema
        recalledAt: undefined, // Not available in current schema
        createdAt: result.createdAt,
      }));

      return { recalls, total };
    } catch (error) {
      console.error('Error getting recall history:', error);
      throw error;
    }
  }

  /**
   * 獲取召回統計
   */
  async getRecallStats(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    byReason: Record<string, number>;
    byUser: Record<string, number>;
    successRate: number;
  }> {
    try {
      const conditions = [];

      if (dateFrom) {
        conditions.push(sql`${messageRecallLogs.createdAt} >= ${dateFrom}`);
      }

      if (dateTo) {
        conditions.push(sql`${messageRecallLogs.createdAt} <= ${dateTo}`);
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // 獲取基本統計
      const stats = await this.drizzleDb
        .select({
          status: messageRecallLogs.action,
          count: count(),
        })
        .from(messageRecallLogs)
        .where(whereCondition)
        .groupBy(messageRecallLogs.action);

      let total = 0;
      let successful = 0;
      let failed = 0;

      stats.forEach(stat => {
        total += stat.count;
        if (stat.status === 'successful') {
          successful += stat.count;
        } else {
          failed += stat.count;
        }
      });

      // 獲取按原因分組的統計 (reason field not available in schema)
      const reasonStats: { reason: string | null; count: number }[] = [];
      // const reasonStats = await this.drizzleDb
      //   .select({
      //     reason: messageRecallLogs.reason,
      //     count: count(),
      //   })
      //   .from(messageRecallLogs)
      //   .where(whereCondition)
      //   .groupBy(messageRecallLogs.reason);

      const byReason: Record<string, number> = {};
      reasonStats.forEach(stat => {
        if (stat.reason) {
          byReason[stat.reason] = stat.count;
        }
      });

      // 獲取按用戶分組的統計
      const userStats = await this.drizzleDb
        .select({
          requestedBy: messageRecallLogs.userId,
          count: count(),
        })
        .from(messageRecallLogs)
        .where(whereCondition)
        .groupBy(messageRecallLogs.userId);

      const byUser: Record<string, number> = {};
      userStats.forEach(stat => {
        byUser[stat.requestedBy] = stat.count;
      });

      const successRate = total > 0 ? (successful / total) * 100 : 0;

      return {
        total,
        successful,
        failed,
        byReason,
        byUser,
        successRate: Math.round(successRate * 100) / 100, // 保留2位小數
      };
    } catch (error) {
      console.error('Error getting recall stats:', error);
      throw error;
    }
  }

  // ======================== 清理和維護 ========================

  /**
   * 清理過期的召回記錄
   */
  async cleanupExpiredRecallLogs(
    daysToKeep: number = 90
  ): Promise<{ cleaned: number }> {
    try {
      const expiredThreshold = new Date(
        Date.now() - daysToKeep * 24 * 60 * 60 * 1000
      ).toISOString();

      // 獲取要清理的記錄數量
      const expiredCount = await this.drizzleDb
        .select({ count: count() })
        .from(messageRecallLogs)
        .where(sql`${messageRecallLogs.createdAt} < ${expiredThreshold}`)
        .get();

      const toClean = expiredCount?.count || 0;

      if (toClean > 0) {
        // 刪除過期記錄
        await this.drizzleDb
          .delete(messageRecallLogs)
          .where(sql`${messageRecallLogs.createdAt} < ${expiredThreshold}`);
      }

      return { cleaned: toClean };
    } catch (error) {
      console.error('Error cleaning up expired recall logs:', error);
      throw error;
    }
  }
}