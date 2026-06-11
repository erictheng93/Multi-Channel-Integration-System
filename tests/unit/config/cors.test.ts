import { describe, expect, it } from 'vitest'
import { createCorsPreflightResponse } from '@/config/cors'

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
