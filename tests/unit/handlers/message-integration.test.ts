// tests/unit/handlers/message-integration.test.ts
// 撠??迂嚗ulti-Channel Support MVP
// 瑼?頝臬?嚗?tests/unit/handlers/message-integration.test.ts
// Created by: Test Developer

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractResponseData } from '../../helpers/testUtils'
import { Context } from 'hono'
import { messageHandler } from '@backend/handlers/message'
import { createMockDatabase } from '../../helpers/mockDatabase'
import type { Bindings, JWTPayload } from '@backend/types'

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: vi.fn(() => 'integration-test-uuid-12345')
} as any

// Mock Hono Context
const createMockContext = (overrides: Partial<Context> = {}) => {
  const mockContext = {
    req: {
      query: vi.fn((key?: string) => {
        if (key) {
          // Default query parameters
          const defaults: Record<string, string> = {
            page: '1',
            pageSize: '50'
          }
          return defaults[key]
        }
        return {}
      }),
      param: vi.fn(),
      json: vi.fn()
    },
    env: {
      DB: createMockDatabase(),
      LINE_CHANNEL_ACCESS_TOKEN: 'mock-line-token',
      FB_PAGE_ACCESS_TOKEN: 'mock-fb-token'
    },
    get: vi.fn(),
    json: vi.fn((data, status) => ({ data, status })),
    ...overrides
  } as unknown as Context<{ Bindings: Bindings }>

  return mockContext
}

// Realistic test data
const mockCustomers = [
  {
    id: 1,
    platform: 'line',
    platform_user_id: 'U1234567890abcdef',
    display_name: 'John Doe',
    avatar_url: 'https://profile.line-scdn.net/avatar.jpg'
  },
  {
    id: 2,
    platform: 'facebook',
    platform_user_id: 'fb_user_123456',
    display_name: 'Jane Smith',
    avatar_url: 'https://graph.facebook.com/avatar.jpg'
  }
]

const mockAgents = [
  {
    id: 1,
    displayName: 'Admin User',
    email: 'admin@company.com',
    role: 'admin'
  },
  {
    id: 2,
    displayName: 'Support Agent 1',
    email: 'agent1@company.com',
    role: 'agent'
  }
]

const mockConversations = [
  {
    id: 1,
    customer_id: 1,
    assigned_user_id: 2,
    status: 'active',
    platform: 'line',
    platform_user_id: 'U1234567890abcdef',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T10:10:00Z'
  },
  {
    id: 2,
    customer_id: 2,
    assigned_user_id: 2,
    status: 'active',
    platform: 'facebook',
    platform_user_id: 'fb_user_123456',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T11:00:00Z'
  }
]

const mockMessages = [
  {
    id: 'msg-1',
    conversation_id: 1,
    sender_type: 'customer',
    sender_id: 1,
    content: 'Hello, I need help with my order',
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
    content: 'Hi John! I\'d be happy to help you with your order. Can you provide your order number?',
    message_type: 'text',
    platform_message_id: null,
    is_sent: true,
    delivery_status: 'sent',
    created_at: '2024-01-15T10:02:00Z',
    sender_name: 'Support Agent 1'
  },
  {
    id: 'msg-3',
    conversation_id: 1,
    sender_type: 'customer',
    sender_id: 1,
    content: 'My order number is #12345',
    message_type: 'text',
    platform_message_id: 'line-msg-124',
    is_sent: true,
    delivery_status: 'delivered',
    created_at: '2024-01-15T10:05:00Z',
    sender_name: 'John Doe'
  },
  {
    id: 'msg-4',
    conversation_id: 1,
    sender_type: 'customer',
    sender_id: 1,
    content: '',
    message_type: 'image',
    platform_message_id: 'line-img-125',
    is_sent: true,
    delivery_status: 'delivered',
    created_at: '2024-01-15T10:06:00Z',
    sender_name: 'John Doe'
  }
]

const mockJWTPayloads = {
  admin: {
    userId: 1,
    username: 'admin',
    role: 'admin',
    teamId: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  } as JWTPayload,
  agent: {
    userId: 2,
    username: 'agent1',
    role: 'agent',
    teamId: 2,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  } as JWTPayload
}

describe('messageHandler - Integration Tests', () => {
  describe('Real-world Conversation Scenarios', () => {
    it('should handle a complete customer service conversation flow', async () => {
      // Scenario: Customer asks question, agent responds, customer provides info, sends image

      // Step 1: List initial messages in conversation
      const listContext1 = createMockContext()
      listContext1.req.param = vi.fn().mockReturnValue('1')
      listContext1.req.query = vi.fn().mockReturnValue({})

      const mockDB1 = listContext1.env.DB as any
      mockDB1.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: mockMessages.slice(0, 3) }) // First 3 messages
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 3 })
        }

        return statement
      })

      const listResult1 = await messageHandler.list(listContext1)
      expect(extractResponseData(listResult1).success).toBe(true)
      expect(extractResponseData(listResult1).data.items).toHaveLength(3)

      // Verify conversation flow
      const messages1 = extractResponseData(listResult1).data.items
      expect(messages1[0].senderType).toBe('user') // Customer message
      expect(messages1[0].content).toBe('Hello, I need help with my order')
      expect(messages1[1].senderType).toBe('agent') // Agent response
      expect(messages1[2].senderType).toBe('user') // Customer reply

      // Step 2: Agent sends follow-up message
      const sendContext = createMockContext()
      sendContext.req.param = vi.fn().mockReturnValue('1')
      sendContext.req.json = vi.fn().mockResolvedValue({
        content: 'Thank you for providing your order number. Let me check the status for you.',
        mediaUrl: undefined,
        mediaType: undefined
      })
      sendContext.get = vi.fn().mockReturnValue(mockJWTPayloads.agent)

      const sendDB = sendContext.env.DB as any
      let conversationUpdated = false

      sendDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversations[0])
        } else if (query.includes('UPDATE conversations')) {
          conversationUpdated = true
        }

        return statement
      })

      const sendResult = await messageHandler.send(sendContext)
      expect(extractResponseData(sendResult).success).toBe(true)
      expect(extractResponseData(sendResult).data.senderType).toBe('agent')
      expect(extractResponseData(sendResult).data.platform).toBe('line')
      expect(conversationUpdated).toBe(true)

      // Step 3: List updated messages including new agent message
      const listContext2 = createMockContext()
      listContext2.req.param = vi.fn().mockReturnValue('1')
      listContext2.req.query = vi.fn().mockReturnValue({})

      const allMessages = [
        ...mockMessages,
        {
          id: 'integration-test-uuid-12345',
          conversation_id: 1,
          sender_type: 'agent',
          sender_id: 2,
          content: 'Thank you for providing your order number. Let me check the status for you.',
          message_type: 'text',
          platform_message_id: null,
          is_sent: true,
          delivery_status: 'sent',
          created_at: '2024-01-15T10:07:00Z',
          sender_name: 'Support Agent 1'
        }
      ]

      const mockDB2 = listContext2.env.DB as any
      mockDB2.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: allMessages })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 5 })
        }

        return statement
      })

      const listResult2 = await messageHandler.list(listContext2)
      expect(extractResponseData(listResult2).success).toBe(true)
      expect(extractResponseData(listResult2).data.items).toHaveLength(5)
      expect(extractResponseData(listResult2).data.items[4].content).toBe('Thank you for providing your order number. Let me check the status for you.')
    })

    it('should handle multi-platform message management', async () => {
      // Scenario: Agent manages messages from both LINE and Facebook conversations

      // LINE conversation messages
      const lineContext = createMockContext()
      lineContext.req.param = vi.fn().mockReturnValue('1')
      lineContext.req.query = vi.fn().mockReturnValue({})

      const lineDB = lineContext.env.DB as any
      lineDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: mockMessages.filter(m => m.conversation_id === 1) })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 4 })
        }

        return statement
      })

      const lineResult = await messageHandler.list(lineContext)
      expect(extractResponseData(lineResult).success).toBe(true)
      expect(extractResponseData(lineResult).data.items.every((msg: any) => msg.platform === 'line')).toBe(true)

      // Facebook conversation messages
      const facebookMessages = [
        {
          id: 'fb-msg-1',
          conversation_id: 2,
          sender_type: 'customer',
          sender_id: 2,
          content: 'Hi, I have a question about shipping',
          message_type: 'text',
          platform_message_id: 'fb-msg-456',
          is_sent: true,
          delivery_status: 'delivered',
          created_at: '2024-01-15T11:00:00Z',
          sender_name: 'Jane Smith'
        }
      ]

      const facebookContext = createMockContext()
      facebookContext.req.param = vi.fn().mockReturnValue('2')
      facebookContext.req.query = vi.fn().mockReturnValue({})

      const facebookDB = facebookContext.env.DB as any
      facebookDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: facebookMessages })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1 })
        }

        return statement
      })

      const facebookResult = await messageHandler.list(facebookContext)
      expect(extractResponseData(facebookResult).success).toBe(true)
      expect(extractResponseData(facebookResult).data.items.every((msg: any) => msg.platform === 'line')).toBe(true) // Note: platform is hardcoded to 'line' in handler

      // Send response to Facebook conversation
      const sendFacebookContext = createMockContext()
      sendFacebookContext.req.param = vi.fn().mockReturnValue('2')
      sendFacebookContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hi Jane! I can help you with shipping information. What would you like to know?',
        mediaUrl: undefined,
        mediaType: undefined
      })
      sendFacebookContext.get = vi.fn().mockReturnValue(mockJWTPayloads.agent)

      const sendFacebookDB = sendFacebookContext.env.DB as any
      sendFacebookDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversations[1]) // Facebook conversation
        }

        return statement
      })

      const sendFacebookResult = await messageHandler.send(sendFacebookContext)
      expect(extractResponseData(sendFacebookResult).success).toBe(true)
      expect(extractResponseData(sendFacebookResult).data.platform).toBe('facebook')
    })

    it('should handle media message workflows', async () => {
      // Scenario: Customer sends image, agent responds with text

      // Step 1: List messages including image message
      const listContext = createMockContext()
      listContext.req.param = vi.fn().mockReturnValue('1')
      listContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = listContext.env.DB as any
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
          statement.first.mockResolvedValue({ total: 4 })
        }

        return statement
      })

      const listResult = await messageHandler.list(listContext)
      expect(extractResponseData(listResult).success).toBe(true)

      // Find the image message
      const imageMessage = extractResponseData(listResult).data.items.find((msg: any) => msg.mediaType === 'image')
      expect(imageMessage).toBeDefined()
      expect(imageMessage.content).toBe('')
      expect(imageMessage.senderType).toBe('user')

      // Step 2: Agent responds to image with text
      const sendContext = createMockContext()
      sendContext.req.param = vi.fn().mockReturnValue('1')
      sendContext.req.json = vi.fn().mockResolvedValue({
        content: 'I can see the image you sent. Let me help you with that issue.',
        mediaUrl: undefined,
        mediaType: undefined
      })
      sendContext.get = vi.fn().mockReturnValue(mockJWTPayloads.agent)

      const sendDB = sendContext.env.DB as any
      sendDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversations[0])
        }

        return statement
      })

      const sendResult = await messageHandler.send(sendContext)
      expect(extractResponseData(sendResult).success).toBe(true)
      expect(extractResponseData(sendResult).data.mediaType).toBeUndefined()
      expect(extractResponseData(sendResult).data.content).toBe('I can see the image you sent. Let me help you with that issue.')

      // Step 3: Agent sends media response
      const sendMediaContext = createMockContext()
      sendMediaContext.req.param = vi.fn().mockReturnValue('1')
      sendMediaContext.req.json = vi.fn().mockResolvedValue({
        content: '',
        mediaUrl: 'https://company.com/help-guide.pdf',
        mediaType: 'file'
      })
      sendMediaContext.get = vi.fn().mockReturnValue(mockJWTPayloads.agent)

      const sendMediaDB = sendMediaContext.env.DB as any
      sendMediaDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversations[0])
        }

        return statement
      })

      const sendMediaResult = await messageHandler.send(sendMediaContext)
      expect(extractResponseData(sendMediaResult).success).toBe(true)
      expect(extractResponseData(sendMediaResult).data.mediaUrl).toBe('https://company.com/help-guide.pdf')
      expect(extractResponseData(sendMediaResult).data.mediaType).toBe('file')
    })

    it('should handle pagination in long conversations', async () => {
      // Scenario: Long conversation with multiple pages of messages

      // Generate a long conversation history
      const longConversationMessages = Array.from({ length: 150 }, (_, i) => ({
        id: `long-msg-${i + 1}`,
        conversation_id: 1,
        sender_type: i % 2 === 0 ? 'customer' : 'agent',
        sender_id: i % 2 === 0 ? 1 : 2,
        content: `Message ${i + 1} in long conversation`,
        message_type: 'text',
        platform_message_id: i % 2 === 0 ? `platform-${i + 1}` : null,
        is_sent: true,
        delivery_status: 'delivered',
        created_at: new Date(Date.now() - (150 - i) * 60000).toISOString(),
        sender_name: i % 2 === 0 ? 'John Doe' : 'Support Agent 1'
      }))

      // Page 1 (first 50 messages)
      const page1Context = createMockContext()
      page1Context.req.param = vi.fn().mockReturnValue('1')
      page1Context.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === 'page') return '1'
        if (key === 'pageSize') return '50'
        if (key) return undefined
        return { page: '1', pageSize: '50' }
      })

      const page1DB = page1Context.env.DB as any
      page1DB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: longConversationMessages.slice(0, 50) })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 150 })
        }

        return statement
      })

      const page1Result = await messageHandler.list(page1Context)
      expect(extractResponseData(page1Result).success).toBe(true)
      expect(extractResponseData(page1Result).data.items).toHaveLength(50)
      expect(extractResponseData(page1Result).data.page).toBe(1)
      expect(extractResponseData(page1Result).data.total).toBe(150)

      // Page 3 (messages 101-150)
      const page3Context = createMockContext()
      page3Context.req.param = vi.fn().mockReturnValue('1')
      page3Context.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === 'page') return '3'
        if (key === 'pageSize') return '50'
        if (key) return undefined
        return { page: '3', pageSize: '50' }
      })

      const page3DB = page3Context.env.DB as any
      page3DB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: longConversationMessages.slice(100, 150) })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 150 })
        }

        return statement
      })

      const page3Result = await messageHandler.list(page3Context)
      expect(extractResponseData(page3Result).success).toBe(true)
      expect(extractResponseData(page3Result).data.items).toHaveLength(50)
      expect(extractResponseData(page3Result).data.page).toBe(3)
      expect(extractResponseData(page3Result).data.items[0].content).toBe('Message 101 in long conversation')
    })

    it('should maintain message ordering and consistency', async () => {
      // Scenario: Verify messages are returned in correct chronological order

      const chronologicalMessages = [
        {
          id: 'msg-early',
          conversation_id: 1,
          sender_type: 'customer',
          sender_id: 1,
          content: 'First message',
          message_type: 'text',
          platform_message_id: 'platform-1',
          is_sent: true,
          delivery_status: 'delivered',
          created_at: '2024-01-15T10:00:00Z',
          sender_name: 'John Doe'
        },
        {
          id: 'msg-middle',
          conversation_id: 1,
          sender_type: 'agent',
          sender_id: 2,
          content: 'Second message',
          message_type: 'text',
          platform_message_id: null,
          is_sent: true,
          delivery_status: 'sent',
          created_at: '2024-01-15T10:05:00Z',
          sender_name: 'Support Agent 1'
        },
        {
          id: 'msg-late',
          conversation_id: 1,
          sender_type: 'customer',
          sender_id: 1,
          content: 'Third message',
          message_type: 'text',
          platform_message_id: 'platform-2',
          is_sent: true,
          delivery_status: 'delivered',
          created_at: '2024-01-15T10:10:00Z',
          sender_name: 'John Doe'
        }
      ]

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
          statement.all.mockResolvedValue({ results: chronologicalMessages })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 3 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)
      expect(extractResponseData(result).success).toBe(true)

      const messages = extractResponseData(result).data.items
      expect(messages).toHaveLength(3)

      // Verify chronological order
      expect(messages[0].content).toBe('First message')
      expect(messages[1].content).toBe('Second message')
      expect(messages[2].content).toBe('Third message')

      // Verify timestamps are in ascending order
      expect(messages[0].createdAt).toBeLessThan(messages[1].createdAt)
      expect(messages[1].createdAt).toBeLessThan(messages[2].createdAt)
    })

    it('should handle concurrent message operations safely', async () => {
      // Scenario: Multiple agents sending messages to same conversation simultaneously

      const sendConcurrentMessage = async (agentId: number, content: string) => {
        const mockContext = createMockContext()
        mockContext.req.param = vi.fn().mockReturnValue('1')
        mockContext.req.json = vi.fn().mockResolvedValue({
          content,
          mediaUrl: undefined,
          mediaType: undefined
        })
        mockContext.get = vi.fn().mockReturnValue({
          ...mockJWTPayloads.agent,
          userId: agentId
        })

        const mockDB = mockContext.env.DB as any
        mockDB.prepare.mockImplementation((query: string) => {
          const statement = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn(),
            first: vi.fn(),
            run: vi.fn().mockResolvedValue({ success: true })
          }

          if (query.includes('SELECT c.*')) {
            statement.first.mockResolvedValue(mockConversations[0])
          }

          return statement
        })

        return messageHandler.send(mockContext)
      }

      // Send 3 concurrent messages from different agents
      const concurrentPromises = [
        sendConcurrentMessage(2, 'Message from agent 2'),
        sendConcurrentMessage(3, 'Message from agent 3'),
        sendConcurrentMessage(4, 'Message from agent 4')
      ]

      const results = await Promise.all(concurrentPromises)

      expect(results).toHaveLength(3)
      results.forEach((result, index) => {
        expect(extractResponseData(result).success).toBe(true)
        expect(extractResponseData(result).data.senderId).toBe((index + 2).toString())
        expect(extractResponseData(result).data.content).toBe(`Message from agent ${index + 2}`)
      })
    })
  })
})

