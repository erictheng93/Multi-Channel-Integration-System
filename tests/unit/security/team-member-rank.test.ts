// Audit run-2 finding #6: every membership mutation applies one shared rank rule
// (non-admin callers act only on strictly lower-ranked members, never assign >= their own rank).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

let currentUser: any
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => { c.set('user', currentUser); await next() }),
  requireTeamRole: () => async (_c: any, next: any) => { await next() },
  requireTeamAccess: () => async (_c: any, next: any) => { await next() },
  requireManagerOrAdmin: () => async (_c: any, next: any) => { await next() }
}))

// Roles of the target agents inside team 1, as the DB would report them
let rolesInTeam1: Record<string, string>
const removeMember = vi.fn(async () => true)
const bulkRemoveMembers = vi.fn(async (_t: number, ids: string[]) => ({ removed: ids, failed: [] }))
const updateMember = vi.fn(async () => ({ id: 'x' }))
vi.mock('@modules/teams/services/team-service', () => ({
  TeamService: class { removeMember = removeMember; bulkRemoveMembers = bulkRemoveMembers; updateMember = updateMember }
}))

const updateAgentTeamRole = vi.fn(async () => ({ roleInTeam: 'member', isPrimary: false }))
const setPrimaryTeam = vi.fn(async () => undefined)
const removeAgentFromTeam = vi.fn(async () => undefined)
vi.mock('@modules/teams/services/agent-teams-service', async () => {
  const actual = await vi.importActual<typeof import('@modules/teams/services/agent-teams-service')>(
    '@modules/teams/services/agent-teams-service'
  )
  class FakeService {
    async getMemberRoles(_teamId: number, ids: string[]) {
      const m = new Map<string, string>()
      for (const id of ids) if (rolesInTeam1[id]) m.set(id, rolesInTeam1[id])
      return m
    }
    async getAgentTeamMembership(id: string) { return rolesInTeam1[id] ? { roleInTeam: rolesInTeam1[id] } : null }
    updateAgentTeamRole = updateAgentTeamRole
    setPrimaryTeam = setPrimaryTeam
    removeAgentFromTeam = removeAgentFromTeam
    async getTeamMembers() { return [] }
  }
  return { ...actual, AgentTeamsService: FakeService }
})

vi.mock('drizzle-orm/d1', () => {
  const chain: any = {}
  for (const m of ['select', 'from', 'where', 'limit']) chain[m] = () => chain
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
  return { drizzle: () => chain }
})
vi.mock('@/modules/activities', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/modules/activities')
  return { ...actual, ActivityService: class { logActivity = vi.fn(async () => undefined) } }
})
vi.mock('@/utils/notification-trigger', () => ({
  triggerAgentRemovedFromTeamNotification: vi.fn(async () => undefined),
  triggerTeamMemberChangeEvent: vi.fn(async () => undefined)
}))

import teamMembers from '@modules/teams/handlers/team-members'
import agentTeams from '@modules/teams/handlers/agent-teams'

const lead = { id: 'lead1', role: 'agent', teamRoles: { 1: 'lead' } } as any
const supervisor = { id: 'sup1', role: 'agent', teamRoles: { 1: 'supervisor' } } as any
const admin = { id: 'admin1', role: 'admin' } as any
const env = { DB: {} } as any

const members = new Hono().route('/', teamMembers)
const agentTeamsApp = new Hono().route('/', agentTeams)
const call = (app: Hono, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }, env)

beforeEach(() => {
  vi.clearAllMocks()
  rolesInTeam1 = { sup1: 'supervisor', lead2: 'lead', member1: 'member', lead1: 'lead' }
})

describe('DELETE /:id/members/:agentId', () => {
  it('lead cannot remove a supervisor', async () => {
    currentUser = lead
    expect((await call(members, 'DELETE', '/1/members/sup1')).status).toBe(403)
    expect(removeMember).not.toHaveBeenCalled()
  })
  it('lead cannot remove another lead', async () => {
    currentUser = lead
    expect((await call(members, 'DELETE', '/1/members/lead2')).status).toBe(403)
    expect(removeMember).not.toHaveBeenCalled()
  })
  it('lead may remove a plain member', async () => {
    currentUser = lead
    expect((await call(members, 'DELETE', '/1/members/member1')).status).toBe(200)
    expect(removeMember).toHaveBeenCalledTimes(1)
  })
  it('supervisor may remove a lead; non-member target is 404', async () => {
    currentUser = supervisor
    expect((await call(members, 'DELETE', '/1/members/lead2')).status).toBe(200)
    expect((await call(members, 'DELETE', '/1/members/ghost')).status).toBe(404)
  })
  it('admin may remove a supervisor', async () => {
    currentUser = admin
    expect((await call(members, 'DELETE', '/1/members/sup1')).status).toBe(200)
    expect(removeMember).toHaveBeenCalledTimes(1)
  })
})

describe('POST /:id/members/bulk-remove', () => {
  it('one higher-ranked target denies the whole request', async () => {
    currentUser = lead
    const res = await call(members, 'POST', '/1/members/bulk-remove', { agentIds: ['member1', 'sup1'] })
    expect(res.status).toBe(403)
    expect(bulkRemoveMembers).not.toHaveBeenCalled()
  })
  it('lead may bulk-remove plain members; admin may remove anyone', async () => {
    currentUser = lead
    expect((await call(members, 'POST', '/1/members/bulk-remove', { agentIds: ['member1'] })).status).toBe(200)
    currentUser = admin
    expect((await call(members, 'POST', '/1/members/bulk-remove', { agentIds: ['sup1', 'lead2'] })).status).toBe(200)
  })
})

describe('DELETE /:agentId/leave/:teamId', () => {
  it('lead cannot remove a supervisor', async () => {
    currentUser = lead
    expect((await call(agentTeamsApp, 'DELETE', '/sup1/leave/1')).status).toBe(403)
    expect(removeAgentFromTeam).not.toHaveBeenCalled()
  })
})

describe('PUT /:agentId/role/:teamId', () => {
  it('lead cannot promote a member to supervisor', async () => {
    currentUser = lead
    expect((await call(agentTeamsApp, 'PUT', '/member1/role/1', { roleInTeam: 'supervisor' })).status).toBe(403)
    expect(updateAgentTeamRole).not.toHaveBeenCalled()
  })
  it('lead cannot promote a member to lead', async () => {
    currentUser = lead
    expect((await call(agentTeamsApp, 'PUT', '/member1/role/1', { roleInTeam: 'lead' })).status).toBe(403)
  })
  it('lead cannot change the primary team of a supervisor', async () => {
    currentUser = lead
    expect((await call(agentTeamsApp, 'PUT', '/sup1/role/1', { isPrimary: true })).status).toBe(403)
    expect(updateAgentTeamRole).not.toHaveBeenCalled()
  })
  it('agent outside the team is rejected before any write (404)', async () => {
    currentUser = lead
    expect((await call(agentTeamsApp, 'PUT', '/ghost/role/1', { isPrimary: true })).status).toBe(404)
    expect(updateAgentTeamRole).not.toHaveBeenCalled()
  })
  it('admin may promote to supervisor', async () => {
    currentUser = admin
    expect((await call(agentTeamsApp, 'PUT', '/member1/role/1', { roleInTeam: 'supervisor' })).status).toBe(200)
    expect(updateAgentTeamRole).toHaveBeenCalledTimes(1)
  })
})

describe('PUT /:agentId/primary/:teamId', () => {
  it('lead cannot change the primary team of a supervisor', async () => {
    currentUser = lead
    expect((await call(agentTeamsApp, 'PUT', '/sup1/primary/1')).status).toBe(403)
    expect(setPrimaryTeam).not.toHaveBeenCalled()
  })
  it('lead may set a member primary team; admin may set anyone', async () => {
    currentUser = lead
    expect((await call(agentTeamsApp, 'PUT', '/member1/primary/1')).status).toBe(200)
    currentUser = admin
    expect((await call(agentTeamsApp, 'PUT', '/sup1/primary/1')).status).toBe(200)
  })
})
