// Analytics Main Handler - 統一分析服務 API 處理器

import { Hono } from 'hono';
import { createDbClient } from '@/db/drizzle-factory';
import { sql } from 'drizzle-orm';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import { MetricsCollector } from '@modules/analytics/services/metrics-collector';
import { analyticsAuth } from '@modules/analytics/middleware/analytics-auth';
import type { Bindings } from '@/types';
import type {
  ConversationAnalyticsQuery,
  MessageAnalyticsQuery,
  UserAnalyticsQuery,
  PerformanceAnalyticsQuery,
  CustomAnalyticsQuery,
  ExportQuery,
  TimeRange,
  ConversationMetric,
  MessageMetric,
  UserMetric,
  PerformanceMetric
} from '../types/analytics-types';

/**
 * Analytics API 路由處理器
 * 提供統一的分析服務 REST API
 */
export const analyticsHandler = new Hono<{ Bindings: Bindings }>();

// 應用身份驗證中間件
analyticsHandler.use('/*', analyticsAuth);

/**
 * GET /analytics/conversations
 * 獲取對話分析數據
 */
analyticsHandler.get('/conversations', async (c) => {
  const analyticsService = new AnalyticsService({
    database: createDbClient(c.env.DB),
    kv: c.env.KV,
    env: c.env
  });

  const timeRange = c.req.query('timeRange') || '7d';
  const metrics = (c.req.query('metrics') || 'total_conversations,active_conversations').split(',');
  const platform = c.req.query('platform');
  const orderByStr = c.req.query('orderBy');

  const query: ConversationAnalyticsQuery = {
    timeRange: timeRange as TimeRange,
    startDate: c.req.query('startDate'),
    endDate: c.req.query('endDate'),
    metrics: metrics as ConversationMetric[],
    filters: {
      teamId: c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined,
      platform: platform as 'line' | 'facebook' | 'web' | undefined,
      status: c.req.query('status')
    },
    groupBy: c.req.query('groupBy')?.split(',') || [],
    orderBy: orderByStr?.split(',').map(item => {
      const [field, direction] = item.split(':');
      return { field: field || '', direction: (direction as 'asc' | 'desc') || 'desc' };
    }) || [],
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
  };

  const result = await analyticsService.getConversationAnalytics(query);

  // Service 現在返回標準化的 ServiceResponse，直接返回即可
  const errorCode = result.metadata?.errorCode;
  const statusCode = result.success ? 200 : (errorCode === 'VALIDATION_ERROR' ? 400 : 500);
  return c.json(result, statusCode);
});

/**
 * GET /analytics/messages
 * 獲取消息分析數據
 */
analyticsHandler.get('/messages', async (c) => {
  const analyticsService = new AnalyticsService({
    database: createDbClient(c.env.DB),
    kv: c.env.KV,
    env: c.env
  });

  const query: MessageAnalyticsQuery = {
    timeRange: (c.req.query('timeRange') || '7d') as TimeRange,
    startDate: c.req.query('startDate'),
    endDate: c.req.query('endDate'),
    metrics: (c.req.query('metrics') || 'total_messages,messages_per_hour').split(',') as MessageMetric[],
    filters: {
      conversationId: c.req.query('conversationId'),
      platform: c.req.query('platform') as 'line' | 'facebook' | 'web' | undefined
    },
    groupBy: c.req.query('groupBy')?.split(',') || [],
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
  };

  const result = await analyticsService.getMessageAnalytics(query);

  const errorCode = result.metadata?.errorCode;
  const statusCode = result.success ? 200 : (errorCode === 'VALIDATION_ERROR' ? 400 : 500);
  return c.json(result, statusCode);
});

/**
 * GET /analytics/users
 * 獲取用戶分析數據
 */
analyticsHandler.get('/users', async (c) => {
  try {
    const analyticsService = new AnalyticsService({
      database: createDbClient(c.env.DB),
      kv: c.env.KV,
      env: c.env
    });

    const query: UserAnalyticsQuery = {
      timeRange: (c.req.query('timeRange') || '7d') as TimeRange,
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      metrics: (c.req.query('metrics') || 'active_users,user_activity').split(',') as UserMetric[],
      userType: c.req.query('userType') as 'agent' | 'customer' | 'admin',
      filters: {
        teamId: c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined,
        userId: c.req.query('userId')
      },
      groupBy: c.req.query('groupBy')?.split(',') || [],
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
    };

    const result = await analyticsService.getUserAnalytics(query);

    return c.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Failed to get user analytics:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'USER_ANALYTICS_ERROR'
    }, 500);
  }
});

/**
 * GET /analytics/performance
 * 獲取性能分析數據
 */
analyticsHandler.get('/performance', async (c) => {
  try {
    const analyticsService = new AnalyticsService({
      database: createDbClient(c.env.DB),
      kv: c.env.KV,
      env: c.env
    });

    const query: PerformanceAnalyticsQuery = {
      timeRange: (c.req.query('timeRange') || '24h') as TimeRange,
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      metrics: (c.req.query('metrics') || 'response_times,throughput,error_rates').split(',') as PerformanceMetric[],
      filters: {
        platform: c.req.query('platform') as any
      },
      groupBy: c.req.query('groupBy')?.split(',') || [],
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
    };

    const result = await analyticsService.getPerformanceAnalytics(query);

    return c.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Failed to get performance analytics:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'PERFORMANCE_ANALYTICS_ERROR'
    }, 500);
  }
});

/**
 * POST /analytics/custom
 * 執行自定義分析查詢
 */
analyticsHandler.post('/custom', async (c) => {
  try {
    const analyticsService = new AnalyticsService({
      database: createDbClient(c.env.DB),
      kv: c.env.KV,
      env: c.env
    });

    const body = await c.req.json();
    const query: CustomAnalyticsQuery = {
      timeRange: body.timeRange || '7d',
      startDate: body.startDate,
      endDate: body.endDate,
      query: body.query,
      parameters: body.parameters || {},
      aggregation: body.aggregation,
      filters: body.filters,
      groupBy: body.groupBy || [],
      limit: body.limit
    };

    const result = await analyticsService.getCustomAnalytics(query);

    return c.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Failed to execute custom analytics:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'CUSTOM_ANALYTICS_ERROR'
    }, 500);
  }
});

/**
 * POST /analytics/export
 * 導出分析數據
 */
analyticsHandler.post('/export', async (c) => {
  try {
    const analyticsService = new AnalyticsService({
      database: createDbClient(c.env.DB),
      kv: c.env.KV,
      env: c.env
    });

    const body = await c.req.json();
    const query: ExportQuery = {
      timeRange: body.timeRange || '7d',
      startDate: body.startDate,
      endDate: body.endDate,
      format: body.format || 'json',
      includeCharts: body.includeCharts || false,
      template: body.template,
      fileName: body.fileName,
      filters: body.filters,
      groupBy: body.groupBy || [],
      limit: body.limit,
      metrics: body.metrics || []
    };

    const result = await analyticsService.exportAnalytics(query);

    return c.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Failed to export analytics:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'EXPORT_ANALYTICS_ERROR'
    }, 500);
  }
});

/**
 * GET /analytics/health
 * 檢查分析服務健康狀態
 */
analyticsHandler.get('/health', async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    // 檢查數據庫連接
    const dbTest = await db.run(sql`SELECT 1 as test`);

    // 檢查 KV 連接
    let kvHealthy = true;
    if (c.env.KV) {
      try {
        await c.env.KV.put('health_check', 'ok', { expirationTtl: 10 });
        await c.env.KV.delete('health_check');
      } catch {
        kvHealthy = false;
      }
    }

    return c.json({
      success: true,
      status: 'healthy',
      services: {
        database: dbTest ? 'healthy' : 'unhealthy',
        kv: kvHealthy ? 'healthy' : 'unhealthy'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return c.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * POST /analytics/metrics
 * 收集指標數據
 */
analyticsHandler.post('/metrics', async (c) => {
  try {
    const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);

    const body = await c.req.json();

    if (Array.isArray(body.metrics)) {
      await metricsCollector.collectBatch(body.metrics);
    } else if (body.metric) {
      await metricsCollector.collect(body.metric);
    } else {
      return c.json({
        success: false,
        error: 'Missing metrics data',
        code: 'INVALID_METRICS_DATA'
      }, 400);
    }

    return c.json({
      success: true,
      message: 'Metrics collected successfully'
    });

  } catch (error) {
    console.error('Failed to collect metrics:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'METRICS_COLLECTION_ERROR'
    }, 500);
  }
});

/**
 * GET /analytics/metrics/:name
 * 查詢指標數據
 */
analyticsHandler.get('/metrics/:name', async (c) => {
  try {
    const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);

    const metricName = c.req.param('name');
    const query = {
      name: metricName,
      startTime: parseInt(c.req.query('startTime') || '0'),
      endTime: parseInt(c.req.query('endTime') || Date.now().toString()),
      aggregation: c.req.query('aggregation') as any,
      period: c.req.query('period') as any,
      tags: c.req.query('tags') ? JSON.parse(c.req.query('tags')!) : undefined,
      groupBy: c.req.query('groupBy')?.split(','),
      orderBy: c.req.query('orderBy') as any,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
    };

    const result = await metricsCollector.query(query);

    return c.json({
      success: true,
      data: result.metrics,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Failed to query metrics:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'METRICS_QUERY_ERROR'
    }, 500);
  }
});