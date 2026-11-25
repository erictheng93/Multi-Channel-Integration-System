// Response envelope contract of src/utils/api-response.ts, which most handlers use.
// Each case runs the helper inside a real Hono route so status codes and JSON bodies
// are exactly what a client receives.

import { describe, it, expect, vi } from 'vitest'
import { Hono, type Context } from 'hono'
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
  badRequestResponse,
  handleApiError
} from '@/utils/api-response'

async function respond(build: (c: Context) => Response): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = new Hono()
  app.get('/', c => build(c))
  const res = await app.request('/')
  return { status: res.status, body: await res.json() as Record<string, unknown> }
}

describe('api-response envelope', () => {
  it('successResponse wraps data with success, message, timestamp and requestId', async () => {
    const { status, body } = await respond(c => successResponse(c, { id: 1 }, 'ok'))

    expect(status).toBe(200)
    expect(body).toMatchObject({ success: true, data: { id: 1 }, message: 'ok' })
    expect(typeof body.timestamp).toBe('string')
    expect(body.requestId).toMatch(/^req_\d+_[a-z0-9]+$/)
  })

  it('successResponse honours an explicit status', async () => {
    const { status } = await respond(c => successResponse(c, null, 'created', 201))
    expect(status).toBe(201)
  })

  it('paginatedResponse nests items and derives totalPages / hasNext / hasPrev', async () => {
    const first = await respond(c => paginatedResponse(c, [{ id: 1 }], { page: 1, limit: 20, total: 41 }))
    expect(first.body.data).toMatchObject({
      items: [{ id: 1 }], page: 1, limit: 20, pageSize: 20, total: 41,
      totalPages: 3, hasNext: true, hasPrev: false
    })

    const last = await respond(c => paginatedResponse(c, [], { page: 3, limit: 20, total: 41 }))
    expect(last.body.data).toMatchObject({ totalPages: 3, hasNext: false, hasPrev: true })
  })

  it('errorResponse with a string uses INTERNAL_ERROR code and the given status', async () => {
    const { status, body } = await respond(c => errorResponse(c, 'boom', 409))

    expect(status).toBe(409)
    expect(body).toMatchObject({ success: false, error: 'boom', code: 'INTERNAL_ERROR' })
    expect(body.requestId).toMatch(/^req_/)
  })

  it('validationErrorResponse returns 422 with the field errors', async () => {
    const errors = [{ field: 'email', message: 'Email is required' }]
    const { status, body } = await respond(c => validationErrorResponse(c, errors))

    expect(status).toBe(422)
    expect(body).toMatchObject({ success: false, error: 'Validation failed', data: { code: 'VALIDATION_ERROR', errors } })
  })

  it.each([
    ['unauthorizedResponse', (c: Context) => unauthorizedResponse(c, 'no session'), 401, 'no session', 'UNAUTHORIZED'],
    ['forbiddenResponse', (c: Context) => forbiddenResponse(c, 'other team'), 403, 'other team', 'FORBIDDEN'],
    ['notFoundResponse', (c: Context) => notFoundResponse(c, 'User'), 404, 'User not found', 'NOT_FOUND'],
    ['internalErrorResponse', (c: Context) => internalErrorResponse(c, 'db down'), 500, 'db down', 'INTERNAL_ERROR'],
    ['badRequestResponse', (c: Context) => badRequestResponse(c, 'bad id'), 400, 'bad id', 'VALIDATION_ERROR']
  ])('%s maps to its status and code', async (_name, build, expectedStatus, expectedError, expectedCode) => {
    const { status, body } = await respond(build)

    expect(status).toBe(expectedStatus)
    expect(body).toMatchObject({ success: false, error: expectedError, code: expectedCode })
  })
})

describe('handleApiError', () => {
  const named = (name: string, message: string, extra: Record<string, unknown> = {}) =>
    Object.assign(new Error(message), { name }, extra)

  it.each([
    ['ValidationError', 422],
    ['UnauthorizedError', 401],
    ['ForbiddenError', 403],
    ['NotFoundError', 404]
  ])('maps %s to %i', async (name, expectedStatus) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { status, body } = await respond(c => handleApiError(named(name, 'x', { errors: [] }), c))

    expect(status).toBe(expectedStatus)
    expect(body.success).toBe(false)
  })

  it('passes ValidationError field errors through', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const errors = [{ field: 'email', message: 'Invalid email' }]
    const { body } = await respond(c => handleApiError(named('ValidationError', 'Validation failed', { errors }), c))

    expect(body.data).toMatchObject({ code: 'VALIDATION_ERROR', errors })
  })

  it('falls back to 500 for unknown errors and non-Error values', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const plain = await respond(c => handleApiError(new Error('unexpected'), c))
    expect(plain.status).toBe(500)
    expect(plain.body).toMatchObject({ code: 'INTERNAL_ERROR' })

    const thrownString = await respond(c => handleApiError('oops', c))
    expect(thrownString.status).toBe(500)
    expect(thrownString.body.error).toBe('Internal server error')
  })
})
