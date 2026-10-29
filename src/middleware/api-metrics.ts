// Per-endpoint API metrics -> Workers Analytics Engine (binding API_METRICS).
// Registered early in src/index.ts. Never throws into the request and is a
// no-op when the binding is absent (local dev, tests).
// writeDataPoint is non-blocking and needs no waitUntil.

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';

export const UNMATCHED_ROUTE = 'unmatched';

/** Paths that must not produce data points (probes, noise). */
function isSkippedPath(path: string): boolean {
  return path === '/health' || path.endsWith('/health') || path.includes('/health/') || path === '/favicon.ico';
}

export function statusClassOf(status: number): string {
  if (status >= 100 && status < 600) return `${Math.floor(status / 100)}xx`;
  return 'other';
}

/** Matched Hono pattern, never the raw path (bounded cardinality). */
export function resolveRoutePattern(pattern: string | undefined, status: number): string {
  if (pattern === '/') return '/';
  if (!pattern || pattern === '*' || pattern === '/*') return UNMATCHED_ROUTE;
  if (status === 404 && pattern.endsWith('/*')) return UNMATCHED_ROUTE;
  return pattern.length > 90 ? pattern.slice(0, 90) : pattern; // index limit is 96 bytes
}

export async function apiMetricsMiddleware(c: Context<{ Bindings: Bindings }>, next: Next): Promise<void> {
  const dataset = c.env?.API_METRICS;
  const method = c.req.method;
  if (
    !dataset ||
    method === 'OPTIONS' ||
    c.req.header('Upgrade')?.toLowerCase() === 'websocket' ||
    isSkippedPath(c.req.path)
  ) {
    await next();
    return;
  }

  const start = performance.now();
  try {
    await next();
  } finally {
    try {
      const status = c.res?.status ?? 500;
      const pattern = resolveRoutePattern(c.req.routePath, status);
      const latencyMs = Math.round((performance.now() - start) * 10) / 10;
      dataset.writeDataPoint({
        blobs: [method, pattern, statusClassOf(status), String(status)],
        doubles: [latencyMs],
        indexes: [pattern],
      });
    } catch {
      // metrics must never affect the request
    }
  }
}
