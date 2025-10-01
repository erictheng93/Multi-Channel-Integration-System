// Session Service 單元測試
// Unit tests for session service

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionService } from '@modules/session/services/session-service';
import {
  createMockSession,
  createMockCreateSessionData,
  createMockUpdateSessionData,
  createMockListQuery,
  createMockSearchQuery,
  createMockBatchOperation,
  createMockSessionMessage,
  validateSessionData,
  generateTestSessionId,
  generateTestConversationId
} from '../../helpers/session-test-helpers';
import {
  mockSessions,
  mockSessionStats,
  mockActivityStats,
  mockBatchOperationResults
} from '../../helpers/mock-data';
import type {
  ConversationSession,
  CreateSessionData,
  UpdateSessionData,
  SessionListQuery,
  SessionSearchQuery,
  BatchSessionOperation,
  SessionStats
} from '../../../../../src/modules/session/types/session-types';

// ======================== Mock Setup ========================

// Mock D1 Database
const mockDatabase = {
  prepare: vi.fn(),
  dump: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn()
} as unknown as D1Database;

// Mock Drizzle ORM - 建立穩定的Mock鏈式調用
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn()
};

const mockInsertChain = {
  values: vi.fn().mockResolvedValue({ changes: 1, meta: {} }),
  returning: vi.fn().mockReturnThis(),
  run: vi.fn()
};

const mockUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  run: vi.fn()
};

const mockDeleteChain = {
  where: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  run: vi.fn()
};

const mockDb = {
  select: vi.fn(() => mockSelectChain),
  insert: vi.fn(() => mockInsertChain),
  update: vi.fn(() => mockUpdateChain),
  delete: vi.fn(() => mockDeleteChain)
};

// Mock drizzle function
vi.mock('drizzle-orm/d1', () => ({
  drizzle: () => mockDb
}));

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService(mockDatabase);
    // 只清空調用記錄，不重置Mock實現
    mockSelectChain.get.mockClear();
    mockSelectChain.all.mockClear();
    mockInsertChain.values.mockClear();
    mockUpdateChain.set.mockClear();
    mockDeleteChain.where.mockClear();
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
  });

  // ======================== 基本CRUD操作測試 ========================

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create a new session successfully', async () => {
        const createData = createMockCreateSessionData();
        mockSelectChain.get.mockResolvedValue(null); // No existing session

        const result = await sessionService.create(createData);

        expect(result).toBeDefined();
        expect(result.id).toMatch(/^session_/);
        expect(result.conversationId).toBe(createData.conversation_id);
        expect(result.sessionType).toBe(createData.sessionType);
        expect(result.isActive).toBe(true);
        expect(result.messageCount).toBe(0);

        expect(mockDb.insert).toHaveBeenCalledTimes(1);
        expect(mockInsertChain.values).toHaveBeenCalledTimes(1);
      });

      it('should generate topic automatically from message content', async () => {
        const createData = createMockCreateSessionData({
          messageContent: '我的訂單什麼時候可以配送',
          topic: undefined
        });
        mockSelectChain.get.mockResolvedValue(null);

        const result = await sessionService.create(createData);

        expect(result.topic).toBe('訂單查詢');
      });

      it('should use provided topic over extracted topic', async () => {
        const createData = createMockCreateSessionData({
          messageContent: '我的訂單什麼時候可以配送',
          topic: 'Custom Topic'
        });
        mockSelectChain.get.mockResolvedValue(null);

        const result = await sessionService.create(createData);

        expect(result.topic).toBe('Custom Topic');
      });

      it('should handle JSON metadata properly', async () => {
        const createData = createMockCreateSessionData({
          metadata: { source: 'test', priority: 'high' },
          tags: ['urgent', 'vip']
        });
        mockSelectChain.get.mockResolvedValue(null);

        const result = await sessionService.create(createData);

        expect(result.metadata).toEqual({ source: 'test', priority: 'high' });
        expect(result.tags).toEqual(['urgent', 'vip']);
      });

      it('should handle database insertion error', async () => {
        const createData = createMockCreateSessionData();
        mockSelectChain.get.mockResolvedValue(null);
        mockInsertChain.values.mockRejectedValue(new Error('Database insertion failed'));

        await expect(sessionService.create(createData)).rejects.toThrow(
          'Failed to create session'
        );
      });
    });

    describe('get', () => {
      it('should retrieve session by id', async () => {
        const mockSessionData = {
          id: 'session_test_001',
          conversationId: 'conv_001',
          sessionType: 'support',
          topic: 'Test Topic',
          startTime: '2024-01-15T10:00:00.000Z',
          endTime: null,
          lastActivity: '2024-01-15T11:00:00.000Z',
          messageCount: 5,
          isActive: true,
          createdAt: '2024-01-15T10:00:00.000Z',
          tags: '["test", "support"]',
          metadata: '{"testData": true}'
        };

        mockSelectChain.get.mockResolvedValue(mockSessionData);

        const result = await sessionService.get('session_test_001');

        expect(result).toBeDefined();
        expect(result!.id).toBe('session_test_001');
        expect(result!.tags).toEqual(['test', 'support']);
        expect(result!.metadata).toEqual({ testData: true });

        expect(mockDb.select).toHaveBeenCalledTimes(1);
        expect(mockSelectChain.where).toHaveBeenCalledTimes(1);
        expect(mockSelectChain.get).toHaveBeenCalledTimes(1);
      });

      it('should return null for non-existent session', async () => {
        mockSelectChain.get.mockResolvedValue(null);

        const result = await sessionService.get('nonexistent_session');

        expect(result).toBeNull();
      });

      it('should handle database query error', async () => {
        mockSelectChain.get.mockRejectedValue(new Error('Database query failed'));

        await expect(sessionService.get('session_test_001')).rejects.toThrow(
          'Failed to get session'
        );
      });
    });

    describe('update', () => {
      it('should update session successfully', async () => {
        const existingSession = createMockSession({ id: 'session_test_001' });
        const updateData = createMockUpdateSessionData({
          topic: 'Updated Topic',
          priority: 'high'
        });

        // Mock get to return existing session
        mockSelectChain.get.mockResolvedValueOnce({
          ...existingSession,
          tags: JSON.stringify(existingSession.tags || []),
          metadata: JSON.stringify(existingSession.metadata || {})
        });

        // Mock get again for the updated session
        mockSelectChain.get.mockResolvedValueOnce({
          ...existingSession,
          topic: 'Updated Topic',
          tags: JSON.stringify(updateData.tags || []),
          metadata: JSON.stringify(updateData.metadata || {})
        });

        const result = await sessionService.update('session_test_001', updateData);

        expect(result).toBeDefined();
        expect(result.topic).toBe('Updated Topic');

        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockUpdateChain.set).toHaveBeenCalledTimes(1);
        expect(mockSelectChain.where).toHaveBeenCalledTimes(2);
      });

      it('should throw error when session not found', async () => {
        mockSelectChain.get.mockResolvedValue(null);

        await expect(
          sessionService.update('nonexistent_session', { topic: 'New Topic' })
        ).rejects.toThrow('Session not found: nonexistent_session');
      });

      it('should handle partial update data', async () => {
        const existingSession = createMockSession({ id: 'session_test_001' });
        const updateData = { isActive: false };

        mockSelectChain.get.mockResolvedValueOnce({
          ...existingSession,
          tags: JSON.stringify(existingSession.tags || []),
          metadata: JSON.stringify(existingSession.metadata || {})
        });

        mockSelectChain.get.mockResolvedValueOnce({
          ...existingSession,
          isActive: false,
          tags: JSON.stringify(existingSession.tags || []),
          metadata: JSON.stringify(existingSession.metadata || {})
        });

        const result = await sessionService.update('session_test_001', updateData);

        expect(result.isActive).toBe(false);
        expect(result.topic).toBe(existingSession.topic); // Should remain unchanged
      });
    });

    describe('delete', () => {
      it('should delete session successfully', async () => {
        const existingSession = createMockSession({ id: 'session_test_001' });

        mockSelectChain.get.mockResolvedValue({
          ...existingSession,
          tags: JSON.stringify(existingSession.tags || []),
          metadata: JSON.stringify(existingSession.metadata || {})
        });

        const result = await sessionService.delete('session_test_001');

        expect(result).toBe(true);
        expect(mockDb.delete).toHaveBeenCalledTimes(1);
        expect(mockSelectChain.where).toHaveBeenCalledTimes(2); // One for get, one for delete
      });

      it('should throw error when session not found for deletion', async () => {
        mockSelectChain.get.mockResolvedValue(null);

        await expect(sessionService.delete('nonexistent_session')).rejects.toThrow(
          'Session not found: nonexistent_session'
        );
      });
    });
  });

  // ======================== 列表和搜尋測試 ========================

  describe('List and Search Operations', () => {
    describe('list', () => {
      it('should return paginated session list', async () => {
        const mockSessions = [
          {
            id: 'session_001',
            conversationId: 'conv_001',
            sessionType: 'support',
            topic: 'Support Topic',
            startTime: '2024-01-15T10:00:00.000Z',
            endTime: null,
            lastActivity: '2024-01-15T11:00:00.000Z',
            messageCount: 5,
            isActive: true,
            createdAt: '2024-01-15T10:00:00.000Z',
            tags: null,
            metadata: null
          },
          {
            id: 'session_002',
            conversationId: 'conv_002',
            sessionType: 'continuous',
            topic: 'General Chat',
            startTime: '2024-01-15T12:00:00.000Z',
            endTime: null,
            lastActivity: '2024-01-15T13:00:00.000Z',
            messageCount: 10,
            isActive: true,
            createdAt: '2024-01-15T12:00:00.000Z',
            tags: null,
            metadata: null
          }
        ];

        // Mock count query
        mockSelectChain.get.mockResolvedValueOnce({ count: 2 });

        // Mock sessions query
        mockSelectChain.all.mockResolvedValueOnce(mockSessions);

        // Mock summary query
        mockSelectChain.get.mockResolvedValueOnce({ count: 2 }); // Total
        mockSelectChain.get.mockResolvedValueOnce({ count: 2 }); // Active

        const query = createMockListQuery({ page: 1, pageSize: 20 });
        const result = await sessionService.list(query);

        expect(result).toBeDefined();
        expect(result.sessions).toHaveLength(2);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.total).toBe(2);
        expect(result.pagination.totalPages).toBe(1);
        expect(result.summary.totalSessions).toBe(2);
        expect(result.summary.activeSessions).toBe(2);
      });

      it('should handle empty results', async () => {
        // Mock count query
        mockSelectChain.get.mockResolvedValueOnce({ count: 0 });

        // Mock sessions query
        mockSelectChain.all.mockResolvedValueOnce([]);

        // Mock summary query
        mockSelectChain.get.mockResolvedValueOnce({ count: 0 }); // Total
        mockSelectChain.get.mockResolvedValueOnce({ count: 0 }); // Active

        const query = createMockListQuery();
        const result = await sessionService.list(query);

        expect(result.sessions).toHaveLength(0);
        expect(result.pagination.total).toBe(0);
        expect(result.summary.totalSessions).toBe(0);
      });

      it('should apply filters correctly', async () => {
        const query = createMockListQuery({
          isActive: true,
          sessionType: 'support',
          conversationId: 'conv_001'
        });

        // Mock count query
        mockSelectChain.get.mockResolvedValueOnce({ count: 1 });

        // Mock sessions query
        mockSelectChain.all.mockResolvedValueOnce([]);

        // Mock summary query
        mockSelectChain.get.mockResolvedValueOnce({ count: 1 }); // Total
        mockSelectChain.get.mockResolvedValueOnce({ count: 1 }); // Active

        const result = await sessionService.list(query);

        expect(mockSelectChain.where).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should handle pagination correctly', async () => {
        const query = createMockListQuery({ page: 2, pageSize: 10 });

        // Mock count query
        mockSelectChain.get.mockResolvedValueOnce({ count: 25 });

        // Mock sessions query
        mockSelectChain.all.mockResolvedValueOnce([]);

        // Mock summary query
        mockSelectChain.get.mockResolvedValueOnce({ count: 25 }); // Total
        mockSelectChain.get.mockResolvedValueOnce({ count: 15 }); // Active

        const result = await sessionService.list(query);

        expect(result.pagination.page).toBe(2);
        expect(result.pagination.pageSize).toBe(10);
        expect(result.pagination.total).toBe(25);
        expect(result.pagination.totalPages).toBe(3);
        expect(result.pagination.hasNext).toBe(true);
        expect(result.pagination.hasPrev).toBe(true);

        expect(mockSelectChain.offset).toHaveBeenCalledWith(10); // (page-1) * pageSize
      });
    });

    describe('search', () => {
      it('should search sessions by query string', async () => {
        const searchResults = [
          {
            id: 'session_001',
            conversationId: 'conv_001',
            sessionType: 'support',
            topic: 'Support Topic',
            startTime: '2024-01-15T10:00:00.000Z',
            endTime: null,
            lastActivity: '2024-01-15T11:00:00.000Z',
            messageCount: 5,
            isActive: true,
            createdAt: '2024-01-15T10:00:00.000Z',
            tags: null,
            metadata: null
          }
        ];

        mockSelectChain.all.mockResolvedValue(searchResults);

        const query = createMockSearchQuery({ query: 'support' });
        const result = await sessionService.search(query);

        expect(result).toHaveLength(1);
        expect(result[0].topic).toBe('Support Topic');

        expect(mockSelectChain.where).toHaveBeenCalled();
        expect(mockSelectChain.limit).toHaveBeenCalled();
      });

      it('should handle empty search results', async () => {
        mockSelectChain.all.mockResolvedValue([]);

        const query = createMockSearchQuery({ query: 'nonexistent' });
        const result = await sessionService.search(query);

        expect(result).toHaveLength(0);
      });

      it('should apply search filters', async () => {
        const query = createMockSearchQuery({
          query: 'support',
          conversationId: 'conv_001',
          sessionType: 'support'
        });

        mockSelectChain.all.mockResolvedValue([]);

        const result = await sessionService.search(query);

        expect(mockSelectChain.where).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });
  });

  // ======================== 會話管理測試 ========================

  describe('Session Management', () => {
    describe('getOrCreate', () => {
      it('should create new session when no active session exists', async () => {
        // Mock no existing active session
        mockSelectChain.get.mockResolvedValueOnce(null);

        const conversationId = generateTestConversationId();
        const result = await sessionService.getOrCreate(
          conversationId,
          'Hello, I need help',
          'customer'
        );

        expect(result).toBeDefined();
        expect(result.conversationId).toBe(conversationId);
        expect(result.isActive).toBe(true);
        expect(mockDb.insert).toHaveBeenCalledTimes(1);
      });

      it('should return existing active session when appropriate', async () => {
        const existingSession = {
          id: 'session_001',
          conversationId: 'conv_001',
          sessionType: 'continuous',
          topic: 'Existing Topic',
          startTime: '2024-01-15T10:00:00.000Z',
          endTime: null,
          lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
          messageCount: 5,
          isActive: true,
          createdAt: '2024-01-15T10:00:00.000Z',
          tags: null,
          metadata: null
        };

        // Mock existing active session
        mockSelectChain.get.mockResolvedValueOnce(existingSession);

        const result = await sessionService.getOrCreate(
          'conv_001',
          'Another message',
          'customer'
        );

        expect(result).toBeDefined();
        expect(result.id).toBe('session_001');
        expect(mockDb.update).toHaveBeenCalledTimes(1); // Update activity
        expect(mockDb.insert).not.toHaveBeenCalled(); // No new session created
      });

      it('should close old session and create new when boundary detected', async () => {
        const existingSession = {
          id: 'session_001',
          conversationId: 'conv_001',
          sessionType: 'continuous',
          topic: 'Old Topic',
          startTime: '2024-01-15T08:00:00.000Z',
          endTime: null,
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          messageCount: 30,
          isActive: true,
          createdAt: '2024-01-15T08:00:00.000Z',
          tags: null,
          metadata: null
        };

        // Mock existing session with boundary condition (time gap)
        mockSelectChain.get.mockResolvedValueOnce(existingSession);

        const result = await sessionService.getOrCreate(
          'conv_001',
          'New topic - billing question',
          'customer'
        );

        expect(result).toBeDefined();
        expect(result.id).not.toBe('session_001'); // New session created
        expect(mockDb.update).toHaveBeenCalledTimes(1); // Close old session
        expect(mockDb.insert).toHaveBeenCalledTimes(1); // Create new session
      });
    });

    describe('closeSession', () => {
      it('should close session successfully', async () => {
        const result = await sessionService.closeSession('session_001');

        expect(result).toBe(true);
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockUpdateChain.set).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: false,
            endTime: expect.any(String)
          })
        );
      });

      it('should handle close session error', async () => {
        mockUpdateChain.set.mockImplementation(() => {
          throw new Error('Database update failed');
        });

        await expect(sessionService.closeSession('session_001')).rejects.toThrow(
          'Failed to close session'
        );
      });
    });

    describe('reopenSession', () => {
      it('should reopen session successfully', async () => {
        const result = await sessionService.reopenSession('session_001');

        expect(result).toBe(true);
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockUpdateChain.set).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: true,
            endTime: null,
            lastActivity: expect.any(String)
          })
        );
      });
    });
  });

  // ======================== 訊息相關測試 ========================

  describe('Message Operations', () => {
    describe('getMessages', () => {
      it('should return session messages with pagination', async () => {
        const existingSession = createMockSession({ id: 'session_001' });
        const mockMessages = [
          {
            id: 1,
            conversationId: 1,
            sessionId: 'session_001',
            senderType: 'customer',
            agentSenderId: null,
            customerSenderId: 1,
            content: 'Hello',
            messageType: 'text',
            sessionSequence: 1,
            platformMessageId: null,
            metadata: null,
            createdAt: '2024-01-15T10:00:00.000Z'
          },
          {
            id: 2,
            conversationId: 1,
            sessionId: 'session_001',
            senderType: 'agent',
            agentSenderId: 'agent_001',
            customerSenderId: null,
            content: 'Hi, how can I help?',
            messageType: 'text',
            sessionSequence: 2,
            platformMessageId: null,
            metadata: null,
            createdAt: '2024-01-15T10:01:00.000Z'
          }
        ];

        // Mock session exists
        mockSelectChain.get.mockResolvedValueOnce({
          ...existingSession,
          tags: JSON.stringify(existingSession.tags || []),
          metadata: JSON.stringify(existingSession.metadata || {})
        });

        // Mock message count
        mockSelectChain.get.mockResolvedValueOnce({ count: 2 });

        // Mock messages query
        mockSelectChain.all.mockResolvedValueOnce(mockMessages);

        const result = await sessionService.getMessages('session_001', 1, 20);

        expect(result).toBeDefined();
        expect(result.sessionId).toBe('session_001');
        expect(result.messages).toHaveLength(2);
        expect(result.messageCount).toBe(2);
        expect(result.pagination.total).toBe(2);

        const customerMessage = result.messages.find(m => m.senderType === 'customer');
        const agentMessage = result.messages.find(m => m.senderType === 'agent');

        expect(customerMessage?.senderId).toBe('1');
        expect(agentMessage?.senderId).toBe('agent_001');
      });

      it('should throw error when session not found', async () => {
        mockSelectChain.get.mockResolvedValue(null);

        await expect(
          sessionService.getMessages('nonexistent_session', 1, 20)
        ).rejects.toThrow('Session not found: nonexistent_session');
      });
    });

    describe('addMessage', () => {
      it('should add message to session successfully', async () => {
        const existingSession = createMockSession({ id: 'session_001' });
        const messageData = {
          conversationId: '1',
          senderId: 'customer_001',
          senderType: 'customer' as const,
          content: 'New message content',
          messageType: 'text' as const
        };

        // Mock session exists
        mockSelectChain.get.mockResolvedValueOnce({
          ...existingSession,
          tags: JSON.stringify(existingSession.tags || []),
          metadata: JSON.stringify(existingSession.metadata || {})
        });

        // Mock sequence number query
        mockSelectChain.get.mockResolvedValueOnce({ nextSequence: 3 });

        // Mock inserted message query
        mockSelectChain.all.mockResolvedValueOnce([{
          id: 123,
          conversationId: 1,
          sessionId: 'session_001',
          senderType: 'customer',
          agentSenderId: null,
          customerSenderId: 1,
          content: 'New message content',
          messageType: 'text',
          sessionSequence: 3,
          platformMessageId: null,
          metadata: null,
          createdAt: '2024-01-15T10:05:00.000Z'
        }]);

        const result = await sessionService.addMessage('session_001', messageData);

        expect(result).toBeDefined();
        expect(result.id).toBe('123');
        expect(result.sessionSequence).toBe(3);
        expect(result.content).toBe('New message content');

        expect(mockDb.insert).toHaveBeenCalledTimes(1);
        expect(mockDb.update).toHaveBeenCalledTimes(1); // Update session activity
      });

      it('should handle agent message correctly', async () => {
        const existingSession = createMockSession({ id: 'session_001' });
        const messageData = {
          conversationId: '1',
          senderId: 'agent_001',
          senderType: 'agent' as const,
          content: 'Agent response',
          messageType: 'text' as const
        };

        // Mock session exists
        mockSelectChain.get.mockResolvedValueOnce({
          ...existingSession,
          tags: JSON.stringify(existingSession.tags || []),
          metadata: JSON.stringify(existingSession.metadata || {})
        });

        // Mock sequence number query
        mockSelectChain.get.mockResolvedValueOnce({ nextSequence: 1 });

        // Mock inserted message query
        mockSelectChain.all.mockResolvedValueOnce([{
          id: 456,
          conversationId: 1,
          sessionId: 'session_001',
          senderType: 'agent',
          agentSenderId: 'agent_001',
          customerSenderId: null,
          content: 'Agent response',
          messageType: 'text',
          sessionSequence: 1,
          platformMessageId: null,
          metadata: null,
          createdAt: '2024-01-15T10:05:00.000Z'
        }]);

        const result = await sessionService.addMessage('session_001', messageData);

        expect(result.senderType).toBe('agent');
        expect(result.senderId).toBe('agent_001');
      });
    });
  });

  // ======================== 統計和分析測試 ========================

  describe('Statistics and Analytics', () => {
    describe('getStats', () => {
      it('should return session statistics', async () => {
        // Mock basic stats query
        mockSelectChain.get.mockResolvedValueOnce({
          totalSessions: 100,
          activeSessions: 25,
          avgMessages: 15.5
        });

        // Mock type stats query
        mockSelectChain.all.mockResolvedValueOnce([
          { sessionType: 'continuous', count: 40 },
          { sessionType: 'support', count: 35 },
          { sessionType: 'marketing', count: 15 },
          { sessionType: 'scheduled', count: 10 }
        ]);

        const result = await sessionService.getStats();

        expect(result).toBeDefined();
        expect(result.totalSessions).toBe(100);
        expect(result.activeSessions).toBe(25);
        expect(result.inactiveSessions).toBe(75);
        expect(result.averageMessagesPerSession).toBe(16); // Rounded
        expect(result.sessionsByType).toBeDefined();
      });

      it('should return conversation-specific statistics', async () => {
        // Mock basic stats query
        mockSelectChain.get.mockResolvedValueOnce({
          totalSessions: 10,
          activeSessions: 3,
          avgMessages: 20
        });

        // Mock type stats query
        mockSelectChain.all.mockResolvedValueOnce([
          { sessionType: 'continuous', count: 6 },
          { sessionType: 'support', count: 4 }
        ]);

        const result = await sessionService.getStats('conv_001');

        expect(result.totalSessions).toBe(10);
        expect(result.activeSessions).toBe(3);
      });

      it('should handle empty statistics', async () => {
        // Mock empty stats
        mockSelectChain.get.mockResolvedValueOnce({
          totalSessions: 0,
          activeSessions: 0,
          avgMessages: 0
        });

        mockSelectChain.all.mockResolvedValueOnce([]);

        const result = await sessionService.getStats();

        expect(result.totalSessions).toBe(0);
        expect(result.activeSessions).toBe(0);
        expect(result.inactiveSessions).toBe(0);
      });
    });

    describe('getActivityStats', () => {
      it('should return activity statistics', async () => {
        const query = {
          conversationId: 'conv_001',
          timeRange: 'week' as const
        };

        const result = await sessionService.getActivityStats(query);

        expect(result).toBeDefined();
        expect(result.conversationId).toBe('conv_001');
        expect(result.timeRange).toBe('week');
        expect(result.activities).toBeInstanceOf(Array);
        expect(result.summary).toBeDefined();
      });
    });
  });

  // ======================== 批量操作測試 ========================

  describe('Batch Operations', () => {
    describe('batchOperation', () => {
      it('should perform successful batch close operation', async () => {
        const operation = createMockBatchOperation({
          action: 'close',
          sessionIds: ['session_001', 'session_002']
        });

        const result = await sessionService.batchOperation(operation);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.totalRequested).toBe(2);
        expect(result.successCount).toBe(2);
        expect(result.failedCount).toBe(0);
        expect(result.results).toHaveLength(2);

        expect(mockDb.update).toHaveBeenCalledTimes(2); // Two sessions closed
      });

      it('should perform successful batch reopen operation', async () => {
        const operation = createMockBatchOperation({
          action: 'reopen',
          sessionIds: ['session_001', 'session_002']
        });

        const result = await sessionService.batchOperation(operation);

        expect(result.success).toBe(true);
        expect(mockDb.update).toHaveBeenCalledTimes(2);
      });

      it('should handle batch delete operation', async () => {
        const operation = createMockBatchOperation({
          action: 'delete',
          sessionIds: ['session_001', 'session_002']
        });

        // Mock sessions exist
        mockSelectChain.get.mockResolvedValueOnce({ id: 'session_001' });
        mockSelectChain.get.mockResolvedValueOnce({ id: 'session_002' });

        const result = await sessionService.batchOperation(operation);

        expect(result.success).toBe(true);
        expect(mockDb.delete).toHaveBeenCalledTimes(2);
      });

      it('should handle partial batch operation failure', async () => {
        const operation = createMockBatchOperation({
          action: 'close',
          sessionIds: ['session_001', 'session_002', 'nonexistent_session']
        });

        // Mock one of the operations to fail
        mockUpdateChain.set.mockImplementationOnce(() => {
          // First call succeeds (do nothing)
        }).mockImplementationOnce(() => {
          // Second call succeeds (do nothing)
        }).mockImplementationOnce(() => {
          // Third call fails
          throw new Error('Session not found');
        });

        const result = await sessionService.batchOperation(operation);

        expect(result.success).toBe(false);
        expect(result.totalRequested).toBe(3);
        expect(result.successCount).toBe(2);
        expect(result.failedCount).toBe(1);
        expect(result.results[2].success).toBe(false);
        expect(result.results[2].error).toBe('Session not found');
      });
    });
  });

  // ======================== 工具方法測試 ========================

  describe('Utility Methods', () => {
    describe('analyzeSessionHealth', () => {
      it('should return healthy session report', async () => {
        const healthySession = createMockSession({
          id: 'session_001',
          isActive: true,
          messageCount: 20,
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
        });

        // Mock session exists
        mockSelectChain.get.mockResolvedValue({
          ...healthySession,
          tags: JSON.stringify(healthySession.tags || []),
          metadata: JSON.stringify(healthySession.metadata || {})
        });

        const result = await sessionService.analyzeSessionHealth('session_001');

        expect(result).toBeDefined();
        expect(result.healthy).toBe(true);
        expect(result.issues).toHaveLength(0);
        expect(result.suggestions).toHaveLength(0);
      });

      it('should return unhealthy session report', async () => {
        const unhealthySession = createMockSession({
          id: 'session_001',
          isActive: true,
          messageCount: 150, // Too many messages
          startTime: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), // 50 hours ago
          lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago (inactive)
        });

        // Mock session exists
        mockSelectChain.get.mockResolvedValue({
          ...unhealthySession,
          tags: JSON.stringify(unhealthySession.tags || []),
          metadata: JSON.stringify(unhealthySession.metadata || {})
        });

        const result = await sessionService.analyzeSessionHealth('session_001');

        expect(result.healthy).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.issues).toContain('會話持續時間過長');
        expect(result.issues).toContain('會話訊息數量過多');
        expect(result.issues).toContain('會話長時間無活動');
      });

      it('should throw error when session not found', async () => {
        mockSelectChain.get.mockResolvedValue(null);

        await expect(
          sessionService.analyzeSessionHealth('nonexistent_session')
        ).rejects.toThrow('Session not found: nonexistent_session');
      });
    });
  });

  // ======================== 錯誤處理測試 ========================

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSelectChain.get.mockRejectedValue(new Error('Database connection failed'));

      await expect(sessionService.get('session_001')).rejects.toThrow(
        'Failed to get session'
      );
    });

    it('should handle invalid data gracefully', async () => {
      const invalidData = {
        conversationId: '', // Invalid
        senderType: 'invalid_type' // Invalid
      } as any;

      await expect(sessionService.create(invalidData)).rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const createData = createMockCreateSessionData();

      // Simulate concurrent creation requests
      const promises = Array.from({ length: 3 }, () =>
        sessionService.create(createData)
      );

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.conversationId).toBe(createData.conversation_id);
      });

      // Each should have unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  // ======================== 配置測試 ========================

  describe('Configuration', () => {
    it('should use custom configuration', async () => {
      const customConfig = {
        timeGapThreshold: 60,
        maxMessagesPerSession: 25
      };

      const customService = new SessionService(mockDatabase, customConfig);

      const session = createMockSession({
        lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes
        messageCount: 20
      });

      const detection = await customService.detectSessionBoundary(
        session,
        'Test message',
        'customer'
      );

      // With 60-minute threshold, 45 minutes should not trigger new session
      expect(detection.shouldCreateNew).toBe(false);
    });

    it('should use default configuration when none provided', async () => {
      const defaultService = new SessionService(mockDatabase);

      const session = createMockSession({
        lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes
        messageCount: 20
      });

      const detection = await defaultService.detectSessionBoundary(
        session,
        'Test message',
        'customer'
      );

      // With default 30-minute threshold, 45 minutes should trigger new session
      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('time_gap');
    });
  });
});