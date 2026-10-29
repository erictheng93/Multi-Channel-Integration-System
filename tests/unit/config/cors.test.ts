import { describe, expect, it } from 'vitest'
import { createCorsPreflightResponse, isOriginAllowed } from '@/config/cors'

describe('CORS configuration', () => {
  it('allows CSRF headers for credentialed cross-origin unsafe requests', () => {
    const response = createCorsPreflightResponse('https://mcis.daiwandist.com', {
      ENVIRONMENT: 'production',
      FRONTEND_URL: 'https://mcis.daiwandist.com',
      BACKEND_URL: 'https://mcis-backend.daiwandist.com',
    } as any)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Headers'))
      .toContain('X-CSRF-Token')
  })
})

describe('CORS Pages preview origins', () => {
  const env = { ENVIRONMENT: 'production', FRONTEND_URL: 'https://mcis.daiwandist.com' } as never

  it('allows the production frontend and previews of our Pages project', () => {
    expect(isOriginAllowed('https://mcis.daiwandist.com', env)).toBe(true)
    expect(isOriginAllowed('https://abc123def.mcis-ey7.pages.dev', env)).toBe(true)
  })

  it.each([
    'https://abc123.evil.pages.dev',
    'https://abc123.mcis.pages.dev',
    'https://abc123.mcis-ey7.pages.dev.evil.com',
    'https://evil.com/.mcis-ey7.pages.dev',
    'https://abc123.xmcis-ey7.pages.dev',
    'https://nothex.mcis-ey7.pages.dev',
    'http://abc123.mcis-ey7.pages.dev',
  ])('rejects %s', (origin) => {
    expect(isOriginAllowed(origin, env)).toBe(false)
  })
})
