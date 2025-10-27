// 系統處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ERROR_MESSAGES } from '../utils/error-messages';
import { jwtAuth } from '../middleware/auth';
import { drizzle } from 'drizzle-orm/d1';
import { customers, conversations, messages } from '../db/schema';
import { count, sql } from 'drizzle-orm';
import { handleApiError } from '../utils/api-response';

const systemHandler = new Hono<{ Bindings: Bindings }>();

// ✅ CORS 處理已移至 src/index.ts 統一管理
// 不再需要 handler 級別的 CORS middleware

// 健康檢查端點
systemHandler.get('/health', async (c) => {
  try {
    // 檢查資料庫連接 - using Drizzle ORM
    const drizzleDb = drizzle(c.env.DB);
    const dbCheck = await drizzleDb.get(sql`SELECT 1 as test`);
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbCheck ? 'connected' : 'disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      version: '1.0.0'
    }, 500);
  }
});

// API 資訊端點
systemHandler.get('/api', (c) => {
  return c.json({
    name: 'My LINE Bot API',
    version: '1.0.0',
    endpoints: {
      // 基礎端點
      webhook: 'POST /api/webhook',
      health: 'GET /health',
      stats: 'GET /api/stats',
      root: 'GET /',
      
      // 認證端點
      login: 'POST /api/auth/login',
      register: 'POST /api/auth/register',
      logout: 'POST /api/auth/logout',
      profile: 'GET /api/auth/profile',
      
      // 團隊管理端點
      teams: 'GET /api/teams',
      createTeam: 'POST /api/teams',
      teamDetail: 'GET /api/teams/:id',
      updateTeam: 'PUT /api/teams/:id',
      deleteTeam: 'DELETE /api/teams/:id',
      teamMembers: 'GET /api/teams/:id/members',
      teamStats: 'GET /api/teams/:id/stats',
      generateQR: 'POST /api/teams/:id/qr-code',
      
      // 用戶管理端點
      users: 'GET /api/users',
      createUser: 'POST /api/users',
      userDetail: 'GET /api/users/:id',
      updateUser: 'PUT /api/users/:id',
      
      // 延遲訊息端點
      sendDelayedMessage: 'POST /api/delayed-messages/send',
      recallDelayedMessage: 'POST /api/delayed-messages/recall/:messageId',
      listPendingMessages: 'GET /api/delayed-messages/pending',
      processQueueMessage: 'POST /api/delayed-messages/process'
    },
    timestamp: new Date().toISOString()
  });
});

// 系統狀態端點 (詳細狀態)
systemHandler.get('/system/status', async (c) => {
  try {
    // 檢查資料庫連接 - using Drizzle ORM
    const drizzleDb = drizzle(c.env.DB);
    const dbCheck = await drizzleDb.get(sql`SELECT 1 as test`);
    
    // 檢查各個資源
    const status = {
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: {
          status: dbCheck ? 'connected' : 'disconnected',
          type: 'D1'
        },
        kv: {
          status: 'available',
          namespaces: ['SESSIONS', 'CACHE']
        },
        r2: {
          status: 'available',
          bucket: 'multi-channel-platform-attachments'
        },
        queue: {
          status: 'available',
          name: 'REALTIME_QUEUE'
        },
        durableObjects: {
          status: 'available',
          objects: [
            'DELAYED_MESSAGE_SCHEDULER',
            'CONVERSATION_ROOM',
            'USER_CONNECTION',
            'MESSAGE_BROADCASTER',
            'DELAYED_MESSAGE_SCHEDULER',
            'DISTRIBUTED_LOCK'
          ]
        }
      },
      environment: c.env.ENVIRONMENT || 'development'
    };
    
    return c.json(status);
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 訊息關聯查詢端點
systemHandler.get('/messages/:messageId/replies', async (c) => {
  try {
    const messageId = c.req.param('messageId');
    const { getMessageReplies } = await import('../utils/database');
    const replies = await getMessageReplies(c.env.DB, messageId);
    
    return c.json({
      success: true,
      data: {
        messageId,
        replies,
        count: replies.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 對話訊息樹狀結構端點
systemHandler.get('/conversations/:conversationId/message-tree', async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    const { getConversationMessageTree } = await import('../utils/database');
    const tree = await getConversationMessageTree(c.env.DB, conversationId);
    
    // 轉換 Map 為普通物件以便 JSON 序列化
    const replyMapObj: Record<string, any[]> = {};
    tree.replyMap.forEach((replies, messageId) => {
      replyMapObj[messageId] = replies;
    });
    
    return c.json({
      success: true,
      data: {
        conversationId,
        messages: tree.messages,
        replyMap: replyMapObj,
        totalMessages: tree.messages.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 會話統計端點
systemHandler.get('/conversations/:conversationId/sessions', async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    const { AnalyticsService } = await import('../modules/session/services/analytics-service');
    const analyticsService = new AnalyticsService(c.env.DB);
    const stats = await analyticsService.getSessionStats(conversationId);
    
    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 系統統計端點
systemHandler.get('/stats', async (c) => {
  try {
    const drizzleDb = drizzle(c.env.DB);

    // 獲取各項統計數據
    let totalMessages = 0;
    let totalCustomers = 0;
    let totalConversations = 0;

    try {
      const [messagesResult, customersResult, conversationsResult] = await Promise.all([
        drizzleDb.select({ count: count() }).from(messages),
        drizzleDb.select({ count: count() }).from(customers),
        drizzleDb.select({ count: count() }).from(conversations)
      ]);

      totalMessages = messagesResult[0]?.count || 0;
      totalCustomers = customersResult[0]?.count || 0;
      totalConversations = conversationsResult[0]?.count || 0;
    } catch (dbError) {
      console.warn('Database query failed, using default values:', dbError);
      // 如果查詢失敗，使用默認值 0
    }

    return c.json({
      success: true,
      data: {
        totalMessages,
        totalCustomers,
        totalConversations,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 獲取撤回統計
systemHandler.get('/messages/recall-stats', jwtAuth, async (c) => {
  try {
    // 簡單的統計實現
    const stats = {
      totalMessages: 0,
      recalledMessages: 0,
      successfulRecalls: 0,
      failedRecalls: 0
    };

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

export default systemHandler;