import { beforeEach, describe, expect, it, vi } from 'vitest'

const createDOMonitor = vi.fn()
vi.mock('@/services/durable-objects-monitor', () => ({ createDOMonitor: (...a: unknown[]) => createDOMonitor(...a) }))
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (_c: unknown, next: () => Promise<void>) => next(),
  requireAdmin: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

import monitoringHandler from '@/modules/monitoring/handlers/monitoring-main'

/**
 * GET /api/monitoring/health is unauthenticated. It must never turn outside traffic
 * into Durable Object requests (it used to probe every room and user connection).
 */
describe('GET /api/monitoring/health (public)', () => {
  beforeEach(() => createDOMonitor.mockClear())

  it('answers from in-process state without creating a Durable Object monitor', async () => {
    const env = new Proxy({}, { get: () => { throw new Error('the public health check must not touch bindings') } })
    const res = await monitoringHandler.request('/health', {}, env as never)
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; components: { circuitBreaker: { status: string } } }
    expect(body.status).toBe('healthy')
    expect(body.components.circuitBreaker.status).toBeDefined()
    expect(createDOMonitor).not.toHaveBeenCalled()
  })
})
