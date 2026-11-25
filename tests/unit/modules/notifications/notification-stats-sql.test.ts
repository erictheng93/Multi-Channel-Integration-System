/**
 * Regression guard for the notification stats aggregate.
 *
 * `getStatsByUserId` once selected a column the `notifications` table did not have, so SQLite
 * rejected the whole statement and GET /api/notifications/stats answered 500 for its entire
 * existence. Unit tests that mock the db client cannot catch that: the SQL is only wrong once a
 * real engine parses it against a real table. So this runs the real repository method against
 * the table as src/db/schema.ts declares it.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { NotificationRepository } from '@modules/notifications/repositories/notification-repository';
import { d1Of } from '../../../helpers/sqlite-d1';

/**
 * `notifications` as src/db/schema.ts declares it. Deliberately hand-written: if the query
 * starts relying on a column this table lacks, the test fails - a query must not outrun the schema.
 */
const NOTIFICATIONS_DDL = `
  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data TEXT,
    priority TEXT DEFAULT 'normal',
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  )
`;

type Stats = Record<string, number>;

let db: Database.Database;
let repo: NotificationRepository;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(NOTIFICATIONS_DDL);
  repo = new NotificationRepository(d1Of(db));
});

// created_at in the format datetime('now') writes.
const insert = (id: string, userId: string, type: string, isRead: 0 | 1, priority?: string, expiresAt: string | null = null) =>
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, content, priority, is_read, created_at, expires_at)
     VALUES (?, ?, ?, 't', 'c', COALESCE(?, 'normal'), ?, datetime('now'), ?)`
  ).run(id, userId, type, priority ?? null, isRead, expiresAt);

const stats = async (userId = 'agent-1') => (await repo.getStatsByUserId(userId)) as unknown as Stats;

describe('NotificationRepository.getStatsByUserId against the real schema', () => {
  it('executes for a user with no rows', async () => {
    const s = await stats();
    expect(Number(s.total)).toBe(0);
  });

  it('counts unread and per-type buckets, scoped to the user', async () => {
    insert('n1', 'agent-1', 'new_message', 0);
    insert('n2', 'agent-1', 'new_message', 1);
    insert('n3', 'agent-1', 'conversation_assigned', 0);
    insert('n4', 'agent-1', 'system', 0);
    insert('n5', 'agent-2', 'new_message', 0); // another user's row must not leak in

    const s = await stats();
    expect(s.total).toBe(4);
    expect(s.unread).toBe(3);
    expect(s.messages).toBe(2);
    expect(s.assignments).toBe(1);
    expect(s.system).toBe(1);
    expect(s.today).toBe(4);
  });

  it('counts each priority bucket, so byPriority is not all zeros', async () => {
    insert('p1', 'agent-1', 'new_conversation', 0, 'high');
    insert('p2', 'agent-1', 'new_conversation', 1, 'high');
    insert('p3', 'agent-1', 'task_reminder', 0, 'urgent');
    insert('p4', 'agent-1', 'customer_followed', 0, 'normal');

    const s = await stats();
    expect(s.high_total).toBe(2);
    expect(s.high_unread).toBe(1);
    expect(s.urgent_total).toBe(1);
    expect(s.urgent_unread).toBe(1);
    expect(s.normal_total).toBe(1);
    expect(s.low_total).toBe(0);
  });

  it('counts the two types production actually produces, with their unread split', async () => {
    insert('t1', 'agent-1', 'new_conversation', 0);
    insert('t2', 'agent-1', 'new_conversation', 1);
    insert('t3', 'agent-1', 'customer_followed', 0);

    const s = await stats();
    expect(s.new_conversation).toBe(2);
    expect(s.new_conversation_unread).toBe(1);
    expect(s.customer_followed).toBe(1);
    expect(s.customer_followed_unread).toBe(1);
  });

  it('excludes expired notifications, including ISO expiry earlier today', async () => {
    insert('live', 'agent-1', 'system', 0);
    insert('old', 'agent-1', 'system', 0, undefined, '2000-01-01T00:00:00.000Z');
    // ISO 'T' sorts after ' ', so a plain string compare against datetime('now') kept this visible.
    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    insert('minute-ago', 'agent-1', 'system', 0, undefined, minuteAgo);

    expect((await stats()).total).toBe(1);
  });
});
