// Session 主要處理器
// Main session request handlers with comprehensive CRUD operations

import { Hono } from 'hono';
import type { Bindings } from '../../../types';
import { SessionService } from '@modules/session/services/session-service';

// 中間件導入
import {
  checkSessionAccess,
  checkSessionViewPermission,
  checkSessionCreatePermission,
  checkSessionUpdatePermission,
  checkSessionDeletePermission,
  checkSessionStatsPermission,
  checkSessionBatchPermission,
  validateRequestSize,
  validateRateLimit,
  validateSessionId,
  validateConversationId,
  validateCreateSessionData,
  validateUpdateSessionData,
  validateSessionListQuery,
  validateSessionSearchQuery,
  validateBatchSessionOperation,
  logSessionOperation
} from '../middleware/index';

// 創建會話路由實例
const sessionHandler = new Hono<{ Bindings: Bindings }>();

// ======================== 健康檢查和資訊端點 ========================

/**
 * 健康檢查端點
 * GET /api/sessions/health
 */
sessionHandler.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      module: 'session',
      version: '2.0.0'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * 模組資訊端點
 * GET /api/sessions/info
 */
sessionHandler.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'session',
      version: '2.0.0',
      description: 'Conversation session management module with intelligent boundary detection',
      features: [
        'Session lifecycle management (create, update, close, reopen)',
        'Intelligent session boundary detection',
        'Message association and sequencing',
        'Session statistics and analytics',
        'Activity tracking and reporting',
        'Batch operations support',
        'Topic extraction and sentiment analysis',
        'Search and filtering capabilities',
        'Real-time session monitoring',
        'Session health diagnostics'
      ],
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'POST / - Create new session',
        'GET / - List sessions with filtering',
        'GET /search - Search sessions',
        'GET /:sessionId - Get session details',
        'PUT /:sessionId - Update session',
        'DELETE /:sessionId - Delete session',
        'POST /:sessionId/close - Close session',
        'POST /:sessionId/reopen - Reopen session',
        'GET /:sessionId/messages - Get session messages',
        'GET /stats - Session statistics',
        'GET /stats/:conversation_id - Conversation session stats',
        'GET /activity - Activity statistics',
        'POST /batch - Batch operations',
        'GET /:sessionId/health - Session health check'
      ],
      permissions: {
        admin: 'Full session management access',
        team: 'Team-scoped session management and statistics',
        agent: 'Access to assigned conversations sessions'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ======================== CRUD 操作 ========================

/**
 * 創建新會話
 * POST /api/sessions
 */
sessionHandler.post(
  '/',
  validateRequestSize,
  validateCreateSessionData,
  validateRateLimit,
  checkSessionAccess,
  checkSessionCreatePermission,
  logSessionOperation,
  async (c) => {
    try {
      const createData = c.get('createSessionData');
      const sessionService = new SessionService(c.env.DB);

      const session = await sessionService.create(createData);

      return c.json({
        success: true,
        data: session,
        message: 'Session created successfully',
        timestamp: new Date().toISOString()
      }, 201);
    } catch (error) {
      console.error('Create session error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

/**
 * 獲取會話列表
 * GET /api/sessions
 */
sessionHandler.get(
  '/',
  validateSessionListQuery,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const query = c.get('sessionQuery');
      const sessionService = new SessionService(c.env.DB);

      const result = await sessionService.list(query);

      return c.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('List sessions error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list sessions',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

/**
 * 搜尋會話
 * GET /api/sessions/search
 */
sessionHandler.get(
  '/search',
  validateSessionSearchQuery,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const searchQuery = c.get('sessionSearchQuery');
      const sessionService = new SessionService(c.env.DB);

      const sessions = await sessionService.search(searchQuery as any);

      return c.json({
        success: true,
        data: sessions,
        count: sessions.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Search sessions error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search sessions',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

// ======================== 統計和分析 ========================

/**
 * 獲取會話統計
 * GET /api/sessions/stats
 */
sessionHandler.get(
  '/stats',
  checkSessionAccess,
  checkSessionStatsPermission,
  async (c) => {
    try {
      const conversation_id = c.req.query('conversation_id');
      const sessionService = new SessionService(c.env.DB);

      const stats = await sessionService.getStats(conversation_id);

      return c.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get session stats error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session statistics',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

/**
 * 獲取特定對話的會話統計
 * GET /api/sessions/stats/:conversation_id
 */
sessionHandler.get(
  '/stats/:conversation_id',
  validateConversationId,
  checkSessionAccess,
  checkSessionStatsPermission,
  async (c) => {
    try {
      const conversation_id = c.req.param('conversation_id');
      const sessionService = new SessionService(c.env.DB);

      const stats = await sessionService.getStats(conversation_id);

      return c.json({
        success: true,
        data: stats,
        conversation_id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get conversation session stats error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversation session statistics',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

/**
 * 獲取活動統計
 * GET /api/sessions/activity
 */
sessionHandler.get(
  '/activity',
  checkSessionAccess,
  checkSessionStatsPermission,
  async (c) => {
    try {
      const conversation_id = c.req.query('conversation_id');
      const timeRange = c.req.query('timeRange') as 'day' | 'week' | 'month' | 'year' || 'week';

      if (!['day', 'week', 'month', 'year'].includes(timeRange)) {
        return c.json({
          success: false,
          error: 'timeRange must be one of: day, week, month, year',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const sessionService = new SessionService(c.env.DB);
      const activityStats = await sessionService.getActivityStats({
        conversation_id,
        timeRange
      });

      return c.json({
        success: true,
        data: activityStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get activity stats error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get activity statistics',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

// ======================== CRUD 操作（續） ========================

/**
 * 獲取單個會話詳情
 * GET /api/sessions/:sessionId
 */
sessionHandler.get(
  '/:sessionId',
  validateSessionId,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const sessionService = new SessionService(c.env.DB);

      const session = await sessionService.get(sessionId);

      if (!session) {
        return c.json({
          success: false,
          error: 'Session not found',
          timestamp: new Date().toISOString()
        }, 404);
      }

      return c.json({
        success: true,
        data: session,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get session error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

/**
 * 更新會話
 * PUT /api/sessions/:sessionId
 */
sessionHandler.put(
  '/:sessionId',
  validateRequestSize,
  validateSessionId,
  validateUpdateSessionData,
  validateRateLimit,
  checkSessionAccess,
  checkSessionUpdatePermission,
  logSessionOperation,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const updateData = c.get('updateSessionData');
      const sessionService = new SessionService(c.env.DB);

      const session = await sessionService.update(sessionId, updateData);

      return c.json({
        success: true,
        data: session,
        message: 'Session updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update session error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update session',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

/**
 * 刪除會話
 * DELETE /api/sessions/:sessionId
 */
sessionHandler.delete(
  '/:sessionId',
  validateSessionId,
  validateRateLimit,
  checkSessionAccess,
  checkSessionDeletePermission,
  logSessionOperation,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const sessionService = new SessionService(c.env.DB);

      const success = await sessionService.delete(sessionId);

      if (!success) {
        return c.json({
          success: false,
          error: 'Session not found or could not be deleted',
          timestamp: new Date().toISOString()
        }, 404);
      }

      return c.json({
        success: true,
        data: { deleted: true, sessionId },
        message: 'Session deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete session error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete session',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

// ======================== 會話管理操作 ========================

/**
 * 關閉會話
 * POST /api/sessions/:sessionId/close
 */
sessionHandler.post(
  '/:sessionId/close',
  validateSessionId,
  validateRateLimit,
  checkSessionAccess,
  checkSessionUpdatePermission,
  logSessionOperation,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const sessionService = new SessionService(c.env.DB);

      const success = await sessionService.closeSession(sessionId);

      if (!success) {
        return c.json({
          success: false,
          error: 'Session not found or could not be closed',
          timestamp: new Date().toISOString()
        }, 404);
      }

      return c.json({
        success: true,
        data: { closed: true, sessionId },
        message: 'Session closed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Close session error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close session',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

/**
 * 重新開啟會話
 * POST /api/sessions/:sessionId/reopen
 */
sessionHandler.post(
  '/:sessionId/reopen',
  validateSessionId,
  validateRateLimit,
  checkSessionAccess,
  checkSessionUpdatePermission,
  logSessionOperation,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const sessionService = new SessionService(c.env.DB);

      const success = await sessionService.reopenSession(sessionId);

      if (!success) {
        return c.json({
          success: false,
          error: 'Session not found or could not be reopened',
          timestamp: new Date().toISOString()
        }, 404);
      }

      return c.json({
        success: true,
        data: { reopened: true, sessionId },
        message: 'Session reopened successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Reopen session error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reopen session',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

// ======================== 訊息相關操作 ========================

/**
 * 獲取會話訊息
 * GET /api/sessions/:sessionId/messages
 */
sessionHandler.get(
  '/:sessionId/messages',
  validateSessionId,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');

      const sessionService = new SessionService(c.env.DB);
      const result = await sessionService.getMessages(sessionId, page, pageSize);

      return c.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get session messages error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session messages',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);


// ======================== 批量操作 ========================

/**
 * 執行批量會話操作
 * POST /api/sessions/batch
 */
sessionHandler.post(
  '/batch',
  validateRequestSize,
  validateBatchSessionOperation,
  validateRateLimit,
  checkSessionAccess,
  checkSessionBatchPermission,
  logSessionOperation,
  async (c) => {
    try {
      const batchOperation = c.get('batchOperation');
      const sessionService = new SessionService(c.env.DB);

      const result = await sessionService.batchOperation(batchOperation as any);

      return c.json({
        success: true,
        data: result,
        message: `Batch operation ${batchOperation.action} completed`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Batch operation error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute batch operation',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

// ======================== 會話健康檢查 ========================

/**
 * 檢查會話健康狀態
 * GET /api/sessions/:sessionId/health
 */
sessionHandler.get(
  '/:sessionId/health',
  validateSessionId,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const sessionService = new SessionService(c.env.DB);

      const healthReport = await sessionService.analyzeSessionHealth(sessionId);

      return c.json({
        success: true,
        data: healthReport,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Session health check error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze session health',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
);

// ======================== 錯誤處理 ========================

// 全域錯誤處理
sessionHandler.onError((err, c) => {
  console.error('Session handler error:', err);
  return c.json({
    success: false,
    error: 'Internal server error in session module',
    timestamp: new Date().toISOString()
  }, 500);
});

// 404 處理
sessionHandler.notFound((c) => {
  return c.json({
    success: false,
    error: 'Session endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /info',
      'POST /',
      'GET /',
      'GET /search',
      'GET /:sessionId',
      'PUT /:sessionId',
      'DELETE /:sessionId',
      'POST /:sessionId/close',
      'POST /:sessionId/reopen',
      'GET /:sessionId/messages',
      'GET /stats',
      'GET /stats/:conversation_id',
      'GET /activity',
      'POST /batch',
      'GET /:sessionId/health'
    ],
    timestamp: new Date().toISOString()
  }, 404);
});

export default sessionHandler;