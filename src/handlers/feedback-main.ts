// Customer Feedback Management Handler
// 客户满意度反馈管理

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { customerFeedback, conversations, customers, agents } from '@/db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { jwtAuth } from '@/middleware/auth';

const feedbackHandler = new Hono<{ Bindings: Bindings }>();

// 提交客户反馈
feedbackHandler.post('/', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const body = await c.req.json();

    // 验证必填字段
    if (!body.conversationId || !body.customerId || !body.rating) {
      return c.json({
        success: false,
        error: 'Missing required fields: conversationId, customerId, rating'
      }, 400);
    }

    // 验证评分范围
    if (body.rating < 1 || body.rating > 5) {
      return c.json({
        success: false,
        error: 'Rating must be between 1 and 5'
      }, 400);
    }

    // 验证对话是否存在
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, body.conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, 404);
    }

    // 创建反馈记录
    const feedbackId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Note: Individual assignment (assignedUserId) removed - agentId must be provided explicitly
    await db.insert(customerFeedback).values({
      id: feedbackId,
      conversationId: body.conversationId,
      customerId: body.customerId,
      agentId: body.agentId || null,
      rating: body.rating,
      comment: body.comment || null,
      feedbackType: body.feedbackType || 'satisfaction',
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`📝 [FeedbackHandler] Created feedback ${feedbackId} for conversation ${body.conversationId}`);

    return c.json({
      success: true,
      data: {
        id: feedbackId,
        conversationId: body.conversationId,
        rating: body.rating,
        createdAt: now
      }
    });

  } catch (error) {
    console.error('❌ [FeedbackHandler] Failed to create feedback:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create feedback'
    }, 500);
  }
});

// 获取满意度统计
feedbackHandler.get('/stats', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const timeRange = c.req.query('timeRange') || '30d'; // '24h', '7d', '30d', 'all'

    // 计算时间范围
    let timeFilter = null;
    const now = new Date();

    if (timeRange === '24h') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      timeFilter = gte(customerFeedback.createdAt, yesterday.toISOString());
    } else if (timeRange === '7d') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      timeFilter = gte(customerFeedback.createdAt, weekAgo.toISOString());
    } else if (timeRange === '30d') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      timeFilter = gte(customerFeedback.createdAt, monthAgo.toISOString());
    }

    // 查询所有反馈统计
    const statsQuery = db
      .select({
        totalCount: sql<number>`COUNT(*)`.as('total_count'),
        averageRating: sql<number>`AVG(CAST(rating AS REAL))`.as('average_rating'),
        rating1Count: sql<number>`SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)`.as('rating1_count'),
        rating2Count: sql<number>`SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)`.as('rating2_count'),
        rating3Count: sql<number>`SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)`.as('rating3_count'),
        rating4Count: sql<number>`SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)`.as('rating4_count'),
        rating5Count: sql<number>`SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)`.as('rating5_count'),
      })
      .from(customerFeedback);

    if (timeFilter) {
      statsQuery.where(timeFilter);
    }

    const stats = await statsQuery.get();

    if (!stats || stats.totalCount === 0) {
      return c.json({
        success: true,
        data: {
          satisfactionRate: 0,
          totalFeedback: 0,
          averageRating: 0,
          ratingDistribution: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
          },
          timeRange
        }
      });
    }

    // 计算满意度比率 (4分和5分的比例)
    const satisfiedCount = (stats.rating4Count || 0) + (stats.rating5Count || 0);
    const satisfactionRate = Math.round((satisfiedCount / stats.totalCount) * 100);

    console.log(`📊 [FeedbackHandler] Stats retrieved: ${satisfactionRate}% satisfaction rate (${stats.totalCount} feedback)`);

    return c.json({
      success: true,
      data: {
        satisfactionRate,
        totalFeedback: stats.totalCount,
        averageRating: Math.round((stats.averageRating || 0) * 10) / 10, // Round to 1 decimal
        ratingDistribution: {
          1: stats.rating1Count || 0,
          2: stats.rating2Count || 0,
          3: stats.rating3Count || 0,
          4: stats.rating4Count || 0,
          5: stats.rating5Count || 0
        },
        timeRange,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [FeedbackHandler] Failed to get feedback stats:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get feedback stats'
    }, 500);
  }
});

// 获取特定对话的反馈
feedbackHandler.get('/conversation/:conversationId', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const conversationId = c.req.param('conversationId');

    const feedback = await db
      .select({
        id: customerFeedback.id,
        conversationId: customerFeedback.conversationId,
        customerId: customerFeedback.customerId,
        customerName: customers.displayName,
        agentId: customerFeedback.agentId,
        agentName: agents.displayName,
        rating: customerFeedback.rating,
        comment: customerFeedback.comment,
        feedbackType: customerFeedback.feedbackType,
        createdAt: customerFeedback.createdAt,
      })
      .from(customerFeedback)
      .innerJoin(customers, eq(customerFeedback.customerId, customers.id))
      .leftJoin(agents, eq(customerFeedback.agentId, agents.id))
      .where(eq(customerFeedback.conversationId, conversationId))
      .orderBy(desc(customerFeedback.createdAt))
      .all();

    return c.json({
      success: true,
      data: {
        conversationId,
        feedback,
        count: feedback.length
      }
    });

  } catch (error) {
    console.error('❌ [FeedbackHandler] Failed to get conversation feedback:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation feedback'
    }, 500);
  }
});

// 获取反馈列表（带分页）
feedbackHandler.get('/', jwtAuth, async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const feedbackList = await db
      .select({
        id: customerFeedback.id,
        conversationId: customerFeedback.conversationId,
        customerId: customerFeedback.customerId,
        customerName: customers.displayName,
        agentId: customerFeedback.agentId,
        agentName: agents.displayName,
        rating: customerFeedback.rating,
        comment: customerFeedback.comment,
        feedbackType: customerFeedback.feedbackType,
        createdAt: customerFeedback.createdAt,
      })
      .from(customerFeedback)
      .innerJoin(customers, eq(customerFeedback.customerId, customers.id))
      .leftJoin(agents, eq(customerFeedback.agentId, agents.id))
      .orderBy(desc(customerFeedback.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    // 获取总数
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(customerFeedback)
      .get();

    const total = totalResult?.count || 0;

    return c.json({
      success: true,
      data: {
        feedback: feedbackList,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('❌ [FeedbackHandler] Failed to get feedback list:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get feedback list'
    }, 500);
  }
});

export { feedbackHandler };
