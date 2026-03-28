// Analytics sub-module: dashboard, trends, and predictive analytics
import type { TimeSeriesData } from '../types/enterprise';
import { createDbClient } from '../db/drizzle-factory';
import { sql, eq, and, gte, lte, count, avg, asc } from 'drizzle-orm';
import { metrics } from '../db/schema';
import { nowMs } from '@/utils/timestamp';

// Get real-time metrics (active agents in the last hour)
export async function getRealTimeMetrics(db: D1Database) {
  const now = nowMs();
  const oneHourAgo = now - 60 * 60 * 1000;

  const drizzle = createDbClient(db);

  const activeAgents = await drizzle
    .select({
      count: sql<number>`COUNT(DISTINCT JSON_EXTRACT(${metrics.tags}, '$.agent_id'))`.as('count')
    })
    .from(metrics)
    .where(
      and(
        eq(metrics.metricName, 'agent_activity'),
        gte(metrics.timestamp, oneHourAgo)
      )
    )
    .get();

  return {
    activeAgents: Number(activeAgents?.count) || 0,
    timestamp: now
  };
}

// Check for alerts (e.g., high error rate)
export async function checkAlerts(db: D1Database) {
  const alerts = [];
  const now = nowMs();
  const oneHourAgo = now - 60 * 60 * 1000;

  const drizzle = createDbClient(db);

  const errorRate = await drizzle
    .select({
      errorRate: sql<number>`COUNT(CASE WHEN JSON_EXTRACT(${metrics.tags}, '$.status') >= '400' THEN 1 END) * 100.0 / COUNT(*)`.as('error_rate')
    })
    .from(metrics)
    .where(
      and(
        eq(metrics.metricName, 'api_request_duration'),
        gte(metrics.timestamp, oneHourAgo)
      )
    )
    .get();

  if (Number(errorRate?.errorRate) > 5) {
    alerts.push({
      type: 'high_error_rate',
      message: `API 錯誤率過高: ${Number(errorRate?.errorRate).toFixed(2)}%`,
      severity: 'high' as const,
      timestamp: now
    });
  }

  return alerts;
}

// Get trend data for a time range
export async function getTrendData(db: D1Database, startTime: number, endTime: number) {
  const drizzle = createDbClient(db);

  const results = await drizzle
    .select({
      metricName: metrics.metricName,
      timestamp: metrics.timestamp,
      metricValue: metrics.metricValue
    })
    .from(metrics)
    .where(
      and(
        gte(metrics.timestamp, startTime),
        lte(metrics.timestamp, endTime)
      )
    )
    .orderBy(asc(metrics.timestamp));

  const trends: Record<string, Array<{ timestamp: number; value: number }>> = {};

  results.forEach((row) => {
    const metricName = row.metricName;
    if (!trends[metricName]) {
      trends[metricName] = [];
    }
    trends[metricName].push({
      timestamp: row.timestamp,
      value: row.metricValue
    });
  });

  return trends;
}

// Get historical data aggregated by day
export async function getHistoricalData(db: D1Database, period: { start: number; end: number }): Promise<TimeSeriesData[]> {
  const drizzle = createDbClient(db);

  const results = await drizzle
    .select({
      date: sql<string>`DATE(${metrics.timestamp} / 1000, 'unixepoch')`.as('date'),
      messageCount: count().as('message_count'),
      avgValue: avg(metrics.metricValue).as('avg_value')
    })
    .from(metrics)
    .where(
      and(
        gte(metrics.timestamp, period.start),
        lte(metrics.timestamp, period.end)
      )
    )
    .groupBy(sql`DATE(${metrics.timestamp} / 1000, 'unixepoch')`)
    .orderBy(sql`date`);

  if (!results || results.length === 0) {
    return [];
  }

  return results.map((row) => ({
    timestamp: new Date(row.date).toISOString(),
    value: Number(row.avgValue) || 0,
    metadata: {
      messageCount: Number(row.messageCount) || 0,
      date: row.date
    }
  }));
}

// Predict message volume based on historical data
export function predictMessageVolume(historicalData: TimeSeriesData[]): {
  nextWeek: number;
  nextMonth: number;
  confidence: number;
} {
  if (historicalData.length < 7) {
    return { nextWeek: 0, nextMonth: 0, confidence: 0 };
  }

  const values = historicalData.map(d => {
    const messageCount = d.metadata?.messageCount as number || 0;
    return messageCount;
  });
  const trend = calculateLinearTrend(values);

  const lastValue = values[values.length - 1] || 0;
  return {
    nextWeek: Math.max(0, lastValue + trend * 7),
    nextMonth: Math.max(0, lastValue + trend * 30),
    confidence: calculatePredictionConfidence(values)
  };
}

// Predict resource needs based on historical data
export function predictResourceNeeds(historicalData: TimeSeriesData[]): {
  requiredAgents: number;
  peakHours: Array<{ hour: number; load: number }>;
} {
  if (historicalData.length === 0) {
    return {
      requiredAgents: 1,
      peakHours: []
    };
  }

  const avgLoad = historicalData.reduce((sum, d) => {
    const messageCount = d.metadata?.messageCount as number || 0;
    return sum + messageCount;
  }, 0) / historicalData.length;
  const requiredAgents = Math.max(1, Math.ceil(avgLoad / 100)); // Assume each agent handles 100 messages

  return {
    requiredAgents,
    peakHours: [
      { hour: 9, load: avgLoad * 1.2 },
      { hour: 14, load: avgLoad * 1.1 },
      { hour: 20, load: avgLoad * 0.8 }
    ]
  };
}

// Predict satisfaction trend based on historical data
export function predictSatisfactionTrend(historicalData: TimeSeriesData[]): {
  trend: 'improving' | 'declining' | 'stable';
  expectedRating: number;
} {
  if (historicalData.length < 2) {
    return {
      trend: 'stable' as const,
      expectedRating: 4.0
    };
  }

  const recent = historicalData.slice(-7);
  const older = historicalData.slice(-14, -7);

  const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
  const olderAvg = older.length > 0
    ? older.reduce((sum, d) => sum + d.value, 0) / older.length
    : recentAvg;

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentAvg > olderAvg + 0.1) trend = 'improving';
  else if (recentAvg < olderAvg - 0.1) trend = 'declining';

  return {
    trend,
    expectedRating: recentAvg
  };
}

// Calculate linear trend from a series of values
export function calculateLinearTrend(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

// Calculate prediction confidence from a series of values
export function calculatePredictionConfidence(values: number[]): number {
  if (values.length < 3) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Lower coefficient of variation = higher confidence
  const coefficientOfVariation = stdDev / mean;
  return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
}
