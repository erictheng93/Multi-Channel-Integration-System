import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ShopeeApiError,
  buildAuthorizationUrl,
  getAccessTokenByCode,
  getShopInfo,
  refreshAccessToken,
  shopeeSign,
  type ShopeeAppConfig,
} from '@/modules/integrations/services/shopee/shopee-api-client';
import { jsonResponse } from './shopee-test-env';

const cfg: ShopeeAppConfig = { env: 'sandbox', partnerId: 1255141, partnerKey: 'test-partner-key' };
const TS = 1_700_000_000;

// Vectors computed independently with python3: hmac.new(b'test-partner-key', base, hashlib.sha256).hexdigest()
const SIGN_TOKEN_GET = '9895eb81d8920dd870009c801e71a3075752954928b2be01e4cfdb25d62c5b01'; // gitleaks:allow
const SIGN_REFRESH = '33d97a1626ad79049a48578bc79bdb967507d9512b7bd0aad23539588dc7d4a1';
const SIGN_SHOP_INFO = '19156c3e406f15144d543badb4a252714619c8d83410ec33c50500b57a93d6c6';

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) {throw response;}
    return response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('shopeeSign', () => {
  it('matches python hmac for public and shop base strings', async () => {
    expect(await shopeeSign('test-partner-key', `1255141/api/v2/auth/token/get${TS}`)).toBe(SIGN_TOKEN_GET);
    expect(await shopeeSign('test-partner-key', `1255141/api/v2/shop/get_shop_info${TS}tok-abc228029969`)).toBe(SIGN_SHOP_INFO);
  });
});

describe('shopee api calls', () => {
  it('getAccessTokenByCode signs the public base and posts code/shop_id/partner_id', async () => {
    vi.useFakeTimers({ now: TS * 1000, toFake: ['Date'] });
    const fetch = mockFetch(jsonResponse({ access_token: 'a1', refresh_token: 'r1', expire_in: 14400, request_id: 'req-1', error: '' }));
    const tokens = await getAccessTokenByCode(cfg, 'code-1', 228029969);
    expect(tokens).toEqual({ accessToken: 'a1', refreshToken: 'r1', expireIn: 14400, requestId: 'req-1' });
    const [url, init] = fetch.mock.calls[0]!;
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://openplatform.sandbox.test-stable.shopee.sg/api/v2/auth/token/get');
    expect(Object.fromEntries(u.searchParams)).toEqual({ partner_id: '1255141', timestamp: String(TS), sign: SIGN_TOKEN_GET });
    expect(JSON.parse(String(init?.body))).toEqual({ code: 'code-1', shop_id: 228029969, partner_id: 1255141 });
  });

  it('refreshAccessToken uses the live host and returns the rotated refresh_token', async () => {
    vi.useFakeTimers({ now: TS * 1000, toFake: ['Date'] });
    const fetch = mockFetch(jsonResponse({ access_token: 'a2', refresh_token: 'r2', expire_in: 14400, request_id: 'req-2' }));
    const tokens = await refreshAccessToken({ ...cfg, env: 'live' }, 'r1', 228029969);
    expect(tokens.refreshToken).toBe('r2');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url.startsWith('https://partner.shopeemobile.com/api/v2/auth/access_token/get?')).toBe(true);
    expect(new URL(url).searchParams.get('sign')).toBe(SIGN_REFRESH);
    expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: 'r1', partner_id: 1255141, shop_id: 228029969 });
  });

  it('getShopInfo uses the shop sign and maps fields', async () => {
    vi.useFakeTimers({ now: TS * 1000, toFake: ['Date'] });
    const fetch = mockFetch(jsonResponse({ shop_name: 'Demo', region: 'TW', status: 'NORMAL', expire_time: 1_731_000_000, request_id: 'r' }));
    expect(await getShopInfo(cfg, 'tok-abc', 228029969)).toEqual({ shopName: 'Demo', region: 'TW', status: 'NORMAL', authExpireAt: 1_731_000_000 });
    const params = new URL(fetch.mock.calls[0]![0]).searchParams;
    expect(params.get('sign')).toBe(SIGN_SHOP_INFO);
    expect(params.get('access_token')).toBe('tok-abc');
    expect(params.get('shop_id')).toBe('228029969');
  });

  it('treats absent expire_time as unknown', async () => {
    mockFetch(jsonResponse({ shop_name: 'Demo' }));
    expect((await getShopInfo(cfg, 't', 1)).authExpireAt).toBeUndefined();
  });

  it('non-empty error is a failure carrying request_id, even on HTTP 200', async () => {
    mockFetch(jsonResponse({ error: 'error_auth', message: 'Invalid refresh_token', request_id: 'req-x' }));
    const err = await refreshAccessToken(cfg, 'r', 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ShopeeApiError);
    expect(err).toMatchObject({ code: 'error_auth', status: 200, requestId: 'req-x', detail: 'Invalid refresh_token' });
  });

  it('network failure becomes status 0', async () => {
    mockFetch(new TypeError('fetch failed'));
    await expect(getAccessTokenByCode(cfg, 'c', 1)).rejects.toMatchObject({ code: 'network_error', status: 0 });
  });

  it('5xx without a body is a failure', async () => {
    mockFetch(new Response('oops', { status: 502 }));
    await expect(getAccessTokenByCode(cfg, 'c', 1)).rejects.toMatchObject({ code: 'http_502', status: 502 });
  });
});

describe('buildAuthorizationUrl', () => {
  it('builds the seller auth link for the env', () => {
    const u = new URL(buildAuthorizationUrl(cfg, 'https://api.example.test/cb', 'st-1'));
    expect(u.origin + u.pathname).toBe('https://open.sandbox.test-stable.shopee.com/auth');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      partner_id: '1255141', auth_type: 'seller', redirect_uri: 'https://api.example.test/cb', response_type: 'code', state: 'st-1',
    });
  });
});
