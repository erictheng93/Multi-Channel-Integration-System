// The Worker -> CustomerMessageDO X-Authenticated-* headers are a trusted channel: the proxy must
// forward only values derived from the validated token, never client-supplied ones.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({ payload: { userId: 'agent-1', displayName: undefined as string | undefined } }))
vi.mock('@/modules/customer-conversations/utils/conversation-auth', () => ({
  verifyConversationAccess: vi.fn(async () => access)
}))

import customerMessages from '@/modules/customer-conversations/handlers/customer-messages'

function setup() {
  const forwarded: Request[] = []
  const env = {
    CUSTOMER_MESSAGE_DO: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: async (req: Request) => { forwarded.push(req); return new Response('{}') } })
    }
  }
  return { forwarded, env }
}

const forged = {
  Authorization: 'Bearer session-token',
  'X-Authenticated-User-Id': 'victim',
  'X-Authenticated-Display-Name': 'Forged%20Name'
}

describe('customer-messages proxy trusted headers', () => {
  beforeEach(() => { access.payload = { userId: 'agent-1', displayName: undefined } })

  it.each([
    ['/conv-1/messages', 'GET'],
    ['/conv-1/messages', 'POST'],
    // /upload forwards a streamed body, which Node's Request rejects without `duplex`
    // (workerd does not), so it cannot run here; it shares the same header code.
  ])('%s (%s) replaces forged identity headers and drops a forged display name', async (path, method) => {
    const { forwarded, env } = setup()
    const res = await customerMessages.request(path, {
      method, headers: forged, body: method === 'POST' ? '{}' : undefined
    }, env as never)

    expect(res.status).toBe(200)
    expect(forwarded).toHaveLength(1)
    expect(forwarded[0].headers.get('X-Authenticated-User-Id')).toBe('agent-1')
    expect(forwarded[0].headers.get('X-Authenticated-Display-Name')).toBeNull()
  })

  it('forwards the validated display name URL-encoded', async () => {
    access.payload = { userId: 'agent-1', displayName: '邱建維' }
    const { forwarded, env } = setup()
    await customerMessages.request('/conv-1/messages', { headers: forged }, env as never)

    expect(forwarded[0].headers.get('X-Authenticated-Display-Name')).toBe(encodeURIComponent('邱建維'))
  })
})
