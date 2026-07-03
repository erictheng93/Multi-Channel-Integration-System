import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('broadcast table migrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE agents (
        id TEXT PRIMARY KEY NOT NULL
      );

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('deduplicates broadcast recipients by platform identity after customer hard delete', () => {
    applyMigration('0051_add_broadcast_tables.sql');
    applyMigration('0052_add_broadcast_identity_indexes.sql');

    db.prepare('INSERT INTO agents (id) VALUES (?)').run('agent-1');
    db.prepare(`
      INSERT INTO broadcasts (id, title, content, tag_ids, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('broadcast-1', 'Launch', 'Hello', '[1]', 'agent-1');

    db.prepare(`
      INSERT INTO broadcast_recipients (
        broadcast_id,
        customer_id,
        platform,
        platform_user_id
      )
      VALUES (?, ?, ?, ?)
    `).run('broadcast-1', null, 'line', 'U123');

    expect(() => {
      db.prepare(`
        INSERT INTO broadcast_recipients (
          broadcast_id,
          customer_id,
          platform,
          platform_user_id
        )
        VALUES (?, ?, ?, ?)
      `).run('broadcast-1', null, 'line', 'U123');
    }).toThrow(/UNIQUE constraint failed/);
  });

  it('creates indexes for broadcast send and list query paths', () => {
    applyMigration('0051_add_broadcast_tables.sql');
    applyMigration('0052_add_broadcast_identity_indexes.sql');

    expect(indexNames('broadcast_recipients')).toEqual(expect.arrayContaining([
      'idx_broadcast_recipients_broadcast_platform_user',
      'idx_broadcast_recipients_broadcast_status',
    ]));
    expect(indexNames('broadcasts')).toContain('idx_broadcasts_list');
  });

  function applyMigration(fileName: string): void {
    const sql = readFileSync(join(process.cwd(), 'migrations', fileName), 'utf8');
    db.exec(sql);
  }

  function indexNames(tableName: string): string[] {
    return db
      .prepare(`PRAGMA index_list(${tableName})`)
      .all()
      .map((row) => (row as { name: string }).name);
  }
});
