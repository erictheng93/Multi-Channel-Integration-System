// Messaging Bulk Operations Routes
// 訊息批量操作端點

import { Hono } from 'hono';
import { inArray } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings, JWTPayload } from '@/types';
import { messages, conversations } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse
} from '@/utils/api-response';
import { nowISO, nowMs } from '@/utils/timestamp'

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

    // Step 1: Validate input fields upfront
    const validatedMessages: { index: number; conversationId: string; content: string; messageType: string; metadata: string | null }[] = [];
    for (let i = 0; i < messagesToCreate.length; i++) {
      const msgData = messagesToCreate[i];
      if (!msgData.conversationId || !msgData.content || msgData.content.trim().length === 0) {
        errors.push({
          index: i,
          conversationId: msgData.conversationId,
          error: 'Conversation ID and content are required'
        });
      } else {
        validatedMessages.push({
          index: i,
          conversationId: msgData.conversationId,
          content: msgData.content,
          messageType: msgData.messageType || 'text',
          metadata: msgData.metadata ? JSON.stringify(msgData.metadata) : null
        });
      }
    }

    if (validatedMessages.length > 0) {
      // Step 2: Batch-query all referenced conversations in one SELECT
      const uniqueConvIds = [...new Set(validatedMessages.map(m => m.conversationId))];
      const existingConvs = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(inArray(conversations.id, uniqueConvIds))
        .all();
      const existingConvIdSet = new Set(existingConvs.map(c => c.id));

      // Step 3: Partition into valid (conversation exists) and invalid
      const insertableMessages: typeof validatedMessages = [];
      for (const msg of validatedMessages) {
        if (!existingConvIdSet.has(msg.conversationId)) {
          errors.push({ index: msg.index, conversationId: msg.conversationId, error: 'Conversation not found' });
        } else {
          insertableMessages.push(msg);
        }
      }

      if (insertableMessages.length > 0) {
        // Step 4: Prepare all message rows and batch INSERT
        const timestamp = nowISO();
        const messageRows = insertableMessages.map(msg => {
          const messageId = `msg_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`;
          results.push({ index: msg.index, id: messageId, conversationId: msg.conversationId, status: 'success' });
          return {
            id: messageId,
            conversationId: msg.conversationId,
            senderType: 'agent' as const,
            agentSenderId: userPayload.userId.toString(),
            content: msg.content,
            messageType: msg.messageType,
            metadata: msg.metadata,
            isSent: true,
            deliveryStatus: 'sent',
            senderName: userPayload.displayName || null,
            sentAt: timestamp,
            createdAt: timestamp
          };
        });

        await db.insert(messages).values(messageRows);

        // Step 5: Batch-update conversation timestamps for all affected conversations
        const affectedConvIds = [...new Set(insertableMessages.map(m => m.conversationId))];
        await db
          .update(conversations)
          .set({ lastMessageAt: timestamp, updatedAt: timestamp })
          .where(inArray(conversations.id, affectedConvIds));
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

    // Step 1: Batch-fetch all messages in one SELECT
    const existingMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        agentSenderId: messages.agentSenderId,
        senderType: messages.senderType,
        isRecalled: messages.isRecalled,
        recallDeadline: messages.recallDeadline
      })
      .from(messages)
      .where(inArray(messages.id, messageIds))
      .all();

    const messageMap = new Map(existingMessages.map(m => [m.id, m]));

    // Step 2: Validate each message in application code
    const recallableIds: string[] = [];
    const recalledAt = nowISO();

    for (const messageId of messageIds) {
      const existing = messageMap.get(messageId);

      if (!existing) {
        errors.push({ messageId, error: 'Message not found' });
        continue;
      }

      if (existing.senderType === 'agent' &&
          existing.agentSenderId !== userPayload.userId.toString() &&
          userPayload.role !== 'admin') {
        errors.push({ messageId, error: 'Permission denied' });
        continue;
      }

      if (existing.isRecalled) {
        errors.push({ messageId, error: 'Message already recalled' });
        continue;
      }

      if (existing.recallDeadline) {
        const deadline = new Date(existing.recallDeadline);
        if (new Date() > deadline) {
          errors.push({ messageId, error: 'Recall deadline has passed' });
          continue;
        }
      }

      recallableIds.push(messageId);
      results.push({
        messageId,
        conversationId: existing.conversationId,
        recalledAt,
        status: 'success'
      });
    }

    // Step 3: Single batch UPDATE for all recallable messages
    if (recallableIds.length > 0) {
      await db
        .update(messages)
        .set({
          isRecalled: true,
          recalledAt,
          content: '[This message has been recalled]'
        })
        .where(inArray(messages.id, recallableIds));
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
