// Messaging Search Routes
// 訊息搜尋、統計、標籤端點

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('MsgSearch')

import { HTTP_STATUS } from '@/constants/http-status';
import { count } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings } from '@/types';
import { messages } from '@/db/schema';
import type { MessageSearchQuery } from '@modules/messaging/types/message-types';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import { jwtAuth } from '@/middleware/auth';
import { PermissionService } from '@/services/permission-service';
import { nowISO } from '@/utils/timestamp'

interface MessageTagCountRow {
  name: string;
  count: number;
}

export const MESSAGE_TAG_STATS_SQL = `
  SELECT
    CAST(tag.value AS TEXT) AS name,
    COUNT(*) AS count
  FROM messages AS message
  JOIN json_each(
    CASE
      WHEN json_valid(message.metadata) THEN
        CASE
          WHEN json_type(message.metadata, '$.tags') = 'array'
          THEN json_extract(message.metadata, '$.tags')
          ELSE '[]'
        END
      ELSE '[]'
    END
  ) AS tag
  WHERE message.is_recalled = 0
    AND message.conversation_id IN (
      SELECT value FROM json_each(?)
    )
    AND tag.type = 'text'
  GROUP BY tag.value
  ORDER BY count DESC, name ASC
`;

const searchRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * 搜尋訊息
 * GET /api/messages/search
 */
searchRoutes.get('/search', jwtAuth, async (c) => {
  try {
    const query = c.req.query('q') || '';
    const conversationId = c.req.query('conversationId');
    const messageType = c.req.query('messageType') as 'text' | 'image' | 'file' | 'sticker' | undefined;
    const senderType = c.req.query('senderType') as 'customer' | 'agent' | undefined;
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const isRecalled = c.req.query('isRecalled') === 'true' ? true : c.req.query('isRecalled') === 'false' ? false : undefined;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // 構建搜尋條件
    const searchQuery: MessageSearchQuery = {
      limit,
      offset
    };

    if (query) {
      searchQuery.content = query;
    }
    if (conversationId) {
      searchQuery.conversationId = conversationId;
    }
    if (messageType) {
      searchQuery.messageType = messageType;
    }
    if (senderType) {
      searchQuery.senderType = senderType;
    }
    if (dateFrom) {
      searchQuery.dateFrom = dateFrom;
    }
    if (dateTo) {
      searchQuery.dateTo = dateTo;
    }
    if (isRecalled !== undefined) {
      searchQuery.isRecalled = isRecalled;
    }

    // 使用 MessageCrudService 進行搜尋
    const user = c.get('user');
    const visibleConversationIds = await PermissionService.getVisibleConversations(
      user.id,
      c.env.DB
    );

    const messageCrudService = new MessageCrudService(c.env.DB);
    const searchResult = await messageCrudService.searchMessages(
      searchQuery,
      visibleConversationIds
    );

    return c.json({
      success: true,
      data: searchResult,
      query: searchQuery,
      timestamp: nowISO()
    });

  } catch (error) {
    log.error('Search messages error', {}, error as Error);
    return c.json({
      success: false,
      error: 'Failed to search messages',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 獲取訊息統計
 * GET /api/messages/stats
 */
searchRoutes.get('/stats', jwtAuth, async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    // 簡化版本：只提供基本統計
    const basicStats = await db
      .select({
        total: count(),
      })
      .from(messages)
      .get();

    const totalMessages = basicStats?.total || 0;

    return c.json({
      success: true,
      data: {
        overview: {
          totalMessages,
          todayMessages: 0,
          activeConversations: 0,
          averagePerDay: Math.round(totalMessages / 30),
          recalledMessages: 0
        },
        breakdown: {
          byMessageType: {},
          bySenderType: {}
        },
        scope: 'global',
        note: 'Simplified version. Basic message count only.',
        generatedAt: nowISO()
      },
      timestamp: nowISO()
    });

  } catch (error) {
    log.error('Get message statistics error', {}, error as Error);
    return c.json({
      success: false,
      error: 'Failed to get message statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 獲取所有可用標籤
 * GET /api/messages/tags
 */
searchRoutes.get('/tags', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const visibleConversationIds = await PermissionService.getVisibleConversations(
      user.id,
      c.env.DB
    );

    if (visibleConversationIds.length === 0) {
      return c.json({
        success: true,
        data: {
          tags: [],
          total: 0
        },
        timestamp: nowISO()
      });
    }

    // Aggregate inside D1 so the Worker never loads every message metadata
    // value into memory. Invalid JSON and non-array tags retain the previous
    // behavior of being ignored.
    const tagRows = await c.env.DB.prepare(MESSAGE_TAG_STATS_SQL)
      .bind(JSON.stringify(visibleConversationIds))
      .all<MessageTagCountRow>();

    const tagList = (tagRows.results || []).map(row => ({
      name: row.name,
      count: Number(row.count)
    }));

    return c.json({
      success: true,
      data: {
        tags: tagList,
        total: tagList.length
      },
      timestamp: nowISO()
    });

  } catch (error) {
    log.error('Get message tags error', {}, error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message tags',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default searchRoutes;
