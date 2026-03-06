// Conversations Module Unit Tests
// 對話模組單元測試

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { ConversationService } from '@modules/conversations/services/conversation-service';
import type {
  ConversationListRequest,
  ConversationAssignRequest,
} from '@backend/modules/conversations/types/conversation-types';

// Mock drizzle-orm/d1 — must use vi.mock at top level
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn()
}));

// Mock drizzle-orm operators (use plain functions — vi.fn() can interfere with tagged templates)
vi.mock('drizzle-orm', () => {
  function sqlMock(..._args: any[]) {
    return { as: (_name: string) => ({ type: 'sql_alias' }) };
  }
  sqlMock.raw = (..._args: any[]) => ({ type: 'sql_raw' });

  return {
    eq: (...args: any[]) => ({ type: 'eq', args }),
    desc: (...args: any[]) => ({ type: 'desc', args }),
    and: (...args: any[]) => ({ type: 'and', args }),
    count: () => ({ type: 'count' }),
    sql: sqlMock
  };
});

// Mock database schema (must match @/db/schema alias used by the service)
vi.mock('@/db/schema', () => ({
  conversations: {
    id: { name: 'id' },
    customerId: { name: 'customerId' },
    assignedTeamId: { name: 'assignedTeamId' },
    status: { name: 'status' },
    priority: { name: 'priority' },
    firstResponseAt: { name: 'firstResponseAt' },
    closedAt: { name: 'closedAt' },
    lastMessageAt: { name: 'lastMessageAt' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
    deletedAt: { name: 'deletedAt' }
  },
  messages: {
    id: { name: 'id' },
    conversationId: { name: 'conversationId' },
    senderType: { name: 'senderType' },
    customerSenderId: { name: 'customerSenderId' },
    agentSenderId: { name: 'agentSenderId' },
    content: { name: 'content' },
    messageType: { name: 'messageType' },
    platformMessageId: { name: 'platformMessageId' },
    isRecalled: { name: 'isRecalled' },
    isSent: { name: 'isSent' },
    deliveryStatus: { name: 'deliveryStatus' },
    senderName: { name: 'senderName' },
    metadata: { name: 'metadata' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
    deletedAt: { name: 'deletedAt' }
  },
  customers: {
    id: { name: 'id' },
    platform: { name: 'platform' },
    platformUserId: { name: 'platformUserId' },
    displayName: { name: 'displayName' }
  },
  agents: {
    id: { name: 'id' },
    displayName: { name: 'displayName' },
    email: { name: 'email' }
  },
  teams: {
    id: { name: 'id' }
  },
  conversationTransfers: {
    id: { name: 'id' },
    conversationId: { name: 'conversationId' },
    fromTeamId: { name: 'fromTeamId' },
    toTeamId: { name: 'toTeamId' },
    transferReason: { name: 'transferReason' },
    transferredBy: { name: 'transferredBy' },
    transferType: { name: 'transferType' },
    createdAt: { name: 'createdAt' }
  }
}));

// Mock drizzle-factory (imported by service but not actively used)
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn()
}));

/**
 * Creates a chainable mock database for Drizzle ORM.
 *
 * All query-builder methods (from, where, leftJoin, etc.) return `this`
 * so any chain of method calls works. The mock is thenable — `await`-ing
 * any chain resolves the next result from a FIFO queue.
 */
function createMockDb() {
  const selectResults: any[][] = [];

  function createSelectChain() {
    const chain: Record<string, any> = {};
    const methods = ['from', 'where', 'leftJoin', 'innerJoin', 'orderBy', 'limit', 'offset', 'groupBy', 'having'];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Make thenable — `await chain` pops the next queued result
    chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
      const result = selectResults.shift() ?? [];
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  }

  function createInsertChain() {
    const chain: Record<string, any> = {};
    chain.values = vi.fn().mockReturnValue(chain);
    chain.onConflictDoNothing = vi.fn().mockReturnValue(chain);
    chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
    return chain;
  }

  function createUpdateChain() {
    const chain: Record<string, any> = {};
    chain.set = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
    return chain;
  }

  function createDeleteChain() {
    const chain: Record<string, any> = {};
    chain.where = vi.fn().mockReturnValue(chain);
    chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
    return chain;
  }

  return {
    select: vi.fn().mockImplementation(() => createSelectChain()),
    insert: vi.fn().mockImplementation(() => createInsertChain()),
    update: vi.fn().mockImplementation(() => createUpdateChain()),
    delete: vi.fn().mockImplementation(() => createDeleteChain()),
    /** Queue results for sequential select() calls (FIFO order) */
    _queueResults(...results: any[][]) {
      selectResults.length = 0;
      selectResults.push(...results);
    }
  };
}

// ---------------------------------------------------------------------------

describe('ConversationService', () => {
  let service: ConversationService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    // Use vi.mocked() to access the mock's .mockReturnValue (fixes the original error)
    vi.mocked(drizzle).mockReturnValue(mockDb as any);
    service = new ConversationService({} as D1Database);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── createConversation ───────────────────────────────────────────────

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const now = new Date().toISOString();
      const mockResult = {
        id: 'conversation-123',
        customerId: 'customer-123',
        status: 'active',
        priority: 'medium',
        createdAt: now,
        updatedAt: now
      };

      // insert → void, then select → [mockResult]
      mockDb._queueResults([mockResult]);

      const result = await service.createConversation({
        customerId: 'customer-123',
        status: 'active',
        priority: 'medium'
      } as any);

      expect(result).toBeDefined();
      expect(result.customerId).toBe('customer-123');
      expect(result.status).toBe('active');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should generate UUID for conversation ID if not provided', async () => {
      const mockResult = {
        id: 'auto-generated-uuid',
        customerId: 'customer-123',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb._queueResults([mockResult]);

      const result = await service.createConversation({
        customerId: 'customer-123',
        status: 'active'
      } as any);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });
  });

  // ── getConversation ──────────────────────────────────────────────────

  describe('getConversation', () => {
    it('should return conversation with details', async () => {
      const mockResult = {
        conversation: {
          id: 'conversation-123',
          customerId: 'customer-123',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        customer: {
          id: 'customer-123',
          displayName: 'Test Customer',
          platform: 'line'
        },
        messageCount: 5,
        latestMessageId: 'msg-1',
        latestMessageContent: 'Hello',
        latestMessageSenderType: 'customer',
        latestMessageCreatedAt: new Date().toISOString(),
        latestMessageType: 'text'
      };

      // Single optimized query with subqueries
      mockDb._queueResults([mockResult]);

      const result = await service.getConversation('conversation-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('conversation-123');
      expect(result?.messageCount).toBe(5);
      expect(result?.latestMessage).toBeDefined();
      expect(result?.latestMessage?.content).toBe('Hello');
      expect(result?.customer).toBeDefined();
    });

    it('should return null if conversation not found', async () => {
      mockDb._queueResults([]);

      const result = await service.getConversation('non-existent');

      expect(result).toBeNull();
    });
  });

  // ── updateConversation ───────────────────────────────────────────────

  describe('updateConversation', () => {
    it('should update conversation and return updated data', async () => {
      const mockUpdated = {
        id: 'conversation-123',
        status: 'assigned',
        updatedAt: new Date().toISOString()
      };

      // update → void, then select → [mockUpdated]
      mockDb._queueResults([mockUpdated]);

      const result = await service.updateConversation('conversation-123', { status: 'assigned' } as any);

      expect(result).toBeDefined();
      expect(result.status).toBe('assigned');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ── deleteConversation ───────────────────────────────────────────────

  describe('deleteConversation', () => {
    it('should delete conversation and related data', async () => {
      const result = await service.deleteConversation('conversation-123');

      expect(result).toBe(true);
      // Deletes: messages, conversationTransfers, conversations (3 calls)
      expect(mockDb.delete).toHaveBeenCalledTimes(3);
    });

    it('should handle delete errors gracefully', async () => {
      // Make the first delete throw
      mockDb.delete.mockImplementationOnce(() => ({
        where: vi.fn().mockImplementation(() => {
          throw new Error('Delete failed');
        })
      }));

      const result = await service.deleteConversation('conversation-123');

      expect(result).toBe(false);
    });
  });

  // ── listConversations ────────────────────────────────────────────────

  describe('listConversations', () => {
    it('should return paginated conversations list', async () => {
      const mockConversations = [
        {
          conversation: { id: 'conv-1', status: 'active' },
          customer: { id: 'cust-1', displayName: 'Customer 1' },
          agent: null,
          messageCount: 3,
          latestMessageId: null,
          latestMessageContent: null,
          latestMessageSenderType: null,
          latestMessageCreatedAt: null,
          latestMessageType: null
        },
        {
          conversation: { id: 'conv-2', status: 'active' },
          customer: { id: 'cust-2', displayName: 'Customer 2' },
          agent: { id: 'agent-1', displayName: 'Agent 1', email: 'a@b.com' },
          messageCount: 5,
          latestMessageId: 'msg-1',
          latestMessageContent: 'Hello',
          latestMessageSenderType: 'customer',
          latestMessageCreatedAt: new Date().toISOString(),
          latestMessageType: 'text'
        }
      ];
      const mockTotal = [{ total: 25 }];

      // First select: conversations, second select: count
      mockDb._queueResults(mockConversations, mockTotal);

      const result = await service.listConversations({
        page: 1,
        limit: 20,
        status: 'active'
      });

      expect(result).toBeDefined();
      expect(result.conversations).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(25);
    });

    it('should apply filters correctly', async () => {
      mockDb._queueResults([], [{ total: 0 }]);

      const query: ConversationListRequest = {
        page: 1,
        limit: 10,
        status: 'active',
        teamId: 123
      };

      await service.listConversations(query);

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should limit page size to maximum allowed', async () => {
      mockDb._queueResults([], [{ total: 0 }]);

      const result = await service.listConversations({
        page: 1,
        limit: 500 // Exceeds max limit of 100
      });

      expect(result.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  // ── assignConversation (team-only) ───────────────────────────────────

  describe('assignConversation', () => {
    it('should assign conversation to team', async () => {
      // Basic assignment without reason (no transfer record created)
      const result = await service.assignConversation('conversation-123', {
        teamId: 789
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.conversationId).toBe('conversation-123');
      expect(result.assignedTo.type).toBe('team');
      expect(result.assignedTo.id).toBe(789);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw error when teamId not provided', async () => {
      await expect(
        service.assignConversation('conversation-123', {} as ConversationAssignRequest)
      ).rejects.toThrow('Team ID is required');
    });

    it('should create transfer record when reason provided', async () => {
      const mockTransfer = {
        conversationId: 'conversation-123',
        toTeamId: 789,
        transferReason: 'Escalation needed',
        transferredBy: 'system',
        transferType: 'manual',
        createdAt: new Date().toISOString()
      };

      // select for transfer record lookup
      mockDb._queueResults([mockTransfer]);

      const result = await service.assignConversation('conversation-123', {
        teamId: 789,
        reason: 'Escalation needed'
      });

      expect(result.transfer).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });

  // ── transferConversation (team-based) ────────────────────────────────

  describe('transferConversation', () => {
    it('should transfer conversation between teams', async () => {
      const mockTransfer = {
        conversationId: 'conversation-123',
        fromTeamId: 1,
        toTeamId: 2,
        transferReason: 'Load balancing',
        transferredBy: 'system',
        transferType: 'manual',
        createdAt: new Date().toISOString()
      };

      // update → void, insert → void, select → [mockTransfer]
      mockDb._queueResults([mockTransfer]);

      const result = await service.transferConversation(
        'conversation-123',
        1,    // fromTeamId
        2,    // toTeamId
        'Load balancing'
      );

      expect(result).toBeDefined();
      expect(result.fromTeamId).toBe(1);
      expect(result.toTeamId).toBe(2);
      expect(result.transferReason).toBe('Load balancing');
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // ── addMessage ───────────────────────────────────────────────────────

  describe('addMessage', () => {
    it('should add message to conversation', async () => {
      const mockMessage = {
        id: 'message-789',
        conversationId: 'conversation-123',
        content: 'Test message',
        senderType: 'customer',
        senderId: 'customer-456',
        createdAt: new Date().toISOString()
      };

      // insert → void, update → void, select → [mockMessage]
      mockDb._queueResults([mockMessage]);

      const result = await service.addMessage('conversation-123', {
        content: 'Test message',
        senderType: 'customer',
        senderId: 'customer-456'
      } as any);

      expect(result).toBeDefined();
      expect(result.conversationId).toBe('conversation-123');
      expect(result.content).toBe('Test message');
      expect(result.senderType).toBe('customer');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should generate UUID for message ID if not provided', async () => {
      const mockMessage = {
        id: 'auto-generated-uuid',
        conversationId: 'conversation-123',
        content: 'Test message',
        senderType: 'agent',
        senderId: 'agent-789',
        createdAt: new Date().toISOString()
      };

      mockDb._queueResults([mockMessage]);

      const result = await service.addMessage('conversation-123', {
        content: 'Test message',
        senderType: 'agent',
        senderId: 'agent-789'
      } as any);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });
  });

  // ── getMessages ──────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('should return messages for conversation', async () => {
      const mockMessages = [
        { id: 'msg-1', content: 'Message 1', createdAt: new Date().toISOString() },
        { id: 'msg-2', content: 'Message 2', createdAt: new Date().toISOString() }
      ];

      mockDb._queueResults(mockMessages);

      const result = await service.getMessages('conversation-123', 50, 0);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Message 1');
      expect(result[1].content).toBe('Message 2');
    });

    it('should limit message count to maximum allowed', async () => {
      mockDb._queueResults([]);

      await service.getMessages('conversation-123', 500, 0); // Exceeds max of 100

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // ── updateStatus ─────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update conversation status', async () => {
      const mockUpdated = {
        id: 'conversation-123',
        status: 'assigned',
        updatedAt: new Date().toISOString()
      };

      mockDb._queueResults([mockUpdated]);

      const result = await service.updateStatus('conversation-123', 'assigned');

      expect(result.status).toBe('assigned');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ── getConversationMetrics ───────────────────────────────────────────

  describe('getConversationMetrics', () => {
    it('should return conversation metrics', async () => {
      const mockTotalCount = { count: 150 };
      const mockActiveCount = { count: 45 };
      const mockTeamDistribution = [
        { teamId: 1, count: 30 },
        { teamId: 2, count: 25 }
      ];

      // Three sequential select() calls: total, active, teamDistribution
      mockDb._queueResults(
        [mockTotalCount],
        [mockActiveCount],
        mockTeamDistribution
      );

      const result = await service.getConversationMetrics();

      expect(result).toBeDefined();
      expect(result.totalConversations).toBe(150);
      expect(result.openConversations).toBe(45);
      expect(result.closedConversations).toBe(0); // closed status removed from service
      expect(result.teamDistribution).toHaveLength(2);
    });

    it('should return zero metrics when database is empty', async () => {
      mockDb._queueResults(
        [{ count: 0 }],   // total
        [{ count: 0 }],   // active
        []                 // no teams
      );

      const result = await service.getConversationMetrics();

      expect(result.totalConversations).toBe(0);
      expect(result.openConversations).toBe(0);
      expect(result.teamDistribution).toHaveLength(0);
    });

    it('should handle null count results gracefully', async () => {
      mockDb._queueResults(
        [{ count: null }],
        [{ count: null }],
        []
      );

      const result = await service.getConversationMetrics();

      expect(result.totalConversations).toBe(0);
      expect(result.openConversations).toBe(0);
    });
  });

  // ── Error paths ────────────────────────────────────────────────────────

  describe('error paths', () => {
    it('createConversation should throw when select returns empty after insert', async () => {
      // insert succeeds, but select returns empty
      mockDb._queueResults([]);

      await expect(
        service.createConversation({ customerId: 'c-1', status: 'active' } as any)
      ).rejects.toThrow('Failed to create conversation');
    });

    it('updateConversation should throw when conversation not found after update', async () => {
      // update succeeds, but select returns empty
      mockDb._queueResults([]);

      await expect(
        service.updateConversation('non-existent', { status: 'active' } as any)
      ).rejects.toThrow('Failed to update conversation');
    });

    it('addMessage should throw when message not found after insert', async () => {
      // insert + update succeed, but select returns empty
      mockDb._queueResults([]);

      await expect(
        service.addMessage('conv-1', {
          content: 'test',
          senderType: 'customer',
          senderId: 'cust-1'
        } as any)
      ).rejects.toThrow('Failed to create message');
    });

    it('transferConversation should throw when transfer record not created', async () => {
      // update → void, insert → void, select returns empty
      mockDb._queueResults([]);

      await expect(
        service.transferConversation('conv-1', 1, 2, 'reason')
      ).rejects.toThrow('Failed to create transfer record');
    });

    it('assignConversation should throw when transfer record creation fails', async () => {
      // Assignment with reason → insert transfer → select returns empty
      mockDb._queueResults([]);

      await expect(
        service.assignConversation('conv-1', {
          teamId: 789,
          reason: 'Escalation'
        })
      ).rejects.toThrow('Failed to create transfer record');
    });
  });

  // ── searchConversations ────────────────────────────────────────────────

  describe('searchConversations', () => {
    it('should delegate to listConversations with status filter', async () => {
      mockDb._queueResults([], [{ total: 0 }]);

      const result = await service.searchConversations({
        query: 'test search',
        filters: { status: ['active'] },
        page: 1,
        limit: 10
      });

      expect(result).toBeDefined();
      expect(result.conversations).toEqual([]);
      expect(result.pagination).toBeDefined();
    });

    it('should handle search with no filters', async () => {
      mockDb._queueResults([], [{ total: 0 }]);

      const result = await service.searchConversations({
        query: 'anything',
        page: 1,
        limit: 20
      });

      expect(result.conversations).toEqual([]);
      expect(result.pagination.page).toBe(1);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('listConversations should work with no filters (no where clause)', async () => {
      mockDb._queueResults([], [{ total: 0 }]);

      const result = await service.listConversations({ page: 1, limit: 10 });

      expect(result.conversations).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('listConversations should apply customerId filter', async () => {
      mockDb._queueResults([], [{ total: 0 }]);

      const result = await service.listConversations({
        page: 1,
        limit: 10,
        customerId: '42'
      });

      expect(mockDb.select).toHaveBeenCalled();
      expect(result.pagination.total).toBe(0);
    });

    it('listConversations should use default page and limit', async () => {
      mockDb._queueResults([], [{ total: 0 }]);

      const result = await service.listConversations({});

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('getMessages should use default parameters', async () => {
      mockDb._queueResults([]);

      const result = await service.getMessages('conv-1');

      expect(result).toEqual([]);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('getConversation should handle missing latestMessage gracefully', async () => {
      const mockResult = {
        conversation: {
          id: 'conv-1',
          customerId: 'c-1',
          status: 'active'
        },
        customer: null,
        messageCount: 0,
        latestMessageId: null,
        latestMessageContent: null,
        latestMessageSenderType: null,
        latestMessageCreatedAt: null,
        latestMessageType: null
      };
      mockDb._queueResults([mockResult]);

      const result = await service.getConversation('conv-1');

      expect(result).toBeDefined();
      expect(result?.latestMessage).toBeUndefined();
      expect(result?.messageCount).toBe(0);
      expect(result?.customer).toBeUndefined();
    });

    it('deleteConversation should delete messages, transfers, and conversation', async () => {
      const result = await service.deleteConversation('conv-1');

      expect(result).toBe(true);
      // Verify all 3 delete calls: messages, transfers, conversations
      expect(mockDb.delete).toHaveBeenCalledTimes(3);
    });

    it('updateStatus should delegate to updateConversation with reason ignored', async () => {
      const mockUpdated = { id: 'conv-1', status: 'pending' };
      mockDb._queueResults([mockUpdated]);

      const result = await service.updateStatus('conv-1', 'pending', 'some reason');

      expect(result.status).toBe('pending');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('transferConversation should use default reason when none provided', async () => {
      const mockTransfer = {
        conversationId: 'conv-1',
        fromTeamId: null,
        toTeamId: 2,
        transferReason: 'Manual transfer',
        transferredBy: 'system',
        transferType: 'manual'
      };
      mockDb._queueResults([mockTransfer]);

      const result = await service.transferConversation('conv-1', null, 2);

      expect(result.transferReason).toBe('Manual transfer');
      expect(result.fromTeamId).toBeNull();
    });
  });
});
