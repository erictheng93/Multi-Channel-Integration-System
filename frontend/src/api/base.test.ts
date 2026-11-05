import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiClient } from './base'

describe('API Base Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.removeAuthHeader()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.cookie = 'mcis_csrf=; Max-Age=0; Path=/'
  })

  it('should exist and have required methods', () => {
    expect(apiClient).toBeDefined()
    expect(typeof apiClient.get).toBe('function')
    expect(typeof apiClient.post).toBe('function')
    expect(typeof apiClient.put).toBe('function')
    expect(typeof apiClient.delete).toBe('function')
  })

  it('should have auth header methods', () => {
    expect(typeof apiClient.setAuthHeader).toBe('function')
    expect(typeof apiClient.removeAuthHeader).toBe('function')
  })

  it('can return a 401 response without redirecting when requested', async () => {
    apiClient.setAuthHeader('expired-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: vi.fn().mockResolvedValue({ error: 'Current password is incorrect' }),
    } as unknown as Response)

    const result = await apiClient.post(
      '/auth/change-password',
      { currentPassword: 'wrong', newPassword: 'Password123!' },
      { redirectOnUnauthorized: false }
    )

    expect(fetchMock).toHaveBeenCalled()
    expect(result).toEqual({
      success: false,
      error: 'Current password is incorrect',
      status: 401,
    })
    expect(window.location.href).not.toBe('/login')
  })

  it('includes credentials for cookie-authenticated requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({ success: true, data: { ok: true } }),
    } as unknown as Response)

    await apiClient.get('/auth/me')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
      })
    )
  })

  it('preserves validation details and error codes on non-2xx responses', async () => {
    const data = { errors: [{ field: 'title', message: '請輸入標題' }] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          data,
        }),
        { status: 422 }
      )
    )
    expect(await apiClient.post('/broadcasts', {})).toEqual({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      data,
      status: 422,
    })
  })

  it('sends CSRF header from readable cookie on unsafe requests', async () => {
    document.cookie = 'mcis_csrf=csrf-token; Path=/'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({ success: true, data: { ok: true } }),
    } as unknown as Response)

    await apiClient.post('/auth/logout', {})

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'csrf-token',
        }),
      })
    )
  })

  describe('automatic retries', () => {
    const serverError = () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: vi.fn().mockResolvedValue({ error: 'unavailable' }),
    } as unknown as Response)

    beforeEach(() => {
      // Skip the 1s/2s/4s backoff
      vi.spyOn(apiClient as any, 'delay').mockResolvedValue(undefined)
    })

    it('does not resend a POST after the connection drops (it may already have been applied)', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
      const result = await apiClient.post('/broadcasts/b1/send')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({ success: false, status: 0 })
    })

    it('does not resend a POST after a 5xx', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(serverError())
      const result = await apiClient.post('/broadcasts/b1/send')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({ success: false, status: 503 })
    })

    it('still retries a GET after the connection drops, and recovers', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ success: true, data: { count: 3 } }) } as unknown as Response)
      const result = await apiClient.get('/notifications/unread-count')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toMatchObject({ success: true, data: { count: 3 } })
    })

    it('gives up on a GET after 3 retries', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(serverError())
      const result = await apiClient.get('/team/presence')
      expect(fetchMock).toHaveBeenCalledTimes(4)
      expect(result).toMatchObject({ success: false, status: 503 })
    })
  })
})
