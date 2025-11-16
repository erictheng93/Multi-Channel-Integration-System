import { vi } from 'vitest'
import * as database from '@backend/utils/database'
import type { Customer, DbConversation, DbMessage } from '@backend/types'

/**
 * Service-level mocking helper for unit tests
 *
 * Provides easy mocking of database utility functions for testing
 * business logic without database dependencies.
 *
 * @example
 * ```typescript
 * const mockHelper = new ServiceMockHelper()
 * const mocks = mockHelper.setupDatabaseMocks()
 *
 * // Setup mock behavior
 * mocks.findOrCreateCustomer.mockResolvedValue(
 *   mockHelper.mockCustomer({ id: 1 })
 * )
 *
 * // Test your handler
 * const result = await myHandler()
 *
 * // Verify calls
 * expect(mocks.findOrCreateCustomer).toHaveBeenCalledWith(...)
 *
 * mockHelper.reset()
 * ```
 */
export class ServiceMockHelper {
  private mocks: Map<string, any> = new Map()

  /**
   * Setup spies for all database utility functions
   * Returns an object with all mocked functions
   */
  setupDatabaseMocks() {
    const mocks = {
      // Customer operations
      findOrCreateCustomer: vi.spyOn(database, 'findOrCreateCustomer'),
      getAllCustomers: vi.spyOn(database, 'getAllCustomers'),
      getCustomerById: vi.spyOn(database, 'getCustomerById'),
      getCustomerByPlatformId: vi.spyOn(database, 'getCustomerByPlatformId'),
      updateCustomer: vi.spyOn(database, 'updateCustomer'),
      getCustomerConversations: vi.spyOn(database, 'getCustomerConversations'),

      // Conversation operations
      findOrCreateConversation: vi.spyOn(database, 'findOrCreateConversation'),
      getConversationMessages: vi.spyOn(database, 'getConversationMessages'),
      getConversationMessageTree: vi.spyOn(database, 'getConversationMessageTree'),

      // Message operations
      saveMessage: vi.spyOn(database, 'saveMessage'),
      getMessageStats: vi.spyOn(database, 'getMessageStats'),
      getMessageReplies: vi.spyOn(database, 'getMessageReplies'),
      getMessageThread: vi.spyOn(database, 'getMessageThread'),

      // System settings
      getSystemSetting: vi.spyOn(database, 'getSystemSetting'),
    }

    // Store mocks for later cleanup
    Object.values(mocks).forEach(mock => {
      this.mocks.set(mock.getMockName(), mock)
    })

    return mocks
  }

  /**
   * Create a mock Customer object with sensible defaults
   */
  mockCustomer(overrides?: Partial<Customer>): Customer {
    return {
      id: 1,
      platform: 'line',
      platform_user_id: 'U123456789',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      email: undefined,
      phone: undefined,
      source_team_id: undefined,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      ...overrides
    }
  }

  /**
   * Create a mock Conversation object with sensible defaults
   */
  mockConversation(overrides?: Partial<DbConversation>): DbConversation {
    return {
      id: 'conv-123',
      customer_id: 1,
      assigned_team_id: undefined,
      assigned_user_id: undefined,
      status: 'active',
      priority: 'normal',
      first_response_at: undefined,
      closed_at: undefined,
      internal_notes: undefined,
      last_message_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      ...overrides
    }
  }

  /**
   * Create a mock Message object with sensible defaults
   */
  mockMessage(overrides?: Partial<DbMessage>): DbMessage {
    return {
      id: 'msg-123',
      conversation_id: 'conv-123',
      sender_type: 'customer',
      customer_sender_id: 1,
      agent_sender_id: undefined,
      content: 'Test message',
      message_type: 'text',
      platform_message_id: 'line_msg_123',
      is_recalled: false,
      recall_deadline: undefined,
      recalled_at: undefined,
      is_sent: true,
      sent_at: '2024-01-01T00:00:00Z',
      delivery_status: 'delivered',
      reply_to_message_id: undefined,
      thread_id: undefined,
      session_id: undefined,
      session_sequence: undefined,
      metadata: undefined,
      created_at: '2024-01-01T00:00:00Z',
      ...overrides
    }
  }

  /**
   * Setup a common scenario: existing customer flow
   */
  setupExistingCustomerScenario(customerId: number = 1) {
    const mocks = this.setupDatabaseMocks()

    const customer = this.mockCustomer({ id: customerId })
    const conversation = this.mockConversation({ customer_id: customerId })

    mocks.findOrCreateCustomer.mockResolvedValue(customer)
    mocks.findOrCreateConversation.mockResolvedValue(conversation)

    return { mocks, customer, conversation }
  }

  /**
   * Setup a common scenario: new customer flow
   */
  setupNewCustomerScenario(customerId: number = 1) {
    const mocks = this.setupDatabaseMocks()

    const customer = this.mockCustomer({ id: customerId })
    const conversation = this.mockConversation({
      id: 'conv-new',
      customer_id: customerId
    })

    // Simulate new customer creation
    mocks.findOrCreateCustomer.mockResolvedValue(customer)
    mocks.findOrCreateConversation.mockResolvedValue(conversation)

    return { mocks, customer, conversation }
  }

  /**
   * Setup a common scenario: message flow
   */
  setupMessageScenario(conversationId: string = 'conv-123') {
    const mocks = this.setupDatabaseMocks()

    const message = this.mockMessage({ conversation_id: conversationId })
    mocks.saveMessage.mockResolvedValue(message)

    const messages = [message]
    mocks.getConversationMessages.mockResolvedValue(messages)

    return { mocks, message, messages }
  }

  /**
   * Setup error scenario for testing error handling
   */
  setupErrorScenario(operation: keyof ReturnType<typeof this.setupDatabaseMocks>, error: Error) {
    const mocks = this.setupDatabaseMocks()
    mocks[operation].mockRejectedValue(error)
    return mocks
  }

  /**
   * Reset all mocks to their initial state
   */
  reset() {
    vi.restoreAllMocks()
    this.mocks.clear()
  }

  /**
   * Clear all mock call history without removing the mocks
   */
  clearHistory() {
    this.mocks.forEach(mock => {
      if (mock && typeof mock.mockClear === 'function') {
        mock.mockClear()
      }
    })
  }

  /**
   * Assert that a specific database function was called
   */
  assertCalled(
    mocks: ReturnType<typeof this.setupDatabaseMocks>,
    operation: keyof ReturnType<typeof this.setupDatabaseMocks>,
    times: number = 1
  ) {
    expect(mocks[operation]).toHaveBeenCalledTimes(times)
  }

  /**
   * Assert that a specific database function was NOT called
   */
  assertNotCalled(
    mocks: ReturnType<typeof this.setupDatabaseMocks>,
    operation: keyof ReturnType<typeof this.setupDatabaseMocks>
  ) {
    expect(mocks[operation]).not.toHaveBeenCalled()
  }

  /**
   * Assert that a specific database function was called with specific arguments
   */
  assertCalledWith(
    mocks: ReturnType<typeof this.setupDatabaseMocks>,
    operation: keyof ReturnType<typeof this.setupDatabaseMocks>,
    ...args: any[]
  ) {
    expect(mocks[operation]).toHaveBeenCalledWith(...args)
  }
}

// Export a singleton instance for convenience
export const serviceMock = new ServiceMockHelper()
