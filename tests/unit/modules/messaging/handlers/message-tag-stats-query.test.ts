import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { MESSAGE_TAG_STATS_SQL } from '@modules/messaging/handlers/messaging/routes/search'

describe('message tag stats query', () => {
  it('aggregates only visible, non-recalled messages and ignores malformed metadata', () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE messages (
        conversation_id TEXT NOT NULL,
        is_recalled INTEGER NOT NULL,
        metadata TEXT
      )
    `)

    const insert = db.prepare(`
      INSERT INTO messages (conversation_id, is_recalled, metadata)
      VALUES (?, ?, ?)
    `)

    insert.run('conv-visible', 0, JSON.stringify({ tags: ['urgent', 'vip'] }))
    insert.run('conv-visible', 0, JSON.stringify({ tags: ['urgent', '__proto__', 'constructor'] }))
    insert.run('conv-visible', 0, JSON.stringify({ tags: ['urgent', 'urgent'] }))
    insert.run('conv-hidden', 0, JSON.stringify({ tags: ['secret-team-tag'] }))
    insert.run('conv-visible', 1, JSON.stringify({ tags: ['recalled-tag'] }))
    insert.run('conv-visible', 0, '{bad json')
    insert.run('conv-visible', 0, JSON.stringify({ tags: 'not-an-array' }))
    insert.run('conv-visible', 0, JSON.stringify({ tags: ['vip', 42, null, {}] }))

    const rows = db
      .prepare(MESSAGE_TAG_STATS_SQL)
      .all(JSON.stringify(['conv-visible']))

    // '__proto__' and 'constructor' fail differently under the old JS object
    // aggregation: '__proto__' is silently dropped, 'constructor' survives with
    // a stringified count. SQL aggregation must report both as ordinary tags.
    expect(rows).toEqual([
      { name: 'urgent', count: 4 },
      { name: 'vip', count: 2 },
      { name: '__proto__', count: 1 },
      { name: 'constructor', count: 1 }
    ])

    db.close()
  })
})
