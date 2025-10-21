// Integration Test: Message & Conversation Workflow
// Tests the complete flow of creating conversations and sending messages

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { messageHandler } from '../../src/handlers/message'
import { conversationHandler } from '../../src/handlers/conversation'
import { createMockContext } from '../helpers/testUtils'

// Mock external dependencies
vi.mock('../../src/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined),
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('../../src/utils/line', () => ({
  pushLineMessage: vi.fn().mockResolvedValue(true),
  createTextMessage: vi.fn((text) => ({ type: 'text', text }))
}))

vi.mock('../../src/services/activity-service', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    logActivity: vi.fn().mockResolvedValue({ id: 'activity-123' })
  }))
}))

vi.mock('../../src/workers/latest-message-worker', () => ({
  LatestMessageJobQueue: vi.fn().mockImplementation(() => ({
    updateLatestMessage: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.stubGlobal('crypto', {
  ...global.crypto,
  randomUUID: vi.fn(() => `test-uuid-${Date.now()}`)
})

describe('Message & Conversation Integration Tests', () => {
  describe('Complete conversation workflow', () => {
    it('should create conversation, send messages, and list messages', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      // Step 1: Create conversation mock data
      const mockConversation = {
        id: 'conv-123',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Joined customer data
        customerDisplayName: 'John Doe',
        platform: 'line',
        platformUserId: 'U123456',
        // Joined agent data
        agentDisplayName: 'Agent Smith',
        agentEmail: 'agent@example.com'
      }

      // Mock conversation creation
      mockDB.mockInsertResponse('conversations', mockConversation)

      // Step 2: Send first message
      const agent = {
        id: 2,
        displayName: 'Agent Smith',
        role: 'agent'
      }

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.param = vi.fn().mockReturnValue('conv-123')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello, how can I help you today?'
      })

      // Mock conversation lookup for send
      const conversationWithCustomer = {
        id: 'conv-123',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        platform: 'line',
        platformUserId: 'U123456'
      }
      mockDB.mockSelectResponse([conversationWithCustomer])

      const sendResult = await messageHandler.send(mockContext)
      expect(sendResult.status).toBe(200)

      // Step 3: Send second message
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Is there anything specific you need assistance with?'
      })

      const sendResult2 = await messageHandler.send(mockContext)
      expect(sendResult2.status).toBe(200)

      // Step 4: List all messages in conversation
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: 2,
          content: 'Hello, how can I help you today?',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: 'Agent Smith'
        },
        {
          id: 'msg-2',
          conversationId: 'conv-123',
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: 2,
          content: 'Is there anything specific you need assistance with?',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: 'Agent Smith'
        }
      ]

      mockDB.mockQueryResponses(mockMessages, 2)

      const listResult = await messageHandler.list(mockContext)
      expect(listResult.status).toBe(200)

      const responseData = listResult.data
      expect(responseData.success).toBe(true)
      expect(responseData.data.items).toHaveLength(2)
      expect(responseData.data.total).toBe(2)
    })

    it('should handle conversation assignment changes during active messaging', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      const agent1 = { id: 2, displayName: 'Agent 1', role: 'agent' }
      const agent2 = { id: 3, displayName: 'Agent 2', role: 'agent' }

      // Initially assigned to agent1
      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent1
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.param = vi.fn().mockReturnValue('conv-456')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Message from agent 1'
      })

      const conversationData = {
        id: 'conv-456',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        platform: 'line',
        platformUserId: 'U789'
      }

      mockDB.mockSelectResponse([conversationData])

      const result1 = await messageHandler.send(mockContext)
      expect(result1.status).toBe(200)

      // Reassign to agent2
      conversationData.assignedUserId = 3
      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent2
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Message from agent 2 after reassignment'
      })

      mockDB.mockSelectResponse([conversationData])

      const result2 = await messageHandler.send(mockContext)
      expect(result2.status).toBe(200)
    })
  })

  describe('Multi-platform message handling', () => {
    it('should handle messages across LINE and Facebook platforms', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      const agent = { id: 2, displayName: 'Agent', role: 'agent' }

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      // Test LINE conversation
      mockContext.req.param = vi.fn().mockReturnValue('line-conv')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'LINE message'
      })

      const lineConversation = {
        id: 'line-conv',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        platform: 'line',
        platformUserId: 'U_LINE_123'
      }

      mockDB.mockSelectResponse([lineConversation])

      const lineResult = await messageHandler.send(mockContext)
      expect(lineResult.status).toBe(200)

      // Test Facebook conversation
      mockContext.req.param = vi.fn().mockReturnValue('fb-conv')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Facebook message'
      })

      const fbConversation = {
        id: 'fb-conv',
        customerId: 2,
        assignedUserId: 2,
        status: 'active',
        platform: 'facebook',
        platformUserId: 'FB_USER_456'
      }

      mockDB.mockSelectResponse([fbConversation])

      const fbResult = await messageHandler.send(mockContext)
      expect(fbResult.status).toBe(200)
    })
  })

  describe('Error recovery and resilience', () => {
    it('should handle partial failures gracefully', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      const agent = { id: 2, displayName: 'Agent', role: 'agent' }

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.param = vi.fn().mockReturnValue('conv-789')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message'
      })

      // First attempt: database error
      mockDB.mockError(new Error('Temporary database error'))

      const errorResult = await messageHandler.send(mockContext)
      expect(errorResult.status).toBe(500)

      // Second attempt: success after recovery
      const conversationData = {
        id: 'conv-789',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        platform: 'line',
        platformUserId: 'U999'
      }

      mockDB.mockSelectResponse([conversationData])

      const successResult = await messageHandler.send(mockContext)
      expect(successResult.status).toBe(200)
    })
  })

  describe('Pagination and data consistency', () => {
    it('should maintain data consistency across paginated message lists', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      mockContext.req.param = vi.fn().mockReturnValue('conv-page-test')

      // Page 1: First 10 messages
      mockContext.req.query = vi.fn((key?: string) => {
        const params: Record<string, string> = {
          page: '1',
          pageSize: '10'
        }
        return key ? params[key] : params
      })

      const page1Messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i + 1}`,
        conversationId: 'conv-page-test',
        senderType: i % 2 === 0 ? 'customer' : 'agent',
        customerSenderId: i % 2 === 0 ? 1 : null,
        agentSenderId: i % 2 === 0 ? null : 2,
        content: `Message ${i + 1}`,
        messageType: 'text',
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        customerName: i % 2 === 0 ? 'Customer' : null,
        agentName: i % 2 === 0 ? null : 'Agent'
      }))

      mockDB.mockQueryResponses(page1Messages, 25)

      const page1Result = await messageHandler.list(mockContext)
      expect(page1Result.data.success).toBe(true)
      expect(page1Result.data.data.items).toHaveLength(10)
      expect(page1Result.data.data.total).toBe(25)
      expect(page1Result.data.data.page).toBe(1)

      // Page 2: Next 10 messages
      mockContext.req.query = vi.fn((key?: string) => {
        const params: Record<string, string> = {
          page: '2',
          pageSize: '10'
        }
        return key ? params[key] : params
      })

      const page2Messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i + 11}`,
        conversationId: 'conv-page-test',
        senderType: i % 2 === 0 ? 'customer' : 'agent',
        customerSenderId: i % 2 === 0 ? 1 : null,
        agentSenderId: i % 2 === 0 ? null : 2,
        content: `Message ${i + 11}`,
        messageType: 'text',
        createdAt: new Date(Date.now() + (i + 10) * 1000).toISOString(),
        customerName: i % 2 === 0 ? 'Customer' : null,
        agentName: i % 2 === 0 ? null : 'Agent'
      }))

      mockDB.mockQueryResponses(page2Messages, 25)

      const page2Result = await messageHandler.list(mockContext)
      expect(page2Result.data.success).toBe(true)
      expect(page2Result.data.data.items).toHaveLength(10)
      expect(page2Result.data.data.total).toBe(25)
      expect(page2Result.data.data.page).toBe(2)
    })
  })
})
