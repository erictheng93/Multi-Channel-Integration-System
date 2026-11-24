// saveMessage on a redelivered platform message: real SQLite with the shipped partial unique index
// (migration 0050) and the real Drizzle D1 driver, so the UNIQUE error arrives wrapped in
// DrizzleQueryError exactly as in production.
import { describe, it, expect, beforeEach } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { conversations, messages } from '@/db/schema';
import type { Bindings } from '@/types';
import { saveMessage } from '@modules/integrations/services/webhook-conversation-service';
import { d1Of, readMigration } from '../../../../helpers/sqlite-d1';

function createTable(sqlite: Sqlite.Database, table: SQLiteTable): void {
  const config = getTableConfig(table);
  sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map(column =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
}

const save = (env: Bindings, platformMessageId: string | null, outcome?: { duplicate?: boolean }) =>
  saveMessage(env, 'conv-1', 1, 'Hello', 'text', platformMessageId, 'Ann', null, 'line', outcome);

describe('saveMessage duplicate platform message (migration 0050 index)', () => {
  let sqlite: Sqlite.Database;
  let env: Bindings;

  beforeEach(() => {
    sqlite = new Sqlite(':memory:');
    createTable(sqlite, conversations);
    createTable(sqlite, messages);
    sqlite.exec(readMigration('0050_restore_messages_platform_message_id_unique.sql'));
    sqlite.prepare("INSERT INTO conversations (id, customer_id) VALUES ('conv-1', 1)").run();
    env = { DB: d1Of(sqlite) } as unknown as Bindings;
  });

  it('SQLite names the partial unique index by its column: messages.platform_message_id', () => {
    const insert = sqlite.prepare("INSERT INTO messages (id, conversation_id, platform_message_id) VALUES (?, 'conv-1', 'p-1')");
    insert.run('m-1');
    expect(() => insert.run('m-2')).toThrow('UNIQUE constraint failed: messages.platform_message_id');
  });

  it('returns the first row id and flags the duplicate instead of throwing "Failed to create message"', async () => {
    const first = await save(env, 'line-msg-1');
    const outcome: { duplicate?: boolean } = {};

    const second = await save(env, 'line-msg-1', outcome);

    expect(second).toBe(first);
    expect(outcome.duplicate).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM messages WHERE platform_message_id = 'line-msg-1'").get()).toEqual({ n: 1 });
  });

  it('does not flag a first delivery, and messages without a platform id never collide (partial index)', async () => {
    const outcome: { duplicate?: boolean } = {};
    await save(env, 'line-msg-2', outcome);
    expect(outcome.duplicate).toBeUndefined();

    await save(env, null);
    await save(env, null);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM messages WHERE platform_message_id IS NULL').get()).toEqual({ n: 2 });
  });
});
