// 對話管理主要處理器測試 - Handler-based 架構
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock problematic imports FIRST
vi.mock('@modules/realtime', () => ({
  realtime: {
    route: vi.fn().mockReturnValue({}),
    createEvent: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('@shared/database/schema', () => ({
  conversations: {},
  agents: {},
  conversationTransfers: {},
  customers: {},
  teams: {},
  conversationTags: {}
}));

// Mock middleware - IMPORTANT: Mock the correct middleware used by the handler
vi.mock('../../../src/middleware/database', () => ({
  databaseMiddleware: vi.fn((c, next) => {
    // Mock database and kv
    c.set('db', {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(null)
    });
    c.set('kv', {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined)
    });
    return next();
  }),
  authMiddleware: vi.fn((c, next) => {
    // Mock agent data
    c.set('agent', {
      id: 'user-123',
      role: 'agent',
      username: 'test-user',
      displayName: 'Test Agent',
      teamId: 1,
      isActive: true
    });
    return next();
  })
}));

// Export mock methods to module scope so tests can control them
export const mockDbMethods = {
  getConversationsByRole: vi.fn().mockResolvedValue([]),
  canAgentAccessConversation: vi.fn().mockResolvedValue(true),
  getConversationById: vi.fn().mockResolvedValue({ id: '123', status: 'active' }),
  getMessagesByConversationId: vi.fn().mockResolvedValue([]),
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-1', content: 'test' }),
  updateConversation: vi.fn().mockResolvedValue({}),
  markMessagesAsRead: vi.fn().mockResolvedValue(undefined)
};

// Mock DatabaseService - return exported methods so tests can modify them
vi.mock('../../../src/services/database', () => ({
  DatabaseService: vi.fn(function() {
    return mockDbMethods;
  })
}));

import conversationMainHandler from '@backend/handlers/conversation';
import { PermissionService } from '@backend/services/permission-service';
import { setupHandlerTest } from '../../helpers/handler-test-setup';

// Global mock data management
let mockConversationData: any[] = [];
let mockError: Error | null = null;

// Mock services with proper hoisting
vi.mock('../../../src/services/permission-service', () => ({
  PermissionService: {
    checkPermission: vi.fn(),
    getVisibleConversations: vi.fn()
  }
}));

// Mock Drizzle ORM with proper query chain support
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    const mockQueryChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      get: vi.fn(async () => {
        if (mockError) throw mockError;
        return mockConversationData.length > 0 ? mockConversationData[0] : null;
      }),
      all: vi.fn(async () => {
        if (mockError) throw mockError;
        return mockConversationData;
      }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn(async () => {
        if (mockError) throw mockError;
        return {};
      }),
      // 重點：直接await drizzle query chain會調用這個
      then: vi.fn((resolve, reject) => {
        if (mockError) {
          return Promise.reject(mockError).then(resolve, reject);
        }
        return Promise.resolve(mockConversationData).then(resolve, reject);
      })
    };
    
    return mockQueryChain;
  })
}));

describe('Conversation Main Handler', () => {
  let app: any;
  let mockPermissionService: any;
  let mockDB: any;

  beforeEach(async () => {
    const testSetup = setupHandlerTest();
    app = testSetup.app;

    // Create mock DB with Drizzle-style interface
    mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true, changes: 1 }),
          first: vi.fn().mockResolvedValue({ test: 1 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          get: vi.fn().mockResolvedValue({ test: 1 })
        })
      })
    };

    // Override the app's environment with our mock DB + KV
    app.use('*', (c, next) => {
      c.env = {
        ...c.env,
        DB: mockDB,
        KV: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined)
        }
      } as any;
      return next();
    });

    // Add the conversation handler routes after setting up the environment
    app.route('/api/conversations', conversationMainHandler);

    // Setup service mocks - access the mocked service
    const { PermissionService: MockedPermissionService } = await import('../../../src/services/permission-service');

    mockPermissionService = {
      checkPermission: vi.fn().mockResolvedValue(true),
      getVisibleConversations: vi.fn().mockResolvedValue([])
    };

    // Reset mock state
    mockConversationData = [];
    mockError = null;
    vi.clearAllMocks();

    // Configure the mocked static methods AFTER clearing
    vi.mocked(MockedPermissionService.checkPermission).mockImplementation(mockPermissionService.checkPermission);
    vi.mocked(MockedPermissionService.getVisibleConversations).mockImplementation(mockPermissionService.getVisibleConversations);

    // Reset DatabaseService mock methods to default behavior
    mockDbMethods.getConversationsByRole.mockResolvedValue([]);
    mockDbMethods.canAgentAccessConversation.mockResolvedValue(true);
    mockDbMethods.getConversationById.mockResolvedValue({ id: '123', status: 'active' });
    mockDbMethods.getMessagesByConversationId.mockResolvedValue([]);
    mockDbMethods.createMessage.mockResolvedValue({ id: 'msg-1', content: 'test' });
    mockDbMethods.updateConversation.mockResolvedValue({});
    mockDbMethods.markMessagesAsRead.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /:id/assign', () => {
    const conversationId = 123;
    const assignRequest = {
      teamId: 1,
      userId: 'user-456',
      reason: 'Reassignment for better handling'
    };

    it('should successfully assign conversation', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(true);
      mockError = null; // No error

      const response = await app.request(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignRequest)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Conversation assigned successfully');

      // Verify permission check
      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        'user-123',
        'conversation',
        'assign'
      );
    });

    it('should reject assignment without permission', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(false);

      const response = await app.request(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignRequest)
      });

      expect(response.status).toBe(403);

      const result = await response.json();
      expect(result.error).toBe('Permission denied');
    });

    it('should handle database errors', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(true);
      mockError = new Error('Failed query: update "conversations" set "assigned_team_id" = ?, "assigned_user_id" = ?, "updated_at" = ? where "conversations"."id" = ?\nparams: 1,user-456,2025-09-08T13:39:50.723Z,123');

      const response = await app.request(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignRequest)
      });

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed query:');
    });
  });

  describe('POST /:id/transfer', () => {
    const conversationId = 123;
    const transferRequest = {
      fromTeamId: 1,
      toTeamId: 2,
      fromUserId: 'user-123',
      toUserId: 'user-456',
      reason: 'Transfer to specialized team'
    };

    it('should successfully transfer conversation', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(true);

      // Mock drizzle查詢返回conversation數據
      mockConversationData = [{
        id: conversationId,
        status: 'active',
        assignedTeamId: 1,
        assignedUserId: 'user-123'
      }];
      mockError = null;

      const response = await app.request(`/api/conversations/${conversationId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferRequest)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Conversation transferred successfully');

      // Verify permission check
      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        'user-123',
        'conversation',
        'transfer'
      );
    });

    it('should reject transfer without permission', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(false);

      const response = await app.request(`/api/conversations/${conversationId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferRequest)
      });

      expect(response.status).toBe(403);

      const result = await response.json();
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('GET /', () => {
    it('should return visible conversations', async () => {
      const mockConversations = [
        {
          id: 1,
          customerId: 'customer-1',
          assignedTeamId: 1,
          assignedUserId: 'agent-1',
          status: 'active',
          lastMessageAt: '2024-01-01T10:00:00.000Z',
          createdAt: '2024-01-01T09:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
          customerName: 'Customer 1',
          platform: 'line',
          platformUserId: 'line-user-1'
        },
        {
          id: 2,
          customerId: 'customer-2',
          assignedTeamId: 1,
          assignedUserId: 'agent-2',
          status: 'pending',
          lastMessageAt: '2024-01-01T11:00:00.000Z',
          createdAt: '2024-01-01T09:30:00.000Z',
          updatedAt: '2024-01-01T11:00:00.000Z',
          customerName: 'Customer 2',
          platform: 'facebook',
          platformUserId: 'fb-user-2'
        }
      ];

      // Mock DatabaseService 返回對話列表
      mockDbMethods.getConversationsByRole.mockResolvedValue(mockConversations);

      // 設置全局mock數據 - 確保數組格式
      mockConversationData = mockConversations;
      mockError = null;

      const response = await app.request('/api/conversations');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.conversations).toBeDefined();
      expect(Array.isArray(result.data.conversations)).toBe(true);
      // 檢查返回的數據結構
      expect(result.data.conversations.length).toBeGreaterThan(0);

      // Verify DatabaseService method was called
      expect(mockDbMethods.getConversationsByRole).toHaveBeenCalled();
    });

    it('should return empty list when no visible conversations', async () => {
      mockPermissionService.getVisibleConversations.mockResolvedValue([]);

      const response = await app.request('/api/conversations');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.conversations).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Mock DatabaseService 拋出錯誤
      const dbError = new Error('Failed query: select "conversations"."id", "conversations"."customer_id", "conversations"."assigned_team_id", "conversations"."assigned_user_id", "conversations"."status", "conversations"."last_message_at", "conversations"."created_at", "conversations"."updated_at", "customers"."display_name", "customers"."platform", "customers"."platform_user_id" from "conversations" left join "customers" on "conversations"."customer_id" = "customers"."id" where "conversations"."id" in (?, ?) order by "conversations"."updated_at" desc\nparams: 1,2');
      mockDbMethods.getConversationsByRole.mockRejectedValue(dbError);

      mockError = dbError;
      mockConversationData = []; // 這個不會被使用到，因為會先拋出錯誤

      const response = await app.request('/api/conversations');

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed query:');
    });
  });

  describe('GET /:id', () => {
    const conversationId = 123;

    it('should return conversation details', async () => {
      const mockConversation = {
        id: conversationId,
        customerId: 'customer-123',
        assignedTeamId: 1,
        assignedUserId: 'agent-456',
        status: 'active',
        lastMessageAt: '2024-01-01T10:00:00.000Z',
        createdAt: '2024-01-01T09:00:00.000Z',
        updatedAt: '2024-01-01T10:00:00.000Z',
        customerName: 'Test Customer',
        platform: 'line',
        platformUserId: 'line-user-123'
      };

      // 確保權限檢查通過
      mockPermissionService.checkPermission.mockResolvedValue(true);
      vi.mocked(PermissionService.checkPermission).mockResolvedValue(true);

      // Mock DatabaseService 方法返回conversation數據
      mockDbMethods.canAgentAccessConversation.mockResolvedValue(true);
      mockDbMethods.getConversationById.mockResolvedValue(mockConversation);
      mockDbMethods.getMessagesByConversationId.mockResolvedValue([]);

      // 設置對話詳情數據
      mockConversationData = [mockConversation];
      mockError = null;

      const response = await app.request(`/api/conversations/${conversationId}`);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.conversation).toEqual(mockConversation);
      expect(result.data.messages).toBeDefined();

      // Verify DatabaseService methods were called
      expect(mockDbMethods.canAgentAccessConversation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123' }),
        conversationId.toString()
      );
      expect(mockDbMethods.getConversationById).toHaveBeenCalledWith(conversationId.toString());
      expect(mockDbMethods.getMessagesByConversationId).toHaveBeenCalled();
    });

    it('should reject access without permission', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(false);
      // Mock: access denied
      mockDbMethods.canAgentAccessConversation.mockResolvedValue(false);

      const response = await app.request(`/api/conversations/${conversationId}`);

      expect(response.status).toBe(403);

      const result = await response.json();
      expect(result.error).toBe('Access denied');
    });

    it('should return 404 for non-existent conversation', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(true);
      // Mock: conversation not found
      mockDbMethods.canAgentAccessConversation.mockResolvedValue(true);
      mockDbMethods.getConversationById.mockResolvedValue(null);
      mockDbMethods.getMessagesByConversationId.mockResolvedValue([]);
      mockConversationData = [];
      mockError = null;

      const response = await app.request(`/api/conversations/${conversationId}`);

      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Conversation not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const response = await app.request('/api/conversations/123/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json'
      });

      expect(response.status).toBe(500);
    });

    it('should handle permission service errors', async () => {
      mockPermissionService.checkPermission.mockRejectedValue(new Error('Permission service error'));

      const response = await app.request('/api/conversations/123/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: 1, userId: 'user-456' })
      });

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission service error');
    });
  });
});