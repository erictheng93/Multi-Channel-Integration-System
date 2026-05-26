import { describe, expect, it, vi } from 'vitest'
import { TeamService } from '@/modules/teams/services/team-service'

describe('team_member_remove via batch', () => {
  it('issues exactly one db.batch with [log, delete] when removed agent was not primary', async () => {
    const captured: unknown[][] = []
    let allCallCount = 0
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(async () => {
        allCallCount += 1
        if (allCallCount === 1) {
          return {
            results: [{
              agent_id: 'agent-7',
              team_id: 3,
              role_in_team: 'member',
              is_primary: 0,
              joined_at: '2026-05-20T10:00:00.000Z'
            }]
          }
        }
        return { results: [] }
      })
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      captured.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const db = { prepare: vi.fn(() => stmt), batch } as unknown as D1Database

    const svc = new TeamService(db)
    const ok = await svc.removeMember(3, 'agent-7', {
      id: 'agent-admin',
      displayName: 'Admin',
      role: 'admin'
    })

    expect(ok).toBe(true)
    expect(captured).toHaveLength(1)
    expect(captured[0]).toHaveLength(2)
  })

  it('appends a third UPDATE when removed agent was primary and another team is promoted', async () => {
    const captured: unknown[][] = []
    let allCallCount = 0
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(async () => {
        allCallCount += 1
        if (allCallCount === 1) {
          return {
            results: [{
              agent_id: 'agent-7',
              team_id: 3,
              role_in_team: 'member',
              is_primary: 1,
              joined_at: '2026-05-20T10:00:00.000Z'
            }]
          }
        }
        return { results: [{ team_id: 8 }] }
      })
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      captured.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const db = { prepare: vi.fn(() => stmt), batch } as unknown as D1Database

    const svc = new TeamService(db)
    const ok = await svc.removeMember(3, 'agent-7', {
      id: 'agent-admin',
      displayName: 'Admin',
      role: 'admin'
    })

    expect(ok).toBe(true)
    expect(captured[0]).toHaveLength(3)
  })

  it('returns false when the membership row is missing', async () => {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ results: [] })
    }
    const batch = vi.fn()
    const db = { prepare: vi.fn(() => stmt), batch } as unknown as D1Database

    const svc = new TeamService(db)
    const ok = await svc.removeMember(3, 'agent-7', {
      id: 'agent-admin',
      displayName: 'Admin',
      role: 'admin'
    })

    expect(ok).toBe(false)
    expect(batch).not.toHaveBeenCalled()
  })
})

describe('team_member_remove capture details', () => {
  it('writes restoreHandler=team_member.remove and a joined_at previousState', async () => {
    const insertParams: unknown[][] = []
    const prepare = vi.fn((sql: string) => {
      const stmt = {
        bind: vi.fn((...params: unknown[]) => {
          if (/INSERT INTO activities/i.test(sql)) {
            insertParams.push(params)
          }
          return stmt
        }),
        first: vi.fn(),
        run: vi.fn(),
        all: vi.fn(async () => ({
          results: [{
            agent_id: 'agent-7',
            team_id: 3,
            role_in_team: 'member',
            is_primary: 0,
            joined_at: '2026-05-20T10:00:00.000Z'
          }]
        }))
      }
      return stmt
    })
    const batch = vi.fn(async (stmts: unknown[]) => {
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const db = { prepare, batch } as unknown as D1Database

    const svc = new TeamService(db)
    const ok = await svc.removeMember(3, 'agent-7', {
      id: 'agent-admin',
      displayName: 'Admin',
      role: 'admin'
    })

    expect(ok).toBe(true)
    const detailsJson = insertParams[0]?.find(
      param => typeof param === 'string' && param.includes('"reversible":true')
    ) as string
    const details = JSON.parse(detailsJson)
    expect(details.restoreHandler).toBe('team_member.remove')
    expect(details.previousState).toMatchObject({
      agent_id: 'agent-7',
      team_id: 3,
      role_in_team: 'member',
      is_primary: 0,
      joined_at: '2026-05-20T10:00:00.000Z'
    })
  })
})
