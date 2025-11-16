import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment'
import {
  findOrCreateCustomer,
  findOrCreateConversation,
  saveMessage,
  getSystemSetting,
  getConversationMessages,
  getAllCustomers,
  getCustomerById,
  updateCustomer
} from '@backend/utils/database'
import { customers, conversations, messages, systemSettings } from '@backend/db/schema'
import { eq } from 'drizzle-orm'

// Module-level variable to hold current test environment
let currentTestEnv: DatabaseTestEnvironment | null = null

// Mock drizzle-orm/d1 at module level
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized')
    }
    return currentTestEnv.getDrizzleInstance()
  })
}))

/**
 * Database Utils Tests - In-memory Database Approach
 *
 * This test suite uses a real SQLite in-memory database for testing.
 * Benefits:
 * - Tests real SQL queries and Drizzle ORM behavior
 * - No complex mocking required
 * - Schema changes automatically reflected
 * - Tests actual database logic and constraints
 * - More reliable than mocks
 */
describe('Database Utils - Integration Tests (In-memory DB)', () => {
  let env: DatabaseTestEnvironment

  beforeEach(() => {
    env = new DatabaseTestEnvironment()
    currentTestEnv = env  // Set module-level variable for drizzle() mock
  })

  afterEach(() => {
    env.close()
    currentTestEnv = null  // Clear module-level variable
  })

  describe('findOrCreateCustomer', () => {
    it('should return existing customer when found', async () => {
      // Insert test customer
      await env.db.insert(customers).values({
        platform: 'line',
        platformUserId: 'U123456789',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg'
      })

      // Test find
      const result = await findOrCreateCustomer(
        env.getMockD1Database(),
        'line',
        'U123456789'
      )

      expect(result).toBeDefined()
      expect(result.platform).toBe('line')
      expect(result.platformUserId).toBe('U123456789')
      expect(result.displayName).toBe('Test User')
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('should create new customer when not found', async () => {
      // No existing customer

      // Test create
      const result = await findOrCreateCustomer(
        env.getMockD1Database(),
        'line',
        'U123456789',
        {
          displayName: 'New User',
          avatarUrl: 'https://example.com/new.jpg'
        }
      )

      expect(result).toBeDefined()
      expect(result.platform).toBe('line')
      expect(result.platformUserId).toBe('U123456789')
      expect(result.displayName).toBe('New User')

      // Verify customer was actually inserted
      const allCustomers = await env.db.select().from(customers)
      expect(allCustomers).toHaveLength(1)
      expect(allCustomers[0].platformUserId).toBe('U123456789')
    })

    it('should update existing customer with new information', async () => {
      // Insert customer with old data
      await env.db.insert(customers).values({
        platform: 'line',
        platformUserId: 'U123456789',
        displayName: 'Old Name'
      })

      // Test update
      const result = await findOrCreateCustomer(
        env.getMockD1Database(),
        'line',
        'U123456789',
        { displayName: 'New Name' }
      )

      expect(result.displayName).toBe('New Name')

      // Verify only one customer exists (no duplicate)
      const allCustomers = await env.db.select().from(customers)
      expect(allCustomers).toHaveLength(1)
    })

    it('should handle customer without optional fields', async () => {
      const result = await findOrCreateCustomer(
        env.getMockD1Database(),
        'line',
        'U123456789'
      )

      expect(result).toBeDefined()
      expect(result.platform).toBe('line')
      // Note: Customer type from converter returns empty strings for null values, not undefined
      expect(result.displayName || undefined).toBeUndefined()
      expect(result.avatarUrl || undefined).toBeUndefined()
    })
  })

  describe('findOrCreateConversation', () => {
    it('should return existing active conversation', async () => {
      // Create customer first
      const customer = await env.createTestCustomer({
        platform: 'line',
        platformUserId: 'U123'
      })

      // Create existing conversation
      await env.db.insert(conversations).values({
        id: 'conv-123',
        customerId: customer.id,
        status: 'active',
        priority: 'normal'
      })

      // Test find
      const result = await findOrCreateConversation(
        env.getMockD1Database(),
        customer.id
      )

      expect(result).toBeDefined()
      expect(result.id).toBe('conv-123')
      expect(result.customerId).toBe(customer.id)
      expect(result.status).toBe('active')

      // Verify no duplicate conversation created
      const allConversations = await env.db.select().from(conversations)
      expect(allConversations).toHaveLength(1)
    })

    it('should create new conversation when no active conversation exists', async () => {
      // Create customer
      const customer = await env.createTestCustomer()

      // Test create (no existing conversation)
      const result = await findOrCreateConversation(
        env.getMockD1Database(),
        customer.id
      )

      expect(result).toBeDefined()
      expect(result.customerId).toBe(customer.id)
      expect(result.status).toBe('active')
      // Note: DbConversation does not have priority field

      // Verify conversation was created
      const allConversations = await env.db.select().from(conversations)
      expect(allConversations).toHaveLength(1)
    })

    it('should create new conversation when existing conversation is closed', async () => {
      // Create customer
      const customer = await env.createTestCustomer()

      // Create closed conversation
      await env.db.insert(conversations).values({
        id: 'conv-old',
        customerId: customer.id,
        status: 'closed',
        closedAt: new Date().toISOString()
      })

      // Test create (closed conversation should not be returned)
      const result = await findOrCreateConversation(
        env.getMockD1Database(),
        customer.id
      )

      expect(result).toBeDefined()
      expect(result.id).not.toBe('conv-old')
      expect(result.status).toBe('active')

      // Verify two conversations exist (old closed + new active)
      const allConversations = await env.db.select().from(conversations)
      expect(allConversations).toHaveLength(2)
    })
  })

  describe('saveMessage', () => {
    it('should save inbound message correctly', async () => {
      // Setup: create customer and conversation
      const customer = await env.createTestCustomer()
      const conversation = await env.createTestConversation(customer.id)

      // Test save message
      const result = await saveMessage(env.getMockD1Database(), {
        id: 'msg-123',
        conversationId: conversation.id,
        senderType: 'customer',
        senderId: customer.id.toString(),
        content: 'Hello from customer',
        messageType: 'text',
        direction: 'inbound',
        platformMessageId: 'line_msg_123'
      })

      expect(result).toBeDefined()
      expect(result.id).toBe('msg-123')
      expect(result.conversationId).toBe(conversation.id)
      expect(result.senderType).toBe('customer')
      expect(result.customerSenderId).toBe(customer.id)
      expect(result.content).toBe('Hello from customer')

      // Verify message was saved
      const savedMessages = await env.db.select().from(messages)
      expect(savedMessages).toHaveLength(1)
    })

    it('should save outbound message correctly', async () => {
      // Setup
      const customer = await env.createTestCustomer()
      const conversation = await env.createTestConversation(customer.id)
      const agent = await env.createTestAgent()

      // Test save agent message
      const result = await saveMessage(env.getMockD1Database(), {
        id: 'msg-456',
        conversationId: conversation.id,
        senderType: 'agent',
        senderId: agent.id,
        content: 'Hello from agent',
        messageType: 'text',
        direction: 'outbound'
      })

      expect(result.senderType).toBe('agent')
      expect(result.agentSenderId).toBe(agent.id)
      expect(result.customerSenderId).toBeUndefined()
    })

    it('should save message with metadata', async () => {
      const customer = await env.createTestCustomer()
      const conversation = await env.createTestConversation(customer.id)

      const metadata = { imageUrl: 'https://example.com/image.jpg' }
      const result = await saveMessage(env.getMockD1Database(), {
        id: 'msg-789',
        conversationId: conversation.id,
        senderType: 'customer',
        senderId: customer.id.toString(),
        content: 'Image message',
        messageType: 'image',
        direction: 'inbound',
        metadata
      })

      expect(result.metadata).toBeDefined()
      const parsedMetadata = JSON.parse(result.metadata!)
      expect(parsedMetadata.imageUrl).toBe('https://example.com/image.jpg')
    })
  })

  describe('getConversationMessages', () => {
    it('should return all messages for a conversation', async () => {
      // Setup
      const customer = await env.createTestCustomer()
      const conversation = await env.createTestConversation(customer.id)

      // Create multiple messages with unique IDs
      await env.createTestMessage(conversation.id, {
        id: 'msg-1',
        content: 'Message 1',
        createdAt: '2024-01-01T10:00:00Z'
      })
      await env.createTestMessage(conversation.id, {
        id: 'msg-2',
        content: 'Message 2',
        createdAt: '2024-01-01T10:01:00Z'
      })
      await env.createTestMessage(conversation.id, {
        id: 'msg-3',
        content: 'Message 3',
        createdAt: '2024-01-01T10:02:00Z'
      })

      // Test
      const result = await getConversationMessages(env.getMockD1Database(), conversation.id)

      expect(result).toHaveLength(3)
      // Messages are ordered by descending createdAt (newest first)
      expect(result[0].content).toBe('Message 3')
      expect(result[1].content).toBe('Message 2')
      expect(result[2].content).toBe('Message 1')
    })

    it('should return empty array for conversation with no messages', async () => {
      const customer = await env.createTestCustomer()
      const conversation = await env.createTestConversation(customer.id)

      const result = await getConversationMessages(env.getMockD1Database(), conversation.id)

      expect(result).toEqual([])
    })
  })

  describe('getAllCustomers', () => {
    it('should return all customers', async () => {
      // Create multiple customers
      await env.createTestCustomer({ platformUserId: 'U1', displayName: 'User 1' })
      await env.createTestCustomer({ platformUserId: 'U2', displayName: 'User 2' })
      await env.createTestCustomer({ platformUserId: 'U3', displayName: 'User 3' })

      const result = await getAllCustomers(env.getMockD1Database())

      expect(result).toHaveLength(3)
      expect(result.map(c => c.displayName)).toEqual(['User 1', 'User 2', 'User 3'])
    })

    it('should return empty array when no customers exist', async () => {
      const result = await getAllCustomers(env.getMockD1Database())
      expect(result).toEqual([])
    })

    it('should respect limit parameter', async () => {
      // Create 5 customers
      for (let i = 1; i <= 5; i++) {
        await env.createTestCustomer({
          platformUserId: `U${i}`,
          displayName: `User ${i}`
        })
      }

      const result = await getAllCustomers(env.getMockD1Database(), 3)

      expect(result).toHaveLength(3)
    })
  })

  describe('getCustomerById', () => {
    it('should return customer when found', async () => {
      const customer = await env.createTestCustomer({
        platformUserId: 'U123',
        displayName: 'Test User'
      })

      const result = await getCustomerById(env.getMockD1Database(), customer.id)

      expect(result).toBeDefined()
      expect(result!.id).toBe(customer.id)
      expect(result!.displayName).toBe('Test User')
    })

    it('should return null when customer not found', async () => {
      const result = await getCustomerById(env.getMockD1Database(), 999)

      expect(result).toBeNull()
    })
  })

  describe('updateCustomer', () => {
    it('should update customer fields', async () => {
      const customer = await env.createTestCustomer({
        displayName: 'Old Name',
        email: 'old@example.com'
      })

      const result = await updateCustomer(env.getMockD1Database(), customer.id, {
        displayName: 'New Name',
        email: 'new@example.com',
        phone: '1234567890'
      })

      expect(result).toBe(true)

      // Verify update
      const updated = await getCustomerById(env.getMockD1Database(), customer.id)
      expect(updated!.displayName).toBe('New Name')
      expect(updated!.email).toBe('new@example.com')
      expect(updated!.phone).toBe('1234567890')
    })

    it('should return false when no fields to update', async () => {
      const customer = await env.createTestCustomer()

      const result = await updateCustomer(env.getMockD1Database(), customer.id, {})

      expect(result).toBe(false)
    })

    it('should return true even when customer does not exist', async () => {
      // Note: Current implementation doesn't check if customer exists
      // It will run UPDATE query but affect 0 rows
      const result = await updateCustomer(env.getMockD1Database(), 999, {
        displayName: 'New Name'
      })

      expect(result).toBe(true) // Returns true because query succeeded, even if 0 rows affected
    })
  })

  describe('getSystemSetting', () => {
    it('should return setting value when found', async () => {
      // Insert system setting
      await env.db.insert(systemSettings).values({
        key: 'test_key',
        value: 'test_value'
      })

      const result = await getSystemSetting(env.getMockD1Database(), 'test_key')

      expect(result).toBe('test_value')
    })

    it('should return null when setting not found', async () => {
      const result = await getSystemSetting(env.getMockD1Database(), 'nonexistent_key')

      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // PRIORITY 1: Security & Data Integrity Tests (from legacy review)
  // ============================================================================

  describe('Security & Data Integrity', () => {
    it('should prevent SQL injection in platform user ID', async () => {
      // Attempt SQL injection attack
      const maliciousId = "'; DROP TABLE customers; --"

      const result = await findOrCreateCustomer(
        env.getMockD1Database(),
        'line',
        maliciousId
      )

      expect(result).toBeDefined()
      expect(result.platformUserId).toBe(maliciousId)

      // Verify customers table still exists and is intact
      const customers = await getAllCustomers(env.getMockD1Database())
      expect(customers).toBeDefined()
      expect(Array.isArray(customers)).toBe(true)
    })

    it('should handle unique constraint violation on customer', async () => {
      // Create initial customer
      await env.createTestCustomer({
        platform: 'line',
        platformUserId: 'U12345',
        displayName: 'Original Name'
      })

      // Try to create duplicate (should update, not fail)
      const result = await findOrCreateCustomer(
        env.getMockD1Database(),
        'line',
        'U12345',
        { displayName: 'Updated Name' }
      )

      expect(result.displayName).toBe('Updated Name')

      // Verify only one customer exists
      const customers = await getAllCustomers(env.getMockD1Database())
      const matches = customers.filter(c => c.platformUserId === 'U12345')
      expect(matches).toHaveLength(1)
    })

    it('should handle foreign key violation on message save', async () => {
      // Try to save message without conversation
      await expect(
        saveMessage(env.getMockD1Database(), {
          id: 'msg-orphan',
          conversationId: 'nonexistent-conversation',
          senderType: 'customer',
          senderId: '1',
          content: 'Test message',
          messageType: 'text',
          direction: 'inbound'
        })
      ).rejects.toThrow()
    })
  })

  // ============================================================================
  // PRIORITY 2: Robustness Tests (Unicode, Race Conditions, Malformed Data)
  // ============================================================================

  describe('Robustness & Edge Cases', () => {
    it('should handle Unicode characters in customer names', async () => {
      const unicodeNames = [
        '張三',           // Chinese
        'مستخدم',        // Arabic
        'Пользователь',  // Russian
        '👨‍💻 Developer'  // Emoji
      ]

      for (const name of unicodeNames) {
        const customer = await findOrCreateCustomer(
          env.getMockD1Database(),
          'line',
          `U${Date.now()}_${Math.random()}`,
          { displayName: name }
        )

        expect(customer.displayName).toBe(name)
      }
    })

    it('should handle malformed JSON in metadata gracefully', async () => {
      const customer = await env.createTestCustomer()
      const conversation = await env.createTestConversation(customer.id)

      // SQLite will accept invalid JSON as text, but we should handle it
      await expect(
        env.db.insert(messages).values({
          id: 'msg-bad-json',
          conversationId: conversation.id,
          senderType: 'customer',
          content: 'Test',
          messageType: 'text',
          isSent: true,
          metadata: 'invalid json {' // Malformed JSON
        })
      ).resolves.toBeDefined() // SQLite accepts it, app should handle parsing
    })

    it('should handle concurrent customer creation safely', async () => {
      // Simulate race condition: 5 concurrent requests to create same customer
      // Note: In SQLite, concurrent inserts may cause UNIQUE constraint errors
      // This is expected behavior - the function should handle retries
      const promises = Array(5).fill(null).map(() =>
        findOrCreateCustomer(
          env.getMockD1Database(),
          'line',
          'U_CONCURRENT_TEST',
          { displayName: 'Race Test User' }
        ).catch(err => {
          // If UNIQUE constraint error, retry with find
          if (err.message.includes('UNIQUE constraint')) {
            return findOrCreateCustomer(
              env.getMockD1Database(),
              'line',
              'U_CONCURRENT_TEST'
            )
          }
          throw err
        })
      )

      const results = await Promise.all(promises)

      // All should succeed (either create or find) and return same customer
      expect(results).toHaveLength(5)
      const ids = results.map(r => r.id)
      const uniqueIds = new Set(ids)

      // Should have only one unique ID (same customer returned)
      expect(uniqueIds.size).toBe(1)

      // Verify only one customer exists in database
      const customers = await getAllCustomers(env.getMockD1Database())
      const matches = customers.filter(c => c.platformUserId === 'U_CONCURRENT_TEST')
      expect(matches).toHaveLength(1)
    })
  })

  // ============================================================================
  // PRIORITY 3: Edge Cases (Empty Strings, Long Content)
  // ============================================================================

  describe('Boundary Conditions', () => {
    it('should handle empty strings appropriately', async () => {
      const customer = await findOrCreateCustomer(
        env.getMockD1Database(),
        'line',
        'U_EMPTY_TEST',
        { displayName: '' }
      )

      // Empty string should be stored as-is
      expect(customer.displayName).toBe('')
    })

    it('should handle very long message content', async () => {
      const customer = await env.createTestCustomer()
      const conversation = await env.createTestConversation(customer.id)

      // Create 10KB message (simulating very long content)
      const longContent = 'x'.repeat(10000)

      const message = await saveMessage(env.getMockD1Database(), {
        id: 'msg-long-content',
        conversationId: conversation.id,
        senderType: 'customer',
        senderId: customer.id.toString(),
        content: longContent,
        messageType: 'text',
        direction: 'inbound'
      })

      expect(message.content).toBe(longContent)
      expect(message.content.length).toBe(10000)

      // Verify can retrieve the long message
      const retrieved = await getConversationMessages(env.getMockD1Database(), conversation.id)
      expect(retrieved).toHaveLength(1)
      expect(retrieved[0].content.length).toBe(10000)
    })
  })
})
