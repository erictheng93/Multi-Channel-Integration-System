import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationRoom } from '@/durable-objects/ConversationRoom'
import type { RealtimeEvent } from '@/types'

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
      setAlarm: vi.fn(),
      deleteAlarm: vi.fn()
    }
  } as unknown as DurableObjectState
}

function installWebSocketRequestResponsePair(): void {
  Object.defineProperty(globalThis, 'WebSocketRequestResponsePair', {
    value: class WebSocketRequestResponsePair {
      constructor(
        private readonly request: string,
        private readonly response: string
      ) {}

      getRequest(): string {
        return this.request
      }

      getResponse(): string {
        return this.response
      }
    },
    configurable: true
  })
}

function installWebSocketPair(client: MockSocket, server: MockSocket): void {
  Object.defineProperty(globalThis, 'WebSocketPair', {
    value: class WebSocketPair {
      0 = client
      1 = server
    },
    configurable: true
  })
}

describe('ConversationRoom hibernation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'WebSocket', {
      value: { OPEN: 1 },
      configurable: true
    })
    installWebSocketRequestResponsePair()
  })

  it('configures ping/pong auto-response for hibernated sockets', () => {
    const state = createState()

    new ConversationRoom(state, {}, { mode: 'simplified' })

    expect(state.setWebSocketAutoResponse).toHaveBeenCalledTimes(1)
    const pair = vi.mocked(state.setWebSocketAutoResponse).mock.calls[0][0] as {
      getRequest: () => string
      getResponse: () => string
    }
    expect(pair.getRequest()).toBe('ping')
    expect(pair.getResponse()).toBe('pong')
  })

  it('accepts WebSocket upgrades with hibernation API and connection attachment', async () => {
    const client = createSocket()
    const server = createSocket()
    const state = createState()
    installWebSocketPair(client, server)

    const durableObject = new ConversationRoom(state, {}, { mode: 'simplified' })
    await durableObject.fetch(
      new Request(
        'https://room/websocket?conversationId=conversation-1&userId=agent-1&role=agent&token=token&tokenExp=1893456000',
        { headers: { Upgrade: 'websocket', 'User-Agent': 'vitest' } }
      )
    ).catch(error => {
      if (!(error instanceof RangeError)) {
        throw error
      }
    })

    expect(state.acceptWebSocket).toHaveBeenCalledWith(server, ['agent-1', 'conversation-1'])
    expect(server.accept).not.toHaveBeenCalled()
    expect(server.addEventListener).not.toHaveBeenCalled()
    expect(server.serializeAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: expect.stringMatching(/^conn_/),
        userId: 'agent-1',
        role: 'agent',
        conversationId: 'conversation-1',
        tokenExp: 1893456000,
        connectedAt: expect.any(Number),
        lastActivity: expect.any(Number)
      })
    )
  })

  it('restores hibernated connections and participants from socket attachments', async () => {
    const socket = createSocket({
      connectionId: 'connection-1',
      userId: 'agent-1',
      role: 'agent',
      conversationId: 'conversation-1',
      connectedAt: 1000,
      lastActivity: 2000
    })
    const state = createState([socket])
    const durableObject = new ConversationRoom(state, {}, { mode: 'simplified' })

    const response = await durableObject.fetch(new Request('https://room/participants'))
    const body = await response.json() as { participants: string[]; activeConnections: number }

    expect(body.activeConnections).toBe(1)
    expect(body.participants).toEqual(['agent-1'])
  })

  it('refreshes hibernated participants for HTTP-only reads after construction', async () => {
    const socket = createSocket({
      connectionId: 'connection-1',
      userId: 'agent-1',
      role: 'agent',
      conversationId: 'conversation-1',
      connectedAt: 1000,
      lastActivity: 2000
    })
    const state = createState()
    const durableObject = new ConversationRoom(state, {}, { mode: 'simplified' })

    vi.mocked(state.getWebSockets).mockReturnValue([socket] as unknown as WebSocket[])

    const response = await durableObject.fetch(new Request('https://room/metrics'))
    const body = await response.json() as { activeConnections: number; participants: number }

    expect(body.activeConnections).toBe(1)
    expect(body.participants).toBe(1)
  })

  it('merges stored participants without dropping hibernated active participants', async () => {
    const socket = createSocket({
      connectionId: 'connection-1',
      userId: 'agent-active',
      role: 'agent',
      conversationId: 'conversation-1',
      connectedAt: 1000,
      lastActivity: 2000
    })
    const state = createState([socket])
    vi.mocked(state.storage.get).mockImplementation(async (key: string) => {
      if (key === 'participants') {
        return ['agent-stored']
      }
      return undefined
    })

    const durableObject = new ConversationRoom(state, {}, { mode: 'simplified' })
    await Promise.resolve()

    const response = await durableObject.fetch(new Request('https://room/participants'))
    const body = await response.json() as { participants: string[]; activeConnections: number }

    expect(body.activeConnections).toBe(1)
    expect(body.participants.sort()).toEqual(['agent-active', 'agent-stored'])
  })

  it('uses alarms to expire token sockets and flush dirty message history', async () => {
    const socket = createSocket({
      connectionId: 'connection-1',
      userId: 'agent-1',
      role: 'agent',
      conversationId: 'conversation-1',
      tokenExp: 1,
      connectedAt: 1000,
      lastActivity: 2000
    })
    const state = createState([socket])
    const durableObject = new ConversationRoom(state, {}, { mode: 'full' }) as ConversationRoom & {
      alarm: () => Promise<void>
      roomContext: {
        messageDirty: boolean
        messageHistory: RealtimeEvent[]
      }
    }
    durableObject.roomContext.messageDirty = true
    durableObject.roomContext.messageHistory = [{
      id: 'event-1',
      type: 'message_created',
      timestamp: '2000',
      source: 'websocket',
      data: { content: 'hello' }
    }]

    expect(durableObject.alarm).toEqual(expect.any(Function))
    await durableObject.alarm()

    expect(socket.close).toHaveBeenCalledWith(4401, 'Token expired')
    expect(state.storage.put).toHaveBeenCalledWith('messageHistory', durableObject.roomContext.messageHistory)
  })
})
