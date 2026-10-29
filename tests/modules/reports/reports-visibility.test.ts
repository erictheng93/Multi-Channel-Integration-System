/**
 * Reports visibility: non-admins see only their own and their teams' reports, a report they cannot see is a
 * 404 (not a 403, so its existence does not leak), and soft-deleted reports are gone everywhere.
 *
 * Runs the real handler, services and Drizzle queries against in-memory SQLite.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentTeams, agents, reportDownloadHistory, reports } from '@/db/schema';
import type { Bindings } from '@/types';

const state = vi.hoisted(() => ({
  db: null as unknown,
  payload: { userId: 'agent-1', role: 'agent', allowedTeamIds: [3] } as Record<string, unknown>,
}));

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => state.db }));
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('jwtPayload', state.payload);
    c.set('user', state.payload);
    return next();
  }),
  validateAccessToken: vi.fn(),
}));
vi.mock('@modules/reports/middleware/index', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const pass = async (_c: Context, next: Next) => next();
  return {
    ...actual,
    checkReportsViewPermission: pass,
    checkReportsDownloadPermission: pass,
    checkReportsDeletePermission: pass,
    validateRateLimit: pass,
    logReportsOperation: pass,
  };
});

import reportsHandler from '@/modules/reports/handlers/reports-main';

function createTable(sqlite: Database.Database, table: Parameters<typeof getTableConfig>[0]) {
  const { name, columns } = getTableConfig(table);
  sqlite.exec(`CREATE TABLE ${name} (${columns.map((col) => `"${col.name}"`).join(', ')})`);
}

// Report ids must be UUIDs to pass route validation; names are used in the tests.
const NAMES = ['own', 'same-team', 'other-team', 'other-private', 'own-deleted', 'same-team-deleted'];
const uuid = (name: string) => `00000000-0000-4000-8000-${String(NAMES.indexOf(name) + 1).padStart(12, '0')}`;
const nameOf = (id: string) => NAMES.find((n) => uuid(n) === id) ?? id;

// name, created_by, team_id, deleted_at
const SEED: Array<[string, string, number | null, string | null]> = [
  ['own', 'agent-1', null, null],
  ['same-team', 'agent-2', 3, null],
  ['other-team', 'agent-2', 4, null],
  ['other-private', 'agent-2', null, null],
  ['own-deleted', 'agent-1', null, '2026-10-01T00:00:00Z'],
  ['same-team-deleted', 'agent-2', 3, '2026-10-01T00:00:00Z'],
];

function call(path: string, init?: RequestInit) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/reports', reportsHandler);
  const env = { DB: {}, R2_BUCKET: { get: vi.fn(async () => null), delete: vi.fn() } } as unknown as Bindings;
  return app.request(path, init, env);
}

const listIds = async () => {
  const res = await call('/api/reports');
  const body = (await res.json()) as { data: { reports: Array<{ id: string }>; summary: { totalReports: number } } };
  expect(res.status).toBe(200);
  return { ids: body.data.reports.map((r) => nameOf(r.id)).sort(), total: body.data.summary.totalReports };
};

describe('reports visibility', () => {
  beforeEach(() => {
    const sqlite = new Database(':memory:');
    for (const table of [reports, agents, agentTeams, reportDownloadHistory]) {
      createTable(sqlite, table);
    }
    const insert = sqlite.prepare(
      `INSERT INTO reports (id, title, type, format, status, created_by, team_id, deleted_at, created_at)
       VALUES (?, ?, 'custom', 'json', 'completed', ?, ?, ?, '2026-10-01T00:00:00Z')`
    );
    for (const [id, createdBy, teamId, deletedAt] of SEED) {
      insert.run(uuid(id), `Report ${id}`, createdBy, teamId, deletedAt);
    }
    sqlite.exec(`
      INSERT INTO agents (id, role) VALUES ('agent-1', 'agent'), ('agent-2', 'agent'), ('admin-1', 'admin');
      INSERT INTO agent_teams (agent_id, team_id) VALUES ('agent-1', 3);
    `);
    state.db = drizzle(sqlite);
    state.payload = { userId: 'agent-1', role: 'agent', allowedTeamIds: [3] };
  });

  describe('list', () => {
    it('agent sees own and own-team reports only, never soft-deleted or other-team ones', async () => {
      const { ids, total } = await listIds();
      expect(ids).toEqual(['own', 'same-team']);
      expect(total).toBe(2);
    });

    it('agent without teams sees only own reports', async () => {
      state.payload = { userId: 'agent-1', role: 'agent', allowedTeamIds: [] };
      expect((await listIds()).ids).toEqual(['own']);
    });

    it('admin sees every report except soft-deleted ones', async () => {
      state.payload = { userId: 'admin-1', role: 'admin', allowedTeamIds: [] };
      const { ids, total } = await listIds();
      expect(ids).toEqual(['other-private', 'other-team', 'own', 'same-team']);
      expect(total).toBe(4);
    });
  });

  describe('details', () => {
    const details = (id: string) => call(`/api/reports/${uuid(id)}`);

    it.each(['own', 'same-team'])('agent can open %s', async (id) => {
      expect((await details(id)).status).toBe(200);
    });

    it.each(['other-team', 'other-private', 'own-deleted', 'same-team-deleted'])('agent gets 404 for %s', async (id) => {
      expect((await details(id)).status).toBe(404);
    });

    it('admin can open any live report but not a soft-deleted one', async () => {
      state.payload = { userId: 'admin-1', role: 'admin', allowedTeamIds: [] };
      expect((await details('other-team')).status).toBe(200);
      expect((await details('other-private')).status).toBe(200);
      expect((await details('own-deleted')).status).toBe(404);
    });
  });

  describe('soft-deleted reports cannot be downloaded or deleted', () => {
    it('download returns 404', async () => {
      state.payload = { userId: 'admin-1', role: 'admin', allowedTeamIds: [] };
      expect((await call(`/api/reports/${uuid('own-deleted')}/download`)).status).toBe(404);
    });

    it('delete returns 404', async () => {
      state.payload = { userId: 'admin-1', role: 'admin', allowedTeamIds: [] };
      expect((await call(`/api/reports/${uuid('own-deleted')}`, { method: 'DELETE' })).status).toBe(404);
    });
  });
});

describe('reports stats', () => {
  it('is admin only (it aggregates every team)', async () => {
    state.payload = { userId: 'agent-1', role: 'agent', allowedTeamIds: [3] };
    expect((await call('/api/reports/stats')).status).toBe(403);
  });
});
