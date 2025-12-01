// Messaging Forwarding Routes
// 訊息轉發端點

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../../../db/drizzle-factory';
import type { Bindings, JWTPayload } from '../../../types';
import { messages, conversations } from '@shared/database/schema';
import { jwtAuth } from '../../../middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse
} from '../../../utils/api-response';

const forwardingRoutes = new Hono<{ Bindings: Bindings }>();

// 最大轉發對話數
const MAX_FORWARD_TARGETS = 20;

/**
 * 轉發訊息到其他對話
 * POST /api/messages/:id/forward
 */
forwardingRoutes.post('/:id/forward', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    let requestData: {
      targetConversationIds: string[];
      comment?: string;
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return badRequestResponse(c, 'Invalid JSON data');
    }

    const { targetConversationIds, comment } = requestData;

    // 驗證
    if (!targetConversationIds || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
      return badRequestResponse(c, 'Target conversation IDs array is required and must not be empty');
    }

    // 限制一次最多轉發到 N 個對話
    if (targetConversationIds.length > MAX_FORWARD_TARGETS) {
      return badRequestResponse(c, `Maximum ${MAX_FORWARD_TARGETS} conversations allowed per forward operation`);
    }

    const db = createDbClient(c.env.DB);

    // 獲取原始訊息
    const originalMessage = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        content: messages.content,
        messageType: messages.messageType,
        metadata: messages.metadata,
        senderType: messages.senderType,
        agentSenderId: messages.agentSenderId,
        customerSenderId: messages.customerSenderId
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!originalMessage) {
      return notFoundResponse(c, 'Message not found');
    }

    const results: any[] = [];
    const errors: any[] = [];

    // 轉發到每個目標對話
    for (const targetConversationId of targetConversationIds) {
      try {
        // 檢查目標對話是否存在
        const targetConversation = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, targetConversationId))
          .get();

        if (!targetConversation) {
          errors.push({
            conversationId: targetConversationId,
            error: 'Target conversation not found'
          });
          continue;
        }

        // 生成新訊息 ID
        const newMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 準備轉發的訊息內容
        let forwardedContent = `[Forwarded Message]\n${originalMessage.content}`;
        if (comment) {
          forwardedContent += `\n\n📝 Comment: ${comment}`;
        }

        // 準備元數據
        const forwardMetadata = {
          forwardedFrom: {
            messageId: originalMessage.id,
            conversationId: originalMessage.conversationId,
            originalSenderType: originalMessage.senderType
          },
          comment: comment || null,
          forwardedBy: userPayload.userId.toString(),
          forwardedAt: new Date().toISOString()
        };

        // 創建轉發的訊息
        const forwardedMessageData = {
          id: newMessageId,
          conversationId: targetConversationId,
          senderType: 'agent' as const,
          agentSenderId: userPayload.userId.toString(),
          content: forwardedContent,
          messageType: originalMessage.messageType,
          metadata: JSON.stringify(forwardMetadata),
          isSent: true,
          deliveryStatus: 'sent',
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        // 插入轉發的訊息
        await db.insert(messages).values(forwardedMessageData);

        // 更新對話的最後訊息時間
        await db
          .update(conversations)
          .set({
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .where(eq(conversations.id, targetConversationId));

        results.push({
          conversationId: targetConversationId,
          newMessageId,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          conversationId: targetConversationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return successResponse(c, {
      originalMessageId: messageId,
      totalTargets: targetConversationIds.length,
      successCount: results.length,
      failureCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    }, `Message forwarded: ${results.length} succeeded, ${errors.length} failed`, 201);

  } catch (error) {
    console.error('Forward message error:', error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to forward message', 500);
  }
});

export default forwardingRoutes;
