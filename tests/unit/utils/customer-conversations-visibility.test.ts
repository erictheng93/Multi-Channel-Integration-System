import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conversations } from '@/db/schema';

const handle = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => handle.db }));

import { getCustomerConversations } from '@/utils/database';

describe('getCustomerConversations visibility', () => {
  beforeEach(() => {
    const sqlite = new Database(':memory:');
    const { name, columns } = getTableConfig(conversations);
    sqlite.exec(`CREATE TABLE ${name} (${columns.map((c) => `"${c.name}"`).join(', ')})`);
    const ins = sqlite.prepare(`INSERT INTO conversations (id, customer_id, assigned_team_id, status) VALUES (?, 1, ?, 'active')`);
    ins.run('pool', null);
    ins.run('team-3', 3);
    ins.run('team-4', 4);
    handle.db = drizzle(sqlite);
  });

  const ids = async (viewer: { role: 'admin' | 'agent'; allowedTeamIds?: number[] }) =>
    (await getCustomerConversations({} as D1Database, 1, viewer as never)).map((c) => c.id).sort();

  it('agent sees own-team and pool conversations only', async () => {
    expect(await ids({ role: 'agent', allowedTeamIds: [3] })).toEqual(['pool', 'team-3']);
  });

  it('agent without teams sees only the pool', async () => {
    expect(await ids({ role: 'agent', allowedTeamIds: [] })).toEqual(['pool']);
  });

  it('admin sees everything', async () => {
    expect(await ids({ role: 'admin' })).toEqual(['pool', 'team-3', 'team-4']);
  });
});
