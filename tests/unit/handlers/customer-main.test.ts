// 客戶管理主要處理器測試 - Handler-based 架構
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import customerMainHandler from '../../../src/handlers/customer-main';
import { setupHandlerTest } from '../../helpers/handler-test-setup';

// Mock utilities
vi.mock('../../../src/utils/database', () => ({
  getAllCustomers: vi.fn(),
  getCustomerById: vi.fn(),
  getCustomerConversations: vi.fn(),
  getCustomerByPlatformId: vi.fn()
}));

describe('Customer Main Handler', () => {
  let app: any;
  let mockDatabaseUtils: any;

  beforeEach(async () => {
    const testSetup = setupHandlerTest();
    app = testSetup.app;
    
    // Add the customer handler routes after setting up the environment
    app.route('/api/customers', customerMainHandler);

    // Setup mocks
    const databaseModule = await import('../../../src/utils/database');
    mockDatabaseUtils = {
      getAllCustomers: databaseModule.getAllCustomers as any,
      getCustomerById: databaseModule.getCustomerById as any,
      getCustomerConversations: databaseModule.getCustomerConversations as any,
      getCustomerByPlatformId: databaseModule.getCustomerByPlatformId as any
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /', () => {
    it('should return all customers', async () => {
      const mockCustomers = [
        {
          id: 1,
          displayName: 'Customer 1',
          platform: 'line',
          platformUserId: 'line-user-1'
        },
        {
          id: 2,
          displayName: 'Customer 2',
          platform: 'facebook',
          platformUserId: 'fb-user-1'
        }
      ];

      mockDatabaseUtils.getAllCustomers.mockResolvedValue(mockCustomers);

      const response = await app.request('/api/customers');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.customers).toEqual(mockCustomers);
      expect(result.data.count).toBe(2);
      expect(result.timestamp).toBeDefined();

      expect(mockDatabaseUtils.getAllCustomers).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should handle database errors', async () => {
      mockDatabaseUtils.getAllCustomers.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.request('/api/customers');

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should return empty list when no customers', async () => {
      mockDatabaseUtils.getAllCustomers.mockResolvedValue([]);

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

    it('should return customer details with conversations', async () => {
      const mockCustomer = {
        id: customerId,
        displayName: 'Test Customer',
        platform: 'line',
        platformUserId: 'line-user-123'
      };

      const mockConversations = [
        {
          id: 1,
          status: 'active',
          createdAt: '2025-01-01T10:00:00Z'
        },
        {
          id: 2,
          status: 'closed',
          createdAt: '2025-01-02T10:00:00Z'
        }
      ];

      mockDatabaseUtils.getCustomerById.mockResolvedValue(mockCustomer);
      mockDatabaseUtils.getCustomerConversations.mockResolvedValue(mockConversations);

      const response = await app.request(`/api/customers/${customerId}`);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.customer).toEqual(mockCustomer);
      expect(result.data.conversations).toEqual(mockConversations);
      expect(result.data.conversationCount).toBe(2);

      expect(mockDatabaseUtils.getCustomerById).toHaveBeenCalledWith(
        expect.any(Object),
        customerId
      );
      expect(mockDatabaseUtils.getCustomerConversations).toHaveBeenCalledWith(
        expect.any(Object),
        customerId
      );
    });

    it('should return 404 for non-existent customer', async () => {
      mockDatabaseUtils.getCustomerById.mockResolvedValue(null);

      const response = await app.request(`/api/customers/${customerId}`);

      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found');
    });

    it('should handle database errors', async () => {
      mockDatabaseUtils.getCustomerById.mockRejectedValue(new Error('Database query failed'));

      const response = await app.request(`/api/customers/${customerId}`);

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database query failed');
    });

    it('should handle invalid customer ID', async () => {
      const response = await app.request('/api/customers/invalid-id');

      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.success).toBe(false);
      // Should handle NaN from parseInt('invalid-id')
    });
  });

  describe('GET /platform/:platform/:platformUserId', () => {
    const platform = 'line';
    const platformUserId = 'line-user-123';

    it('should return customer by platform ID', async () => {
      const mockCustomer = {
        id: 456,
        displayName: 'Platform Customer',
        platform: platform,
        platformUserId: platformUserId
      };

      const mockConversations = [
        {
          id: 3,
          status: 'pending',
          createdAt: '2025-01-03T10:00:00Z'
        }
      ];

      mockDatabaseUtils.getCustomerByPlatformId.mockResolvedValue(mockCustomer);
      mockDatabaseUtils.getCustomerConversations.mockResolvedValue(mockConversations);

      const response = await app.request(`/api/customers/platform/${platform}/${platformUserId}`);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.customer).toEqual(mockCustomer);
      expect(result.data.conversations).toEqual(mockConversations);
      expect(result.data.conversationCount).toBe(1);

      expect(mockDatabaseUtils.getCustomerByPlatformId).toHaveBeenCalledWith(
        expect.any(Object),
        platform,
        platformUserId
      );
      expect(mockDatabaseUtils.getCustomerConversations).toHaveBeenCalledWith(
        expect.any(Object),
        456
      );
    });

    it('should return 404 for non-existent platform customer', async () => {
      mockDatabaseUtils.getCustomerByPlatformId.mockResolvedValue(null);

      const response = await app.request(`/api/customers/platform/${platform}/${platformUserId}`);

      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found');
    });

    it('should handle various platform types', async () => {
      const platforms = ['line', 'facebook', 'telegram'];
      
      for (const testPlatform of platforms) {
        mockDatabaseUtils.getCustomerByPlatformId.mockResolvedValue({
          id: 1,
          platform: testPlatform,
          platformUserId: `${testPlatform}-user-1`
        });
        mockDatabaseUtils.getCustomerConversations.mockResolvedValue([]);

        const response = await app.request(`/api/customers/platform/${testPlatform}/user-1`);
        
        expect(response.status).toBe(200);
        expect(mockDatabaseUtils.getCustomerByPlatformId).toHaveBeenCalledWith(
          expect.any(Object),
          testPlatform,
          'user-1'
        );
      }
    });

    it('should handle database errors for platform lookup', async () => {
      mockDatabaseUtils.getCustomerByPlatformId.mockRejectedValue(new Error('Platform lookup failed'));

      const response = await app.request(`/api/customers/platform/${platform}/${platformUserId}`);

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Platform lookup failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle module import errors', async () => {
      // Simulate critical database failure that would occur on module import
      mockDatabaseUtils.getAllCustomers.mockRejectedValue(
        new Error('Module import failed')
      );

      const response = await app.request('/api/customers');

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Module import failed');

      // Restore mock for subsequent tests
      vi.clearAllMocks();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Mock a synchronous error during execution
      mockDatabaseUtils.getAllCustomers.mockImplementation(() => {
        throw new TypeError('Unexpected error');
      });

      const response = await app.request('/api/customers');

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');

      // Restore mock for subsequent tests
      vi.clearAllMocks();
    });
  });
});