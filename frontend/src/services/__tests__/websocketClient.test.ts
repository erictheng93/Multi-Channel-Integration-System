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

// Mock WebSocket
class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING
  public url: string
  public protocol: string
  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || ''
    // Simulate async connection
    setTimeout(() => {
      if (this.readyState === WebSocket.CONNECTING) {
        this.simulateOpen()
      }
    }, 0)
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    // Simulate send
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSING
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code, reason }))
      }
    }, 0)
  }

  // Helper methods for testing
  simulateOpen(): void {
    this.readyState = WebSocket.OPEN
    if (this.onopen) {
      this.onopen(new Event('open'))
    }
  }

  simulateMessage(data: WebSocketMessage): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }))
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose(code = 1000, reason = 'Normal closure'): void {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }))
    }
  }
}

// Setup global WebSocket mock
beforeEach(() => {
  global.WebSocket = MockWebSocket as any
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  destroyGlobalWebSocketClient()
})

describe('WebSocketClient', () => {
  describe('建立連接', () => {
    it('應該成功建立 WebSocket 連接', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()

      expect(client.connectionState.value).toBe('connected')
      expect(client.isConnected.value).toBe(true)
    })

    it('應該使用正確的 URL 連接', async () => {
      const url = 'ws://localhost:8787/websocket'
      const client = createWebSocketClient({ url })

      const connectPromise = client.connect()
      await vi.runAllTimersAsync()
      await connectPromise

      const socket = (client as any).socket as MockWebSocket
      expect(socket.url).toBe(url)
    })

    it('應該在連接時設置正確的狀態', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      expect(client.connectionState.value).toBe('disconnected')

      const connectPromise = client.connect()

      // 連接中狀態
      expect(client.connectionState.value).toBe('connecting')

      await vi.runAllTimersAsync()
      await connectPromise

      // 已連接狀態
      expect(client.connectionState.value).toBe('connected')
    })

    it('應該在沒有 URL 時拋出錯誤', async () => {
      const client = createWebSocketClient()

      await expect(client.connect()).rejects.toThrow()
    })
  })

  describe('斷開連接', () => {
    it('應該正常斷開連接', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await vi.runAllTimersAsync()

      client.disconnect()

      expect(client.connectionState.value).toBe('disconnected')
      expect(client.isConnected.value).toBe(false)
    })

    it('應該清理所有計時器', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        heartbeatInterval: 1000
      })

      await client.connect()
      await vi.runAllTimersAsync()

      client.disconnect()

      // 驗證計時器已清理
      expect((client as any).heartbeatTimer).toBeNull()
      expect((client as any).reconnectTimer).toBeNull()
    })
  })

  describe('訊息收發', () => {
    it('應該成功發送訊息', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket
      const sendSpy = vi.spyOn(socket, 'send')

      const message: WebSocketMessage = {
        type: 'test',
        data: { hello: 'world' }
      }

      client.send(message)

      expect(sendSpy).toHaveBeenCalled()
      const sentData = JSON.parse(sendSpy.mock.calls[0][0] as string)
      expect(sentData.type).toBe('test')
      expect(sentData.data).toEqual({ hello: 'world' })
    })

    it('應該接收並處理訊息', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      let receivedMessage: WebSocketMessage | null = null
      client.setEventHandlers({
        onMessage: (msg) => {
          receivedMessage = msg
        }
      })

      await client.connect()
      await vi.runAllTimersAsync()

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
      const client = createWebSocketClient({
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
      const client = createWebSocketClient({
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
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket
      const sendSpy = vi.spyOn(socket, 'send')

      // 等待隊列處理
      await vi.runAllTimersAsync()

      // 驗證隊列已清空
      expect(client.queueSize.value).toBe(0)
      expect(sendSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('應該限制訊息隊列大小', () => {
      const maxSize = 5
      const client = createWebSocketClient({
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
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true,
        reconnectInterval: 100
      })

      await client.connect()
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket

      // 模擬連接斷開
      socket.simulateClose(1006, 'Abnormal closure')
      await vi.runAllTimersAsync()

      expect(client.connectionState.value).toBe('reconnecting')
      expect(client.reconnectAttempt.value).toBeGreaterThan(0)
    })

    it('應該使用指數退避策略重連', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      })

      await client.connect()
      await vi.runAllTimersAsync()

      // 第一次斷開
      let socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)
      await vi.advanceTimersByTimeAsync(1000) // 1s

      // 第二次斷開
      socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)
      await vi.advanceTimersByTimeAsync(2000) // 2s

      // 第三次斷開
      socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)
      await vi.advanceTimersByTimeAsync(4000) // 4s

      expect(client.reconnectAttempt.value).toBe(3)
    })

    it('應該在達到最大重連次數後停止', async () => {
      const maxAttempts = 3
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: maxAttempts
      })

      await client.connect()
      await vi.runAllTimersAsync()

      // 模擬多次重連失敗
      for (let i = 0; i < maxAttempts; i++) {
        const socket = (client as any).socket as MockWebSocket
        socket.simulateClose(1006)
        await vi.advanceTimersByTimeAsync(1000 * Math.pow(2, i))
      }

      // 再等一段時間，確保不會再重連
      await vi.advanceTimersByTimeAsync(10000)

      expect(client.connectionState.value).toBe('error')
      expect(client.reconnectAttempt.value).toBe(maxAttempts)
    })

    it('應該在手動斷開時不自動重連', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: true
      })

      await client.connect()
      await vi.runAllTimersAsync()

      client.disconnect()

      await vi.advanceTimersByTimeAsync(5000)

      expect(client.connectionState.value).toBe('disconnected')
      expect((client as any).reconnectTimer).toBeNull()
    })
  })

  describe('心跳機制', () => {
    it('應該定期發送心跳訊息', async () => {
      const heartbeatInterval = 1000
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        heartbeatInterval
      })

      await client.connect()
      await vi.runAllTimersAsync()

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
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        heartbeatInterval: 1000,
        heartbeatTimeout: 2000
      })

      await client.connect()
      await vi.runAllTimersAsync()

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
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      let errorReceived: Error | null = null
      client.setEventHandlers({
        onError: (error) => {
          errorReceived = error
        }
      })

      await client.connect()
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateError()

      expect(errorReceived).toBeTruthy()
      expect(client.lastError.value).toBeTruthy()
    })

    it('應該處理無效的訊息格式', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      await client.connect()
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket

      // 發送無效的 JSON
      if (socket.onmessage) {
        socket.onmessage(new MessageEvent('message', {
          data: 'invalid json{'
        }))
      }

      // 應該不會崩潰，並記錄錯誤
      expect(client.lastError.value).toBeTruthy()
    })

    it('應該處理認證失敗的情況', async () => {
      // Mock auth store with invalid token
      const { useAuthStore } = await import('@/stores/auth')
      vi.mocked(useAuthStore).mockReturnValueOnce({
        token: null
      } as any)

      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: false
      })

      await expect(client.connect()).rejects.toThrow()
      expect(client.connectionState.value).toBe('error')
    })
  })

  describe('事件處理', () => {
    it('應該支持註冊事件監聽器', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      let messageReceived = false
      client.setEventHandlers({
        onMessage: () => {
          messageReceived = true
        }
      })

      await client.connect()
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateMessage({ type: 'test', data: {} })

      expect(messageReceived).toBe(true)
    })

    it('應該支持清除事件監聽器', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      let callCount = 0
      client.setEventHandlers({
        onMessage: () => {
          callCount++
        }
      })

      await client.connect()
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateMessage({ type: 'test', data: {} })
      expect(callCount).toBe(1)

      client.clearEventHandlers()
      socket.simulateMessage({ type: 'test', data: {} })

      expect(callCount).toBe(1) // 不應該增加
    })

    it('應該觸發連接狀態變化事件', async () => {
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket'
      })

      const states: string[] = []
      client.setEventHandlers({
        onConnectionChange: (state) => {
          states.push(state)
        }
      })

      await client.connect()
      await vi.runAllTimersAsync()

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
      await vi.runAllTimersAsync()

      expect(client.isConnected.value).toBe(true)

      destroyGlobalWebSocketClient()

      expect(client.isConnected.value).toBe(false)
    })
  })

  describe('配置選項', () => {
    it('應該使用默認配置', () => {
      const client = createWebSocketClient()

      const config = (client as any).config
      expect(config.reconnect).toBe(true)
      expect(config.maxReconnectAttempts).toBe(10)
      expect(config.heartbeatInterval).toBe(30000)
    })

    it('應該合併自定義配置', () => {
      const client = createWebSocketClient({
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
      const client = createWebSocketClient({
        url: 'ws://localhost:8787/websocket',
        reconnect: false
      })

      await client.connect()
      await vi.runAllTimersAsync()

      const socket = (client as any).socket as MockWebSocket
      socket.simulateClose(1006)

      await vi.advanceTimersByTimeAsync(5000)

      expect(client.connectionState.value).toBe('disconnected')
      expect(client.reconnectAttempt.value).toBe(0)
    })
  })
})
