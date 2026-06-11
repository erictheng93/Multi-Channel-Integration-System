import { defineApiContract } from './core'
import type { TeamRoleInTeam } from './team-membership'

export type TeamMemberRole = 'admin' | 'agent'
export type TeamMemberStatus = 'active' | 'inactive' | 'pending'

export interface TeamMemberApiDto {
  id: string
  loginId: string
  name?: string
  email?: string
  role: TeamMemberRole
  status: TeamMemberStatus
  group?: string
  avatar?: string
  createdAt: Date | string
  updatedAt: Date | string
  lastLoginAt?: Date | string
  teams?: Array<{
    teamId: number
    teamName?: string
    roleInTeam: TeamRoleInTeam
    isPrimary: boolean
    joinedAt?: string
  }>
  teamCount?: number
  primaryTeamId?: number
  primaryTeamName?: string
}

export interface TeamApiDto {
  id: number
  name: string
  description?: string
  qrCode?: string
  lineUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

export interface CheckTeamMemberEmailResponse {
  exists: boolean
  status?: 'active' | 'deleted'
  member?: {
    id: string
    displayName: string
    email: string
    role: TeamMemberRole
    teamName: string | null
    lastLoginAt: string | null
    createdAt: string
    deletedAt: string | null
  }
}

export interface CreateTeamMemberRequest {
  email: string
  password: string
  displayName: string
  role: TeamMemberRole
  isActive: boolean
  teamId?: number
}

export interface BulkDeleteTeamMembersRequest {
  memberIds: string[]
  reason?: string
}

export interface BulkDeleteTeamMembersResponse {
  deleted: string[]
  failed: { memberId: string; error: string }[]
  deletedCount: number
}

export interface BulkUpdateTeamMembersRequest {
  memberIds: string[]
  updates: { role?: TeamMemberRole; isActive?: boolean }
  reason?: string
}

export interface BulkUpdateTeamMembersResponse {
  updated: string[]
  failed: { memberId: string; error: string }[]
  skipped: { memberId: string; reason: string }[]
  updatedCount: number
}

export interface BatchEditTeamMembersRequest {
  members: Array<{
    memberId: string
    profile?: {
      displayName?: string
      email?: string
      role?: TeamMemberRole
    }
    teamChanges?: {
      add?: number[]
      remove?: number[]
    }
  }>
  reason?: string
}

export interface BatchEditTeamMembersResponse {
  results: Array<{
    memberId: string
    success: boolean
    error?: string
    profileUpdated: boolean
    teamsAdded: number[]
    teamsRemoved: number[]
  }>
  successCount: number
  failedCount: number
  skipped: { memberId: string; reason: string }[]
  undoToken?: string
  undoExpiresAt?: string
}

export interface UndoBatchEditTeamMembersResponse {
  restoredCount: number
  results: Array<{
    memberId: string
    success: boolean
    error?: string
  }>
}

export interface TeamStatsApiDto {
  totalMembers: number
  activeMembers: number
  adminCount: number
}

export interface TeamScopedStatsApiDto extends TeamStatsApiDto {
  pendingInvitations: number
}

export interface TeamDetailedStatsApiDto {
  teamId: number
  teamName: string
  totalMembers: number
  activeMembers: number
  conversationsHandled: number
  messagesCount: number
  avgResponseTime: number
  memberStats?: Array<{
    agentId: string
    displayName: string
    conversationsHandled: number
    messagesCount: number
    avgResponseTime: number
    lastActive: string | null
  }>
  qrCodeScans: number
  period: {
    from: string
    to: string
  }
}

export interface LiffQRCodeCreatedDto {
  id: string
  liffUrl: string
  qrCodeUrl: string
  scanCount: number
  isActive: boolean
}

export interface LiffQRCodeDto extends LiffQRCodeCreatedDto {
  createdAt: string
  updatedAt: string
}

export interface LiffQRCodeStatsDto {
  scanCount: number
  assignmentCount: number
  createdAt: string
  lastScannedAt: string
  isActive: boolean
}

export interface BulkRemoveTeamMembersRequest {
  agentIds: string[]
}

export interface BulkRemoveTeamMembersResponse {
  removed: string[]
  failed: { agentId: string; error: string }[]
  removedCount: number
}

export interface BatchAddTeamMembersRequest {
  agentIds: string[]
  roleInTeam: TeamRoleInTeam
}

export interface BatchAddTeamMembersResponse {
  added: string[]
  skipped: string[]
  errors: { agentId: string; error: string }[]
  addedCount: number
}

export const teamContracts = {
  getMembers: defineApiContract<void, void, TeamMemberApiDto[]>({
    method: 'GET',
    path: () => '/teams/members'
  }),

  checkEmail: defineApiContract<{ email: string }, void, CheckTeamMemberEmailResponse>({
    method: 'GET',
    path: ({ email }) => `/teams/members/check-email?email=${encodeURIComponent(email)}`
  }),

  addMember: defineApiContract<void, CreateTeamMemberRequest, TeamMemberApiDto>({
    method: 'POST',
    path: () => '/teams/members'
  }),

  removeMember: defineApiContract<{ memberId: string }, void, { deletedMemberId: string }>({
    method: 'DELETE',
    path: ({ memberId }) => `/teams/members/${memberId}`
  }),

  bulkDeleteMembers: defineApiContract<
    void,
    BulkDeleteTeamMembersRequest,
    BulkDeleteTeamMembersResponse
  >({
    method: 'POST',
    path: () => '/teams/members/bulk-delete'
  }),

  bulkUpdateMembers: defineApiContract<
    void,
    BulkUpdateTeamMembersRequest,
    BulkUpdateTeamMembersResponse
  >({
    method: 'POST',
    path: () => '/teams/members/bulk-update'
  }),

  batchEditMembers: defineApiContract<
    void,
    BatchEditTeamMembersRequest,
    BatchEditTeamMembersResponse
  >({
    method: 'POST',
    path: () => '/teams/members/batch-edit'
  }),

  undoBatchEdit: defineApiContract<void, { undoToken: string }, UndoBatchEditTeamMembersResponse>({
    method: 'POST',
    path: () => '/teams/members/batch-edit/undo'
  }),

  updateMemberRole: defineApiContract<{ memberId: string }, { role: TeamMemberRole }, void>({
    method: 'PUT',
    path: ({ memberId }) => `/teams/members/${memberId}/role`
  }),

  updateMemberStatus: defineApiContract<{ memberId: string }, { isActive: boolean }, void>({
    method: 'PUT',
    path: ({ memberId }) => `/teams/members/${memberId}/status`
  }),

  resetPasswordWithPolicy: defineApiContract<
    { memberId: string },
    { newPassword: string; policy: 'changeable' | 'unchangeable' | 'must_change' },
    void
  >({
    method: 'POST',
    path: ({ memberId }) => `/teams/members/${memberId}/reset`
  }),

  getMember: defineApiContract<{ memberId: string }, void, TeamMemberApiDto>({
    method: 'GET',
    path: ({ memberId }) => `/teams/members/${memberId}`
  }),

  updateMember: defineApiContract<{ memberId: string }, Partial<TeamMemberApiDto>, TeamMemberApiDto>({
    method: 'PUT',
    path: ({ memberId }) => `/teams/members/${memberId}`
  }),

  getTeamStats: defineApiContract<void, void, TeamStatsApiDto>({
    method: 'GET',
    path: () => '/teams/stats'
  }),

  getTeams: defineApiContract<{ includeInactive?: boolean }, void, TeamApiDto[]>({
    method: 'GET',
    path: ({ includeInactive }) => `/teams${includeInactive ? '?includeInactive=true' : ''}`
  }),

  createTeam: defineApiContract<void, { name: string; description?: string }, TeamApiDto>({
    method: 'POST',
    path: () => '/teams'
  }),

  updateTeam: defineApiContract<
    { teamId: number },
    { name?: string; description?: string; isActive?: boolean },
    TeamApiDto
  >({
    method: 'PUT',
    path: ({ teamId }) => `/teams/${teamId}`
  }),

  deleteTeam: defineApiContract<{ teamId: number }, void, void>({
    method: 'DELETE',
    path: ({ teamId }) => `/teams/${teamId}`
  }),

  getTeamDetail: defineApiContract<{ teamId: number }, void, TeamApiDto>({
    method: 'GET',
    path: ({ teamId }) => `/teams/${teamId}`
  }),

  getTeamMembersByTeam: defineApiContract<{ teamId: number }, void, TeamMemberApiDto[]>({
    method: 'GET',
    path: ({ teamId }) => `/teams/${teamId}/members`
  }),

  getTeamStatsByTeam: defineApiContract<{ teamId: number }, void, TeamDetailedStatsApiDto>({
    method: 'GET',
    path: ({ teamId }) => `/teams/${teamId}/stats`
  }),

  generateLiffQR: defineApiContract<{ teamId: number }, void, LiffQRCodeCreatedDto>({
    method: 'POST',
    path: ({ teamId }) => `/teams/${teamId}/qr-code/liff`
  }),

  getLiffQRCode: defineApiContract<{ teamId: number }, void, LiffQRCodeDto>({
    method: 'GET',
    path: ({ teamId }) => `/teams/${teamId}/qr-code/liff`
  }),

  getLiffQRStats: defineApiContract<{ teamId: number }, void, LiffQRCodeStatsDto>({
    method: 'GET',
    path: ({ teamId }) => `/teams/${teamId}/qr-code/liff/stats`
  }),

  getTeamMembers: defineApiContract<{ teamId?: number }, void, TeamMemberApiDto[]>({
    method: 'GET',
    path: ({ teamId }) => (teamId ? `/teams/${teamId}/members` : '/teams/members')
  }),

  getAvailableAssignees: defineApiContract<void, void, TeamMemberApiDto[]>({
    method: 'GET',
    path: () => '/teams/assignees'
  }),

  bulkRemoveMembersFromTeam: defineApiContract<
    { teamId: number },
    BulkRemoveTeamMembersRequest,
    BulkRemoveTeamMembersResponse
  >({
    method: 'POST',
    path: ({ teamId }) => `/teams/${teamId}/members/bulk-remove`
  }),

  batchAddMembersToTeam: defineApiContract<
    { teamId: number },
    BatchAddTeamMembersRequest,
    BatchAddTeamMembersResponse
  >({
    method: 'POST',
    path: ({ teamId }) => `/teams/${teamId}/members/batch`
  })
} as const
