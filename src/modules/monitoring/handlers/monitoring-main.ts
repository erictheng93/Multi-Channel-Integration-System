// Monitoring and Alerting API Handler
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 提供監控指標、告警管理和健康檢查 API

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { createDOMonitor, type DurableObjectsMonitor } from '@/services/durable-objects-monitor';
import { getCircuitBreaker } from '@/services/websocket-circuit-breaker';
import { createLogger } from '@/services/logger-service';
import { nowMs } from '@/utils/timestamp'

const monitoringHandler = new Hono<{ Bindings: Bindings }>();
const logger = createLogger({ service: 'Monitoring-API' });

// =================== 健康檢查端點 ===================

/**
 * 系統整體健康檢查
 * GET /api/monitoring/health
 * Public endpoint - 不需要認證
 */
monitoringHandler.get('/health', async (c) => {
  try {
    const monitor = createDOMonitor(c.env);
    const stats = await monitor.performHealthCheck();
    const circuitBreaker = getCircuitBreaker();
    circuitBreaker.setEnv(c.env);

    const health = {
      status: stats.healthyInstances >= stats.totalInstances * 0.7 ? 'healthy' : 'degraded',
      timestamp: nowMs(),
      components: {
        durableObjects: {
          status: stats.unhealthyInstances === 0 ? 'healthy' : 'degraded',
          totalInstances: stats.totalInstances,
          healthyInstances: stats.healthyInstances,
          degradedInstances: stats.degradedInstances,
          unhealthyInstances: stats.unhealthyInstances
        },
        circuitBreaker: {
          status: circuitBreaker.getState(),
          stats: circuitBreaker.getStats()
        },
        alerts: {
          active: stats.activeAlerts,
          total: stats.totalAlerts
        }
      },
      summary: {
        totalInstances: stats.totalInstances,
        instancesByType: stats.instancesByType,
        lastUpdate: stats.lastUpdate
      }
    };

    const statusCode = health.status === 'healthy' ? HTTP_STATUS.OK : 207; // 207 Multi-Status

    logger.info('Health check completed', undefined, {
      status: health.status,
      totalInstances: stats.totalInstances,
      activeAlerts: stats.activeAlerts
    });

    return c.json(health, statusCode);

  } catch (error) {
    logger.error('Health check failed', error);

    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: nowMs()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 詳細監控指標
 * GET /api/monitoring/metrics
 * Requires: admin auth
 */
monitoringHandler.get('/metrics', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有 admin 可以訪問詳細指標
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const monitor = createDOMonitor(c.env);
    await monitor.performHealthCheck();

    const instanceMetrics = monitor.getInstanceMetrics();
    const circuitBreaker = getCircuitBreaker();
    circuitBreaker.setEnv(c.env);

    const metrics = {
      timestamp: nowMs(),
      durableObjects: {
        instances: instanceMetrics.map(m => ({
          type: m.objectType,
          id: m.instanceId,
          status: m.healthStatus,
          connections: m.activeConnections,
          latency: m.averageLatency,
          errorRate: m.errorRate,
          memory: m.memoryUsageMB,
          uptime: m.uptime
        })),
        summary: {
          total: instanceMetrics.length,
          byType: instanceMetrics.reduce((acc, m) => {
            acc[m.objectType] = (acc[m.objectType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          averageLatency: instanceMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / instanceMetrics.length || 0,
          totalConnections: instanceMetrics.reduce((sum, m) => sum + m.activeConnections, 0)
        }
      },
      circuitBreaker: {
        state: circuitBreaker.getState(),
        stats: circuitBreaker.getStats(),
        events: circuitBreaker.getEvents().slice(-20) // 最近 20 個事件
      }
    };

    logger.info('Metrics retrieved', {
      userId: String(user.id),
      instanceCount: instanceMetrics.length
    });

    return c.json(metrics);

  } catch (error) {
    logger.error('Failed to retrieve metrics', error);

    return c.json({
      error: 'Failed to retrieve metrics',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 告警管理端點 ===================

/**
 * 獲取活躍告警
 * GET /api/monitoring/alerts
 * Requires: admin or agent auth
 */
monitoringHandler.get('/alerts', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    const monitor = createDOMonitor(c.env);
    const activeAlerts = monitor.getActiveAlerts();

    const alerts = {
      count: activeAlerts.length,
      alerts: activeAlerts.map(alert => ({
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        age: Date.now() - alert.timestamp,
        metadata: alert.metadata
      })),
      timestamp: nowMs()
    };

    logger.info('Alerts retrieved', {
      userId: String(user.id),
      alertCount: activeAlerts.length
    });

    return c.json(alerts);

  } catch (error) {
    logger.error('Failed to retrieve alerts', error);

    return c.json({
      error: 'Failed to retrieve alerts',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 獲取告警歷史
 * GET /api/monitoring/alerts/history
 * Requires: admin auth
 * Query params: ?limit=100
 */
monitoringHandler.get('/alerts/history', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const limit = parseInt(c.req.query('limit') || '100');
    const monitor = createDOMonitor(c.env);
    const history = monitor.getAlertHistory(limit);

    const alerts = {
      count: history.length,
      limit,
      alerts: history,
      timestamp: nowMs()
    };

    logger.info('Alert history retrieved', {
      userId: String(user.id),
      count: history.length,
      limit
    });

    return c.json(alerts);

  } catch (error) {
    logger.error('Failed to retrieve alert history', error);

    return c.json({
      error: 'Failed to retrieve alert history',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Circuit Breaker 控制端點 ===================

/**
 * 獲取 Circuit Breaker 狀態
 * GET /api/monitoring/circuit-breaker/status
 * Requires: admin or agent auth
 */
monitoringHandler.get('/circuit-breaker/status', jwtAuth, async (c) => {
  try {
    const circuitBreaker = getCircuitBreaker();
    circuitBreaker.setEnv(c.env);

    const status = {
      state: circuitBreaker.getState(),
      stats: circuitBreaker.getStats(),
      timestamp: nowMs()
    };

    return c.json(status);

  } catch (error) {
    logger.error('Failed to get circuit breaker status', error);

    return c.json({
      error: 'Failed to get circuit breaker status',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 手動重置 Circuit Breaker
 * POST /api/monitoring/circuit-breaker/reset
 * Requires: admin auth
 */
monitoringHandler.post('/circuit-breaker/reset', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const circuitBreaker = getCircuitBreaker();
    circuitBreaker.setEnv(c.env);
    circuitBreaker.reset();

    logger.info('Circuit breaker reset manually', {
      userId: String(user.id)
    });

    return c.json({
      success: true,
      message: 'Circuit breaker reset successfully',
      newState: circuitBreaker.getState(),
      timestamp: nowMs()
    });

  } catch (error) {
    logger.error('Failed to reset circuit breaker', error);

    return c.json({
      error: 'Failed to reset circuit breaker',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 手動開啟 Circuit Breaker（緊急停止）
 * POST /api/monitoring/circuit-breaker/open
 * Requires: admin auth
 */
monitoringHandler.post('/circuit-breaker/open', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const circuitBreaker = getCircuitBreaker();
    circuitBreaker.setEnv(c.env);
    circuitBreaker.open();

    logger.critical('Circuit breaker opened manually', undefined, {
      userId: String(user.id)
    });

    return c.json({
      success: true,
      message: 'Circuit breaker opened (emergency stop)',
      newState: circuitBreaker.getState(),
      timestamp: nowMs()
    });

  } catch (error) {
    logger.error('Failed to open circuit breaker', error);

    return c.json({
      error: 'Failed to open circuit breaker',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== DO 實例管理端點 ===================

/**
 * 獲取特定類型的 DO 實例指標
 * GET /api/monitoring/instances/:type
 * Requires: admin auth
 * Params: type = ConversationRoom | UserConnection | MessageBroadcaster | DelayedMessageProcessor
 */
monitoringHandler.get('/instances/:type', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const type = c.req.param('type');
    const monitor = createDOMonitor(c.env);
    await monitor.performHealthCheck();

    const instances = monitor.getInstanceMetricsByType(type);

    return c.json({
      type,
      count: instances.length,
      instances: instances.map(i => ({
        id: i.instanceId,
        status: i.healthStatus,
        connections: i.activeConnections,
        latency: i.averageLatency,
        errorRate: i.errorRate,
        uptime: i.uptime,
        lastActivity: i.lastActivity,
        alerts: i.alerts
      })),
      timestamp: nowMs()
    });

  } catch (error) {
    logger.error('Failed to get instance metrics', error);

    return c.json({
      error: 'Failed to get instance metrics',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 執行手動健康檢查
 * POST /api/monitoring/health-check
 * Requires: admin auth
 */
monitoringHandler.post('/health-check', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const monitor = createDOMonitor(c.env);
    const stats = await monitor.performHealthCheck();

    logger.info('Manual health check performed', {
      userId: String(user.id),
      totalInstances: stats.totalInstances,
      healthyInstances: stats.healthyInstances
    });

    return c.json({
      success: true,
      stats,
      timestamp: nowMs()
    });

  } catch (error) {
    logger.error('Manual health check failed', error);

    return c.json({
      error: 'Health check failed',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default monitoringHandler;
