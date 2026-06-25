import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/auth', () => ({
  verifyJWT: vi.fn(async (token: string) => ({
    userId: token.replace('token-for-', '')
  }))
}))

import { UserConnection } from '@/durable-objects/UserConnection'

const NativeResponse = globalThis.Response

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

interface MockState extends DurableObjectState {
  acceptWebSocket: ReturnType<typeof vi.fn>
  getWebSockets: ReturnType<typeof vi.fn>
  setWebSocketAutoResponse: ReturnType<typeof vi.fn>
  storage: DurableObjectStorage & {
    get: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    getAlarm: ReturnType<typeof vi.fn>
    setAlarm: ReturnType<typeof vi.fn>
    deleteAlarm: ReturnType<typeof vi.fn>
  }
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

function createState(sockets: MockSocket[] = []): MockState {
  return {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn(() => sockets),
    setWebSocketAutoResponse: vi.fn(),
    storage: {
      get: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      getAlarm: vi.fn(async () => null),
      setAlarm: vi.fn(async () => undefined),
      deleteAlarm: vi.fn(async () => undefined)
    }
  } as unknown as MockState
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

function createEnv(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    JWT_SECRET: 'secret',
    MESSAGE_BROADCASTER: {
      idFromName: vi.fn(() => 'global'),
      get: vi.fn(() => ({
        fetch: vi.fn(async () => Response.json({ activeConnections: 1 }))
      }))
    },
    ...extra
  }
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

function createUpgradeUrl(params: Record<string, string | number>): string {
  const url = new URL('https://example.test/ws')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function connect(doInstance: UserConnection, url: string): Promise<void> {
  await doInstance.fetch(new Request(url, { headers: { Upgrade: 'websocket' } })).catch(error => {
    if (!(error instanceof RangeError)) {
      throw error
    }
  })
}

describe('UserConnection hibernation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    Object.defineProperty(globalThis, 'Response', {
      value: class ResponseWithWebSocketStatus extends NativeResponse {
        webSocket?: WebSocket

        constructor(body?: BodyInit | null, init?: ResponseInit & { webSocket?: WebSocket }) {
          const responseInit = init?.status === 101 ? { ...init, status: 200 } : init
          super(body, responseInit)
          this.webSocket = init?.webSocket
          if (init?.status === 101) {
            Object.defineProperty(this, 'status', { value: 101 })
          }
        }
      },
      configurable: true
    })
    Object.defineProperty(globalThis, 'WebSocket', {
      value: { OPEN: 1 },
      configurable: true
    })
    installWebSocketRequestResponsePair()
  })

  it('configures ping/pong auto-response for hibernated sockets', () => {
    const state = createState()

    new UserConnection(state, createEnv())

    expect(state.setWebSocketAutoResponse).toHaveBeenCalledTimes(1)
    const pair = state.setWebSocketAutoResponse.mock.calls[0][0] as {
      getRequest: () => string
      getResponse: () => string
    }
    expect(pair.getRequest()).toBe('ping')
    expect(pair.getResponse()).toBe('pong')
  })

  it('accepts user sockets with the hibernation API and stores attachment metadata', async () => {
    const client = createSocket()
    const server = createSocket()
    const state = createState()
    const tokenExp = Math.floor(Date.now() / 1000) + 60
    installWebSocketPair(client, server)

    const durableObject = new UserConnection(state, createEnv())

    await connect(durableObject, createUpgradeUrl({
      token: 'token-for-user-1',
      role: 'agent',
      userId: 'user-1',
      deviceId: 'browser-1',
      tokenExp
    }))

    expect(state.acceptWebSocket).toHaveBeenCalledWith(server, ['user-1'])
    expect(server.accept).not.toHaveBeenCalled()
    expect(server.addEventListener).not.toHaveBeenCalled()
    expect(server.serializeAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        role: 'agent',
        deviceId: 'browser-1',
        tokenExp
      })
    )
    expect(server.serializeAttachment.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        connectionId: expect.stringMatching(/^user_conn_/),
        connectedAt: expect.any(Number),
        lastActivity: expect.any(Number)
      })
    )
  })

  it('restores hibernated sockets from attachments for status and broadcasts', async () => {
    const socket = createSocket({
      connectionId: 'connection-1',
      userId: 'user-1',
      role: 'agent',
      deviceId: 'browser-1',
      connectedAt: 1000,
      lastActivity: 1000
    })
    const state = createState([socket])
    const durableObject = new UserConnection(state, createEnv({ userId: 'user-1' }))

    const status = await durableObject.fetch(new Request('https://example.test/status'))
    const payload = await status.json() as { connectionCount: number; isOnline: boolean }
    expect(payload.connectionCount).toBe(1)
    expect(payload.isOnline).toBe(true)

    await durableObject.fetch(new Request('https://example.test/broadcast', {
      method: 'POST',
      body: JSON.stringify({ type: 'event', data: { type: 'notice' }, timestamp: 1234 })
    }))

    expect(socket.send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(socket.send.mock.calls[0][0] as string)).toMatchObject({
      type: 'event',
      data: { type: 'notice' },
      timestamp: 1234
    })
  })

  it('handles hibernated websocket messages through Durable Object webSocketMessage', async () => {
    const socket = createSocket({
      connectionId: 'connection-1',
      userId: 'user-1',
      role: 'agent',
      connectedAt: 1000,
      lastActivity: 1000
    })
    const state = createState([socket])
    const durableObject = new UserConnection(state, createEnv({ userId: 'user-1' }))

    await durableObject.webSocketMessage(socket as unknown as WebSocket, JSON.stringify({
      type: 'ping',
      timestamp: 1234
    }))

    expect(socket.send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(socket.send.mock.calls[0][0] as string)).toMatchObject({ type: 'pong' })
  })

  it('uses alarms instead of timers to close sockets when token expiry passes', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const client = createSocket()
    const server = createSocket()
    const state = createState()
    const tokenExp = Math.floor(Date.now() / 1000) - 1
    installWebSocketPair(client, server)

    const durableObject = new UserConnection(state, createEnv())

    await connect(durableObject, createUpgradeUrl({
      token: 'token-for-user-1',
      role: 'agent',
      userId: 'user-1',
      tokenExp
    }))

    expect(setTimeoutSpy).not.toHaveBeenCalled()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(state.storage.setAlarm).toHaveBeenCalled()

    await durableObject.alarm()

    expect(server.close).toHaveBeenCalledWith(4401, 'Token expired')
  })
})
