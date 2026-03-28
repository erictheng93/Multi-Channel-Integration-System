// Messaging Search Routes
// 訊息搜尋、統計、標籤端點

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('MsgSearch')

import { HTTP_STATUS } from '@/constants/http-status';
import { eq, count } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings } from '@/types';
import { messages } from '@/db/schema';
import type { MessageSearchQuery } from '@modules/messaging/types/message-types';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import { jwtAuth } from '@/middleware/auth';
import { nowISO } from '@/utils/timestamp'

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
    const messageCrudService = new MessageCrudService(c.env.DB);
    const searchResult = await messageCrudService.searchMessages(searchQuery);

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
    const db = createDbClient(c.env.DB);

    // 從訊息元數據中提取所有唯一的標籤
    const messagesWithTags = await db
      .select({
        metadata: messages.metadata
      })
      .from(messages)
      .where(eq(messages.isRecalled, false));

    // 提取並統計所有標籤
    const tagStats: Record<string, number> = {};

    for (const msg of messagesWithTags) {
      if (msg.metadata) {
        try {
          const metadata = JSON.parse(msg.metadata);
          if (metadata.tags && Array.isArray(metadata.tags)) {
            for (const tag of metadata.tags) {
              tagStats[tag] = (tagStats[tag] || 0) + 1;
            }
          }
        } catch (e) {
          // 忽略解析錯誤
        }
      }
    }

    // 轉換為數組並排序
    const tagList = Object.entries(tagStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

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
