import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { NotificationRepository } from '@modules/notifications/repositories/notification-repository';
import { d1Of } from '../../../../helpers/sqlite-d1';

function setup() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT, title TEXT, content TEXT, data TEXT,
    priority TEXT, is_read INTEGER DEFAULT 0, read_at TEXT, expires_at TEXT, created_at TEXT, updated_at TEXT)`);
  const add = (id: string, type: string) =>
    db.prepare(`INSERT INTO notifications (id, user_id, type, title, content, created_at)
      VALUES (?, 'u1', ?, 't', 'c', datetime('now'))`).run(id, type);
  return { repo: new NotificationRepository(d1Of(db)), add };
}

describe('NotificationRepository.getUnreadCount informational types', () => {
  it('excludes customer_followed and new_conversation from the badge count', async () => {
    const { repo, add } = setup();
    add('1', 'customer_followed');
    add('2', 'new_conversation');
    add('3', 'new_message');
    add('4', 'mention');

    expect(await repo.getUnreadCount('u1')).toBe(2);
  });

  it('still counts an informational type when it is asked for explicitly', async () => {
    const { repo, add } = setup();
    add('1', 'new_conversation');
    add('2', 'new_message');

    expect(await repo.getUnreadCount('u1', 'new_conversation')).toBe(1);
  });
});
