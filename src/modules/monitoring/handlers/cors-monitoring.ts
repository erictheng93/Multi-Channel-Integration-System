// CORS 監控端點
// 提供 CORS 錯誤追蹤和統計數據的 API

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '@/types';
import { CORSMonitor } from '@/monitoring/cors-monitor';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp'

const corsMonitoringHandler = new Hono<{ Bindings: Bindings }>();

/**
 * 獲取 CORS 統計數據
 * GET /api/cors/stats
 *
 * 需要 admin 權限
 */
corsMonitoringHandler.get('/stats', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 檢查權限
    const payload = c.get('jwtPayload');
    if (!payload || payload.role !== 'admin') {
      return unauthorizedResponse(c, 'Admin access required');
    }

    const monitor = new CORSMonitor(c.env);
    const stats = await monitor.getStats();

    return successResponse(c, stats, 'CORS statistics retrieved successfully');
  } catch (error) {
    console.error('Failed to get CORS stats:', error);
    return errorResponse(c, 'Failed to retrieve CORS statistics', 500);
  }
});

/**
 * 獲取最近的 CORS 事件
 * GET /api/cors/events?limit=50&type=rejected
 *
 * Query params:
 * - limit: 返回的事件數量 (default: 50, max: 200)
 * - type: 事件類型篩選 (allowed, rejected, preflight, sse_connection, credentials_used)
 *
 * 需要 admin 權限
 */
corsMonitoringHandler.get('/events', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 檢查權限
    const payload = c.get('jwtPayload');
    if (!payload || payload.role !== 'admin') {
      return unauthorizedResponse(c, 'Admin access required');
    }

    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const typeFilter = c.req.query('type');

    const monitor = new CORSMonitor(c.env);
    const stats = await monitor.getStats();

    let events = stats.recentEvents;

    // 應用類型篩選
    if (typeFilter) {
      events = events.filter(e => e.type === typeFilter);
    }

    // 應用數量限制
    events = events.slice(0, limit);

    return successResponse(c, {
      events,
      total: events.length,
      filtered: !!typeFilter,
      filterType: typeFilter || null
    }, 'CORS events retrieved successfully');
  } catch (error) {
    console.error('Failed to get CORS events:', error);
    return errorResponse(c, 'Failed to retrieve CORS events', 500);
  }
});

/**
 * 獲取被拒絕的 origin 列表
 * GET /api/cors/rejected-origins
 *
 * 返回最常被拒絕的 origin 及其次數
 *
 * 需要 admin 權限
 */
corsMonitoringHandler.get('/rejected-origins', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 檢查權限
    const payload = c.get('jwtPayload');
    if (!payload || payload.role !== 'admin') {
      return unauthorizedResponse(c, 'Admin access required');
    }

    const monitor = new CORSMonitor(c.env);
    const stats = await monitor.getStats();

    return successResponse(c, {
      rejectedOrigins: stats.topRejectedOrigins,
      totalRejected: stats.rejected,
      rejectionRate: stats.total > 0 ? (stats.rejected / stats.total * 100).toFixed(2) + '%' : '0%'
    }, 'Rejected origins retrieved successfully');
  } catch (error) {
    console.error('Failed to get rejected origins:', error);
    return errorResponse(c, 'Failed to retrieve rejected origins', 500);
  }
});

/**
 * 清理過期的 CORS 事件
 * POST /api/cors/cleanup
 *
 * 刪除超過 24 小時的事件記錄
 *
 * 需要 admin 權限
 */
corsMonitoringHandler.post('/cleanup', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 檢查權限
    const payload = c.get('jwtPayload');
    if (!payload || payload.role !== 'admin') {
      return unauthorizedResponse(c, 'Admin access required');
    }

    const monitor = new CORSMonitor(c.env);
    const cleaned = await monitor.cleanup();

    return successResponse(c, {
      cleaned,
      message: `Cleaned ${cleaned} expired CORS events`
    }, 'CORS events cleanup completed successfully');
  } catch (error) {
    console.error('Failed to cleanup CORS events:', error);
    return errorResponse(c, 'Failed to cleanup CORS events', 500);
  }
});

/**
 * 健康檢查端點
 * GET /api/cors/health
 */
corsMonitoringHandler.get('/health', (c: Context<{ Bindings: Bindings }>) => {
  return c.json({
    status: 'healthy',
    timestamp: nowISO(),
    service: 'cors-monitoring'
  });
});

/**
 * 獲取 CORS 配置信息
 * GET /api/cors/config
 *
 * 返回當前的 CORS 配置（不包含敏感信息）
 */
corsMonitoringHandler.get('/config', (c: Context<{ Bindings: Bindings }>) => {
  // 使用動態 CORS 配置
  const { getAllowedOrigins } = require('@/config/cors');
  const dynamicOrigins = getAllowedOrigins(c.env);

  return successResponse(c, {
    allowedOrigins: [
      ...dynamicOrigins,
      '*.pages.dev (Cloudflare Pages preview branches)',
    ],
    features: {
      credentialsSupport: true,
      preflightCaching: '86400 seconds (24 hours)',
      sseSupport: true,
      wildcardFallback: 'For unknown origins in SSE endpoints only'
    },
    documentation: '/docs/CORS_CONFIGURATION_GUIDE.md'
  }, 'CORS configuration retrieved successfully');
});

export default corsMonitoringHandler;
