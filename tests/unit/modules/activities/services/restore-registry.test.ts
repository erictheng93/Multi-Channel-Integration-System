import { describe, expect, it } from 'vitest'
import { RestoreRegistry } from '@/modules/activities/services/restore-registry'

describe('RestoreRegistry', () => {
  it('registers Phase 1 restore handler keys', () => {
    expect(Object.keys(RestoreRegistry).sort()).toEqual([
      'agent.create',
      'agent.delete',
      'agent.update',
      'conversation.assign',
      // No 'conversation.delete': conversations are not soft-deletable. Nothing
      // emits that activity and nothing can set conversations.deleted_at, so the
      // handler was an un-delete for a state that cannot be reached.
      'conversation.status',
      'conversation.transfer',
      'conversation.unassign',
      'customer.create',
      'customer.delete',
      'customer.tag-assign',
      'customer.tag-unassign',
      'customer.update',
      'tag.create',
      'tag.delete',
      'tag.update',
      'team.create',
      'team.delete',
      'team.update',
      'team_member.remove'
    ])
  })

  it('each registry entry exposes buildMutation and getCurrentState', () => {
    for (const handler of Object.values(RestoreRegistry)) {
      expect(handler.buildMutation).toEqual(expect.any(Function))
      expect(handler.getCurrentState).toEqual(expect.any(Function))
    }
  })
})
