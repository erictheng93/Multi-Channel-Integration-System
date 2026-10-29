import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';
import liffHandler from '@/modules/liff/handlers/liff';

const post = (path: string, body: unknown, env: Partial<Bindings>, headers: Record<string, string> = {}) => {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/liff', liffHandler);
  return app.request(
    `/api/liff${path}`,
    { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) },
    { LINE_LIFF_ID: '1234567890-abcdefgh', DB: {}, ...env } as unknown as Bindings
  );
};

describe('anonymous LIFF endpoints', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  afterEach(() => fetchSpy.mockReset());

  it.each(['/assign-team', '/welcome'])('%s rejects a malformed idToken without calling LINE', async (path) => {
    for (const idToken of ['not-a-jwt', 'a.b', 'x'.repeat(5000), '', 123, 'a b.c.d']) {
      const res = await post(path, { teamId: 1, idToken }, {});
      expect(res.status).toBe(401);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['/assign-team', '/welcome'])('%s is rate limited per IP before any LINE call', async (path) => {
    const fetchLimiter = vi.fn(async () => new Response('{}', { status: 429 }));
    const RATE_LIMITER = {
      idFromName: vi.fn((n: string) => n),
      get: vi.fn(() => ({ fetch: fetchLimiter })),
    } as unknown as DurableObjectNamespace;

    const res = await post(path, { teamId: 1, idToken: 'aaa.bbb.ccc' }, { RATE_LIMITER }, { 'CF-Connecting-IP': '203.0.113.9' });

    expect(res.status).toBe(429);
    expect(fetchLimiter).toHaveBeenCalledOnce();
    expect(JSON.parse((fetchLimiter.mock.calls[0] as unknown as [string, { body: string }])[1].body).clientId).toBe('liff-ip:203.0.113.9');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
