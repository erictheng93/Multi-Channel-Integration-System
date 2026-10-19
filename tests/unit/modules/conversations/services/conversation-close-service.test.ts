import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

const broadcastConversationEvent = vi.fn().mockResolvedValue(true)
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class { broadcastConversationEvent = broadcastConversationEvent }
}))

import { setConversationsClosed } from '@modules/conversations/services/conversation-close-service'
import type { Bindings } from '@/types'

// Minimal D1 over real SQLite so the `changes() > 0` guard is exercised for real.
function makeEnv() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE conversations (id TEXT PRIMARY KEY, status TEXT, assigned_team_id INTEGER, closed_at TEXT, unread_floor_at TEXT, updated_at TEXT);
    CREATE TABLE activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, user_name TEXT, user_role TEXT, action TEXT, resource_type TEXT, resource_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT);
  `)
  const prepare = (sql: string) => {
    let args: unknown[] = []
    const stmt = {
      bind: (...a: unknown[]) => { args = a; return stmt },
      exec: () => sqlite.prepare(sql).run(...args)
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
    sqlite.prepare("INSERT INTO conversations (id, status, assigned_team_id) VALUES ('a','active',NULL),('b','assigned',3)").run()

    const statuses = await setConversationsClosed(env, actor, [
      { id: 'a', status: 'active', assignedTeamId: null },
      { id: 'b', status: 'assigned', assignedTeamId: 3 }
    ], true)

    expect(statuses).toEqual({ a: 'closed', b: 'closed' })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM activities').get()).toEqual({ n: 2 })
    expect(broadcastConversationEvent).toHaveBeenCalledTimes(2)
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
