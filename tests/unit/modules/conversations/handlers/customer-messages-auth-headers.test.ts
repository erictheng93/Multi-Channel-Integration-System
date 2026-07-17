import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mocks = vi.hoisted(() => ({
  capturedRequest: undefined as Request | undefined,
  verifyConversationAccess: vi.fn()
}))

vi.mock('@/modules/customer-conversations/utils/conversation-auth', () => ({
  verifyConversationAccess: mocks.verifyConversationAccess
}))

import customerMessagesHandler from '@/modules/customer-conversations/handlers/customer-messages'

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = {
      CUSTOMER_MESSAGE_DO: {
        idFromName: vi.fn(() => ({ name: 'conversation-conv-1' })),
        get: vi.fn(() => ({
          fetch: vi.fn(async (request: Request) => {
            mocks.capturedRequest = request
            return Response.json({ success: true })
          })
        }))
      }
    } as unknown as Bindings
    await next()
  })
  app.route('/customer-conversations', customerMessagesHandler)
  return app
}

describe('customer message authenticated header forwarding', () => {
  beforeEach(() => {
    mocks.capturedRequest = undefined
    mocks.verifyConversationAccess.mockReset()
    mocks.verifyConversationAccess.mockResolvedValue({
      payload: {
        userId: 'agent-1',
        role: 'agent'
      },
      conversation: {
        id: 'conv-1',
        customerId: 'customer-1',
        assignedTeamId: null
      }
    })
  })

  it('strips client supplied authenticated display name when the token has none', async () => {
    const response = await createApp().request('/customer-conversations/conv-1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': 'valid-token',
        'X-Authenticated-User-Id': 'attacker-user',
        'X-Authenticated-Display-Name': 'Spoofed Sender'
      },
      body: JSON.stringify({ content: 'hello' })
    })

    expect(response.status).toBe(200)
    expect(mocks.capturedRequest).toBeDefined()
    expect(mocks.capturedRequest?.headers.get('X-Authenticated-User-Id')).toBe('agent-1')
    expect(mocks.capturedRequest?.headers.get('X-Authenticated-Display-Name')).toBeNull()
  })

  it('forwards only the validated token display name', async () => {
    mocks.verifyConversationAccess.mockResolvedValueOnce({
      payload: {
        userId: 'agent-1',
        role: 'agent',
        displayName: 'Agent One'
      },
      conversation: {
        id: 'conv-1',
        customerId: 'customer-1',
        assignedTeamId: null
      }
    })

    const response = await createApp().request('/customer-conversations/conv-1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': 'valid-token',
        'X-Authenticated-Display-Name': 'Spoofed Sender'
      },
      body: JSON.stringify({ content: 'hello' })
    })

    expect(response.status).toBe(200)
    expect(mocks.capturedRequest?.headers.get('X-Authenticated-Display-Name')).toBe('Agent%20One')
  })
})
