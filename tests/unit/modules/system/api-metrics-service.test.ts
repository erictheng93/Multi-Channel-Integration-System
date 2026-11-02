import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getApiMetricsSummary,
  buildSummary,
  API_METRICS_CACHE_KEY,
} from '@/modules/system/services/api-metrics-service';
import type { Bindings } from '@/types';

const NOW = '2026-10-29T10:00:00.000Z';

function kv() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (k: string) => (store.has(k) ? JSON.parse(store.get(k) as string) : null)),
    put: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  };
}

function envWith(cache = kv(), configured = true): Bindings {
  return {
    CACHE: cache,
    ...(configured ? { CF_ACCOUNT_ID: 'acc', CF_ANALYTICS_TOKEN: 'tok' } : {}),
  } as unknown as Bindings;
}

const AGG = [
  { method: 'GET', route: '/api/conversations/:id', requests: '1000', p50: 40, p95: '250.4', avg_ms: 60 },
  { method: 'POST', route: '/api/messages', requests: 100, p50: 90, p95: 4000, avg_ms: 200 },
];
const STATUS = [
  { method: 'GET', route: '/api/conversations/:id', status: '200', requests: 990 },
  { method: 'GET', route: '/api/conversations/:id', status: '404', requests: 10 },
  { method: 'POST', route: '/api/messages', status: '200', requests: 90 },
  { method: 'POST', route: '/api/messages', status: '502', requests: 10 },
];
const PREV = [{ method: 'GET', route: '/api/conversations/:id', avg_ms: 50 }];

function mockFetch() {
  const fn = vi.fn(async (_url: string, init: RequestInit) => {
    const body = String(init.body);
    const data = body.includes('quantileExactWeighted') ? AGG : body.includes('blob4') ? STATUS : PREV;
    return new Response(JSON.stringify({ data }), { status: 200 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('buildSummary', () => {
  const s = buildSummary(AGG, STATUS, PREV, NOW);

  it('computes success rate as non-5xx, status classes, delta', () => {
    const [a, b] = s.endpoints;
    expect(a.successRate).toBe(100);
    expect(a.statusClasses).toEqual({ '2xx': 990, '4xx': 10 });
    expect(a.responseTime).toBe(250.4);
    expect(a.avgResponseTimeDeltaPct).toBe(20);
    expect(a.status).toBe('healthy');
    expect(b.successRate).toBe(90);
    expect(b.errorCount).toBe(10);
    expect(b.status).toBe('error');
    expect(b.avgResponseTimeDeltaPct).toBeNull();
  });

  it('derives events only from real error rates and fills stats', () => {
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({ type: 'error' });
    expect(s.stats).toMatchObject({ totalEndpoints: 2, healthyCount: 1, errorCount: 1 });
  });

  it('is empty (no fake data) with no rows', () => {
    const e = buildSummary([], [], [], NOW);
    expect(e.endpoints).toEqual([]);
    expect(e.events).toEqual([]);
    expect(e.stats.avgResponseTime).toBe(0);
  });
});

describe('getApiMetricsSummary', () => {
  it('returns configured:false without secrets and never calls fetch', async () => {
    const f = mockFetch();
    const s = await getApiMetricsSummary(envWith(kv(), false), NOW);
    expect(s.configured).toBe(false);
    expect(s.endpoints).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('queries the SQL API with the bearer token, weighted by _sample_interval, then caches', async () => {
    const f = mockFetch();
    const cache = kv();
    const s = await getApiMetricsSummary(envWith(cache), NOW);
    expect(s.configured).toBe(true);
    expect(s.endpoints).toHaveLength(2);
    expect(f).toHaveBeenCalledTimes(3);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/analytics_engine/sql');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(String(init.body)).toContain('_sample_interval');
    expect(String(init.body)).toContain('mcis_api_metrics');
    expect(cache.put).toHaveBeenCalledWith(API_METRICS_CACHE_KEY, expect.any(String), { expirationTtl: 60 });

    f.mockClear();
    const again = await getApiMetricsSummary(envWith(cache), NOW);
    expect(again.endpoints).toHaveLength(2);
    expect(f).not.toHaveBeenCalled();
  });

  it('reports an error state (not fake numbers) when the SQL API fails, and does not cache it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 403 })));
    const cache = kv();
    const s = await getApiMetricsSummary(envWith(cache), NOW);
    expect(s.configured).toBe(true);
    expect(s.error).toContain('403');
    expect(s.endpoints).toEqual([]);
    expect(cache.put).not.toHaveBeenCalled();
  });
});
