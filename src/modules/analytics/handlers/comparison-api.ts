// Period Comparison API Handler
// 提供期間比較的 RESTful API endpoints

import { Hono } from 'hono';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings } from '@/types';
import { PeriodComparisonService } from '@modules/analytics/services/period-comparison-service';
import { AnalyticsCacheService } from '@modules/analytics/services/analytics-cache-service';
import type { Period } from '@modules/analytics/services/period-comparison-service';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { nowISO } from '@/utils/timestamp'

const comparisonAPI = new Hono<{ Bindings: Bindings }>();

// ✅ CORS 處理已移至 src/index.ts 統一管理
// 不再需要模組級別的 CORS middleware

/**
 * GET /api/analytics/comparison/metric
 * 單一指標期間比較
 *
 * Query Parameters:
 * - metric: string (required) - 指標名稱
 * - currentStart: string (required) - 當前期間開始時間 (ISO 8601)
 * - currentEnd: string (required) - 當前期間結束時間 (ISO 8601)
 * - previousStart?: string - 上一期間開始時間 (可選，自動計算)
 * - previousEnd?: string - 上一期間結束時間 (可選，自動計算)
 * - teamId?: number - 團隊篩選
 * - userId?: number - 用戶篩選
 */
comparisonAPI.get('/metric', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const cacheService = new AnalyticsCacheService(c.env.KV as any);
    const comparisonService = new PeriodComparisonService(db, cacheService);

    // 解析查詢參數
    const metric = c.req.query('metric');
    const currentStart = c.req.query('currentStart');
    const currentEnd = c.req.query('currentEnd');
    const previousStart = c.req.query('previousStart');
    const previousEnd = c.req.query('previousEnd');
    const teamId = c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined;
    const userId = c.req.query('userId') ? parseInt(c.req.query('userId')!) : undefined;

    // 驗證必要參數
    if (!metric || !currentStart || !currentEnd) {
      return c.json({
        success: false,
        error: 'Missing required parameters: metric, currentStart, currentEnd'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 構建查詢
    const currentPeriod: Period = {
      start: currentStart,
      end: currentEnd
    };

    const previousPeriod = (previousStart && previousEnd) ? {
      start: previousStart,
      end: previousEnd
    } : undefined;

    const filters = {
      teamId,
      userId
    };

    // 執行比較
    const comparison = await comparisonService.compareMetric({
      metric,
      currentPeriod,
      previousPeriod,
      filters
    });

    return c.json({
      success: true,
      data: comparison,
      metadata: {
        metric,
        currentPeriod,
        previousPeriod: comparison.period.previous,
        processedAt: nowISO()
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/analytics/comparison/metrics
 * 多指標批量比較
 *
 * Query Parameters:
 * - metrics: string (required) - 逗號分隔的指標列表
 * - currentStart: string (required)
 * - currentEnd: string (required)
 * - previousStart?: string
 * - previousEnd?: string
 * - teamId?: number
 * - userId?: number
 */
comparisonAPI.get('/metrics', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const cacheService = new AnalyticsCacheService(c.env.KV as any);
    const comparisonService = new PeriodComparisonService(db, cacheService);

    // 解析查詢參數
    const metricsParam = c.req.query('metrics');
    const currentStart = c.req.query('currentStart');
    const currentEnd = c.req.query('currentEnd');
    const previousStart = c.req.query('previousStart');
    const previousEnd = c.req.query('previousEnd');
    const teamId = c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined;
    const userId = c.req.query('userId') ? parseInt(c.req.query('userId')!) : undefined;

    // 驗證必要參數
    if (!metricsParam || !currentStart || !currentEnd) {
      return c.json({
        success: false,
        error: 'Missing required parameters: metrics, currentStart, currentEnd'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 解析指標列表
    const metrics = metricsParam.split(',').map(m => m.trim());

    if (metrics.length === 0) {
      return c.json({
        success: false,
        error: 'At least one metric must be specified'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 構建查詢
    const currentPeriod: Period = {
      start: currentStart,
      end: currentEnd
    };

    const previousPeriod = (previousStart && previousEnd) ? {
      start: previousStart,
      end: previousEnd
    } : undefined;

    const filters = {
      teamId,
      userId
    };

    // 執行批量比較
    const comparison = await comparisonService.compareMultipleMetrics(
      metrics,
      currentPeriod,
      previousPeriod,
      filters
    );

    return c.json({
      success: true,
      data: comparison,
      metadata: {
        metricsCount: metrics.length,
        currentPeriod,
        previousPeriod: Object.values(comparison.metrics)[0]?.period.previous,
        processedAt: nowISO()
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/analytics/comparison/preset/conversation
 * 對話指標預設比較
 */
comparisonAPI.get('/preset/conversation', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const cacheService = new AnalyticsCacheService(c.env.KV as any);
    const comparisonService = new PeriodComparisonService(db, cacheService);

    const currentStart = c.req.query('currentStart');
    const currentEnd = c.req.query('currentEnd');
    const teamId = c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined;

    if (!currentStart || !currentEnd) {
      return c.json({
        success: false,
        error: 'Missing required parameters: currentStart, currentEnd'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const currentPeriod: Period = { start: currentStart, end: currentEnd };
    const filters = { teamId };

    const comparison = await comparisonService.compareConversationMetrics(
      currentPeriod,
      undefined,
      filters
    );

    return c.json({
      success: true,
      data: comparison,
      metadata: {
        preset: 'conversation',
        processedAt: nowISO()
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/analytics/comparison/preset/message
 * 消息指標預設比較
 */
comparisonAPI.get('/preset/message', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const cacheService = new AnalyticsCacheService(c.env.KV as any);
    const comparisonService = new PeriodComparisonService(db, cacheService);

    const currentStart = c.req.query('currentStart');
    const currentEnd = c.req.query('currentEnd');
    const teamId = c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined;

    if (!currentStart || !currentEnd) {
      return c.json({
        success: false,
        error: 'Missing required parameters: currentStart, currentEnd'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const currentPeriod: Period = { start: currentStart, end: currentEnd };
    const filters = { teamId };

    const comparison = await comparisonService.compareMessageMetrics(
      currentPeriod,
      undefined,
      filters
    );

    return c.json({
      success: true,
      data: comparison,
      metadata: {
        preset: 'message',
        processedAt: nowISO()
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/analytics/comparison/preset/user-activity
 * 用戶活動指標預設比較
 */
comparisonAPI.get('/preset/user-activity', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const cacheService = new AnalyticsCacheService(c.env.KV as any);
    const comparisonService = new PeriodComparisonService(db, cacheService);

    const currentStart = c.req.query('currentStart');
    const currentEnd = c.req.query('currentEnd');
    const teamId = c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined;

    if (!currentStart || !currentEnd) {
      return c.json({
        success: false,
        error: 'Missing required parameters: currentStart, currentEnd'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const currentPeriod: Period = { start: currentStart, end: currentEnd };
    const filters = { teamId };

    const comparison = await comparisonService.compareUserActivityMetrics(
      currentPeriod,
      undefined,
      filters
    );

    return c.json({
      success: true,
      data: comparison,
      metadata: {
        preset: 'user-activity',
        processedAt: nowISO()
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/analytics/comparison/cache/stats
 * 獲取比較查詢的快取統計
 */
comparisonAPI.get('/cache/stats', async (c) => {
  try {
    const cacheService = new AnalyticsCacheService(c.env.KV as any);
    await cacheService.loadStats();

    const stats = await cacheService.getStats();

    return c.json({
      success: true,
      data: stats,
      metadata: {
        processedAt: nowISO()
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default comparisonAPI;
export { comparisonAPI };