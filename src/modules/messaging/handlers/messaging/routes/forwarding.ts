// Messaging Forwarding Routes
// 訊息轉發端點

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('MsgForwarding')

import { eq, inArray } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings, JWTPayload } from '@/types';
import { messages, conversations } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse
} from '@/utils/api-response';
import { nowISO, nowMs } from '@/utils/timestamp'
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';

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

    // Step 1: Batch-verify all target conversations exist in one SELECT
    const existingConvs = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(inArray(conversations.id, targetConversationIds))
      .all();
    const existingConvIdSet = new Set(existingConvs.map(cv => cv.id));

    // Step 2: Partition valid vs invalid targets
    const validTargetIds: string[] = [];
    for (const targetConversationId of targetConversationIds) {
      if (!existingConvIdSet.has(targetConversationId)) {
        errors.push({ conversationId: targetConversationId, error: 'Target conversation not found' });
      } else {
        validTargetIds.push(targetConversationId);
      }
    }

    if (validTargetIds.length > 0) {
      // Step 3: Prepare all forwarded message rows
      const timestamp = nowISO();
      let forwardedContent = `[Forwarded Message]\n${originalMessage.content}`;
      if (comment) {
        forwardedContent += `\n\n Comment: ${comment}`;
      }

      const messageRows = validTargetIds.map(targetConversationId => {
        const newMessageId = `msg_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`;

        const forwardMetadata = {
          forwardedFrom: {
            messageId: originalMessage.id,
            conversationId: originalMessage.conversationId,
            originalSenderType: originalMessage.senderType
          },
          comment: comment || null,
          forwardedBy: userPayload.userId.toString(),
          forwardedAt: timestamp
        };

        results.push({ conversationId: targetConversationId, newMessageId, status: 'success' });

        return {
          id: newMessageId,
          conversationId: targetConversationId,
          senderType: 'agent' as const,
          agentSenderId: userPayload.userId.toString(),
          content: forwardedContent,
          messageType: originalMessage.messageType,
          metadata: JSON.stringify(forwardMetadata),
          isSent: true,
          deliveryStatus: 'sent',
          senderName: userPayload.displayName || null,
          sentAt: timestamp,
          createdAt: timestamp
        };
      });

      // Step 4: Single batch INSERT for all forwarded messages
      await db.insert(messages).values(messageRows);

      // Step 5: Single batch UPDATE for conversation timestamps
      await db
        .update(conversations)
        .set({ lastMessageAt: timestamp, updatedAt: timestamp })
        .where(inArray(conversations.id, validTargetIds));
    }

    // Fire-and-forget activity logging
    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: userPayload.userId.toString(),
      userName: userPayload.displayName || userPayload.username || 'Unknown',
      userRole: userPayload.role,
      action: ACTIVITY_ACTIONS.MESSAGE_FORWARD,
      resourceType: RESOURCE_TYPES.MESSAGE,
      resourceId: messageId,
      details: { originalMessageId: messageId, targetCount: validTargetIds.length },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    }).catch(() => {});

    return successResponse(c, {
      originalMessageId: messageId,
      totalTargets: targetConversationIds.length,
      successCount: results.length,
      failureCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    }, `Message forwarded: ${results.length} succeeded, ${errors.length} failed`, 201);

  } catch (error) {
    log.error('Forward message error', {}, error as Error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to forward message', 500);
  }
});

export default forwardingRoutes;
