// Dashboard API Handler - 儀表板 API 處理器
// 提供儀表板配置、數據獲取和實時更新的 REST API 端點

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { DashboardService } from '@modules/analytics/services/dashboard-service';
import { WidgetManager } from '@modules/analytics/services/widget-manager';
import { analyticsAuthMiddleware } from '@modules/analytics/middleware/analytics-auth';
import type { Bindings } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import { successResponse, badRequestResponse, notFoundResponse, forbiddenResponse } from '@/utils/api-response';

// Analytics User interface based on middleware
interface AnalyticsUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'team' | 'agent';
  teamId?: number;
  teamName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
import type {
  DashboardConfig,
  TimeRange as DashboardTimeRange
} from '../types/dashboard-types';
import type { TimeRange as AnalyticsTimeRange } from '@modules/analytics/types/analytics-types';

import { nowISO } from '@/utils/timestamp'

// 驗證 schema
const dashboardConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  layout: z.object({
    type: z.enum(['grid', 'flex', 'absolute', 'responsive']),
    columns: z.number().min(1).max(24).optional(),
    rows: z.union([z.number(), z.literal('auto')]).optional(),
    gap: z.number().min(0).optional()
  }),
  widgets: z.array(z.any()), // 詳細的 widget schema 可以進一步定義
  permissions: z.object({
    owner: z.string(),
    viewers: z.array(z.string()),
    editors: z.array(z.string())
  }).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  autoRefresh: z.boolean().optional(),
  refreshInterval: z.number().min(5000).optional()
});

const widgetConfigSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['metric', 'chart', 'table', 'gauge', 'progress', 'status']),
  title: z.string().min(1),
  dataSource: z.object({
    type: z.enum(['analytics', 'metrics', 'database', 'api', 'static', 'realtime']),
    config: z.object({
      endpoint: z.string().optional(),
      method: z.enum(['GET', 'POST']).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      timeout: z.number().optional(),
      retryCount: z.number().optional(),
      transform: z.string().optional()
    }).optional().default({}),
    query: z.string(),
    parameters: z.record(z.string(), z.any()).optional(),
    cache: z.object({
      enabled: z.boolean(),
      ttl: z.number(),
      key: z.string().optional(),
      invalidateOn: z.array(z.string()).optional()
    }).optional()
  }),
  position: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(1),
    height: z.number().min(1)
  }),
  metric: z.string().optional(),
  metrics: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.any()).optional(),
  realTime: z.boolean().optional(),
  refreshInterval: z.number().min(5000).optional()
});

const createDashboardApp = (dashboardService: DashboardService, widgetManager: WidgetManager) => {
  const app = new Hono<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>();

  // CORS 處理已移至 src/index.ts 統一管理
  // 不再需要模組級別的 CORS middleware

  // 驗證中間件
  app.use('/*', analyticsAuthMiddleware);

  // ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
  // Routes MUST be registered in this order to avoid conflicts:
  // 1. STATIC: /health
  // 2. SPECIFIC (concrete paths, no params): /widget-types, /templates, /widget-templates, /layout/optimize
  // 3. SPECIFIC PARAMETERIZED: /config/:dashboardId?, /data/:dashboardId?
  // 4. MULTI-SEGMENT (param + specific segments): /widget/:widgetId/data, /widget/:widgetId/clone, /templates/:templateId/create, /widget-templates/:templateId/create
  // 5. SPECIFIC (single segment): /widget - MUST come after MULTI-SEGMENT to avoid interception
  // 6. SINGLE PARAMETERIZED: /widget/:widgetId

  // ==================== Priority 1: STATIC routes ====================

  /**
   * 健康檢查端點
   * GET /health
   */
  app.get('/health', async (c) => {
    try {
      // 簡單的健康檢查
      const status = {
        status: 'healthy',
        timestamp: nowISO(),
        services: {
          dashboardService: 'ok',
          widgetManager: 'ok'
        }
      };

      return successResponse(c, status);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  // ==================== Priority 2: SPECIFIC routes (concrete paths without params, excluding /widget) ====================

  /**
   * 獲取可用的小工具類型
   * GET /widget-types
   */
  app.get('/widget-types', async (c) => {
    try {
      const widgetTypes = widgetManager.getAvailableWidgetTypes();

      return successResponse(c, widgetTypes);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  /**
   * 獲取儀表板模板
   * GET /templates
   */
  app.get('/templates', async (c) => {
    try {
      const category = c.req.query('category');
      const templates = await dashboardService.getDashboardTemplates(category);

      return successResponse(c, templates);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  /**
   * 獲取小工具模板
   * GET /widget-templates
   */
  app.get('/widget-templates', async (c) => {
    try {
      const category = c.req.query('category');
      const widgetType = c.req.query('type');

      const templates = await widgetManager.getWidgetTemplates(category, widgetType);

      return successResponse(c, templates);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  /**
   * 優化儀表板佈局
   * POST /layout/optimize
   */
  app.post('/layout/optimize',
    zValidator('json', z.object({
      dashboardId: z.string().optional(),
      containerWidth: z.number().min(1).max(24).optional()
    })),
    async (c) => {
      try {
        const user = c.get('user') as AnalyticsUser;
        const { dashboardId, containerWidth } = c.req.valid('json');

        // 檢查權限
        if (!user || (user.role !== 'admin' && user.role !== 'team')) {
          return forbiddenResponse(c, 'Insufficient permissions to optimize layout');
        }

        const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);
        const optimizedWidgets = widgetManager.optimizeLayout(config.widgets, containerWidth);

        // 更新配置
        const updatedConfig: DashboardConfig = {
          ...config,
          widgets: optimizedWidgets,
          updatedAt: nowISO()
        };

        await dashboardService.saveDashboardConfig(user.id.toString(), updatedConfig, dashboardId);

        return successResponse(c, updatedConfig, 'Layout optimized successfully');
      } catch (error) {
        return globalErrorHandler.handleError(c, error);
      }
    }
  );

  // ==================== Priority 3: SPECIFIC PARAMETERIZED routes ====================

  /**
   * 獲取儀表板配置
   * GET /config/:dashboardId?
   */
  app.get('/config/:dashboardId?', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');

      const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);

      return successResponse(c, config);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  /**
   * 保存儀表板配置
   * POST/PUT /config/:dashboardId?
   */
  app.post('/config/:dashboardId?', zValidator('json', dashboardConfigSchema), async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');
      const configData = c.req.valid('json');

      const config: DashboardConfig = {
        ...configData,
        id: dashboardId || configData.id || 'default',
        permissions: configData.permissions || {
          owner: user?.id?.toString() || 'system',
          viewers: [],
          editors: []
        },
        createdBy: user?.id?.toString() || 'system',
        createdAt: (configData as any).createdAt || nowISO(),
        updatedAt: nowISO(),
        refreshInterval: configData.refreshInterval || 30000, // 30 seconds default
        autoRefresh: configData.autoRefresh ?? true
      };

      await dashboardService.saveDashboardConfig(user.id.toString(), config, dashboardId);

      return successResponse(c, config, 'Dashboard configuration saved successfully');
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  app.put('/config/:dashboardId?', zValidator('json', dashboardConfigSchema), async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');
      const configData = c.req.valid('json');

      const config: DashboardConfig = {
        ...configData,
        id: dashboardId || configData.id || 'default',
        permissions: configData.permissions || {
          owner: user?.id?.toString() || 'system',
          viewers: [],
          editors: []
        },
        createdBy: user?.id?.toString() || 'system',
        createdAt: (configData as any).createdAt || nowISO(),
        updatedAt: nowISO(),
        refreshInterval: configData.refreshInterval || 30000, // 30 seconds default
        autoRefresh: configData.autoRefresh ?? true
      };

      await dashboardService.saveDashboardConfig(user.id.toString(), config, dashboardId);

      return successResponse(c, config, 'Dashboard configuration updated successfully');
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  /**
   * 獲取儀表板數據
   * GET /data/:dashboardId?
   */
  app.get('/data/:dashboardId?', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');
      const timeRangeParam = c.req.query('timeRange');

      let timeRange: DashboardTimeRange | undefined;
      if (timeRangeParam) {
        try {
          timeRange = JSON.parse(timeRangeParam);
        } catch {
          return badRequestResponse(c, 'Invalid timeRange parameter');
        }
      }

      const data = await dashboardService.getDashboardData(
        user.id.toString(),
        dashboardId,
        timeRange as unknown as AnalyticsTimeRange
      );

      return successResponse(c, data);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  // ==================== Priority 4: MULTI-SEGMENT routes (/:param/xxx) ====================

  /**
   * 獲取單個小工具數據
   * GET /widget/:widgetId/data
   */
  app.get('/widget/:widgetId/data', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const widgetId = c.req.param('widgetId');
      const dashboardId = c.req.query('dashboardId');
      const timeRangeParam = c.req.query('timeRange');

      let timeRange: DashboardTimeRange | undefined;
      if (timeRangeParam) {
        try {
          timeRange = JSON.parse(timeRangeParam);
        } catch {
          return badRequestResponse(c, 'Invalid timeRange parameter');
        }
      }

      // 獲取儀表板配置以找到小工具
      const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);
      const widget = config.widgets.find(w => w.id === widgetId);

      if (!widget) {
        return notFoundResponse(c, 'Widget');
      }

      const data = await dashboardService.getWidgetData(widget, timeRange as unknown as AnalyticsTimeRange);

      return successResponse(c, data);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  /**
   * 複製小工具
   * POST /widget/:widgetId/clone
   */
  app.post('/widget/:widgetId/clone',
    zValidator('json', z.object({
      newId: z.string().optional(),
      dashboardId: z.string().optional()
    }).optional()),
    async (c) => {
      try {
        const user = c.get('user') as AnalyticsUser;
        const widgetId = c.req.param('widgetId');
        const { newId, dashboardId } = c.req.valid('json') || {};

        // 檢查權限
        if (!user || (user.role !== 'admin' && user.role !== 'team')) {
          return forbiddenResponse(c, 'Insufficient permissions to clone widgets');
        }

        // 獲取原小工具
        const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);
        const originalWidget = config.widgets.find(w => w.id === widgetId);

        if (!originalWidget) {
          return notFoundResponse(c, 'Widget');
        }

        const clonedWidget = await widgetManager.cloneWidget(originalWidget, newId);

        return successResponse(c, clonedWidget, 'Widget cloned successfully');
      } catch (error) {
        return globalErrorHandler.handleError(c, error);
      }
    }
  );

  /**
   * 從模板創建儀表板
   * POST /templates/:templateId/create
   */
  app.post('/templates/:templateId/create',
    zValidator('json', z.object({
      name: z.string().optional(),
      theme: z.enum(['light', 'dark']).optional(),
      autoRefresh: z.boolean().optional(),
      refreshInterval: z.number().min(5000).optional()
    }).optional()),
    async (c) => {
      try {
        const user = c.get('user') as AnalyticsUser;
        const templateId = c.req.param('templateId');
        const customConfig = c.req.valid('json') || {};

        const config = await dashboardService.createDashboardFromTemplate(
          user.id.toString(),
          templateId,
          customConfig
        );

        return successResponse(c, config, 'Dashboard created from template successfully');
      } catch (error) {
        return globalErrorHandler.handleError(c, error);
      }
    }
  );

  /**
   * 從模板創建小工具
   * POST /widget-templates/:templateId/create
   */
  app.post('/widget-templates/:templateId/create',
    zValidator('json', z.object({
      title: z.string().optional(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number()
      }).optional(),
      dataSource: z.object({
        type: z.enum(['analytics', 'metrics', 'database', 'api', 'static', 'realtime']),
        query: z.string(),
        config: z.object({}).optional().default({}),
        parameters: z.record(z.string(), z.any()).optional()
      }).optional(),
      metric: z.string().optional(),
      metrics: z.array(z.string()).optional()
    }).optional()),
    async (c) => {
      try {
        const user = c.get('user') as AnalyticsUser;
        const templateId = c.req.param('templateId');
        const customConfig = c.req.valid('json') || {};

        // 檢查權限
        if (!user || (user.role !== 'admin' && user.role !== 'team')) {
          return forbiddenResponse(c, 'Insufficient permissions to create widgets');
        }

        const widget = await widgetManager.createWidgetFromTemplate(templateId, customConfig);

        return successResponse(c, widget, 'Widget created from template successfully');
      } catch (error) {
        return globalErrorHandler.handleError(c, error);
      }
    }
  );

  // ==================== Priority 5: SPECIFIC (single segment, no param) - MUST come after MULTI-SEGMENT ====================

  /**
   * 創建新小工具
   * POST /widget
   */
  app.post('/widget', zValidator('json', widgetConfigSchema), async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const widgetConfig = c.req.valid('json');

      // 檢查用戶權限（簡化版本）
      if (!user || (user.role !== 'admin' && user.role !== 'team')) {
        return forbiddenResponse(c, 'Insufficient permissions to create widgets');
      }

      const widget = await widgetManager.createWidget(widgetConfig);

      return successResponse(c, widget, 'Widget created successfully');
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  // ==================== Priority 6: SINGLE PARAMETERIZED routes (/:id) ====================

  /**
   * 更新小工具配置
   * PUT /widget/:widgetId
   */
  app.put('/widget/:widgetId', zValidator('json', widgetConfigSchema.partial()), async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const widgetId = c.req.param('widgetId');
      const updates = c.req.valid('json');

      // 檢查用戶權限
      if (!user || (user.role !== 'admin' && user.role !== 'team')) {
        return forbiddenResponse(c, 'Insufficient permissions to update widgets');
      }

      const widget = await widgetManager.updateWidget(widgetId, updates);

      return successResponse(c, widget, 'Widget updated successfully');
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  });

  return app;
};

// 導出工廠函數
export const createDashboardHandler = (dashboardService: DashboardService, widgetManager: WidgetManager) => {
  return createDashboardApp(dashboardService, widgetManager);
};

// 為了向後兼容，也導出一個默認的處理器創建函數
export const dashboardHandler = new Hono<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>()
  .all('*', async (c) => {
    const dashboardService = new DashboardService(c.env.DB, c.env.KV as any);
    const widgetManager = new WidgetManager(c.env.DB, c.env.KV as any);
    const app = createDashboardApp(dashboardService, widgetManager);

    // 使用正確的 fetch 方法
    return app.fetch(c.req.raw, c.env, c.executionCtx);
  });

export default dashboardHandler;