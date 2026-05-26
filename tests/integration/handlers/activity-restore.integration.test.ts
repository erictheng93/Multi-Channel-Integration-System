import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import activityRestoreHandler from '@/modules/activities/handlers/activity-restore'

function makeApp() {
  const app = new Hono()
  app.route('/api/activities/:id/restore', activityRestoreHandler)
  return app
}

function makeDetails(overrides: Record<string, unknown> = {}) {
  return {
    reversible: true,
    restoreHandler: 'tag.delete',
    previousState: { id: 42, name: 'VIP', deleted_at: null },
    newState: { id: 42, name: 'VIP', deleted_at: '2026-05-26T14:32:00.000Z' },
    restorePolicy: {
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      requiresAdmin: false
    },
    restoredByActivityId: null,
    ...overrides
  }
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    user_id: 'agent-original',
    user_name: 'Original Agent',
    user_role: 'agent',
    action: 'tag_delete',
    resource_type: 'tag',
    resource_id: '42',
    details: JSON.stringify(makeDetails()),
    created_at: new Date().toISOString(),
    ...overrides
  }
}

function makeBindings(options: {
  activityRow?: Record<string, unknown> | null
  currentState?: Record<string, unknown> | null
  casChanges?: number
  rereadSlot?: number | null
  batchReject?: Error
  batchResult?: unknown[]
} = {}) {
  const activityRow = Object.prototype.hasOwnProperty.call(options, 'activityRow')
    ? options.activityRow
    : makeActivity()
  const currentState = Object.prototype.hasOwnProperty.call(options, 'currentState')
    ? options.currentState
    : { id: 42, name: 'VIP', deleted_at: '2026-05-26T14:32:00.000Z' }
  const run = vi.fn().mockResolvedValue({ meta: { changes: options.casChanges ?? 1 } })
  const first = vi
    .fn()
    .mockResolvedValueOnce(activityRow)
    .mockResolvedValueOnce(currentState)

  if ((options.casChanges ?? 1) !== 1) {
    first.mockResolvedValueOnce({
      details: JSON.stringify(makeDetails({ restoredByActivityId: options.rereadSlot ?? -1 }))
    })
  }

  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first,
    run,
    all: vi.fn()
  }
  const prepare = vi.fn(() => stmt)
  const batch = options.batchReject
    ? vi.fn().mockRejectedValue(options.batchReject)
    : vi.fn().mockResolvedValue(options.batchResult ?? [
      { meta: { changes: 1 } },
      { meta: { last_row_id: 1234 } }
    ])

  return {
    bindings: { DB: { prepare, batch } as unknown as D1Database },
    prepare,
    stmt,
    batch,
    run
  }
}

const originalActorHeader = {
  Authorization: 'Bearer fake',
  'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent', name: 'Alice' })
}

describe('POST /api/activities/:id/restore', () => {
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    app = makeApp()
  })

  it('returns 404 when activity id is not found', async () => {
    const { bindings } = makeBindings({ activityRow: null })

    const res = await app.request('/api/activities/9999/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(404)
  })

  it('returns 422 when activity is not reversible', async () => {
    const legacy = makeActivity({ details: JSON.stringify({}) })
    const { bindings } = makeBindings({ activityRow: legacy })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(422)
    await expect(res.json()).resolves.toMatchObject({ code: 'NOT_REVERSIBLE' })
  })

  it('returns 409 when activity was already restored', async () => {
    const activity = makeActivity({
      details: JSON.stringify(makeDetails({ restoredByActivityId: 999 }))
    })
    const { bindings } = makeBindings({ activityRow: activity })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      code: 'ALREADY_RESTORED',
      restoredByActivityId: 999
    })
  })

  it('returns 403 when caller is neither original actor nor admin', async () => {
    const { bindings } = makeBindings()

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-other', role: 'agent', name: 'Bob' })
      }
    }, bindings)

    expect(res.status).toBe(403)
  })

  it('returns 410 when restorePolicy is expired', async () => {
    const activity = makeActivity({
      details: JSON.stringify(makeDetails({
        restorePolicy: {
          expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
          requiresAdmin: false
        }
      }))
    })
    const { bindings } = makeBindings({ activityRow: activity })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(410)
  })

  it('returns 409 conflict when current state differs from recorded newState', async () => {
    const { bindings } = makeBindings({
      currentState: { id: 42, name: 'Renamed', deleted_at: '2026-05-26T14:32:00.000Z' }
    })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('RESTORE_CONFLICT')
    expect(body.data.midChanges).toEqual([
      {
        field: 'name',
        valueAtOriginalAction: 'VIP',
        valueNow: 'Renamed',
        valueAfterRestore: 'VIP'
      }
    ])
  })

  it('returns RESTORE_IN_PROGRESS when CAS slot is held by another request', async () => {
    const { bindings } = makeBindings({ casChanges: 0, rereadSlot: -1 })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      code: 'RESTORE_IN_PROGRESS',
      retryAfterMs: 2000
    })
  })

  it('returns 422 for unsupported resource_type before taking the CAS slot', async () => {
    const activity = makeActivity({ resource_type: 'unknown_resource' })
    const { bindings, run } = makeBindings({ activityRow: activity })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(422)
    await expect(res.json()).resolves.toMatchObject({
      code: 'UNSUPPORTED_RESOURCE_TYPE',
      error: 'Unsupported resourceType: unknown_resource'
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('serializes concurrent restores with the CAS slot', async () => {
    let slot: number | null = null
    let restoreLogId = 1234
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn((...params: unknown[]) => {
          boundParams = params
          return statement
        }),
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM activities')) {
            return makeActivity({
              details: JSON.stringify(makeDetails({ restoredByActivityId: slot }))
            })
          }
          if (sql.includes('SELECT details FROM activities')) {
            return { details: JSON.stringify(makeDetails({ restoredByActivityId: slot })) }
          }
          return { id: 42, name: 'VIP', deleted_at: '2026-05-26T14:32:00.000Z' }
        }),
        run: vi.fn(async () => {
          if (sql.includes("json_set(details, '$.restoredByActivityId', -1)")) {
            if (slot !== null) return { meta: { changes: 0 } }
            slot = -1
            return { meta: { changes: 1 } }
          }
          if (sql.includes("json_set(details, '$.restoredByActivityId', ?)")) {
            slot = typeof boundParams[0] === 'number' ? boundParams[0] : slot
            return { meta: { changes: 1 } }
          }
          return { meta: { changes: 1 } }
        }),
        all: vi.fn()
      }
      let boundParams: unknown[] = []
      return statement
    })
    const batch = vi.fn(async () => {
      const assignedId = restoreLogId++
      await new Promise(resolve => setTimeout(resolve, 25))
      return [
        { meta: { changes: 1 } },
        { meta: { last_row_id: assignedId } }
      ]
    })
    const bindings = { DB: { prepare, batch } as unknown as D1Database }

    const [first, second] = await Promise.all([
      app.request('/api/activities/5/restore', {
        method: 'POST',
        headers: originalActorHeader
      }, bindings),
      app.request('/api/activities/5/restore', {
        method: 'POST',
        headers: originalActorHeader
      }, bindings)
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 409])
    const bodies = await Promise.all([first.json(), second.json()])
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ success: true }),
        expect.objectContaining({ code: 'RESTORE_IN_PROGRESS' })
      ])
    )
    expect(batch).toHaveBeenCalledOnce()
    expect(slot).toBe(1234)
  })

  it('clears the CAS slot when batch dispatch fails', async () => {
    const { bindings, batch, prepare } = makeBindings({
      batchReject: new Error('D1 failure')
    })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ code: 'BATCH_FAILED' })
    expect(batch).toHaveBeenCalledOnce()
    const preparedSql = prepare.mock.calls.map(call => call[0]).join('\n')
    expect(preparedSql).toMatch(/json_set\(details,\s*'\$\.restoredByActivityId',\s*NULL\)/)
  })

  it('restores hard-deleted team membership without requiring current row to exist', async () => {
    const activity = makeActivity({
      action: 'team_member_remove',
      resource_type: 'team_member',
      resource_id: 'agent-7:3',
      details: JSON.stringify(makeDetails({
        restoreHandler: 'team_member.remove',
        previousState: {
          agent_id: 'agent-7',
          team_id: 3,
          role_in_team: 'member',
          is_primary: 0,
          joined_at: '2026-05-20T10:00:00.000Z'
        },
        newState: {
          agent_id: 'agent-7',
          team_id: 3,
          removed_at: '2026-05-26T14:32:00.000Z'
        }
      }))
    })
    const { bindings, batch } = makeBindings({ activityRow: activity, currentState: null })

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, bindings)

    expect(res.status).toBe(200)
    expect(batch).toHaveBeenCalledOnce()
  })

  it('restores the resource, logs restore activity, finalizes slot, and broadcasts', async () => {
    const broadcastFetch = vi.fn().mockResolvedValue(new Response('ok'))
    const broadcasterStub = {
      idFromName: vi.fn().mockReturnValue('do-id'),
      get: vi.fn().mockReturnValue({ fetch: broadcastFetch })
    }
    const { bindings, batch } = makeBindings()

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: originalActorHeader
    }, { ...bindings, MESSAGE_BROADCASTER: broadcasterStub })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.restoredByActivityId).toBe(1234)
    expect(batch).toHaveBeenCalledOnce()
    expect(broadcastFetch).toHaveBeenCalledOnce()
  })
})
