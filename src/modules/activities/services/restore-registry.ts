// Activities Module - Restore Handler Registry

import {
  addTeamMembership,
  addTagToCustomer,
  removeTagFromCustomer,
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
  'agent.create': softDelete('agents'),
  'agent.delete': restoreSoftDeleted('agents'),
  'agent.update': restoreFields('agents'),
  'conversation.assign': restoreFields('conversations'),
  // No 'conversation.delete'. Conversations are not soft-deletable: no handler,
  // bulk action or UI deletes one, so nothing ever emits that activity and
  // conversations.deleted_at cannot become non-NULL. The entry was an un-delete
  // for an unreachable state.
  'conversation.status': restoreField('conversations', 'status'),
  'conversation.transfer': restoreFields('conversations'),
  'conversation.unassign': restoreFields('conversations'),
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
