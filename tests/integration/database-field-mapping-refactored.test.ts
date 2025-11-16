// 資料庫欄位映射整合測試 - REFACTORED with DatabaseTestEnvironment
// Database Field Mapping Integration Tests with real database

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseTestEnvironment } from '../helpers/DatabaseTestEnvironment';
import { DelayedMessageService } from '@modules/messaging/services/delayed-message-service';
import type { Bindings } from '../../src/types';
import type { DelayedSendRequest } from '@modules/messaging/types/message-types';
import * as schema from '@backend/db/schema';

// Module-level variable for test environment
let currentTestEnv: DatabaseTestEnvironment | null = null

// Mock drizzle-orm/d1 to use our test database
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized')
    }
    return currentTestEnv.getDrizzleInstance()
  })
}))

/**
 * REFACTORED VERSION - Benefits:
 *
 * ✅ Real database with actual field constraints
 * ✅ Tests actual SQL column names and types
 * ✅ Validates field mapping between DB and API
 * ✅ Catches schema mismatches immediately
 * ✅ Tests metadata JSON serialization/deserialization
 * ✅ No mock Drizzle complexity
 *
 * BEFORE: 315 lines with mock Drizzle setup
 * AFTER: Simplified with real database operations
 */

describe('Database Field Mapping Integration Tests - Refactored', () => {
  let env: DatabaseTestEnvironment
  let service: DelayedMessageService
  let mockEnv: Bindings
  let testAgent: any
  let testCustomer: any
  let testConversation: any

  beforeEach(async () => {
    // Initialize test database
    env = new DatabaseTestEnvironment()
    currentTestEnv = env

    // Setup mock environment
    mockEnv = {
      DB: env.getMockD1Database() as any,
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      } as any,
      DELAYED_MESSAGES: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      } as any,
      JWT_SECRET: 'test-secret-key',
      LINE_CHANNEL_SECRET: 'test-line-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token'
    } as Bindings

    service = new DelayedMessageService(env.getMockD1Database() as any, mockEnv)

    // Create test data
    testAgent = await env.createTestAgent({
      id: 'agent-field-mapping-123',
      email: 'fieldtest@test.com',
      displayName: 'Field Test Agent',
      role: 'agent'
    })
    testCustomer = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'field_test_user',
      displayName: 'Field Test Customer'
    })
    testConversation = await env.createTestConversation(testCustomer.id, {
      assignedUserId: testAgent.id
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    env.close()
    currentTestEnv = null
  })

  describe('Agent ID to Sender ID Mapping', () => {
    it('should correctly map agentId to senderId when creating delayed message', async () => {
      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversation.id, // String UUID, not parseInt
        content: 'Test mapping message',
        messageType: 'text',
        delaySeconds: 10,
        recipientPlatformId: 'test-recipient',
        platform: 'line'
      }

      const result = await service.sendDelayedMessage(delayedMessageRequest, testAgent.id)

      expect(result.success).toBe(true)
      expect(result.delayedMessageId).toBeDefined()

      // Verify delayed message exists in database with correct agentId
      const delayedMessages = await env.db.query.delayedMessages.findMany({
        where: (delayedMessages, { eq }) => eq(delayedMessages.id, result.delayedMessageId!)
      })

      expect(delayedMessages).toHaveLength(1)
      expect(delayedMessages[0].agentId).toBe(testAgent.id) // agentId in delayed_messages table
      expect(delayedMessages[0].content).toBe('Test mapping message')
    })

    it('should correctly map agentId to senderId when retrieving delayed message', async () => {
      // Create a delayed message using the service
      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversation.id,
        content: 'Test retrieval message',
        messageType: 'text',
        delaySeconds: 30,
        recipientPlatformId: 'test-recipient',
        platform: 'line'
      }

      const createResult = await service.sendDelayedMessage(delayedMessageRequest, testAgent.id)
      expect(createResult.success).toBe(true)

      // Now retrieve it
      const result = await service.findDelayedMessageById(createResult.delayedMessageId!)

      expect(result).toBeDefined()
      expect(result!.agentId).toBe(testAgent.id)
      expect(result!.id).toBe(createResult.delayedMessageId)
      expect(result!.platform).toBe('line')
    })
  })

  describe('Failure Reason Metadata Mapping', () => {
    it('should store failure reason in metadata when cancelling message', async () => {
      const cancelReason = 'User requested cancellation'

      // Create a pending delayed message using the service
      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversation.id,
        content: 'Message to cancel',
        messageType: 'text',
        delaySeconds: 60,
        recipientPlatformId: 'test-recipient',
        platform: 'line'
      }

      const createResult = await service.sendDelayedMessage(delayedMessageRequest, testAgent.id)
      expect(createResult.success).toBe(true)

      // Cancel the message
      const result = await service.cancelDelayedMessage(createResult.delayedMessageId!, cancelReason)

      expect(result.success).toBe(true)

      // Verify metadata was updated in delayed_messages table
      const updatedMessages = await env.db.query.delayedMessages.findMany({
        where: (delayedMessages, { eq }) => eq(delayedMessages.id, createResult.delayedMessageId!)
      })

      expect(updatedMessages).toHaveLength(1)
      const metadata = JSON.parse(updatedMessages[0].metadata || '{}')
      expect(metadata.failureReason).toBe(cancelReason)
      expect(mockEnv.SESSIONS.delete).toHaveBeenCalledWith(`recallable:${createResult.delayedMessageId}`)
    })

    it('should retrieve failure reason from metadata correctly', async () => {
      const failureReason = 'Platform API error'

      // Create a delayed message, then cancel it with failure reason
      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversation.id,
        content: 'Failed message',
        messageType: 'text',
        delaySeconds: 60,
        recipientPlatformId: 'test-recipient',
        platform: 'line'
      }

      const createResult = await service.sendDelayedMessage(delayedMessageRequest, testAgent.id)
      expect(createResult.success).toBe(true)

      // Cancel with failure reason
      await service.cancelDelayedMessage(createResult.delayedMessageId!, failureReason)

      // Retrieve and verify failure reason is in metadata
      const result = await service.findDelayedMessageById(createResult.delayedMessageId!)

      expect(result).toBeDefined()
      expect(result!.failureReason).toBe(failureReason)
      expect(result!.status).toBe('cancelled')
      expect(result!.platform).toBe('line')
    })
  })

  describe('Complete Lifecycle Mapping Test', () => {
    it('should maintain correct field mappings throughout message lifecycle', async () => {
      // Step 1: Create delayed message
      const createRequest: DelayedSendRequest = {
        conversationId: testConversation.id, // String UUID, not parseInt
        content: 'Lifecycle test message',
        messageType: 'text',
        delaySeconds: 5,
        recipientPlatformId: 'lifecycle-recipient',
        platform: 'line'
      }

      const createResult = await service.sendDelayedMessage(createRequest, testAgent.id)
      expect(createResult.success).toBe(true)

      const messageId = createResult.delayedMessageId!

      // Step 2: Verify message was stored correctly
      const retrieveResult = await service.findDelayedMessageById(messageId)

      expect(retrieveResult).toBeDefined()
      expect(retrieveResult!.agentId).toBe(testAgent.id)
      expect(retrieveResult!.platform).toBe('line')
      expect(retrieveResult!.delaySeconds).toBe(5)
      expect(retrieveResult!.recipientPlatformId).toBe('lifecycle-recipient')

      // Step 3: Test cancellation with failure reason
      const failureReason = 'Simulated platform failure'

      const cancelResult = await service.cancelDelayedMessage(messageId, failureReason)
      expect(cancelResult.success).toBe(true)

      // Step 4: Verify failure reason was stored
      const finalResult = await service.findDelayedMessageById(messageId)
      expect(finalResult!.failureReason).toBe(failureReason)
      expect(finalResult!.status).toBe('cancelled')

      // Verify in database
      const dbMessages = await env.db.query.delayedMessages.findMany({
        where: (delayedMessages, { eq }) => eq(delayedMessages.id, messageId)
      })
      expect(dbMessages).toHaveLength(1)
      const metadata = JSON.parse(dbMessages[0].metadata || '{}')
      expect(metadata.failureReason).toBe(failureReason)
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle missing metadata gracefully', async () => {
      // Create delayed message without metadata using the service
      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversation.id,
        content: 'Message without metadata',
        messageType: 'text',
        delaySeconds: 10,
        // No platform or recipientPlatformId specified
      }

      const createResult = await service.sendDelayedMessage(delayedMessageRequest, testAgent.id)
      expect(createResult.success).toBe(true)

      const result = await service.findDelayedMessageById(createResult.delayedMessageId!)

      expect(result).toBeDefined()
      expect(result!.agentId).toBe(testAgent.id)
      expect(result!.platform).toBe('webchat') // Default platform
      expect(result!.content).toBe('Message without metadata')
    })

    it('should handle invalid JSON metadata gracefully', async () => {
      // Directly insert a delayed message with invalid JSON metadata into database
      const messageId = 'invalid-metadata-msg-123'
      const now = new Date()

      await env.db.insert(schema.delayedMessages).values({
        id: messageId,
        conversationId: testConversation.id,
        agentId: testAgent.id,
        content: 'Message with invalid metadata',
        messageType: 'text',
        scheduledAt: new Date(now.getTime() + 60000).toISOString(),
        status: 'pending',
        metadata: '{invalid json}', // Invalid JSON
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      })

      // This should throw an error because JSON.parse will fail
      await expect(service.findDelayedMessageById(messageId)).rejects.toThrow()
    })

    it('should validate foreign key constraints', async () => {
      // Try to create message with non-existent conversation
      const invalidRequest: DelayedSendRequest = {
        conversationId: 'nonexistent-conversation-uuid', // Non-existent UUID
        content: 'Invalid conversation',
        messageType: 'text',
        delaySeconds: 10,
        recipientPlatformId: 'test',
        platform: 'line'
      }

      await expect(
        service.sendDelayedMessage(invalidRequest, testAgent.id)
      ).rejects.toThrow() // Should fail due to foreign key constraint
    })

    it('should validate agent exists when creating message', async () => {
      const request: DelayedSendRequest = {
        conversationId: testConversation.id, // String UUID, not parseInt
        content: 'Test with invalid agent',
        messageType: 'text',
        delaySeconds: 10,
        recipientPlatformId: 'test',
        platform: 'line'
      }

      // Service returns { success: false } instead of throwing
      const result = await service.sendDelayedMessage(request, 'nonexistent-agent-id')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle concurrent updates to same message', async () => {
      // Create a delayed message using the service
      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversation.id,
        content: 'Concurrent test',
        messageType: 'text',
        delaySeconds: 60,
        recipientPlatformId: 'test-recipient',
        platform: 'line'
      }

      const createResult = await service.sendDelayedMessage(delayedMessageRequest, testAgent.id)
      expect(createResult.success).toBe(true)

      // Concurrent cancellation attempts
      const updates = [
        service.cancelDelayedMessage(createResult.delayedMessageId!, 'Reason 1'),
        service.cancelDelayedMessage(createResult.delayedMessageId!, 'Reason 2')
      ]

      const results = await Promise.all(updates)

      // At least one should succeed
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeGreaterThan(0)

      // Verify final state
      const final = await service.findDelayedMessageById(createResult.delayedMessageId!)
      expect(final).toBeDefined()
      expect(final!.failureReason).toBeDefined()
    })
  })

  describe('Metadata JSON Serialization', () => {
    it('should correctly serialize and deserialize complex metadata', async () => {
      // Create delayed message using the service
      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversation.id,
        content: 'Complex metadata test',
        messageType: 'text',
        delaySeconds: 30,
        recipientPlatformId: 'complex-test',
        platform: 'line',
        metadata: {
          customField1: 'value1',
          customField2: { nested: 'object' },
          customArray: [1, 2, 3]
        }
      }

      const createResult = await service.sendDelayedMessage(delayedMessageRequest, testAgent.id)
      expect(createResult.success).toBe(true)

      // Retrieve and verify
      const result = await service.findDelayedMessageById(createResult.delayedMessageId!)

      expect(result).toBeDefined()
      expect(result!.platform).toBe('line')
      expect(result!.recipientPlatformId).toBe('complex-test')

      // Verify complete metadata from database
      const dbMessages = await env.db.query.delayedMessages.findMany({
        where: (delayedMessages, { eq }) => eq(delayedMessages.id, createResult.delayedMessageId!)
      })
      expect(dbMessages).toHaveLength(1)
      const retrievedMetadata = JSON.parse(dbMessages[0].metadata!)

      // Check that custom fields were preserved
      expect(retrievedMetadata.customField1).toBe('value1')
      expect(retrievedMetadata.customField2).toEqual({ nested: 'object' })
      expect(retrievedMetadata.customArray).toEqual([1, 2, 3])
    })
  })
})
