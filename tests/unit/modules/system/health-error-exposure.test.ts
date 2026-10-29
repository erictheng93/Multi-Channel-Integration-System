import { Hono, type Context, type Next } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const auth = vi.hoisted(() => ({ role: 'agent' }));

vi.mock('@/middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  jwtAuth: async (c: Context, next: Next) => { c.set('user', { id: 'u', role: auth.role }); return next(); },
}));
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: () => ({ get: async () => { throw new Error('D1_ERROR: no such table secret_table at /internal/path'); } }),
}));

import systemHandler from '@/modules/system/handlers/system-main';
import dataOptimizationHandler from '@/modules/system/handlers/data-optimization-main';

describe('health endpoints do not leak internals', () => {
  it('/api/system/health error branch returns a fixed message', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/system', systemHandler);
    const res = await app.request('/api/system/health', undefined, { DB: {} } as unknown as Bindings);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toMatch(/D1_ERROR|secret_table|internal/);
  });

  it('/api/data-optimization/health is admin only', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/data-optimization', dataOptimizationHandler);
    auth.role = 'agent';
    expect((await app.request('/api/data-optimization/health', undefined, { DB: {}, CACHE: {} } as unknown as Bindings)).status).toBe(403);
  });
});
