// Session 主要處理器
// Main session request handlers with comprehensive CRUD operations

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('SessionMain')

import type { Bindings } from '@/types';
import { SessionService } from '@modules/session/services/session-service';
import { TopicService } from '@modules/session/services/topic-service';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';

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
import { nowISO } from '@/utils/timestamp'

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
    timestamp: nowISO()
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
    timestamp: nowISO()
  });
});

// ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
// Routes MUST be registered in this order to avoid conflicts:
// 1. STATIC: /health, /info
// 2. SPECIFIC: /batch, /search, /stats, /activity
// 3. SPECIFIC PARAMETERIZED: /stats/:conversation_id
// 4. MULTI-SEGMENT: /:sessionId/close, /:sessionId/reopen, /:sessionId/messages, /:sessionId/health
// 5. SINGLE PARAMETERIZED: /:sessionId (GET/PUT/DELETE)
// 6. WILDCARD: / (POST/GET) - MUST BE LAST!

// ==================== Priority 2: SPECIFIC routes ====================

/**
 * 執行批量會話操作
 * POST /api/sessions/batch
 */
sessionHandler.post(
  '/batch',
  validateRequestSize,
  checkSessionAccess,
  validateRateLimit,
  validateBatchSessionOperation,
  checkSessionBatchPermission,
  logSessionOperation,
  async (c) => {
    try {
      const batchOperation = c.get('batchOperation');
      const payload = c.get('jwtPayload');
      const sessionService = new SessionService(c.env.DB);

      const result = await sessionService.batchOperation(batchOperation as any, payload?.userId?.toString());

      return c.json({
        success: true,
        data: result,
        message: `Batch operation ${batchOperation.action} completed`,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
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
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

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
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
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
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const sessionService = new SessionService(c.env.DB);
      const activityStats = await sessionService.getActivityStats({
        conversationId: conversation_id,
        timeRange
      });

      return c.json({
        success: true,
        data: activityStats,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 獲取主題統計
 * GET /api/sessions/topics/stats
 */
sessionHandler.get(
  '/topics/stats',
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const conversation_id = c.req.query('conversation_id');
      const topicService = new TopicService(c.env.DB);
      const topicStats = await topicService.getTopicStatistics(conversation_id);

      return c.json({
        success: true,
        data: topicStats,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 分析訊息主題
 * POST /api/sessions/topics/analyze
 */
sessionHandler.post(
  '/topics/analyze',
  validateRequestSize,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const { messageContent } = await c.req.json();

      if (!messageContent) {
        return c.json({
          success: false,
          error: 'Message content is required',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const topicService = new TopicService(c.env.DB);
      const topicResult = await topicService.extractTopic(messageContent);

      return c.json({
        success: true,
        data: topicResult,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 獲取主題建議
 * POST /api/sessions/topics/suggest
 */
sessionHandler.post(
  '/topics/suggest',
  validateRequestSize,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const { messageContent, limit } = await c.req.json();

      if (!messageContent) {
        return c.json({
          success: false,
          error: 'Message content is required',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const topicService = new TopicService(c.env.DB);
      const suggestions = await topicService.suggestTopics(messageContent, limit || 3);

      return c.json({
        success: true,
        data: suggestions,
        count: suggestions.length,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 獲取或創建會話 (智能會話邊界檢測)
 * POST /api/sessions/get-or-create
 */
sessionHandler.post(
  '/get-or-create',
  validateRequestSize,
  checkSessionAccess,
  validateRateLimit,
  checkSessionCreatePermission,
  logSessionOperation,
  async (c) => {
    try {
      const { conversation_id, messageContent, senderType } = await c.req.json();

      if (!conversation_id || !messageContent || !senderType) {
        return c.json({
          success: false,
          error: 'Missing required fields: conversation_id, messageContent, senderType',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const sessionService = new SessionService(c.env.DB);
      const session = await sessionService.getOrCreate(conversation_id, messageContent, senderType);

      return c.json({
        success: true,
        data: session,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 檢測會話邊界
 * POST /api/sessions/detect-boundary
 */
sessionHandler.post(
  '/detect-boundary',
  validateRequestSize,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const { currentSessionId, messageContent, senderType } = await c.req.json();

      if (!messageContent || !senderType) {
        return c.json({
          success: false,
          error: 'Message content and sender type are required',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const sessionService = new SessionService(c.env.DB);
      const currentSession = currentSessionId ? await sessionService.get(currentSessionId) : null;
      const boundaryDetection = await sessionService.detectSessionBoundary(currentSession, messageContent, senderType);

      return c.json({
        success: true,
        data: boundaryDetection,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ==================== Priority 3: SPECIFIC PARAMETERIZED routes ====================

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
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ==================== Priority 4: MULTI-SEGMENT routes (/:sessionId/xxx) ====================

/**
 * 關閉會話
 * POST /api/sessions/:sessionId/close
 */
sessionHandler.post(
  '/:sessionId/close',
  validateSessionId,
  checkSessionAccess,
  validateRateLimit,
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
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: { closed: true, sessionId },
        message: 'Session closed successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
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
  checkSessionAccess,
  validateRateLimit,
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
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: { reopened: true, sessionId },
        message: 'Session reopened successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

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
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

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
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 更新會話主題
 * PUT /api/sessions/:sessionId/topic
 */
sessionHandler.put(
  '/:sessionId/topic',
  validateSessionId,
  validateRequestSize,
  checkSessionAccess,
  checkSessionUpdatePermission,
  logSessionOperation,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const { topic } = await c.req.json();

      const topicService = new TopicService(c.env.DB);
      const updated = await topicService.updateSessionTopic(sessionId, topic);

      if (!updated) {
        return c.json({
          success: false,
          error: 'Session not found',
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        message: 'Session topic updated successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ==================== Priority 5: SINGLE PARAMETERIZED routes ====================

/**
 * 獲取單個會話詳情
 * GET /api/sessions/:sessionId
 * P2-2 UPDATED: Added service-level permission checking
 */
sessionHandler.get(
  '/:sessionId',
  validateSessionId,
  checkSessionAccess,
  checkSessionViewPermission,
  async (c) => {
    try {
      const sessionId = c.get('sessionId');
      const jwtPayload = c.get('jwtPayload');
      const sessionService = new SessionService(c.env.DB);

      // P2-2: Pass user context for permission checking at service level
      const userId = jwtPayload?.userId?.toString() || '';
      const userRole = (jwtPayload?.role as 'admin' | 'agent') || 'agent';

      const session = await sessionService.get(sessionId, userId, userRole);

      if (!session) {
        return c.json({
          success: false,
          error: 'Session not found or access denied',
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: session,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
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
  checkSessionAccess,
  validateRateLimit,
  validateUpdateSessionData,
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
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
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
  checkSessionAccess,
  validateRateLimit,
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
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: { deleted: true, sessionId },
        message: 'Session deleted successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ==================== Priority 6: WILDCARD routes (MUST BE LAST!) ====================

/**
 * 創建新會話
 * POST /api/sessions
 */
sessionHandler.post(
  '/',
  validateRequestSize,
  checkSessionAccess,
  validateRateLimit,
  validateCreateSessionData,
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
        timestamp: nowISO()
      }, HTTP_STATUS.CREATED);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
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
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ==================== Error Handlers ====================

// 全域錯誤處理
sessionHandler.onError((err, c) => {
  log.error('Session handler error', {}, err as Error);
  return c.json({
    success: false,
    error: 'Internal server error in session module',
    timestamp: nowISO()
  }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
    timestamp: nowISO()
  }, HTTP_STATUS.NOT_FOUND);
});

export default sessionHandler;
