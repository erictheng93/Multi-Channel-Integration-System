/**
 * Per-shop access tokens, refreshed on demand (no timers or DO alarms).
 * refresh_token rotates on every refresh, so refreshes are serialized per shop with LockCoordinator;
 * two parallel refreshes would leave one stored refresh_token dead and force a re-authorization.
 */
import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { getEncryptionService, type EncryptedData } from '@/services/encryption-service';
import { DistributedLockService } from '@/services/distributed-lock-service';
import { ShopeeApiError, refreshAccessToken, shopeeAppConfig } from './shopee-api-client';
import { findShopeeChannelByShopId, saveShopeeCredentials, updateShopeeChannelConfig } from './shopee-channel-repository';
import type { ShopeeChannelCredentials } from './shopee-types';

/** Refresh when less than this is left on the access token. */
const REFRESH_MARGIN_SECONDS = 5 * 60;

/** The shop must authorize MCIS again; retrying will not help. */
export class ShopeeReauthRequiredError extends Error {
  constructor(readonly shopId: number, readonly reason: string) {
    super(`Shopee shop ${shopId} needs re-authorization (${reason})`);
    this.name = 'ShopeeReauthRequiredError';
  }
}

/** Lock resource shared by token refresh and OAuth re-authorization of the same shop. */
export const shopeeTokenLockResource = (shopId: number): string => `shopee:token:${shopId}`;

export async function encryptShopeeCredentials(env: Pick<Bindings, 'ENCRYPTION_KEY'>, creds: ShopeeChannelCredentials): Promise<string> {
  const service = await getEncryptionService(env.ENCRYPTION_KEY);
  return JSON.stringify(await service.encrypt(JSON.stringify(creds)));
}

export async function decryptShopeeCredentials(env: Pick<Bindings, 'ENCRYPTION_KEY'>, stored: string): Promise<ShopeeChannelCredentials> {
  const service = await getEncryptionService(env.ENCRYPTION_KEY);
  return JSON.parse(await service.decrypt(JSON.parse(stored) as EncryptedData)) as ShopeeChannelCredentials;
}

/**
 * Refresh failures that mean the authorization itself is gone (expired, cancelled, refresh_token dead).
 * Anything else (network, 5xx, rate limit, unknown codes) is treated as transient and leaves status alone.
 */
export function isAuthGoneError(error: ShopeeApiError): boolean {
  if (error.status === 0 || error.status >= 500) {return false;}
  if (['error_auth', 'error_permission', 'invalid_refresh_token', 'error_invalid_refresh_token'].includes(error.code)) {return true;}
  return error.code === 'error_param' && /refresh[_ ]?token|expired|not authori[sz]ed/i.test(error.detail ?? '');
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000);
const isFresh = (creds: ShopeeChannelCredentials): boolean => creds.accessExpireAt - nowSeconds() > REFRESH_MARGIN_SECONDS;

async function loadUsableChannel(env: Bindings, shopId: number) {
  const channel = await findShopeeChannelByShopId(createDbClient(env.DB), shopId);
  if (!channel?.credentials) {throw new ShopeeReauthRequiredError(shopId, 'not_connected');}
  const { authStatus, authStatusReason } = channel.config;
  if (authStatus === 'reauth_required' || authStatus === 'revoked') {
    throw new ShopeeReauthRequiredError(shopId, authStatusReason ?? authStatus);
  }
  return { channel, creds: await decryptShopeeCredentials(env, channel.credentials) };
}

/** A usable access token for the shop; refreshes (once, across workers) when < 5 min remain. */
export async function getValidAccessToken(env: Bindings, shopId: number): Promise<string> {
  const first = await loadUsableChannel(env, shopId);
  if (isFresh(first.creds)) {return first.creds.accessToken;}

  return new DistributedLockService(env).withLock(shopeeTokenLockResource(shopId), async () => {
    // Re-read inside the lock: another worker may have refreshed while we waited.
    const { channel, creds } = await loadUsableChannel(env, shopId);
    if (isFresh(creds)) {return creds.accessToken;}

    const db = createDbClient(env.DB);
    let tokens;
    try {
      tokens = await refreshAccessToken(shopeeAppConfig(env), creds.refreshToken, shopId);
    } catch (error) {
      if (error instanceof ShopeeApiError && isAuthGoneError(error)) {
        const reason = `refresh_failed:${error.code}`;
        await updateShopeeChannelConfig(db, channel, { authStatus: 'reauth_required', authStatusReason: reason });
        throw new ShopeeReauthRequiredError(shopId, reason);
      }
      throw error;
    }
    const next: ShopeeChannelCredentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpireAt: nowSeconds() + tokens.expireIn,
    };
    await saveShopeeCredentials(db, channel.id, await encryptShopeeCredentials(env, next));
    return next.accessToken;
  });
}
