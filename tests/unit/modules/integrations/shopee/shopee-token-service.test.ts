import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { createShopeeDb, createShopeeEnv, jsonResponse } from './shopee-test-env';

// The real DistributedLockService is a no-op without the DO binding; use an in-memory mutex so the
// re-read-inside-the-lock logic is what the concurrency test exercises.
vi.mock('@/services/distributed-lock-service', () => {
  const tails = new Map<string, Promise<unknown>>();
  class DistributedLockService {
    async withLock<T>(resource: string, fn: () => Promise<T>): Promise<T> {
      const prev = tails.get(resource) ?? Promise.resolve();
      const run = prev.catch(() => undefined).then(fn);
      tails.set(resource, run);
      return run;
    }
  }
  return { DistributedLockService };
});

const {
  getValidAccessToken,
  encryptShopeeCredentials,
  decryptShopeeCredentials,
  ShopeeReauthRequiredError,
} = await import('@/modules/integrations/services/shopee/shopee-token-service');

const SHOP = 228029969;
const now = () => Math.floor(Date.now() / 1000);
let db: Database.Database;
let env: Awaited<ReturnType<typeof createShopeeEnv>>;

async function seed(accessExpireAt: number, authStatus = 'active') {
  const creds = await encryptShopeeCredentials(env, { accessToken: 'old-a', refreshToken: 'old-r', accessExpireAt });
  db.prepare('INSERT INTO channel_integrations (id, team_id, platform, config, credentials) VALUES (1, 7, ?, ?, ?)')
    .run('shopee', JSON.stringify({ shopId: SHOP, env: 'sandbox', authStatus }), creds);
}
const row = () => db.prepare('SELECT config, credentials FROM channel_integrations WHERE id = 1').get() as { config: string; credentials: string };

beforeEach(async () => {
  db = createShopeeDb();
  env = await createShopeeEnv(db);
});
afterEach(() => vi.unstubAllGlobals());

describe('getValidAccessToken', () => {
  it('returns the stored token without refreshing when > 5 min remain', async () => {
    await seed(now() + 3600);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await getValidAccessToken(env, SHOP)).toBe('old-a');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('concurrent callers trigger exactly one refresh and persist the rotated refresh_token', async () => {
    await seed(now() + 60);
    const fetch = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return jsonResponse({ access_token: 'new-a', refresh_token: 'new-r', expire_in: 14400, request_id: 'q' });
    });
    vi.stubGlobal('fetch', fetch);
    const results = await Promise.all(Array.from({ length: 5 }, () => getValidAccessToken(env, SHOP)));
    expect(results).toEqual(Array(5).fill('new-a'));
    expect(fetch).toHaveBeenCalledTimes(1);
    const stored = await decryptShopeeCredentials(env, row().credentials);
    expect(stored).toMatchObject({ accessToken: 'new-a', refreshToken: 'new-r' });
    expect(stored.accessExpireAt).toBeGreaterThan(now() + 14000);
  });

  it('auth-gone refresh failure marks reauth_required and throws the typed error', async () => {
    await seed(now() - 10);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'error_auth', message: 'Invalid refresh_token', request_id: 'q' }, 403)));
    await expect(getValidAccessToken(env, SHOP)).rejects.toBeInstanceOf(ShopeeReauthRequiredError);
    expect(JSON.parse(row().config)).toMatchObject({ authStatus: 'reauth_required', authStatusReason: 'refresh_failed:error_auth' });
  });

  it('transient failure throws and leaves status and credentials unchanged', async () => {
    await seed(now() - 10);
    const before = row();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
    const err = await getValidAccessToken(env, SHOP).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ShopeeReauthRequiredError);
    expect(row()).toEqual(before);
  });

  it('does not call Shopee for a shop already marked reauth_required', async () => {
    await seed(now() - 10, 'reauth_required');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(getValidAccessToken(env, SHOP)).rejects.toBeInstanceOf(ShopeeReauthRequiredError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
