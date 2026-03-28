// Metrics Collection Middleware - 指標收集中間件
// 自動收集系統和應用程序指標

import { Context, Next } from 'hono';
import { MetricsCollector } from '@modules/analytics/services/metrics-collector';
import { METRIC_NAMES } from '@modules/analytics/constants/metrics-definitions';
import type { Bindings } from '@/types';
import type { Metric } from '@modules/analytics/types/metrics-types';
import { nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('MetricsMiddleware');

/**
 * 指標收集中間件選項
 */
interface MetricsMiddlewareOptions {
  enabled?: boolean;
  collectSystemMetrics?: boolean;
  collectApiMetrics?: boolean;
  collectCustomMetrics?: boolean;
  batchMode?: boolean;
  samplingRate?: number; // 0-1 之間，用於控制採樣率
}

const defaultOptions: MetricsMiddlewareOptions = {
  enabled: true,
  collectSystemMetrics: true,
  collectApiMetrics: true,
  collectCustomMetrics: false,
  batchMode: true,
  samplingRate: 1.0
};

/**
 * 主要指標收集中間件
 */
export function metricsMiddleware(options: MetricsMiddlewareOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    // 檢查是否啟用指標收集
    if (!config.enabled) {
      await next();
      return;
    }

    // 採樣率控制
    if (config.samplingRate && config.samplingRate < 1.0 && Math.random() > config.samplingRate) {
      await next();
      return;
    }

    const startTime = nowMs();
    const requestId = crypto.randomUUID();

    // 收集請求開始指標
    if (config.collectApiMetrics) {
      await collectApiRequestStart(c, requestId, startTime);
    }

    let statusCode = 200;
    let responseSize = 0;
    let error: Error | null = null;

    try {
      await next();
      statusCode = c.res.status;

      // 估算響應大小
      const responseText = await c.res.clone().text();
      responseSize = new Blob([responseText]).size;

    } catch (err) {
      error = err as Error;
      statusCode = 500;
      throw err;

    } finally {
      const endTime = nowMs();
      const duration = endTime - startTime;

      // 收集請求完成指標
      if (config.collectApiMetrics) {
        await collectApiRequestComplete(c, requestId, startTime, endTime, duration, statusCode, responseSize, error);
      }

      // 收集系統指標
      if (config.collectSystemMetrics) {
        await collectSystemMetrics(c, duration);
      }
    }
  };
}

/**
 * 收集 API 請求開始指標
 */
async function collectApiRequestStart(
  c: Context<{ Bindings: Bindings }>,
  requestId: string,
  startTime: number
): Promise<void> {
  try {
    const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);

    const requestMetric: Metric = {
      id: `${requestId}_start`,
      name: METRIC_NAMES.API.REQUESTS_TOTAL,
      value: 1,
      timestamp: startTime,
      tags: {
        endpoint: c.req.path,
        method: c.req.method,
        request_id: requestId,
        user_agent: c.req.header('User-Agent') || 'unknown',
        client_ip: getClientIP(c)
      },
      unit: 'count',
      metadata: {
        type: 'request_start',
        url: c.req.url,
        headers: {}
      }
    };

    await metricsCollector.collect(requestMetric);

  } catch (error) {
    log.error('Failed to collect API request start metrics:', {}, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 收集 API 請求完成指標
 */
async function collectApiRequestComplete(
  c: Context<{ Bindings: Bindings }>,
  requestId: string,
  startTime: number,
  endTime: number,
  duration: number,
  statusCode: number,
  responseSize: number,
  error: Error | null
): Promise<void> {
  try {
    const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);

    const commonTags = {
      endpoint: c.req.path,
      method: c.req.method,
      status_code: statusCode.toString(),
      request_id: requestId,
      client_ip: getClientIP(c)
    };

    const metrics: Metric[] = [
      // 響應時間指標
      {
        id: `${requestId}_duration`,
        name: METRIC_NAMES.API.RESPONSE_TIME,
        value: duration,
        timestamp: endTime,
        tags: commonTags,
        unit: 'milliseconds',
        metadata: {
          start_time: startTime,
          end_time: endTime
        }
      },

      // 響應大小指標
      {
        id: `${requestId}_size`,
        name: METRIC_NAMES.API.PAYLOAD_SIZE,
        value: responseSize,
        timestamp: endTime,
        tags: commonTags,
        unit: 'bytes'
      }
    ];

    // 錯誤指標
    if (error || statusCode >= 400) {
      metrics.push({
        id: `${requestId}_error`,
        name: METRIC_NAMES.API.STATUS_5XX,
        value: statusCode >= 500 ? 1 : 0,
        timestamp: endTime,
        tags: {
          ...commonTags,
          error_type: error ? error.name : 'http_error',
          error_message: error ? error.message : `HTTP ${statusCode}`
        },
        unit: 'count',
        metadata: {
          error_stack: error?.stack,
          error_details: error?.toString()
        }
      });

      metrics.push({
        id: `${requestId}_client_error`,
        name: METRIC_NAMES.API.STATUS_4XX,
        value: statusCode >= 400 && statusCode < 500 ? 1 : 0,
        timestamp: endTime,
        tags: commonTags,
        unit: 'count'
      });
    } else {
      metrics.push({
        id: `${requestId}_success`,
        name: METRIC_NAMES.API.STATUS_2XX,
        value: statusCode >= 200 && statusCode < 300 ? 1 : 0,
        timestamp: endTime,
        tags: commonTags,
        unit: 'count'
      });
    }

    // 每秒請求數指標
    metrics.push({
      id: `${requestId}_rps`,
      name: METRIC_NAMES.API.REQUESTS_PER_SECOND,
      value: 1,
      timestamp: endTime,
      tags: {
        ...commonTags,
        time_bucket: Math.floor(endTime / 1000).toString() // 按秒分桶
      },
      unit: 'count'
    });

    await metricsCollector.collectBatch(metrics);

  } catch (error) {
    log.error('Failed to collect API request complete metrics:', {}, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 收集系統指標
 */
async function collectSystemMetrics(
  c: Context<{ Bindings: Bindings }>,
  requestDuration: number
): Promise<void> {
  try {
    const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);
    const now = nowMs();

    const systemMetrics: Metric[] = [
      // 系統響應時間
      {
        id: `system_${now}_response_time`,
        name: METRIC_NAMES.SYSTEM.RESPONSE_TIME,
        value: requestDuration,
        timestamp: now,
        tags: {
          component: 'api',
          service: 'hono_app',
          environment: c.env.ENVIRONMENT || 'production'
        },
        unit: 'milliseconds'
      },

      // 系統吞吐量
      {
        id: `system_${now}_throughput`,
        name: METRIC_NAMES.SYSTEM.THROUGHPUT,
        value: 1,
        timestamp: now,
        tags: {
          component: 'api',
          service: 'hono_app',
          time_bucket: Math.floor(now / 1000).toString()
        },
        unit: 'requests'
      }
    ];

    // 如果有記憶體使用資訊
    if (globalThis.process && globalThis.process.memoryUsage) {
      const memUsage = globalThis.process.memoryUsage();
      systemMetrics.push({
        id: `system_${now}_memory`,
        name: METRIC_NAMES.SYSTEM.MEMORY_USAGE,
        value: memUsage.heapUsed / 1024 / 1024, // MB
        timestamp: now,
        tags: {
          component: 'runtime',
          service: 'nodejs'
        },
        unit: 'megabytes',
        metadata: {
          heap_total: memUsage.heapTotal,
          heap_used: memUsage.heapUsed,
          external: memUsage.external,
          rss: memUsage.rss
        }
      });
    }

    await metricsCollector.collectBatch(systemMetrics);

  } catch (error) {
    log.error('Failed to collect system metrics:', {}, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 會話指標收集中間件
 */
export function conversationMetricsMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const startTime = nowMs();
    let conversationId: string | null = null;
    let userId: string | null = null;

    // 從路徑或查詢參數提取對話ID
    conversationId = c.req.param('conversationId') || c.req.query('conversationId') || null;

    // 從JWT token提取用戶ID
    try {
      const user = c.get('user');
      userId = user?.id?.toString() || null;
    } catch (error) {
      // 用戶信息提取失敗，不影響主流程
    }

    await next();

    // 收集對話相關指標
    if (conversationId) {
      try {
        const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);
        const endTime = nowMs();
        const duration = endTime - startTime;

        const conversationMetric: Metric = {
          id: `conversation_${conversationId}_${endTime}`,
          name: METRIC_NAMES.CONVERSATION.RESPONSE_TIME_AVG,
          value: duration,
          timestamp: endTime,
          tags: {
            conversation_id: conversationId,
            user_id: userId || 'anonymous',
            endpoint: c.req.path,
            method: c.req.method
          },
          unit: 'milliseconds'
        };

        await metricsCollector.collect(conversationMetric);

      } catch (error) {
        log.error('Failed to collect conversation metrics:', {}, error instanceof Error ? error : new Error(String(error)));
      }
    }
  };
}

/**
 * 代理人指標收集中間件
 */
export function agentMetricsMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const user = c.get('user');
    if (!user || user.role !== 'agent') {
      await next();
      return;
    }

    const startTime = nowMs();
    await next();
    const endTime = nowMs();
    const duration = endTime - startTime;

    try {
      const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);

      const agentMetric: Metric = {
        id: `agent_${user.id}_${endTime}`,
        name: METRIC_NAMES.AGENT.RESPONSE_TIME,
        value: duration,
        timestamp: endTime,
        tags: {
          agent_id: user.id.toString(),
          team_id: user.primaryTeamId?.toString() || 'unknown',
          endpoint: c.req.path,
          method: c.req.method
        },
        unit: 'milliseconds'
      };

      await metricsCollector.collect(agentMetric);

    } catch (error) {
      log.error('Failed to collect agent metrics:', {}, error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * 獲取客戶端 IP 地址
 */
function getClientIP(c: Context): string {
  // Cloudflare Workers 中的 IP 地址提取
  return c.req.header('CF-Connecting-IP') ||
         c.req.header('X-Forwarded-For') ||
         c.req.header('X-Real-IP') ||
         'unknown';
}

/**
 * 創建自定義指標收集器
 */
export function createCustomMetricsCollector(c: Context<{ Bindings: Bindings }>) {
  return {
    async collect(metricName: string, value: number, tags: Record<string, string> = {}) {
      try {
        const metricsCollector = new MetricsCollector(c.env.DB, c.env.KV);

        const metric: Metric = {
          id: `custom_${nowMs()}_${Math.random()}`,
          name: metricName,
          value,
          timestamp: nowMs(),
          tags: {
            ...tags,
            type: 'custom',
            source: 'application'
          },
          unit: 'count'
        };

        await metricsCollector.collect(metric);

      } catch (error) {
        log.error('Failed to collect custom metric:', {}, error instanceof Error ? error : new Error(String(error)));
      }
    },

    async increment(metricName: string, tags: Record<string, string> = {}) {
      await this.collect(metricName, 1, tags);
    },

    async gauge(metricName: string, value: number, tags: Record<string, string> = {}) {
      await this.collect(metricName, value, { ...tags, type: 'gauge' });
    },

    async histogram(metricName: string, value: number, tags: Record<string, string> = {}) {
      await this.collect(metricName, value, { ...tags, type: 'histogram' });
    }
  };
}

export default metricsMiddleware;