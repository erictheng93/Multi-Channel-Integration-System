import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type * as BaseModule from '@/api/base'

// A new tab: sessionStorage (where the session marker lives) starts empty, while the
// HttpOnly cookie session is shared by the whole browser and may still be valid.

const me = vi.hoisted(() => vi.fn())
const refresh = vi.hoisted(() => vi.fn())

vi.mock('@/api/auth', () => ({
  authApi: { me, login: vi.fn(), logout: vi.fn(), setAuthHeader: vi.fn(), removeAuthHeader: vi.fn() },
}))

vi.mock('@/api/base', async (importOriginal) => {
  const actual = await importOriginal<typeof BaseModule>()
  actual.apiClient.refreshAuthToken = refresh
  return actual
})

const agent = { id: 'a1', email: 'a@example.com', name: 'Agent', role: 'admin', allowedTeamIds: [], teamRoles: {} }

async function freshTabStore() {
  sessionStorage.clear()
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/stores/auth')
  return useAuthStore()
}

describe('auth store: session restore in a new tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('restores the session from a valid cookie instead of logging out', async () => {
    me.mockResolvedValue({ success: true, data: agent })
    const store = await freshTabStore()

    await store.initializeSession()

    expect(me).toHaveBeenCalledWith({ redirectOnUnauthorized: false })
    expect(store.sessionStatus).toBe('authenticated')
    expect(store.isAuthenticated).toBe(true)
    // The marker is written, so later checks in this tab pass without another probe
    expect(Number(sessionStorage.getItem('sessionExpiry'))).toBeGreaterThan(Date.now())
    expect(JSON.parse(sessionStorage.getItem('currentAgent') ?? '{}').id).toBe('a1')
  })

  it('refreshes quietly when only the 2-hour access cookie has expired', async () => {
    me.mockResolvedValueOnce({ success: false, status: 401 })
      .mockResolvedValueOnce({ success: true, data: agent })
    refresh.mockResolvedValue('cookie-refreshed')
    const store = await freshTabStore()

    await store.initializeSession()

    expect(refresh).toHaveBeenCalledWith({ redirectOnFailure: false })
    expect(me).toHaveBeenCalledTimes(2)
    expect(store.sessionStatus).toBe('authenticated')
  })

  it('stays logged out, without a redirect, when there is no cookie session', async () => {
    me.mockResolvedValue({ success: false, status: 401 })
    refresh.mockResolvedValue(null)
    const store = await freshTabStore()

    await store.initializeSession()

    expect(refresh).toHaveBeenCalledWith({ redirectOnFailure: false })
    expect(store.sessionStatus).toBe('unauthenticated')
    expect(store.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem('sessionExpiry')).toBeNull()
  })

  it('shares one check between concurrent callers (main.ts and the router guard)', async () => {
    me.mockResolvedValue({ success: false, status: 401 })
    refresh.mockResolvedValue(null)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = await freshTabStore()

    await Promise.all([store.initializeSession(), store.initializeSession()])

    expect(me).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalledWith('Session initialization error:', expect.anything())
    expect(store.sessionStatus).toBe('unauthenticated')

    // Settled: a later call checks again instead of reusing the old result
    await store.initializeSession()
    expect(me).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })
})
