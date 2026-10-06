// Issue #53: the global WebSocket must keep recovering while the session is valid,
// instead of giving up after a token-expiry close or 3 failed attempts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

type Handlers = { onConnectionChange?: (_s: string) => void; onError?: (_e: Error) => void }

const clients: Array<{ handlers: Handlers; connect: ReturnType<typeof vi.fn> }> = []

vi.mock('@/services/websocketClient', () => ({
  createWebSocketClient: vi.fn(() => {
    const client = {
      handlers: {} as Handlers,
      connect: vi.fn().mockResolvedValue(undefined),
      setEventHandlers(h: Handlers) { client.handlers = h },
      clearEventHandlers() { client.handlers = {} },
      disconnect: vi.fn()
    }
    clients.push(client)
    return client
  })
}))

const auth = { isAuthenticated: true, validateSession: () => true }
vi.mock('./auth', () => ({ useAuthStore: () => auth }))

import { useWebSocketStore } from './websocket'

const lastClient = () => {
  const client = clients[clients.length - 1]
  if (!client) {
    throw new Error('no client created')
  }
  return client
}

describe('websocket store reconnect (issue #53)', () => {
  let store: ReturnType<typeof useWebSocketStore>

  beforeEach(() => {
    vi.useFakeTimers()
    clients.length = 0
    auth.isAuthenticated = true
    auth.validateSession = () => true
    setActivePinia(createPinia())
    store = useWebSocketStore()
  })

  afterEach(() => {
    // window listeners outlive the test's pinia; a disconnected store ignores them
    store.disconnect()
    vi.useRealTimers()
  })

  async function connectThenDrop() {
    await store.connect()
    lastClient().handlers.onConnectionChange?.('connected')
    lastClient().handlers.onConnectionChange?.('error') // e.g. 4401 Token expired / network drop
  }

  it('reconnects after an unexpected drop', async () => {
    await connectThenDrop()

    await vi.advanceTimersByTimeAsync(5000 + 1000)

    expect(clients).toHaveLength(2)
    expect(lastClient().connect).toHaveBeenCalled()
  })

  it('keeps retrying past the old 3-attempt limit', async () => {
    await connectThenDrop()

    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(60000 + 1000)
      lastClient().handlers.onConnectionChange?.('error')
    }

    expect(clients.length).toBeGreaterThanOrEqual(6)
  })

  it('stops retrying once the session is gone', async () => {
    await store.connect()
    auth.isAuthenticated = false
    auth.validateSession = () => false
    lastClient().handlers.onConnectionChange?.('error')

    await vi.advanceTimersByTimeAsync(120000)

    expect(clients).toHaveLength(1)
    auth.validateSession = () => true
  })

  it('recovers immediately on auth:token-refreshed without waiting for backoff', async () => {
    await connectThenDrop()

    window.dispatchEvent(new CustomEvent('auth:token-refreshed'))
    await vi.advanceTimersByTimeAsync(1000) // reconnect's own 1s pause, well under the 5s backoff

    expect(clients).toHaveLength(2)
  })

  it('shares one reconnect between concurrent callers', async () => {
    await store.connect()

    void store.reconnect()
    void store.reconnect() // e.g. backoff timer and auth store firing together
    await vi.advanceTimersByTimeAsync(1000)

    expect(clients).toHaveLength(2) // one new client, not two
  })
})
