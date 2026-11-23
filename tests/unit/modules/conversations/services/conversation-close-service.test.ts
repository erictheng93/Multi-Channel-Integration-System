import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

const broadcastConversationEvent = vi.fn().mockResolvedValue(true)
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class { broadcastConversationEvent = broadcastConversationEvent }
}))

import { REOPEN_UNDO_WINDOW_MS, setConversationsClosed } from '@modules/conversations/services/conversation-close-service'
import type { Bindings } from '@/types'

// Minimal D1 over real SQLite so the `changes() > 0` guard is exercised for real.
function makeEnv() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE conversations (id TEXT PRIMARY KEY, status TEXT, assigned_team_id INTEGER, closed_at TEXT, unread_floor_at TEXT, unread_floor_before_close TEXT, awaiting_since TEXT, updated_at TEXT);
    CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT, sender_type TEXT, message_type TEXT DEFAULT 'text', content TEXT, metadata TEXT, is_recalled INTEGER, is_sent INTEGER, deleted_at TEXT, created_at TEXT);
    CREATE TABLE activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, user_name TEXT, user_role TEXT, action TEXT, resource_type TEXT, resource_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT);
  `)
  const prepare = (sql: string) => {
    let args: unknown[] = []
    const stmt = {
      bind: (...a: unknown[]) => { args = a; return stmt },
      exec: () => sqlite.prepare(sql).run(...args),
      all: async () => ({ results: sqlite.prepare(sql).all(...args) })
    }
    return stmt
  }
  const DB = {
    prepare,
    batch: async (stmts: Array<{ exec: () => { changes: number } }>) =>
      sqlite.transaction(() => stmts.map(s => ({ meta: { changes: s.exec().changes } })))()
  }
  return { sqlite, env: { DB } as unknown as Bindings }
}

const actor = { userId: 'u1', userName: 'Alice', userRole: 'agent' }

describe('setConversationsClosed', () => {
  beforeEach(() => broadcastConversationEvent.mockClear())

  it('closes changed rows, logs them and broadcasts them', async () => {
    const { sqlite, env } = makeEnv()
    sqlite.prepare("INSERT INTO conversations (id, status, assigned_team_id, awaiting_since) VALUES ('a','active',NULL,'2026-01-01T00:00:00.000Z'),('b','assigned',3,NULL)").run()

    const statuses = await setConversationsClosed(env, actor, [
      { id: 'a', status: 'active', assignedTeamId: null },
      { id: 'b', status: 'assigned', assignedTeamId: 3 }
    ], true)

    expect(statuses).toEqual({ a: 'closed', b: 'closed' })
    // closing settles the wait: the marker is cleared (migration 0077 ignores pre-close messages)
    expect(sqlite.prepare("SELECT awaiting_since FROM conversations WHERE id = 'a'").get()).toEqual({ awaiting_since: null })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM activities').get()).toEqual({ n: 2 })
    expect(broadcastConversationEvent).toHaveBeenCalledTimes(2)
  })

  // The reported bug: close + manual reopen left an unanswered customer message shown as answered.
  it('a manual reopen soon after the close undoes it: the unanswered message waits again and the floor is restored', async () => {
    const { sqlite, env } = makeEnv()
    const asked = '2026-11-23T07:40:46.115Z'
    sqlite.prepare("INSERT INTO conversations (id, status, unread_floor_at, awaiting_since) VALUES ('a','active','2026-11-11T05:30:04.137Z',?)").run(asked)
    sqlite.prepare("INSERT INTO messages (conversation_id, sender_type, content, created_at) VALUES ('a','agent','hi','2026-11-10T00:00:00.000Z'),('a','customer','old, settled by the earlier close','2026-11-10T06:00:00.000Z'),('a','customer','question',?)").run(asked)
    const row = () => sqlite.prepare("SELECT status, awaiting_since, unread_floor_at, unread_floor_before_close FROM conversations WHERE id = 'a'").get()

    await setConversationsClosed(env, actor, [{ id: 'a', status: 'active', assignedTeamId: null }], true)
    expect(row()).toMatchObject({ status: 'closed', awaiting_since: null, unread_floor_before_close: '2026-11-11T05:30:04.137Z' })
    expect(broadcastConversationEvent).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ awaitingSince: null, unreadFloorAt: expect.stringMatching(/^20/) }) }))

    const statuses = await setConversationsClosed(env, actor, [{ id: 'a', status: 'closed', assignedTeamId: null }], false)
    expect(statuses).toEqual({ a: 'active' })
    // back to exactly what it was before the close: waiting since the question, not since the older settled message
    expect(row()).toEqual({ status: 'active', awaiting_since: asked, unread_floor_at: '2026-11-11T05:30:04.137Z', unread_floor_before_close: null })
    // clients get the wait and the floor now in place, so the detail view measures the open wait like the list
    expect(broadcastConversationEvent).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'active', awaitingSince: asked, unreadFloorAt: '2026-11-11T05:30:04.137Z' }) }))
  })

  it('a manual reopen after the undo window keeps the close: no months-old wait comes back', async () => {
    const { sqlite, env } = makeEnv()
    const closedAt = new Date(Date.now() - REOPEN_UNDO_WINDOW_MS - 60_000).toISOString()
    // as the nightly auto-close left it: unanswered question, floor at the close, previous floor saved
    sqlite.prepare("INSERT INTO conversations (id, status, closed_at, unread_floor_at, unread_floor_before_close) VALUES ('a','closed',?,?,NULL)").run(closedAt, closedAt)
    sqlite.prepare("INSERT INTO messages (conversation_id, sender_type, content, created_at) VALUES ('a','customer','question','2026-09-01T00:00:00.000Z')").run()

    await setConversationsClosed(env, actor, [{ id: 'a', status: 'closed', assignedTeamId: null }], false)

    expect(sqlite.prepare("SELECT status, awaiting_since, unread_floor_at, unread_floor_before_close FROM conversations WHERE id = 'a'").get())
      .toEqual({ status: 'active', awaiting_since: null, unread_floor_at: closedAt, unread_floor_before_close: null })
    expect(broadcastConversationEvent).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ awaitingSince: null }) }))
  })

  it('a manual reopen of an answered conversation restores no wait', async () => {
    const { sqlite, env } = makeEnv()
    sqlite.prepare("INSERT INTO conversations (id, status) VALUES ('a','active')").run()
    sqlite.prepare("INSERT INTO messages (conversation_id, sender_type, content, created_at) VALUES ('a','customer','question','2026-11-20T00:00:00.000Z'),('a','agent','answer','2026-11-20T01:00:00.000Z')").run()

    await setConversationsClosed(env, actor, [{ id: 'a', status: 'active', assignedTeamId: null }], true)
    await setConversationsClosed(env, actor, [{ id: 'a', status: 'closed', assignedTeamId: null }], false)

    expect(sqlite.prepare("SELECT status, awaiting_since, unread_floor_at FROM conversations WHERE id = 'a'").get())
      .toEqual({ status: 'active', awaiting_since: null, unread_floor_at: null })
  })

  it('skips a target that lost a race: no status, no activity, no broadcast', async () => {
    const { sqlite, env } = makeEnv()
    // Stale snapshot says closed, but the row was already moved to in_progress concurrently.
    sqlite.prepare("INSERT INTO conversations (id, status, assigned_team_id) VALUES ('a','closed',NULL),('b','closed',3)").run()
    sqlite.prepare("UPDATE conversations SET status = 'in_progress' WHERE id = 'a'").run()

    const statuses = await setConversationsClosed(env, actor, [
      { id: 'a', status: 'closed', assignedTeamId: null },
      { id: 'b', status: 'closed', assignedTeamId: 3 }
    ], false)

    expect(statuses).toEqual({ b: 'assigned' })
    expect(sqlite.prepare('SELECT resource_id FROM activities').all()).toEqual([{ resource_id: 'b' }])
    expect(sqlite.prepare("SELECT status FROM conversations WHERE id = 'a'").get()).toEqual({ status: 'in_progress' })
    expect(broadcastConversationEvent).toHaveBeenCalledTimes(1)
  })

  it('does nothing when every target lost the race', async () => {
    const { sqlite, env } = makeEnv()
    sqlite.prepare("INSERT INTO conversations (id, status) VALUES ('a','in_progress')").run()

    const statuses = await setConversationsClosed(env, actor, [{ id: 'a', status: 'closed', assignedTeamId: null }], false)

    expect(statuses).toEqual({})
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM activities').get()).toEqual({ n: 0 })
    expect(broadcastConversationEvent).not.toHaveBeenCalled()
  })
})
