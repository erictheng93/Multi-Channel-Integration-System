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

      CREATE TABLE file_attachments (
        id TEXT PRIMARY KEY NOT NULL
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

  it('enforces broadcast attachment position uniqueness, cascade and restrict', () => {
    applyMigration('0051_add_broadcast_tables.sql');
    applyMigration('0052_add_broadcast_identity_indexes.sql');
    applyMigration('0063_add_broadcast_attachments.sql');

    db.prepare('INSERT INTO agents (id) VALUES (?)').run('agent-1');
    db.prepare(`
      INSERT INTO broadcasts (id, title, content, tag_ids, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('broadcast-1', 'Launch', '', '[1]', 'agent-1');
    for (const id of ['img-1', 'prev-1', 'img-2', 'prev-2']) {
      db.prepare('INSERT INTO file_attachments (id) VALUES (?)').run(id);
    }

    const insert = db.prepare(`
      INSERT INTO broadcast_attachments (broadcast_id, attachment_id, preview_attachment_id, position)
      VALUES (?, ?, ?, ?)
    `);
    insert.run('broadcast-1', 'img-1', 'prev-1', 0);

    expect(() => insert.run('broadcast-1', 'img-2', 'prev-2', 0)).toThrow(/UNIQUE constraint failed/);
    expect(() => insert.run('broadcast-1', 'img-1', 'prev-2', 1)).toThrow(/UNIQUE constraint failed/);
    expect(() => db.prepare('DELETE FROM file_attachments WHERE id = ?').run('img-1'))
      .toThrow(/FOREIGN KEY constraint failed/);

    db.prepare('DELETE FROM broadcasts WHERE id = ?').run('broadcast-1');
    const remaining = db.prepare('SELECT COUNT(*) AS n FROM broadcast_attachments').get() as { n: number };
    expect(remaining.n).toBe(0);
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
