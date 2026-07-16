import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mockR2Get = vi.fn()
const mockDbGet = vi.fn()

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'agent-1', role: 'agent', isActive: true })
    c.set('jwtPayload', { userId: 'agent-1', role: 'agent', type: 'access' })
    await next()
  })
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            get: mockDbGet
          }))
        }))
      }))
    }))
  }))
}))

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

import fileProxyHandler from '@/modules/file-management/handlers/file-proxy'

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = {
      ENVIRONMENT: 'production',
      FRONTEND_URL: 'https://app.example',
      DB: {} as D1Database,
      R2_BUCKET: {
        get: mockR2Get
      }
    } as unknown as Bindings
    await next()
  })
  app.route('/', fileProxyHandler)
  return app
}

describe('file proxy CORS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbGet.mockResolvedValue({
      r2Key: 'line/1234567890.jpg',
      mimeType: 'image/jpeg',
      fileUrl: '/api/files/public/line/1234567890.jpg'
    })
    mockR2Get.mockResolvedValue({
      body: 'image',
      size: 5,
      httpMetadata: { contentType: 'image/jpeg' }
    })
  })

  it('does not reflect disallowed origins on cookie-authenticated LINE media responses', async () => {
    const response = await createApp().request('/line-proxy/1234567890', {
      headers: {
        Origin: 'https://evil.example',
        Cookie: 'mcis_access=access-token'
      }
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull()
  })

  it('allows configured origins on cookie-authenticated LINE media responses', async () => {
    const response = await createApp().request('/line-proxy/1234567890', {
      headers: {
        Origin: 'https://app.example',
        Cookie: 'mcis_access=access-token'
      }
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })
})
