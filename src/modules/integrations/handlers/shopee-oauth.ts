/**
 * Shopee seller OAuth (docs/specs/shopee-chat-phase-1.md §5 商店授權).
 *  GET /authorize-url  (admin)  -> auth link with a single-use state bound to { teamId, agentId, env }
 *  GET /oauth/callback (public) -> consume state, exchange code, upsert the shop's channel row, 302 to /channels
 */
import { Hono, type Context } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import type { Bindings } from '@/types';
import { jwtAuth, requireAdmin } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { teams } from '@/db/schema';
import { getBackendUrlFromContext, getFrontendUrlFromContext } from '@/config/runtime';
import { DistributedLockService } from '@/services/distributed-lock-service';
import { createContextLogger } from '@/utils/logger';
import {
  ShopeeApiError,
  buildAuthorizationUrl,
  getAccessTokenByCode,
  getShopInfo,
  shopeeAppConfig,
  type ShopeeEnv,
  type ShopeeShopInfo,
} from '../services/shopee/shopee-api-client';
import { upsertShopeeChannel } from '../services/shopee/shopee-channel-repository';
import { encryptShopeeCredentials, shopeeTokenLockResource } from '../services/shopee/shopee-token-service';

const log = createContextLogger('ShopeeOAuth');

export const SHOPEE_OAUTH_CALLBACK_PATH = '/api/integrations/shopee/oauth/callback';
const STATE_TTL_SECONDS = 10 * 60; // matches the code's 10-minute validity
const stateKey = (state: string): string => `shopee:oauth:state:${state}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OAuthState {
  teamId: number;
  agentId: string;
  env: ShopeeEnv;
}

type AppContext = Context<{ Bindings: Bindings }>;

/** Only fixed short codes reach the URL; never tokens or Shopee messages. */
function redirectToChannels(c: AppContext, reason?: string): Response {
  const query = reason ? `shopee=error&reason=${encodeURIComponent(reason)}` : 'shopee=connected';
  return c.redirect(`${getFrontendUrlFromContext(c)}/channels?${query}`, 302);
}

export const shopeeOAuthRouter = new Hono<{ Bindings: Bindings }>();

shopeeOAuthRouter.get('/authorize-url', jwtAuth, requireAdmin(), async (c) => {
  const teamId = Number(c.req.query('teamId'));
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return c.json({ success: false, error: 'teamId must be a positive integer' }, 400);
  }
  let app;
  try {
    app = shopeeAppConfig(c.env);
  } catch {
    return c.json({ success: false, error: 'Shopee is not configured' }, 503);
  }
  const team = await createDbClient(c.env.DB)
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .get();
  if (!team) {return c.json({ success: false, error: 'Team not found' }, 404);}

  const state = crypto.randomUUID();
  const payload: OAuthState = { teamId, agentId: String(c.get('user').id), env: app.env };
  await c.env.CACHE.put(stateKey(state), JSON.stringify(payload), { expirationTtl: STATE_TTL_SECONDS });
  const redirectUri = `${getBackendUrlFromContext(c)}${SHOPEE_OAUTH_CALLBACK_PATH}`;
  return c.json({ success: true, data: { url: buildAuthorizationUrl(app, redirectUri, state) } });
});

shopeeOAuthRouter.get('/oauth/callback', async (c) => {
  const { code, shop_id: shopIdParam, state, main_account_id: mainAccountId } = c.req.query();

  if (!state || !UUID_RE.test(state)) {return redirectToChannels(c, 'invalid_state');}
  const raw = await c.env.CACHE.get(stateKey(state));
  if (!raw) {return redirectToChannels(c, 'invalid_state');}
  // shortcut: get+delete is not atomic; a racing replay still fails at Shopee because the code is single-use.
  await c.env.CACHE.delete(stateKey(state));
  const saved = JSON.parse(raw) as OAuthState;

  if (mainAccountId) {return redirectToChannels(c, 'main_account_unsupported');}
  const shopId = Number(shopIdParam);
  if (!code || !Number.isInteger(shopId) || shopId <= 0) {return redirectToChannels(c, 'missing_code');}

  let app;
  try {
    app = shopeeAppConfig(c.env);
  } catch {
    return redirectToChannels(c, 'not_configured');
  }
  if (app.env !== saved.env) {return redirectToChannels(c, 'env_mismatch');}

  let tokens;
  try {
    tokens = await getAccessTokenByCode(app, code, shopId);
  } catch (error) {
    const e = error instanceof ShopeeApiError ? error : undefined;
    log.warn('Shopee token exchange failed', { shopId, code: e?.code, requestId: e?.requestId });
    return redirectToChannels(c, 'token_exchange_failed');
  }
  const issuedAt = Math.floor(Date.now() / 1000);

  // Shop info only decorates the row; the code is already spent, so its failure must not drop the tokens.
  let info: ShopeeShopInfo = {};
  try {
    info = await getShopInfo(app, tokens.accessToken, shopId);
  } catch (error) {
    const e = error instanceof ShopeeApiError ? error : undefined;
    log.warn('Shopee get_shop_info failed; saving channel without shop details', { shopId, code: e?.code, requestId: e?.requestId });
  }

  try {
    const encryptedCredentials = await encryptShopeeCredentials(c.env, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpireAt: issuedAt + tokens.expireIn,
    });
    // Same lock as token refresh, so a concurrent refresh cannot overwrite the new authorization's tokens.
    await new DistributedLockService(c.env).withLock(shopeeTokenLockResource(shopId), () =>
      upsertShopeeChannel(createDbClient(c.env.DB), {
        teamId: saved.teamId,
        configuredBy: saved.agentId,
        encryptedCredentials,
        config: {
          shopId,
          env: app.env,
          shopName: info.shopName,
          region: info.region,
          authStatus: 'active',
          authExpireAt: info.authExpireAt,
        },
      }),
    );
  } catch (error) {
    log.error('Saving Shopee channel failed', { shopId }, error instanceof Error ? error : new Error(String(error)));
    return redirectToChannels(c, 'save_failed');
  }

  log.info('Shopee shop authorized', { shopId, teamId: saved.teamId, requestId: tokens.requestId });
  return redirectToChannels(c);
});
