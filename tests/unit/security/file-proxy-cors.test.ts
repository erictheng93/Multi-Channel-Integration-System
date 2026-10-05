import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mockR2Get = vi.fn()
const mockDbGet = vi.fn()
const mockConversationAccess = vi.fn()

vi.mock('@/services/conversation-access', () => ({
  canConversationBeAccessedBy: (...args: unknown[]) => mockConversationAccess(...args)
}))

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
        where: vi.fn(() => ({ get: mockDbGet })),
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
      id: 'message-1',
      conversationId: 'conversation-1',
      r2Key: 'line/1234567890.jpg',
      mimeType: 'image/jpeg',
      fileUrl: '/api/files/public/line/1234567890.jpg'
    })
    mockConversationAccess.mockResolvedValue({ allowed: true })
    mockR2Get.mockResolvedValue({
      body: 'image',
      size: 5,
      httpMetadata: { contentType: 'image/jpeg' }
    })
  })

  it('hides LINE media from an agent outside the conversation', async () => {
    mockConversationAccess.mockResolvedValue({ allowed: false })
    const response = await createApp().request('/line-proxy/1234567890')
    expect(response.status).toBe(404)
    expect(mockR2Get).not.toHaveBeenCalled()
  })

  it('does not call LINE when the local message is missing', async () => {
    mockDbGet.mockResolvedValue(undefined)
    const upstream = vi.spyOn(globalThis, 'fetch')
    try {
      const response = await createApp().request('/line-proxy/1234567890')
      expect(response.status).toBe(404)
      expect(mockR2Get).not.toHaveBeenCalled()
      expect(upstream).not.toHaveBeenCalled()
    } finally {
      upstream.mockRestore()
    }
  })

  it('does not reflect disallowed origins on cookie-authenticated LINE media responses', async () => {
    const response = await createApp().request('/line-proxy/1234567890', {
      headers: {
        Origin: 'https://evil.example',
        Cookie: 'mcis_access=access-token'
      }
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
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
