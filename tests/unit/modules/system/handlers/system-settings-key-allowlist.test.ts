import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';

const state = vi.hoisted(() => ({
  rows: [] as Array<{ key: string; value: string }>,
  upserts: [] as Array<{ key: string; value: string }>,
  logActivity: vi.fn(),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: () => ({
    select: () => ({ from: async () => state.rows }),
    insert: () => ({
      values: (v: { key: string; value: string }) => {
        state.upserts.push(v);
        return { onConflictDoUpdate: async () => undefined };
      },
    }),
  }),
}));
vi.mock('@modules/activities', () => ({
  ACTIVITY_ACTIONS: { SETTINGS_UPDATE: 'settings_update' },
  RESOURCE_TYPES: { SYSTEM: 'system' },
  ActivityService: class { logActivity = state.logActivity; },
}));

import { getSettings, updateSettings } from '@/modules/system/handlers/system-settings';

function app() {
  const a = new Hono<{ Bindings: Bindings }>();
  a.use('*', async (c: Context, next: Next) => {
    c.set('jwtPayload', { userId: 'adm', username: 'Admin', role: 'admin' });
    c.set('user', { id: 'adm', role: 'admin' });
    return next();
  });
  a.get('/settings', getSettings);
  a.put('/settings', updateSettings);
  return a;
}

const put = (body: unknown) =>
  app().request('/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, { DB: {} } as unknown as Bindings);

describe('system settings key allowlist', () => {
  beforeEach(() => { state.rows = []; state.upserts = []; state.logActivity.mockReset(); });

  it('does not return stored credential-like rows', async () => {
    state.rows = [
      { key: 'general.systemName', value: '"Acme"' },
      { key: 'integrations.line.channelSecret', value: '"LEAKED-SECRET"' },
      { key: 'integrations.line.accessToken', value: '"LEAKED-TOKEN"' },
      { key: 'integrations.facebook.appSecret', value: '"LEAKED-APP"' },
      { key: 'integrations.facebook.pageToken', value: '"LEAKED-PAGE"' },
      { key: 'something.else', value: '"x"' },
    ];
    const res = await app().request('/settings', undefined, { DB: {} } as unknown as Bindings);
    const text = await res.text();
    expect(text).toContain('Acme');
    expect(text).not.toMatch(/LEAKED|channelSecret|accessToken|appSecret|pageToken|something/);
  });

  it.each([
    { integrations: { line: { channelSecret: 'SECRET-1' } } },
    { integrations: { line: { accessToken: 'SECRET-2' } } },
    { integrations: { facebook: { appSecret: 'SECRET-3', pageToken: 'SECRET-4' } } },
    { general: { unknownKey: 'x' } },
  ])('rejects %j and writes nothing', async (body) => {
    const res = await put(body);
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(text).not.toMatch(/SECRET-/);
    expect(state.upserts).toEqual([]);
    expect(state.logActivity).not.toHaveBeenCalled();
  });

  it('still accepts the non-secret settings the UI sends', async () => {
    const res = await put({ integrations: { line: { status: 'connected' } }, advanced: { enableRateLimit: false } });
    expect(res.status).toBe(200);
    expect(state.upserts.map((u) => u.key).sort()).toEqual(['advanced.enableRateLimit', 'integrations.line.status']);
  });
});
