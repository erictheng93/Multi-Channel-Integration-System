import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type { Database as AppDatabase } from '@/db/drizzle-factory';
import { stampFirstResponse } from '@/modules/conversations/services/first-response';

function setup() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE conversations (id TEXT PRIMARY KEY, first_response_at TEXT);
    INSERT INTO conversations (id, first_response_at) VALUES ('c1', NULL), ('c2', NULL);
  `);
  const db = drizzle(sqlite) as unknown as AppDatabase;
  const read = (id: string) =>
    (sqlite.prepare('SELECT first_response_at AS v FROM conversations WHERE id = ?').get(id) as { v: string | null }).v;
  return { db, read, sqlite };
}

describe('stampFirstResponse', () => {
  it('stamps an unanswered conversation and touches no other row', async () => {
    const { db, read } = setup();

    await stampFirstResponse(db, 'c1', '2026-10-29T01:00:00.000Z');

    expect(read('c1')).toBe('2026-10-29T01:00:00.000Z');
    expect(read('c2')).toBeNull();
  });

  it('is idempotent: the first reply wins, later replies and retries change nothing', async () => {
    const { db, read } = setup();

    await stampFirstResponse(db, 'c1', '2026-10-29T01:00:00.000Z');
    await stampFirstResponse(db, 'c1', '2026-10-29T05:00:00.000Z');
    await stampFirstResponse(db, 'c1', '2026-10-29T01:00:00.000Z');

    expect(read('c1')).toBe('2026-10-29T01:00:00.000Z');
  });

  it('never throws, so a metric failure cannot fail a send', async () => {
    const broken = {
      update: vi.fn(() => { throw new Error('d1 unavailable'); }),
    } as unknown as AppDatabase;

    await expect(stampFirstResponse(broken, 'c1', '2026-10-29T01:00:00.000Z')).resolves.toBeUndefined();
  });
});
