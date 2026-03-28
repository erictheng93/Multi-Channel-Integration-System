// WebSocket Analytics API Handler
// Phase 2: Long-term optimization - Error trend analysis dashboard API
// Multi-Channel Support MVP - WebSocket Monitoring System

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('WebsocketAnalytics')

import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import { jwtAuth } from '@/middleware/auth';
import { createAnalyticsService, AlertLevel } from '@/monitoring/websocket-analytics-service';
import type { WebSocketErrorStats, ConnectionQualityMetrics } from '@/monitoring/websocket-analytics-service';
import { nowMs } from '@/utils/timestamp'

const analyticsHandler = new Hono<{ Bindings: Bindings }>();

// =================== Dashboard API ===================

// Get complete dashboard data
analyticsHandler.get('/dashboard', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({
        error: 'Insufficient permissions',
        message: 'Only administrators can access analytics'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const analyticsService = createAnalyticsService(c.env);
    const dashboardData = await analyticsService.getDashboardData();

    return c.json({
      success: true,
      data: dashboardData,
      timestamp: nowMs(),
      generatedBy: user.id
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Get trend analysis data
analyticsHandler.get('/trends', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const timeRangeParam = c.req.query('timeRange');
    const timeRangeHours = timeRangeParam ? parseInt(timeRangeParam) : 24;

    // Validate time range
    if (timeRangeHours < 1 || timeRangeHours > 168) { // Max 7 days
      return c.json({
        error: 'Invalid time range',
        message: 'Time range must be between 1 and 168 hours'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const analyticsService = createAnalyticsService(c.env);
    const trendData = await analyticsService.generateTrendAnalysis(timeRangeHours);

    return c.json({
      success: true,
      data: trendData,
      timeRange: `${timeRangeHours}h`,
      timestamp: nowMs()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== Error Recording API ===================

// Record WebSocket error (for internal system use)
analyticsHandler.post('/errors', async (c) => {
  try {
    // This endpoint is mainly called by internal systems, so JWT auth is not required
    // But source verification is needed (e.g., checking IP or internal token)

    const errorData = await c.req.json() as WebSocketErrorStats;

    // Basic validation
    if (!errorData.timestamp || !errorData.errorCode || !errorData.errorType) {
      return c.json({
        error: 'Invalid error data',
        message: 'timestamp, errorCode, and errorType are required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const analyticsService = createAnalyticsService(c.env);
    await analyticsService.recordError(errorData);

    return c.json({
      success: true,
      message: 'Error recorded successfully',
      errorId: `${errorData.timestamp}-${errorData.errorCode}`,
      timestamp: nowMs()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Record connection quality data
analyticsHandler.post('/quality', async (c) => {
  try {
    const qualityData = await c.req.json() as ConnectionQualityMetrics;

    // Basic validation
    if (!qualityData.timestamp || !qualityData.userId || !qualityData.connectionId) {
      return c.json({
        error: 'Invalid quality data',
        message: 'timestamp, userId, and connectionId are required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const analyticsService = createAnalyticsService(c.env);
    await analyticsService.recordConnectionQuality(qualityData);

    return c.json({
      success: true,
      message: 'Connection quality recorded successfully',
      timestamp: nowMs()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== Alert Management API ===================

// Manually trigger alert (for testing)
analyticsHandler.post('/alerts/trigger', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // Only admins can manually trigger alerts
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const { level, title, description } = await c.req.json();

    if (!level || !title || !description) {
      return c.json({
        error: 'Missing required fields',
        message: 'level, title, and description are required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Validate alert level
    const validLevels = ['info', 'warning', 'critical', 'emergency'];
    if (!validLevels.includes(level)) {
      return c.json({
        error: 'Invalid alert level',
        message: 'Level must be one of: info, warning, critical, emergency'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const analyticsService = createAnalyticsService(c.env);
    await analyticsService.triggerAlert(level as AlertLevel, title, `Manual trigger by ${user.displayName}: ${description}`);

    return c.json({
      success: true,
      message: 'Alert triggered successfully',
      alert: { level, title, description },
      triggeredBy: user.id,
      timestamp: nowMs()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== System Health Check ===================

// Analyze system health status
analyticsHandler.get('/health', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    // Check analytics service component status
    const healthChecks = {
      analyticsService: true,
      kvStorage: false,
      trendGeneration: false,
      alertSystem: false
    };

    try {
      // Test KV storage
      await c.env.CACHE?.put('health_check', Date.now().toString(), { expirationTtl: 60 });
      const testValue = await c.env.CACHE?.get('health_check');
      healthChecks.kvStorage = testValue !== null;

      // Test trend generation
      const analyticsService = createAnalyticsService(c.env);
      await analyticsService.generateTrendAnalysis(1);
      healthChecks.trendGeneration = true;

      // Test alert system
      await analyticsService.triggerAlert(AlertLevel.INFO, 'Health Check', 'System health verification');
      healthChecks.alertSystem = true;

    } catch (error) {
      log.warn('Health check component failed', { error: error instanceof Error ? error.message : String(error) });
    }

    const healthScore = Object.values(healthChecks).filter(Boolean).length / Object.keys(healthChecks).length;
    const overallHealth = healthScore >= 0.75 ? 'healthy' : healthScore >= 0.5 ? 'degraded' : 'unhealthy';

    return c.json({
      status: overallHealth,
      score: Math.round(healthScore * 100),
      components: healthChecks,
      timestamp: nowMs(),
      checkedBy: user.id
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== Configuration Management API ===================

// Get alert configuration
analyticsHandler.get('/config/alerts', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    // Get current alert configuration
    const configKey = 'ws_alert_config';
    const config = await c.env.CACHE?.get(configKey);

    const defaultConfig = {
      errorRateThreshold: 0.1,
      latencyThreshold: 2000,
      connectionFailureThreshold: 5,
      userSatisfactionThreshold: 0.8,
      timeWindowMinutes: 15
    };

    return c.json({
      success: true,
      config: config ? JSON.parse(config) : defaultConfig,
      isDefault: !config,
      timestamp: nowMs()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Update alert configuration
analyticsHandler.put('/config/alerts', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // Only admins can modify alert configuration
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const newConfig = await c.req.json();

    // Validate configuration values
    const requiredFields = ['errorRateThreshold', 'latencyThreshold', 'connectionFailureThreshold', 'userSatisfactionThreshold', 'timeWindowMinutes'];
    const missingFields = requiredFields.filter(field => !(field in newConfig));

    if (missingFields.length > 0) {
      return c.json({
        error: 'Missing required fields',
        missingFields
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Validate numeric ranges
    if (newConfig.errorRateThreshold < 0 || newConfig.errorRateThreshold > 1) {
      return c.json({ error: 'errorRateThreshold must be between 0 and 1' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (newConfig.latencyThreshold < 0 || newConfig.latencyThreshold > 30000) {
      return c.json({ error: 'latencyThreshold must be between 0 and 30000ms' }, HTTP_STATUS.BAD_REQUEST);
    }

    // Save configuration
    const configKey = 'ws_alert_config';
    await c.env.CACHE?.put(configKey, JSON.stringify(newConfig), {
      expirationTtl: 365 * 24 * 60 * 60 // Save for 1 year
    });

    log.info(`Alert config updated by ${user.displayName}`);

    return c.json({
      success: true,
      message: 'Alert configuration updated successfully',
      config: newConfig,
      updatedBy: user.id,
      timestamp: nowMs()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== Data Export API ===================

// Export trend data (CSV format)
analyticsHandler.get('/export/trends', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const format = c.req.query('format') || 'json';
    const timeRange = parseInt(c.req.query('timeRange') || '24');

    const analyticsService = createAnalyticsService(c.env);
    const trendData = await analyticsService.generateTrendAnalysis(timeRange);

    if (format === 'csv') {
      // Generate CSV format
      const csvData = [
        'Time Range,Total Connections,Successful Connections,Failed Connections,Average Latency,Peak Latency,User Satisfaction Score',
        `${trendData.timeRange},${trendData.totalConnections},${trendData.successfulConnections},${trendData.failedConnections},${trendData.averageLatency},${trendData.peakLatency},${trendData.userSatisfactionScore}`
      ].join('\n');

      return new Response(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="websocket-trends-${timeRange}h-${nowMs()}.csv"`
        }
      });
    }

    return c.json({
      success: true,
      data: trendData,
      exportedBy: user.id,
      timestamp: nowMs()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default analyticsHandler;
