import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mocks = vi.hoisted(() => ({
  getVisibleConversations: vi.fn(),
  searchMessages: vi.fn()
}))

vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'agent-1', role: 'agent' })
    await next()
  }
}))

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    getVisibleConversations: mocks.getVisibleConversations
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

describe('messaging search routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getVisibleConversations.mockResolvedValue(['conv-visible'])
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
    expect(mocks.getVisibleConversations).toHaveBeenCalledWith('agent-1', db)
    expect(mocks.searchMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'secret',
        limit: 50,
        offset: 0
      }),
      ['conv-visible']
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
      ['conv-visible']
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
    expect(mocks.getVisibleConversations).toHaveBeenCalledWith('agent-1', db)
    expect(captured.sql).toContain('SELECT value FROM json_each(?)')
    expect(captured.params).toEqual([JSON.stringify(['conv-visible'])])
    expect(body.data).toEqual({
      tags: [
        { name: 'urgent', count: 2 },
        { name: 'vip', count: 1 }
      ],
      total: 2
    })
  })

  it('fails closed without querying messages when no conversations are visible', async () => {
    mocks.getVisibleConversations.mockResolvedValue([])
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', searchRoutes)
    const { db, prepare } = createTagStatsDb()

    const response = await app.request(
      'http://localhost/tags',
      undefined,
      { DB: db } as Bindings
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prepare).not.toHaveBeenCalled()
    expect(body.data).toEqual({
      tags: [],
      total: 0
    })
  })
})
