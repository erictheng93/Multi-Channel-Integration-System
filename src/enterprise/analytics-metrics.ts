// Analytics sub-module: metric recording and metrics middleware
import type { AnalyticsMetric } from './analytics-types';
import { createDbClient } from '../db/drizzle-factory';
import { metrics } from '../db/schema';
import { nowMs } from '@/utils/timestamp';

// Record a single metric to the database and KV cache
export async function recordMetric(
  db: D1Database,
  kv: KVNamespace,
  metric: AnalyticsMetric
): Promise<void> {
  // Insert metric using Drizzle ORM
  const drizzle = createDbClient(db);
  await drizzle.insert(metrics).values({
    metricName: metric.name,
    metricValue: metric.value,
    timestamp: metric.timestamp,
    tags: JSON.stringify(metric.tags),
    unit: metric.unit || null
  });

  // Update real-time metric to KV
  const key = `metric:${metric.name}:${generateTagKey(metric.tags)}`;
  await kv.put(key, JSON.stringify({
    value: metric.value,
    timestamp: metric.timestamp,
    unit: metric.unit
  }), { expirationTtl: 24 * 60 * 60 }); // 24 hours

  // Update time series data
  await updateTimeSeriesData(kv, metric);
}

// Update time series data in KV (hourly buckets)
export async function updateTimeSeriesData(kv: KVNamespace, metric: AnalyticsMetric): Promise<void> {
  const hour = Math.floor(metric.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
  const key = `timeseries:${metric.name}:${hour}`;

  const existing = await kv.get(key);
  const data = existing ? JSON.parse(existing) : {
    values: [],
    count: 0,
    sum: 0,
    min: metric.value,
    max: metric.value
  };

  data.values.push({
    timestamp: metric.timestamp,
    value: metric.value,
    tags: metric.tags
  });
  data.count += 1;
  data.sum += metric.value;
  data.min = Math.min(data.min, metric.value);
  data.max = Math.max(data.max, metric.value);

  await kv.put(key, JSON.stringify(data), {
    expirationTtl: 7 * 24 * 60 * 60 // 7 days
  });
}

// Generate a deterministic tag key for KV storage
export function generateTagKey(tags: Record<string, string>): string {
  return Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

// Metrics collection middleware for Hono
export function metricsMiddleware() {
  return async (c: { req: { path: string; method: string }; res: { status: number }; env: { DB: D1Database; KV: KVNamespace } }, next: () => Promise<void>) => {
    const startTime = nowMs();
    const path = c.req.path;
    const method = c.req.method;

    try {
      await next();

      const duration = Date.now() - startTime;

      // Record API call duration metric
      await recordMetric(c.env.DB, c.env.KV, {
        name: 'api_request_duration',
        value: duration,
        timestamp: nowMs(),
        tags: {
          method,
          path,
          status: c.res.status.toString()
        },
        unit: 'ms'
      });

      await recordMetric(c.env.DB, c.env.KV, {
        name: 'api_request_count',
        value: 1,
        timestamp: nowMs(),
        tags: {
          method,
          path,
          status: c.res.status.toString()
        }
      });

    } catch (error: unknown) {
      // Record error metric
      await recordMetric(c.env.DB, c.env.KV, {
        name: 'api_request_error',
        value: 1,
        timestamp: nowMs(),
        tags: {
          method,
          path,
          error: error instanceof Error ? error.message : 'unknown'
        }
      });

      throw error;
    }
  };
}
