// Dashboard API Handler - 儀表板 API 處理器
// 提供儀表板配置、數據獲取和實時更新的 REST API 端點

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { DashboardService } from '@modules/analytics/services/dashboard-service';
import { WidgetManager } from '@modules/analytics/services/widget-manager';
import { analyticsAuthMiddleware } from '@modules/analytics/middleware/analytics-auth';
import type { Bindings } from '@/types';

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
  DashboardWidget,
  WidgetData,
  TimeRange as DashboardTimeRange
} from '../types/dashboard-types';
import type { TimeRange as AnalyticsTimeRange } from '@modules/analytics/types/analytics-types';
import { AnalyticsError, DataProcessingError } from '@modules/analytics/types/analytics-types';

// 驗證 schema
const timeRangeSchema = z.object({
  start: z.string(),
  end: z.string()
});

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

  // ✅ CORS 處理已移至 src/index.ts 統一管理
  // 不再需要模組級別的 CORS middleware

  // 驗證中間件
  app.use('/*', analyticsAuthMiddleware);

  /**
   * 獲取儀表板配置
   * GET /config/:dashboardId?
   */
  app.get('/config/:dashboardId?', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const dashboardId = c.req.param('dashboardId');

      const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);

      return c.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Failed to get dashboard config:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to get dashboard configuration'
      }, 500);
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
        createdAt: (configData as any).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        refreshInterval: configData.refreshInterval || 30000, // 30 seconds default
        autoRefresh: configData.autoRefresh ?? true
      };

      await dashboardService.saveDashboardConfig(user.id.toString(), config, dashboardId);

      return c.json({
        success: true,
        data: config,
        message: 'Dashboard configuration saved successfully'
      });
    } catch (error) {
      console.error('Failed to save dashboard config:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to save dashboard configuration'
      }, 500);
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
        createdAt: (configData as any).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        refreshInterval: configData.refreshInterval || 30000, // 30 seconds default
        autoRefresh: configData.autoRefresh ?? true
      };

      await dashboardService.saveDashboardConfig(user.id.toString(), config, dashboardId);

      return c.json({
        success: true,
        data: config,
        message: 'Dashboard configuration updated successfully'
      });
    } catch (error) {
      console.error('Failed to update dashboard config:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to update dashboard configuration'
      }, 500);
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
          return c.json({
            success: false,
            error: 'Invalid timeRange parameter'
          }, 400);
        }
      }

      const data = await dashboardService.getDashboardData(
        user.id.toString(),
        dashboardId,
        timeRange as unknown as AnalyticsTimeRange
      );

      return c.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to get dashboard data:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to get dashboard data'
      }, 500);
    }
  });

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
          return c.json({
            success: false,
            error: 'Invalid timeRange parameter'
          }, 400);
        }
      }

      // 獲取儀表板配置以找到小工具
      const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);
      const widget = config.widgets.find(w => w.id === widgetId);

      if (!widget) {
        return c.json({
          success: false,
          error: 'Widget not found'
        }, 404);
      }

      const data = await dashboardService.getWidgetData(widget, timeRange as unknown as AnalyticsTimeRange);

      return c.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to get widget data:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to get widget data'
      }, 500);
    }
  });

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
        return c.json({
          success: false,
          error: 'Insufficient permissions to create widgets'
        }, 403);
      }

      const widget = await widgetManager.createWidget(widgetConfig);

      return c.json({
        success: true,
        data: widget,
        message: 'Widget created successfully'
      });
    } catch (error) {
      console.error('Failed to create widget:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to create widget'
      }, 500);
    }
  });

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
        return c.json({
          success: false,
          error: 'Insufficient permissions to update widgets'
        }, 403);
      }

      const widget = await widgetManager.updateWidget(widgetId, updates);

      return c.json({
        success: true,
        data: widget,
        message: 'Widget updated successfully'
      });
    } catch (error) {
      console.error('Failed to update widget:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to update widget'
      }, 500);
    }
  });

  /**
   * 獲取可用的小工具類型
   * GET /widget-types
   */
  app.get('/widget-types', async (c) => {
    try {
      const widgetTypes = widgetManager.getAvailableWidgetTypes();

      return c.json({
        success: true,
        data: widgetTypes
      });
    } catch (error) {
      console.error('Failed to get widget types:', error);
      return c.json({
        success: false,
        error: 'Failed to get widget types'
      }, 500);
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

      return c.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Failed to get dashboard templates:', error);
      return c.json({
        success: false,
        error: 'Failed to get dashboard templates'
      }, 500);
    }
  });

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

        return c.json({
          success: true,
          data: config,
          message: 'Dashboard created from template successfully'
        });
      } catch (error) {
        console.error('Failed to create dashboard from template:', error);
        return c.json({
          success: false,
          error: error instanceof AnalyticsError ? error.message : 'Failed to create dashboard from template'
        }, 500);
      }
    }
  );

  /**
   * 獲取小工具模板
   * GET /widget-templates
   */
  app.get('/widget-templates', async (c) => {
    try {
      const category = c.req.query('category');
      const widgetType = c.req.query('type');

      const templates = await widgetManager.getWidgetTemplates(category, widgetType);

      return c.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Failed to get widget templates:', error);
      return c.json({
        success: false,
        error: 'Failed to get widget templates'
      }, 500);
    }
  });

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
          return c.json({
            success: false,
            error: 'Insufficient permissions to create widgets'
          }, 403);
        }

        const widget = await widgetManager.createWidgetFromTemplate(templateId, customConfig);

        return c.json({
          success: true,
          data: widget,
          message: 'Widget created from template successfully'
        });
      } catch (error) {
        console.error('Failed to create widget from template:', error);
        return c.json({
          success: false,
          error: error instanceof AnalyticsError ? error.message : 'Failed to create widget from template'
        }, 500);
      }
    }
  );

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
          return c.json({
            success: false,
            error: 'Insufficient permissions to clone widgets'
          }, 403);
        }

        // 獲取原小工具
        const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);
        const originalWidget = config.widgets.find(w => w.id === widgetId);

        if (!originalWidget) {
          return c.json({
            success: false,
            error: 'Widget not found'
          }, 404);
        }

        const clonedWidget = await widgetManager.cloneWidget(originalWidget, newId);

        return c.json({
          success: true,
          data: clonedWidget,
          message: 'Widget cloned successfully'
        });
      } catch (error) {
        console.error('Failed to clone widget:', error);
        return c.json({
          success: false,
          error: error instanceof AnalyticsError ? error.message : 'Failed to clone widget'
        }, 500);
      }
    }
  );

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
          return c.json({
            success: false,
            error: 'Insufficient permissions to optimize layout'
          }, 403);
        }

        const config = await dashboardService.getDashboardConfig(user.id.toString(), dashboardId);
        const optimizedWidgets = widgetManager.optimizeLayout(config.widgets, containerWidth);

        // 更新配置
        const updatedConfig: DashboardConfig = {
          ...config,
          widgets: optimizedWidgets,
          updatedAt: new Date().toISOString()
        };

        await dashboardService.saveDashboardConfig(user.id.toString(), updatedConfig, dashboardId);

        return c.json({
          success: true,
          data: updatedConfig,
          message: 'Layout optimized successfully'
        });
      } catch (error) {
        console.error('Failed to optimize layout:', error);
        return c.json({
          success: false,
          error: error instanceof AnalyticsError ? error.message : 'Failed to optimize layout'
        }, 500);
      }
    }
  );

  /**
   * 健康檢查端點
   * GET /health
   */
  app.get('/health', async (c) => {
    try {
      // 簡單的健康檢查
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          dashboardService: 'ok',
          widgetManager: 'ok'
        }
      };

      return c.json(status);
    } catch (error) {
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
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