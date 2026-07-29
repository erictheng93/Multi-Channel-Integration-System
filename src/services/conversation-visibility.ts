import { isNull, or, sql, type SQL } from 'drizzle-orm'
import { conversations } from '@/db/schema'
import type { DbUser } from '@/types'

export type ConversationVisibilityUser = Pick<DbUser, 'role' | 'allowedTeamIds'>

type AssignedTeamColumn =
  | 'assigned_team_id'
  | 'conversations.assigned_team_id'
  | 'c.assigned_team_id'
  | 'c2.assigned_team_id'

function normalizeTeamIds(teamIds: readonly number[] | undefined): number[] {
  return [...new Set((teamIds ?? []).filter(Number.isFinite))]
}

/**
 * Builds the canonical conversation visibility rule for Drizzle queries.
 *
 * Admins can see every conversation. Agents can see conversations assigned to
 * any of their teams plus unassigned conversations in the shared pool.
 */
export function getConversationVisibilityCondition(
  user: ConversationVisibilityUser
): SQL {
  if (user.role === 'admin') {
    return sql`1 = 1`
  }

  const teamIds = normalizeTeamIds(user.allowedTeamIds)
  if (teamIds.length === 0) {
    return isNull(conversations.assignedTeamId)
  }

  return or(
    isNull(conversations.assignedTeamId),
    sql`${conversations.assignedTeamId} IN (
      SELECT value FROM json_each(${JSON.stringify(teamIds)})
    )`
  )!
}

/**
 * Raw-SQL counterpart for D1 statements that cannot use Drizzle expressions.
 * The column argument is intentionally restricted to known internal aliases.
 */
export function getConversationVisibilitySql(
  user: ConversationVisibilityUser,
  assignedTeamColumn: AssignedTeamColumn
): { clause: string; params: unknown[] } {
  if (user.role === 'admin') {
    return { clause: '1 = 1', params: [] }
  }

  return {
    clause: `(${assignedTeamColumn} IS NULL OR ${assignedTeamColumn} IN (
      SELECT value FROM json_each(?)
    ))`,
    params: [JSON.stringify(normalizeTeamIds(user.allowedTeamIds))]
  }
}
