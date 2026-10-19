import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

let currentUser: any
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => { c.set('user', currentUser); await next() }),
  requireTeamRole: () => async (_c: any, next: any) => { await next() },
  requireTeamAccess: () => async (_c: any, next: any) => { await next() },
  requireManagerOrAdmin: () => async (_c: any, next: any) => { await next() }
}))
const updateMember = vi.fn(async () => ({ id: 'x' }))
vi.mock('@modules/teams/services/team-service', () => ({
  TeamService: class { updateMember = updateMember }
}))

import { checkTeamRoleAssignment } from '@modules/teams/services/agent-teams-service'
import teamMembers from '@modules/teams/handlers/team-members'

const lead = { id: 'l1', role: 'agent', teamRoles: { 1: 'lead' } } as any
const sup = { id: 's1', role: 'agent', teamRoles: { 1: 'supervisor' } } as any
const admin = { id: 'a', role: 'admin' } as any

describe('F26 checkTeamRoleAssignment', () => {
  it('lead may assign member only', () => {
    expect(checkTeamRoleAssignment(lead, 1, 'member', 'm1', 'member')).toBeNull()
    expect(checkTeamRoleAssignment(lead, 1, 'lead', 'm1', 'member')).not.toBeNull()
    expect(checkTeamRoleAssignment(lead, 1, 'supervisor', 'm1', 'member')).not.toBeNull()
  })
  it('no self change, no touching peers/superiors, no unknown roles', () => {
    expect(checkTeamRoleAssignment(sup, 1, 'member', 's1', 'supervisor')).not.toBeNull()
    expect(checkTeamRoleAssignment(sup, 1, 'member', 'l2', 'supervisor')).not.toBeNull()
    expect(checkTeamRoleAssignment(lead, 1, 'member', 'l2', 'lead')).not.toBeNull()
    expect(checkTeamRoleAssignment(sup, 1, 'owner', 'm1', 'member')).toBe('Invalid roleInTeam')
  })
  it('supervisor may assign lead; admin unrestricted', () => {
    expect(checkTeamRoleAssignment(sup, 1, 'lead', 'm1', 'member')).toBeNull()
    expect(checkTeamRoleAssignment(admin, 1, 'supervisor', 'l1', 'lead')).toBeNull()
  })
})

describe('F06 PUT /:id/members/:agentId', () => {
  const app = new Hono().route('/', teamMembers)
  const put = (body: unknown) => app.request('/1/members/l1', {
    method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }
  }, {} as any)

  it('lead cannot write global role / isActive', async () => {
    currentUser = lead
    expect((await put({ role: 'admin' })).status).toBe(403)
    expect((await put({ isActive: false })).status).toBe(403)
    expect(updateMember).not.toHaveBeenCalled()
  })
  it('admin may', async () => {
    currentUser = admin
    expect((await put({ role: 'agent' })).status).toBe(200)
    expect(updateMember).toHaveBeenCalled()
  })
})
