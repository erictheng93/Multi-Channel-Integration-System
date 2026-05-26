import { describe, expect, it, vi } from 'vitest'
import {
  addTagToCustomer,
  removeTagFromCustomer,
  restoreAssignedAgent,
  restoreField,
  restoreFields,
  restoreSoftDeleted,
  softDelete
} from '@/modules/activities/services/restore-helpers'

function makeDb() {
  const bound: unknown[] = []
  const stmt = {
    bind: vi.fn((...args: unknown[]) => {
      bound.push(...args)
      return stmt
    }),
    run: vi.fn(),
    all: vi.fn(),
    first: vi.fn()
  }
  const prepare = vi.fn(() => stmt)
  return { db: { prepare } as unknown as D1Database, prepare, stmt, bound }
}

describe('restoreSoftDeleted', () => {
  it('buildMutation emits UPDATE ... SET deleted_at = NULL', () => {
    const { db, prepare, bound } = makeDb()
    const handler = restoreSoftDeleted('tags')

    handler.buildMutation(db, { id: 42 })

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/UPDATE\s+tags\s+SET\s+deleted_at\s*=\s*NULL/i)
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/i)
    expect(bound).toContain(42)
  })

  it('getCurrentState SELECTs all columns by id and returns the row', async () => {
    const { db, prepare, stmt } = makeDb()
    stmt.first = vi.fn().mockResolvedValue({ id: 42, name: 'VIP', deleted_at: '2026-05-26T14:32:00.000Z' })
    const handler = restoreSoftDeleted('tags')

    const result = await handler.getCurrentState(db, '42')

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/SELECT\s+\*\s+FROM\s+tags/i)
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/i)
    expect(result).toEqual({ id: 42, name: 'VIP', deleted_at: '2026-05-26T14:32:00.000Z' })
  })

  it('getCurrentState returns null when first() returns null', async () => {
    const { db, stmt } = makeDb()
    stmt.first = vi.fn().mockResolvedValue(null)
    const handler = restoreSoftDeleted('tags')

    await expect(handler.getCurrentState(db, '42')).resolves.toBeNull()
  })
})

describe('softDelete', () => {
  it('buildMutation emits UPDATE ... SET deleted_at = current timestamp', () => {
    const { db, prepare, bound } = makeDb()
    const handler = softDelete('tags')

    handler.buildMutation(db, { id: 42 })

    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/UPDATE\s+tags\s+SET\s+deleted_at\s*=\s*\?/i)
    expect(bound).toContain(42)
    expect(typeof bound[0]).toBe('string')
    expect(() => new Date(bound[0] as string).toISOString()).not.toThrow()
  })
})

describe('restoreFields', () => {
  it('buildMutation restores every previousState field except id', () => {
    const { db, prepare, bound } = makeDb()
    const handler = restoreFields('tags')

    handler.buildMutation(db, { id: 42, name: 'VIP', color: '#FF9500' })

    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/UPDATE\s+tags\s+SET\s+name\s*=\s*\?,\s*color\s*=\s*\?/i)
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/i)
    expect(bound).toEqual(['VIP', '#FF9500', 42])
  })
})

describe('restoreField', () => {
  it('restores one named field from previousState', () => {
    const { db, prepare, bound } = makeDb()
    const handler = restoreField('conversations', 'status')

    handler.buildMutation(db, { id: 'conv-1', status: 'active', priority: 'high' })

    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/UPDATE\s+conversations\s+SET\s+status\s*=\s*\?/i)
    expect(bound).toEqual(['active', 'conv-1'])
  })
})

describe('relationship helpers', () => {
  it('removeTagFromCustomer deletes the junction row', () => {
    const { db, prepare, bound } = makeDb()

    removeTagFromCustomer.buildMutation(db, { customerId: 7, tagId: 42 })

    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/DELETE\s+FROM\s+customer_tags/i)
    expect(sql).toMatch(/customer_id\s*=\s*\?\s+AND\s+tag_id\s*=\s*\?/i)
    expect(bound).toEqual([7, 42])
  })

  it('addTagToCustomer inserts the previous junction row', () => {
    const { db, prepare, bound } = makeDb()

    addTagToCustomer.buildMutation(db, { customerId: 7, tagId: 42, assignedBy: 'agent-1' })

    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/INSERT\s+OR\s+IGNORE\s+INTO\s+customer_tags/i)
    expect(bound).toEqual([7, 42, 'agent-1'])
  })

  it('restoreAssignedAgent restores assigned_team_id', () => {
    const { db, prepare, bound } = makeDb()

    restoreAssignedAgent.buildMutation(db, { id: 'conv-1', assignedTeamId: 3 })

    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/UPDATE\s+conversations\s+SET\s+assigned_team_id\s*=\s*\?/i)
    expect(bound).toEqual([3, 'conv-1'])
  })
})
