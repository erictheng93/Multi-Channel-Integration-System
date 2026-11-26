import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { TeamMember } from '@/types'

vi.mock('@/api/team', () => ({ teamApi: {} }))

import { SYSTEM_ADMIN_AGENT_ID, useMemberEditForm } from './useMemberEditForm'

function memberWith(fields: Partial<TeamMember>): TeamMember {
  return { id: 'agent-1', loginId: 'Someone', email: 'someone@example.com', role: 'admin', ...fields } as TeamMember
}

describe('useMemberEditForm system admin guard', () => {
  setActivePinia(createPinia())

  // Production: agents.id = admin-dacit-001, displayName "System Administrator" (not "...Administration").
  it('blocks password reset for the system admin by id, whatever loginId/email the API returned', () => {
    const form = useMemberEditForm(ref(memberWith({ id: SYSTEM_ADMIN_AGENT_ID, loginId: 'System Administrator' })))
    expect(form.isSystemAdmin.value).toBe(true)
    expect(form.canResetPassword.value).toBe(false)
  })

  it('allows password reset for another admin', () => {
    const form = useMemberEditForm(ref(memberWith({})))
    expect(form.isSystemAdmin.value).toBe(false)
    expect(form.canResetPassword.value).toBe(true)
  })
})
