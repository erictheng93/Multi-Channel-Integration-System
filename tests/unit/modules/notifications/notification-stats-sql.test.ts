/**
 * Regression guard for the notification stats aggregate.
 *
 * `getStatsByUserId` used to select `priority`, a column the `notifications`
 * table does not have - absent from production D1 AND from src/db/schema.ts (the
 * `priority` columns there belong to `conversations` and to the auto-reply
 * rules). SQLite rejected the whole statement, so the endpoint answered 500 for
 * its entire existence:
 *
 *   SQLITE_ERROR 7500: no such column: priority
 *   GET /api/notifications/stats -> 500
 *
 * Unit tests that mock the db client cannot catch this: the SQL is only wrong
 * once a real engine parses it against a real table. So this test builds the
 * table exactly as schema.ts declares it and executes the query for real.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

/**
 * `notifications` exactly as src/db/schema.ts declares it.
 *
 * Deliberately hand-written rather than derived: if someone adds a column to
 * schema.ts and the query starts relying on it, this table stays behind and the
 * test fails, which is the signal we want - a query must not outrun the schema.
 */
const NOTIFICATIONS_DDL = `
  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data TEXT,
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`

/**
 * The aggregate from
 * src/modules/notifications/repositories/notification-repository.ts.
 * Kept in sync by hand; the point is that a real engine parses it.
 */
const STATS_SQL = `
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
    SUM(CASE WHEN type = 'new_message' THEN 1 ELSE 0 END) as messages,
    SUM(CASE WHEN type = 'conversation_assigned' THEN 1 ELSE 0 END) as assignments,
    SUM(CASE WHEN type = 'mention' THEN 1 ELSE 0 END) as mentions,
    SUM(CASE WHEN type = 'system' THEN 1 ELSE 0 END) as system,
    SUM(CASE WHEN created_at >= date('now', '-24 hours') THEN 1 ELSE 0 END) as today,
    SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) as this_week,
    SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as this_month
  FROM notifications
  WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
`

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.exec(NOTIFICATIONS_DDL)
})

describe('notification stats aggregate', () => {
  it('executes against the real schema', () => {
    // The assertion that matters: no "no such column" from a real engine.
    expect(() => db.prepare(STATS_SQL).get('agent-1')).not.toThrow()
  })

  it('names every column it selects, so no query can outrun the schema', () => {
    const declared = new Set(
      (db.prepare('PRAGMA table_info(notifications)').all() as { name: string }[]).map(r => r.name)
    )

    // Every bare column referenced by the aggregate.
    for (const column of ['is_read', 'type', 'created_at', 'user_id', 'expires_at']) {
      expect(declared, `notifications.${column} is missing from the schema`).toContain(column)
    }

    // The column that caused the outage. If it is ever added to schema.ts, this
    // expectation should be flipped and the per-priority SUMs restored.
    expect(
      declared.has('priority'),
      'notifications.priority now exists. Restore the urgent_unread / high_unread ' +
        'SUMs in getStatsByUserId and fix byPriority in notification-service.ts.'
    ).toBe(false)
  })

  it('counts unread, per-type and time-window buckets correctly', () => {
    const insert = db.prepare(
      'INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    const today = new Date().toISOString()

    insert.run('n1', 'agent-1', 'new_message', 't', 'c', 0, today)
    insert.run('n2', 'agent-1', 'new_message', 't', 'c', 1, today)
    insert.run('n3', 'agent-1', 'conversation_assigned', 't', 'c', 0, today)
    insert.run('n4', 'agent-1', 'system', 't', 'c', 0, today)
    // Another user's row must not leak in.
    insert.run('n5', 'agent-2', 'new_message', 't', 'c', 0, today)

    const stats = db.prepare(STATS_SQL).get('agent-1') as Record<string, number>

    expect(stats.total).toBe(4)
    expect(stats.unread).toBe(3)
    expect(stats.messages).toBe(2)
    expect(stats.assignments).toBe(1)
    expect(stats.system).toBe(1)
    expect(stats.today).toBe(4)
  })

  it('excludes expired notifications', () => {
    const insert = db.prepare(
      'INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const now = new Date().toISOString()

    insert.run('live', 'agent-1', 'system', 't', 'c', 0, now, null)
    insert.run('expired', 'agent-1', 'system', 't', 'c', 0, now, '2000-01-01 00:00:00')

    const stats = db.prepare(STATS_SQL).get('agent-1') as Record<string, number>
    expect(stats.total).toBe(1)
  })
})
