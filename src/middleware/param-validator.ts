/**
 * Route-parameter validation middleware for Hono handlers.
 *
 * Usage:
 *   import { requireIntId, requireStringParam } from '@/middleware/param-validator'
 *
 *   app.get('/api/teams/:id', requireIntId(), handler)
 *   app.get('/api/teams/:teamId/members/:memberId',
 *     requireIntId('teamId'), requireIntId('memberId'), handler)
 *   app.get('/api/conversations/:uuid', requireStringParam('uuid'), handler)
 */

import type { Context, Next } from 'hono'

// ──────────────────────────────────────────────
//  Common param schemas
// ──────────────────────────────────────────────

/**
 * Middleware that validates a route param as a positive integer.
 * Parsed value is stored in `c.set('validatedParams', { [name]: number })`.
 *
 * @param name - Route param name (default: 'id')
 */
export function requireIntId(name = 'id') {
  return async (c: Context, next: Next) => {
    const raw = c.req.param(name)
    if (!raw) {
      return c.json({ success: false, error: `Missing required parameter: ${name}` }, 400)
    }

    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return c.json(
        { success: false, error: `Invalid ${name}: must be a positive integer, got "${raw}"` },
        400,
      )
    }

    // Store validated value for handler use
    const existing = (c.get('validatedParams') as Record<string, unknown>) || {}
    c.set('validatedParams', { ...existing, [name]: parsed })

    await next()
  }
}

/**
 * Middleware that validates a route param as a non-empty string.
 *
 * @param name - Route param name
 * @param opts.maxLength - Maximum allowed length (default: 255)
 * @param opts.pattern - Optional regex the value must match
 */
export function requireStringParam(
  name: string,
  opts?: { maxLength?: number; pattern?: RegExp },
) {
  const maxLength = opts?.maxLength ?? 255
  const pattern = opts?.pattern

  return async (c: Context, next: Next) => {
    const raw = c.req.param(name)
    if (!raw || raw.trim().length === 0) {
      return c.json({ success: false, error: `Missing required parameter: ${name}` }, 400)
    }

    if (raw.length > maxLength) {
      return c.json(
        { success: false, error: `Parameter ${name} exceeds max length (${maxLength})` },
        400,
      )
    }

    if (pattern && !pattern.test(raw)) {
      return c.json(
        { success: false, error: `Parameter ${name} has invalid format` },
        400,
      )
    }

    const existing = (c.get('validatedParams') as Record<string, unknown>) || {}
    c.set('validatedParams', { ...existing, [name]: raw })

    await next()
  }
}

// ──────────────────────────────────────────────
//  Helper to retrieve validated params in handlers
// ──────────────────────────────────────────────

/**
 * Retrieve a previously validated param from middleware.
 *
 * @example
 *   const id = getValidatedParam<number>(c, 'id')
 */
export function getValidatedParam<T = unknown>(c: Context, name: string): T {
  const params = (c.get('validatedParams') as Record<string, unknown>) || {}
  return params[name] as T
}
