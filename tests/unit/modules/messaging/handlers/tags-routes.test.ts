import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const state = vi.hoisted(() => ({
  jwtPayload: {} as Record<string, unknown>,
  row: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[]
}))

vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: any, next: () => Promise<void>) => {
    c.set('jwtPayload', state.jwtPayload)
    await next()
  }
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: () => ({
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({ get: () => Promise.resolve(state.row) })
        })
      })
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          state.updates.push(values)
          return Promise.resolve()
        }
      })
    })
  })
}))

import tagsRoutes from '@modules/messaging/handlers/messaging/routes/tags'

function request(method: 'PUT' | 'DELETE') {
  const app = new Hono<{ Bindings: Bindings }>()
  app.route('/', tagsRoutes)

  return app.request(
    'http://localhost/msg-1/tags',
    method === 'PUT'
      ? {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: ['injected'] })
        }
      : { method },
    { DB: {} as D1Database } as Bindings
  )
}

describe('messaging tag write routes', () => {
  beforeEach(() => {
    state.jwtPayload = { userId: 7, role: 'agent', allowedTeamIds: [3] }
    state.row = {
      id: 'msg-1',
      conversationId: 'conv-1',
      metadata: JSON.stringify({ tags: ['original'] }),
      conversationAssignedTeamId: 3
    }
    state.updates = []
  })

  it('rejects tagging a message owned by another team, without leaking existence', async () => {
    state.row = { ...state.row, conversationAssignedTeamId: 99 }

    const response = await request('PUT')

    expect(response.status).toBe(404)
    expect(state.updates).toEqual([])
  })

  it('rejects removing tags from a message owned by another team', async () => {
    state.row = { ...state.row, conversationAssignedTeamId: 99 }

    const response = await request('DELETE')

    expect(response.status).toBe(404)
    expect(state.updates).toEqual([])
  })

  it('allows tagging a message assigned to one of the caller team ids', async () => {
    const response = await request('PUT')

    expect(response.status).toBe(200)
    expect(state.updates).toHaveLength(1)
  })

  it('allows tagging an unassigned conversation (shared pool)', async () => {
    state.row = { ...state.row, conversationAssignedTeamId: null }

    const response = await request('PUT')

    expect(response.status).toBe(200)
    expect(state.updates).toHaveLength(1)
  })

  it('allows an admin to tag a message owned by any team', async () => {
    state.jwtPayload = { userId: 1, role: 'admin', allowedTeamIds: [] }
    state.row = { ...state.row, conversationAssignedTeamId: 99 }

    const response = await request('PUT')

    expect(response.status).toBe(200)
    expect(state.updates).toHaveLength(1)
  })
})
