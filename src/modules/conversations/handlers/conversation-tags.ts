// 對話標籤管理處理器
// Handles: GET /:id/tags, POST /:id/tags, DELETE /:id/tags

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq, and, inArray } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, conversationTags, tags } from '@/db/schema';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { validationErrorResponse } from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('ConversationTagsHandler');

const conversationTagsHandler = new Hono<{ Bindings: Bindings }>();

// 獲取對話標籤
conversationTagsHandler.get('/:id/tags', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const drizzleDb = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await drizzleDb
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // 獲取對話的所有標籤
    const conversationTagsData = await drizzleDb
      .select({
        tagId: conversationTags.tagId,
        assignedBy: conversationTags.assignedBy,
        assignedAt: conversationTags.assignedAt,
        tagName: tags.name,
        tagColor: tags.color,
        tagDescription: tags.description
      })
      .from(conversationTags)
      .innerJoin(tags, eq(conversationTags.tagId, tags.id))
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          eq(tags.isActive, true)
        )
      );

    const formattedTags = conversationTagsData.map(t => ({
      id: t.tagId,
      name: t.tagName,
      color: t.tagColor,
      description: t.tagDescription,
      assignedBy: t.assignedBy,
      assignedAt: t.assignedAt
    }));

    return c.json({
      success: true,
      data: formattedTags,
      message: 'Conversation tags retrieved successfully'
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 添加對話標籤
conversationTagsHandler.post('/:id/tags', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const user = c.get('user');
    const payload = c.get('jwtPayload');
    const { tagIds } = await c.req.json();

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return validationErrorResponse(c, [
        { field: 'tagIds', message: 'Tag IDs array is required' }
      ]);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await drizzleDb
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // 構建批量插入值
    const assignedBy = payload?.userId ? String(payload.userId) : 'system';
    const parsedTagIds = tagIds.map((id: string | number) => parseInt(String(id)));
    const tagInsertValues = parsedTagIds.map(tagId => ({
      conversationId: conversationId,
      tagId: tagId,
      assignedBy: assignedBy
    }));

    // 批量插入標籤關聯
    await drizzleDb.insert(conversationTags)
      .values(tagInsertValues)
      .onConflictDoNothing();

    log.info('Conversation tags added', { conversationId, tagIds: parsedTagIds, addedBy: assignedBy });

    // WebSocket 廣播標籤變更
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_tags_updated',
        conversationId,
        userId: String(user.id),
        data: {
          operation: 'add',
          tagIds: parsedTagIds,
          updatedBy: {
            id: user.id,
            name: user.displayName
          },
          timestamp: nowISO()
        },
        priority: 'normal'
      });
    } catch (broadcastError) {
      log.warn('WebSocket: Tags update broadcast failed', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    return c.json({
      success: true,
      message: 'Tags added to conversation successfully'
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 移除對話標籤
conversationTagsHandler.delete('/:id/tags', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const user = c.get('user');
    const { tagIds } = await c.req.json();

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return validationErrorResponse(c, [
        { field: 'tagIds', message: 'Tag IDs array is required' }
      ]);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await drizzleDb
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, HTTP_STATUS.NOT_FOUND);
    }

    const parsedTagIds = tagIds.map((id: string | number) => parseInt(String(id)));

    // 刪除標籤關聯
    await drizzleDb.delete(conversationTags)
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          inArray(conversationTags.tagId, parsedTagIds)
        )
      );

    log.info('Conversation tags removed', { conversationId, tagIds: parsedTagIds, removedBy: user.id });

    // WebSocket 廣播標籤變更
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_tags_updated',
        conversationId,
        userId: String(user.id),
        data: {
          operation: 'remove',
          tagIds: parsedTagIds,
          updatedBy: {
            id: user.id,
            name: user.displayName
          },
          timestamp: nowISO()
        },
        priority: 'normal'
      });
    } catch (broadcastError) {
      log.warn('WebSocket: Tags removal broadcast failed', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    return c.json({
      success: true,
      message: 'Tags removed from conversation successfully'
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default conversationTagsHandler;
