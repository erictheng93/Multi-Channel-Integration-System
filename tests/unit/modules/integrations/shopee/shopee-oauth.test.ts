import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import type { Context, Next } from 'hono';
import { createShopeeDb, createShopeeEnv, jsonResponse } from './shopee-test-env';

vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: Context, next: Next) => { c.set('user', { id: 'agent-1', role: 'admin' }); await next(); },
  requireAdmin: () => async (_c: Context, next: Next) => { await next(); },
}));

const { shopeeOAuthRouter } = await import('@/modules/integrations/handlers/shopee-oauth');
const { decryptShopeeCredentials } = await import('@/modules/integrations/services/shopee/shopee-token-service');

const SHOP = 228029969;
const STATE = '11111111-2222-4333-8444-555555555555';
let db: Database.Database;
let env: Awaited<ReturnType<typeof createShopeeEnv>>;

function shopeeFetch(tokens = { access_token: 'acc-1', refresh_token: 'ref-1' }) {
  const fetch = vi.fn(async (url: string) =>
    url.includes('/auth/token/get')
      ? jsonResponse({ ...tokens, expire_in: 14400, request_id: 'req-t' })
      : jsonResponse({ shop_name: 'Demo Mall', region: 'TW', expire_time: 1_800_000_000, request_id: 'req-s' }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const putState = () => env.CACHE.store.set(`shopee:oauth:state:${STATE}`, JSON.stringify({ teamId: 7, agentId: 'agent-1', env: 'sandbox' }));
const callback = (query: string) => shopeeOAuthRouter.request(`/oauth/callback?${query}`, {}, env);
const location = (res: Response) => res.headers.get('Location');
const rows = () => db.prepare("SELECT * FROM channel_integrations WHERE platform = 'shopee'").all() as Array<Record<string, unknown>>;

beforeEach(async () => {
  db = createShopeeDb();
  env = await createShopeeEnv(db);
});
afterEach(() => vi.unstubAllGlobals());

describe('GET /authorize-url', () => {
  it('stores a state bound to team/agent/env and returns the auth link', async () => {
    const res = await shopeeOAuthRouter.request('/authorize-url?teamId=7', {}, env);
    const body = (await res.json()) as { success: boolean; data: { url: string } };
    expect(body.success).toBe(true);
    const url = new URL(body.data.url);
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.example.test/api/integrations/shopee/oauth/callback');
    const state = url.searchParams.get('state')!;
    expect(JSON.parse(env.CACHE.store.get(`shopee:oauth:state:${state}`)!)).toEqual({ teamId: 7, agentId: 'agent-1', env: 'sandbox' });
  });

  it('rejects an unknown team', async () => {
    expect((await shopeeOAuthRouter.request('/authorize-url?teamId=99', {}, env)).status).toBe(404);
  });
});

describe('GET /oauth/callback', () => {
  it.each(['', `state=${STATE}`, 'state=not-a-uuid'])('missing/unknown state (%s) -> error redirect, no Shopee call', async (q) => {
    const fetch = shopeeFetch();
    const res = await callback(`code=c&shop_id=${SHOP}&${q}`);
    expect(res.status).toBe(302);
    expect(location(res)).toBe('https://app.example.test/channels?shopee=error&reason=invalid_state');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('state is single-use', async () => {
    shopeeFetch();
    putState();
    expect(location(await callback(`code=c&shop_id=${SHOP}&state=${STATE}`))).toBe('https://app.example.test/channels?shopee=connected');
    expect(location(await callback(`code=c&shop_id=${SHOP}&state=${STATE}`))).toContain('reason=invalid_state');
  });

  it('rejects main_account_id authorization', async () => {
    const fetch = shopeeFetch();
    putState();
    const res = await callback(`code=c&main_account_id=555&state=${STATE}`);
    expect(location(res)).toBe('https://app.example.test/channels?shopee=error&reason=main_account_unsupported');
    expect(fetch).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  it('token exchange failure redirects with a short code, no Shopee message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'error_param', message: 'secret-ish detail', request_id: 'x' }, 400)));
    putState();
    const loc = location(await callback(`code=c&shop_id=${SHOP}&state=${STATE}`))!;
    expect(loc).toBe('https://app.example.test/channels?shopee=error&reason=token_exchange_failed');
  });

  it('success upserts the channel row with encrypted credentials', async () => {
    shopeeFetch();
    putState();
    await callback(`code=c&shop_id=${SHOP}&state=${STATE}`);
    const [row] = rows();
    expect(row).toMatchObject({ team_id: 7, is_active: 1, configured_by: 'agent-1' });
    expect(JSON.parse(String(row!.config))).toEqual({
      shopId: SHOP, env: 'sandbox', shopName: 'Demo Mall', region: 'TW', authStatus: 'active', authExpireAt: 1_800_000_000,
    });
    const stored = String(row!.credentials);
    expect(stored).not.toContain('acc-1');
    expect(stored).not.toContain('ref-1');
    expect(await decryptShopeeCredentials(env, stored)).toMatchObject({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('re-authorizing an existing shop updates the same row and clears reauth_required', async () => {
    db.prepare("INSERT INTO channel_integrations (id, team_id, platform, config, is_active) VALUES (42, 7, 'shopee', ?, 0)")
      .run(JSON.stringify({ shopId: SHOP, env: 'sandbox', authStatus: 'reauth_required', authStatusReason: 'refresh_failed:error_auth' }));
    shopeeFetch({ access_token: 'acc-2', refresh_token: 'ref-2' });
    putState();
    await callback(`code=c&shop_id=${SHOP}&state=${STATE}`);
    const all = rows();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(42);
    expect(all[0]!.is_active).toBe(1);
    expect(JSON.parse(String(all[0]!.config)).authStatus).toBe('active');
    expect(await decryptShopeeCredentials(env, String(all[0]!.credentials))).toMatchObject({ accessToken: 'acc-2' });
  });
});
