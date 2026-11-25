import { describe, expect, it } from 'vitest'
import { ACTIVITY_ACTIONS } from '@/modules/activities/constants/actions'
import { ActivityValidator } from '@/modules/activities/utils/validators'

describe('Restore action constants', () => {
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
