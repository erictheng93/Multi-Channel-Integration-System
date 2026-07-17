import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'
import phase2AuthHandler from '@/modules/auth/handlers/phase2-auth-management'
import fileProxyHandler from '@/modules/file-management/handlers/file-proxy'
import collaborationMainHandler from '@/modules/collaboration/handlers/collaboration-main'
import { routeGroups } from '@/core/route-config'
import { validateAccessTokenPayload } from '@/middleware/auth'
import { signJWT, generateSystemToken, generateMonitoringToken } from '@/utils/auth'

function appFor(handler: Hono<{ Bindings: Bindings }>) {
  const app = new Hono<{ Bindings: Bindings }>()
  app.route('/', handler)
  return app
}

describe('security audit regressions', () => {
  it('requires auth before phase2 token refresh can mint replacement tokens', async () => {
    const response = await appFor(phase2AuthHandler).request('/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'header.payload.signature' }),
      headers: { 'Content-Type': 'application/json' }
    })

    expect(response.status).toBe(401)
  })

  it('requires auth before proxying LINE media with the server channel token', async () => {
    const response = await appFor(fileProxyHandler).request('/line-proxy/1234567890')

    expect(response.status).toBe(401)
  })

  it('requires auth before returning collaboration conversation state', async () => {
    const response = await appFor(collaborationMainHandler).request('/conversations/1/state')

    expect(response.status).toBe(401)
  })

  it('does not publicly mount the modular-system admin router via route config', () => {
    const moduleNames = routeGroups.flatMap(group => group.modules.map(module => module.name))

    expect(moduleNames).not.toContain('modular-system')
  })

  // CustomerMessageDO must trust only the X-Authenticated-User-Id /
  // X-Authenticated-Display-Name headers injected by the Worker-side
  // customer-messages.ts handler after full token validation. It must never
  // regress to decoding the session JWT payload itself inside the DO, where
  // the signature is not verified.
  it('CustomerMessageDO trusts upstream-authenticated headers instead of decoding the session token itself', () => {
    const source = readFileSync('src/durable-objects/CustomerMessageDO.ts', 'utf8')

    expect(source).toContain("c.req.header('X-Authenticated-User-Id')")
    expect(source).not.toContain('decodeJwtPayloadSegment')
    expect(source).not.toContain('JSON.parse(atob')
  })

  // Access-token class must be an allowlist, not a blocklist. A blocklist of
  // known-bad classes (refresh / temp_password_change) let untyped tokens —
  // e.g. system tokens minted without type/jti — authenticate everywhere with
  // no revocation path.
  describe('access-token class allowlist', () => {
    const SECRET = 'audit-regression-test-secret'
    const envWith = (cacheGet: () => Promise<string | null>) =>
      ({ JWT_SECRET: SECRET, CACHE: { get: cacheGet } }) as unknown as Bindings
    const baseClaims = {
      userId: 'agent-1',
      displayName: 'Agent One',
      role: 'agent' as const
    }

    it('rejects tokens minted without a type claim', async () => {
      const token = await signJWT({ ...baseClaims, jti: crypto.randomUUID() }, SECRET)

      await expect(validateAccessTokenPayload(envWith(async () => null), token))
        .rejects.toMatchObject({ status: 401, code: 'TOKEN_CLASS_NOT_ALLOWED' })
    })

    it('rejects access tokens minted without a jti', async () => {
      const token = await signJWT({ ...baseClaims, type: 'access' }, SECRET)

      await expect(validateAccessTokenPayload(envWith(async () => null), token))
        .rejects.toMatchObject({ status: 401, code: 'TOKEN_JTI_REQUIRED' })
    })

    it('rejects refresh tokens used as access tokens', async () => {
      const token = await signJWT({ ...baseClaims, type: 'refresh', jti: crypto.randomUUID() }, SECRET)

      await expect(validateAccessTokenPayload(envWith(async () => null), token))
        .rejects.toMatchObject({ status: 401, code: 'REFRESH_TOKEN_NOT_ALLOWED' })
    })

    it('accepts non-revoked access tokens carrying a jti', async () => {
      const jti = crypto.randomUUID()
      const token = await signJWT({ ...baseClaims, type: 'access', jti }, SECRET)

      const payload = await validateAccessTokenPayload(envWith(async () => null), token)

      expect(payload.jti).toBe(jti)
      expect(payload.type).toBe('access')
    })

    it('rejects revoked access tokens', async () => {
      const token = await signJWT({ ...baseClaims, type: 'access', jti: crypto.randomUUID() }, SECRET)

      await expect(validateAccessTokenPayload(envWith(async () => 'revoked'), token))
        .rejects.toMatchObject({ status: 401, code: 'TOKEN_REVOKED' })
    })

    it('mints system and monitoring tokens that satisfy the allowlist and are revocable', async () => {
      const decode = (jwt: string) => JSON.parse(
        Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
      )

      const systemToken = decode(await generateSystemToken('agent-1', 'agent', 'Agent One', 1, SECRET))
      expect(systemToken.type).toBe('access')
      expect(systemToken.jti).toBeTruthy()

      const monitoringToken = decode(await generateMonitoringToken(SECRET))
      expect(monitoringToken.type).toBe('access')
      expect(monitoringToken.jti).toBeTruthy()
    })
  })

  // The Worker→DO X-Authenticated-* headers are a trusted channel: the proxy
  // handler must strip any client-supplied values before injecting its own,
  // otherwise a request header can pass through as the sender label.
  it('customer-messages proxy strips inbound X-Authenticated-* headers before forwarding to the DO', () => {
    const source = readFileSync('src/modules/customer-conversations/handlers/customer-messages.ts', 'utf8')

    const deletes = source.match(/headers\.delete\('X-Authenticated-User-Id'\)/g) ?? []
    const displayNameDeletes = source.match(/headers\.delete\('X-Authenticated-Display-Name'\)/g) ?? []

    // Both proxy points (messages + upload) must strip before set.
    expect(deletes.length).toBeGreaterThanOrEqual(2)
    expect(displayNameDeletes.length).toBeGreaterThanOrEqual(2)
    expect(source.indexOf("headers.delete('X-Authenticated-User-Id')"))
      .toBeLessThan(source.indexOf("headers.set('X-Authenticated-User-Id'"))
  })
})
