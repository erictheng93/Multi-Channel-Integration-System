// Messaging Tags Routes
// 訊息標籤端點

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../../../db/drizzle-factory';
import type { Bindings, JWTPayload } from '../../../types';
import { messages } from '@shared/database/schema';
import { jwtAuth } from '../../../middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse
} from '../../../utils/api-response';

const tagsRoutes = new Hono<{ Bindings: Bindings }>();

// 最大標籤數量
const MAX_TAGS_PER_MESSAGE = 10;

/**
 * 為訊息添加/更新標籤
 * PUT /api/messages/:id/tags
 */
tagsRoutes.put('/:id/tags', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    let requestData: {
      tags: string[];
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return badRequestResponse(c, 'Invalid JSON data');
    }

    const { tags: tagNames } = requestData;

    // 驗證
    if (!tagNames || !Array.isArray(tagNames)) {
      return badRequestResponse(c, 'Tags array is required');
    }

    // 限制標籤數量
    if (tagNames.length > MAX_TAGS_PER_MESSAGE) {
      return badRequestResponse(c, `Maximum ${MAX_TAGS_PER_MESSAGE} tags allowed per message`);
    }

    // 驗證標籤格式 (非空字符串)
    const validTags = tagNames.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
    if (validTags.length !== tagNames.length) {
      return badRequestResponse(c, 'All tags must be non-empty strings');
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在
    const message = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        metadata: messages.metadata
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!message) {
      return notFoundResponse(c, 'Message not found');
    }

    // 解析現有的元數據
    let existingMetadata: Record<string, any> = {};
    if (message.metadata) {
      try {
        existingMetadata = JSON.parse(message.metadata);
      } catch (e) {
        existingMetadata = {};
      }
    }

    // 記錄舊標籤以便追蹤變更
    const oldTags = existingMetadata.tags || [];

    // 更新標籤
    existingMetadata.tags = validTags.map(tag => tag.trim());
    existingMetadata.tagsUpdatedAt = new Date().toISOString();
    existingMetadata.tagsUpdatedBy = userPayload.userId.toString();

    // 更新訊息
    await db
      .update(messages)
      .set({
        metadata: JSON.stringify(existingMetadata)
      })
      .where(eq(messages.id, messageId));

    return successResponse(c, {
      messageId,
      conversationId: message.conversationId,
      tags: existingMetadata.tags,
      previousTags: oldTags,
      updatedAt: existingMetadata.tagsUpdatedAt,
      updatedBy: userPayload.userId.toString()
    }, 'Message tags updated successfully');

  } catch (error) {
    console.error('Update message tags error:', error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to update message tags', 500);
  }
});

/**
 * 移除訊息的所有標籤
 * DELETE /api/messages/:id/tags
 */
tagsRoutes.delete('/:id/tags', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在
    const message = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        metadata: messages.metadata
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!message) {
      return notFoundResponse(c, 'Message not found');
    }

    // 解析現有的元數據
    let existingMetadata: Record<string, any> = {};
    if (message.metadata) {
      try {
        existingMetadata = JSON.parse(message.metadata);
      } catch (e) {
        existingMetadata = {};
      }
    }

    // 記錄舊標籤
    const oldTags = existingMetadata.tags || [];

    // 移除標籤
    delete existingMetadata.tags;
    existingMetadata.tagsRemovedAt = new Date().toISOString();
    existingMetadata.tagsRemovedBy = userPayload.userId.toString();

    // 更新訊息
    await db
      .update(messages)
      .set({
        metadata: JSON.stringify(existingMetadata)
      })
      .where(eq(messages.id, messageId));

    return successResponse(c, {
      messageId,
      conversationId: message.conversationId,
      removedTags: oldTags,
      removedAt: existingMetadata.tagsRemovedAt
    }, 'Message tags removed successfully');

  } catch (error) {
    console.error('Remove message tags error:', error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to remove message tags', 500);
  }
});

export default tagsRoutes;
