import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { RestoreRegistry } from '@/modules/activities/services/restore-registry'

const drizzleMock = {
  select: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([])
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([
        {
          id: 42,
          name: 'VIP',
          color: '#FF9500',
          description: null,
          teamId: null,
          isActive: true,
          createdBy: 'agent-1',
          createdAt: '2026-05-26T00:00:00.000Z',
          updatedAt: '2026-05-26T00:00:00.000Z'
        }
      ])
    }))
  }))
}

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => drizzleMock)
}))

import { tagHandler } from '@/modules/tags/services/tag-service'

function makeApp() {
  const app = new Hono()
  app.use('/api/tags', async (c, next) => {
    c.set('jwtPayload', {
      userId: 'agent-1',
      username: 'Alice',
      role: 'admin'
    })
    return next()
  })
  app.post('/api/tags', async c => tagHandler.create(c))
  return app
}

describe('tag create reversible capture', () => {
  it('awaits a reversible tag.create activity after creating the tag', async () => {
    const statements: Array<{ sql: string; params: unknown[]; run: ReturnType<typeof vi.fn> }> = []
    const prepare = vi.fn((sql: string) => {
      const entry = {
        sql,
        params: [] as unknown[],
        run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1001 } })
      }
      const stmt = {
        bind: vi.fn((...params: unknown[]) => {
          entry.params = params
          return stmt
        }),
        run: entry.run
      }
      statements.push(entry)
      return stmt
    })
    const env = { DB: { prepare } as unknown as D1Database }

    const res = await makeApp().request('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'VIP', color: '#ff9500' })
    }, env)

    expect(res.status).toBe(201)

    const insertActivity = statements.find(entry => /INSERT INTO activities/i.test(entry.sql))
    expect(insertActivity).toBeDefined()
    expect(insertActivity?.run).toHaveBeenCalledTimes(1)

    const detailsJson = insertActivity?.params.find(
      param => typeof param === 'string' && param.includes('"restoreHandler":"tag.create"')
    ) as string
    const details = JSON.parse(detailsJson)
    expect(details.previousState).toMatchObject({
      id: 42,
      deleted_at: null
    })
    expect(details.newState).toMatchObject({
      id: 42,
      name: 'VIP',
      deleted_at: null
    })

    const restoreDb = { prepare } as unknown as D1Database
    expect(() => {
      RestoreRegistry['tag.create'].buildMutation(restoreDb, details.previousState)
    }).not.toThrow()
  })
})
