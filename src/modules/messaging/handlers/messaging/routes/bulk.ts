// Messaging Bulk Operations Routes
// 訊息批量操作端點

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings, JWTPayload } from '@/types';
import { messages, conversations } from '@shared/database/schema';
import { jwtAuth } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse
} from '@/utils/api-response';

const bulkRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * 批量創建訊息
 * POST /api/messages/bulk-create
 */
bulkRoutes.post('/bulk-create', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    let requestData: {
      messages: {
        conversationId: string;
        content: string;
        messageType?: string;
        metadata?: any;
      }[];
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return badRequestResponse(c, 'Invalid JSON data');
    }

    const { messages: messagesToCreate } = requestData;

    // 驗證
    if (!messagesToCreate || !Array.isArray(messagesToCreate) || messagesToCreate.length === 0) {
      return badRequestResponse(c, 'Messages array is required and must not be empty');
    }

    // 批量操作限制 (最多100條)
    if (messagesToCreate.length > 100) {
      return badRequestResponse(c, 'Bulk operation limited to 100 messages at a time');
    }

    const db = createDbClient(c.env.DB);
    const results: any[] = [];
    const errors: any[] = [];

    // 批量處理
    for (let i = 0; i < messagesToCreate.length; i++) {
      const msgData = messagesToCreate[i];

      try {
        // 基本驗證
        if (!msgData.conversationId || !msgData.content || msgData.content.trim().length === 0) {
          errors.push({
            index: i,
            conversationId: msgData.conversationId,
            error: 'Conversation ID and content are required'
          });
          continue;
        }

        // 檢查對話是否存在
        const conversation = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, msgData.conversationId))
          .get();

        if (!conversation) {
          errors.push({
            index: i,
            conversationId: msgData.conversationId,
            error: 'Conversation not found'
          });
          continue;
        }

        // 生成訊息ID
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 準備訊息數據
        const messageData = {
          id: messageId,
          conversationId: msgData.conversationId,
          senderType: 'agent' as const,
          agentSenderId: userPayload.userId.toString(),
          content: msgData.content,
          messageType: msgData.messageType || 'text',
          metadata: msgData.metadata ? JSON.stringify(msgData.metadata) : null,
          isSent: true,
          deliveryStatus: 'sent',
          senderName: userPayload.displayName || null,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        // 插入訊息
        await db.insert(messages).values(messageData);

        // 更新對話的最後訊息時間
        await db
          .update(conversations)
          .set({
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .where(eq(conversations.id, msgData.conversationId));

        results.push({
          index: i,
          id: messageId,
          conversationId: msgData.conversationId,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          index: i,
          conversationId: msgData.conversationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return successResponse(c, {
      totalRequested: messagesToCreate.length,
      successCount: results.length,
      failureCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    }, `Bulk operation completed: ${results.length} succeeded, ${errors.length} failed`, 201);

  } catch (error) {
    console.error('Bulk create messages error:', error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to bulk create messages', 500);
  }
});

/**
 * 批量刪除訊息 (批量撤回)
 * POST /api/messages/bulk-delete
 */
bulkRoutes.post('/bulk-delete', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    let requestData: { messageIds: string[] };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return badRequestResponse(c, 'Invalid JSON data');
    }

    const { messageIds } = requestData;

    // 驗證
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return badRequestResponse(c, 'Message IDs array is required and must not be empty');
    }

    // 批量操作限制 (最多100條)
    if (messageIds.length > 100) {
      return badRequestResponse(c, 'Bulk operation limited to 100 messages at a time');
    }

    const db = createDbClient(c.env.DB);
    const results: any[] = [];
    const errors: any[] = [];

    // 批量處理
    for (const messageId of messageIds) {
      try {
        // 檢查訊息是否存在以及用戶權限
        const existingMessage = await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            agentSenderId: messages.agentSenderId,
            senderType: messages.senderType,
            isRecalled: messages.isRecalled,
            recallDeadline: messages.recallDeadline
          })
          .from(messages)
          .where(eq(messages.id, messageId))
          .get();

        if (!existingMessage) {
          errors.push({ messageId, error: 'Message not found' });
          continue;
        }

        // 檢查權限：只有發送者或管理員可以撤回
        if (existingMessage.senderType === 'agent' &&
            existingMessage.agentSenderId !== userPayload.userId.toString() &&
            userPayload.role !== 'admin') {
          errors.push({ messageId, error: 'Permission denied' });
          continue;
        }

        // 檢查訊息是否已被撤回
        if (existingMessage.isRecalled) {
          errors.push({ messageId, error: 'Message already recalled' });
          continue;
        }

        // 檢查撤回時限
        if (existingMessage.recallDeadline) {
          const deadline = new Date(existingMessage.recallDeadline);
          if (new Date() > deadline) {
            errors.push({ messageId, error: 'Recall deadline has passed' });
            continue;
          }
        }

        const recalledAt = new Date().toISOString();

        // 撤回訊息 (軟刪除)
        await db
          .update(messages)
          .set({
            isRecalled: true,
            recalledAt,
            content: '[This message has been recalled]'
          })
          .where(eq(messages.id, messageId));

        results.push({
          messageId,
          conversationId: existingMessage.conversationId,
          recalledAt,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return successResponse(c, {
      totalRequested: messageIds.length,
      successCount: results.length,
      failureCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    }, `Bulk delete completed: ${results.length} succeeded, ${errors.length} failed`);

  } catch (error) {
    console.error('Bulk delete messages error:', error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to bulk delete messages', 500);
  }
});

export default bulkRoutes;
