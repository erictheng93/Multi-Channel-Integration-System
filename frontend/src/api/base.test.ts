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
      { redirectOnUnauthorized: false },
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
      }),
    )
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
      }),
    )
  })
})
