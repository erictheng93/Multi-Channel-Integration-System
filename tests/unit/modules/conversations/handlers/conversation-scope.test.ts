import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and } from 'drizzle-orm';
import { conversations } from '@/db/schema';
import {
  conversationScopeConditions,
  conversationScopeOrderBy,
} from '@/modules/conversations/handlers/conversation-queries';

// Runs the real scope filter + ORDER BY on SQLite so a regression in either is
// caught, not just a change in the generated SQL text.
function listIds(scope: string): string[] {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT, closed_at TEXT
    );
    INSERT INTO conversations VALUES
      ('open-old',      'active',   '2026-10-01', NULL),
      ('open-new',      'assigned', '2026-10-03', NULL),
      -- closed most recently: its updated_at is the newest of all, which used to
      -- put it at the top of the list
      ('closed-recent', 'closed',   '2026-10-05', '2026-10-05'),
      ('closed-early',  'closed',   '2026-10-04', '2026-10-02');
  `);
  const db = drizzle(sqlite);
  const rows = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(...conversationScopeConditions(scope)))
    .orderBy(...conversationScopeOrderBy(scope))
    .all();
  return rows.map(r => r.id);
}

describe('conversation list scope', () => {
  it('open (處理中) hides closed conversations, newest activity first', () => {
    expect(listIds('open')).toEqual(['open-new', 'open-old']);
  });

  it('closed (已結案) lists only closed conversations, most recently closed first', () => {
    expect(listIds('closed')).toEqual(['closed-recent', 'closed-early']);
  });

  it('all (全部) keeps open conversations above closed ones even when a close was the latest update', () => {
    expect(listIds('all')).toEqual(['open-new', 'open-old', 'closed-recent', 'closed-early']);
  });

  it('no scope keeps the legacy order for older clients', () => {
    expect(listIds('')).toEqual(['closed-recent', 'closed-early', 'open-new', 'open-old']);
  });
});
