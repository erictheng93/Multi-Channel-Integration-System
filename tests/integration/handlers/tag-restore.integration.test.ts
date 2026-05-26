import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { tagHandler } from '@/modules/tags/services/tag-service'

function makeApp() {
  const app = new Hono()
  app.use('/api/tags/:id', async (c, next) => {
    c.set('user', { id: 'agent-1', displayName: 'Alice', role: 'admin' })
    return next()
  })
  app.delete('/api/tags/:id', async c => tagHandler.delete(c))
  app.put('/api/tags/:id', async c => tagHandler.update(c))
  return app
}

describe('tag delete via batch', () => {
  it('writes the reversible log and the UPDATE in a single db.batch', async () => {
    const existingTag = {
      id: 42,
      name: 'VIP',
      color: '#FF9500',
      description: null,
      team_id: null,
      is_active: 1,
      created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const batched: unknown[][] = []
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(existingTag),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      all: vi.fn()
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      batched.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const env = {
      DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database
    }

    const res = await makeApp().request('/api/tags/42', { method: 'DELETE' }, env)

    expect(res.status).toBe(200)
    expect(batch).toHaveBeenCalledOnce()
    expect(batched[0]).toHaveLength(2)
  })

  it('returns 404 when the tag is already soft-deleted', async () => {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: 42,
        name: 'VIP',
        deleted_at: '2026-05-25T00:00:00.000Z'
      }),
      run: vi.fn(),
      all: vi.fn()
    }
    const batch = vi.fn()
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }

    const res = await makeApp().request('/api/tags/42', { method: 'DELETE' }, env)

    expect(res.status).toBe(404)
    expect(batch).not.toHaveBeenCalled()
  })

  it('does not run mutation outside batch when batch fails', async () => {
    const existingTag = {
      id: 42,
      name: 'VIP',
      is_active: 1,
      deleted_at: null,
      updated_at: '2026-05-20T00:00:00.000Z'
    }
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(existingTag),
      run: vi.fn(),
      all: vi.fn()
    }
    const batch = vi.fn().mockRejectedValue(new Error('D1 constraint violation'))
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }

    const res = await makeApp().request('/api/tags/42', { method: 'DELETE' }, env)

    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(stmt.run).not.toHaveBeenCalled()
  })
})

describe('tag update via batch', () => {
  it('captures only the fields that actually change', async () => {
    const existingTag = {
      id: 42,
      name: 'VIP',
      color: '#FF9500',
      description: 'Original',
      team_id: null,
      is_active: 1,
      created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const updatedTag = {
      ...existingTag,
      name: 'Premium',
      updated_at: '2026-05-26T14:00:00.000Z',
      customer_count: 0,
      conversation_count: 0
    }
    const batched: unknown[][] = []
    let firstCallCount = 0
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => {
        firstCallCount += 1
        if (firstCallCount === 1) return existingTag
        return updatedTag
      }),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ results: [] })
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      batched.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }

    const res = await makeApp().request('/api/tags/42', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Premium' })
    }, env)

    expect(res.status).toBe(200)
    expect(batch).toHaveBeenCalledOnce()
    expect(batched[0]).toHaveLength(2)
  })

  it('skips the batch when no fields would change', async () => {
    const existingTag = {
      id: 42,
      name: 'VIP',
      color: '#FF9500',
      description: null,
      team_id: null,
      is_active: 1,
      created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(existingTag),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ results: [] })
    }
    const batch = vi.fn()
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }

    const res = await makeApp().request('/api/tags/42', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'VIP' })
    }, env)

    expect(res.status).toBe(200)
    expect(batch).not.toHaveBeenCalled()
  })
})

describe('tag delete capture details', () => {
  it('writes restoreHandler=tag.delete with fields needed to reactivate the tag', async () => {
    const existingTag = {
      id: 42,
      name: 'VIP',
      color: '#FF9500',
      description: null,
      team_id: null,
      is_active: 1,
      created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const statements: Array<{ sql: string; params: unknown[] }> = []
    const prepare = vi.fn((sql: string) => {
      const entry = { sql, params: [] as unknown[] }
      statements.push(entry)
      const stmt = {
        bind: vi.fn((...params: unknown[]) => {
          entry.params = params
          return stmt
        }),
        first: vi.fn().mockResolvedValue(existingTag),
        run: vi.fn(),
        all: vi.fn()
      }
      return stmt
    })
    const batch = vi.fn(async (stmts: unknown[]) => {
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 7777 } }))
    })
    const env = { DB: { prepare, batch } as unknown as D1Database }

    const res = await makeApp().request('/api/tags/42', { method: 'DELETE' }, env)

    expect(res.status).toBe(200)
    const insertActivity = statements.find(entry => /INSERT INTO activities/i.test(entry.sql))
    expect(insertActivity).toBeDefined()
    const detailsJson = insertActivity?.params.find(
      param => typeof param === 'string' && param.includes('"reversible":true')
    ) as string
    const details = JSON.parse(detailsJson)
    expect(details.restoreHandler).toBe('tag.delete')
    expect(details.previousState).toMatchObject({
      id: 42,
      is_active: 1,
      deleted_at: null,
      updated_at: '2026-05-20T14:32:11.000Z'
    })
    expect(details.newState.deleted_at).toEqual(expect.any(String))
  })
})
