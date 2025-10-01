// Message CRUD Service
// 基礎訊息增刪改查服務

import { eq, and, desc, asc, count, like, sql, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  messages,
  conversations,
  customers,
  agents,
  messageRecallLogs
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
  DeliveryStatus
} from '../types/message-types';
import type { Bindings } from '@/types';

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
      console.error('Error finding message by ID:', error);
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
        // TODO: 實現附件、反應等關聯數據查詢
        attachments: [],
        reactions: [],
        readReceipts: []
      } as MessageWithDetails;
    } catch (error) {
      console.error('Error finding message with details:', error);
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

      const messageItems: MessageListItem[] = results.map(result => {
        const message = this.transformDbMessageToMessage(result.message);
        return {
          ...message,
          senderName: result.customerSender?.displayName ||
                     result.agentSender?.displayName ||
                     'Unknown',
          senderAvatar: result.customerSender?.avatarUrl ||
                       undefined,
          attachmentCount: 0, // TODO: 計算附件數量
          hasReactions: false, // TODO: 檢查是否有反應
          isRead: true, // TODO: 實現已讀狀態
        };
      });

      return { messages: messageItems, total };
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  /**
   * 搜尋訊息
   */
  async searchMessages(query: MessageSearchQuery): Promise<MessageSearchResult> {
    try {
      const conditions = [];

      // 對話ID篩選
      if (query.conversationId) {
        conditions.push(eq(messages.conversationId, query.conversationId));
      }

      // 內容搜尋
      if (query.content) {
        conditions.push(like(messages.content, `%${query.content}%`));
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
        .limit(query.limit || 50)
        .offset(query.offset || 0);

      const messageDetails: MessageWithDetails[] = results.map(result => {
        const message = this.transformDbMessageToMessage(result.message);
        return {
          ...message,
          senderName: result.customerSender?.displayName ||
                     result.agentSender?.displayName ||
                     'Unknown',
          senderAvatar: result.customerSender?.avatarUrl ||
                       undefined,
          attachments: [],
          reactions: [],
          readReceipts: []
        };
      });

      return {
        messages: messageDetails,
        total,
        pagination: {
          limit: query.limit || 50,
          offset: query.offset || 0,
          hasMore: (query.offset || 0) + (query.limit || 50) < total
        }
      };
    } catch (error) {
      console.error('Error searching messages:', error);
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
      const messageId = crypto.randomUUID();
      const now = new Date().toISOString();

      // 計算召回截止時間 (發送後30分鐘內可召回)
      const recallDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const newMessage = {
        id: messageId,
        conversationId: messageData.conversationId,
        senderType: messageData.senderType,
        customerSenderId: messageData.customerSenderId || null,
        agentSenderId: messageData.agentSenderId || null,
        content: messageData.content,
        messageType: messageData.messageType,
        platformMessageId: messageData.platformMessageId || null,
        isRecalled: false,
        recallDeadline,
        recalledAt: null,
        isSent: true,
        sentAt: now,
        deliveryStatus: 'sent' as DeliveryStatus,
        replyToMessageId: messageData.replyToMessageId || null,
        metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : null,
        createdAt: now,
      };

      await this.drizzleDb.insert(messages).values(newMessage);

      return this.transformDbMessageToMessage(newMessage);
    } catch (error) {
      console.error('Error creating message:', error);
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

      const updates: any = {};

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
      console.error('Error updating message:', error);
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

      const now = new Date().toISOString();

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
      console.error('Error marking message as recalled:', error);
      throw new InvalidMessageDataError('Failed to recall message', { error });
    }
  }

  // ======================== 工具方法 ========================

  /**
   * 將資料庫記錄轉換為 Message 物件
   */
  private transformDbMessageToMessage(dbMessage: any): Message {
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
      metadata: dbMessage.metadata ? JSON.parse(dbMessage.metadata) : undefined,
      createdAt: dbMessage.createdAt,
      updatedAt: dbMessage.updatedAt,
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
      console.error('Error checking recall eligibility:', error);
      return { canRecall: false, reason: 'Error checking recall eligibility' };
    }
  }
}