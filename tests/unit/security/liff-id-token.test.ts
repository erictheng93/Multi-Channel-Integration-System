import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyLiffIdToken } from '@/modules/liff/handlers/line-id-token';
import liffHandler from '@/modules/liff/handlers/liff';

afterEach(() => vi.unstubAllGlobals());

describe('verifyLiffIdToken', () => {
  it('returns sub and sends the login channel id as client_id', async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sub: 'Uabc', aud: '2007743547', exp: Date.now() / 1000 + 600 }))
    );
    vi.stubGlobal('fetch', f);
    expect(await verifyLiffIdToken('tok', '2007743547-EnXG6puw')).toBe('Uabc');
    expect(String(f.mock.calls[0][1].body)).toContain('client_id=2007743547');
  });
  it('rejects LINE errors, wrong audience, missing token/config', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));
    expect(await verifyLiffIdToken('bad', '1-x')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ sub: 'U', aud: '999' }))));
    expect(await verifyLiffIdToken('t', '1-x')).toBeNull();
    expect(await verifyLiffIdToken(undefined, '1-x')).toBeNull();
    expect(await verifyLiffIdToken('t', undefined)).toBeNull();
  });
});

describe('LIFF endpoints', () => {
  it('reject a body lineUserId without a verified token', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    for (const path of ['/assign-team', '/welcome']) {
      const res = await liffHandler.request(
        path,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId: 'Uvictim', teamId: 2 }) },
        { LINE_LIFF_ID: '1-x' } as never
      );
      expect(res.status).toBe(401);
    }
    expect(f).not.toHaveBeenCalled();
  });
});
