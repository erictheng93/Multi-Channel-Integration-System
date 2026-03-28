// Analytics sub-module: system performance metrics
import { createDbClient } from '../db/drizzle-factory';
import { sql, eq, and, gte, lte, count, avg } from 'drizzle-orm';
import { metrics, channelIntegrations } from '../db/schema';

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
export async function getIntegrationMetrics(db: D1Database, period: { start: number; end: number }) {
  const drizzle = createDbClient(db);

  // Query per-platform integration counts and aggregate stats from channelIntegrations
  const integrationRows = await drizzle
    .select({
      platform: channelIntegrations.platform,
      stats: channelIntegrations.stats,
      isActive: channelIntegrations.isActive,
    })
    .from(channelIntegrations)
    .where(eq(channelIntegrations.isActive, true));

  // Also query webhook-related metrics from the metrics table for the period
  const webhookMetrics = await drizzle
    .select({
      platform: sql<string>`JSON_EXTRACT(${metrics.tags}, '$.platform')`.as('platform'),
      totalRequests: count().as('total_requests'),
      avgLatency: avg(metrics.metricValue).as('avg_latency'),
      errorCount: sql<number>`COUNT(CASE WHEN JSON_EXTRACT(${metrics.tags}, '$.status') >= '400' THEN 1 END)`.as('error_count'),
    })
    .from(metrics)
    .where(
      and(
        eq(metrics.metricName, 'webhook_request_duration'),
        gte(metrics.timestamp, period.start),
        lte(metrics.timestamp, period.end)
      )
    )
    .groupBy(sql`JSON_EXTRACT(${metrics.tags}, '$.platform')`);

  const webhookByPlatform = new Map(webhookMetrics.map(row => [row.platform, row]));

  // Aggregate stats from channelIntegrations JSON stats column per platform
  const platformStats: Record<string, { totalSent: number; totalReceived: number; integrationCount: number }> = {};
  for (const row of integrationRows) {
    const platform = row.platform;
    if (!platformStats[platform]) {
      platformStats[platform] = { totalSent: 0, totalReceived: 0, integrationCount: 0 };
    }
    platformStats[platform].integrationCount++;
    if (row.stats) {
      try {
        const parsed = JSON.parse(row.stats) as { totalSent?: number; totalReceived?: number };
        platformStats[platform].totalSent += parsed.totalSent || 0;
        platformStats[platform].totalReceived += parsed.totalReceived || 0;
      } catch {
        // Skip malformed JSON
      }
    }
  }

  function buildPlatformMetrics(platform: string) {
    const webhook = webhookByPlatform.get(platform);
    const stats = platformStats[platform];
    const totalRequests = Number(webhook?.totalRequests) || 0;
    const errorCount = Number(webhook?.errorCount) || 0;
    return {
      webhookLatency: Number(webhook?.avgLatency) || 0,
      apiCallSuccess: totalRequests - errorCount,
      apiCallFailure: errorCount,
      integrationCount: stats?.integrationCount || 0,
      totalSent: stats?.totalSent || 0,
      totalReceived: stats?.totalReceived || 0,
    };
  }

  return {
    line: buildPlatformMetrics('line'),
    facebook: buildPlatformMetrics('facebook'),
  };
}
