import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mocks = vi.hoisted(() => ({
  authUser: { id: 'agent-1', role: 'agent', allowedTeamIds: [7] },
  searchMessages: vi.fn()
}))

vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.authUser)
    await next()
  }
}))

vi.mock('@modules/messaging/services/message-crud', () => ({
  MessageCrudService: class {
    searchMessages = mocks.searchMessages
  }
}))

import searchRoutes from '@modules/messaging/handlers/messaging/routes/search'

function createTagStatsDb(results: Array<{ name: string; count: number }> = []) {
  const captured = {
    sql: '',
    params: [] as unknown[]
  }
  const statement = {
    bind(...params: unknown[]) {
      captured.params = params
      return statement
    },
    all: vi.fn().mockResolvedValue({
      success: true,
      results
    })
  }
  const prepare = vi.fn((sql: string) => {
    captured.sql = sql
    return statement
  })

  return {
    db: { prepare } as unknown as D1Database,
    prepare,
    captured
  }
}

function createMessageStatsDb(total: number) {
  const captured = {
    sql: '',
    params: [] as unknown[]
  }
  const statement = {
    bind(...params: unknown[]) {
      captured.params = params
      return statement
    },
    first: vi.fn().mockResolvedValue({ total })
  }
  const prepare = vi.fn((sql: string) => {
    captured.sql = sql
    return statement
  })

  return {
    db: { prepare } as unknown as D1Database,
    captured
  }
}

describe('messaging search routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authUser = { id: 'agent-1', role: 'agent', allowedTeamIds: [7] }
    mocks.searchMessages.mockResolvedValue({
      messages: [],
      total: 0,
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false
      }
    })
  })

  it('counts messages only from conversations visible to the authenticated agent', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)
    const { db, captured } = createMessageStatsDb(12)

    const response = await app.request(
      'http://localhost/stats',
      undefined,
      { DB: db } as Bindings
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(captured.sql).toContain('FROM conversations')
    expect(captured.sql).toContain('conversations.assigned_team_id IS NULL')
    expect(captured.params).toEqual([JSON.stringify([7])])
    expect(body.data.overview.totalMessages).toBe(12)
    expect(body.data.scope).toBe('visible_conversations')
  })

  it('keeps message statistics global for administrators', async () => {
    mocks.authUser = { id: 'admin-1', role: 'admin', allowedTeamIds: [] }
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)
    const { db, captured } = createMessageStatsDb(30)

    const response = await app.request(
      'http://localhost/stats',
      undefined,
      { DB: db } as Bindings
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(captured.sql).toContain('AND 1 = 1')
    expect(captured.params).toEqual([])
    expect(body.data.overview.totalMessages).toBe(30)
    expect(body.data.scope).toBe('global')
  })

  it('excludes soft-deleted messages from the statistics count', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)
    const { db, captured } = createMessageStatsDb(0)

    await app.request('http://localhost/stats', undefined, { DB: db } as Bindings)

    // Run the exact statement the handler sent to D1 against real SQLite so a
    // misplaced predicate fails here, not only a substring match.
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        assigned_team_id INTEGER
      );
      CREATE TABLE messages (
        conversation_id TEXT NOT NULL,
        deleted_at TEXT
      )
    `)
    sqlite
      .prepare('INSERT INTO conversations (id, assigned_team_id) VALUES (?, ?)')
      .run('conv-visible', 7)
    sqlite
      .prepare('INSERT INTO conversations (id, assigned_team_id) VALUES (?, ?)')
      .run('conv-hidden', 8)

    const insert = sqlite.prepare(
      'INSERT INTO messages (conversation_id, deleted_at) VALUES (?, ?)'
    )
    insert.run('conv-visible', null)
    insert.run('conv-visible', '2026-07-29T00:00:00.000Z')
    insert.run('conv-hidden', null)

    const row = sqlite.prepare(captured.sql).get(...(captured.params as string[]))

    expect(row).toEqual({ total: 1 })
    sqlite.close()
  })

  it('scopes message searches to conversations visible to the authenticated user', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)
    const db = {} as D1Database

    const response = await app.request(
      'http://localhost/search?q=secret',
      undefined,
      { DB: db } as Bindings
    )

    expect(response.status).toBe(200)
    expect(mocks.searchMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'secret',
        limit: 50,
        offset: 0
      }),
      expect.objectContaining({
        id: 'agent-1',
        role: 'agent',
        allowedTeamIds: [7]
      })
    )
  })

  it('keeps an explicit conversation filter inside the authenticated visibility scope', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)

    const response = await app.request(
      'http://localhost/search?conversationId=conv-hidden',
      undefined,
      { DB: {} as D1Database } as Bindings
    )

    expect(response.status).toBe(200)
    expect(mocks.searchMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-hidden'
      }),
      expect.objectContaining({
        role: 'agent',
        allowedTeamIds: [7]
      })
    )
  })

  it('aggregates tags only from conversations visible to the authenticated user', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)
    const { db, captured } = createTagStatsDb([
      { name: 'urgent', count: 2 },
      { name: 'vip', count: 1 }
    ])

    const response = await app.request(
      'http://localhost/tags',
      undefined,
      { DB: db } as Bindings
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(captured.sql).toContain('FROM conversations')
    expect(captured.sql).toContain('conversations.assigned_team_id IS NULL')
    expect(captured.params).toEqual([JSON.stringify([7])])
    expect(body.data).toEqual({
      tags: [
        { name: 'urgent', count: 2 },
        { name: 'vip', count: 1 }
      ],
      total: 2
    })
  })

  it('queries with an empty team scope so only shared-pool conversations remain visible', async () => {
    mocks.authUser = { id: 'agent-2', role: 'agent', allowedTeamIds: [] }
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)
    const { db, prepare, captured } = createTagStatsDb()

    const response = await app.request(
      'http://localhost/tags',
      undefined,
      { DB: db } as Bindings
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prepare).toHaveBeenCalledOnce()
    expect(captured.params).toEqual([JSON.stringify([])])
    expect(body.data).toEqual({
      tags: [],
      total: 0
    })
  })
})
