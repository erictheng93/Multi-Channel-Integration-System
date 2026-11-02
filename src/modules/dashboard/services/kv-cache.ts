// Small read-through KV cache for dashboard aggregates.
//
// KV enforces expirationTtl >= 60 s, so 60 s is the shortest honest freshness.
// Every failure (binding missing, KV outage, bad JSON) degrades to computing
// the value: the cache can never break an endpoint.

import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('DashboardCache');

/** Shortest TTL KV allows; used for the cheap-ish summary and waiting list. */
export const DASHBOARD_SUMMARY_TTL_SECONDS = 60;
/** Heavier day x platform scan. */
export const DASHBOARD_VOLUME_TTL_SECONDS = 300;

export async function readThrough<T>(
  kv: KVNamespace | undefined,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  if (kv) {
    try {
      const hit = await kv.get(key, 'json');
      if (hit !== null && hit !== undefined) {
        return hit as T;
      }
    } catch (error) {
      log.warn('KV read failed, computing', { key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const value = await compute();

  if (kv) {
    try {
      await kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
    } catch (error) {
      log.warn('KV write failed (non-fatal)', { key, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return value;
}
