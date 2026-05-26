import { describe, expect, it } from 'vitest'
import { ACTIVITY_ACTIONS } from '@/modules/activities/constants/actions'
import { ActivityValidator } from '@/modules/activities/utils/validators'

describe('Restore action constants', () => {
  it('exposes all 6 new restore actions', () => {
    expect(ACTIVITY_ACTIONS.TAG_RESTORE).toBe('tag_restore')
    expect(ACTIVITY_ACTIONS.CUSTOMER_RESTORE).toBe('customer_restore')
    expect(ACTIVITY_ACTIONS.CONVERSATION_RESTORE).toBe('conversation_restore')
    expect(ACTIVITY_ACTIONS.TEAM_RESTORE).toBe('team_restore')
    expect(ACTIVITY_ACTIONS.TEAM_MEMBER_RESTORE).toBe('team_member_restore')
    expect(ACTIVITY_ACTIONS.DELAYED_MESSAGE_RESTORE).toBe('delayed_message_restore')
  })

  it('ActivityValidator accepts each new restore action', () => {
    const baseRequest = {
      userId: 'agent-123',
      userName: 'Tester',
      userRole: 'admin',
      resourceType: 'tag',
      resourceId: '42'
    }

    const newActions = [
      'tag_restore',
      'customer_restore',
      'conversation_restore',
      'team_restore',
      'team_member_restore',
      'delayed_message_restore'
    ]

    for (const action of newActions) {
      const errors = ActivityValidator.validateCreateRequest({ ...baseRequest, action })
      const actionErrors = errors.filter(e => e.field === 'action')
      expect(actionErrors).toHaveLength(0)
    }
  })
})
