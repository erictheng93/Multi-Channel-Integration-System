import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const state = vi.hoisted(() => ({
  user: { id: 'u', role: 'agent', primaryTeamId: 1 } as Record<string, unknown>,
  verify: vi.fn(),
  health: vi.fn(),
}));

vi.mock('@modules/integrations/services/channel-service', () => ({
  ChannelService: class {
    getChannel = vi.fn(async () => ({ id: 5, teamId: 1, platform: 'line' }));
    verifyChannel = state.verify;
    checkChannelHealth = state.health;
  },
}));
vi.mock('@modules/activities', async (importOriginal) => ({ ...(await importOriginal<object>()), ActivityService: class {} }));

import channelHandler from '@/modules/integrations/handlers/channel-handler';

function makeCache() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => (store.has(k) ? JSON.parse(store.get(k)!) : null)),
    put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    delete: vi.fn(async (k: string) => { store.delete(k); }),
  };
}

function call(path: string, method: string, cache = makeCache()) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c: Context, next: Next) => { c.set('user', state.user); return next(); });
  app.route('/api/channels', channelHandler);
  return app.request(path, { method }, { CACHE: cache } as unknown as Bindings);
}

describe('channel verify and health', () => {
  beforeEach(() => {
    state.user = { id: 'u', role: 'agent', primaryTeamId: 1 };
    state.verify.mockReset().mockResolvedValue({ success: true, verified: true, message: 'ok' });
    state.health.mockReset().mockResolvedValue({ channelId: 5, platform: 'line', status: 'healthy', lastCheckAt: 'now', consecutiveErrors: 0, lastError: null, recommendations: [] });
  });

  it('verify is admin only', async () => {
    expect((await call('/api/channels/5/verify', 'POST')).status).toBe(403);
    expect(state.verify).not.toHaveBeenCalled();
    state.user = { id: 'a', role: 'admin', primaryTeamId: 1 };
    expect((await call('/api/channels/5/verify', 'POST')).status).toBe(200);
    expect(state.verify).toHaveBeenCalledOnce();
  });

  it('health is served from KV for repeat calls', async () => {
    const cache = makeCache();
    expect((await call('/api/channels/5/health', 'GET', cache)).status).toBe(200);
    expect((await call('/api/channels/5/health', 'GET', cache)).status).toBe(200);
    expect(state.health).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledWith('channel-health:v1:5', expect.any(String), { expirationTtl: 60 });
  });
});
