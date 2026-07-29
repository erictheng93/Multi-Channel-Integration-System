import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { buildMessageTagStatsQuery } from '@modules/messaging/handlers/messaging/routes/search'

describe('message tag stats query', () => {
  it('aggregates only visible, active, non-recalled messages and ignores malformed metadata', () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        assigned_team_id INTEGER
      );
      CREATE TABLE messages (
        conversation_id TEXT NOT NULL,
        is_recalled INTEGER NOT NULL,
        deleted_at TEXT,
        metadata TEXT
      )
    `)

    db.prepare('INSERT INTO conversations (id, assigned_team_id) VALUES (?, ?)').run(
      'conv-visible',
      7
    )
    db.prepare('INSERT INTO conversations (id, assigned_team_id) VALUES (?, ?)').run(
      'conv-hidden',
      8
    )

    const insert = db.prepare(`
      INSERT INTO messages (conversation_id, is_recalled, deleted_at, metadata)
      VALUES (?, ?, ?, ?)
    `)

    insert.run('conv-visible', 0, null, JSON.stringify({ tags: ['urgent', 'vip'] }))
    insert.run(
      'conv-visible',
      0,
      null,
      JSON.stringify({ tags: ['urgent', '__proto__', 'constructor'] })
    )
    insert.run('conv-visible', 0, null, JSON.stringify({ tags: ['urgent', 'urgent'] }))
    insert.run('conv-hidden', 0, null, JSON.stringify({ tags: ['secret-team-tag'] }))
    insert.run('conv-visible', 1, null, JSON.stringify({ tags: ['recalled-tag'] }))
    insert.run(
      'conv-visible',
      0,
      '2026-07-29T00:00:00.000Z',
      JSON.stringify({ tags: ['deleted-tag'] })
    )
    insert.run('conv-visible', 0, null, '{bad json')
    insert.run('conv-visible', 0, null, JSON.stringify({ tags: 'not-an-array' }))
    insert.run('conv-visible', 0, null, JSON.stringify({ tags: ['vip', 42, null, {}] }))

    const agentQuery = buildMessageTagStatsQuery({ role: 'agent', allowedTeamIds: [7] })
    const rows = db.prepare(agentQuery.sql).all(...(agentQuery.params as string[]))

    // '__proto__' and 'constructor' fail differently under the old JS object
    // aggregation: '__proto__' is silently dropped, 'constructor' survives with
    // a stringified count. SQL aggregation must report both as ordinary tags.
    expect(rows).toEqual([
      { name: 'urgent', count: 4 },
      { name: 'vip', count: 2 },
      { name: '__proto__', count: 1 },
      { name: 'constructor', count: 1 }
    ])

    // Admins bind no parameters at all, so the statement must stay executable
    // with an empty argument list.
    const adminQuery = buildMessageTagStatsQuery({ role: 'admin', allowedTeamIds: [] })
    expect(adminQuery.params).toEqual([])
    expect(db.prepare(adminQuery.sql).all()).toEqual([
      { name: 'urgent', count: 4 },
      { name: 'vip', count: 2 },
      { name: '__proto__', count: 1 },
      { name: 'constructor', count: 1 },
      { name: 'secret-team-tag', count: 1 }
    ])

    db.close()
  })
})
