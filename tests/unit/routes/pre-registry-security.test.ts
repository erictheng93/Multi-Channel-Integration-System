/**
 * Auth boundaries of routes registered ahead of the unified route system (src/routes/pre-registry-routes.ts).
 * The real registration function runs; only authentication is faked.
 */
import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const auth = vi.hoisted(() => ({ user: { id: 'a1', role: 'agent' } as { id: string; role: string } | null }));

vi.mock('@/middleware/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    jwtAuth: vi.fn(async (c: Context, next: Next) => {
      if (!auth.user) { return c.json({ error: 'Unauthorized' }, 401); }
      c.set('user', auth.user);
      return next();
    }),
  };
});

import { registerPreRegistryRoutes } from '@/routes/pre-registry-routes';

function request(path: string, init?: RequestInit) {
  const app = new Hono<{ Bindings: Bindings }>();
  registerPreRegistryRoutes(app);
  return app.request(path, init, { DB: {}, KV: {}, CACHE: {} } as unknown as Bindings);
}

describe('pre-registry route auth', () => {
  beforeEach(() => { auth.user = { id: 'a1', role: 'agent' }; });

  describe('/api/analytics/comparison', () => {
    it('is closed to agents', async () => {
      expect((await request('/api/analytics/comparison/metric?metric=x')).status).toBe(403);
      expect((await request('/api/analytics/comparison/cache/stats')).status).toBe(403);
    });

    it('rejects ranges over 366 days for admins', async () => {
      auth.user = { id: 'adm', role: 'admin' };
      const res = await request('/api/analytics/comparison/metric?metric=x&currentStart=2020-01-01&currentEnd=2026-01-01');
      expect(res.status).toBe(400);
    });

    it('rejects malformed or inverted periods for admins', async () => {
      auth.user = { id: 'adm', role: 'admin' };
      expect((await request('/api/analytics/comparison/metric?metric=x&currentStart=nope&currentEnd=2026-01-01')).status).toBe(400);
      expect((await request('/api/analytics/comparison/metric?metric=x&currentStart=2026-02-01&currentEnd=2026-01-01')).status).toBe(400);
    });
  });
});

describe('websocket probes', () => {
  beforeEach(() => { auth.user = { id: 'a1', role: 'agent' }; });

  // Any touch of these bindings would be a per-hit cost on an anonymous endpoint
  const throwingEnv = new Proxy({}, { get: (_t, prop) => { throw new Error(`unexpected env access: ${String(prop)}`); } });
  const anonymous = (path: string) => {
    const app = new Hono<{ Bindings: Bindings }>();
    registerPreRegistryRoutes(app);
    return app.request(path, undefined, throwingEnv as unknown as Bindings);
  };

  it.each(['/api/websocket/health', '/api/websocket/readiness', '/api/websocket/liveness'])('%s is cheap and anonymous', async (path) => {
    auth.user = null;
    const res = await anonymous(path);
    expect(res.status).toBe(200);
    expect(await res.text()).not.toMatch(/error|environment|Durable/i);
  });

  it('migration-status needs a login', async () => {
    auth.user = null;
    expect((await request('/api/websocket/migration-status')).status).toBe(401);
  });

  it.each(['/api/websocket/metrics', '/api/websocket/health-detail'])('%s is admin only', async (path) => {
    expect((await request(path)).status).toBe(403);
  });
});

describe('monitoring probes', () => {
  beforeEach(() => { auth.user = { id: 'a1', role: 'agent' }; });

  it.each(['/api/monitoring/alerts', '/api/monitoring/circuit-breaker/status'])('%s is admin only', async (path) => {
    const res = await request(path);
    expect(res.status).toBe(403);
  });

  it('admins still get the alert list', async () => {
    auth.user = { id: 'adm', role: 'admin' };
    const res = await request('/api/monitoring/circuit-breaker/status');
    expect(res.status).not.toBe(403);
  });
});
