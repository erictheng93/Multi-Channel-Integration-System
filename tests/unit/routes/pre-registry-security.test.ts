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
