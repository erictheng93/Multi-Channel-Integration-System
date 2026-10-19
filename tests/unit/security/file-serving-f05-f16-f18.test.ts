import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mockDbGet = vi.fn()
const mockAccess = vi.fn()
const mockR2Get = vi.fn()

vi.mock('@/services/conversation-access', () => ({
  canConversationBeAccessedBy: (...a: unknown[]) => mockAccess(...a)
}))
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ get: mockDbGet })) })) }))
  }))
}))
vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}))
vi.mock('@/middleware/auth', () => ({ jwtAuth: vi.fn(async (_c: unknown, n: () => Promise<void>) => n()) }))

import { signFileUrl, verifyFileSignature } from '@/utils/file-signed-url'
import { inertFileHeaders, normalizeStoredContentType } from '@/utils/file-url'
import { canDeleteFile, checkConversationBinding } from '@/modules/file-management/middleware/file-auth'
import { getAllowedOrigins } from '@/config/cors'
import fileProxyHandler from '@/modules/file-management/handlers/file-proxy'

const SECRET = 'test-secret'

describe('F05 signature purpose binding', () => {
  it('public signature does not validate on r2-public (and vice versa)', async () => {
    const pub = await signFileUrl('a/b.html', SECRET, 60, 'public')
    expect(await verifyFileSignature('a/b.html', pub.sig, String(pub.exp), SECRET, 'public')).toBe(true)
    expect(await verifyFileSignature('a/b.html', pub.sig, String(pub.exp), SECRET, 'r2-public')).toBe(false)
    expect(await verifyFileSignature('a/b.html', pub.sig, String(pub.exp), SECRET, 'download')).toBe(false)
    const r2 = await signFileUrl('a/b.html', SECRET, 60, 'r2-public')
    expect(await verifyFileSignature('a/b.html', r2.sig, String(r2.exp), SECRET, 'public')).toBe(false)
  })

  it('legacy v1 signatures still work on public/download but never on r2-public', async () => {
    const exp = Math.floor(Date.now() / 1000) + 60
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const raw = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`file-url-v1|k/f.png|${exp}`))
    const sig = btoa(String.fromCharCode(...new Uint8Array(raw))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    expect(await verifyFileSignature('k/f.png', sig, String(exp), SECRET, 'public')).toBe(true)
    expect(await verifyFileSignature('k/f.png', sig, String(exp), SECRET, 'download')).toBe(true)
    expect(await verifyFileSignature('k/f.png', sig, String(exp), SECRET, 'r2-public')).toBe(false)
  })

  it('inert headers force attachment + nosniff + sandbox CSP for html/svg', () => {
    for (const t of ['text/html', 'image/svg+xml', 'application/xml', undefined]) {
      const h = inertFileHeaders(t, 'x.html', 'inline; filename="x.html"')
      expect(h['Content-Disposition']).toMatch(/^attachment/)
      expect(h['X-Content-Type-Options']).toBe('nosniff')
      expect(h['Content-Security-Policy']).toContain('sandbox')
    }
    expect(inertFileHeaders('image/png', 'x.png', 'inline; filename="x.png"')['Content-Disposition']).toMatch(/^inline/)
  })

  it('/api/files/public serves stored html as attachment with CSP', async () => {
    mockR2Get.mockResolvedValue({
      body: 'x', size: 1,
      httpMetadata: { contentType: 'text/html', contentDisposition: 'inline; filename="a.html"' }
    })
    const { sig, exp } = await signFileUrl('media/a.html', SECRET, 60, 'public')
    const app = new Hono<{ Bindings: Bindings }>()
    app.use('*', async (c, next) => { c.env = { JWT_SECRET: SECRET, R2_BUCKET: { get: mockR2Get } } as unknown as Bindings; await next() })
    app.route('/api/files', fileProxyHandler)
    const res = await app.request(`/api/files/public/media/a.html?sig=${sig}&exp=${exp}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment/)
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Content-Security-Policy')).toContain('sandbox')
  })
})

describe('NV4/NV2', () => {
  it('normalizes content types to the safe allowlist', () => {
    expect(normalizeStoredContentType('text/html; charset=utf-8')).toBe('application/octet-stream')
    expect(normalizeStoredContentType('image/svg+xml')).toBe('application/octet-stream')
    expect(normalizeStoredContentType('image/png')).toBe('image/png')
  })
  it('storage origin is not a credentialed CORS origin', () => {
    const env = { ENVIRONMENT: 'production', FRONTEND_URL: 'https://app.example', STORAGE_PUBLIC_URL: 'https://s3.example' } as never
    const origins = getAllowedOrigins(env)
    expect(origins).toContain('https://app.example')
    expect(origins).not.toContain('https://s3.example')
  })
})

type Ctx = Parameters<typeof canDeleteFile>[0]
function ctx(user: Record<string, unknown>): Ctx {
  return {
    get: () => user,
    env: { DB: {} },
    json: (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s })
  } as unknown as Ctx
}

describe('F16 / F18', () => {
  beforeEach(() => { mockDbGet.mockReset(); mockAccess.mockReset() })

  it('foreign agent cannot delete another agent\'s file', async () => {
    mockDbGet.mockResolvedValue({ uploadedBy: 'other', conversationId: 'c2', messageId: null })
    mockAccess.mockResolvedValue({ allowed: false })
    expect(await canDeleteFile(ctx({ id: 'a1', role: 'agent', allowedTeamIds: [1] }), 'f1')).toBe('forbidden')
  })
  it('uploader, admin and same-conversation agent may delete', async () => {
    mockDbGet.mockResolvedValue({ uploadedBy: 'a1', conversationId: null, messageId: null })
    expect(await canDeleteFile(ctx({ id: 'a1', role: 'agent' }), 'f1')).toBe('ok')
    mockDbGet.mockResolvedValue({ uploadedBy: 'x', conversationId: null, messageId: null })
    expect(await canDeleteFile(ctx({ id: 'adm', role: 'admin' }), 'f1')).toBe('ok')
    mockDbGet.mockResolvedValue({ uploadedBy: null, conversationId: 'c1', messageId: null })
    mockAccess.mockResolvedValue({ allowed: true })
    expect(await canDeleteFile(ctx({ id: 'a2', role: 'agent', allowedTeamIds: [1] }), 'f1')).toBe('ok')
  })
  it('unbound foreign-uploaded file is not deletable by a non-admin; missing -> not_found', async () => {
    mockDbGet.mockResolvedValue({ uploadedBy: null, conversationId: null, messageId: null })
    expect(await canDeleteFile(ctx({ id: 'a2', role: 'agent' }), 'f1')).toBe('forbidden')
    mockDbGet.mockResolvedValue(undefined)
    expect(await canDeleteFile(ctx({ id: 'a2', role: 'agent' }), 'f1')).toBe('not_found')
  })
  it('upload bound to a foreign conversation is 403; own/unassigned passes', async () => {
    mockAccess.mockResolvedValue({ allowed: false })
    const res = await checkConversationBinding(ctx({ id: 'a1', role: 'agent', allowedTeamIds: [1] }), { conversationId: 'c2' })
    expect(res?.status).toBe(403)
    mockAccess.mockResolvedValue({ allowed: true })
    expect(await checkConversationBinding(ctx({ id: 'a1', role: 'agent' }), { conversationId: 'c1' })).toBeNull()
  })
})
