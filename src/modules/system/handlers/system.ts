// System Module Handlers
// 系統模組請求處理器

import { Hono } from 'hono';
import { SystemService } from '@modules/system/services/system-service';
import type {
  SystemSettingsUpdate
} from '../types/system-types';
import type { Bindings } from '../../../types';

const app = new Hono<{ Bindings: Bindings }>();

// 健康檢查端點
app.get('/health', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const health = await systemService.checkHealth();

    const status = health.status === 'healthy' ? 200 : 500;
    return c.json(health, status);
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      version: '2.0.0-modular',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 系統狀態端點（詳細狀態）
app.get('/status', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const status = await systemService.getSystemStatus();

    const httpStatus = status.overall === 'healthy' ? 200 : 500;
    return c.json(status, httpStatus);
  } catch (error) {
    console.error('System status error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system status',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 系統信息端點
app.get('/info', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const info = await systemService.getSystemInfo();

    return c.json({
      success: true,
      data: info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System info error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system info',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// API 信息端點
app.get('/api', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const apiInfo = await systemService.getApiInfo();

    return c.json(apiInfo);
  } catch (error) {
    console.error('API info error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get API info',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 統計數據端點
app.get('/stats', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const stats = await systemService.getStats();

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取系統設置
app.get('/settings', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const settings = await systemService.getSettings();

    return c.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get settings',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 更新系統設置
app.put('/settings', async (c) => {
  try {
    const body = await c.req.json() as SystemSettingsUpdate;
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const settings = await systemService.updateSettings(body);

    return c.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 測試平台整合
app.post('/integrations/:platform/test', async (c) => {
  try {
    const platform = c.req.param('platform') as 'line' | 'facebook';

    if (platform !== 'line' && platform !== 'facebook') {
      return c.json({
        success: false,
        error: 'Invalid platform. Must be "line" or "facebook"',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const result = await systemService.testIntegration(platform);

    const status = result.status === 'success' ? 200 : 500;
    return c.json({
      success: result.status === 'success',
      data: result,
      timestamp: new Date().toISOString()
    }, status);
  } catch (error) {
    console.error('Integration test error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Integration test failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取系統指標
app.get('/metrics', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const metrics = await systemService.getMetrics();

    return c.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 創建備份
app.post('/backup', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const backup = await systemService.createBackup();

    return c.json({
      success: true,
      data: backup,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backup creation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create backup',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取備份列表
app.get('/backups', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const backups = await systemService.getBackups();

    return c.json({
      success: true,
      data: backups,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get backups error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get backups',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 恢復備份
app.post('/restore/:backupId', async (c) => {
  try {
    const backupId = c.req.param('backupId');

    if (!backupId) {
      return c.json({
        success: false,
        error: 'Backup ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const result = await systemService.restoreBackup(backupId);

    return c.json({
      success: result,
      data: { backupId, restored: result },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backup restore error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore backup',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 清除緩存
app.post('/cache/clear', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const result = await systemService.clearCache();

    return c.json({
      success: result,
      data: { cleared: result },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear cache',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 重啟系統
app.post('/restart', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const result = await systemService.restartSystem();

    return c.json({
      success: result,
      data: { restarted: result },
      message: 'System restart initiated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System restart error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restart system',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取撤回統計
app.get('/messages/recall-stats', async (c) => {
  try {
    const systemService = new SystemService(c.env.DB, c.env.CACHE || c.env.KV, c.env);
    const stats = await systemService.getRecallStats();

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get recall stats error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recall statistics',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 訊息關聯查詢端點
app.get('/messages/:messageId/replies', async (c) => {
  try {
    const messageId = c.req.param('messageId');

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 動態導入數據庫工具
    const { getMessageReplies } = await import('../../../utils/database');
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
    console.error('Error getting message replies:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message replies',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 對話訊息樹狀結構端點
app.get('/conversations/:conversationId/message-tree', async (c) => {
  try {
    const conversationId = c.req.param('conversationId');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 動態導入數據庫工具
    const { getConversationMessageTree } = await import('../../../utils/database');
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
    console.error('Error getting conversation message tree:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation message tree',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 會話統計端點
app.get('/conversations/:conversationId/sessions', async (c) => {
  try {
    const conversationId = c.req.param('conversationId');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 動態導入會話分析服務
    const { AnalyticsService } = await import('../../session/services/analytics-service');
    const analyticsService = new AnalyticsService(c.env.DB);
    const stats = await analyticsService.getSessionStats(conversationId);

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting session stats:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session stats',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default app;