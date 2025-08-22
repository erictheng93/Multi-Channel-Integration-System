// 對話管理主要處理器測試 - Handler-based 架構
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import conversationMainHandler from '../../../src/handlers/conversation-main';
import { PermissionService } from '../../../src/services/permission-service';
import { setupHandlerTest } from '../../helpers/handler-test-setup';

// Mock services with proper hoisting
vi.mock('../../../src/services/permission-service', () => ({
  PermissionService: {
    checkPermission: vi.fn(),
    getVisibleConversations: vi.fn()
  }
}));

// Mock middleware
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', { 
      id: 'user-123', 
      role: 'agent',
      username: 'test-user'
    });
    return next();
  })
}));

describe('Conversation Main Handler', () => {
  let app: any;
  let mockPermissionService: any;
  let mockDB: any;

  beforeEach(async () => {
    const testSetup = setupHandlerTest();
    app = testSetup.app;
    
    // Create mock DB that will be used by the handler
    mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true, changes: 1 }),
          first: vi.fn().mockResolvedValue({ test: 1 }),
          all: vi.fn().mockResolvedValue({ results: [] })
        })
      })
    };
    
    // Override the app's environment with our mock DB
    app.use('*', (c, next) => {
      c.env = {
        ...c.env,
        DB: mockDB
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
    
    // Configure the mocked static methods
    vi.mocked(MockedPermissionService.checkPermission).mockImplementation(mockPermissionService.checkPermission);
    vi.mocked(MockedPermissionService.getVisibleConversations).mockImplementation(mockPermissionService.getVisibleConversations);

    vi.clearAllMocks();
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

      // Verify database calls
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations')
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
      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      const response = await app.request(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignRequest)
      });

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
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
          customer_name: 'Customer 1',
          platform: 'line',
          status: 'active'
        },
        {
          id: 2,
          customer_name: 'Customer 2',
          platform: 'facebook',
          status: 'pending'
        }
      ];

      // Mock 權限服務返回可見的對話 ID
      mockPermissionService.getVisibleConversations.mockResolvedValue([1, 2]);
      vi.mocked(PermissionService.getVisibleConversations).mockResolvedValue([1, 2]);
      
      // 確保資料庫查詢返回對話數據
      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockConversations })
        })
      });

      const response = await app.request('/api/conversations');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConversations);

      expect(vi.mocked(PermissionService.getVisibleConversations)).toHaveBeenCalledWith('user-123');
    });

    it('should return empty list when no visible conversations', async () => {
      mockPermissionService.getVisibleConversations.mockResolvedValue([]);

      const response = await app.request('/api/conversations');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockPermissionService.getVisibleConversations.mockResolvedValue([1, 2]);
      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('Database query failed'))
        })
      });

      const response = await app.request('/api/conversations');

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database query failed');
    });
  });

  describe('GET /:id', () => {
    const conversationId = 123;

    it('should return conversation details', async () => {
      const mockConversation = {
        id: conversationId,
        customer_name: 'Test Customer',
        platform: 'line',
        status: 'active',
        team_name: 'Support Team',
        assigned_user_name: 'Agent Smith'
      };

      // 確保權限檢查通過
      mockPermissionService.checkPermission.mockResolvedValue(true);
      vi.mocked(PermissionService.checkPermission).mockResolvedValue(true);
      
      // 確保資料庫返回對話詳情
      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockConversation)
        })
      });

      const response = await app.request(`/api/conversations/${conversationId}`);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConversation);

      expect(vi.mocked(PermissionService.checkPermission)).toHaveBeenCalledWith(
        'user-123',
        'conversation',
        'read',
        {
          userId: 'user-123',
          role: 'agent',
          resourceId: conversationId
        }
      );
    });

    it('should reject access without permission', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(false);

      const response = await app.request(`/api/conversations/${conversationId}`);

      expect(response.status).toBe(403);

      const result = await response.json();
      expect(result.error).toBe('Permission denied');
    });

    it('should return 404 for non-existent conversation', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(true);
      mockDB.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      });

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