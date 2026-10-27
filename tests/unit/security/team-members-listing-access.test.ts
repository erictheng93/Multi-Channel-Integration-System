// Audit run-2 finding #7: GET /agent-teams/team/:teamId/members is limited to members of
// that team and admins (real requireTeamAccess, only jwtAuth is stubbed).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

let currentUser: any
vi.mock('@/middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('@/middleware/auth')>('@/middleware/auth')
  return {
    ...actual,
    jwtAuth: vi.fn(async (c: any, next: any) => { c.set('user', currentUser); await next() })
  }
})

const getTeamMembers = vi.fn(async () => [])
vi.mock('@modules/teams/services/agent-teams-service', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@modules/teams/services/agent-teams-service')
  return { ...actual, AgentTeamsService: class { getTeamMembers = getTeamMembers } }
})

import agentTeams from '@modules/teams/handlers/agent-teams'

const app = new Hono().route('/', agentTeams)
const list = (teamId: number) => app.request(`/team/${teamId}/members`, {}, { DB: {} } as any)

beforeEach(() => vi.clearAllMocks())

describe('GET /team/:teamId/members', () => {
  it('a member of another team gets 403 and nothing is read', async () => {
    currentUser = { id: 'a1', role: 'agent', allowedTeamIds: [2], teamRoles: { 2: 'member' } }
    expect((await list(1)).status).toBe(403)
    expect(getTeamMembers).not.toHaveBeenCalled()
  })
  it('an agent with no teams gets 403', async () => {
    currentUser = { id: 'a2', role: 'agent', allowedTeamIds: [], teamRoles: {} }
    expect((await list(1)).status).toBe(403)
    expect(getTeamMembers).not.toHaveBeenCalled()
  })
  it('a member of the team may list it', async () => {
    currentUser = { id: 'a3', role: 'agent', allowedTeamIds: [1, 2], teamRoles: { 1: 'member' } }
    expect((await list(1)).status).toBe(200)
    expect(getTeamMembers).toHaveBeenCalledWith(1)
  })
  it('admin may list any team', async () => {
    currentUser = { id: 'adm', role: 'admin' }
    expect((await list(99)).status).toBe(200)
    expect(getTeamMembers).toHaveBeenCalledWith(99)
  })
})
