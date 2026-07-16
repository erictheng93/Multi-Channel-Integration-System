import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCustomerWebSocketConnection } from '@/services/customerWebSocketManager'

vi.mock('@/config/runtime', () => ({
  getBackendUrl: vi.fn(() => 'https://backend.test')
}))

vi.mock('@/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 3

  static instances: MockWebSocket[] = []

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((_event: { data: string }) => void) | null = null
  onerror: ((_event: unknown) => void) | null = null
  onclose: ((_event: { code: number; reason: string }) => void) | null = null
  send = vi.fn()

  constructor(readonly _url: string) {
    MockWebSocket.instances.push(this)
  }

  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

describe('customerWebSocketManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  it('forwards top-level message_updated events to the registered message callback', async () => {
    const connection = createCustomerWebSocketConnection({
      conversationId: 'conv-1',
      autoReconnect: false
    })
    const onMessage = vi.fn()
    connection.onMessage(onMessage)

    await connection.connect()
    const socket = MockWebSocket.instances[0]
    socket.open()
    socket.receive({
      type: 'message_updated',
      conversationId: 'conv-1',
      data: {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        deliveryStatus: 'sent',
        isSent: true,
        platformMessageId: 'line_123'
      }
    })

    expect(onMessage).toHaveBeenCalledWith({
      type: 'message_updated',
      conversationId: 'conv-1',
      data: {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        deliveryStatus: 'sent',
        isSent: true,
        platformMessageId: 'line_123'
      }
    })
  })
})
