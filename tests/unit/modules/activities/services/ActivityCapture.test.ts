import { describe, expect, it, vi } from 'vitest'
import { ActivityCapture, type ReversibleCapture } from '@/modules/activities/services/ActivityCapture'

function makeMockDb() {
  const bound: unknown[] = []
  const stmt = {
    bind: vi.fn((...args: unknown[]) => {
      bound.push(...args)
      return stmt
    }),
    run: vi.fn(),
    all: vi.fn(),
    first: vi.fn(),
    raw: vi.fn()
  }
  const prepare = vi.fn(() => stmt)
  return { db: { prepare, batch: vi.fn() } as unknown as D1Database, prepare, stmt, bound }
}

function findDetails(bound: unknown[], marker: string) {
  const detailsJson = bound.find(v => typeof v === 'string' && v.includes(marker)) as string
  expect(detailsJson).toBeDefined()
  return JSON.parse(detailsJson)
}

describe('ActivityCapture.buildReversibleLog', () => {
  it('serializes the full reversible detail JSON shape', () => {
    const { db, prepare, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    const capt: ReversibleCapture = {
      request: {
        userId: 'agent-1',
        userName: 'Alice',
        userRole: 'admin',
        action: 'tag_delete',
        resourceType: 'tag',
        resourceId: '42'
      },
      restoreHandler: 'tag.delete',
      previousState: { id: 42, name: 'VIP', deletedAt: null },
      newState: { id: 42, deletedAt: '2026-05-26T14:32:00.000Z' }
    }

    capture.buildReversibleLog(capt)

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/INSERT INTO activities/i)
    expect(sql).toMatch(/details/)

    const details = findDetails(bound, '"reversible":true')
    expect(details.reversible).toBe(true)
    expect(details.restoreHandler).toBe('tag.delete')
    expect(details.previousState).toEqual({ id: 42, name: 'VIP', deletedAt: null })
    expect(details.newState).toEqual({ id: 42, deletedAt: '2026-05-26T14:32:00.000Z' })
    expect(details.restorePolicy).toBeDefined()
    expect(details.restorePolicy.requiresAdmin).toBe(false)
    expect(details.restoredByActivityId).toBeNull()

    const expiresAt = new Date(details.restorePolicy.expiresAt).getTime()
    const now = Date.now()
    expect(expiresAt - now).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(expiresAt - now).toBeLessThan(25 * 60 * 60 * 1000)
  })

  it('honors expiresInMs override', () => {
    const { db, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    capture.buildReversibleLog({
      request: {
        userId: 'agent-1',
        userName: 'Alice',
        userRole: 'admin',
        action: 'tag_delete',
        resourceType: 'tag',
        resourceId: '42'
      },
      restoreHandler: 'tag.delete',
      previousState: {},
      newState: {},
      expiresInMs: 60 * 60 * 1000
    })

    const details = findDetails(bound, '"reversible":true')
    const expiresAt = new Date(details.restorePolicy.expiresAt).getTime()
    const now = Date.now()
    expect(expiresAt - now).toBeGreaterThan(50 * 60 * 1000)
    expect(expiresAt - now).toBeLessThan(70 * 60 * 1000)
  })

  it('honors requiresAdmin override', () => {
    const { db, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    capture.buildReversibleLog({
      request: {
        userId: 'agent-1',
        userName: 'Alice',
        userRole: 'admin',
        action: 'settings_update',
        resourceType: 'system',
        resourceId: 'xyz'
      },
      restoreHandler: 'system.settings',
      previousState: {},
      newState: {},
      requiresAdmin: true
    })

    const details = findDetails(bound, '"reversible":true')
    expect(details.restorePolicy.requiresAdmin).toBe(true)
  })
})

describe('ActivityCapture.buildIrreversibleLog', () => {
  it('produces details JSON with reversible:false and irreversibleReason', () => {
    const { db, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    capture.buildIrreversibleLog({
      userId: 'agent-1',
      userName: 'Alice',
      userRole: 'admin',
      action: 'message_send',
      resourceType: 'message',
      resourceId: 'msg-7',
      reason: 'message_sent_to_external_platform'
    })

    const details = findDetails(bound, '"reversible":false')
    expect(details.reversible).toBe(false)
    expect(details.irreversibleReason).toBe('message_sent_to_external_platform')
  })
})

describe('ActivityCapture.logOnly', () => {
  it('runs the prepared statement and returns the inserted row id', async () => {
    const stmt = {
      run: vi.fn().mockResolvedValue({ meta: { last_row_id: 99 } })
    } as unknown as D1PreparedStatement
    const { db } = makeMockDb()
    const capture = new ActivityCapture(db)

    const result = await capture.logOnly(stmt)

    expect(stmt.run).toHaveBeenCalledOnce()
    expect(result).toBe(99)
  })

  it('returns null when D1 does not report a row id', async () => {
    const stmt = {
      run: vi.fn().mockResolvedValue({ meta: {} })
    } as unknown as D1PreparedStatement
    const { db } = makeMockDb()
    const capture = new ActivityCapture(db)

    await expect(capture.logOnly(stmt)).resolves.toBeNull()
  })
})
