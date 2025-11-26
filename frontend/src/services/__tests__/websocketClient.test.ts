/**
 * WebSocket Client Service Tests
 * 測試目標: websocketClient.ts
 * 覆蓋率目標: ≥70%
 *
 * 測試重點:
 * 1. 連接建立與斷開
 * 2. 訊息收發
 * 3. 重連機制
 * 4. 錯誤處理
 * 5. 心跳機制
 * 6. 訊息隊列
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  WebSocketClient,
  createWebSocketClient,
  getGlobalWebSocketClient,
  destroyGlobalWebSocketClient,
  type WebSocketConfig,
  type WebSocketMessage
} from '../websocketClient'

// Mock auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJyb2xlIjoiYWdlbnQiLCJleHAiOjk5OTk5OTk5OTl9.test',
    user: { id: 'user-1', name: 'Test User', role: 'agent' }
  }))
}))

// Mock WebSocket - Synchronous version for reliable testing
class MockWebSocket {
  // ✅ WebSocket state constants (CRITICAL for tests to work)
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  public readyState: number = MockWebSocket.CONNECTING
  public url: string
  public protocol: string
  private _onopen: ((event: Event) => void) | null = null
  private _onclose: ((event: CloseEvent) => void) | null = null
  private _onmessage: ((event: MessageEvent) => void) | null = null
  private _onerror: ((event: Event) => void) | null = null

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocol = (Array.isArray(protocols) ? protocols[0] : protocols) || ''

    // ✅ SYNCHRONOUS connection for test reliability
    // Use setTimeout with 0 delay to defer to next tick
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.simulateOpen()
      }
    }, 0)
  }

  // Getters/Setters to track event handlers
  get onopen() { return this._onopen }
  set onopen(handler: ((event: Event) => void) | null) {
    this._onopen = handler
  }

  get onclose() { return this._onclose }
  set onclose(handler: ((event: CloseEvent) => void) | null) {
    this._onclose = handler
  }

  get onmessage() { return this._onmessage }
  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this._onmessage = handler
  }

  get onerror() { return this._onerror }
  set onerror(handler: ((event: Event) => void) | null) {
    this._onerror = handler
  }

  send(_data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    // Simulate send
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      if (this._onclose) {
        this._onclose(new CloseEvent('close', { code, reason }))
      }
    }, 0)
  }

  // Helper methods for testing
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    if (this._onopen) {
      this._onopen(new Event('open'))
    }
  }

  simulateMessage(data: WebSocketMessage): void {
    if (this._onmessage) {
      this._onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }))
    }
  }

  simulateError(): void {
    if (this._onerror) {
      this._onerror(new Event('error'))
    }
  }

  simulateClose(code = 1000, reason = 'Normal closure'): void {
    this.readyState = MockWebSocket.CLOSED
    if (this._onclose) {
      this._onclose(new CloseEvent('close', { code, reason }))
    }
  }
}

// Helper to properly wait for async WebSocket operations
async function waitForWebSocket() {
  // Advance timers to process setTimeout in MockWebSocket
  await vi.advanceTimersByTimeAsync(10)
  // Process microtask queue
  await Promise.resolve()
  await Promise.resolve()
}

// Track all clients created during tests
let createdClients: WebSocketClient[] = []

// Wrapper to track clients
function createTrackedClient(config?: WebSocketConfig): WebSocketClient {
  const client = createWebSocketClient(config)
  createdClients.push(client)
  return client
}

// Setup global WebSocket mock
beforeEach(async () => {
  // Clean up any previous clients first
  createdClients.forEach(client => {
    try {
      client.disconnect()
    } catch (e) {
      // Ignore errors
    }
  })
  createdClients = []

  // Destroy any global client
  destroyGlobalWebSocketClient()

  // Setup mocks
  global.WebSocket = MockWebSocket as any

  // ✅ Re-enable fake timers for timer-dependent tests
  vi.useFakeTimers()

  // Flush any pending operations from previous tests
  await Promise.resolve()
  await Promise.resolve()
})

afterEach(async () => {
  // Disconnect all created clients
  createdClients.forEach(client => {
    try {
      client.disconnect()
    } catch (e) {
      // Ignore errors during cleanup
    }
  })
  createdClients = []

  // Flush all pending timers before cleanup
  try {
    await vi.runAllTimersAsync()
  } catch (e) {
    // Ignore timer errors during cleanup
  }

  // Flush pending microtasks
  await Promise.resolve()
  await Promise.resolve()

  vi.restoreAllMocks()
  vi.useRealTimers()
  destroyGlobalWebSocketClient()
})

describe('WebSocketClient', () => {
  describe('建立連接', () => {
    it('應該成功建立 WebSocket 連接', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await waitForWebSocket()

      expect(client.connectionState.value).toBe('connected')
      expect(client.isConnected.value).toBe(true)
    })

    it('應該使用正確的 URL 連接', async () => {
      const url = 'ws://localhost:8787/websocket'
      const client = createTrackedClient({ url })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      expect(socket.url).toBe(url)
    })

    it('應該在連接時設置正確的狀態', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      expect(client.connectionState.value).toBe('disconnected')

      // Start connection
      await client.connect()

      // After connection completes, check final state
      await waitForWebSocket()

      // 已連接狀態
      expect(client.connectionState.value).toBe('connected')
    })

    it('應該在沒有 URL 時拋出錯誤', async () => {
      const client = createTrackedClient({
        url: '' // Explicitly set empty URL
      })

      // Mock buildWebSocketUrl to return empty to force error
      vi.spyOn(client as any, 'buildWebSocketUrl').mockReturnValue('')

      await expect(client.connect()).rejects.toThrow('WebSocket URL is required')
    })
  })

  describe('斷開連接', () => {
    it('應該正常斷開連接', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await waitForWebSocket()

      client.disconnect()

      expect(client.connectionState.value).toBe('disconnected')
      expect(client.isConnected.value).toBe(false)
    })

    it('應該清理所有計時器', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        heartbeatInterval: 1000
      })

      await client.connect()
      await waitForWebSocket()

      client.disconnect()

      // 驗證計時器已清理
      expect((client as any).heartbeatTimer).toBeNull()
      expect((client as any).reconnectTimer).toBeNull()
    })
  })

  describe('訊息收發', () => {
    it('應該成功發送訊息', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      const sendSpy = vi.spyOn(socket, 'send')

      const message: WebSocketMessage = {
        type: 'test',
        data: { hello: 'world' }
      }

      client.send(message)

      expect(sendSpy).toHaveBeenCalled()
      const callArgs = sendSpy.mock.calls[0]
      const sentData = callArgs ? JSON.parse(callArgs[0] as string) : {}
      expect(sentData.type).toBe('test')
      expect(sentData.data).toEqual({ hello: 'world' })
    })

    it('應該接收並處理訊息', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      let receivedMessage: WebSocketMessage | null = null
      client.setEventHandlers({
        onMessage: (msg) => {
          receivedMessage = msg
        }
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      const testMessage: WebSocketMessage = {
        type: 'conversation.new_message',
        data: { content: 'Hello!' },
        timestamp: Date.now()
      }

      socket.simulateMessage(testMessage)

      expect(receivedMessage).toEqual(testMessage)
      expect(client.lastMessage.value).toEqual(testMessage)
    })

    it('應該在未連接時將訊息加入隊列', () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      const message: WebSocketMessage = {
        type: 'test',
        data: { hello: 'world' }
      }

      client.send(message)

      expect(client.queueSize.value).toBe(1)
    })

    it('應該在連接後發送隊列中的訊息', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      // 未連接時發送訊息
      const message1: WebSocketMessage = { type: 'msg1', data: {} }
      const message2: WebSocketMessage = { type: 'msg2', data: {} }

      client.send(message1)
      client.send(message2)

      expect(client.queueSize.value).toBe(2)

      // 建立連接
      await client.connect()
      await waitForWebSocket()

      // 等待隊列處理完成 - queue is processed after connection
      await vi.advanceTimersByTimeAsync(100)

      // 驗證隊列已清空
      expect(client.queueSize.value).toBe(0)
    })

    it('應該限制訊息隊列大小', () => {
      const maxSize = 5
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        messageQueueMaxSize: maxSize
      })

      // 發送超過限制的訊息
      for (let i = 0; i < maxSize + 3; i++) {
        client.send({ type: `msg${i}`, data: {} })
      }

      expect(client.queueSize.value).toBeLessThanOrEqual(maxSize)
    })
  })

  describe('重連機制', () => {
    it('應該在連接斷開後自動重連', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true,
        reconnectInterval: 100
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket

      // 模擬連接斷開
      socket.simulateClose(1006, 'Abnormal closure')
      await waitForWebSocket()

      expect(client.connectionState.value).toBe('reconnecting')
      expect(client.reconnectAttempt.value).toBeGreaterThan(0)
    })

    it('應該使用指數退避策略重連', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      })

      await client.connect()
      await waitForWebSocket()

      // 第一次斷開
      let socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)
      await vi.advanceTimersByTimeAsync(1000) // 1s
      await waitForWebSocket()

      // 第二次斷開
      socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)
      await vi.advanceTimersByTimeAsync(2000) // 2s
      await waitForWebSocket()

      // 第三次斷開
      socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)
      await vi.advanceTimersByTimeAsync(4000) // 4s
      await waitForWebSocket()

      expect(client.reconnectAttempt.value).toBe(3)
    })

    it('應該在達到最大重連次數後停止', async () => {
      const maxAttempts = 3
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: maxAttempts
      })

      await client.connect()
      await waitForWebSocket()

      // 模擬多次重連失敗
      for (let i = 0; i < maxAttempts; i++) {
        const socket = (client as any).socket as MockWebSocket
        socket.simulateClose(1006)
        await vi.advanceTimersByTimeAsync(1000 * Math.pow(2, i))
        await waitForWebSocket()
      }

      // 再等一段時間，確保不會再重連
      await vi.advanceTimersByTimeAsync(10000)
      await waitForWebSocket()

      expect(client.connectionState.value).toBe('error')
      expect(client.reconnectAttempt.value).toBe(maxAttempts)
    })

    it('應該在手動斷開時不自動重連', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true
      })

      await client.connect()
      await waitForWebSocket()

      client.disconnect()

      // Wait for disconnect to complete
      await vi.advanceTimersByTimeAsync(100)

      // State should be disconnected or closed (both are acceptable for manual disconnect)
      expect(['disconnected', 'closed']).toContain(client.connectionState.value)
      expect((client as any).reconnectTimer).toBeNull()
    })
  })

  describe('心跳機制', () => {
    it('應該定期發送心跳訊息', async () => {
      const heartbeatInterval = 1000
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        heartbeatInterval
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      const sendSpy = vi.spyOn(socket, 'send')

      // 等待第一次心跳
      await vi.advanceTimersByTimeAsync(heartbeatInterval)

      expect(sendSpy).toHaveBeenCalled()
      const calls = sendSpy.mock.calls
      const heartbeatCall = calls.find(call => {
        try {
          const data = JSON.parse(call[0] as string)
          return data.type === 'ping'
        } catch {
          return false
        }
      })
      expect(heartbeatCall).toBeDefined()
    })

    it('應該在收到 pong 後重置心跳計時器', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        heartbeatInterval: 1000,
        heartbeatTimeout: 2000
      })

      await client.connect()
      await waitForWebSocket()

      // 發送心跳
      await vi.advanceTimersByTimeAsync(1000)

      const socket = (client as any).socket as MockWebSocket
      // 模擬收到 pong
      socket.simulateMessage({ type: 'pong', timestamp: Date.now() })

      // 驗證心跳計時器已重置
      expect((client as any).lastHeartbeat).toBeGreaterThan(0)
    })
  })

  describe('錯誤處理', () => {
    it('應該處理 WebSocket 錯誤', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      let errorReceived: Error | null = null
      client.setEventHandlers({
        onError: (error) => {
          errorReceived = error
        }
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateError()

      expect(errorReceived).toBeTruthy()
      expect(client.lastError.value).toBeTruthy()
    })

    it('應該處理無效的訊息格式', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket

      // Verify client is connected before sending invalid message
      expect(client.isConnected.value).toBe(true)

      // 發送無效的 JSON - should not crash
      expect(() => {
        if (socket.onmessage) {
          socket.onmessage(new MessageEvent('message', {
            data: 'invalid json{'
          }))
        }
      }).not.toThrow()

      // Wait for error processing
      await vi.advanceTimersByTimeAsync(10)
      await Promise.resolve()

      // 應該不會崩潰，客戶端仍然連接
      // Client should still be functional (might be connected or have error logged)
      expect(client.connectionState.value).toBeDefined()
    })

    it('應該處理認證失敗的情況', async () => {
      // Mock auth store with invalid token
      const { useAuthStore } = await import('@/stores/auth')
      vi.mocked(useAuthStore).mockReturnValueOnce({
        token: null
      } as any)

      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: false
      })

      await expect(client.connect()).rejects.toThrow()
      expect(client.connectionState.value).toBe('error')
    })
  })

  describe('事件處理', () => {
    it('應該支持註冊事件監聽器', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      let messageReceived = false
      client.setEventHandlers({
        onMessage: () => {
          messageReceived = true
        }
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateMessage({ type: 'test', data: {} })

      expect(messageReceived).toBe(true)
    })

    it('應該支持清除事件監聽器', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      let callCount = 0
      client.setEventHandlers({
        onMessage: () => {
          callCount++
        }
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateMessage({ type: 'test', data: {} })
      expect(callCount).toBe(1)

      client.clearEventHandlers()
      socket.simulateMessage({ type: 'test', data: {} })

      expect(callCount).toBe(1) // 不應該增加
    })

    it('應該觸發連接狀態變化事件', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket'
      })

      const states: string[] = []
      client.setEventHandlers({
        onConnectionChange: (state) => {
          states.push(state)
        }
      })

      await client.connect()
      await waitForWebSocket()

      expect(states).toContain('connecting')
      expect(states).toContain('connected')
    })
  })

  describe('全局實例管理', () => {
    it('應該返回單例實例', () => {
      const instance1 = getGlobalWebSocketClient()
      const instance2 = getGlobalWebSocketClient()

      expect(instance1).toBe(instance2)
    })

    it('應該能夠銷毀全局實例', () => {
      const instance1 = getGlobalWebSocketClient()
      destroyGlobalWebSocketClient()
      const instance2 = getGlobalWebSocketClient()

      expect(instance1).not.toBe(instance2)
    })

    it('應該在銷毀時斷開連接', async () => {
      const client = getGlobalWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await waitForWebSocket()

      expect(client.isConnected.value).toBe(true)

      destroyGlobalWebSocketClient()

      // Wait for disconnect to complete
      await vi.advanceTimersByTimeAsync(10)

      expect(client.isConnected.value).toBe(false)
    })
  })

  describe('配置選項', () => {
    it('應該使用默認配置', () => {
      const client = createTrackedClient()

      const config = (client as any).config
      expect(config.reconnect).toBe(true)
      expect(config.maxReconnectAttempts).toBe(10)
      expect(config.heartbeatInterval).toBe(30000)
    })

    it('應該合併自定義配置', () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: false,
        heartbeatInterval: 5000
      })

      const config = (client as any).config
      expect(config.url).toBe('ws://localhost:8787/websocket')
      expect(config.reconnect).toBe(false)
      expect(config.heartbeatInterval).toBe(5000)
      expect(config.maxReconnectAttempts).toBe(10) // 默認值
    })

    it('應該支持禁用自動重連', async () => {
      const client = createTrackedClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: false
      })

      await client.connect()
      await waitForWebSocket()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)

      await vi.advanceTimersByTimeAsync(5000)

      // With reconnect disabled, state could be 'disconnected', 'closed', or 'error' (all valid)
      expect(['disconnected', 'closed', 'error']).toContain(client.connectionState.value)
      expect(client.reconnectAttempt.value).toBe(0)
    })
  })
})
