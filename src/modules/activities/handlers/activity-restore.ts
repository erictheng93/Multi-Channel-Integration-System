// Activities Module - Restore Handler

import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Bindings } from '@/types'
import { ACTIVITY_ACTIONS } from '@modules/activities/constants/actions'
import { ActivityCapture } from '@modules/activities/services/ActivityCapture'
import { diffStates } from '@modules/activities/services/conflict-detector'
import { RestoreRegistry } from '@modules/activities/services/restore-registry'

const handler = new Hono<{ Bindings: Bindings }>()

interface ActivityRow {
  id: number
  user_id: string
  user_name?: string
  user_role?: string
  action: string
  resource_type: string
  resource_id: string | null
  details: string | null
}

interface RestoreCaller {
  id: string
  role: string
  name?: string
}

const RESTORE_ACTION_BY_RESOURCE: Record<string, string> = {
  conversation: ACTIVITY_ACTIONS.CONVERSATION_RESTORE,
  customer: ACTIVITY_ACTIONS.CUSTOMER_RESTORE,
  delayed_message: ACTIVITY_ACTIONS.DELAYED_MESSAGE_RESTORE,
  tag: ACTIVITY_ACTIONS.TAG_RESTORE,
  team: ACTIVITY_ACTIONS.TEAM_RESTORE,
  user: ACTIVITY_ACTIONS.USER_RESTORE
}

function parseDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function readCaller(c: Context<{ Bindings: Bindings }>): RestoreCaller | null {
  const jwtUser = c.get('user' as never) as
    | { id?: string; role?: string; displayName?: string; name?: string }
    | undefined
  if (jwtUser?.id && jwtUser.role) {
    return { id: jwtUser.id, role: jwtUser.role, name: jwtUser.displayName ?? jwtUser.name }
  }

  const testUserHeader = c.req.header('X-Test-User')
  if (!testUserHeader) return null
  try {
    const parsed = JSON.parse(testUserHeader)
    if (parsed?.id && parsed?.role) {
      return { id: parsed.id, role: parsed.role, name: parsed.name ?? parsed.displayName }
    }
  } catch {
    return null
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

handler.post('/', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: 'Invalid activity id' }, 400)
  }

  const row = await c.env.DB
    .prepare('SELECT * FROM activities WHERE id = ?')
    .bind(id)
    .first<ActivityRow>()

  if (!row) {
    return c.json({ success: false, error: 'Activity not found' }, 404)
  }

  const details = parseDetails(row.details)
  if (details.reversible !== true) {
    return c.json(
      { success: false, error: 'Activity is not reversible', code: 'NOT_REVERSIBLE' },
      422
    )
  }

  const restoredByActivityId = details.restoredByActivityId
  if (restoredByActivityId !== null && restoredByActivityId !== undefined) {
    if (restoredByActivityId === -1) {
      return c.json(
        { success: false, error: 'Restore in progress', code: 'RESTORE_IN_PROGRESS', retryAfterMs: 2000 },
        409
      )
    }
    return c.json(
      {
        success: false,
        error: 'Activity already restored',
        code: 'ALREADY_RESTORED',
        restoredByActivityId
      },
      409
    )
  }

  const caller = readCaller(c)
  if (!caller) {
    return c.json({ success: false, error: 'Unauthenticated' }, 401)
  }

  const restorePolicy = asRecord(details.restorePolicy)
  const requiresAdmin = restorePolicy.requiresAdmin === true
  const canRestore =
    caller.role === 'admin' ||
    (caller.id === row.user_id && !requiresAdmin)

  if (!canRestore) {
    return c.json({ success: false, error: 'Forbidden' }, 403)
  }

  const expiresAt = typeof restorePolicy.expiresAt === 'string'
    ? new Date(restorePolicy.expiresAt).getTime()
    : NaN
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    return c.json({ success: false, error: 'Restore window expired', code: 'RESTORE_EXPIRED' }, 410)
  }

  if (!row.resource_id) {
    return c.json({ success: false, error: 'Activity has no resource id', code: 'MISSING_RESOURCE_ID' }, 422)
  }

  const restoreHandlerKey = typeof details.restoreHandler === 'string' ? details.restoreHandler : ''
  const restoreHandler = RestoreRegistry[restoreHandlerKey]
  if (!restoreHandler) {
    return c.json({ success: false, error: 'Restore handler not found', code: 'RESTORE_HANDLER_NOT_FOUND' }, 422)
  }

  const currentState = await restoreHandler.getCurrentState(c.env.DB, row.resource_id)
  if (!currentState) {
    return c.json({ success: false, error: 'Resource no longer exists', code: 'RESOURCE_NOT_FOUND' }, 422)
  }

  let force = false
  try {
    const body = await c.req.json()
    force = body?.force === true
  } catch {
    force = false
  }

  const previousState = asRecord(details.previousState)
  const newState = asRecord(details.newState)
  const midChanges = diffStates(currentState, newState, previousState)
  if (midChanges.length > 0 && !force) {
    return c.json(
      {
        success: false,
        error: 'Conflict detected',
        code: 'RESTORE_CONFLICT',
        data: { midChanges }
      },
      409
    )
  }

  const restoreAction = RESTORE_ACTION_BY_RESOURCE[row.resource_type]
  if (!restoreAction) {
    return c.json(
      {
        success: false,
        error: `Unsupported resourceType: ${row.resource_type}`,
        code: 'UNSUPPORTED_RESOURCE_TYPE'
      },
      422
    )
  }

  const casResult = await c.env.DB
    .prepare(`
      UPDATE activities
         SET details = json_set(details, '$.restoredByActivityId', -1)
       WHERE id = ?
         AND json_extract(details, '$.restoredByActivityId') IS NULL
    `)
    .bind(id)
    .run()

  if (casResult.meta?.changes !== 1) {
    const winner = await c.env.DB
      .prepare('SELECT details FROM activities WHERE id = ?')
      .bind(id)
      .first<{ details: string | null }>()
    const winnerDetails = parseDetails(winner?.details)
    const winnerId = winnerDetails.restoredByActivityId
    if (winnerId === -1) {
      return c.json(
        { success: false, error: 'Restore in progress', code: 'RESTORE_IN_PROGRESS', retryAfterMs: 2000 },
        409
      )
    }
    return c.json(
      {
        success: false,
        error: 'Activity already restored',
        code: 'ALREADY_RESTORED',
        restoredByActivityId: winnerId
      },
      409
    )
  }

  const capture = new ActivityCapture(c.env.DB)
  const mutationStmt = restoreHandler.buildMutation(c.env.DB, previousState)
  const restoreLogStmt = capture.buildIrreversibleLog({
    userId: caller.id,
    userName: caller.name ?? caller.id,
    userRole: caller.role,
    action: restoreAction,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ipAddress: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? undefined,
    userAgent: c.req.header('User-Agent') ?? undefined,
    reason: 'restore_action_v1_not_reversible',
    details: {
      restoredActivityId: row.id,
      force
    }
  })

  let newRestoreLogId: number | null = null
  try {
    const batchResult = await c.env.DB.batch([mutationStmt, restoreLogStmt])
    const logResult = batchResult[1] as D1Result | undefined
    const rowId = logResult?.meta?.last_row_id
    newRestoreLogId = typeof rowId === 'number' ? rowId : null
  } catch (error) {
    await c.env.DB
      .prepare("UPDATE activities SET details = json_set(details, '$.restoredByActivityId', NULL) WHERE id = ?")
      .bind(id)
      .run()
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Restore batch failed',
        code: 'BATCH_FAILED'
      },
      500
    )
  }

  if (newRestoreLogId !== null) {
    await c.env.DB
      .prepare(`
        UPDATE activities
           SET details = json_set(details, '$.restoredByActivityId', ?)
         WHERE id = ?
      `)
      .bind(newRestoreLogId, id)
      .run()
  }

  try {
    const broadcaster = c.env.MESSAGE_BROADCASTER
    if (broadcaster) {
      const stub = broadcaster.get(broadcaster.idFromName('global'))
      await stub.fetch(new Request('https://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          event: 'resource.restored',
          payload: {
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            restoredBy: caller.id,
            restoredByActivityId: newRestoreLogId
          }
        })
      }))
    }
  } catch {
    // Broadcast failures must not fail an already committed restore.
  }

  return c.json({
    success: true,
    data: {
      restoredActivityId: id,
      restoredByActivityId: newRestoreLogId
    }
  }, 200)
})

export default handler
