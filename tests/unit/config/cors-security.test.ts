import { describe, expect, it } from 'vitest'
import { DEVELOPMENT_ORIGINS, getAllowedOrigins, isOriginAllowed } from '@/config/cors'
import { getSecurityConfig, getSecurityHeaders } from '@/config/security'
import { DEVELOPMENT_LOCALHOST_URLS } from '@/config/environment'
import { getCorsOrigins } from '@/utils/environment'

describe('CORS development origins', () => {
  it('allows the default Vite dev server on localhost:5173', () => {
    expect(DEVELOPMENT_ORIGINS).toContain('http://localhost:5173')
    expect(DEVELOPMENT_ORIGINS).toContain('http://127.0.0.1:5173')
    expect(getAllowedOrigins({ ENVIRONMENT: 'development' } as never)).toContain(
      'http://localhost:5173'
    )
    expect(isOriginAllowed('http://localhost:5173', { ENVIRONMENT: 'development' } as never)).toBe(
      true
    )
  })

  it('uses the shared development origin source across config modules', () => {
    const expected = [...DEVELOPMENT_ORIGINS]

    expect(getSecurityConfig('development').cors.allowedOrigins).toEqual(expected)
    expect([...DEVELOPMENT_LOCALHOST_URLS]).toEqual(expected)
    expect(getCorsOrigins({ ENVIRONMENT: 'development' })).toEqual(expected)
  })
})

describe('security headers', () => {
  it('uses modern XSS defenses instead of the deprecated browser XSS auditor', () => {
    const headers = getSecurityHeaders(getSecurityConfig('production'), true)

    expect(headers['X-XSS-Protection']).toBeUndefined()
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'")
    expect(headers['Content-Security-Policy']).toContain("base-uri 'self'")
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(headers['Content-Security-Policy']).toContain(
      "require-trusted-types-for 'script'"
    )
    expect(headers['Content-Security-Policy-Report-Only']).toBeUndefined()
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000')
  })
})
