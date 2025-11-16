// tests/unit/handlers/message.test.ts
// Message Handler Tests - Updated for Drizzle ORM
// Uses new Drizzle mock infrastructure

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { messageHandler } from '@/handlers/message'
import {
  createMockContext,
  extractResponseData
} from '../../helpers/testUtils'

// Mock crypto.randomUUID using vi.stubGlobal
vi.stubGlobal('crypto', {
  ...global.crypto,
  randomUUID: vi.fn(() => 'mock-uuid-12345')
})

// Mock WebSocket broadcast service
vi.mock('../../../src/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastTypingEvent: vi.fn().mockResolvedValue(undefined),
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock LINE utilities
vi.mock('../../../src/utils/line', () => ({
  pushLineMessage: vi.fn().mockResolvedValue(true),
  createTextMessage: vi.fn((text) => ({ type: 'text', text }))
}))

// Mock Facebook adapter
vi.mock('../../../src/integrations/platform-adapter', () => ({
  FacebookAdapter: vi.fn().mockImplementation(() => ({
    sendTextMessage: vi.fn().mockResolvedValue(true),
    sendImageMessage: vi.fn().mockResolvedValue(true),
    sendVideoMessage: vi.fn().mockResolvedValue(true),
    sendAudioMessage: vi.fn().mockResolvedValue(true),
    sendFileMessage: vi.fn().mockResolvedValue(true)
  }))
}))

// Mock activity service
vi.mock('../../../src/services/activity-service', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    logActivity: vi.fn().mockResolvedValue({ id: 'activity-123' })
  }))
}))

// Mock latest message worker
vi.mock('../../../src/workers/latest-message-worker', () => ({
  LatestMessageJobQueue: vi.fn().mockImplementation(() => ({
    updateLatestMessage: vi.fn().mockResolvedValue(undefined)
  }))
}))

describe('messageHandler', () => {
  describe('list', () => {
    it('should return messages list with default pagination', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      // Set up request params
      mockContext.req.param = vi.fn().mockReturnValue('1')

      // Mock Drizzle data - matches the shape from db.select() in handler
      const mockMessagesData = [
        {
          id: 'msg-1',
          conversationId: '1',
          senderType: 'customer',
          customerSenderId: 1,
          agentSenderId: null,
          content: 'Hello, I need help',
          messageType: 'text',
          createdAt: '2024-01-15T10:00:00Z',
          customerName: 'John Doe',
          agentName: null
        },
        {
          id: 'msg-2',
          conversationId: '1',
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: 2,
          content: 'Hi! How can I help you?',
          messageType: 'text',
          createdAt: '2024-01-15T10:05:00Z',
          customerName: null,
          agentName: 'Agent Smith'
        },
        {
          id: 'msg-3',
          conversationId: '1',
          senderType: 'customer',
          customerSenderId: 1,
          agentSenderId: null,
          content: '',
          messageType: 'image',
          createdAt: '2024-01-15T10:10:00Z',
          customerName: 'John Doe',
          agentName: null
        }
      ]

      // Set up mock responses for both data and count queries
      mockDB.mockQueryResponses(mockMessagesData, 3)

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(3)
      expect(extractResponseData(result).data.total).toBe(3)
      expect(extractResponseData(result).data.page).toBe(1)
      expect(extractResponseData(result).data.pageSize).toBe(50)
    })

    it('should handle custom pagination parameters', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      // Set up request params with custom pagination
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        const params: Record<string, string> = {
          page: '2',
          pageSize: '10'
        }
        return key ? params[key] : params
      })

      // Mock empty data for page 2
      mockDB.mockQueryResponses([], 25)

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.page).toBe(2)
      expect(extractResponseData(result).data.pageSize).toBe(10)
      expect(extractResponseData(result).data.total).toBe(25)
    })

    it('should transform message data correctly', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockMessagesData = [
        {
          id: 'msg-1',
          conversationId: '1',
          senderType: 'customer',
          customerSenderId: 1,
          agentSenderId: null,
          content: 'Hello, I need help',
          messageType: 'text',
          createdAt: '2024-01-15T10:00:00Z',
          customerName: 'John Doe',
          agentName: null
        },
        {
          id: 'msg-2',
          conversationId: '1',
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: 2,
          content: 'Hi! How can I help you?',
          messageType: 'text',
          createdAt: '2024-01-15T10:05:00Z',
          customerName: null,
          agentName: 'Agent Smith'
        },
        {
          id: 'msg-3',
          conversationId: '1',
          senderType: 'customer',
          customerSenderId: 1,
          agentSenderId: null,
          content: '',
          messageType: 'image',
          createdAt: '2024-01-15T10:10:00Z',
          customerName: 'John Doe',
          agentName: null
        }
      ]

      mockDB.mockQueryResponses(mockMessagesData, 3)

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)

      const messages = extractResponseData(result).data.items

      // Check customer message transformation
      expect(messages[0]).toMatchObject({
        id: 'msg-1',
        conversationId: '1',
        senderType: 'user', // customer -> user
        senderId: '1', // converted to string by handler
        content: 'Hello, I need help',
        mediaType: 'text',
        platform: 'line'
      })

      // Check agent message transformation
      expect(messages[1]).toMatchObject({
        id: 'msg-2',
        conversationId: '1',
        senderType: 'agent',
        senderId: 2, // agentSenderId is kept as number
        content: 'Hi! How can I help you?',
        mediaType: 'text',
        platform: 'line'
      })

      // Check image message transformation
      expect(messages[2]).toMatchObject({
        id: 'msg-3',
        conversationId: '1',
        senderType: 'user',
        senderId: '1', // converted to string by handler
        content: '',
        mediaType: 'image',
        platform: 'line'
      })
    })

    it('should handle empty message list', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('999')

      // Mock empty results
      mockDB.mockQueryResponses([], 0)

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(0)
      expect(extractResponseData(result).data.total).toBe(0)
    })

    it('should handle database errors gracefully', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('1')

      // Mock database error
      mockDB.mockError(new Error('Database connection failed'))

      const result = await messageHandler.list(mockContext)

      expect(result.status).toBe(500)
    })
  })

  describe('send', () => {
    const mockJWTPayload = {
      id: 2, // Handler uses agent.id
      userId: 2,
      username: 'agent',
      displayName: 'Agent Smith',
      role: 'agent',
      teamId: 1,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }

    const mockConversation = {
      id: '1',
      customerId: 1,
      assignedUserId: 2,
      status: 'active',
      platform: 'line',
      platformUserId: 'U1234567890abcdef',
      createdAt: '2024-01-15T09:00:00Z',
      updatedAt: '2024-01-15T10:10:00Z'
    }

    it('should send text message successfully', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello from agent',
        mediaUrl: undefined,
        mediaType: undefined
      })

      // Mock getting the agent from context
      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return mockJWTPayload
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      // Mock conversation lookup
      mockDB.mockSelectResponse([mockConversation])

      // Mock insert response
      const insertedMessage = {
        id: 'mock-uuid-12345',
        conversationId: '1',
        agentSenderId: 2,
        customerSenderId: null,
        content: 'Hello from agent',
        messageType: 'text',
        createdAt: new Date().toISOString()
      }
      mockDB.mockInsertResponse('messages', insertedMessage)

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data).toMatchObject({
        id: 'mock-uuid-12345',
        conversationId: '1',
        senderType: 'agent',
        senderId: 2, // agent.id is a number
        content: 'Hello from agent',
        platform: 'line'
      })
    })

    it('should send media message successfully', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: '',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image'
      })

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return mockJWTPayload
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockDB.mockSelectResponse([mockConversation])

      const insertedMessage = {
        id: 'mock-uuid-12345',
        conversationId: '1',
        agentSenderId: 2,
        content: '',
        messageType: 'image',
        createdAt: new Date().toISOString()
      }
      mockDB.mockInsertResponse('messages', insertedMessage)

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data).toMatchObject({
        id: 'mock-uuid-12345',
        conversationId: '1',
        senderType: 'agent',
        senderId: 2, // agent.id is a number
        mediaType: 'image',
        platform: 'line'
      })
    })

    it('should return 422 when no content or media provided', async () => {
      const mockContext = createMockContext()

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: '',
        mediaUrl: undefined,
        mediaType: undefined
      })

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return mockJWTPayload
        if (key === 'db') return mockContext._mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      const result = await messageHandler.send(mockContext)

      expect(result.status).toBe(422)
    })

    it('should return 404 when conversation not found', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('999')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello'
      })

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return mockJWTPayload
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      // Mock empty result (conversation not found)
      mockDB.mockSelectResponse([])

      const result = await messageHandler.send(mockContext)

      expect(result.status).toBe(404)
    })

    it('should handle Facebook platform messages', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello from Facebook agent'
      })

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return mockJWTPayload
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      const facebookConversation = {
        ...mockConversation,
        platform: 'facebook',
        platformUserId: 'fb_user_123456'
      }

      mockDB.mockSelectResponse([facebookConversation])

      const insertedMessage = {
        id: 'mock-uuid-12345',
        conversationId: '1',
        agentSenderId: 2,
        content: 'Hello from Facebook agent',
        messageType: 'text',
        createdAt: new Date().toISOString()
      }
      mockDB.mockInsertResponse('messages', insertedMessage)

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.platform).toBe('facebook')
    })

    it('should handle database errors gracefully', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message'
      })

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return mockJWTPayload
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      // Mock database error
      mockDB.mockError(new Error('Database error'))

      const result = await messageHandler.send(mockContext)

      expect(result.status).toBe(500)
    })

    it('should handle malformed JSON request', async () => {
      const mockContext = createMockContext()

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'))

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return mockJWTPayload
        if (key === 'db') return mockContext._mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      const result = await messageHandler.send(mockContext)

      expect(result.status).toBe(500)
    })
  })
})
