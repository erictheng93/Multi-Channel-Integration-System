// Message CRUD Service
// 基礎訊息增刪改查服務

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, asc, count, inArray, isNull, sql } from 'drizzle-orm';
import { likeEscaped } from '@/utils/sql-like';
import {
  messages,
  conversations,
  customers,
  agents,
  messageRecallLogs,
  fileAttachments
} from '@/db/schema';
import {
  Message,
  MessageWithDetails,
  MessageListItem,
  MessageSearchQuery,
  MessageSearchResult,
  MessageNotFoundError,
  InvalidMessageDataError,
  MessageMetadata,
  SenderType,
  MessageType,
  DeliveryStatus,
  MessageAttachment,
  MessageReaction,
  MessageReadReceipt
} from '../types/message-types';
import type { ConversationVisibilityUser } from '@/services/conversation-visibility';
import { getConversationVisibilityCondition } from '@/services/conversation-visibility';
import { validateReplyToMessageId } from '@/utils/validate-reply-to';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('MessageCrud');

type MessageRow = typeof messages.$inferSelect;
type MessageUpdate = Partial<typeof messages.$inferInsert>;

export class MessageCrudService {
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(private db: D1Database) {
    this.drizzleDb = drizzle(db);
  }

  // ======================== 查詢操作 ========================

  /**
   * 根據ID查詢訊息
   */
  async findById(messageId: string): Promise<Message | null> {
    try {
      const message = await this.drizzleDb
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .get();

      if (!message) {
        return null;
      }

      return this.transformDbMessageToMessage(message);
    } catch (error) {
      log.error('Error finding message by ID:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 根據ID查詢訊息詳細資訊 (包含關聯數據)
   */
  async findByIdWithDetails(messageId: string): Promise<MessageWithDetails | null> {
    try {
      const result = await this.drizzleDb
        .select({
          // 訊息基本資訊
          message: messages,
          // 發送者資訊
          customerSender: customers,
          agentSender: agents,
        })
        .from(messages)
        .leftJoin(customers, eq(messages.customerSenderId, customers.id))
        .leftJoin(agents, eq(messages.agentSenderId, agents.id))
        .where(eq(messages.id, messageId))
        .get();

      if (!result?.message) {
        return null;
      }

      const message = this.transformDbMessageToMessage(result.message);

      return {
        ...message,
        senderName: result.customerSender?.displayName ||
                   result.agentSender?.displayName ||
                   'Unknown',
        senderAvatar: result.customerSender?.avatarUrl ||
                     undefined,
        attachments: await this.getMessageAttachments(message.id),
        reactions: this.getMessageReactions(message),
        readReceipts: this.getMessageReadReceipts(result.message)
      } as MessageWithDetails;
    } catch (error) {
      log.error('Error finding message with details:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 獲取對話訊息列表
   */
  async getConversationMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
    orderBy: 'asc' | 'desc' = 'desc'
  ): Promise<{ messages: MessageListItem[]; total: number }> {
    try {
      // 獲取總數
      const totalResult = await this.drizzleDb
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .get();

      const total = totalResult?.count || 0;

      // 獲取訊息列表
      const results = await this.drizzleDb
        .select({
          message: messages,
          customerSender: customers,
          agentSender: agents,
        })
        .from(messages)
        .leftJoin(customers, eq(messages.customerSenderId, customers.id))
        .leftJoin(agents, eq(messages.agentSenderId, agents.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(orderBy === 'desc' ? desc(messages.createdAt) : asc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      // Batch-fetch attachment counts for all messages in this page
      const attachCounts = new Map<string, number>();
      try {
        const { fileAttachments } = await import('@/db/schema');
        const messageIds = results.map(r => r.message.id);
        if (messageIds.length > 0) {
          const rows = await this.drizzleDb
            .select({ mid: fileAttachments.messageId, cnt: count() })
            .from(fileAttachments)
            .where(sql`${fileAttachments.messageId} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(fileAttachments.messageId)
            .all();
          for (const r of rows) { if (r.mid) attachCounts.set(r.mid, r.cnt); }
        }
      } catch {
        // Graceful degradation: if attachment query fails, counts default to 0
      }

      const messageItems: MessageListItem[] = results.map(result => {
        const message = this.transformDbMessageToMessage(result.message);
        return {
          ...message,
          senderName: result.customerSender?.displayName ||
                     result.agentSender?.displayName ||
                     'Unknown',
          senderAvatar: result.customerSender?.avatarUrl ||
                       undefined,
          attachmentCount: attachCounts.get(result.message.id) ?? 0,
          hasReactions: false, // Deferred: needs messageReactions table
          isRead: true, // Deferred: needs readBy column (Phase 3)
        };
      });

      return { messages: messageItems, total };
    } catch (error) {
      log.error('Error getting conversation messages:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 搜尋訊息
   */
  async searchMessages(
    query: MessageSearchQuery,
    user: ConversationVisibilityUser
  ): Promise<MessageSearchResult> {
    try {
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      // Keep access control at the service boundary, but push the visibility
      // rule into D1 instead of materialising every visible conversation ID in
      // the Worker first.
      const visibleConversations = this.drizzleDb
        .select({ id: conversations.id })
        .from(conversations)
        .where(getConversationVisibilityCondition(user));

      const conditions = [
        inArray(messages.conversationId, visibleConversations),
        isNull(messages.deletedAt)
      ];

      // 對話ID篩選
      if (query.conversationId) {
        conditions.push(eq(messages.conversationId, query.conversationId));
      }

      // 內容搜尋
      if (query.content) {
        conditions.push(likeEscaped(messages.content, query.content));
      }

      // 發送者類型篩選
      if (query.senderType) {
        conditions.push(eq(messages.senderType, query.senderType));
      }

      // 訊息類型篩選
      if (query.messageType) {
        conditions.push(eq(messages.messageType, query.messageType));
      }

      // 日期範圍篩選
      if (query.dateFrom) {
        conditions.push(sql`${messages.createdAt} >= ${query.dateFrom}`);
      }
      if (query.dateTo) {
        conditions.push(sql`${messages.createdAt} <= ${query.dateTo}`);
      }

      // 召回狀態篩選
      if (query.isRecalled !== undefined) {
        conditions.push(eq(messages.isRecalled, query.isRecalled));
      }

      // 交付狀態篩選
      if (query.deliveryStatus) {
        conditions.push(eq(messages.deliveryStatus, query.deliveryStatus));
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // 獲取總數
      const totalResult = await this.drizzleDb
        .select({ count: count() })
        .from(messages)
        .where(whereCondition)
        .get();

      const total = totalResult?.count || 0;

      // 獲取搜尋結果
      const results = await this.drizzleDb
        .select({
          message: messages,
          customerSender: customers,
          agentSender: agents,
        })
        .from(messages)
        .leftJoin(customers, eq(messages.customerSenderId, customers.id))
        .leftJoin(agents, eq(messages.agentSenderId, agents.id))
        .where(whereCondition)
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      const messageDetails: MessageWithDetails[] = await Promise.all(results.map(async result => {
        const message = this.transformDbMessageToMessage(result.message);
        return {
          ...message,
          senderName: result.customerSender?.displayName ||
                     result.agentSender?.displayName ||
                     'Unknown',
          senderAvatar: result.customerSender?.avatarUrl ||
                       undefined,
          attachments: await this.getMessageAttachments(message.id),
          reactions: this.getMessageReactions(message),
          readReceipts: this.getMessageReadReceipts(result.message)
        };
      }));

      return {
        messages: messageDetails,
        total,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      log.error('Error searching messages:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // ======================== 寫入操作 ========================

  /**
   * 創建新訊息
   */
  async create(messageData: {
    conversationId: string;
    senderType: SenderType;
    customerSenderId?: number;
    agentSenderId?: string;
    content: string;
    messageType: MessageType;
    platformMessageId?: string;
    replyToMessageId?: string;
    metadata?: MessageMetadata;
  }): Promise<Message> {
    try {
      // Validate replyToMessageId exists (app-level FK enforcement)
      if (messageData.replyToMessageId) {
        const replyValidation = await validateReplyToMessageId(
          this.db,
          messageData.replyToMessageId,
          messageData.conversationId
        );
        if (!replyValidation.valid) {
          throw new InvalidMessageDataError(
            replyValidation.error || 'Invalid replyToMessageId'
          );
        }
      }

      const messageId = crypto.randomUUID();
      const now = nowISO();

      // 計算召回截止時間 (發送後30分鐘內可召回)
      const recallDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const newMessage: MessageRow = {
        id: messageId,
        conversationId: messageData.conversationId,
        senderType: messageData.senderType,
        customerSenderId: messageData.customerSenderId || (null as number | null),
        agentSenderId: messageData.agentSenderId || (null as string | null),
        content: messageData.content,
        messageType: messageData.messageType,
        platformMessageId: messageData.platformMessageId || (null as string | null),
        isRecalled: false,
        recallDeadline,
        recalledAt: null as string | null,
        isSent: true,
        sentAt: now,
        deliveryStatus: 'sent' as DeliveryStatus,
        replyToMessageId: messageData.replyToMessageId || (null as string | null),
        threadId: null,
        sessionId: null,
        sessionSequence: 1,
        metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : (null as string | null),
        senderName: null,
        readBy: null,
        createdAt: now,
        updatedAt: null,
        deletedAt: null
      };

      await this.drizzleDb.insert(messages).values(newMessage);

      return this.transformDbMessageToMessage(newMessage);
    } catch (error) {
      log.error('Error creating message:', {}, error instanceof Error ? error : new Error(String(error)));
      throw new InvalidMessageDataError('Failed to create message', { error });
    }
  }

  /**
   * 更新訊息
   */
  async update(
    messageId: string,
    updateData: {
      content?: string;
      deliveryStatus?: DeliveryStatus;
      metadata?: MessageMetadata;
    }
  ): Promise<Message> {
    try {
      const existingMessage = await this.findById(messageId);
      if (!existingMessage) {
        throw new MessageNotFoundError(messageId);
      }

      const updates: MessageUpdate = {};

      if (updateData.content !== undefined) {
        updates.content = updateData.content;
      }

      if (updateData.deliveryStatus !== undefined) {
        updates.deliveryStatus = updateData.deliveryStatus;
      }

      if (updateData.metadata !== undefined) {
        updates.metadata = JSON.stringify(updateData.metadata);
      }

      await this.drizzleDb
        .update(messages)
        .set(updates)
        .where(eq(messages.id, messageId));

      const updatedMessage = await this.findById(messageId);
      if (!updatedMessage) {
        throw new MessageNotFoundError(messageId);
      }

      return updatedMessage;
    } catch (error) {
      if (error instanceof MessageNotFoundError) {
        throw error;
      }
      log.error('Error updating message:', {}, error instanceof Error ? error : new Error(String(error)));
      throw new InvalidMessageDataError('Failed to update message', { error });
    }
  }

  /**
   * 標記訊息為已召回
   */
  async markAsRecalled(messageId: string, recallReason?: string): Promise<Message> {
    try {
      const existingMessage = await this.findById(messageId);
      if (!existingMessage) {
        throw new MessageNotFoundError(messageId);
      }

      const now = nowISO();

      await this.drizzleDb
        .update(messages)
        .set({
          isRecalled: true,
          recalledAt: now,
        })
        .where(eq(messages.id, messageId));

      // 記錄召回日誌
      await this.drizzleDb.insert(messageRecallLogs).values({
        messageId,
        userId: existingMessage.agentSenderId || 'system',
        action: `recalled: ${recallReason || 'Manual recall'}`,
        createdAt: now,
      });

      const updatedMessage = await this.findById(messageId);
      if (!updatedMessage) {
        throw new MessageNotFoundError(messageId);
      }

      return updatedMessage;
    } catch (error) {
      if (error instanceof MessageNotFoundError) {
        throw error;
      }
      log.error('Error marking message as recalled:', {}, error instanceof Error ? error : new Error(String(error)));
      throw new InvalidMessageDataError('Failed to recall message', { error });
    }
  }

  // ======================== 工具方法 ========================

  private async getMessageAttachments(messageId: string): Promise<MessageAttachment[]> {
    try {
      const rows = await this.drizzleDb
        .select({
          attachmentId: fileAttachments.id,
          messageId: fileAttachments.messageId,
          filename: fileAttachments.filename,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          fileUrl: fileAttachments.fileUrl,
          uploadedBy: fileAttachments.uploadedBy,
          createdAt: fileAttachments.createdAt
        })
        .from(fileAttachments)
        .where(eq(fileAttachments.messageId, messageId))
        .all();

      return rows
        .filter((row): row is {
          attachmentId: string;
          messageId: string;
          filename: string;
          mimeType: string;
          fileSize: number;
          fileUrl: string | null;
          uploadedBy: string | null;
          createdAt: string | null;
        } => typeof row.filename === 'string' && typeof row.fileSize === 'number')
        .map(row => ({
          id: row.attachmentId,
          messageId: row.messageId,
          filename: row.filename,
          originalFilename: row.filename,
          mimeType: row.mimeType,
          size: row.fileSize,
          url: row.fileUrl || '',
          uploadedAt: row.createdAt || nowISO(),
          uploadedBy: row.uploadedBy || ''
        }));
    } catch (error) {
      log.warn('Failed to load message attachments', { messageId, error });
      return [];
    }
  }

  private getMessageReactions(message: Message): MessageReaction[] {
    const metadata = message.metadata as (MessageMetadata & { reactions?: unknown }) | undefined;
    if (!Array.isArray(metadata?.reactions)) {
      return [];
    }

    return metadata.reactions.flatMap((reaction, index) => {
      if (!reaction || typeof reaction !== 'object') {
        return [];
      }

      const data = reaction as Record<string, unknown>;
      const userId = typeof data.userId === 'string' ? data.userId : '';
      const value = typeof data.reaction === 'string' ? data.reaction : '';
      if (!userId || !value) {
        return [];
      }

      return [{
        id: typeof data.id === 'string' ? data.id : `${message.id}:reaction:${index}`,
        messageId: message.id,
        userId,
        reaction: value,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : message.createdAt
      }];
    });
  }

  private getMessageReadReceipts(dbMessage: MessageRow & { readBy?: string | null }): MessageReadReceipt[] {
    if (!dbMessage.readBy) {
      return [];
    }

    try {
      const parsed = JSON.parse(dbMessage.readBy) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.flatMap((entry, index) => {
        if (typeof entry === 'string') {
          return [{
            id: `${dbMessage.id}:${entry}`,
            messageId: dbMessage.id,
            userId: entry,
            readAt: dbMessage.updatedAt || dbMessage.createdAt || nowISO()
          }];
        }

        if (!entry || typeof entry !== 'object') {
          return [];
        }

        const data = entry as Record<string, unknown>;
        const userId = typeof data.userId === 'string' ? data.userId : '';
        if (!userId) {
          return [];
        }

        return [{
          id: typeof data.id === 'string' ? data.id : `${dbMessage.id}:${userId || index}`,
          messageId: dbMessage.id,
          userId,
          readAt: typeof data.readAt === 'string' ? data.readAt : dbMessage.updatedAt || dbMessage.createdAt || nowISO()
        }];
      });
    } catch {
      return [];
    }
  }

  /**
   * 將資料庫記錄轉換為 Message 物件
   */
  private transformDbMessageToMessage(dbMessage: MessageRow): Message {
    return {
      id: dbMessage.id,
      conversationId: dbMessage.conversationId,
      senderType: dbMessage.senderType as SenderType,
      customerSenderId: dbMessage.customerSenderId,
      agentSenderId: dbMessage.agentSenderId,
      content: dbMessage.content,
      messageType: dbMessage.messageType as MessageType,
      platformMessageId: dbMessage.platformMessageId,
      isRecalled: Boolean(dbMessage.isRecalled),
      recallDeadline: dbMessage.recallDeadline,
      recalledAt: dbMessage.recalledAt,
      isSent: Boolean(dbMessage.isSent),
      sentAt: dbMessage.sentAt,
      deliveryStatus: dbMessage.deliveryStatus as DeliveryStatus,
      replyToMessageId: dbMessage.replyToMessageId,
      metadata: dbMessage.metadata ? JSON.parse(dbMessage.metadata) as MessageMetadata : undefined,
      createdAt: dbMessage.createdAt || nowISO(),
      updatedAt: dbMessage.updatedAt || dbMessage.createdAt || nowISO(),
    };
  }

  /**
   * 檢查訊息是否可召回
   */
  async canRecallMessage(messageId: string): Promise<{ canRecall: boolean; reason?: string }> {
    try {
      const message = await this.findById(messageId);
      if (!message) {
        return { canRecall: false, reason: 'Message not found' };
      }

      if (message.isRecalled) {
        return { canRecall: false, reason: 'Message already recalled' };
      }

      if (message.recallDeadline && new Date() > new Date(message.recallDeadline)) {
        return { canRecall: false, reason: 'Recall deadline exceeded' };
      }

      return { canRecall: true };
    } catch (error) {
      log.error('Error checking recall eligibility:', {}, error instanceof Error ? error : new Error(String(error)));
      return { canRecall: false, reason: 'Error checking recall eligibility' };
    }
  }
}
