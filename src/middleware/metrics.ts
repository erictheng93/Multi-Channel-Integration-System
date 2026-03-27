import type { Context, Next } from 'hono';
import type { Bindings } from '../types';
import { createContextLogger } from '../utils/logger';

const log = createContextLogger('MetricsMiddleware');

/**
 * Paths that should be excluded from metrics collection.
 * These are monitoring/health endpoints that would create feedback loops,
 * plus static asset paths.
 */
const SKIP_PATHS = [
  '/api/system/api-status',
  '/api/monitoring/',
  '/favicon.ico',
  '/robots.txt',
];

/**
 * Normalize a URL path by replacing dynamic segments with `:id`.
 * - UUIDs (8-4-4-4-12 hex format)
 * - Purely numeric segments
 * - Long hex strings (12+ hex chars)
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{12,}(?=\/|$)/gi, '/:id');
}

/**
 * Metrics collection middleware.
 * Records request timing and status, then sends data to MetricsCollectorDO
 * in a non-blocking fashion via waitUntil. Never breaks the request flow.
 */
export async function metricsMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next,
): Promise<Response | void> {
  try {
    // Skip CORS preflight requests
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const requestPath = new URL(c.req.url).pathname;

    // Skip non-API paths
    if (!requestPath.startsWith('/api/')) {
      return next();
    }

    // Skip monitoring/health paths
    for (const skipPath of SKIP_PATHS) {
      if (requestPath.startsWith(skipPath)) {
        return next();
      }
    }

    const startTime = Date.now();

    await next();

    const responseTimeMs = Date.now() - startTime;
    const statusCode = c.res.status;
    const method = c.req.method;
    const normalizedPath = normalizePath(requestPath);
    const timestamp = Date.now();

    // Send metrics to MetricsCollectorDO non-blocking
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const doId = c.env.METRICS_COLLECTOR.idFromName('global');
          const stub = c.env.METRICS_COLLECTOR.get(doId);
          await stub.fetch('http://metrics-collector/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method,
              path: normalizedPath,
              statusCode,
              responseTimeMs,
              timestamp,
            }),
          });
        } catch (err) {
          log.warn('Failed to send metrics to DO', { error: String(err) });
        }
      })(),
    );
  } catch (err) {
    // Metrics must NEVER break a request
    log.error('Metrics middleware error', { error: String(err) });
    return next();
  }
}
