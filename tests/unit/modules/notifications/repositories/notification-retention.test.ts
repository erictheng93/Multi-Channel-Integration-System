import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { NotificationRepository } from '@modules/notifications/repositories/notification-repository';
import { d1Of } from '../../../../helpers/sqlite-d1';

// Real SQL against SQLite: created_at in SQLite format, expires_at as ISO (what the writers store).
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

describe('NotificationRepository.deleteExpired (30-day retention)', () => {
  it('deletes only rows that are expired AND older than 30 days', async () => {
    const { repo, add, ids } = setup();
    add('a-old-expired', 40, -33);   // deleted
    add('b-young-expired', 10, -3);  // expired but within retention: kept
    add('c-old-not-expired', 40, 5); // older than 30 days but not expired: kept
    add('d-fresh', 1, 6);            // kept

    expect(await repo.deleteExpired()).toBe(1);
    expect(ids()).toEqual(['b-young-expired', 'c-old-not-expired', 'd-fresh']);
  });

  it('is bounded per call so a backlog drains over several runs', async () => {
    const { repo, add, ids } = setup();
    for (let i = 0; i < 5; i++) add(`old-${i}`, 40, -33);

    expect(await repo.deleteExpired(30, 2)).toBe(2);
    expect(await repo.deleteExpired(30, 2)).toBe(2);
    expect(await repo.deleteExpired(30, 2)).toBe(1);
    expect(await repo.deleteExpired(30, 2)).toBe(0);
    expect(ids()).toEqual([]);
  });
});

describe('expired notifications are hidden on time (ISO expires_at vs SQLite datetime)', () => {
  it('hides a notification that expired a few minutes ago today', async () => {
    const { repo, add } = setup();
    // ISO 'YYYY-MM-DDTHH:MM:SS.SSSZ' vs 'YYYY-MM-DD HH:MM:SS': on the same date 'T' > ' ',
    // so a plain string compare kept this row visible until the next day.
    add('expired-minutes-ago', 1, 0);   // expires_at = now (ISO) ...
    add('still-valid', 1, 6);
    await new Promise(r => setTimeout(r, 1100)); // ... and now it is in the past

    expect(await repo.getUnreadCount('u1')).toBe(1);
    expect((await repo.getRecentNotifications('u1')).map(n => n.id)).toEqual(['still-valid']);
    expect((await repo.findByQuery({ userId: 'u1' })).notifications.map(n => n.id)).toEqual(['still-valid']);
  });
});
