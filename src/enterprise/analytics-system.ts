// Analytics sub-module: system performance metrics
import { createDbClient } from '../db/drizzle-factory';
import { sql, eq, and, gte, lte, count, avg } from 'drizzle-orm';
import { metrics } from '../db/schema';

// Get API performance metrics
export async function getApiMetrics(db: D1Database, period: { start: number; end: number }) {
  const drizzle = createDbClient(db);

  const result = await drizzle
    .select({
      totalRequests: count().as('total_requests'),
      avgResponseTime: avg(metrics.metricValue).as('avg_response_time'),
      errorRate: sql<number>`COUNT(CASE WHEN JSON_EXTRACT(${metrics.tags}, '$.status') >= '400' THEN 1 END) * 100.0 / COUNT(*)`.as('error_rate')
    })
    .from(metrics)
    .where(
      and(
        eq(metrics.metricName, 'api_request_duration'),
        gte(metrics.timestamp, period.start),
        lte(metrics.timestamp, period.end)
      )
    )
    .get();

  const endpointResults = await drizzle
    .select({
      endpoint: sql<string>`JSON_EXTRACT(${metrics.tags}, '$.path')`.as('endpoint'),
      requestCount: count().as('request_count'),
      avgResponseTime: avg(metrics.metricValue).as('avg_response_time'),
      errorRate: sql<number>`COUNT(CASE WHEN JSON_EXTRACT(${metrics.tags}, '$.status') >= '400' THEN 1 END) * 100.0 / COUNT(*)`.as('error_rate')
    })
    .from(metrics)
    .where(
      and(
        eq(metrics.metricName, 'api_request_duration'),
        gte(metrics.timestamp, period.start),
        lte(metrics.timestamp, period.end)
      )
    )
    .groupBy(sql`JSON_EXTRACT(${metrics.tags}, '$.path')`);

  return {
    totalRequests: Number(result?.totalRequests) || 0,
    averageResponseTime: Number(result?.avgResponseTime) || 0,
    errorRate: Number(result?.errorRate) || 0,
    throughput: (Number(result?.totalRequests) || 0) / ((period.end - period.start) / 1000),
    endpointPerformance: endpointResults.map((row) => ({
      endpoint: row.endpoint,
      requestCount: Number(row.requestCount),
      averageResponseTime: Number(row.avgResponseTime),
      errorRate: Number(row.errorRate)
    }))
  };
}

// Get database performance metrics
export async function getDatabaseMetrics(db: D1Database, period: { start: number; end: number }) {
  const drizzle = createDbClient(db);

  const result = await drizzle
    .select({
      queryCount: count().as('query_count'),
      avgQueryTime: avg(metrics.metricValue).as('avg_query_time')
    })
    .from(metrics)
    .where(
      and(
        eq(metrics.metricName, 'database_query_duration'),
        gte(metrics.timestamp, period.start),
        lte(metrics.timestamp, period.end)
      )
    )
    .get();

  return {
    queryCount: Number(result?.queryCount) || 0,
    averageQueryTime: Number(result?.avgQueryTime) || 0,
    slowQueries: [] as Array<{ query: string; executionTime: number; frequency: number }> // Slow query tracking not yet implemented
  };
}

// Get integration metrics (LINE, Facebook)
export async function getIntegrationMetrics(_db: D1Database, _period: { start: number; end: number }) {
  return {
    line: {
      webhookLatency: 0,
      apiCallSuccess: 0,
      apiCallFailure: 0
    },
    facebook: {
      webhookLatency: 0,
      apiCallSuccess: 0,
      apiCallFailure: 0
    }
  };
}
