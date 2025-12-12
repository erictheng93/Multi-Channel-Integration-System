// Dashboard Service 單元測試
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DashboardService } from '@modules/analytics/services/dashboard-service';
import type { DashboardConfig, DashboardWidget, WidgetData } from '@modules/analytics/types/dashboard-types';

describe('DashboardService', () => {
  let mockDB: any;
  let mockKV: any;
  let dashboardService: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock D1 Database
    mockDB = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true })
    };

    // Mock KV Namespace
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    };

    dashboardService = new DashboardService(mockDB, mockKV, {
      cacheEnabled: true,
      cacheTTL: 300,
      realTimeEnabled: true,
      maxWidgetsPerDashboard: 20
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDashboardConfig', () => {
    it('should return default config when no config exists', async () => {
      mockKV.get.mockResolvedValue(null);

      const config = await dashboardService.getDashboardConfig('user123');

      expect(config).toBeDefined();
      expect(config.id).toBe('default');
      expect(config.name).toBe('默認儀表板');
      expect(config.widgets).toBeInstanceOf(Array);
      expect(mockKV.get).toHaveBeenCalledWith('dashboard:user123:default', { type: 'json' });
    });

    it('should return cached config when available', async () => {
      const cachedConfig: DashboardConfig = {
        id: 'test-dashboard',
        name: 'Test Dashboard',
        description: 'Test Description',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets: [],
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockKV.get.mockResolvedValue(cachedConfig);

      const config = await dashboardService.getDashboardConfig('user123', 'test-dashboard');

      expect(config).toEqual(cachedConfig);
      expect(mockKV.get).toHaveBeenCalledWith('dashboard:user123:test-dashboard', { type: 'json' });
    });

    it('should use correct cache key format', async () => {
      mockKV.get.mockResolvedValue(null);

      await dashboardService.getDashboardConfig('user456', 'custom-dashboard');

      expect(mockKV.get).toHaveBeenCalledWith('dashboard:user456:custom-dashboard', { type: 'json' });
    });
  });

  describe('saveDashboardConfig', () => {
    it('should save dashboard config to KV', async () => {
      const config: DashboardConfig = {
        id: 'test-dashboard',
        name: 'Test Dashboard',
        description: 'Test Description',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets: [],
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockKV.put.mockResolvedValue(undefined);

      await dashboardService.saveDashboardConfig('user123', config, 'test-dashboard');

      expect(mockKV.put).toHaveBeenCalled();
      const putCall = mockKV.put.mock.calls[0];
      expect(putCall[0]).toBe('dashboard:user123:test-dashboard');

      const savedConfig = JSON.parse(putCall[1]);
      expect(savedConfig.id).toBe('test-dashboard');
      expect(savedConfig.name).toBe('Test Dashboard');
    });

    it('should throw error when config has too many widgets', async () => {
      const widgets: DashboardWidget[] = Array.from({ length: 25 }, (_, i) => ({
        id: `widget-${i}`,
        type: 'metric' as const,
        title: `Widget ${i}`,
        config: {
          showTitle: true,
          showDescription: false,
          showLegend: false,
          showToolbar: false,
          realTime: false,
          refreshInterval: 5000,
          maxDataPoints: 100,
          theme: 'light' as const,
          colors: ['#1890ff'],
          animation: true
        },
        dataSource: { type: 'conversation', query: '', config: {} },
        position: { x: 0, y: 0, width: 3, height: 2 }
      }));

      const config: DashboardConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets,
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await expect(dashboardService.saveDashboardConfig('user123', config))
        .rejects.toThrow(/Too many widgets/);
    });

    it('should throw error when config is missing required fields', async () => {
      const invalidConfig = {
        name: 'Test'
        // missing id
      } as any;

      await expect(dashboardService.saveDashboardConfig('user123', invalidConfig))
        .rejects.toThrow(/required/);
    });

    it('should update the updatedAt timestamp', async () => {
      const config: DashboardConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets: [],
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: '2020-01-01T00:00:00.000Z'
      };

      mockKV.put.mockResolvedValue(undefined);

      await dashboardService.saveDashboardConfig('user123', config);

      const putCall = mockKV.put.mock.calls[0];
      const savedConfig = JSON.parse(putCall[1]);
      expect(new Date(savedConfig.updatedAt).getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
    });
  });

  describe('getDashboardData', () => {
    it('should return data for all widgets', async () => {
      const config: DashboardConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets: [
          {
            id: 'widget1',
            type: 'metric',
            title: 'Total Conversations',
            config: {
              showTitle: true,
              showDescription: false,
              showLegend: false,
              showToolbar: false,
              realTime: false,
              refreshInterval: 5000,
              maxDataPoints: 100,
              theme: 'light',
              colors: ['#1890ff'],
              animation: true
            },
            dataSource: { type: 'conversation', query: '', config: {} },
            metric: 'total_conversations',
            position: { x: 0, y: 0, width: 3, height: 2 }
          }
        ],
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockKV.get.mockResolvedValue(config);

      const data = await dashboardService.getDashboardData('user123', 'test');

      expect(data).toBeDefined();
      expect(data.widget1).toBeDefined();
      expect(data.widget1.type).toBe('metric');
    });

    it('should handle widget loading errors gracefully', async () => {
      const config: DashboardConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets: [
          {
            id: 'broken-widget',
            type: 'metric',
            title: 'Broken Widget',
            config: {
              showTitle: true,
              showDescription: false,
              showLegend: false,
              showToolbar: false,
              realTime: false,
              refreshInterval: 5000,
              maxDataPoints: 100,
              theme: 'light',
              colors: ['#1890ff'],
              animation: true
            },
            dataSource: { type: 'conversation', query: '', config: {} },
            metric: 'invalid_metric',
            position: { x: 0, y: 0, width: 3, height: 2 }
          }
        ],
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockKV.get.mockResolvedValue(config);

      const data = await dashboardService.getDashboardData('user123', 'test');

      expect(data['broken-widget']).toBeDefined();
      expect(data['broken-widget'].loading).toBe(false);
    });
  });

  describe('getWidgetData', () => {
    it('should return metric widget data', async () => {
      const widget: DashboardWidget = {
        id: 'metric-widget',
        type: 'metric',
        title: 'Total Count',
        config: {
          showTitle: true,
          showDescription: false,
          showLegend: false,
          showToolbar: false,
          realTime: false,
          refreshInterval: 5000,
          maxDataPoints: 100,
          theme: 'light',
          colors: ['#1890ff'],
          animation: true
        },
        dataSource: { type: 'conversation', query: '', config: {} },
        metric: 'total_count',
        position: { x: 0, y: 0, width: 3, height: 2 }
      };

      const data = await dashboardService.getWidgetData(widget);

      expect(data.type).toBe('metric');
      expect(data.widgetId).toBe('metric-widget');
      expect(data.loading).toBe(false);
      expect(data.metadata).toBeDefined();
    });

    it('should return chart widget data', async () => {
      const widget: DashboardWidget = {
        id: 'chart-widget',
        type: 'chart',
        title: 'Response Time',
        config: {
          showTitle: true,
          showDescription: false,
          showLegend: false,
          showToolbar: false,
          realTime: false,
          refreshInterval: 5000,
          maxDataPoints: 100,
          theme: 'light',
          colors: ['#1890ff'],
          animation: true
        },
        dataSource: { type: 'conversation', query: '', config: {} },
        metrics: ['response_time'],
        chartConfig: { type: 'line', groupBy: ['time'] },
        position: { x: 0, y: 0, width: 6, height: 4 }
      };

      const data = await dashboardService.getWidgetData(widget);

      expect(data.type).toBe('chart');
      expect(data.widgetId).toBe('chart-widget');
      expect(data.chartType).toBe('line');
    });

    it('should return table widget data', async () => {
      const widget: DashboardWidget = {
        id: 'table-widget',
        type: 'table',
        title: 'Conversations',
        config: {
          showTitle: true,
          showDescription: false,
          showLegend: false,
          showToolbar: false,
          realTime: false,
          refreshInterval: 5000,
          maxDataPoints: 100,
          theme: 'light',
          colors: ['#1890ff'],
          animation: true
        },
        dataSource: { type: 'conversation', query: '', config: {} },
        metrics: ['id', 'status'],
        tableConfig: { columns: [], pageSize: 10 },
        position: { x: 0, y: 0, width: 6, height: 4 }
      };

      const data = await dashboardService.getWidgetData(widget);

      expect(data.type).toBe('table');
      expect(data.widgetId).toBe('table-widget');
      expect(data.pagination).toBeDefined();
    });

    it('should add metadata to widget data', async () => {
      const widget: DashboardWidget = {
        id: 'test-widget',
        type: 'metric',
        title: 'Test',
        config: {
          showTitle: true,
          showDescription: false,
          showLegend: false,
          showToolbar: false,
          realTime: false,
          refreshInterval: 10000,
          maxDataPoints: 100,
          theme: 'light',
          colors: ['#1890ff'],
          animation: true
        },
        dataSource: { type: 'conversation', query: '', config: {} },
        metric: 'test_metric',
        position: { x: 0, y: 0, width: 3, height: 2 }
      };

      const data = await dashboardService.getWidgetData(widget);

      expect(data.metadata).toBeDefined();
      expect(data.metadata.widgetId).toBe('test-widget');
      expect(data.metadata.lastUpdated).toBeDefined();
      expect(data.metadata.refreshInterval).toBe(10000);
    });
  });

  describe('getDashboardTemplates', () => {
    it('should return all templates when no category specified', async () => {
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'dashboard_template:template1' },
          { name: 'dashboard_template:template2' }
        ],
        list_complete: true
      });

      mockKV.get
        .mockResolvedValueOnce({ id: 'template1', name: 'Template 1', category: 'analytics' })
        .mockResolvedValueOnce({ id: 'template2', name: 'Template 2', category: 'support' });

      const templates = await dashboardService.getDashboardTemplates();

      expect(templates).toHaveLength(2);
      expect(mockKV.list).toHaveBeenCalledWith({ prefix: 'dashboard_template:' });
    });

    it('should filter templates by category', async () => {
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'dashboard_template:template1' },
          { name: 'dashboard_template:template2' }
        ],
        list_complete: true
      });

      mockKV.get
        .mockResolvedValueOnce({ id: 'template1', name: 'Template 1', category: 'analytics' })
        .mockResolvedValueOnce({ id: 'template2', name: 'Template 2', category: 'support' });

      const templates = await dashboardService.getDashboardTemplates('analytics');

      expect(templates).toHaveLength(1);
      expect(templates[0].category).toBe('analytics');
    });
  });

  describe('createDashboardTemplate', () => {
    it('should save template to KV', async () => {
      const template = {
        id: 'new-template',
        name: 'New Template',
        description: 'A new template',
        category: 'analytics',
        defaultLayout: { type: 'grid' as const, columns: 12, rows: 'auto' as const, gap: 16 },
        widgets: []
      };

      mockKV.put.mockResolvedValue(undefined);

      await dashboardService.createDashboardTemplate(template);

      expect(mockKV.put).toHaveBeenCalled();
      const putCall = mockKV.put.mock.calls[0];
      expect(putCall[0]).toBe('dashboard_template:new-template');
    });
  });

  describe('createDashboardFromTemplate', () => {
    it('should create dashboard from template', async () => {
      const template = {
        id: 'template1',
        name: 'Template 1',
        description: 'Test Template',
        category: 'analytics',
        defaultLayout: { type: 'grid' as const, columns: 12, rows: 'auto' as const, gap: 16 },
        widgets: []
      };

      mockKV.get.mockResolvedValue(template);
      mockKV.put.mockResolvedValue(undefined);

      const config = await dashboardService.createDashboardFromTemplate('user123', 'template1');

      expect(config.name).toBe('Template 1');
      expect(config.permissions.owner).toBe('user123');
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      mockKV.get.mockResolvedValue(null);

      await expect(dashboardService.createDashboardFromTemplate('user123', 'nonexistent'))
        .rejects.toThrow(/not found/);
    });

    it('should apply custom config when provided', async () => {
      const template = {
        id: 'template1',
        name: 'Template 1',
        description: 'Test Template',
        category: 'analytics',
        defaultLayout: { type: 'grid' as const, columns: 12, rows: 'auto' as const, gap: 16 },
        widgets: []
      };

      mockKV.get.mockResolvedValue(template);
      mockKV.put.mockResolvedValue(undefined);

      const customConfig = {
        name: 'My Custom Dashboard',
        theme: 'dark' as const
      };

      const config = await dashboardService.createDashboardFromTemplate('user123', 'template1', customConfig);

      expect(config.name).toBe('My Custom Dashboard');
      expect(config.theme).toBe('dark');
    });
  });

  describe('subscribeToRealTimeUpdates', () => {
    it('should throw error when real-time is disabled', async () => {
      const disabledService = new DashboardService(mockDB, mockKV, {
        realTimeEnabled: false
      });

      await expect(disabledService.subscribeToRealTimeUpdates('user123', 'dash1', () => {}))
        .rejects.toThrow(/disabled/);
    });

    it('should throw error when no real-time widgets found', async () => {
      const config: DashboardConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets: [
          {
            id: 'widget1',
            type: 'metric',
            title: 'Test',
            config: {
              showTitle: true,
              showDescription: false,
              showLegend: false,
              showToolbar: false,
              realTime: false, // Not real-time
              refreshInterval: 5000,
              maxDataPoints: 100,
              theme: 'light',
              colors: ['#1890ff'],
              animation: true
            },
            dataSource: { type: 'conversation', query: '', config: {} },
            metric: 'test',
            position: { x: 0, y: 0, width: 3, height: 2 }
          }
        ],
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockKV.get.mockResolvedValue(config);

      await expect(dashboardService.subscribeToRealTimeUpdates('user123', 'test', () => {}))
        .rejects.toThrow(/No real-time widgets/);
    });

    it('should return unsubscribe function', async () => {
      const config: DashboardConfig = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        layout: { type: 'grid', columns: 12, rows: 'auto', gap: 16 },
        widgets: [
          {
            id: 'widget1',
            type: 'metric',
            title: 'Test',
            config: {
              showTitle: true,
              showDescription: false,
              showLegend: false,
              showToolbar: false,
              realTime: true, // Real-time enabled
              refreshInterval: 5000,
              maxDataPoints: 100,
              theme: 'light',
              colors: ['#1890ff'],
              animation: true
            },
            dataSource: { type: 'conversation', query: '', config: {} },
            metric: 'test',
            position: { x: 0, y: 0, width: 3, height: 2 },
            realTime: true
          }
        ],
        permissions: { owner: 'user123', viewers: [], editors: [] },
        theme: 'light',
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockKV.get.mockResolvedValue(config);

      const unsubscribe = await dashboardService.subscribeToRealTimeUpdates('user123', 'test', () => {});

      expect(typeof unsubscribe).toBe('function');

      // Should not throw when called
      unsubscribe();
    });
  });
});
