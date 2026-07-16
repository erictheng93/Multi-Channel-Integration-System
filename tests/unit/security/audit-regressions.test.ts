import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'
import phase2AuthHandler from '@/modules/auth/handlers/phase2-auth-management'
import fileProxyHandler from '@/modules/file-management/handlers/file-proxy'
import collaborationMainHandler from '@/modules/collaboration/handlers/collaboration-main'
import { routeGroups } from '@/core/route-config'

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
})
