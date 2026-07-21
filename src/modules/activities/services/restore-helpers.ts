// Activities Module - Restore Helper Factories

import type { RestoreHandler } from './restore-registry'

const TABLES = new Set([
  'agents',
  'conversations',
  'customers',
  'tags',
  'teams'
])

const COLUMNS: Record<string, Set<string>> = {
  agents: new Set([
    'email',
    'display_name',
    'role',
    'is_active',
    'password_policy',
    'last_active',
    'last_login_at',
    'updated_at',
    'deleted_at'
  ]),
  conversations: new Set([
    'customer_id',
    'assigned_team_id',
    'status',
    'priority',
    'first_response_at',
    'closed_at',
    'last_message_at',
    'last_read_at',
    'marked_unread_at',
    'updated_at',
    'deleted_at'
  ]),
  customers: new Set([
    'platform',
    'platform_user_id',
    'display_name',
    'avatar_url',
    'email',
    'phone',
    'source_team_id',
    'metadata',
    'updated_at',
    'deleted_at'
  ]),
  tags: new Set([
    'name',
    'color',
    'description',
    'team_id',
    'is_active',
    'created_by',
    'updated_at',
    'deleted_at'
  ]),
  teams: new Set([
    'name',
    'description',
    'qr_code',
    'is_active',
    'updated_at',
    'deleted_at'
  ])
}

function assertTable(table: string): void {
  if (!TABLES.has(table)) {
    throw new Error(`Unsupported restore table: ${table}`)
  }
}

function assertColumn(table: string, column: string): void {
  if (!COLUMNS[table]?.has(column)) {
    throw new Error(`Unsupported restore column: ${table}.${column}`)
  }
}

function requireValue(state: Record<string, unknown>, key: string): unknown {
  const value = state[key]
  if (value === undefined || value === null) {
    throw new Error(`previousState.${key} missing`)
  }
  return value
}

async function getById(
  db: D1Database,
  table: string,
  resourceId: string
): Promise<Record<string, unknown> | null> {
  assertTable(table)
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(resourceId).first()
  return row ? (row as Record<string, unknown>) : null
}

export function restoreSoftDeleted(table: string): RestoreHandler {
  assertTable(table)
  return {
    buildMutation(db, previousState) {
      const id = requireValue(previousState, 'id')
      return db
        .prepare(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`)
        .bind(id)
    },
    getCurrentState: (db, resourceId) => getById(db, table, resourceId)
  }
}

export function softDelete(table: string): RestoreHandler {
  assertTable(table)
  return {
    buildMutation(db, previousState) {
      const id = requireValue(previousState, 'id')
      return db
        .prepare(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`)
        .bind(new Date().toISOString(), id)
    },
    getCurrentState: (db, resourceId) => getById(db, table, resourceId)
  }
}

export function restoreFields(table: string): RestoreHandler {
  assertTable(table)
  return {
    buildMutation(db, previousState) {
      const id = requireValue(previousState, 'id')
      const entries = Object.entries(previousState).filter(([key]) => key !== 'id')
      if (entries.length === 0) {
        throw new Error(`restoreFields(${table}): no fields to restore`)
      }
      for (const [column] of entries) {
        assertColumn(table, column)
      }
      const setClause = entries.map(([column]) => `${column} = ?`).join(', ')
      return db
        .prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`)
        .bind(...entries.map(([, value]) => value), id)
    },
    getCurrentState: (db, resourceId) => getById(db, table, resourceId)
  }
}

export function restoreField(table: string, field: string): RestoreHandler {
  assertTable(table)
  assertColumn(table, field)
  return {
    buildMutation(db, previousState) {
      const id = requireValue(previousState, 'id')
      if (!(field in previousState)) {
        throw new Error(`restoreField(${table}.${field}): previousState field missing`)
      }
      return db
        .prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`)
        .bind(previousState[field], id)
    },
    getCurrentState: (db, resourceId) => getById(db, table, resourceId)
  }
}

export const removeTagFromCustomer: RestoreHandler = {
  buildMutation(db, previousState) {
    const customerId = requireValue(previousState, 'customerId')
    const tagId = requireValue(previousState, 'tagId')
    return db
      .prepare('DELETE FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
      .bind(customerId, tagId)
  },
  async getCurrentState(db, resourceId) {
    const [customerId, tagId] = resourceId.split(':')
    if (!customerId || !tagId) return null
    const row = await db
      .prepare('SELECT * FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
      .bind(customerId, tagId)
      .first()
    return row ? (row as Record<string, unknown>) : null
  }
}

export const addTagToCustomer: RestoreHandler = {
  buildMutation(db, previousState) {
    const customerId = requireValue(previousState, 'customerId')
    const tagId = requireValue(previousState, 'tagId')
    const assignedBy = requireValue(previousState, 'assignedBy')
    return db
      .prepare(
        'INSERT OR IGNORE INTO customer_tags (customer_id, tag_id, assigned_by) VALUES (?, ?, ?)'
      )
      .bind(customerId, tagId, assignedBy)
  },
  getCurrentState: removeTagFromCustomer.getCurrentState
}

export const addTeamMembership: RestoreHandler = {
  allowMissingCurrentState: true,

  buildMutation(db, previousState) {
    const agentId = requireValue(previousState, 'agent_id')
    const teamId = requireValue(previousState, 'team_id')
    const roleInTeam = requireValue(previousState, 'role_in_team')
    const isPrimary = previousState.is_primary
    const joinedAt = previousState.joined_at ?? previousState.assigned_at ?? new Date().toISOString()
    if (isPrimary === undefined || isPrimary === null) {
      throw new Error('previousState.is_primary missing')
    }
    return db
      .prepare(
        `INSERT INTO agent_teams (agent_id, team_id, role_in_team, is_primary, joined_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(agentId, teamId, roleInTeam, isPrimary, joinedAt)
  },
  async getCurrentState(db, resourceId) {
    const [agentId, teamId] = resourceId.split(':')
    const teamIdNum = Number(teamId)
    if (!agentId || !Number.isInteger(teamIdNum)) return null
    const row = await db
      .prepare('SELECT * FROM agent_teams WHERE agent_id = ? AND team_id = ?')
      .bind(agentId, teamIdNum)
      .first()
    return row ? (row as Record<string, unknown>) : null
  }
}

export const restoreAssignedAgent: RestoreHandler = {
  buildMutation(db, previousState) {
    const id = requireValue(previousState, 'id')
    const assignedTeamId = previousState.assignedTeamId ?? previousState.assigned_team_id ?? null
    return db
      .prepare('UPDATE conversations SET assigned_team_id = ? WHERE id = ?')
      .bind(assignedTeamId, id)
  },
  getCurrentState: (db, resourceId) => getById(db, 'conversations', resourceId)
}
