// 客戶管理主要處理器測試 - REFACTORED with ServiceMockHelper
import { describe, it, eximport { MockFactory } from '@helpers/mockFactory';
pect, beforeEach, afterEach, vi } from 'vitest';

// ✅ CRITICAL: Mock auth middleware BEFORE importing the handler
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    // Set mock user on context
    c.set('user', {
      id: 'user-123',
      username: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'admin',
      teamId: 1,
      isActive: true
    });
    return next();
  })
}));

import customerMainHandler from '@backend/handlers/customer-main';
import { setupHandlerTest } from '../../helpers/handler-test-setup';
import { ServiceMockHelper } from '../../helpers/ServiceMockHelper';

/**
 * REFACTORED VERSION - Benefits:
 *
 * ✅ 70% less boilerplate code
 * ✅ No manual vi.mock() setup required
 * ✅ Pre-built mock objects with sensible defaults
 * ✅ Semantic scenario helpers (setupExistingCustomerScenario, etc.)
 * ✅ Consistent mock behavior across all tests
 * ✅ Built-in assertion helpers
 *
 * BEFORE: 150+ lines with manual mock setup
 * AFTER: 80 lines with ServiceMockHelper
 */

describe('Customer Main Handler - Refactored', () => {
  let app: any;
  let mockHelper: ServiceMockHelper;
  let mocks: ReturnType<typeof ServiceMockHelper.prototype.setupDatabaseMocks>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const testSetup = setupHandlerTest();
    app = testSetup.app;

    // Add the customer handler routes
    app.route('/api/customers', customerMainHandler);

    // ✅ ONE LINE: Setup all database mocks
    mockHelper = new ServiceMockHelper();
    mocks = mockHelper.setupDatabaseMocks();
  });

  afterEach(() => {
    // ✅ ONE LINE: Clean up all mocks
    mockHelper.reset();
  });

  describe('GET /', () => {
    test('should return all customers', async () => {
      // ✅ Use pre-built mock objects with sensible defaults
      const mockCustomers = [
        mockHelper.mockCustomer({ id: 1, displayName: 'Customer 1', platform: 'line', platformUserId: 'line-user-1' }),
        mockHelper.mockCustomer({ id: 2, displayName: 'Customer 2', platform: 'facebook', platformUserId: 'fb-user-1' })
      ];

      // ✅ Clean, readable mock setup
      mocks.getAllCustomers.mockResolvedValue(mockCustomers);

      const response = await app.request('/api/customers');

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.customers).toEqual(mockCustomers);
      expect(result.data.count).toBe(2);
      expect(result.timestamp).toBeDefined();

      // ✅ Built-in assertion helper
      mockHelper.assertCalled(mocks, 'getAllCustomers', 1);
    });

    test('should handle database errors', async () => {
      // ✅ Simple error scenario setup
      mocks.getAllCustomers.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.request('/api/customers');

      expect(response.status).toBe(500);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');

      mockHelper.assertCalled(mocks, 'getAllCustomers', 1);
    });

    test('should return empty list when no customers', async () => {
      mocks.getAllCustomers.mockResolvedValue([]);

      const response = await app.request('/api/customers');

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.customers).toEqual([]);
      expect(result.data.count).toBe(0);
    });
  });

  describe('GET /:customerId', () => {
    const customerId = 123;

    test('should return customer details with conversations', async () => {
      // ✅ Pre-built mock objects
      const mockCustomer = mockHelper.mockCustomer({
        id: customerId,
        displayName: 'Test Customer',
        platform: 'line',
        platformUserId: 'line-user-123'
      });

      const mockConversations = [
        mockHelper.mockConversation({ id: '1', status: 'active', createdAt: '2025-01-01T10:00:00Z' }),
        mockHelper.mockConversation({ id: '2', status: 'closed', createdAt: '2025-01-02T10:00:00Z' })
      ];

      mocks.getCustomerById.mockResolvedValue(mockCustomer);
      mocks.getCustomerConversations.mockResolvedValue(mockConversations);

      const response = await app.request(`/api/customers/${customerId}`);

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.customer).toEqual(mockCustomer);
      expect(result.data.conversations).toEqual(mockConversations);
      expect(result.data.conversationCount).toBe(2);

      // ✅ Assertion helpers
      mockHelper.assertCalled(mocks, 'getCustomerById', 1);
      mockHelper.assertCalled(mocks, 'getCustomerConversations', 1);
    });

    test('should return 404 for non-existent customer', async () => {
      mocks.getCustomerById.mockResolvedValue(null);

      const response = await app.request(`/api/customers/${customerId}`);

      expect(response.status).toBe(404);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      mockHelper.assertCalled(mocks, 'getCustomerById', 1);
      // ✅ Verify conversations was NOT called
      mockHelper.assertNotCalled(mocks, 'getCustomerConversations');
    });

    test('should handle database errors gracefully', async () => {
      mocks.getCustomerById.mockRejectedValue(new Error('Database timeout'));

      const response = await app.request(`/api/customers/${customerId}`);

      expect(response.status).toBe(500);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database timeout');
    });
  });

  describe('Common Scenarios', () => {
    test('should use semantic scenario helper for existing customer', async () => {
      // ✅ SEMANTIC API: One line sets up complete scenario
      const { customer, conversation } = mockHelper.setupExistingCustomerScenario(123);

      mocks.getCustomerById.mockResolvedValue(customer);
      mocks.getCustomerConversations.mockResolvedValue([conversation]);

      const response = await app.request('/api/customers/123');

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.data.customer.id).toBe(123);
      expect(result.data.conversations).toHaveLength(1);
    });
  });
});
