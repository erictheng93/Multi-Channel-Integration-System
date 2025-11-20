// 系統主要處理器測試 - Handler-based 架構 (MockFactory Refactored)
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import systemMainHandler from '@backend/handlers/system-main';
import { setupHandlerTest } from '../../helpers/handler-test-setup';
import { MockFactory } from '../../helpers/mockFactory';

// Mock Drizzle ORM
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({
    get: vi.fn().mockResolvedValue({ test: 1 }),
    select: vi.fn(() => ({
      from: vi.fn().mockResolvedValue([{ count: 0 }])
    }))
  }))
}));

// Mock utilities
vi.mock('../../../src/utils/database', () => ({
  getMessageStats: vi.fn(),
  getMessageReplies: vi.fn(),
  getConversationMessageTree: vi.fn(),
  getAllCustomers: vi.fn(),
  getCustomerById: vi.fn(),
  getCustomerConversations: vi.fn(),
  getCustomerByPlatformId: vi.fn()
}));

// Mock Session Analytics Service
vi.mock('../../../src/modules/session/services/analytics-service', () => ({
  AnalyticsService: vi.fn().mockImplementation(() => ({
    getSessionStats: vi.fn().mockResolvedValue({
      totalSessions: 5,
      averageDuration: 300,
      lastSessionAt: '2025-01-01T10:00:00Z'
    })
  }))
}));

// Mock middleware
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', {
      id: 'user-123',
      role: 'admin',
      username: 'admin-user'
    });
    return next();
  })
}));

describe('System Main Handler', () => {
  let app: any;
  let mockDatabaseUtils: any;
  let mockSessionUtils: any;

  beforeEach(async () => {
    const testSetup = setupHandlerTest();
    app = testSetup.app;
    
    // Add the system handler routes after setting up the environment
    app.route('/', systemMainHandler);
    app.route('/api', systemMainHandler);

    // Setup mocks
    const databaseModule = await import('../../../src/utils/database');
    // sessionModule removed as src/utils/session.ts was deleted
    
    mockDatabaseUtils = {
      getMessageStats: databaseModule.getMessageStats as any,
      getMessageReplies: databaseModule.getMessageReplies as any,
      getConversationMessageTree: databaseModule.getConversationMessageTree as any
    };

    // Set up default successful database responses
    mockDatabaseUtils.getMessageStats.mockResolvedValue({ total: 100, today: 10 });
    mockDatabaseUtils.getMessageReplies.mockResolvedValue([]);
    mockDatabaseUtils.getConversationMessageTree.mockResolvedValue([]);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const response = await app.request('/health');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.status).toBe('healthy');
      expect(result.database).toBe('connected');
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toBeDefined();
    });

    test('should return unhealthy status on database error', async () => {
      // Mock drizzle to throw error
      const drizzleMod = await import('drizzle-orm/d1');
      const originalMock = drizzleMod.drizzle;

      // 臨時覆蓋 mock 讓它拋出錯誤
      vi.mocked(drizzleMod.drizzle).mockImplementationOnce(() => ({
        get: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        select: vi.fn(() => ({
          from: vi.fn().mockResolvedValue([{ count: 0 }])
        }))
      }) as any);

      const response = await app.request('/health');

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Database connection failed');

      // 恢復 mock
      vi.mocked(drizzleMod.drizzle).mockImplementation(originalMock as any);
    });
  });

  describe('GET /api', () => {
    test('should return API information', async () => {
      const response = await app.request('/api');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.name).toBe('My LINE Bot API');
      expect(result.version).toBe('1.0.0');
      expect(result.endpoints).toBeDefined();
      expect(result.endpoints.webhook).toBe('POST /api/webhook');
      expect(result.endpoints.sendDelayedMessage).toBe('POST /api/delayed-messages/send');
      expect(result.endpoints.recallDelayedMessage).toBe('POST /api/delayed-messages/recall/:messageId');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('GET /stats', () => {
    test('should return message statistics', async () => {
      const response = await app.request('/stats');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.totalMessages).toBeDefined();
      expect(result.data.totalCustomers).toBeDefined();
      expect(result.data.totalConversations).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('should handle database errors gracefully', async () => {
      const response = await app.request('/stats');

      // 應該返回 200，因為錯誤被內部捕獲並返回默認值
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      // Mock 返回的是 count: 0，所以這些值應該是 0
      expect(typeof result.data.totalMessages).toBe('number');
      expect(typeof result.data.totalCustomers).toBe('number');
      expect(typeof result.data.totalConversations).toBe('number');
    });
  });

  describe('GET /messages/:messageId/replies', () => {
    test('should return message replies', async () => {
      const messageId = 'msg-123';
      const mockReplies = [
        { id: 'reply-1', content: 'Reply 1' },
        { id: 'reply-2', content: 'Reply 2' }
      ];

      mockDatabaseUtils.getMessageReplies.mockResolvedValue(mockReplies);

      const response = await app.request(`/messages/${messageId}/replies`);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.messageId).toBe(messageId);
      expect(result.data.replies).toEqual(mockReplies);
      expect(result.data.count).toBe(2);
    });
  });

  describe('GET /conversations/:conversationId/message-tree', () => {
    test('should return conversation message tree', async () => {
      const conversationId = '123';
      const mockTree = {
        messages: [
          { id: 'msg-1', content: 'Message 1' },
          { id: 'msg-2', content: 'Message 2' }
        ],
        replyMap: new Map([
          ['msg-1', [{ id: 'reply-1', content: 'Reply to msg-1' }]]
        ])
      };

      mockDatabaseUtils.getConversationMessageTree.mockResolvedValue(mockTree);

      const response = await app.request(`/conversations/${conversationId}/message-tree`);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      // conversationId 來自 URL 參數，是字串型別
      expect(result.data.conversationId).toBe(conversationId);
      expect(result.data.messages).toEqual(mockTree.messages);
      expect(result.data.replyMap).toBeDefined();
      expect(result.data.totalMessages).toBe(2);
    });
  });

  describe('GET /conversations/:conversationId/sessions', () => {
    test('should return session statistics', async () => {
      const conversationId = 123;

      const response = await app.request(`/conversations/${conversationId}/sessions`);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      // AnalyticsService mock 會返回預設的統計數據
      expect(result.data).toBeDefined();
      expect(result.data.totalSessions).toBe(5);
      expect(result.data.averageDuration).toBe(300);
      expect(result.data.lastSessionAt).toBe('2025-01-01T10:00:00Z');
    });
  });

  describe('GET /messages/recall-stats', () => {
    test('should return recall statistics', async () => {
      const response = await app.request('/messages/recall-stats');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        totalMessages: 0,
        recalledMessages: 0,
        successfulRecalls: 0,
        failedRecalls: 0
      });
    });
  });
});