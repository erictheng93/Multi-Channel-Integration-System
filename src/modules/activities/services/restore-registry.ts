// Activities Module - Restore Handler Registry

import {
  addTeamMembership,
  addTagToCustomer,
  removeTagFromCustomer,
  restoreAssignedAgent,
  restoreField,
  restoreFields,
  restoreSoftDeleted,
  softDelete
} from './restore-helpers'

export interface RestoreHandler {
  allowMissingCurrentState?: boolean

  buildMutation(
    db: D1Database,
    previousState: Record<string, unknown>
  ): D1PreparedStatement

  getCurrentState(
    db: D1Database,
    resourceId: string
  ): Promise<Record<string, unknown> | null>
}

export const RestoreRegistry: Record<string, RestoreHandler> = {
  'agent.delete': restoreSoftDeleted('agents'),
  'agent.update': restoreFields('agents'),
  'conversation.assign': restoreAssignedAgent,
  'conversation.delete': restoreSoftDeleted('conversations'),
  'conversation.status': restoreField('conversations', 'status'),
  'conversation.unassign': restoreAssignedAgent,
  'customer.create': softDelete('customers'),
  'customer.delete': restoreSoftDeleted('customers'),
  'customer.tag-assign': removeTagFromCustomer,
  'customer.tag-unassign': addTagToCustomer,
  'customer.update': restoreFields('customers'),
  'tag.create': softDelete('tags'),
  'tag.delete': restoreFields('tags'),
  'tag.update': restoreFields('tags'),
  'team.create': softDelete('teams'),
  'team.delete': restoreSoftDeleted('teams'),
  'team.update': restoreFields('teams'),
  'team_member.remove': addTeamMembership
}
