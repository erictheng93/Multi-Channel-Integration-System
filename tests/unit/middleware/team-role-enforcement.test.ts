// requireTeamRole / requireTeamPermission / requireTeamAccess / requireRole, run through a real Hono app.
// Other suites stub these middlewares out, so nothing else exercises the 401/400/403 branches.
import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@/types';

vi.mock('cloudflare:workers', () => ({ DurableObject: class {}, WorkerEntrypoint: class {}, RpcTarget: class {}, env: {} }));

import { requireRole, requireTeamAccess, requireTeamPermission, requireTeamRole } from '@/middleware/auth';

type TestUser = {
  id: string;
  role: 'admin' | 'agent';
  primaryTeamId?: number;
  allowedTeamIds?: number[];
  teamRoles?: Record<number, 'member' | 'lead' | 'supervisor'>;
};

function appWith(user: TestUser | undefined, guard: ReturnType<typeof requireTeamRole>, param = 'id') {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user as never);
    await next();
  });
  app.get(`/teams/:${param}`, guard, c => c.json({ ok: true }));
  return app;
}

const agent = (teamRoles: TestUser['teamRoles']): TestUser => ({ id: 'a1', role: 'agent', teamRoles });
const get = (app: Hono<{ Bindings: Bindings }>, teamId: string) => app.request(`/teams/${teamId}`, {}, {} as Bindings);

describe('requireTeamRole', () => {
  it('rejects an unauthenticated request with 401', async () => {
    expect((await get(appWith(undefined, requireTeamRole('member')), '1')).status).toBe(401);
  });

  it('lets an admin through without any team membership', async () => {
    const app = appWith({ id: 'root', role: 'admin' }, requireTeamRole('supervisor'));
    expect((await get(app, '7')).status).toBe(200);
  });

  it('rejects a non-numeric team id with 400', async () => {
    expect((await get(appWith(agent({ 1: 'supervisor' }), requireTeamRole('member')), 'abc')).status).toBe(400);
  });

  it('enforces the member < lead < supervisor hierarchy', async () => {
    const memberApp = appWith(agent({ 1: 'member' }), requireTeamRole('lead'));
    const leadApp = appWith(agent({ 1: 'lead' }), requireTeamRole('lead'));
    const supervisorApp = appWith(agent({ 1: 'supervisor' }), requireTeamRole('lead'));
    expect((await get(memberApp, '1')).status).toBe(403);
    expect((await get(leadApp, '1')).status).toBe(200);
    expect((await get(supervisorApp, '1')).status).toBe(200);
    expect((await get(appWith(agent({ 1: 'lead' }), requireTeamRole('supervisor')), '1')).status).toBe(403);
  });

  it('does not carry a role in one team over to another team', async () => {
    const res = await get(appWith(agent({ 1: 'supervisor' }), requireTeamRole('member')), '2');
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ details: { teamId: 2, requiredRole: 'member', currentRole: 'none' } });
  });

  it('reads the team id from the configured route parameter', async () => {
    const app = appWith(agent({ 5: 'lead' }), requireTeamRole('lead', 'teamId'), 'teamId');
    expect((await get(app, '5')).status).toBe(200);
    expect((await get(app, '6')).status).toBe(403);
  });
});

describe('requireTeamPermission', () => {
  it('maps an operation onto its minimum role from the permission matrix', async () => {
    // ADD_MEMBER needs lead, UPDATE_TEAM needs supervisor.
    const lead = agent({ 1: 'lead' });
    expect((await get(appWith(lead, requireTeamPermission('ADD_MEMBER')), '1')).status).toBe(200);
    expect((await get(appWith(lead, requireTeamPermission('UPDATE_TEAM')), '1')).status).toBe(403);
  });
});

describe('requireTeamAccess', () => {
  it('rejects a non-numeric team id for a non-admin with 400', async () => {
    const app = appWith({ id: 'a1', role: 'agent', primaryTeamId: 1 }, requireTeamAccess('id'));
    expect((await get(app, 'abc')).status).toBe(400);
  });

  it('lets an admin reach any team', async () => {
    const app = appWith({ id: 'root', role: 'admin' }, requireTeamAccess('id'));
    expect((await get(app, '99')).status).toBe(200);
  });
});

describe('requireRole', () => {
  const run = async (user: TestUser | undefined, required: 'admin' | 'agent') => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.use('*', async (c, next) => {
      if (user) c.set('user', user as never);
      await next();
    });
    app.get('/x', requireRole(required as never), c => c.json({ ok: true }));
    return (await app.request('/x', {}, {} as Bindings)).status;
  };

  it('401 without a user, 403 for the wrong role, 200 for admin and the exact role', async () => {
    expect(await run(undefined, 'admin')).toBe(401);
    expect(await run({ id: 'a1', role: 'agent' }, 'admin')).toBe(403);
    expect(await run({ id: 'root', role: 'admin' }, 'agent')).toBe(200);
    expect(await run({ id: 'a1', role: 'agent' }, 'agent')).toBe(200);
  });
});
