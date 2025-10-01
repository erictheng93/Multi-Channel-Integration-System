// Session 模組 - 會話管理處理器
// 整合 SessionService, TopicService, 和 AnalyticsService

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { SessionService } from '@modules/session/services/session-service';
import { TopicService } from '@modules/session/services/topic-service';
import { AnalyticsService } from '@modules/session/services/analytics-service';
import {
  DEFAULT_PAGINATION,
  SessionNotFoundError,
  SessionValidationError,
  SessionOperationError,
  type SessionListQuery,
  type SessionSearchQuery,
  type CreateSessionData,
  type UpdateSessionData,
  type BatchSessionOperation
} from '../types/session-types';
import { createContextLogger } from '@/utils/logger';

const sessionHandler = new Hono<{ Bindings: Bindings }>();
const logger = createContextLogger('SessionHandler');

// ==================== Session CRUD Operations ====================

/**
 * 創建新會話
 * POST /api/sessions
 */
sessionHandler.post('/', jwtAuth, async (c) => {
  try {
    const createData: CreateSessionData = await c.req.json();

    // 驗證必要欄位
    if (!createData.conversation_id || !createData.messageContent || !createData.senderType) {
      return c.json({
        success: false,
        error: 'Missing required fields: conversation_id, messageContent, senderType'
      }, 400);
    }

    const sessionService = new SessionService(c.env.DB);
    const session = await sessionService.create(createData);

    logger.info('Session created', { sessionId: session.id, conversation_id: session.conversation_id });

    return c.json({
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to create session', { error });

    if (error instanceof SessionValidationError) {
      return c.json({
        success: false,
        error: error.message,
        field: error.field
      }, 400);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session'
    }, 500);
  }
});

/**
 * 獲取會話詳情
 * GET /api/sessions/:sessionId
 */
sessionHandler.get('/:sessionId', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionService = new SessionService(c.env.DB);
    const session = await sessionService.get(sessionId);

    if (!session) {
      return c.json({
        success: false,
        error: `Session not found: ${sessionId}`
      }, 404);
    }

    return c.json({
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get session', { sessionId: c.req.param('sessionId'), error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session'
    }, 500);
  }
});

/**
 * 更新會話
 * PUT /api/sessions/:sessionId
 */
sessionHandler.put('/:sessionId', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const updateData: UpdateSessionData = await c.req.json();

    const sessionService = new SessionService(c.env.DB);
    const session = await sessionService.update(sessionId, updateData);

    logger.info('Session updated', { sessionId });

    return c.json({
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to update session', { sessionId: c.req.param('sessionId'), error });

    if (error instanceof SessionNotFoundError) {
      return c.json({
        success: false,
        error: error.message
      }, 404);
    }

    if (error instanceof SessionValidationError) {
      return c.json({
        success: false,
        error: error.message,
        field: error.field
      }, 400);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update session'
    }, 500);
  }
});

/**
 * 刪除會話
 * DELETE /api/sessions/:sessionId
 */
sessionHandler.delete('/:sessionId', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionService = new SessionService(c.env.DB);
    const deleted = await sessionService.delete(sessionId);

    if (!deleted) {
      return c.json({
        success: false,
        error: `Session not found: ${sessionId}`
      }, 404);
    }

    logger.info('Session deleted', { sessionId });

    return c.json({
      success: true,
      message: 'Session deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to delete session', { sessionId: c.req.param('sessionId'), error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete session'
    }, 500);
  }
});

// ==================== Session List and Search ====================

/**
 * 獲取會話列表
 * GET /api/sessions
 */
sessionHandler.get('/', jwtAuth, async (c) => {
  try {
    const query: SessionListQuery = {
      conversation_id: c.req.query('conversation_id'),
      isActive: c.req.query('isActive') === 'true' ? true : c.req.query('isActive') === 'false' ? false : undefined,
      sessionType: c.req.query('sessionType') as any,
      priority: c.req.query('priority') as any,
      sentiment: c.req.query('sentiment') as any,
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      topic: c.req.query('topic'),
      tag: c.req.query('tag'),
      page: parseInt(c.req.query('page') || '1'),
      pageSize: Math.min(parseInt(c.req.query('pageSize') || String(DEFAULT_PAGINATION.pageSize)), DEFAULT_PAGINATION.maxPageSize)
    };

    const sessionService = new SessionService(c.env.DB);
    const result = await sessionService.list(query);

    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to list sessions', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list sessions'
    }, 500);
  }
});

/**
 * 搜尋會話
 * GET /api/sessions/search
 */
sessionHandler.get('/search', jwtAuth, async (c) => {
  try {
    const searchQuery: SessionSearchQuery = {
      query: c.req.query('q') || '',
      conversation_id: c.req.query('conversation_id'),
      sessionType: c.req.query('sessionType') as any,
      limit: parseInt(c.req.query('limit') || '20')
    };

    if (!searchQuery.query.trim()) {
      return c.json({
        success: false,
        error: 'Search query is required'
      }, 400);
    }

    const sessionService = new SessionService(c.env.DB);
    const sessions = await sessionService.search(searchQuery);

    return c.json({
      success: true,
      data: sessions,
      count: sessions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to search sessions', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search sessions'
    }, 500);
  }
});

// ==================== Session Management ====================

/**
 * 獲取或創建會話 (智能會話邊界檢測)
 * POST /api/sessions/get-or-create
 */
sessionHandler.post('/get-or-create', jwtAuth, async (c) => {
  try {
    const { conversation_id, messageContent, senderType } = await c.req.json();

    if (!conversation_id || !messageContent || !senderType) {
      return c.json({
        success: false,
        error: 'Missing required fields: conversation_id, messageContent, senderType'
      }, 400);
    }

    const sessionService = new SessionService(c.env.DB);
    const session = await sessionService.getOrCreate(conversation_id, messageContent, senderType);

    return c.json({
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get or create session', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get or create session'
    }, 500);
  }
});

/**
 * 關閉會話
 * POST /api/sessions/:sessionId/close
 */
sessionHandler.post('/:sessionId/close', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionService = new SessionService(c.env.DB);
    const closed = await sessionService.closeSession(sessionId);

    if (!closed) {
      return c.json({
        success: false,
        error: `Session not found: ${sessionId}`
      }, 404);
    }

    logger.info('Session closed', { sessionId });

    return c.json({
      success: true,
      message: 'Session closed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to close session', { sessionId: c.req.param('sessionId'), error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to close session'
    }, 500);
  }
});

/**
 * 重新開啟會話
 * POST /api/sessions/:sessionId/reopen
 */
sessionHandler.post('/:sessionId/reopen', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionService = new SessionService(c.env.DB);
    const reopened = await sessionService.reopenSession(sessionId);

    if (!reopened) {
      return c.json({
        success: false,
        error: `Session not found: ${sessionId}`
      }, 404);
    }

    logger.info('Session reopened', { sessionId });

    return c.json({
      success: true,
      message: 'Session reopened successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to reopen session', { sessionId: c.req.param('sessionId'), error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reopen session'
    }, 500);
  }
});

// ==================== Session Messages ====================

/**
 * 獲取會話訊息
 * GET /api/sessions/:sessionId/messages
 */
sessionHandler.get('/:sessionId/messages', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || String(DEFAULT_PAGINATION.pageSize)), DEFAULT_PAGINATION.maxPageSize);

    const sessionService = new SessionService(c.env.DB);
    const result = await sessionService.getMessages(sessionId, page, pageSize);

    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get session messages', { sessionId: c.req.param('sessionId'), error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session messages'
    }, 500);
  }
});

// ==================== Session Statistics and Analytics ====================

/**
 * 獲取會話統計
 * GET /api/sessions/stats
 */
sessionHandler.get('/stats', jwtAuth, async (c) => {
  try {
    const conversation_id = c.req.query('conversation_id');
    const analyticsService = new AnalyticsService(c.env.DB);
    const stats = await analyticsService.getSessionStats(conversation_id);

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get session stats', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session stats'
    }, 500);
  }
});

/**
 * 獲取會話活動統計
 * GET /api/sessions/activity-stats
 */
sessionHandler.get('/activity-stats', jwtAuth, async (c) => {
  try {
    const conversation_id = c.req.query('conversation_id');
    const timeRange = (c.req.query('timeRange') || 'week') as 'day' | 'week' | 'month' | 'year';

    const analyticsService = new AnalyticsService(c.env.DB);
    const activityStats = await analyticsService.getActivityStats({
      conversationId: conversation_id,
      timeRange
    });

    return c.json({
      success: true,
      data: activityStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get activity stats', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get activity stats'
    }, 500);
  }
});

/**
 * 分析會話健康狀況
 * GET /api/sessions/:sessionId/health
 */
sessionHandler.get('/:sessionId/health', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const analyticsService = new AnalyticsService(c.env.DB);
    const healthAnalysis = await analyticsService.analyzeSessionHealth(sessionId);

    return c.json({
      success: true,
      data: healthAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to analyze session health', { sessionId: c.req.param('sessionId'), error });

    if (error instanceof SessionNotFoundError) {
      return c.json({
        success: false,
        error: error.message
      }, 404);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze session health'
    }, 500);
  }
});

// ==================== Topic Management ====================

/**
 * 獲取主題統計
 * GET /api/sessions/topics/stats
 */
sessionHandler.get('/topics/stats', jwtAuth, async (c) => {
  try {
    const conversation_id = c.req.query('conversation_id');
    const topicService = new TopicService(c.env.DB);
    const topicStats = await topicService.getTopicStatistics(conversation_id);

    return c.json({
      success: true,
      data: topicStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get topic stats', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get topic stats'
    }, 500);
  }
});

/**
 * 分析訊息主題
 * POST /api/sessions/topics/analyze
 */
sessionHandler.post('/topics/analyze', jwtAuth, async (c) => {
  try {
    const { messageContent } = await c.req.json();

    if (!messageContent) {
      return c.json({
        success: false,
        error: 'Message content is required'
      }, 400);
    }

    const topicService = new TopicService(c.env.DB);
    const topicResult = await topicService.extractTopic(messageContent);

    return c.json({
      success: true,
      data: topicResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to analyze topic', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze topic'
    }, 500);
  }
});

/**
 * 獲取主題建議
 * POST /api/sessions/topics/suggest
 */
sessionHandler.post('/topics/suggest', jwtAuth, async (c) => {
  try {
    const { messageContent, limit } = await c.req.json();

    if (!messageContent) {
      return c.json({
        success: false,
        error: 'Message content is required'
      }, 400);
    }

    const topicService = new TopicService(c.env.DB);
    const suggestions = await topicService.suggestTopics(messageContent, limit || 3);

    return c.json({
      success: true,
      data: suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to suggest topics', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to suggest topics'
    }, 500);
  }
});

/**
 * 更新會話主題
 * PUT /api/sessions/:sessionId/topic
 */
sessionHandler.put('/:sessionId/topic', jwtAuth, async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const { topic } = await c.req.json();

    const topicService = new TopicService(c.env.DB);
    const updated = await topicService.updateSessionTopic(sessionId, topic);

    if (!updated) {
      return c.json({
        success: false,
        error: `Session not found: ${sessionId}`
      }, 404);
    }

    logger.info('Session topic updated', { sessionId, topic });

    return c.json({
      success: true,
      message: 'Session topic updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to update session topic', { sessionId: c.req.param('sessionId'), error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update session topic'
    }, 500);
  }
});

// ==================== Batch Operations ====================

/**
 * 批量會話操作
 * POST /api/sessions/batch
 */
sessionHandler.post('/batch', jwtAuth, async (c) => {
  try {
    const operation: BatchSessionOperation = await c.req.json();

    if (!operation.sessionIds || operation.sessionIds.length === 0) {
      return c.json({
        success: false,
        error: 'Session IDs are required'
      }, 400);
    }

    const sessionService = new SessionService(c.env.DB);
    const result = await sessionService.batchOperation(operation);

    logger.info('Batch operation completed', {
      action: operation.action,
      totalRequested: result.totalRequested,
      successCount: result.successCount
    });

    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to execute batch operation', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute batch operation'
    }, 500);
  }
});

// ==================== Session Boundary Detection ====================

/**
 * 檢測會話邊界
 * POST /api/sessions/detect-boundary
 */
sessionHandler.post('/detect-boundary', jwtAuth, async (c) => {
  try {
    const { currentSessionId, messageContent, senderType } = await c.req.json();

    if (!messageContent || !senderType) {
      return c.json({
        success: false,
        error: 'Message content and sender type are required'
      }, 400);
    }

    const sessionService = new SessionService(c.env.DB);
    const currentSession = currentSessionId ? await sessionService.get(currentSessionId) : null;
    const boundaryDetection = await sessionService.detectSessionBoundary(currentSession, messageContent, senderType);

    return c.json({
      success: true,
      data: boundaryDetection,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to detect session boundary', { error });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect session boundary'
    }, 500);
  }
});

export default sessionHandler;