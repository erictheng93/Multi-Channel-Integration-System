import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agents, conversations, customers, customerTags, tags } from '@/db/schema';
import type { Bindings } from '@/types';

const state = vi.hoisted(() => ({ db: null as unknown, user: {} as Record<string, unknown> }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => state.db }));

import { tagHandler } from '@/modules/tags/services/tag-service';

type StatsBody = {
  data: { usageTrend: Array<{ date: string; assignments: number }>; topAssigners: Array<{ name?: string; displayName?: string; assignments: number }> };
};

async function stats(user: Record<string, unknown>) {
  state.user = user;
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c: Context, next: Next) => { c.set('user', state.user); return next(); });
  app.get('/tags/:id/stats', (c) => tagHandler.getUsageStats(c));
  const res = await app.request('/tags/1/stats', undefined, { DB: {} } as unknown as Bindings);
  expect(res.status).toBe(200);
  return (await res.json()) as StatsBody;
}

describe('GET /tags/:id/stats scoping', () => {
  beforeEach(() => {
    const sqlite = new Database(':memory:');
    for (const t of [tags, customers, customerTags, conversations, agents]) {
      const { name, columns } = getTableConfig(t);
      sqlite.exec(`CREATE TABLE ${name} (${columns.map((c) => `"${c.name}" ${c.getSQLType()}`).join(', ')})`);
    }
    sqlite.exec(`
      INSERT INTO tags (id, name, color) VALUES (1, 'vip', '#000');
      INSERT INTO agents (id, display_name) VALUES ('a-other', 'Other Team Agent'), ('a-mine', 'My Team Agent');
      INSERT INTO customers (id, platform, platform_user_id, source_team_id) VALUES (1, 'line', 'u1', 3), (2, 'line', 'u2', 4);
      INSERT INTO customer_tags (customer_id, tag_id, assigned_by, assigned_at) VALUES
        (1, 1, 'a-mine',  datetime('now', '-1 days')),
        (2, 1, 'a-other', datetime('now', '-1 days')),
        (2, 1, 'a-other', datetime('now', '-2 days'));
    `);
    const real = drizzle(sqlite);
    // The D1 driver's get() returns the row object; better-sqlite3's returns a value array
    state.db = { get: (q: never) => real.all(q)[0] ?? null, all: (q: never) => real.all(q) };
  });

  it('an agent only sees trend and assigners for customers in their teams', async () => {
    const body = await stats({ id: 'a-mine', role: 'agent', allowedTeamIds: [3] });
    expect(body.data.usageTrend.reduce((n, r) => n + r.assignments, 0)).toBe(1);
    expect(JSON.stringify(body.data.topAssigners)).toContain('My Team Agent');
    expect(JSON.stringify(body.data.topAssigners)).not.toContain('Other Team Agent');
  });

  it('an admin sees everything', async () => {
    const body = await stats({ id: 'adm', role: 'admin', allowedTeamIds: [] });
    expect(body.data.usageTrend.reduce((n, r) => n + r.assignments, 0)).toBe(3);
    expect(JSON.stringify(body.data.topAssigners)).toContain('Other Team Agent');
  });
});
