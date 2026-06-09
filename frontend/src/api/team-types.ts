import type { AgentTeamMembership, TeamMember } from '@/types'

export interface AddTeamMemberRequest {
  loginId: string
  name?: string
  email?: string
  password: string
  role: 'admin' | 'agent'
  group?: string
  isActive: boolean
}

export interface CheckMemberEmailResponse {
  exists: boolean
  status?: 'active' | 'deleted'
  member?: {
    id: string
    displayName: string
    email: string
    role: 'admin' | 'agent'
    teamName: string | null
    lastLoginAt: string | null
    createdAt: string
    deletedAt: string | null
  }
}

export interface RemoveMemberResponse {
  deletedMemberId: string
}

export interface BulkDeleteMembersResponse {
  deleted: string[]
  failed: { memberId: string; error: string }[]
  deletedCount: number
}

export interface BulkUpdateMembersResponse {
  updated: string[]
  failed: { memberId: string; error: string }[]
  skipped: { memberId: string; reason: string }[]
  updatedCount: number
}

export interface BatchEditMemberRequest {
  memberId: string
  profile?: {
    displayName?: string
    email?: string
    role?: 'admin' | 'agent'
  }
  teamChanges?: {
    add?: number[]
    remove?: number[]
  }
}

export interface BatchEditMembersResponse {
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

export interface UndoBatchEditResponse {
  restoredCount: number
  results: Array<{
    memberId: string
    success: boolean
    error?: string
  }>
}

export interface TeamStatsResponse {
  totalMembers: number
  activeMembers: number
  adminCount: number
}

export interface MigratePasswordsResponse {
  migrated: Array<{ username: string; status: string; error?: string }>
  total: number
}

export interface TeamResponse {
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

export interface CreateTeamRequest {
  name: string
  description?: string
}

export interface UpdateTeamRequest {
  name?: string
  description?: string
  isActive?: boolean
}

export interface TeamScopedStatsResponse extends TeamStatsResponse {
  pendingInvitations: number
}

export interface LiffQRResponseBase {
  id: string
  liffUrl: string
  qrCodeUrl: string
  scanCount: number
  isActive: boolean
}

export interface LiffQRResponse extends LiffQRResponseBase {
  createdAt: string
  updatedAt: string
}

export interface LiffQRStatsResponse {
  scanCount: number
  assignmentCount: number
  createdAt: string
  lastScannedAt: string
  isActive: boolean
}

export interface BulkRemoveMembersFromTeamResponse {
  removed: string[]
  failed: { agentId: string; error: string }[]
  removedCount: number
}

export interface BatchAddMembersToTeamResponse {
  added: string[]
  skipped: string[]
  errors: { agentId: string; error: string }[]
  addedCount: number
}

export interface TeamMemberWithTeamsResponse {
  id: string
  email: string
  displayName: string
  role: string
  isActive: boolean
  teams: AgentTeamMembership[]
  primaryTeamId?: number
}

export type TeamMemberListResponse = TeamMember[]
