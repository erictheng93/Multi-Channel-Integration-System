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

  const IP = { 'CF-Connecting-IP': '203.0.113.9' };
  const lineVerifyOk = () =>
    new Response(JSON.stringify({ sub: 'U-booth-customer', aud: '1234567890', exp: Math.floor(Date.now() / 1000) + 600 }), { status: 200 });

  function limiterStub(status: number) {
    const fetchLimiter = vi.fn(async () => new Response('{}', { status }));
    const RATE_LIMITER = {
      idFromName: vi.fn((n: string) => n),
      get: vi.fn(() => ({ fetch: fetchLimiter })),
    } as unknown as DurableObjectNamespace;
    return { fetchLimiter, RATE_LIMITER };
  }

  function kvStub(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    const CACHE = {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    } as unknown as KVNamespace;
    return { CACHE, store };
  }

  it.each(['/assign-team', '/welcome'])('%s never limits valid tokens: a booth crowd on one IP all get through', async (path) => {
    const { fetchLimiter, RATE_LIMITER } = limiterStub(429); // even a saturated limiter must not matter
    const { CACHE, store } = kvStub();
    fetchSpy.mockImplementation(async () => lineVerifyOk());

    for (let i = 0; i < 50; i++) {
      const res = await post(path, { teamId: 1, idToken: 'aaa.bbb.ccc' }, { RATE_LIMITER, CACHE }, IP);
      expect(res.status).not.toBe(429);
      expect(res.status).not.toBe(401);
    }
    expect(fetchLimiter).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it.each(['/assign-team', '/welcome'])('%s counts LINE rejections and blocks the IP once over the limit', async (path) => {
    const { fetchLimiter, RATE_LIMITER } = limiterStub(429);
    const { CACHE, store } = kvStub();
    fetchSpy.mockImplementation(async () => new Response('{"error":"invalid_request"}', { status: 400 }));

    const res = await post(path, { teamId: 1, idToken: 'aaa.bbb.ccc' }, { RATE_LIMITER, CACHE }, IP);

    expect(res.status).toBe(401);
    expect(fetchLimiter).toHaveBeenCalledOnce();
    expect(JSON.parse((fetchLimiter.mock.calls[0] as unknown as [string, { body: string }])[1].body).clientId).toBe('liff-reject:203.0.113.9');
    expect(store.get('liff-block:203.0.113.9')).toBe('1');
  });

  it.each(['/assign-team', '/welcome'])('%s answers a blocked IP with 429 and no LINE call', async (path) => {
    const { CACHE } = kvStub({ 'liff-block:203.0.113.9': '1' });

    const res = await post(path, { teamId: 1, idToken: 'aaa.bbb.ccc' }, { CACHE }, IP);

    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['/assign-team', '/welcome'])('%s does not count LINE outages (5xx, network) against customers', async (path) => {
    const { fetchLimiter, RATE_LIMITER } = limiterStub(429);
    const { CACHE, store } = kvStub();

    fetchSpy.mockImplementationOnce(async () => new Response('down', { status: 503 }));
    expect((await post(path, { teamId: 1, idToken: 'aaa.bbb.ccc' }, { RATE_LIMITER, CACHE }, IP)).status).toBe(401);
    fetchSpy.mockImplementationOnce(async () => { throw new Error('network'); });
    expect((await post(path, { teamId: 1, idToken: 'aaa.bbb.ccc' }, { RATE_LIMITER, CACHE }, IP)).status).toBe(401);

    expect(fetchLimiter).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });
});
