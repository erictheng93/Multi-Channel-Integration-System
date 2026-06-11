import { defineApiContract } from './core'

export type TeamRoleInTeam = 'member' | 'lead' | 'supervisor'

export interface AgentTeamMembershipDto {
  teamId: number
  teamName?: string
  roleInTeam: TeamRoleInTeam
  isPrimary: boolean
  joinedAt?: string
}

export interface JoinAgentTeamRequest {
  teamId: number
  roleInTeam?: TeamRoleInTeam
  isPrimary?: boolean
}

export interface JoinMultipleAgentTeamsRequest {
  teamIds: number[]
  roleInTeam?: TeamRoleInTeam
}

export interface JoinMultipleAgentTeamsResponse {
  added: number[]
  skipped: number[]
  errors: { teamId: number; error: string }[]
}

export interface UpdateAgentTeamRoleRequest {
  roleInTeam?: TeamRoleInTeam
  isPrimary?: boolean
}

export interface TeamMemberWithTeamsDto {
  id: string
  email: string
  displayName: string
  role: string
  isActive: boolean
  teams: AgentTeamMembershipDto[]
  primaryTeamId?: number
}

export const teamMembershipContracts = {
  getAgentTeams: defineApiContract<{ agentId: string }, void, AgentTeamMembershipDto[]>({
    method: 'GET',
    path: ({ agentId }) => `/teams/agent-teams/${agentId}`
  }),

  joinTeam: defineApiContract<
    { agentId: string },
    JoinAgentTeamRequest,
    AgentTeamMembershipDto
  >({
    method: 'POST',
    path: ({ agentId }) => `/teams/agent-teams/${agentId}/join`
  }),

  joinMultipleTeams: defineApiContract<
    { agentId: string },
    JoinMultipleAgentTeamsRequest,
    JoinMultipleAgentTeamsResponse
  >({
    method: 'POST',
    path: ({ agentId }) => `/teams/agent-teams/${agentId}/join-multiple`
  }),

  leaveTeam: defineApiContract<{ agentId: string; teamId: number }, void, void>({
    method: 'DELETE',
    path: ({ agentId, teamId }) => `/teams/agent-teams/${agentId}/leave/${teamId}`
  }),

  updateAgentTeamRole: defineApiContract<
    { agentId: string; teamId: number },
    UpdateAgentTeamRoleRequest,
    AgentTeamMembershipDto
  >({
    method: 'PUT',
    path: ({ agentId, teamId }) => `/teams/agent-teams/${agentId}/role/${teamId}`
  }),

  setPrimaryTeam: defineApiContract<{ agentId: string; teamId: number }, void, void>({
    method: 'PUT',
    path: ({ agentId, teamId }) => `/teams/agent-teams/${agentId}/primary/${teamId}`
  }),

  getTeamMembersWithTeams: defineApiContract<
    { teamId: number },
    void,
    TeamMemberWithTeamsDto[]
  >({
    method: 'GET',
    path: ({ teamId }) => `/teams/agent-teams/team/${teamId}/members`
  })
} as const
