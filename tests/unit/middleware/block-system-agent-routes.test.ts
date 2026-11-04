// blockSystemAgentTarget through the real worker: real mounts, real routers, every member route.
// The guard runs before jwtAuth, so no token is needed: a refusal here can only come from the guard, and the same
// request naming anyone else must fall through to the next layer.

import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ DurableObject: class {}, WorkerEntrypoint: class {}, RpcTarget: class {}, env: {} }));

import worker from '@/index';
import teamsRouter from '@modules/teams/handlers/index';
import { createAgentRouter } from '@modules/agents/handlers/agent-main';
import passwordHandler from '@modules/teams/handlers/password';

const REFUSED = 'The system account cannot be modified';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const executionCtx = { waitUntil: () => undefined, passThroughOnException: () => undefined };

async function call(method: string, path: string, init: { body?: string; type?: string } = {}) {
  const headers: Record<string, string> = init.type ? { 'content-type': init.type } : {};
  const res = await worker.fetch(new Request(`https://api.test${path}`, { method, headers, body: init.body }), {} as never, executionCtx as never);
  const text = await res.text();
  return { status: res.status, refused: res.status === 403 && text.includes(REFUSED) };
}

// Every mutating route that takes a member in its path, read from the real routers so a new route is covered.
const memberRoutes = [
  ...teamsRouter.routes.map(r => ({ method: r.method, path: `/api/teams${r.path}` })),
  ...createAgentRouter().routes.map(r => ({ method: r.method, path: `/api${r.path}` })),
  // Also mounted on /api/auth (src/index.ts), where this is the only guard on /:memberId/reset
  ...passwordHandler.routes.map(r => ({ method: r.method, path: `/api/auth${r.path}` }))
].filter(r => MUTATING.has(r.method) && /:(agentId|memberId)\b/.test(r.path));
const unique = [...new Map(memberRoutes.map(r => [`${r.method} ${r.path}`, r])).values()];

const target = (path: string, id: string) =>
  path.replace(/:(agentId|memberId)\b/g, id).replace(/:[a-zA-Z]+/g, '1');

describe('path targets', () => {
  it('finds the member routes (guards against an empty table)', () => {
    expect(unique.length).toBeGreaterThanOrEqual(15);
  });

  it.each(unique.map(r => [r.method, r.path] as const))('%s %s refuses the system actor, not another member', async (method, path) => {
    expect((await call(method, target(path, 'system'), { body: '{}', type: 'application/json' })).refused).toBe(true);
    expect((await call(method, target(path, 'a1'), { body: '{}', type: 'application/json' })).refused).toBe(false);
  });
});

describe('body targets', () => {
  const routes: Array<[string, string, (id: string) => unknown]> = [
    ['POST', '/api/teams/members/bulk-delete', id => ({ memberIds: [id] })],
    ['POST', '/api/teams/members/bulk-update', id => ({ memberIds: [id], updates: { role: 'admin' } })],
    ['POST', '/api/teams/members/batch-edit', id => ({ members: [{ memberId: id }] })],
    ['POST', '/api/teams/1/members', id => ({ agentId: id })],
    ['POST', '/api/teams/1/members/batch', id => ({ agentIds: [id] })],
    ['POST', '/api/teams/1/members/bulk-remove', id => ({ agentIds: [id] })],
    ['PUT', '/api/agents/batch', id => ({ agentIds: [id], updates: {} })],
    ['PUT', '/api/agents/batch/transfer', id => ({ agentIds: [id], toTeamId: 1 })]
  ];

  describe.each(routes)('%s %s', (method, path, body) => {
    it.each(['application/json', 'text/plain', 'multipart/form-data; boundary=x', ''])('refuses the system actor as %j', async (type) => {
      expect((await call(method, path, { body: JSON.stringify(body('system')), type })).refused).toBe(true);
    });

    it('lets another member through', async () => {
      expect((await call(method, path, { body: JSON.stringify(body('a1')), type: 'application/json' })).refused).toBe(false);
    });
  });

  it('does not refuse a login, whose body is read by the same guard on /api/auth', async () => {
    const body = JSON.stringify({ email: 'a@x.com', password: 'system' });
    expect((await call('POST', '/api/auth/login', { body, type: 'application/json' })).refused).toBe(false);
  });
});
