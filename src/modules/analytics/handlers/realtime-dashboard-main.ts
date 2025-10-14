// Real-time Dashboard API Handler - 實時儀表板 API 處理器
// 提供 SSE 和 WebSocket 支持的實時數據推送 API 端點

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { RealtimeDashboardService } from '@modules/analytics/services/realtime-dashboard-service';
import { DashboardService } from '@modules/analytics/services/dashboard-service';
import { analyticsAuthMiddleware } from '@modules/analytics/middleware/analytics-auth';
import type { Bindings } from '@/types';
import { getSSECorsHeaders } from '@/config/cors';

// Analytics User interface based on middleware
interface AnalyticsUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'team' | 'agent';
  teamId?: string;
  teamName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
import { AnalyticsError } from '@modules/analytics/types/analytics-types';

// 驗證 schema
const subscriptionSchema = z.object({
  dashboardId: z.string(),
  widgets: z.array(z.string()).optional().default([]),
  updateInterval: z.number().min(1000).max(300000).optional().default(5000)
});

const broadcastSchema = z.object({
  dashboardId: z.string(),
  widgetId: z.string().optional(),
  type: z.enum(['widget_update', 'config_change']),
  data: z.any()
});

const createRealtimeDashboardApp = (
  realtimeService: RealtimeDashboardService,
  dashboardService: DashboardService
) => {
  const app = new Hono<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>();

  // ✅ CORS 處理已移至 src/index.ts 統一管理
  // 不再需要模組級別的 CORS middleware
  // SSE 端點會自動繼承全局 CORS 設置（包含生產環境域名）

  // 驗證中間件（對部分端點除外）
  app.use('/sse/*', analyticsAuthMiddleware);
  app.use('/broadcast/*', analyticsAuthMiddleware);
  app.use('/subscription/*', analyticsAuthMiddleware);

  /**
   * 創建 SSE 連接
   * GET /sse/:dashboardId?widgets=widget1,widget2
   */
  app.get('/sse/:dashboardId', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');
      const widgetsParam = c.req.query('widgets');

      let widgets: string[] = [];
      if (widgetsParam) {
        widgets = widgetsParam.split(',').map(w => w.trim()).filter(w => w);
      }

      // 創建 SSE 連接
      const response = await realtimeService.createSSEConnection(
        user.id.toString(),
        dashboardId,
        widgets
      );

      return response;

    } catch (error) {
      console.error('Failed to create SSE connection:', error);

      // 返回錯誤的 SSE 響應
      const errorStream = new ReadableStream({
        start(controller) {
          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            data: { message: error instanceof AnalyticsError ? error.message : 'Connection failed' },
            timestamp: new Date().toISOString()
          })}\n\n`;

          controller.enqueue(new TextEncoder().encode(errorMessage));
          controller.close();
        }
      });

      return new Response(errorStream, {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
    }
  });

  /**
   * WebSocket 連接（預留）
   * GET /websocket/:dashboardId
   */
  app.get('/websocket/:dashboardId', async (c) => {
    // WebSocket 升級邏輯
    // 這裡可以實現 WebSocket 連接升級
    // 目前返回不支持的錯誤

    return c.json({
      success: false,
      error: 'WebSocket connections not yet implemented. Please use SSE endpoint.',
      alternativeEndpoint: `/api/analytics/realtime/sse/${c.req.param('dashboardId')}`
    }, 501);
  });

  /**
   * 更新訂閱配置
   * PUT /subscription/:connectionId
   */
  app.put('/subscription/:connectionId', zValidator('json', subscriptionSchema.partial()), async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const connectionId = c.req.param('connectionId');
      const updates = c.req.valid('json');

      // 驗證連接所有權（簡化版本）
      // 實際實現中需要驗證 connectionId 是否屬於當前用戶

      await realtimeService.updateSubscription(connectionId, updates);

      return c.json({
        success: true,
        message: 'Subscription updated successfully'
      });

    } catch (error) {
      console.error('Failed to update subscription:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to update subscription'
      }, 500);
    }
  });

  /**
   * 廣播更新到所有連接
   * POST /broadcast
   */
  app.post('/broadcast', zValidator('json', broadcastSchema), async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const { dashboardId, widgetId, type, data } = c.req.valid('json');

      // 檢查權限（只有 admin 和 team 角色可以廣播）
      if (!user || (user.role !== 'admin' && user.role !== 'team')) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to broadcast updates'
        }, 403);
      }

      switch (type) {
        case 'widget_update':
          if (!widgetId) {
            throw new AnalyticsError('Widget ID is required for widget updates', 'MISSING_WIDGET_ID', 400);
          }
          await realtimeService.broadcastWidgetUpdate(dashboardId, widgetId, data);
          break;

        case 'config_change':
          await realtimeService.broadcastConfigChange(dashboardId, data);
          break;

        default:
          throw new AnalyticsError(`Unsupported broadcast type: ${type}`, 'UNSUPPORTED_BROADCAST_TYPE', 400);
      }

      return c.json({
        success: true,
        message: `${type} broadcasted successfully`
      });

    } catch (error) {
      console.error('Failed to broadcast update:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to broadcast update'
      }, 500);
    }
  });

  /**
   * 觸發小工具數據更新
   * POST /trigger-update/:dashboardId/:widgetId
   */
  app.post('/trigger-update/:dashboardId/:widgetId', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');
      const widgetId = c.req.param('widgetId');

      // 獲取儀表板配置
      const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);
      const widget = config.widgets.find(w => w.id === widgetId);

      if (!widget) {
        return c.json({
          success: false,
          error: 'Widget not found'
        }, 404);
      }

      // 獲取最新數據
      const widgetData = await dashboardService.getWidgetData(widget);

      // 廣播更新
      await realtimeService.broadcastWidgetUpdate(dashboardId, widgetId, widgetData);

      return c.json({
        success: true,
        data: widgetData,
        message: 'Widget update triggered successfully'
      });

    } catch (error) {
      console.error('Failed to trigger widget update:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to trigger widget update'
      }, 500);
    }
  });

  /**
   * 觸發整個儀表板數據更新
   * POST /trigger-update/:dashboardId
   */
  app.post('/trigger-update/:dashboardId', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');

      // 獲取最新儀表板數據
      const dashboardData = await dashboardService.getDashboardData(user.id.toString(), dashboardId);

      // 逐個廣播小工具更新
      const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);

      const updatePromises = Object.entries(dashboardData).map(([widgetId, data]) => {
        return realtimeService.broadcastWidgetUpdate(dashboardId, widgetId, data);
      });

      await Promise.all(updatePromises);

      return c.json({
        success: true,
        data: dashboardData,
        message: 'Dashboard update triggered successfully',
        updatedWidgets: Object.keys(dashboardData)
      });

    } catch (error) {
      console.error('Failed to trigger dashboard update:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to trigger dashboard update'
      }, 500);
    }
  });

  /**
   * 獲取連接狀態
   * GET /status
   */
  app.get('/status', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;

      // 檢查權限（只有 admin 可以查看所有連接狀態）
      if (!user || user.role !== 'admin') {
        return c.json({
          success: false,
          error: 'Insufficient permissions to view connection status'
        }, 403);
      }

      const status = realtimeService.getConnectionStatus();

      return c.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Failed to get connection status:', error);
      return c.json({
        success: false,
        error: 'Failed to get connection status'
      }, 500);
    }
  });

  /**
   * 測試 SSE 連接
   * GET /test-sse
   */
  app.get('/test-sse', async (c) => {
    const stream = new ReadableStream({
      start(controller) {
        let counter = 0;

        const interval = setInterval(() => {
          const message = `data: ${JSON.stringify({
            type: 'test',
            data: {
              counter: ++counter,
              message: `Test message ${counter}`,
              timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          })}\n\n`;

          try {
            controller.enqueue(new TextEncoder().encode(message));

            // 發送10條消息後停止
            if (counter >= 10) {
              clearInterval(interval);
              controller.close();
            }
          } catch (error) {
            clearInterval(interval);
            controller.close();
          }
        }, 1000);

        // 5分鐘後自動關閉
        setTimeout(() => {
          clearInterval(interval);
          controller.close();
        }, 300000);
      }
    });

    // ✅ 使用統一的 SSE CORS 配置
    const sseCorsHeaders = getSSECorsHeaders(c.req.header('Origin'));
    return new Response(stream, { headers: sseCorsHeaders });
  });

  /**
   * 健康檢查端點
   * GET /health
   */
  app.get('/health', async (c) => {
    try {
      const status = realtimeService.getConnectionStatus();

      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'realtime-dashboard',
        connections: status.totalConnections,
        metrics: {
          totalConnections: status.totalConnections,
          dashboards: Object.keys(status.connectionsByDashboard).length,
          users: Object.keys(status.connectionsByUser).length
        }
      });
    } catch (error) {
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'realtime-dashboard',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * 清理過期連接
   * POST /cleanup
   */
  app.post('/cleanup', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;

      // 只有 admin 可以手動清理
      if (!user || user.role !== 'admin') {
        return c.json({
          success: false,
          error: 'Insufficient permissions to perform cleanup'
        }, 403);
      }

      realtimeService.cleanupExpiredConnections();

      return c.json({
        success: true,
        message: 'Expired connections cleaned up successfully'
      });

    } catch (error) {
      console.error('Failed to cleanup connections:', error);
      return c.json({
        success: false,
        error: 'Failed to cleanup connections'
      }, 500);
    }
  });

  return app;
};

// 導出工廠函數
export const createRealtimeDashboardHandler = (
  realtimeService: RealtimeDashboardService,
  dashboardService: DashboardService
) => {
  return createRealtimeDashboardApp(realtimeService, dashboardService);
};

// 為了向後兼容，也導出一個默認的處理器創建函數
export const realtimeDashboardHandler = new Hono<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>()
  .use('*', async (c, next) => {
    const realtimeService = new RealtimeDashboardService(c.env.DB, c.env.KV as any);
    const dashboardService = new DashboardService(c.env.DB, c.env.KV as any);
    const handler = createRealtimeDashboardHandler(realtimeService, dashboardService);

    return handler.fetch(c.req.raw, c.env, c.executionCtx);
  });

export default realtimeDashboardHandler;