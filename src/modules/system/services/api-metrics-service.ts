// Per-endpoint API metrics read side: Workers Analytics Engine SQL API.
// Docs: https://developers.cloudflare.com/analytics/analytics-engine/sql-api/
//  - POST https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/analytics_engine/sql
//  - Authorization: Bearer {CF_ANALYTICS_TOKEN} (Account > Account Analytics > Read)
//  - Data is adaptively sampled: weight every aggregate by _sample_interval;
//    quantiles use quantileExactWeighted(q)(value, _sample_interval).

import type { Bindings } from '@/types';
import type { ApiStatistics, ApiEndpointMetric, MetricEvent, ApiMetricsSummary } from './api-metrics-types';

export const API_METRICS_DATASET = 'mcis_api_metrics';
export const API_METRICS_CACHE_KEY = 'api-metrics:summary:v1';
export const API_METRICS_CACHE_TTL_SECONDS = 60; // KV minimum
const MAX_ROUTES = 200;
const MIN_REQUESTS_FOR_EVENT = 20;

interface SqlResponse<T> {
  data?: T[];
}

export interface RouteAggRow {
  method: string;
  route: string;
  requests: number | string;
  p50: number | string | null;
  p95: number | string | null;
  avg_ms: number | string | null;
}
export interface RouteStatusRow {
  method: string;
  route: string;
  status: string;
  requests: number | string;
}
export interface PrevRow {
  method: string;
  route: string;
  avg_ms: number | string | null;
}

export class AnalyticsQueryError extends Error {}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (n: number): number => Math.round(n * 10) / 10;

async function runSql<T>(env: Bindings, sql: string): Promise<T[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` },
      body: `${sql} FORMAT JSON`,
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) {
    // never echo the response body (may contain account details)
    throw new AnalyticsQueryError(`Analytics SQL API returned ${res.status}`);
  }
  const json = (await res.json()) as SqlResponse<T>;
  return json.data ?? [];
}

const D = API_METRICS_DATASET;
export const SQL_AGG = `SELECT blob1 AS method, blob2 AS route,
  SUM(_sample_interval) AS requests,
  quantileExactWeighted(0.5)(double1, _sample_interval) AS p50,
  quantileExactWeighted(0.95)(double1, _sample_interval) AS p95,
  SUM(_sample_interval * double1) / SUM(_sample_interval) AS avg_ms
FROM ${D} WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY method, route ORDER BY requests DESC LIMIT ${MAX_ROUTES}`;
export const SQL_STATUS = `SELECT blob1 AS method, blob2 AS route, blob4 AS status,
  SUM(_sample_interval) AS requests
FROM ${D} WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY method, route, status LIMIT 2000`;
export const SQL_PREV = `SELECT blob1 AS method, blob2 AS route,
  SUM(_sample_interval * double1) / SUM(_sample_interval) AS avg_ms
FROM ${D} WHERE timestamp > NOW() - INTERVAL '2' HOUR AND timestamp <= NOW() - INTERVAL '1' HOUR
GROUP BY method, route LIMIT ${MAX_ROUTES}`;

export function categoryOf(route: string): string {
  if (/^\/api\/(auth|login|logout|password)/.test(route)) return 'auth';
  if (/^\/api\/(conversations|customer-conversations)/.test(route)) return 'conversation';
  if (/^\/api\/(customers?|tags)/.test(route)) return 'customer';
  if (/^\/api\/teams?/.test(route)) return 'team';
  if (/^\/api\/(messages?|messaging|broadcast)/.test(route)) return 'message';
  if (/^\/api\/(channels?|credentials|integrations?|webhook)/.test(route)) return 'integration';
  if (/^\/api\/(system|health|websocket)/.test(route)) return 'system';
  return 'other';
}

export function endpointStatus(successRate: number, p95: number): 'healthy' | 'warning' | 'error' {
  if (successRate < 95) return 'error';
  if (successRate < 99 || p95 > 3000) return 'warning';
  return 'healthy';
}

export function buildSummary(
  agg: RouteAggRow[],
  statuses: RouteStatusRow[],
  prev: PrevRow[],
  nowIso: string
): ApiMetricsSummary {
  const byKey = new Map<string, Record<string, number>>();
  for (const s of statuses) {
    const key = `${s.method} ${s.route}`;
    const codes = byKey.get(key) ?? {};
    codes[s.status] = (codes[s.status] ?? 0) + Math.round(num(s.requests));
    byKey.set(key, codes);
  }
  const prevByKey = new Map(prev.map((p) => [`${p.method} ${p.route}`, num(p.avg_ms)]));

  const endpoints: ApiEndpointMetric[] = agg.map((r) => {
    const key = `${r.method} ${r.route}`;
    const requestCount = Math.round(num(r.requests));
    const statusCodes = byKey.get(key) ?? {};
    const statusClasses: Record<string, number> = {};
    let errorCount = 0;
    for (const [code, n] of Object.entries(statusCodes)) {
      const cls = /^\d{3}$/.test(code) ? `${code[0]}xx` : 'other';
      statusClasses[cls] = (statusClasses[cls] ?? 0) + n;
      if (cls === '5xx') errorCount += n;
    }
    const total = Object.values(statusCodes).reduce((a, b) => a + b, 0) || requestCount;
    const successRate = total > 0 ? round1(((total - errorCount) / total) * 100) : 100;
    const p95 = round1(num(r.p95));
    const avg = round1(num(r.avg_ms));
    const prevAvg = prevByKey.get(key);
    const hasPrev = prevAvg !== undefined && prevAvg > 0;
    return {
      id: key,
      endpoint: r.route,
      method: r.method,
      category: categoryOf(r.route),
      description: '',
      status: endpointStatus(successRate, p95),
      responseTime: p95,
      avgResponseTime: avg,
      p50ResponseTime: round1(num(r.p50)),
      successRate,
      requestCount,
      errorCount,
      statusCodes,
      statusClasses,
      lastCheck: nowIso,
      previousAvgResponseTime: hasPrev ? round1(prevAvg) : null,
      avgResponseTimeDeltaPct: hasPrev ? round1(((avg - prevAvg) / prevAvg) * 100) : null,
    };
  });

  const events: MetricEvent[] = [];
  for (const e of endpoints) {
    if (e.requestCount < MIN_REQUESTS_FOR_EVENT || e.errorCount === 0) continue;
    const pct = round1((e.errorCount / e.requestCount) * 100);
    const message = `${e.method} ${e.endpoint}: ${pct}% 5xx in the last hour (${e.errorCount}/${e.requestCount})`;
    if (pct >= 5) {
      events.push({ id: `err-${e.id}`, type: 'error', message, timestamp: nowIso });
    } else if (pct >= 1) {
      events.push({ id: `warn-${e.id}`, type: 'warning', message, timestamp: nowIso });
    }
  }

  const totalReq = endpoints.reduce((a, e) => a + e.requestCount, 0);
  const stats: ApiStatistics = {
    totalEndpoints: endpoints.length,
    healthyCount: endpoints.filter((e) => e.status === 'healthy').length,
    warningCount: endpoints.filter((e) => e.status === 'warning').length,
    errorCount: endpoints.filter((e) => e.status === 'error').length,
    avgResponseTime:
      totalReq > 0
        ? round1(endpoints.reduce((a, e) => a + e.avgResponseTime * e.requestCount, 0) / totalReq)
        : 0,
  };

  return { configured: true, windowMinutes: 60, generatedAt: nowIso, endpoints, events, stats };
}

export function isAnalyticsConfigured(env: Bindings): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_ANALYTICS_TOKEN);
}

export function emptySummary(configured: boolean, nowIso: string, error?: string): ApiMetricsSummary {
  return {
    configured,
    windowMinutes: 60,
    generatedAt: nowIso,
    endpoints: [],
    events: [],
    stats: { totalEndpoints: 0, healthyCount: 0, warningCount: 0, errorCount: 0, avgResponseTime: 0 },
    ...(error ? { error } : {}),
  };
}

/** Cached (KV, 60 s) per-route summary for the last hour. Never throws. */
export async function getApiMetricsSummary(env: Bindings, nowIso: string): Promise<ApiMetricsSummary> {
  if (!isAnalyticsConfigured(env)) return emptySummary(false, nowIso);

  try {
    const cached = await env.CACHE?.get(API_METRICS_CACHE_KEY, 'json');
    if (cached) return cached as ApiMetricsSummary;
  } catch {
    // cache is best-effort
  }

  try {
    const [agg, statuses, prev] = await Promise.all([
      runSql<RouteAggRow>(env, SQL_AGG),
      runSql<RouteStatusRow>(env, SQL_STATUS),
      runSql<PrevRow>(env, SQL_PREV),
    ]);
    const summary = buildSummary(agg, statuses, prev, nowIso);
    try {
      await env.CACHE?.put(API_METRICS_CACHE_KEY, JSON.stringify(summary), {
        expirationTtl: API_METRICS_CACHE_TTL_SECONDS,
      });
    } catch {
      // ignore cache write failure
    }
    return summary;
  } catch (error) {
    const msg = error instanceof AnalyticsQueryError ? error.message : 'Analytics query failed';
    return emptySummary(true, nowIso, msg);
  }
}
