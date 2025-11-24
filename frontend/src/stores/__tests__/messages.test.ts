/**
 * Messages Store Tests
 * 測試目標: stores/messages.ts
 * 覆蓋率目標: ≥70%
 *
 * 測試重點:
 * 1. 訊息載入與管理
 * 2. 訊息發送 (樂觀更新)
 * 3. 訊息過濾
 * 4. 未讀訊息統計
 * 5. 錯誤處理
 * 6. 快取與索引
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMessagesStore } from '../messages'
import type { Message, Platform } from '@/types'

// Mock message API - must be defined inline to avoid hoisting issues
vi.mock('@/api/message', () => ({
  messageApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    markAsRead: vi.fn()
  }
}))

// Mock message index service - must be defined inline
vi.mock('@/services/messageIndexService', () => ({
  messageIndexService: {
    indexMessages: vi.fn(),
    buildIndex: vi.fn(),
    updateMessage: vi.fn(),
    search: vi.fn(),
    clear: vi.fn()
  }
}))

// Import mocked modules to access them in tests
import { messageApi } from '@/api/message'
import { messageIndexService } from '@/services/messageIndexService'

// Create references for easier access in tests
const mockMessageApi = messageApi as any
const mockMessageIndexService = messageIndexService as any

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

global.localStorage = localStorageMock as any

describe('Messages Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()

    // 設置默認的 token
    localStorageMock.getItem.mockReturnValue(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJpZCI6InVzZXItMSJ9.test'
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('初始化', () => {
    it('應該初始化為空狀態', () => {
      const store = useMessagesStore()

      expect(store.messages).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.sendingMessage).toBe(false)
      expect(store.optimisticMessages).toEqual([])
    })

    it('應該初始化過濾器', () => {
      const store = useMessagesStore()

      expect(store.filters).toEqual({
        conversationId: undefined,
        senderType: undefined,
        platform: undefined,
        messageType: undefined
      })
    })
  })

  describe('載入訊息', () => {
    it('應該成功載入訊息', async () => {
      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Hello',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          content: 'World',
          senderId: 'user-2',
          senderType: 'agent',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        }
      ]

      mockMessageApi.list.mockResolvedValueOnce({
        success: true,
        data: mockMessages
      })

      const store = useMessagesStore()
      await store.fetchMessages('conv-1')

      expect(store.messages).toEqual(mockMessages)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('應該在載入時設置 loading 狀態', async () => {
      mockMessageApi.list.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: [] }), 1000))
      )

      const store = useMessagesStore()
      const loadPromise = store.fetchMessages('conv-1')

      expect(store.loading).toBe(true)

      // ✅ 推進 fake timers 以完成 setTimeout
      await vi.advanceTimersByTimeAsync(1000)
      await loadPromise
      expect(store.loading).toBe(false)
    })

    it('應該處理載入錯誤', async () => {
      const errorMessage = '無法連接到服務器'
      mockMessageApi.list.mockResolvedValueOnce({
        success: false,
        error: errorMessage
      })

      const store = useMessagesStore()
      await store.fetchMessages('conv-1')

      expect(store.error).toBe(errorMessage)
      expect(store.messages).toEqual([])
    })

    it('應該處理網路錯誤', async () => {
      const networkError = new Error('Network error')
      mockMessageApi.list.mockRejectedValueOnce(networkError)

      const store = useMessagesStore()
      await store.fetchMessages('conv-1')

      // ✅ 只檢查錯誤存在,不檢查具體訊息格式
      expect(store.error).toBeTruthy()
    })

    it('應該在載入成功後清空樂觀訊息', async () => {
      const store = useMessagesStore()

      // 添加樂觀訊息
      store.optimisticMessages = [
        {
          id: 'opt-1',
          conversationId: 'conv-1',
          content: 'Optimistic message',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        }
      ]

      mockMessageApi.list.mockResolvedValueOnce({
        success: true,
        data: []
      })

      await store.fetchMessages('conv-1')

      expect(store.optimisticMessages).toEqual([])
    })

    it('應該在沒有 conversationId 時不執行載入', async () => {
      const store = useMessagesStore()

      await store.fetchMessages('')

      expect(mockMessageApi.list).not.toHaveBeenCalled()
      expect(store.loading).toBe(false)
    })
  })

  describe('發送訊息', () => {
    it('應該成功發送訊息', async () => {
      const newMessage = {
        conversationId: 'conv-1',
        content: 'Test message',
        platform: 'line' as Platform
      }

      const createdMessage: Message = {
        id: 'msg-new',
        ...newMessage,
        senderId: 'user-1',
        senderType: 'agent',
        createdAt: new Date().toISOString(),
        metadata: {}
      }

      mockMessageApi.create.mockResolvedValueOnce({
        success: true,
        data: createdMessage
      })

      const store = useMessagesStore()
      const result = await store.sendMessage(newMessage)

      expect(result).toEqual(createdMessage)
      expect(store.messages).toContainEqual(createdMessage)
      expect(store.sendingMessage).toBe(false)
    })

    it('應該使用樂觀更新', async () => {
      const newMessage = {
        conversationId: 'conv-1',
        content: 'Test message',
        platform: 'line' as Platform
      }

      mockMessageApi.create.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { id: 'msg-new', ...newMessage, senderId: 'user-1', senderType: 'agent', createdAt: new Date().toISOString(), metadata: {} }
        }), 1000))
      )

      const store = useMessagesStore()
      const sendPromise = store.sendMessage(newMessage)

      // 應該有樂觀訊息
      expect(store.optimisticMessages.length).toBeGreaterThan(0)
      expect(store.sendingMessage).toBe(true)

      // ✅ 推進 fake timers 以完成 setTimeout
      await vi.advanceTimersByTimeAsync(1000)
      await sendPromise

      // 發送成功後應該清空樂觀訊息
      expect(store.optimisticMessages).toEqual([])
      expect(store.sendingMessage).toBe(false)
    })

    it('應該處理發送失敗並回滾樂觀更新', async () => {
      const newMessage = {
        conversationId: 'conv-1',
        content: 'Test message',
        platform: 'line' as Platform
      }

      mockMessageApi.create.mockResolvedValueOnce({
        success: false,
        error: '發送失敗'
      })

      const store = useMessagesStore()
      await store.sendMessage(newMessage)

      expect(store.error).toBeTruthy()
      expect(store.optimisticMessages).toEqual([])
      expect(store.sendingMessage).toBe(false)
    })

    it('應該在發送時設置正確的狀態', async () => {
      const newMessage = {
        conversationId: 'conv-1',
        content: 'Test message',
        platform: 'line' as Platform
      }

      mockMessageApi.create.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: {} }), 100))
      )

      const store = useMessagesStore()
      const sendPromise = store.sendMessage(newMessage)

      expect(store.sendingMessage).toBe(true)

      // ✅ 推進 fake timers 以完成 setTimeout
      await vi.advanceTimersByTimeAsync(100)
      await sendPromise
      expect(store.sendingMessage).toBe(false)
    })
  })

  describe('訊息過濾', () => {
    beforeEach(() => {
      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Message 1',
          senderId: 'customer-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          messageType: 'text',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: {}
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          content: 'Message 2',
          senderId: 'agent-1',
          senderType: 'agent',
          platform: 'line' as Platform,
          messageType: 'text',
          createdAt: '2024-01-01T01:00:00Z',
          metadata: {}
        },
        {
          id: 'msg-3',
          conversationId: 'conv-2',
          content: 'Message 3',
          senderId: 'customer-2',
          senderType: 'customer',
          platform: 'facebook' as Platform,
          messageType: 'image',
          createdAt: '2024-01-01T02:00:00Z',
          metadata: {}
        }
      ]
    })

    it('應該根據 conversationId 過濾訊息', () => {
      const store = useMessagesStore()
      const filtered = store.messagesByConversation('conv-1')

      expect(filtered).toHaveLength(2)
      expect(filtered.every(m => m.conversationId === 'conv-1')).toBe(true)
    })

    it('應該根據 senderType 過濾訊息', () => {
      const store = useMessagesStore()
      store.setFilter('senderType', 'customer')

      const filtered = store.filteredMessages

      expect(filtered.every(m => m.senderType === 'customer')).toBe(true)
    })

    it('應該根據 platform 過濾訊息', () => {
      const store = useMessagesStore()
      store.setFilter('platform', 'line')

      const filtered = store.filteredMessages

      expect(filtered.every(m => m.platform === 'line')).toBe(true)
    })

    it('應該根據 messageType 過濾訊息', () => {
      const store = useMessagesStore()
      store.setFilter('messageType', 'image')

      const filtered = store.filteredMessages

      expect(filtered.every(m => m.messageType === 'image')).toBe(true)
    })

    it('應該支持多重過濾', () => {
      const store = useMessagesStore()
      store.setFilter('conversationId', 'conv-1')
      store.setFilter('senderType', 'customer')

      const filtered = store.filteredMessages

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('msg-1')
    })

    it('應該能夠清除過濾器', () => {
      const store = useMessagesStore()
      store.setFilter('senderType', 'customer')
      store.clearFilters()

      expect(store.filters).toEqual({
        conversationId: undefined,
        senderType: undefined,
        platform: undefined,
        messageType: undefined
      })
    })
  })

  describe('未讀訊息', () => {
    it('應該統計未讀訊息數量', () => {
      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Unread 1',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: { isRead: false }
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          content: 'Read',
          senderId: 'user-2',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: { isRead: true }
        },
        {
          id: 'msg-3',
          conversationId: 'conv-1',
          content: 'Unread 2',
          senderId: 'user-3',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: { isRead: false }
        }
      ]

      expect(store.unreadMessages).toHaveLength(2)
    })

    it('應該正確標記訊息為已讀', async () => {
      mockMessageApi.markAsRead.mockResolvedValueOnce({
        success: true
      })

      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Test',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: { isRead: false }
        }
      ]

      await store.markAsRead('msg-1')

      const message = store.messages.find(m => m.id === 'msg-1')
      expect((message?.metadata as any)?.isRead).toBe(true)
    })

    it('應該處理標記已讀失敗', async () => {
      mockMessageApi.markAsRead.mockResolvedValueOnce({
        success: false,
        error: '標記失敗'
      })

      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Test',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: { isRead: false }
        }
      ]

      await store.markAsRead('msg-1')

      expect(store.error).toBeTruthy()
      const message = store.messages.find(m => m.id === 'msg-1')
      expect((message?.metadata as any)?.isRead).toBe(false)
    })
  })

  describe('訊息排序', () => {
    it('應該按時間排序所有訊息', () => {
      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-3',
          conversationId: 'conv-1',
          content: 'Third',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: '2024-01-01T12:00:00Z',
          metadata: {}
        },
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'First',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: '2024-01-01T10:00:00Z',
          metadata: {}
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          content: 'Second',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: '2024-01-01T11:00:00Z',
          metadata: {}
        }
      ]

      const sorted = store.allMessages

      expect(sorted[0].id).toBe('msg-1')
      expect(sorted[1].id).toBe('msg-2')
      expect(sorted[2].id).toBe('msg-3')
    })

    it('應該合併並排序樂觀訊息', () => {
      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'First',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: '2024-01-01T10:00:00Z',
          metadata: {}
        }
      ]

      store.optimisticMessages = [
        {
          id: 'opt-1',
          conversationId: 'conv-1',
          content: 'Optimistic',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: '2024-01-01T11:00:00Z',
          metadata: {}
        }
      ]

      const all = store.allMessages

      expect(all).toHaveLength(2)
      expect(all[0].id).toBe('msg-1')
      expect(all[1].id).toBe('opt-1')
    })
  })

  describe('錯誤處理', () => {
    it('應該自動清除錯誤訊息', async () => {
      mockMessageApi.list.mockResolvedValueOnce({
        success: false,
        error: '測試錯誤'
      })

      const store = useMessagesStore()
      await store.fetchMessages('conv-1')

      expect(store.error).toBeTruthy()

      // 等待 5 秒後應該清除錯誤
      vi.advanceTimersByTime(5000)

      expect(store.error).toBeNull()
    })

    it('應該提供手動清除錯誤的方法', () => {
      const store = useMessagesStore()
      store.error = '測試錯誤'

      store.clearError()

      expect(store.error).toBeNull()
    })
  })

  describe('訊息操作', () => {
    it('應該成功更新訊息', async () => {
      const updatedContent = 'Updated content'

      mockMessageApi.update.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'msg-1',
          content: updatedContent
        }
      })

      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Original',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        }
      ]

      await store.updateMessage('msg-1', { content: updatedContent })

      const updated = store.messages.find(m => m.id === 'msg-1')
      expect(updated?.content).toBe(updatedContent)
    })

    it('應該成功刪除訊息', async () => {
      mockMessageApi.delete.mockResolvedValueOnce({
        success: true
      })

      const store = useMessagesStore()
      store.messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'To delete',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          content: 'To keep',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        }
      ]

      await store.deleteMessage('msg-1')

      expect(store.messages).toHaveLength(1)
      expect(store.messages.find(m => m.id === 'msg-1')).toBeUndefined()
      expect(store.messages.find(m => m.id === 'msg-2')).toBeDefined()
    })
  })

  describe('訊息索引', () => {
    it('應該在載入訊息後建立索引', async () => {
      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Searchable message',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        }
      ]

      mockMessageApi.list.mockResolvedValueOnce({
        success: true,
        data: mockMessages
      })

      const store = useMessagesStore()
      await store.fetchMessages('conv-1')

      expect(mockMessageIndexService.indexMessages).toHaveBeenCalledWith(mockMessages)
    })

    it('應該支持訊息搜索', async () => {
      const searchResults = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'Found message',
          senderId: 'user-1',
          senderType: 'customer',
          platform: 'line' as Platform,
          createdAt: new Date().toISOString(),
          metadata: {}
        }
      ]

      mockMessageIndexService.search.mockReturnValue(searchResults)

      const store = useMessagesStore()
      const results = await store.searchMessages('Found')

      expect(mockMessageIndexService.search).toHaveBeenCalledWith('Found')
      expect(results).toEqual(searchResults)
    })
  })
})
