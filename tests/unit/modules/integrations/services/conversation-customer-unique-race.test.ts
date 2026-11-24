// One conversation per customer (migration 0079): an insert that loses the race to a concurrent
// creator returns the existing conversation instead of failing. Real SQLite with the shipped
// migration, real Drizzle (D1 driver), so the UNIQUE error arrives wrapped exactly as in production.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { conversations } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings } from '@/types';
import { d1Of, readMigration } from '../../../../helpers/sqlite-d1';

vi.mock('@/services/distributed-lock-service', () => ({
  DistributedLockService: vi.fn(function () {
    return { withLock: async (_resource: string, fn: () => Promise<unknown>) => fn() };
  }),
}));

import { findOrCreateConversation } from '@modules/integrations/services/webhook-conversation-service';
import { insertCustomerConversation } from '@/services/customer-conversation-lookup';

function createDb(): Sqlite.Database {
  const sqlite = new Sqlite(':memory:');
  const config = getTableConfig(conversations);
  sqlite.exec(`CREATE TABLE conversations (${config.columns.map(column =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
  // Databases built by replaying migrations still have 0005's plain index; 0079 drops it.
  sqlite.exec('CREATE INDEX idx_conversations_customer ON conversations(customer_id)');
  sqlite.exec(readMigration('0079_unique_conversation_per_customer.sql'));
  return sqlite;
}

const insertRow = (sqlite: Sqlite.Database, id: string, customerId: number, team: number | null = null): void => {
  sqlite.prepare("INSERT INTO conversations (id, customer_id, assigned_team_id, status, created_at, updated_at) VALUES (?, ?, ?, 'active', '2026-11-24T00:00:00.000Z', '2026-11-24T00:00:00.000Z')")
    .run(id, customerId, team);
};

/**
 * D1 whose first INSERT INTO conversations is preceded by a competitor's insert for the same
 * customer: every lookup before it saw no conversation, then the competitor wins the write.
 */
function racingD1(sqlite: Sqlite.Database, competitor: { id: string; customerId: number; team?: number | null }): D1Database {
  const base = d1Of(sqlite);
  let raced = false;
  return {
    ...base,
    prepare: (query: string) => {
      if (!raced && /^insert into "conversations"/i.test(query)) {
        raced = true;
        insertRow(sqlite, competitor.id, competitor.customerId, competitor.team ?? null);
      }
      return base.prepare(query);
    },
  } as D1Database;
}

const rows = (sqlite: Sqlite.Database) =>
  sqlite.prepare('SELECT id, customer_id AS customerId, assigned_team_id AS teamId FROM conversations ORDER BY id').all();

describe('migration 0079', () => {
  it('creates the unique index and drops the redundant single-column one', () => {
    const sqlite = createDb();
    const indexes = sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'conversations'").all() as Array<{ name: string; sql: string | null }>;
    const names = indexes.map(index => index.name);
    expect(names).toContain('idx_conversations_customer_unique');
    expect(names).not.toContain('idx_conversations_customer');
    expect(indexes.find(index => index.name === 'idx_conversations_customer_unique')?.sql).toMatch(/CREATE UNIQUE INDEX/i);
  });

  it('is idempotent (IF NOT EXISTS / IF EXISTS)', () => {
    const sqlite = createDb();
    expect(() => sqlite.exec(readMigration('0079_unique_conversation_per_customer.sql'))).not.toThrow();
  });
});

describe('findOrCreateConversation on a lost create race', () => {
  let sqlite: Sqlite.Database;

  beforeEach(() => {
    sqlite = createDb();
  });

  it('returns the conversation the concurrent request created instead of failing', async () => {
    const env = { DB: racingD1(sqlite, { id: 'winner', customerId: 1 }) } as unknown as Bindings;

    const conversation = await findOrCreateConversation(env, 1, 'line');

    expect(conversation?.id).toBe('winner');
    expect(rows(sqlite)).toEqual([{ id: 'winner', customerId: 1, teamId: null }]);
  });

  it('backfills the team on the winner, as for any conversation found inside the lock', async () => {
    const env = { DB: racingD1(sqlite, { id: 'winner', customerId: 1 }) } as unknown as Bindings;

    const conversation = await findOrCreateConversation(env, 1, 'facebook', { assignedTeamId: 5 });

    expect(conversation).toMatchObject({ id: 'winner', assignedTeamId: 5 });
    expect(rows(sqlite)).toEqual([{ id: 'winner', customerId: 1, teamId: 5 }]);
  });

  it('still creates a conversation when there is no race', async () => {
    const env = { DB: d1Of(sqlite) } as unknown as Bindings;

    const conversation = await findOrCreateConversation(env, 2, 'line', { assignedTeamId: 3 });

    expect(conversation).toMatchObject({ customerId: 2, assignedTeamId: 3, status: 'active' });
    expect(rows(sqlite)).toEqual([{ id: conversation?.id, customerId: 2, teamId: 3 }]);
  });
});

describe('insertCustomerConversation', () => {
  it('returns null when it inserted, the existing row on a customer_id violation', async () => {
    const sqlite = createDb();
    const db = createDbClient(d1Of(sqlite));

    await expect(insertCustomerConversation(db, { id: 'first', customerId: 1 })).resolves.toBeNull();
    await expect(insertCustomerConversation(db, { id: 'second', customerId: 1 })).resolves.toMatchObject({ id: 'first', customerId: 1 });
    expect(rows(sqlite)).toEqual([{ id: 'first', customerId: 1, teamId: null }]);
  });

  it('rethrows any other failure, such as a primary-key collision', async () => {
    const sqlite = createDb();
    const db = createDbClient(d1Of(sqlite));
    insertRow(sqlite, 'taken', 1);

    await expect(insertCustomerConversation(db, { id: 'taken', customerId: 2 })).rejects.toThrow();
    expect(rows(sqlite)).toEqual([{ id: 'taken', customerId: 1, teamId: null }]);
  });
});
