/**
 * Shopee Open Platform v2 client (Worker, Web Crypto). Reference: scripts/shopee/shopee-auth-probe.ts.
 * Sign = lowercase hex HMAC-SHA256(partner_key, partner_id + path + timestamp [+ access_token + shop_id]).
 */
import type { Bindings } from '@/types';
import type { ShopeeChannelConfig } from './shopee-types';

export type ShopeeEnv = ShopeeChannelConfig['env'];

export const SHOPEE_API_HOSTS: Record<ShopeeEnv, string> = {
  live: 'https://partner.shopeemobile.com',
  sandbox: 'https://openplatform.sandbox.test-stable.shopee.sg',
};

export const SHOPEE_AUTH_HOSTS: Record<ShopeeEnv, string> = {
  live: 'https://open.shopee.com/auth',
  sandbox: 'https://open.sandbox.test-stable.shopee.com/auth',
};

export interface ShopeeAppConfig {
  env: ShopeeEnv;
  partnerId: number;
  partnerKey: string;
}

/** Shopee answered with a non-empty `error`, a non-2xx status, or could not be reached (`status` 0). */
export class ShopeeApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
    /** Shopee's message; for logs only, never for URLs shown to users. */
    readonly detail?: string,
  ) {
    super(`Shopee API ${code} (HTTP ${status}${requestId ? `, request_id ${requestId}` : ''})`);
    this.name = 'ShopeeApiError';
  }
}

export interface ShopeeTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until access_token expires. */
  expireIn: number;
  requestId?: string;
}

export interface ShopeeShopInfo {
  shopName?: string;
  region?: string;
  status?: string;
  /** Authorization end, unix seconds; undefined when Shopee does not report it. */
  authExpireAt?: number;
}

/** App-level config from env; throws when Shopee is not configured. */
export function shopeeAppConfig(env: Pick<Bindings, 'SHOPEE_ENV' | 'SHOPEE_PARTNER_ID' | 'SHOPEE_PARTNER_KEY'>): ShopeeAppConfig {
  const partnerId = Number(env.SHOPEE_PARTNER_ID);
  if (!Number.isInteger(partnerId) || partnerId <= 0 || !env.SHOPEE_PARTNER_KEY) {
    throw new Error('Shopee is not configured (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY)');
  }
  return { env: env.SHOPEE_ENV === 'live' ? 'live' : 'sandbox', partnerId, partnerKey: env.SHOPEE_PARTNER_KEY };
}

export async function shopeeSign(partnerKey: string, base: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(partnerKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(base)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

async function signedUrl(cfg: ShopeeAppConfig, path: string, shop?: { accessToken: string; shopId: number }): Promise<string> {
  const timestamp = nowSeconds();
  const base = `${cfg.partnerId}${path}${timestamp}${shop ? `${shop.accessToken}${shop.shopId}` : ''}`;
  const params = new URLSearchParams({
    partner_id: String(cfg.partnerId),
    timestamp: String(timestamp),
    sign: await shopeeSign(cfg.partnerKey, base),
  });
  if (shop) {
    params.set('access_token', shop.accessToken);
    params.set('shop_id', String(shop.shopId));
  }
  return `${SHOPEE_API_HOSTS[cfg.env]}${path}?${params.toString()}`;
}

async function call(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    throw new ShopeeApiError('network_error', 0, undefined, error instanceof Error ? error.message : String(error));
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const requestId = typeof body.request_id === 'string' ? body.request_id : undefined;
  const error = typeof body.error === 'string' ? body.error : '';
  if (error || !res.ok) {
    throw new ShopeeApiError(error || `http_${res.status}`, res.status, requestId, typeof body.message === 'string' ? body.message : undefined);
  }
  return body;
}

function parseTokens(body: Record<string, unknown>): ShopeeTokens {
  const { access_token, refresh_token, expire_in, request_id } = body;
  if (typeof access_token !== 'string' || !access_token || typeof refresh_token !== 'string' || !refresh_token || typeof expire_in !== 'number') {
    throw new ShopeeApiError('invalid_token_response', 200, typeof request_id === 'string' ? request_id : undefined);
  }
  return { accessToken: access_token, refreshToken: refresh_token, expireIn: expire_in, requestId: typeof request_id === 'string' ? request_id : undefined };
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Exchanges the single-use (10 min) authorization code for this shop's tokens. */
export async function getAccessTokenByCode(cfg: ShopeeAppConfig, code: string, shopId: number): Promise<ShopeeTokens> {
  const path = '/api/v2/auth/token/get';
  return parseTokens(await call(await signedUrl(cfg, path), postJson({ code, shop_id: shopId, partner_id: cfg.partnerId })));
}

/** Rotates both tokens; the caller must persist the new refresh_token or the shop needs re-authorization. */
export async function refreshAccessToken(cfg: ShopeeAppConfig, refreshToken: string, shopId: number): Promise<ShopeeTokens> {
  const path = '/api/v2/auth/access_token/get';
  return parseTokens(await call(await signedUrl(cfg, path), postJson({ refresh_token: refreshToken, partner_id: cfg.partnerId, shop_id: shopId })));
}

export async function getShopInfo(cfg: ShopeeAppConfig, accessToken: string, shopId: number): Promise<ShopeeShopInfo> {
  const body = await call(await signedUrl(cfg, '/api/v2/shop/get_shop_info', { accessToken, shopId }));
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  // expire_time is the documented auth-expiry field; anything else is treated as unknown.
  const expire = body.expire_time;
  return {
    shopName: str(body.shop_name),
    region: str(body.region),
    status: str(body.status),
    authExpireAt: typeof expire === 'number' && expire > 0 ? expire : undefined,
  };
}

/** Seller authorization link; Shopee echoes `state` back to `redirectUri` with `code` and `shop_id`. */
export function buildAuthorizationUrl(cfg: ShopeeAppConfig, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    partner_id: String(cfg.partnerId),
    auth_type: 'seller',
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `${SHOPEE_AUTH_HOSTS[cfg.env]}?${params.toString()}`;
}
