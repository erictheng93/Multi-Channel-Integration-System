import type { ComputedRef, Ref } from 'vue'
import type { AgentTeamMembership, TeamMember } from '@/types'

export interface MemberEditFormData {
  displayName: string
  email: string
  role: 'admin' | 'agent'
}

export interface MemberEditPasswordFormData {
  newPassword: string
  confirmPassword: string
}

export interface MemberEditFormErrors {
  displayName?: string
  email?: string
  role?: string
}

export interface MemberEditPasswordErrors {
  newPassword?: string
  confirmPassword?: string
}

export interface PendingTeamChange {
  type: 'add' | 'remove' | 'set-primary'
  teamId: number
  teamName?: string
}

export interface MemberEditSnapshot {
  originalData: MemberEditFormData
  currentTeams: AgentTeamMembership[]
  pendingChanges: PendingTeamChange[]
  memberId: string
}

export type PasswordMatchStatus = 'idle' | 'mismatch' | 'match'

export interface UseMemberEditFormReturn {
  formData: Ref<MemberEditFormData>
  passwordForm: Ref<MemberEditPasswordFormData>
  formErrors: Ref<MemberEditFormErrors>
  passwordErrors: Ref<MemberEditPasswordErrors>
  isFormValid: ComputedRef<boolean>
  isPasswordFormValid: ComputedRef<boolean>
  passwordMatchStatus: ComputedRef<PasswordMatchStatus>
  isDirty: ComputedRef<boolean>
  isSaving: Ref<boolean>
  isResettingPassword: Ref<boolean>
  showPasswordSection: Ref<boolean>
  isSystemAdmin: ComputedRef<boolean>
  canResetPassword: ComputedRef<boolean>
  pendingTeamChanges: Ref<PendingTeamChange[]>
  currentTeams: Ref<AgentTeamMembership[]>
  displayTeams: ComputedRef<AgentTeamMembership[]>
  hasTeamChanges: ComputedRef<boolean>
  addTeamToPending: (_teamId: number, _teamName: string) => void
  removeTeamFromPending: (_teamId: number) => void
  setPrimaryTeamPending: (_teamId: number) => void
  initTeams: (_teams: AgentTeamMembership[]) => void
  initForm: (_member: TeamMember) => void
  validateForm: () => boolean
  validatePasswordForm: () => boolean
  saveChanges: () => Promise<boolean>
  resetPassword: () => Promise<boolean>
  resetForm: () => void
  togglePasswordSection: () => void
}
