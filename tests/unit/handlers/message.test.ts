// tests/unit/handlers/message.test.ts
// 撠??迂嚗ulti-Channel Support MVP
// 瑼?頝臬?嚗?tests/unit/handlers/message.test.ts
// Created by: Test Developer

import { describe, it, expect, vi } from 'vitest'
import { messageHandler } from '@backend/handlers/message'
import {
  createMockContext,
  createMockJWTPayload,
  createMockMessage,
  createMockConversation,
  extractResponseData
} from '../../helpers/testUtils'
import { JWTPayload } from 'hono/utils/jwt/types'

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: vi.fn(() => 'mock-uuid-12345')
} as any

// Test data
const mockMessages = [
  {
    id: 'msg-1',
    conversation_id: 1,
    sender_type: 'customer',
    sender_id: 1,
    content: 'Hello, I need help',
    message_type: 'text',
    platform_message_id: 'line-msg-123',
    is_sent: true,
    delivery_status: 'delivered',
    created_at: '2024-01-15T10:00:00Z',
    sender_name: 'John Doe'
  },
  {
    id: 'msg-2',
    conversation_id: 1,
    sender_type: 'agent',
    sender_id: 2,
    content: 'Hi! How can I help you?',
    message_type: 'text',
    platform_message_id: null,
    is_sent: true,
    delivery_status: 'sent',
    created_at: '2024-01-15T10:05:00Z',
    sender_name: 'Agent Smith'
  },
  {
    id: 'msg-3',
    conversation_id: 1,
    sender_type: 'customer',
    sender_id: 1,
    content: '',
    message_type: 'image',
    platform_message_id: 'line-img-456',
    is_sent: true,
    delivery_status: 'delivered',
    created_at: '2024-01-15T10:10:00Z',
    sender_name: 'John Doe'
  }
]

const mockConversation = {
  id: 1,
  customer_id: 1,
  assigned_user_id: 2,
  status: 'active',
  platform: 'line',
  platform_user_id: 'U1234567890abcdef',
  created_at: '2024-01-15T09:00:00Z',
  updated_at: '2024-01-15T10:10:00Z'
}

const mockJWTPayload: JWTPayload = {
  userId: 2,
  username: 'agent',
  role: 'agent',
  teamId: 1,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
}

describe('messageHandler', () => {
  describe('list', () => {
    it('should return messages list with default pagination', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: mockMessages })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 3 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(3)
      expect(extractResponseData(result).data.total).toBe(3)
      expect(extractResponseData(result).data.page).toBe(1)
      expect(extractResponseData(result).data.pageSize).toBe(50)
    })

    it('should handle custom pagination parameters', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key) {
          const params: Record<string, string> = {
            page: '2',
            pageSize: '10'
          }
          return params[key]
        }
        return { page: '2', pageSize: '10' }
      })

      const mockDB = mockContext.env.DB as any
      let capturedParams: any[] = []

      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn((...params) => {
            if (query.includes('SELECT m.*')) {
              capturedParams = params
            }
            return statement
          }),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: [] })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 25 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.page).toBe(2)
      expect(extractResponseData(result).data.pageSize).toBe(10)
      expect(extractResponseData(result).data.total).toBe(25)

      // Verify pagination parameters: conversationId, pageSize, offset
      expect(capturedParams[0]).toBe('1') // conversationId
      expect(capturedParams[1]).toBe(10) // pageSize
      expect(capturedParams[2]).toBe(10) // offset (page 2 - 1) * 10
    })

    it('should transform message data correctly', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: mockMessages })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 3 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)

      const messages = extractResponseData(result).data.items

      // Check customer message transformation
      expect(messages[0]).toMatchObject({
        id: 'msg-1',
        conversationId: '1',
        senderType: 'user', // customer -> user
        senderId: '1',
        content: 'Hello, I need help',
        mediaType: undefined, // text message
        platform: 'line'
      })

      // Check agent message transformation
      expect(messages[1]).toMatchObject({
        id: 'msg-2',
        conversationId: '1',
        senderType: 'agent',
        senderId: '2',
        content: 'Hi! How can I help you?',
        mediaType: undefined, // text message
        platform: 'line'
      })

      // Check image message transformation
      expect(messages[2]).toMatchObject({
        id: 'msg-3',
        conversationId: '1',
        senderType: 'user',
        senderId: '1',
        content: '',
        mediaType: 'image',
        platform: 'line'
      })
    })

    it('should handle empty message list', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('999')
      mockContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: [] })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 0 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(0)
      expect(extractResponseData(result).data.total).toBe(0)
    })

    it('should handle database errors gracefully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('Failed to get messages')
      expect(result.status).toBe(500)
    })
  })

  describe('send', () => {
    it('should send text message successfully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello from agent',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data).toMatchObject({
        id: 'mock-uuid-12345',
        conversationId: '1',
        senderType: 'agent',
        senderId: '2',
        content: 'Hello from agent',
        platform: 'line'
      })
    })

    it('should send media message successfully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: '',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image'
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data).toMatchObject({
        id: 'mock-uuid-12345',
        conversationId: '1',
        senderType: 'agent',
        senderId: '2',
        content: '',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
        platform: 'line'
      })
    })

    it('should return 400 when no content or media provided', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: '',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('Content or media is required')
      expect(result.status).toBe(400)
    })

    it('should return 404 when conversation not found', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('999')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(null)
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('Conversation not found')
      expect(result.status).toBe(404)
    })

    it('should handle Facebook platform messages', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello from Facebook agent',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const facebookConversation = {
        ...mockConversation,
        platform: 'facebook',
        platform_user_id: 'fb_user_123456'
      }

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(facebookConversation)
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.platform).toBe('facebook')
    })

    it('should update conversation last message time', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      let updateConversationCalled = false

      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        } else if (query.includes('UPDATE conversations')) {
          updateConversationCalled = true
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(updateConversationCalled).toBe(true)
    })

    it('should handle database errors gracefully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        throw new Error('Database error')
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('訊息發送失敗')
      expect(result.status).toBe(500)
    })

    it('should handle malformed JSON request', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('訊息發送失敗')
      expect(result.status).toBe(500)
    })

    it('should store message with correct parameters', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
        mediaUrl: undefined,
        mediaType: 'text'
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      let insertParams: any[] = []

      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn((...params) => {
            if (query.includes('INSERT INTO messages')) {
              insertParams = params
            }
            return statement
          }),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(insertParams).toEqual([
        'mock-uuid-12345', // messageId
        '1', // conversationId
        2, // payload.userId
        'Test message', // content
        'text', // messageType
        null // platform_message_id
      ])
    })
  })
})

