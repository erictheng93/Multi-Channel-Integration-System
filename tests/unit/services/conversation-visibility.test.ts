import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { createDbClient } from '@/db/drizzle-factory'
import { conversations } from '@/db/schema'
import {
  getConversationVisibilityCondition,
  getConversationVisibilitySql,
  type ConversationVisibilityUser
} from '@/services/conversation-visibility'

function createSeededDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      assigned_team_id INTEGER
    )
  `)
  const insert = db.prepare(`
    INSERT INTO conversations (id, assigned_team_id)
    VALUES (?, ?)
  `)
  insert.run('shared', null)
  insert.run('team-7', 7)
  insert.run('team-8', 8)
  return db
}

/**
 * Compiles the Drizzle predicate the same way the conversation list and message
 * search do, so the generated SQL and bound parameters can run against SQLite.
 * The D1 binding is never touched — toSQL() does not execute the query.
 */
function compileVisibilityQuery(user: ConversationVisibilityUser) {
  return createDbClient({} as D1Database)
    .select({ id: conversations.id })
    .from(conversations)
    .where(getConversationVisibilityCondition(user))
    .orderBy(conversations.id)
    .toSQL()
}

describe('conversation visibility SQL', () => {
  it('lets admins query every conversation without bound parameters', () => {
    expect(
      getConversationVisibilitySql(
        { role: 'admin', allowedTeamIds: [] },
        'assigned_team_id'
      )
    ).toEqual({
      clause: '1 = 1',
      params: []
    })
  })

  it('lets agents see their teams and the unassigned shared pool only', () => {
    const db = createSeededDb()

    const visibility = getConversationVisibilitySql(
      { role: 'agent', allowedTeamIds: [7] },
      'assigned_team_id'
    )
    const rows = db
      .prepare(`
        SELECT id
        FROM conversations
        WHERE ${visibility.clause}
        ORDER BY id
      `)
      .all(...visibility.params)

    expect(rows).toEqual([{ id: 'shared' }, { id: 'team-7' }])
    db.close()
  })
})

// The Drizzle variant backs the conversation list and message search, so it
// needs the same executable coverage as the raw-SQL variant above.
describe('conversation visibility Drizzle condition', () => {
  it.each([
    {
      name: 'admin sees every conversation',
      user: { role: 'admin', allowedTeamIds: [] } as ConversationVisibilityUser,
      expected: [{ id: 'shared' }, { id: 'team-7' }, { id: 'team-8' }]
    },
    {
      name: 'agent sees own teams plus the shared pool',
      user: { role: 'agent', allowedTeamIds: [7] } as ConversationVisibilityUser,
      expected: [{ id: 'shared' }, { id: 'team-7' }]
    },
    {
      name: 'agent on multiple teams sees all of them',
      user: { role: 'agent', allowedTeamIds: [7, 8] } as ConversationVisibilityUser,
      expected: [{ id: 'shared' }, { id: 'team-7' }, { id: 'team-8' }]
    },
    {
      name: 'agent with no team sees only the shared pool',
      user: { role: 'agent', allowedTeamIds: [] } as ConversationVisibilityUser,
      expected: [{ id: 'shared' }]
    }
  ])('$name', ({ user, expected }) => {
    const db = createSeededDb()
    const query = compileVisibilityQuery(user)

    expect(db.prepare(query.sql).all(...query.params)).toEqual(expected)
    db.close()
  })
})
