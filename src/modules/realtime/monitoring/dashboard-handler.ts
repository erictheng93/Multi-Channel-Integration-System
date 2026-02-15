// Real-time 監控儀表板處理器

import { Context } from 'hono';
import type { Bindings } from '@/types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  handleApiError
} from '@/utils/api-response';
import { RealtimePerformanceMonitor } from '@modules/realtime/monitoring/performance-monitor';
import { RealtimeManager } from '@modules/realtime/services/realtime-manager';
// Phase 3: SSE completely removed (2025-10-17) - WebSocket only
// SSE Manager removed, all connections now via WebSocket (ConversationRoom DO)
import { eventStats } from '@modules/realtime/handlers/event-handler';
import { RealtimeVersionSelector } from '@modules/realtime/config/version-selector';

// 儀表板處理器
export const dashboardHandler = {
  // 獲取總覽資訊
  getOverview: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      // 獲取性能監控數據
      const performanceMonitor = RealtimePerformanceMonitor.getInstance();
      const performanceSummary = performanceMonitor.getPerformanceSummary();
      const latestMetrics = performanceMonitor.getLatestMetrics();

      // 獲取服務狀態
      const manager = RealtimeManager.getInstance();
      const serviceHealth = await manager.getServiceHealth();

      // Phase 3: SSE removed - WebSocket connections managed by Durable Objects
      // No centralized connection stats available (each ConversationRoom DO manages its own)

      // 獲取事件統計
      const eventStatsData = eventStats.getStats();

      // 獲取版本信息
      const versionSelector = RealtimeVersionSelector.getInstance();
      const capabilities = versionSelector.getCurrentCapabilities();

      const overview = {
        service: {
          status: serviceHealth.status,
          uptime: serviceHealth.uptime,
          version: manager.getStatus()
        },
        performance: performanceSummary,
        connections: {
          type: 'websocket', // Phase 3: WebSocket only
          note: 'SSE removed - connections managed by ConversationRoom Durable Objects',
          total: 0, // No centralized counter available
          byUser: 0
        },
        events: {
          total: eventStatsData.totalEvents,
          successRate: eventStatsData.successRate,
          averageProcessingTime: eventStatsData.averageProcessingTime,
          breakdown: eventStatsData.eventsByType
        },
        metrics: latestMetrics ? {
          timestamp: latestMetrics.timestamp,
          eventProcessingRate: latestMetrics.events.eventProcessingRate,
          queueDepth: latestMetrics.queue.queueDepth,
          connectionFailureRate: latestMetrics.connection.connectionFailureRate
        } : null,
        capabilities: capabilities ? {
          hasQueue: capabilities.hasCloudflareQueue,
          hasKV: capabilities.hasKVStorage,
          hasDB: capabilities.hasD1Database,
          supportsWebSockets: capabilities.clientCapabilities.supportsWebSockets
        } : null,
        timestamp: new Date().toISOString()
      };

      return successResponse(c, overview, 'Dashboard overview retrieved');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取詳細指標
  getMetrics: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const limit = parseInt(c.req.query('limit') || '50');
      const performanceMonitor = RealtimePerformanceMonitor.getInstance();

      const metricsHistory = performanceMonitor.getMetricsHistory(limit);
      const latestMetrics = performanceMonitor.getLatestMetrics();

      return successResponse(c, {
        latest: latestMetrics,
        history: metricsHistory,
        totalPoints: metricsHistory.length
      }, 'Metrics data retrieved');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取警報信息
  getAlerts: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const onlyActive = c.req.query('active') === 'true';
      const limit = parseInt(c.req.query('limit') || '100');

      const performanceMonitor = RealtimePerformanceMonitor.getInstance();

      const alerts = onlyActive
        ? performanceMonitor.getActiveAlerts()
        : performanceMonitor.getAllAlerts(limit);

      const alertsSummary = {
        total: alerts.length,
        byLevel: alerts.reduce((acc, alert) => {
          acc[alert.level] = (acc[alert.level] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recent: alerts.filter(alert => {
          const alertTime = new Date(alert.timestamp).getTime();
          const now = Date.now();
          return now - alertTime < 24 * 60 * 60 * 1000; // 24小時內
        }).length
      };

      return successResponse(c, {
        alerts,
        summary: alertsSummary
      }, 'Alerts data retrieved');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 解決警報
  resolveAlert: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const { alertId } = await c.req.json();
      if (!alertId) {
        return errorResponse(c, 'Alert ID is required', 400);
      }

      const performanceMonitor = RealtimePerformanceMonitor.getInstance();
      const resolved = performanceMonitor.resolveAlert(alertId);

      if (resolved) {
        return successResponse(c, { alertId, resolved: true }, 'Alert resolved');
      } else {
        return errorResponse(c, 'Alert not found or already resolved', 404);
      }

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取連接詳情
  // Phase 3: DEPRECATED - SSE removed, use WebSocket Durable Objects metrics instead
  getConnections: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      // Phase 3: SSE removed - WebSocket connections managed by Durable Objects
      const connectionDetails = {
        deprecated: true,
        message: 'SSE connections removed in Phase 3. WebSocket connections are now managed by ConversationRoom Durable Objects.',
        recommendation: 'Use /api/websocket/dashboard/stats for WebSocket connection metrics',
        summary: {
          type: 'websocket',
          total: 0, // No centralized connection counter
          byUser: {},
          byConversation: {}
        },
        timestamp: new Date().toISOString()
      };

      return successResponse(c, connectionDetails, 'SSE endpoint deprecated - use WebSocket metrics');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取系統健康狀態
  getHealth: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const manager = RealtimeManager.getInstance();
      const serviceHealth = await manager.getServiceHealth();
      const env = c.env;

      // 獲取詳細的健康檢查信息
      let databaseHealth: { status: 'healthy' | 'degraded' | 'down'; responseTime?: number };
      let kvHealth: { status: 'healthy' | 'degraded' | 'down'; responseTime?: number };
      let queueHealth: { status: 'healthy' | 'degraded' | 'down' };

      if (env?.DB) {
        databaseHealth = await dashboardHandler.checkDatabaseHealth(env as Bindings);
      } else {
        databaseHealth = { status: 'down' as const };
      }

      if (env?.SESSIONS) {
        kvHealth = await dashboardHandler.checkKVHealth(env as Bindings);
      } else {
        kvHealth = { status: 'down' as const };
      }

      // Phase 2: Check Durable Objects instead of Queue
      if (env?.MESSAGE_BROADCASTER && env?.LATEST_MESSAGE_COORDINATOR) {
        queueHealth = await dashboardHandler.checkQueueHealth(env as Bindings);
      } else {
        queueHealth = { status: 'down' as const };
      }

      const healthDetails = {
        ...serviceHealth,
        checks: {
          database: databaseHealth,
          kvStorage: kvHealth,
          queue: queueHealth,
          sse: await dashboardHandler.checkSSEHealth()
        }
      };

      return successResponse(c, healthDetails, 'Health status retrieved');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取版本信息
  getVersionInfo: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const versionSelector = RealtimeVersionSelector.getInstance();
      const allVersions = versionSelector.getAllVersions();
      const capabilities = versionSelector.getCurrentCapabilities();

      // 獲取當前版本選擇
      const versionSelection = await versionSelector.selectBestVersion(c.env, c);

      const versionInfo = {
        current: versionSelection,
        available: allVersions,
        capabilities,
        recommendations: Object.entries(allVersions).map(([key, version]) => {
          const upgrade = versionSelector.getUpgradeRecommendation(key as any);
          return {
            version: key,
            ...upgrade
          };
        })
      };

      return successResponse(c, versionInfo, 'Version information retrieved');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 執行維護操作
  performMaintenance: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin access required');
      }

      const { operation, target } = await c.req.json();

      if (!operation || !target) {
        return errorResponse(c, 'Operation and target are required', 400);
      }

      let result;

      switch (target) {
        case 'manager':
          const manager = RealtimeManager.getInstance();
          result = await manager.performMaintenance(operation);
          break;

        case 'sse':
          // Phase 3: SSE removed - operation no longer supported
          result = {
            deprecated: true,
            message: 'SSE maintenance operations removed in Phase 3',
            cleanedConnections: 0
          };
          break;

        case 'monitor':
          const performanceMonitor = RealtimePerformanceMonitor.getInstance();
          if (operation === 'restart') {
            performanceMonitor.stopMonitoring();
            performanceMonitor.startMonitoring();
            result = { restarted: true };
          }
          break;

        default:
          return errorResponse(c, `Unknown maintenance target: ${target}`, 400);
      }

      return successResponse(c, {
        operation,
        target,
        result,
        timestamp: new Date().toISOString()
      }, 'Maintenance operation completed');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 私有健康檢查方法
  async checkDatabaseHealth(env: Bindings): Promise<{ status: 'healthy' | 'degraded' | 'down'; responseTime?: number }> {
    if (!env?.DB) return { status: 'down' };

    try {
      const start = Date.now();
      await env.DB.prepare('SELECT 1').first();
      const responseTime = Date.now() - start;

      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error) {
      return { status: 'down' };
    }
  },

  async checkKVHealth(env: Bindings): Promise<{ status: 'healthy' | 'degraded' | 'down'; responseTime?: number }> {
    if (!env?.SESSIONS) return { status: 'down' };

    try {
      const start = Date.now();
      await env.SESSIONS.get('health_check');
      const responseTime = Date.now() - start;

      return {
        status: responseTime < 500 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error) {
      return { status: 'down' };
    }
  },

  // Phase 2: Check Durable Objects health instead of Queue
  async checkQueueHealth(env: Bindings): Promise<{ status: 'healthy' | 'degraded' | 'down' }> {
    // Queue replaced by Durable Objects (MessageBroadcaster, LatestMessageCacheCoordinator)
    if (!env?.MESSAGE_BROADCASTER || !env?.LATEST_MESSAGE_COORDINATOR) {
      return { status: 'down' };
    }

    try {
      // Check if Durable Objects are available
      // In production, this could involve more complex checks
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'down' };
    }
  },

  async checkSSEHealth(): Promise<{ status: 'healthy' | 'degraded' | 'down'; connections?: number }> {
    // Phase 3: SSE removed - always return 'down' status
    // SSE infrastructure no longer exists, replaced by WebSocket
    return {
      status: 'down',
      connections: 0
    };
  }
};

// 個別處理器函數導出
export const metricsHistoryHandler = dashboardHandler.getMetrics;
export const alertsHandler = dashboardHandler.getAlerts;
export const healthHandler = dashboardHandler.getHealth;
export const configHandler = dashboardHandler.getVersionInfo;