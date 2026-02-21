// Real-time Dashboard API Handler - 實時儀表板 API 處理器
// Provides dashboard data access and widget update trigger endpoints
// Real-time push is handled by WebSocket via Durable Objects

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { RealtimeDashboardService } from '@modules/analytics/services/realtime-dashboard-service';
import { DashboardService } from '@modules/analytics/services/dashboard-service';
import { analyticsAuthMiddleware } from '@modules/analytics/middleware/analytics-auth';
import type { Bindings } from '@/types';

import { globalErrorHandler } from '@/core/error-handler';
import { forbiddenResponse } from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp';

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

  // Authentication middleware
  app.use('/broadcast/*', analyticsAuthMiddleware);

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
        return forbiddenResponse(c, 'Insufficient permissions to broadcast updates');
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
      return globalErrorHandler.handleError(c, error);
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
      return globalErrorHandler.handleError(c, error);
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
      // Validate dashboard exists (side effect)
      await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);

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
      return globalErrorHandler.handleError(c, error);
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
        timestamp: nowISO()
      });

    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
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
        timestamp: nowISO(),
        service: 'realtime-dashboard',
        connections: status.totalConnections,
        metrics: {
          totalConnections: status.totalConnections,
          dashboards: Object.keys(status.connectionsByDashboard).length,
          users: Object.keys(status.connectionsByUser).length
        }
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
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
      return globalErrorHandler.handleError(c, error);
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
  .use('*', async (c, _next) => {
    const realtimeService = new RealtimeDashboardService(c.env.DB, c.env.KV as any);
    const dashboardService = new DashboardService(c.env.DB, c.env.KV as any);
    const handler = createRealtimeDashboardHandler(realtimeService, dashboardService);

    return handler.fetch(c.req.raw, c.env, c.executionCtx);
  });

export default realtimeDashboardHandler;