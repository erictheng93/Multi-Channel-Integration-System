// Conversation Handlers
// 對話處理器

import { Context } from 'hono';
import { createDbClient } from '../../../db/drizzle-factory';
import { eq, desc, and, count } from 'drizzle-orm';
import { conversations, messages, customers } from '@/db/schema';
import type { Bindings } from '@/types';
import type {
  ConversationListResponse,
  ConversationWithDetails,
  ConversationAssignRequest,
  MessageSendRequest,
  ConversationStatusUpdateRequest
} from '../types/conversation-types';
import { successResponse, errorResponse, validationErrorResponse } from '@shared/utils/api-response';

export const conversationHandler = {
  // 獲取對話列表
  list: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const db = createDbClient(c.env.DB);
      const user = c.get('user');

      // 解析查詢參數
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const status = c.req.query('status');
      const teamId = c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined;

      const offset = (page - 1) * limit;

      // 建立查詢條件
      let whereConditions = [];
      if (status) {
        whereConditions.push(eq(conversations.status, status));
      }
      if (teamId && user.role !== 'admin') {
        whereConditions.push(eq(conversations.assignedTeamId, teamId));
      }

      // 查詢對話列表
      const conversationList = await db
        .select({
          conversation: conversations,
          customer: customers,
          messageCount: count(messages.id),
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .leftJoin(messages, eq(conversations.id, messages.conversationId))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .groupBy(conversations.id)
        .orderBy(desc(conversations.updatedAt))
        .limit(limit)
        .offset(offset);

      // 獲取總數
      const totalResult = await db
        .select({ total: count() })
        .from(conversations)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

      const total = totalResult[0]?.total ?? 0;

      const response: ConversationListResponse = {
        conversations: conversationList
          .filter(row => row.customer !== null) // 過濾掉 customer 為 null 的記錄
          .map(row => ({
            ...row.conversation,
            customer: row.customer || undefined,
            messageCount: row.messageCount
          })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

      return successResponse(c, response);
    } catch (error) {
      console.error('Get conversations error:', error);
      return errorResponse(c, 'Failed to get conversations', 500);
    }
  },

  // 獲取單個對話詳情
  get: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const db = createDbClient(c.env.DB);

      const [conversation] = await db
        .select({
          conversation: conversations,
          customer: customers
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (!conversation) {
        return errorResponse(c, 'Conversation not found', 404);
      }

      // 獲取最新訊息
      const latestMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(50);

      const response: ConversationWithDetails = {
        ...conversation.conversation,
        customer: conversation.customer ? conversation.customer : undefined,
        latestMessage: latestMessages[0] ? latestMessages[0] : undefined
      };

      return successResponse(c, response);
    } catch (error) {
      console.error('Get conversation error:', error);
      return errorResponse(c, 'Failed to get conversation', 500);
    }
  },

  // 指派對話
  assign: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const assignData: ConversationAssignRequest = await c.req.json();
      const db = createDbClient(c.env.DB);

      if (!assignData.teamId && !assignData.userId) {
        return validationErrorResponse(c, [
          { field: 'assignment', message: 'Either teamId or userId must be provided' }
        ]);
      }

      // 更新對話指派
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (assignData.teamId) {
        updateData.teamId = assignData.teamId;
      }
      if (assignData.userId) {
        updateData.assignedTo = assignData.userId;
      }

      await db
        .update(conversations)
        .set(updateData)
        .where(eq(conversations.id, conversationId));

      return successResponse(c, {
        success: true,
        conversationId,
        assignedTo: {
          type: assignData.teamId ? 'team' : 'user',
          id: assignData.teamId || assignData.userId!,
          name: 'Assigned successfully'
        }
      });
    } catch (error) {
      console.error('Assign conversation error:', error);
      return errorResponse(c, 'Failed to assign conversation', 500);
    }
  },

  // 發送訊息
  sendMessage: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const messageData: MessageSendRequest = await c.req.json();
      const user = c.get('user');
      const db = createDbClient(c.env.DB);

      if (!messageData.content) {
        return validationErrorResponse(c, [
          { field: 'content', message: 'Message content is required' }
        ]);
      }

      // 創建新訊息
      const newMessage = {
        id: crypto.randomUUID(),
        conversationId,
        content: messageData.content,
        messageType: messageData.messageType || 'text',
        senderType: 'agent' as const,
        agentSenderId: typeof user.id === 'string' ? user.id : user.id.toString(),
        customerSenderId: null,
        metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : null,
        createdAt: new Date().toISOString()
      };

      await db.insert(messages).values(newMessage);

      // 更新對話的最後活動時間
      await db
        .update(conversations)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(conversations.id, conversationId));

      return successResponse(c, {
        message: newMessage,
        delivered: true
      });
    } catch (error) {
      console.error('Send message error:', error);
      return errorResponse(c, 'Failed to send message', 500);
    }
  },

  // 更新對話狀態
  updateStatus: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const statusData: ConversationStatusUpdateRequest = await c.req.json();
      const db = createDbClient(c.env.DB);

      await db
        .update(conversations)
        .set({
          status: statusData.status,
          updatedAt: new Date().toISOString()
        })
        .where(eq(conversations.id, conversationId));

      const [updatedConversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      return successResponse(c, updatedConversation);
    } catch (error) {
      console.error('Update conversation status error:', error);
      return errorResponse(c, 'Failed to update conversation status', 500);
    }
  }
};