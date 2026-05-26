// Activities Module - Capture helper for reversible activity logging

import type { CreateActivityRequest } from '../types/interfaces'

export interface ReversibleCapture {
  request: CreateActivityRequest
  restoreHandler: string
  previousState: Record<string, unknown>
  newState: Record<string, unknown>
  expiresInMs?: number
  requiresAdmin?: boolean
}

const DEFAULT_EXPIRES_IN_MS = 24 * 60 * 60 * 1000

export class ActivityCapture {
  constructor(private db: D1Database) {}

  buildReversibleLog(capture: ReversibleCapture): D1PreparedStatement {
    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + (capture.expiresInMs ?? DEFAULT_EXPIRES_IN_MS)
    )

    const details = {
      reversible: true,
      restoreHandler: capture.restoreHandler,
      previousState: capture.previousState,
      newState: capture.newState,
      restorePolicy: {
        expiresAt: expiresAt.toISOString(),
        requiresAdmin: capture.requiresAdmin ?? false
      },
      restoredByActivityId: null
    }

    const mergedDetails =
      capture.request.details && typeof capture.request.details === 'object'
        ? { ...capture.request.details, ...details }
        : details

    const r = capture.request
    return this.db
      .prepare(
        `INSERT INTO activities
           (user_id, user_name, user_role, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        r.userId,
        r.userName,
        r.userRole,
        r.action,
        r.resourceType,
        r.resourceId ?? null,
        JSON.stringify(mergedDetails),
        r.ipAddress ?? null,
        r.userAgent ?? null,
        now.toISOString()
      )
  }

  buildIrreversibleLog(
    req: CreateActivityRequest & { reason: string }
  ): D1PreparedStatement {
    const now = new Date()
    const details = {
      reversible: false,
      irreversibleReason: req.reason
    }

    const mergedDetails =
      req.details && typeof req.details === 'object'
        ? { ...req.details, ...details }
        : details

    return this.db
      .prepare(
        `INSERT INTO activities
           (user_id, user_name, user_role, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        req.userId,
        req.userName,
        req.userRole,
        req.action,
        req.resourceType,
        req.resourceId ?? null,
        JSON.stringify(mergedDetails),
        req.ipAddress ?? null,
        req.userAgent ?? null,
        now.toISOString()
      )
  }

  async logOnly(stmt: D1PreparedStatement): Promise<number | null> {
    const result = await stmt.run()
    const rowId = result.meta?.last_row_id
    return typeof rowId === 'number' ? rowId : null
  }
}
