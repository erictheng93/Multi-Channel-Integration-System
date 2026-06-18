import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiClient } from './base'

/**
 * Regression tests for the "logged out while navigating" bug.
 *
 * Root cause (verified in prod logs): /auth/refresh fails ~27% of the time
 * (transient D1 500s + genuine 401s), and the client used to treat ANY
 * non-ok refresh as a dead session -> hard redirect to /login.
 *
 * Correct behaviour:
 *  - genuine auth failure (401/403 on refresh) -> redirect to /login
 *  - transient failure (5xx / 429 / network) -> keep the session, do NOT redirect
 */
describe('apiClient refresh resilience', () => {
  let hrefSetTo: string

  beforeEach(() => {
    vi.clearAllMocks()
    hrefSetTo = ''
    // Capture redirect attempts without triggering jsdom navigation.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        get href() {
          return hrefSetTo
        },
        set href(value: string) {
          hrefSetTo = value
        },
      },
    })
    // Reset singleton guards between tests (private fields).
    ;(apiClient as unknown as { isRedirecting: boolean }).isRedirecting = false
    ;(apiClient as unknown as { isRefreshing: boolean }).isRefreshing = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function jsonResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Response
  }

  it('does NOT redirect to /login when the refresh call fails transiently (500)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      // 1) original request -> access token expired
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      // 2) /auth/refresh -> transient server error (e.g. D1 Failed query)
      .mockResolvedValue(jsonResponse(500, { error: 'INTERNAL_SERVER_ERROR' }))

    const result = await apiClient.get('/conversations')

    expect(fetchMock).toHaveBeenCalled()
    // Session preserved: no hard redirect to the login page.
    expect(hrefSetTo).not.toBe('/login')
    expect(result.success).toBe(false)
  })

  it('does NOT redirect to /login when the refresh call hits the network and throws', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockRejectedValue(new Error('network down'))

    const result = await apiClient.get('/conversations')

    expect(hrefSetTo).not.toBe('/login')
    expect(result.success).toBe(false)
  })

  it('DOES redirect to /login when the refresh is genuinely rejected (401)', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValue(jsonResponse(401, { success: false, error: 'Invalid refresh token' }))

    await apiClient.get('/conversations')

    expect(hrefSetTo).toBe('/login')
  })
})
