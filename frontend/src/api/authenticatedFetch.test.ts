import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyAuthenticatedXhrHeaders,
  authenticatedFetch,
  buildAuthenticatedHeaders
} from './authenticatedFetch'

describe('authenticatedFetch helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    document.cookie = 'mcis_csrf=; Max-Age=0; Path=/'
    vi.restoreAllMocks()
  })

  it('adds credentials and preserves existing headers without injecting bearer auth', async () => {
    window.sessionStorage.setItem('token', 'access-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as globalThis.Response)

    await authenticatedFetch('/api/example', {
      headers: {
        Accept: 'text/csv'
      }
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/example',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(globalThis.Headers)
      })
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as globalThis.Headers
    expect(headers.get('Accept')).toBe('text/csv')
    expect(headers.get('Authorization')).toBeNull()
  })

  it('adds CSRF header for unsafe methods when the readable cookie exists', () => {
    document.cookie = 'mcis_csrf=csrf-token; Path=/'

    const headers = buildAuthenticatedHeaders('POST')

    expect(headers.get('X-CSRF-Token')).toBe('csrf-token')
  })

  it('sets XHR credentials and CSRF headers', () => {
    window.sessionStorage.setItem('token', 'access-token')
    document.cookie = 'mcis_csrf=csrf-token; Path=/'
    const xhr = {
      withCredentials: false,
      setRequestHeader: vi.fn()
    } as unknown as globalThis.XMLHttpRequest

    applyAuthenticatedXhrHeaders(xhr, 'POST')

    expect(xhr.withCredentials).toBe(true)
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('x-csrf-token', 'csrf-token')
  })
})
