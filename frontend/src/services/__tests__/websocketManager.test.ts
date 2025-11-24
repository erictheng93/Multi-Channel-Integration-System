/**
 * WebSocket Manager Service Tests
 * 測試目標: websocketManager.ts
 * 覆蓋率目標: ≥70%
 *
 * 測試重點:
 * 1. 連接池管理
 * 2. 多會話處理
 * 3. 用戶在線狀態
 * 4. 打字指示器
 * 5. 事件路由
 * 6. 統計數據
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketManager } from '../websocketManager'
import type { WebSocketMessage } from '../websocketClient'
import type { Message, Conversation } from '@/types'

// Mock auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    token: 'mock-token-123',
    user: { id: 'user-1', name: 'Test User' }
  }))
}))

// Mock WebSocket Client
vi.mock('../websocketClient', () => {
  const mockClient = {
    connectionState: { value: 'disconnected' },
    isConnected: { value: false },
    lastError: { value: null },
    queueSize: { value: 0 },
    connect: vi.fn(async () => {
      mockClient.isConnected.value = true
      mockClient.connectionState.value = 'connected'
      if (mockClient.handlers.onConnectionChange) {
        mockClient.handlers.onConnectionChange('connected')
      }
    }),
    disconnect: vi.fn(() => {
      mockClient.isConnected.value = false
      mockClient.connectionState.value = 'disconnected'
    }),
    send: vi.fn(),
    on: vi.fn((event, handler) => {
      if (!mockClient.handlers[event]) {
        mockClient.handlers[event] = []
      }
      mockClient.handlers[event].push(handler)
    }),
    off: vi.fn(),
    handlers: {} as Record<string, any[]>
  }

  return {
    createWebSocketClient: vi.fn(() => mockClient),
    WebSocketClient: vi.fn(() => mockClient)
  }
})

describe('WebSocketManager', () => {
  let manager: WebSocketManager
  let mockClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    manager = new WebSocketManager()
    const { createWebSocketClient } = await import('../websocketClient')
    mockClient = createWebSocketClient()
  })

  afterEach(() => {
    manager.disconnect()
  })

  describe('連接管理', () => {
    it('應該成功建立連接', async () => {
      await manager.connect()

      expect(mockClient.connect).toHaveBeenCalled()
      expect(manager.isConnected.value).toBe(true)
      expect(manager.connectionState.value).toBe('connected')
    })

    it('應該在沒有 token 時拋出錯誤', async () => {
      const { useAuthStore } = await import('@/stores/auth')
      vi.mocked(useAuthStore).mockReturnValueOnce({
        token: null
      } as any)

      const newManager = new WebSocketManager()

      await expect(newManager.connect()).rejects.toThrow(
        'Authentication required for WebSocket connection'
      )
    })

    it('應該正確斷開連接', async () => {
      await manager.connect()
      manager.disconnect()

      expect(mockClient.disconnect).toHaveBeenCalled()
      expect(manager.isConnected.value).toBe(false)
    })

    it('應該在連接時開始計算運行時間', async () => {
      await manager.connect()

      expect(manager.connectionUptime.value).toBeGreaterThanOrEqual(0)
    })

    it('應該在斷開時停止運行時間計算', async () => {
      await manager.connect()
      const uptime = manager.connectionUptime.value

      manager.disconnect()

      // 等待一段時間後運行時間不應該增加
      await new Promise(resolve => setTimeout(resolve, 100))
      expect((manager as any).uptimeTimer).toBeNull()
    })
  })

  describe('會話訂閱管理', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該成功訂閱會話', () => {
      const conversationId = 'conv-1'

      manager.subscribeToConversation(conversationId)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation.subscribe',
          data: expect.objectContaining({
            conversationId
          })
        })
      )
      expect(manager.connectedConversations.value).toContain(conversationId)
    })

    it('應該成功取消訂閱會話', () => {
      const conversationId = 'conv-1'

      manager.subscribeToConversation(conversationId)
      manager.unsubscribeFromConversation(conversationId)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation.unsubscribe',
          data: expect.objectContaining({
            conversationId
          })
        })
      )
      expect(manager.connectedConversations.value).not.toContain(conversationId)
    })

    it('應該防止重複訂閱同一個會話', () => {
      const conversationId = 'conv-1'

      manager.subscribeToConversation(conversationId)
      manager.subscribeToConversation(conversationId)

      // 應該只發送一次訂閱請求
      const subscribeCalls = mockClient.send.mock.calls.filter(
        (call: any[]) => call[0].type === 'conversation.subscribe'
      )
      expect(subscribeCalls.length).toBe(1)
    })

    it('應該支持同時訂閱多個會話', () => {
      const conversationIds = ['conv-1', 'conv-2', 'conv-3']

      conversationIds.forEach(id => {
        manager.subscribeToConversation(id)
      })

      expect(manager.connectedConversations.value).toEqual(
        expect.arrayContaining(conversationIds)
      )
    })

    it('應該返回當前訂閱的會話列表', () => {
      const conversationIds = ['conv-1', 'conv-2']

      conversationIds.forEach(id => {
        manager.subscribeToConversation(id)
      })

      const subscribed = manager.getSubscribedConversations()

      expect(subscribed).toEqual(expect.arrayContaining(conversationIds))
      expect(subscribed.length).toBe(conversationIds.length)
    })
  })

  describe('訊息處理', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該處理新訊息事件', () => {
      const conversationId = 'conv-1'
      let receivedMessage: Message | null = null

      manager.on('conversationMessage', (convId, message) => {
        if (convId === conversationId) {
          receivedMessage = message
        }
      })

      const testMessage: WebSocketMessage = {
        type: 'conversation.new_message',
        conversationId,
        data: {
          id: 'msg-1',
          content: 'Hello!',
          senderId: 'user-2',
          timestamp: Date.now()
        }
      }

      // 模擬收到訊息
      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.(testMessage)

      expect(receivedMessage).toBeTruthy()
      expect(receivedMessage?.content).toBe('Hello!')
      expect(manager.totalMessagesReceived.value).toBe(1)
    })

    it('應該處理會話更新事件', () => {
      const conversationId = 'conv-1'
      let receivedConversation: Conversation | null = null

      manager.on('conversationUpdate', (convId, conversation) => {
        if (convId === conversationId) {
          receivedConversation = conversation
        }
      })

      const testUpdate: WebSocketMessage = {
        type: 'conversation.update',
        conversationId,
        data: {
          id: conversationId,
          status: 'active',
          updatedAt: Date.now()
        }
      }

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.(testUpdate)

      expect(receivedConversation).toBeTruthy()
      expect(receivedConversation?.status).toBe('active')
    })

    it('應該過濾非訂閱會話的訊息', () => {
      const subscribedConvId = 'conv-1'
      const unsubscribedConvId = 'conv-2'
      let messageReceived = false

      manager.subscribeToConversation(subscribedConvId)

      manager.on('conversationMessage', () => {
        messageReceived = true
      })

      const testMessage: WebSocketMessage = {
        type: 'conversation.new_message',
        conversationId: unsubscribedConvId,
        data: {
          id: 'msg-1',
          content: 'Should not receive this'
        }
      }

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.(testMessage)

      // 不應該收到未訂閱會話的訊息
      expect(messageReceived).toBe(false)
    })
  })

  describe('打字指示器', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該處理打字開始事件', () => {
      const conversationId = 'conv-1'
      const userId = 'user-2'

      manager.subscribeToConversation(conversationId)

      const typingStartMessage: WebSocketMessage = {
        type: 'conversation.typing_start',
        conversationId,
        userId
      }

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.(typingStartMessage)

      expect(manager.typingUsers.value[conversationId]).toContain(userId)
    })

    it('應該處理打字停止事件', () => {
      const conversationId = 'conv-1'
      const userId = 'user-2'

      manager.subscribeToConversation(conversationId)

      // 開始打字
      let typingStartMessage: WebSocketMessage = {
        type: 'conversation.typing_start',
        conversationId,
        userId
      }
      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.(typingStartMessage)

      expect(manager.typingUsers.value[conversationId]).toContain(userId)

      // 停止打字
      const typingStopMessage: WebSocketMessage = {
        type: 'conversation.typing_stop',
        conversationId,
        userId
      }
      messageHandler?.(typingStopMessage)

      expect(manager.typingUsers.value[conversationId]).not.toContain(userId)
    })

    it('應該支持多個用戶同時打字', () => {
      const conversationId = 'conv-1'
      const user1 = 'user-2'
      const user2 = 'user-3'

      manager.subscribeToConversation(conversationId)

      const messageHandler = mockClient.handlers.message?.[0]

      messageHandler?.({ type: 'conversation.typing_start', conversationId, userId: user1 })
      messageHandler?.({ type: 'conversation.typing_start', conversationId, userId: user2 })

      expect(manager.typingUsers.value[conversationId]).toContain(user1)
      expect(manager.typingUsers.value[conversationId]).toContain(user2)
      expect(manager.typingUsers.value[conversationId].length).toBe(2)
    })

    it('應該返回指定會話的打字用戶列表', () => {
      const conversationId = 'conv-1'
      const userId = 'user-2'

      manager.subscribeToConversation(conversationId)

      const typingStartMessage: WebSocketMessage = {
        type: 'conversation.typing_start',
        conversationId,
        userId
      }

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.(typingStartMessage)

      const typingUsers = manager.getTypingUsers(conversationId)

      expect(typingUsers).toContain(userId)
    })
  })

  describe('用戶在線狀態', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該處理用戶在線狀態更新', () => {
      const userId = 'user-2'

      const presenceMessage: WebSocketMessage = {
        type: 'user.presence',
        userId,
        data: {
          isOnline: true,
          lastSeen: Date.now()
        }
      }

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.(presenceMessage)

      expect(manager.onlineUsers.value).toContain(userId)
    })

    it('應該處理用戶離線狀態', () => {
      const userId = 'user-2'

      const messageHandler = mockClient.handlers.message?.[0]

      // 用戶上線
      messageHandler?.({
        type: 'user.presence',
        userId,
        data: { isOnline: true }
      })

      expect(manager.onlineUsers.value).toContain(userId)

      // 用戶離線
      messageHandler?.({
        type: 'user.presence',
        userId,
        data: { isOnline: false }
      })

      expect(manager.onlineUsers.value).not.toContain(userId)
    })

    it('應該返回用戶在線狀態', () => {
      const userId = 'user-2'

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.({
        type: 'user.presence',
        userId,
        data: { isOnline: true, lastSeen: Date.now() }
      })

      const presence = manager.getUserPresence(userId)

      expect(presence).toBeTruthy()
      expect(presence?.isOnline).toBe(true)
    })

    it('應該支持多個用戶在線狀態', () => {
      const users = ['user-2', 'user-3', 'user-4']

      const messageHandler = mockClient.handlers.message?.[0]

      users.forEach(userId => {
        messageHandler?.({
          type: 'user.presence',
          userId,
          data: { isOnline: true }
        })
      })

      expect(manager.onlineUsers.value).toEqual(expect.arrayContaining(users))
    })
  })

  describe('事件回調', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該支持註冊事件監聽器', () => {
      let callbackCalled = false

      manager.on('conversationMessage', () => {
        callbackCalled = true
      })

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.({
        type: 'conversation.new_message',
        conversationId: 'conv-1',
        data: { id: 'msg-1', content: 'Test' }
      })

      expect(callbackCalled).toBe(true)
    })

    it('應該支持註冊多個事件監聽器', () => {
      let call1 = false
      let call2 = false

      manager.on('conversationMessage', () => { call1 = true })
      manager.on('conversationMessage', () => { call2 = true })

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.({
        type: 'conversation.new_message',
        conversationId: 'conv-1',
        data: { id: 'msg-1', content: 'Test' }
      })

      expect(call1).toBe(true)
      expect(call2).toBe(true)
    })

    it('應該觸發連接狀態變化回調', () => {
      let stateChanges: string[] = []

      manager.on('connectionStateChange', (state) => {
        stateChanges.push(state)
      })

      const connectionChangeHandler = mockClient.handlers.onConnectionChange?.[0]
      connectionChangeHandler?.('connecting')
      connectionChangeHandler?.('connected')

      expect(stateChanges).toContain('connecting')
      expect(stateChanges).toContain('connected')
    })

    it('應該觸發錯誤回調', () => {
      let errorReceived: Error | null = null

      manager.on('error', (error) => {
        errorReceived = error
      })

      const testError = new Error('Test error')
      const errorHandler = mockClient.handlers.onError?.[0]
      errorHandler?.(testError)

      expect(errorReceived).toBe(testError)
    })
  })

  describe('統計數據', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該統計接收的訊息數量', () => {
      expect(manager.totalMessagesReceived.value).toBe(0)

      const messageHandler = mockClient.handlers.message?.[0]

      messageHandler?.({
        type: 'conversation.new_message',
        conversationId: 'conv-1',
        data: { id: 'msg-1', content: 'Test 1' }
      })

      messageHandler?.({
        type: 'conversation.new_message',
        conversationId: 'conv-1',
        data: { id: 'msg-2', content: 'Test 2' }
      })

      expect(manager.totalMessagesReceived.value).toBe(2)
    })

    it('應該返回訊息隊列大小', () => {
      mockClient.queueSize.value = 5

      expect(manager.messageQueue.value).toBe(5)
    })

    it('應該提供連接統計信息', () => {
      const stats = manager.getConnectionStats()

      expect(stats).toHaveProperty('isConnected')
      expect(stats).toHaveProperty('uptime')
      expect(stats).toHaveProperty('messagesReceived')
      expect(stats).toHaveProperty('queueSize')
      expect(stats).toHaveProperty('subscriptions')
    })
  })

  describe('會話活動追蹤', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該追蹤會話活動時間', () => {
      const conversationId = 'conv-1'

      manager.subscribeToConversation(conversationId)

      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.({
        type: 'conversation.new_message',
        conversationId,
        data: { id: 'msg-1', content: 'Test' }
      })

      const connection = (manager as any).conversations.get(conversationId)

      expect(connection).toBeTruthy()
      expect(connection.lastActivity).toBeGreaterThan(0)
    })

    it('應該統計會話訊息數量', () => {
      const conversationId = 'conv-1'

      manager.subscribeToConversation(conversationId)

      const messageHandler = mockClient.handlers.message?.[0]

      // 發送多個訊息
      for (let i = 0; i < 3; i++) {
        messageHandler?.({
          type: 'conversation.new_message',
          conversationId,
          data: { id: `msg-${i}`, content: `Test ${i}` }
        })
      }

      const connection = (manager as any).conversations.get(conversationId)

      expect(connection.messageCount).toBe(3)
    })

    it('應該標記會話為活動狀態', () => {
      const conversationId = 'conv-1'

      manager.subscribeToConversation(conversationId)

      const connection = (manager as any).conversations.get(conversationId)

      expect(connection.isActive).toBe(true)
    })
  })

  describe('清理和重置', () => {
    beforeEach(async () => {
      await manager.connect()
    })

    it('應該在斷開連接時清理所有訂閱', () => {
      manager.subscribeToConversation('conv-1')
      manager.subscribeToConversation('conv-2')

      manager.disconnect()

      expect(manager.connectedConversations.value).toHaveLength(0)
    })

    it('應該在斷開連接時清理用戶狀態', () => {
      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.({
        type: 'user.presence',
        userId: 'user-2',
        data: { isOnline: true }
      })

      manager.disconnect()

      expect(manager.onlineUsers.value).toHaveLength(0)
    })

    it('應該重置統計數據', () => {
      const messageHandler = mockClient.handlers.message?.[0]
      messageHandler?.({
        type: 'conversation.new_message',
        conversationId: 'conv-1',
        data: { id: 'msg-1', content: 'Test' }
      })

      manager.resetStats()

      expect(manager.totalMessagesReceived.value).toBe(0)
      expect(manager.connectionUptime.value).toBe(0)
    })
  })
})
