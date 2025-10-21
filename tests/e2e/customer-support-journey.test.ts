// E2E Test: Complete Customer Support Journey
// Tests the entire flow from customer inquiry to resolution

import { describe, it, expect, vi } from 'vitest'
import { messageHandler } from '../../src/handlers/message'
import { conversationHandler } from '../../src/handlers/conversation'
import { createMockContext } from '../helpers/testUtils'

// Mock all external dependencies
vi.mock('../../src/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined),
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined),
    broadcastTypingEvent: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('../../src/utils/line', () => ({
  pushLineMessage: vi.fn().mockResolvedValue(true),
  createTextMessage: vi.fn((text) => ({ type: 'text', text })),
  createImageMessage: vi.fn((url) => ({ type: 'image', originalContentUrl: url, previewImageUrl: url }))
}))

vi.mock('../../src/integrations/platform-adapter', () => ({
  FacebookAdapter: vi.fn().mockImplementation(() => ({
    sendTextMessage: vi.fn().mockResolvedValue(true),
    sendImageMessage: vi.fn().mockResolvedValue(true)
  }))
}))

vi.mock('../../src/services/activity-service', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    logActivity: vi.fn().mockResolvedValue({ id: `activity-${Date.now()}` })
  }))
}))

vi.mock('../../src/workers/latest-message-worker', () => ({
  LatestMessageJobQueue: vi.fn().mockImplementation(() => ({
    updateLatestMessage: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.stubGlobal('crypto', {
  ...global.crypto,
  randomUUID: vi.fn(() => `uuid-${Date.now()}-${Math.random()}`)
})

describe('E2E: Complete Customer Support Journey', () => {
  describe('Scenario 1: New customer inquiry on LINE', () => {
    it('should handle complete journey from inquiry to resolution', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      const customer = {
        id: 1,
        platform: 'line',
        platformUserId: 'U_LINE_CUSTOMER_001',
        displayName: 'John Doe'
      }

      const agent = {
        id: 2,
        displayName: 'Support Agent Alice',
        email: 'alice@support.com',
        role: 'agent',
        teamId: 1
      }

      // === PHASE 1: Customer initiates conversation ===
      const conversation = {
        id: 'conv-e2e-001',
        customerId: customer.id,
        assignedUserId: null, // Not yet assigned
        status: 'pending',
        platform: customer.platform,
        platformUserId: customer.platformUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customerDisplayName: customer.displayName,
        agentDisplayName: null,
        agentEmail: null
      }

      mockDB.mockSelectResponse([conversation])

      // === PHASE 2: Agent picks up the conversation ===
      conversation.assignedUserId = agent.id
      conversation.status = 'active'
      conversation.agentDisplayName = agent.displayName
      conversation.agentEmail = agent.email

      mockDB.mockUpdateResponse('conversations', 1)

      // === PHASE 3: Agent sends greeting message ===
      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.param = vi.fn().mockReturnValue(conversation.id)
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello! Thank you for contacting us. How can I help you today?'
      })

      const conversationWithCustomer = {
        id: conversation.id,
        customerId: customer.id,
        assignedUserId: agent.id,
        status: 'active',
        platform: customer.platform,
        platformUserId: customer.platformUserId
      }

      mockDB.mockSelectResponse([conversationWithCustomer])

      const greetingResult = await messageHandler.send(mockContext)
      expect(greetingResult.status).toBe(200)
      expect(greetingResult.data.success).toBe(true)

      // === PHASE 4: Customer responds with issue ===
      const customerMessage = {
        id: 'msg-customer-001',
        conversationId: conversation.id,
        senderType: 'customer',
        customerSenderId: customer.id,
        agentSenderId: null,
        content: 'I have a problem with my order #12345',
        messageType: 'text',
        createdAt: new Date().toISOString(),
        customerName: customer.displayName,
        agentName: null
      }

      // === PHASE 5: Agent requests more information ===
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'I understand you have an issue with order #12345. Could you please provide more details about the problem?'
      })

      const followUpResult = await messageHandler.send(mockContext)
      expect(followUpResult.status).toBe(200)

      // === PHASE 6: Customer provides details ===
      const customerDetailMessage = {
        id: 'msg-customer-002',
        conversationId: conversation.id,
        senderType: 'customer',
        customerSenderId: customer.id,
        agentSenderId: null,
        content: 'The item was damaged when it arrived',
        messageType: 'text',
        createdAt: new Date().toISOString(),
        customerName: customer.displayName,
        agentName: null
      }

      // === PHASE 7: Agent sends image message (showing replacement process) ===
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Here is how the replacement process works',
        mediaUrl: 'https://example.com/replacement-guide.jpg',
        mediaType: 'image'
      })

      const imageMessageResult = await messageHandler.send(mockContext)
      expect(imageMessageResult.status).toBe(200)

      // === PHASE 8: Agent provides solution ===
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'I have initiated a replacement for your order. You should receive it within 3-5 business days. Is there anything else I can help you with?'
      })

      const solutionResult = await messageHandler.send(mockContext)
      expect(solutionResult.status).toBe(200)

      // === PHASE 9: Customer confirms satisfaction ===
      const confirmationMessage = {
        id: 'msg-customer-003',
        conversationId: conversation.id,
        senderType: 'customer',
        customerSenderId: customer.id,
        agentSenderId: null,
        content: 'Thank you! That resolves my issue.',
        messageType: 'text',
        createdAt: new Date().toISOString(),
        customerName: customer.displayName,
        agentName: null
      }

      // === PHASE 10: Agent closes conversation ===
      conversation.status = 'resolved'
      mockDB.mockUpdateResponse('conversations', 1)

      // === PHASE 11: Verify complete message history ===
      const allMessages = [
        {
          id: 'msg-agent-001',
          conversationId: conversation.id,
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: agent.id,
          content: 'Hello! Thank you for contacting us. How can I help you today?',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: agent.displayName
        },
        customerMessage,
        {
          id: 'msg-agent-002',
          conversationId: conversation.id,
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: agent.id,
          content: 'I understand you have an issue with order #12345. Could you please provide more details about the problem?',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: agent.displayName
        },
        customerDetailMessage,
        {
          id: 'msg-agent-003',
          conversationId: conversation.id,
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: agent.id,
          content: 'Here is how the replacement process works',
          messageType: 'image',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: agent.displayName
        },
        {
          id: 'msg-agent-004',
          conversationId: conversation.id,
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: agent.id,
          content: 'I have initiated a replacement for your order. You should receive it within 3-5 business days. Is there anything else I can help you with?',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: agent.displayName
        },
        confirmationMessage
      ]

      mockDB.mockQueryResponses(allMessages, allMessages.length)

      const historyResult = await messageHandler.list(mockContext)
      expect(historyResult.status).toBe(200)
      expect(historyResult.data.data.items).toHaveLength(7)
      expect(historyResult.data.data.total).toBe(7)
    })
  })

  describe('Scenario 2: Multi-agent collaboration', () => {
    it('should handle conversation handoff between agents', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      const customer = {
        id: 3,
        platform: 'facebook',
        platformUserId: 'FB_USER_002',
        displayName: 'Jane Smith'
      }

      const agent1 = {
        id: 4,
        displayName: 'Agent Bob',
        role: 'agent',
        teamId: 1
      }

      const agent2 = {
        id: 5,
        displayName: 'Senior Agent Carol',
        role: 'agent',
        teamId: 1
      }

      const conversation = {
        id: 'conv-e2e-002',
        customerId: customer.id,
        assignedUserId: agent1.id,
        status: 'active',
        platform: customer.platform,
        platformUserId: customer.platformUserId
      }

      // Agent 1 starts conversation
      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent1
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.param = vi.fn().mockReturnValue(conversation.id)
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello! How can I assist you today?'
      })

      mockDB.mockSelectResponse([conversation])

      const agent1Message1 = await messageHandler.send(mockContext)
      expect(agent1Message1.status).toBe(200)

      // Customer asks complex question
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Let me transfer you to a senior agent who can better assist with this.'
      })

      const agent1Message2 = await messageHandler.send(mockContext)
      expect(agent1Message2.status).toBe(200)

      // Conversation reassigned to agent 2
      conversation.assignedUserId = agent2.id
      mockDB.mockUpdateResponse('conversations', 1)

      // Agent 2 takes over
      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent2
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Hello, I am a senior agent and I will help you with your complex issue.'
      })

      mockDB.mockSelectResponse([conversation])

      const agent2Message = await messageHandler.send(mockContext)
      expect(agent2Message.status).toBe(200)

      // Verify conversation history includes both agents' messages
      const messages = [
        {
          id: 'msg-1',
          conversationId: conversation.id,
          senderType: 'agent',
          agentSenderId: agent1.id,
          content: 'Hello! How can I assist you today?',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: agent1.displayName
        },
        {
          id: 'msg-2',
          conversationId: conversation.id,
          senderType: 'agent',
          agentSenderId: agent1.id,
          content: 'Let me transfer you to a senior agent who can better assist with this.',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: agent1.displayName
        },
        {
          id: 'msg-3',
          conversationId: conversation.id,
          senderType: 'agent',
          agentSenderId: agent2.id,
          content: 'Hello, I am a senior agent and I will help you with your complex issue.',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          customerName: null,
          agentName: agent2.displayName
        }
      ]

      mockDB.mockQueryResponses(messages, 3)

      const historyResult = await messageHandler.list(mockContext)
      expect(historyResult.status).toBe(200)
      expect(historyResult.data.data.items).toHaveLength(3)

      // Verify both agents' messages are present
      const items = historyResult.data.data.items
      const agent1Messages = items.filter((m: any) => m.senderId === agent1.id)
      const agent2Messages = items.filter((m: any) => m.senderId === agent2.id)

      expect(agent1Messages).toHaveLength(2)
      expect(agent2Messages).toHaveLength(1)
    })
  })

  describe('Scenario 3: Error recovery and retry', () => {
    it('should handle transient errors and recover gracefully', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      const agent = { id: 6, displayName: 'Agent David', role: 'agent' }
      const conversation = {
        id: 'conv-e2e-003',
        customerId: 7,
        assignedUserId: agent.id,
        status: 'active',
        platform: 'line',
        platformUserId: 'U_RETRY_TEST'
      }

      mockContext.get = vi.fn((key: string) => {
        if (key === 'agent') return agent
        if (key === 'db') return mockDB
        if (key === 'dbService') return mockContext._mockDBService
        return undefined
      })

      mockContext.req.param = vi.fn().mockReturnValue(conversation.id)
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message for retry scenario'
      })

      // First attempt: database error
      mockDB.mockError(new Error('Database temporarily unavailable'))

      const failedAttempt = await messageHandler.send(mockContext)
      expect(failedAttempt.status).toBe(500)

      // Second attempt: success after recovery
      mockDB.mockSelectResponse([conversation])

      const successAttempt = await messageHandler.send(mockContext)
      expect(successAttempt.status).toBe(200)
      expect(successAttempt.data.success).toBe(true)
    })
  })

  describe('Scenario 4: High-volume conversation', () => {
    it('should handle conversations with many messages efficiently', async () => {
      const mockContext = createMockContext()
      const mockDB = mockContext._mockDB

      const conversationId = 'conv-high-volume'
      const totalMessages = 150

      mockContext.req.param = vi.fn().mockReturnValue(conversationId)

      // Test pagination with large dataset
      for (let page = 1; page <= 3; page++) {
        mockContext.req.query = vi.fn((key?: string) => {
          const params: Record<string, string> = {
            page: String(page),
            pageSize: '50'
          }
          return key ? params[key] : params
        })

        const startIndex = (page - 1) * 50
        const pageMessages = Array.from({ length: 50 }, (_, i) => ({
          id: `msg-${startIndex + i + 1}`,
          conversationId,
          senderType: i % 2 === 0 ? 'customer' : 'agent',
          customerSenderId: i % 2 === 0 ? 1 : null,
          agentSenderId: i % 2 === 0 ? null : 2,
          content: `Message ${startIndex + i + 1}`,
          messageType: 'text',
          createdAt: new Date(Date.now() + (startIndex + i) * 1000).toISOString(),
          customerName: i % 2 === 0 ? 'Customer' : null,
          agentName: i % 2 === 0 ? null : 'Agent'
        }))

        mockDB.mockQueryResponses(pageMessages, totalMessages)

        const result = await messageHandler.list(mockContext)
        expect(result.status).toBe(200)
        expect(result.data.data.items).toHaveLength(50)
        expect(result.data.data.total).toBe(totalMessages)
        expect(result.data.data.page).toBe(page)
      }
    })
  })
})
