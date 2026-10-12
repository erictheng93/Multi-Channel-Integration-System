import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

const store = {
  sessionStatus: 'ready',
  isAuthenticated: true,
  isAdmin: false,
  initializeSession: vi.fn(),
}

vi.mock('@/stores/auth', () => ({ useAuthStore: () => store }))
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

import { combinedAuthGuard, authCacheCanAdmit } from './authGuard'

function route(meta: Record<string, unknown>): RouteLocationNormalized {
  return { path: '/x', meta } as unknown as RouteLocationNormalized
}

describe('combinedAuthGuard: role gate', () => {
  beforeEach(() => {
    store.sessionStatus = 'ready'
    store.isAuthenticated = true
    store.isAdmin = false
  })

  it('sends a non-admin away from a route declared requiresAdmin', async () => {
    const next = vi.fn()
    await combinedAuthGuard(route({ requiresAuth: true, requiresAdmin: true }), route({}), next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith('/dashboard')
  })

  it('lets an admin through', async () => {
    store.isAdmin = true
    const next = vi.fn()
    await combinedAuthGuard(route({ requiresAuth: true, requiresAdmin: true }), route({}), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('lets a non-admin open an ordinary authenticated route', async () => {
    const next = vi.fn()
    await combinedAuthGuard(route({ requiresAuth: true }), route({}), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('still sends a logged-out visitor to the login page first', async () => {
    store.isAuthenticated = false
    const next = vi.fn()
    await combinedAuthGuard(route({ requiresAuth: true, requiresAdmin: true }), route({}), next)
    expect(next).toHaveBeenCalledWith('/login')
  })
})

describe('authCacheCanAdmit', () => {
  const fresh = { isAuthenticated: true, requiresAuth: true }

  it('admits an ordinary authenticated route from the cache', () => {
    expect(authCacheCanAdmit(fresh, { requiresAuth: true })).toBe(true)
  })

  it('never admits an admin route from the cache: the cache does not know the role', () => {
    expect(authCacheCanAdmit(fresh, { requiresAuth: true, requiresAdmin: true })).toBe(false)
  })

  it('does not admit when the cached state was not authenticated', () => {
    expect(authCacheCanAdmit({ isAuthenticated: false, requiresAuth: true }, {})).toBe(false)
  })
})
