import { describe, expect, it } from 'vitest'
import type { AgentTeamMembership } from '@/types'
import {
  applyPendingTeamChanges,
  addPendingTeam,
  removePendingTeam,
  setPrimaryTeamPending
} from '@/composables/team-management/memberEditTeamChanges'
import {
  getPasswordMatchStatus,
  isMemberEditFormValid,
  isMemberEditPasswordFormValid,
  validateMemberEditForm,
  validateMemberEditPasswordForm
} from '@/composables/team-management/memberEditValidation'
import type { PendingTeamChange } from '@/composables/team-management/memberEditTypes'

const currentTeams: AgentTeamMembership[] = [
  { teamId: 1, teamName: 'Support', roleInTeam: 'member', isPrimary: true },
  { teamId: 2, teamName: 'Sales', roleInTeam: 'member', isPrimary: false }
]

describe('member edit validation helpers', () => {
  it('validates profile form fields and reports localized errors', () => {
    expect(isMemberEditFormValid({ displayName: 'Alice', email: 'alice@example.com', role: 'agent' })).toBe(true)

    const errors = validateMemberEditForm({
      displayName: '',
      email: 'not-email',
      role: 'agent'
    })

    expect(errors).toEqual({
      displayName: '請輸入姓名',
      email: '請輸入有效的電子郵件格式'
    })
  })

  it('validates password form and match status consistently', () => {
    expect(isMemberEditPasswordFormValid({ newPassword: 'secret1', confirmPassword: 'secret1' })).toBe(true)
    expect(getPasswordMatchStatus({ newPassword: '', confirmPassword: '' })).toBe('idle')
    expect(getPasswordMatchStatus({ newPassword: 'secret1', confirmPassword: 'secret2' })).toBe('mismatch')
    expect(getPasswordMatchStatus({ newPassword: 'secret1', confirmPassword: 'secret1' })).toBe('match')

    expect(validateMemberEditPasswordForm({ newPassword: '123', confirmPassword: '456' })).toEqual({
      newPassword: '密碼至少需要 6 個字元',
      confirmPassword: '密碼不一致'
    })
  })
})

describe('member edit team-change helpers', () => {
  it('applies add, remove, and primary changes without mutating current teams', () => {
    const pending: PendingTeamChange[] = [
      { type: 'remove', teamId: 1 },
      { type: 'add', teamId: 3, teamName: 'Billing' },
      { type: 'set-primary', teamId: 3 }
    ]

    expect(applyPendingTeamChanges(currentTeams, pending)).toEqual([
      { teamId: 2, teamName: 'Sales', roleInTeam: 'member', isPrimary: false },
      { teamId: 3, teamName: 'Billing', roleInTeam: 'member', isPrimary: true }
    ])
    expect(currentTeams[0]?.isPrimary).toBe(true)
  })

  it('cancels opposite pending operations instead of adding redundant changes', () => {
    expect(addPendingTeam(currentTeams, [{ type: 'remove', teamId: 1 }], 1, 'Support')).toEqual([])
    expect(removePendingTeam(currentTeams, [{ type: 'add', teamId: 3, teamName: 'Billing' }], 3)).toEqual([])
    expect(addPendingTeam(currentTeams, [], 1, 'Support')).toEqual([])
    expect(removePendingTeam(currentTeams, [], 99)).toEqual([])
  })

  it('deduplicates pending changes for add/remove/set-primary', () => {
    expect(addPendingTeam(currentTeams, [{ type: 'add', teamId: 3, teamName: 'Billing' }], 3, 'Billing')).toEqual([
      { type: 'add', teamId: 3, teamName: 'Billing' }
    ])
    expect(removePendingTeam(currentTeams, [{ type: 'remove', teamId: 1 }], 1)).toEqual([
      { type: 'remove', teamId: 1 }
    ])
    expect(setPrimaryTeamPending(currentTeams, [{ type: 'set-primary', teamId: 1 }], 2)).toEqual([
      { type: 'set-primary', teamId: 2 }
    ])
    expect(setPrimaryTeamPending(currentTeams, [], 1)).toEqual([])
  })
})
