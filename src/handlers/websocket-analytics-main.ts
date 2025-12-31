// WebSocket Analytics API Handler
// Phase 2: 長期優化 - 錯誤趨勢分析儀表板 API
// 專案：Multi-Channel Support MVP - WebSocket 監控系統

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { createAnalyticsService, AlertLevel } from '../monitoring/websocket-analytics-service';
import type { WebSocketErrorStats, ConnectionQualityMetrics } from '../monitoring/websocket-analytics-service';

const analyticsHandler = new Hono<{ Bindings: Bindings }>();

// =================== 儀表板 API ===================

// 獲取完整儀表板數據
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
      timestamp: Date.now(),
      generatedBy: user.id
    });

  } catch (error) {
    console.error('❌ [Analytics API] Dashboard error:', error);
    return c.json({
      error: 'Failed to fetch dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 獲取趨勢分析數據
analyticsHandler.get('/trends', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const timeRangeParam = c.req.query('timeRange');
    const timeRangeHours = timeRangeParam ? parseInt(timeRangeParam) : 24;

    // 驗證時間範圍
    if (timeRangeHours < 1 || timeRangeHours > 168) { // 最多 7 天
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
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Analytics API] Trends error:', error);
    return c.json({
      error: 'Failed to fetch trend data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 錯誤記錄 API ===================

// 記錄 WebSocket 錯誤 (供內部系統使用)
analyticsHandler.post('/errors', async (c) => {
  try {
    // 這個端點主要供內部系統調用，所以不需要 JWT 認證
    // 但需要驗證來源 (例如檢查 IP 或內部令牌)

    const errorData = await c.req.json() as WebSocketErrorStats;

    // 基本驗證
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
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Analytics API] Record error failed:', error);
    return c.json({
      error: 'Failed to record error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 記錄連接質量數據
analyticsHandler.post('/quality', async (c) => {
  try {
    const qualityData = await c.req.json() as ConnectionQualityMetrics;

    // 基本驗證
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
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Analytics API] Record quality error:', error);
    return c.json({
      error: 'Failed to record connection quality',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 告警管理 API ===================

// 手動觸發告警 (測試用)
analyticsHandler.post('/alerts/trigger', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以手動觸發告警
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

    // 驗證告警級別
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
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Analytics API] Trigger alert error:', error);
    return c.json({
      error: 'Failed to trigger alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 系統健康檢查 ===================

// 分析系統健康狀態
analyticsHandler.get('/health', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    // 檢查分析服務組件狀態
    const healthChecks = {
      analyticsService: true,
      kvStorage: false,
      trendGeneration: false,
      alertSystem: false
    };

    try {
      // 測試 KV 存儲
      await c.env.CACHE?.put('health_check', Date.now().toString(), { expirationTtl: 60 });
      const testValue = await c.env.CACHE?.get('health_check');
      healthChecks.kvStorage = testValue !== null;

      // 測試趨勢生成
      const analyticsService = createAnalyticsService(c.env);
      await analyticsService.generateTrendAnalysis(1);
      healthChecks.trendGeneration = true;

      // 測試告警系統
      await analyticsService.triggerAlert(AlertLevel.INFO, 'Health Check', 'System health verification');
      healthChecks.alertSystem = true;

    } catch (error) {
      console.warn('⚠️ [Analytics API] Health check component failed:', error);
    }

    const healthScore = Object.values(healthChecks).filter(Boolean).length / Object.keys(healthChecks).length;
    const overallHealth = healthScore >= 0.75 ? 'healthy' : healthScore >= 0.5 ? 'degraded' : 'unhealthy';

    return c.json({
      status: overallHealth,
      score: Math.round(healthScore * 100),
      components: healthChecks,
      timestamp: Date.now(),
      checkedBy: user.id
    });

  } catch (error) {
    console.error('❌ [Analytics API] Health check error:', error);
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 配置管理 API ===================

// 獲取告警配置
analyticsHandler.get('/config/alerts', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    // 獲取當前告警配置
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
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Analytics API] Get alert config error:', error);
    return c.json({
      error: 'Failed to get alert configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 更新告警配置
analyticsHandler.put('/config/alerts', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以修改告警配置
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const newConfig = await c.req.json();

    // 驗證配置值
    const requiredFields = ['errorRateThreshold', 'latencyThreshold', 'connectionFailureThreshold', 'userSatisfactionThreshold', 'timeWindowMinutes'];
    const missingFields = requiredFields.filter(field => !(field in newConfig));

    if (missingFields.length > 0) {
      return c.json({
        error: 'Missing required fields',
        missingFields
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證數值範圍
    if (newConfig.errorRateThreshold < 0 || newConfig.errorRateThreshold > 1) {
      return c.json({ error: 'errorRateThreshold must be between 0 and 1' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (newConfig.latencyThreshold < 0 || newConfig.latencyThreshold > 30000) {
      return c.json({ error: 'latencyThreshold must be between 0 and 30000ms' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 保存配置
    const configKey = 'ws_alert_config';
    await c.env.CACHE?.put(configKey, JSON.stringify(newConfig), {
      expirationTtl: 365 * 24 * 60 * 60 // 保存 1 年
    });

    console.log(`⚙️ [Analytics API] Alert config updated by ${user.displayName}:`, newConfig);

    return c.json({
      success: true,
      message: 'Alert configuration updated successfully',
      config: newConfig,
      updatedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Analytics API] Update alert config error:', error);
    return c.json({
      error: 'Failed to update alert configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 數據導出 API ===================

// 導出趨勢數據 (CSV 格式)
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
      // 生成 CSV 格式
      const csvData = [
        'Time Range,Total Connections,Successful Connections,Failed Connections,Average Latency,Peak Latency,User Satisfaction Score',
        `${trendData.timeRange},${trendData.totalConnections},${trendData.successfulConnections},${trendData.failedConnections},${trendData.averageLatency},${trendData.peakLatency},${trendData.userSatisfactionScore}`
      ].join('\n');

      return new Response(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="websocket-trends-${timeRange}h-${Date.now()}.csv"`
        }
      });
    }

    return c.json({
      success: true,
      data: trendData,
      exportedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Analytics API] Export trends error:', error);
    return c.json({
      error: 'Failed to export trend data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default analyticsHandler;