import { readFileSync } from 'node:fs';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { drizzle, type RemoteCallback } from 'drizzle-orm/sqlite-proxy';
import * as schema from '@/db/schema';
import type { Database } from '@/db/drizzle-factory';

// Async Drizzle queries over real SQLite. Broadcast FKs use the shipped migrations.
export function createBroadcastFixture() {
  const sqlite = new Sqlite(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec('CREATE TABLE agents (id TEXT PRIMARY KEY); CREATE TABLE customers (id INTEGER PRIMARY KEY)');
  for (const table of [schema.fileAttachments, schema.conversations, schema.messages]) {
    const config = getTableConfig(table);
    sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map((column) =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`
    ).join(', ')})`);
  }
  for (const migration of ['0051_add_broadcast_tables.sql', '0052_add_broadcast_identity_indexes.sql', '0063_add_broadcast_attachments.sql']) {
    sqlite.exec(readFileSync(`migrations/${migration}`, 'utf8'));
  }
  sqlite.prepare('INSERT INTO agents (id) VALUES (?)').run('agent-1');
  const execute: RemoteCallback = async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    if (method === 'run') { statement.run(...params); return { rows: [] }; }
    const rows = statement.raw().all(...params);
    return { rows: method === 'get' ? rows[0] as unknown[] : rows };
  };
  const remote = drizzle(execute, async (queries) => {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const query of queries) {results.push(await execute(query.sql, query.params, query.method));}
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {sqlite.exec('ROLLBACK'); throw error;}
  }, { schema });
  return { sqlite, db: remote as unknown as Database };
}
