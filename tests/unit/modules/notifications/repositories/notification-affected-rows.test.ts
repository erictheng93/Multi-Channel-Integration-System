import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { NotificationRepository } from '@modules/notifications/repositories/notification-repository';
import { d1Of } from '../../../../helpers/sqlite-d1';

// Real SQL against SQLite through a D1 double that reports meta.changes like D1 does.
function setup() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT, title TEXT, content TEXT, data TEXT,
    priority TEXT, is_read INTEGER DEFAULT 0, read_at TEXT, expires_at TEXT, created_at TEXT, updated_at TEXT)`);
  const add = (id: string, createdDaysAgo: number, expiresInDays: number) =>
    db.prepare(`INSERT INTO notifications (id, user_id, type, title, content, created_at, expires_at)
      VALUES (?, 'u1', 'new_conversation', 't', 'c', datetime('now', ?),
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?))`)
      .run(id, `-${createdDaysAgo} days`, `${expiresInDays} days`);
  const ids = () => (db.prepare('SELECT id FROM notifications ORDER BY id').all() as { id: string }[]).map(r => r.id);
  return { repo: new NotificationRepository(d1Of(db)), add, ids };
}

describe('NotificationRepository affected-row counts (D1 meta.changes)', () => {
  it('markAsRead / markAllAsRead / delete report what they changed', async () => {
    const { repo, add } = setup();
    add('n1', 1, 6);
    add('n2', 1, 6);
    add('n3', 1, 6);

    expect(await repo.markAsRead('n1', 'u1')).toBe(true);       // used to be false -> HTTP 404
    expect(await repo.markAsRead('missing', 'u1')).toBe(false);
    expect(await repo.markAllAsRead('u1')).toBe(2);
    expect(await repo.delete('n3', 'u1')).toBe(true);
    expect(await repo.delete('n3', 'u1')).toBe(false);
  });
});
