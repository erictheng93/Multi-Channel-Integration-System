import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({
  DurableObject: class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState
    protected env: Env

    constructor(ctx: DurableObjectState, env: Env) {
      this.ctx = ctx
      this.env = env
    }
  }
}))

import { CustomerConversationDO } from '@/durable-objects/CustomerConversationDO'
import type { Bindings } from '@/types'

interface MockSocket {
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  accept: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  serializeAttachment: ReturnType<typeof vi.fn>
  deserializeAttachment: ReturnType<typeof vi.fn>
  readyState: number
}

function createSocket(attachment: unknown = null): MockSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
    accept: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    serializeAttachment: vi.fn(),
    deserializeAttachment: vi.fn(() => attachment),
    readyState: 1
  }
}

function createState(sockets: MockSocket[] = []): DurableObjectState {
  return {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn(() => sockets),
    setWebSocketAutoResponse: vi.fn(),
    storage: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      getAlarm: vi.fn(),
      setAlarm: vi.fn()
    }
  } as unknown as DurableObjectState
}

function createEnv(): Bindings {
  return {
    SESSIONS: {
      get: vi.fn()
    }
  } as unknown as Bindings
}

describe('CustomerConversationDO hibernation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'WebSocket', {
      value: { OPEN: 1 },
      configurable: true
    })
  })

  it('accepts validated connections with the hibernation API and stores connection attachment', async () => {
    const client = createSocket()
    const server = createSocket()
    const state = createState()

    Object.defineProperty(globalThis, 'WebSocketPair', {
      value: class WebSocketPair {
        0 = client
        1 = server
      },
      configurable: true
    })

    const durableObject = new CustomerConversationDO(state, createEnv())

    await durableObject.clientConnectedValidated(
      'agent-1',
      'agent',
      'Agent One',
      'conversation-1'
    ).catch(error => {
      if (!(error instanceof RangeError)) {
        throw error
      }
    })

    expect(state.acceptWebSocket).toHaveBeenCalledWith(server, ['agent-1', 'conversation-1'])
    expect(server.accept).not.toHaveBeenCalled()
    expect(server.serializeAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'agent-1',
        displayName: 'Agent One',
        role: 'agent',
        conversationId: 'conversation-1'
      })
    )
    expect(server.addEventListener).not.toHaveBeenCalled()
  })

  it('broadcasts new messages to hibernated sockets restored from attachments', async () => {
    const socket = createSocket({
      connectionId: 'connection-1',
      userId: 'agent-1',
      displayName: 'Agent One',
      role: 'agent',
      conversationId: 'conversation-1',
      connectedAt: 1000
    })
    const state = createState([socket])
    const durableObject = new CustomerConversationDO(state, createEnv())

    await durableObject.notifyNewMessage('conversation-1', {
      id: 'message-1',
      content: 'hello',
      messageType: 'text',
      senderType: 'customer',
      senderId: 'line-user-1',
      platform: 'line'
    })

    expect(socket.send).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(socket.send.mock.calls[0][0] as string) as {
      type: string
      conversationId: string
      data: { content: string }
    }
    expect(payload.type).toBe('new_message')
    expect(payload.conversationId).toBe('conversation-1')
    expect(payload.data.content).toBe('hello')
  })
})
