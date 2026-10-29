/**
 * "Today" / "this week" notification counts are Asia/Taipei calendar ranges,
 * not a rolling 24 h / 7 d window and not UTC midnight.
 *
 * Runs the real repository method (real SQL, real drizzle D1 session) against
 * sqlite through a D1-shaped adapter.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { NotificationRepository } from '@/modules/notifications/repositories/notification-repository';

// Thu 2026-10-29 18:00 Taipei == 10:00 UTC
const NOW = Date.parse('2026-10-29T10:00:00.000Z');

function d1Of(db: Database.Database): D1Database {
  const statement = (query: string, params: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(query, next),
    all: async () => ({ results: db.prepare(query).all(...params), success: true, meta: {} }),
    run: async () => { db.prepare(query).run(...params); return { success: true, meta: {} }; },
    first: async () => db.prepare(query).get(...params) ?? null,
    raw: async () => db.prepare(query).raw().all(...params),
  });
  return { prepare: (query: string) => statement(query) } as unknown as D1Database;
}

function setup() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
      data TEXT, priority TEXT DEFAULT 'normal', is_read INTEGER DEFAULT 0, read_at TEXT, expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT
    );
  `);
  let n = 0;
  // created_at uses the format datetime('now') writes: UTC 'YYYY-MM-DD HH:MM:SS'
  const add = (createdAt: string, userId = 'u1') =>
    db.prepare("INSERT INTO notifications (id, user_id, type, title, content, created_at) VALUES (?, ?, 'system', 't', 'c', ?)")
      .run(`n${++n}`, userId, createdAt);
  return { db, add, repo: new NotificationRepository(d1Of(db)) };
}

type Stats = { today: number; this_week: number; this_month: number; total: number };

describe('NotificationRepository.getStatsByUserId time ranges (Asia/Taipei)', () => {
  it('counts "today" from Taipei midnight, not from 24 h ago or UTC midnight', async () => {
    const { add, repo } = setup();
    add('2026-10-28 16:00:00'); // exactly Taipei midnight today -> today
    add('2026-10-29 09:59:00'); // earlier today
    add('2026-10-28 15:59:59'); // Taipei 23:59:59 yesterday -> NOT today
    add('2026-10-28 12:00:00'); // within the last 24 h but yesterday in Taipei -> NOT today
    add('2026-10-29 00:30:00', 'someone-else'); // other user -> ignored

    const stats = await repo.getStatsByUserId('u1', NOW) as unknown as Stats;

    expect(Number(stats.today)).toBe(2);
    expect(Number(stats.total)).toBe(4);
  });

  it('counts "this week" from Monday 00:00 Taipei', async () => {
    const { add, repo } = setup();
    add('2026-10-25 16:00:00'); // Monday 10-26 00:00 Taipei -> in week
    add('2026-10-27 03:00:00'); // in week
    add('2026-10-25 15:59:59'); // Sunday 10-25 23:59:59 Taipei -> previous week
    add('2026-10-20 03:00:00'); // previous week

    const stats = await repo.getStatsByUserId('u1', NOW) as unknown as Stats;

    expect(Number(stats.this_week)).toBe(2);
    expect(Number(stats.this_month)).toBe(4);
  });

  it('week boundary on a Sunday evening still belongs to the week that started the previous Monday', async () => {
    const { add, repo } = setup();
    const sundayEvening = Date.parse('2026-10-25T14:00:00.000Z'); // Sun 10-25 22:00 Taipei
    add('2026-10-18 16:00:00'); // Mon 10-19 00:00 Taipei -> in that week
    add('2026-10-18 15:59:59'); // Sun 10-18 23:59:59 Taipei -> previous week

    const stats = await repo.getStatsByUserId('u1', sundayEvening) as unknown as Stats;

    expect(Number(stats.this_week)).toBe(1);
  });

  it('is zero for a user with no notifications', async () => {
    const { repo } = setup();
    const stats = await repo.getStatsByUserId('u1', NOW) as unknown as Stats;
    expect(Number(stats.total)).toBe(0);
    expect(Number(stats.today ?? 0)).toBe(0);
  });
});
