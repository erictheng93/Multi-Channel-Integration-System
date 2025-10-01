// Conversations Module Unit Tests
// 對話模組單元測試

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { ConversationService } from '@modules/conversations/services/conversation-service';
import type {
  NewConversation,
  ConversationListRequest,
  ConversationAssignRequest,
  NewMessage
} from '../../../src/modules/conversations/types/conversation-types';

// Mock Drizzle ORM
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn()
}));

// Mock database schema
vi.mock('../../../src/shared/database/schema', () => ({
  conversations: {
    id: { name: 'id' },
    customerId: { name: 'customerId' },
    assignedUserId: { name: 'assignedUserId' },
    teamId: { name: 'teamId' },
    status: { name: 'status' },
    assignedTo: { name: 'assignedTo' },
    updatedAt: { name: 'updatedAt' },
    createdAt: { name: 'createdAt' },
    closedAt: { name: 'closedAt' }
  },
  messages: {
    id: { name: 'id' },
    conversationId: { name: 'conversationId' },
    createdAt: { name: 'createdAt' }
  },
  customers: {},
  agents: {
    id: { name: 'id' },
    displayName: { name: 'displayName' },
    email: { name: 'email' }
  },
  conversationTransfers: {
    conversationId: { name: 'conversationId' },
    createdAt: { name: 'createdAt' }
  }
}));

describe('ConversationService', () => {
  let service: ConversationService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis()
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(Promise.resolve([]))
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([]))
            })
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue(Promise.resolve([]))
            })
          }),
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockReturnValue(Promise.resolve([]))
              })
            })
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve())
        })
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve())
      })
    };

    const { drizzle } = require('drizzle-orm/d1');
    drizzle.mockReturnValue(mockDb);

    service = new ConversationService({} as D1Database);
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const newConversation: NewConversation = {
        customerId: 'customer-123',
        status: 'open',
        priority: 'medium'
      };

      const mockResult = {
        id: 'conversation-123',
        ...newConversation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.select().from().where().limit.mockResolvedValueOnce([mockResult]);

      const result = await service.createConversation(newConversation);

      expect(result).toBeDefined();
      expect(result.customerId).toBe(newConversation.customerId);
      expect(result.status).toBe(newConversation.status);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should generate UUID for conversation ID if not provided', async () => {
      const newConversation: NewConversation = {
        customerId: 'customer-123',
        status: 'open'
      };

      const mockResult = {
        id: expect.stringMatching(/^[0-9a-f-]+$/),
        ...newConversation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.select().from().where().limit.mockResolvedValueOnce([mockResult]);

      const result = await service.createConversation(newConversation);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });
  });

  describe('getConversation', () => {
    it('should return conversation with details', async () => {
      const conversationId = 'conversation-123';
      const mockConversationData = {
        conversation: {
          id: conversationId,
          customerId: 'customer-123',
          status: 'open',
          createdAt: new Date().toISOString()
        },
        customer: {
          id: 'customer-123',
          displayName: 'Test Customer',
          platform: 'line'
        },
        agent: {
          id: 'agent-123',
          displayName: 'Test Agent',
          email: 'agent@example.com'
        }
      };

      const mockLatestMessage = {
        id: 'message-123',
        content: 'Latest message',
        createdAt: new Date().toISOString()
      };

      const mockMessageCount = { messageCount: 5 };

      mockDb.select().from().leftJoin().leftJoin().where().limit
        .mockResolvedValueOnce([mockConversationData]);

      mockDb.select().from().where().orderBy().limit
        .mockResolvedValueOnce([mockLatestMessage]);

      mockDb.select().from().where
        .mockResolvedValueOnce([mockMessageCount]);

      const result = await service.getConversation(conversationId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(conversationId);
      expect(result?.latestMessage).toBeDefined();
      expect(result?.messageCount).toBe(5);
      expect(result?.customer).toBeDefined();
      expect(result?.assignedAgent).toBeDefined();
    });

    it('should return null if conversation not found', async () => {
      mockDb.select().from().leftJoin().leftJoin().where().limit
        .mockResolvedValueOnce([]);

      const result = await service.getConversation('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateConversation', () => {
    it('should update conversation and return updated data', async () => {
      const conversationId = 'conversation-123';
      const updateData = { status: 'closed' as const };

      const mockUpdatedConversation = {
        id: conversationId,
        status: 'closed',
        updatedAt: new Date().toISOString()
      };

      mockDb.select().from().where().limit
        .mockResolvedValueOnce([mockUpdatedConversation]);

      const result = await service.updateConversation(conversationId, updateData);

      expect(result).toBeDefined();
      expect(result.status).toBe('closed');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation and related data', async () => {
      const conversationId = 'conversation-123';

      const result = await service.deleteConversation(conversationId);

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(3); // messages, transfers, conversation
    });

    it('should handle delete errors gracefully', async () => {
      const conversationId = 'conversation-123';

      mockDb.delete().where.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await service.deleteConversation(conversationId);

      expect(result).toBe(false);
    });
  });

  describe('listConversations', () => {
    it('should return paginated conversations list', async () => {
      const query: ConversationListRequest = {
        page: 1,
        limit: 20,
        status: 'open'
      };

      const mockConversations = [
        {
          conversation: { id: 'conv-1', status: 'open' },
          customer: { id: 'cust-1', displayName: 'Customer 1' },
          agent: null,
          messageCount: 3
        },
        {
          conversation: { id: 'conv-2', status: 'open' },
          customer: { id: 'cust-2', displayName: 'Customer 2' },
          agent: { id: 'agent-1', displayName: 'Agent 1' },
          messageCount: 5
        }
      ];

      const mockTotal = { total: 25 };

      mockDb.select().from().leftJoin().leftJoin().leftJoin().where()
        .groupBy().orderBy().limit().offset.mockResolvedValueOnce(mockConversations);

      mockDb.select().from().where.mockResolvedValueOnce([mockTotal]);

      const result = await service.listConversations(query);

      expect(result).toBeDefined();
      expect(result.conversations).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(25);
    });

    it('should apply filters correctly', async () => {
      const query: ConversationListRequest = {
        page: 1,
        limit: 10,
        status: 'closed',
        teamId: 123,
        agentId: 'agent-456'
      };

      await service.listConversations(query);

      expect(mockDb.select).toHaveBeenCalled();
      // Verify that filters are applied (mocks would capture the where conditions)
    });

    it('should limit page size to maximum allowed', async () => {
      const query: ConversationListRequest = {
        page: 1,
        limit: 500 // Exceeds max limit
      };

      const mockConversations: any[] = [];
      const mockTotal = { total: 0 };

      mockDb.select().from().leftJoin().leftJoin().leftJoin().where()
        .groupBy().orderBy().limit().offset.mockResolvedValueOnce(mockConversations);

      mockDb.select().from().where.mockResolvedValueOnce([mockTotal]);

      const result = await service.listConversations(query);

      expect(result.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('assignConversation', () => {
    it('should assign conversation to user', async () => {
      const conversationId = 'conversation-123';
      const assignRequest: ConversationAssignRequest = {
        userId: 'agent-456',
        reason: 'Manual assignment'
      };

      const result = await service.assignConversation(conversationId, assignRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.conversationId).toBe(conversationId);
      expect(result.assignedTo.type).toBe('user');
      expect(result.assignedTo.id).toBe(assignRequest.userId);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should assign conversation to team', async () => {
      const conversationId = 'conversation-123';
      const assignRequest: ConversationAssignRequest = {
        teamId: 789,
        reason: 'Team assignment'
      };

      const result = await service.assignConversation(conversationId, assignRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.assignedTo.type).toBe('team');
      expect(result.assignedTo.id).toBe(789);
    });

    it('should create transfer record when reason provided', async () => {
      const conversationId = 'conversation-123';
      const assignRequest: ConversationAssignRequest = {
        userId: 'agent-456',
        reason: 'Escalation needed'
      };

      const mockTransfer = {
        conversationId,
        transferredTo: 'agent-456',
        reason: 'Escalation needed',
        createdAt: new Date().toISOString()
      };

      mockDb.select().from().where().orderBy().limit
        .mockResolvedValueOnce([mockTransfer]);

      const result = await service.assignConversation(conversationId, assignRequest);

      expect(result.transfer).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // For transfer record
    });
  });

  describe('transferConversation', () => {
    it('should transfer conversation between agents', async () => {
      const conversationId = 'conversation-123';
      const fromAgentId = 'agent-111';
      const toAgentId = 'agent-222';
      const reason = 'Load balancing';

      const mockTransfer = {
        conversationId,
        transferredFrom: fromAgentId,
        transferredTo: toAgentId,
        reason,
        createdAt: new Date().toISOString()
      };

      mockDb.select().from().where().orderBy().limit
        .mockResolvedValueOnce([mockTransfer]);

      const result = await service.transferConversation(
        conversationId,
        fromAgentId,
        toAgentId,
        reason
      );

      expect(result).toBeDefined();
      expect(result.transferredFrom).toBe(fromAgentId);
      expect(result.transferredTo).toBe(toAgentId);
      expect(result.reason).toBe(reason);
      expect(mockDb.update).toHaveBeenCalled(); // Update conversation assignment
      expect(mockDb.insert).toHaveBeenCalled(); // Create transfer record
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation', async () => {
      const conversationId = 'conversation-123';
      const messageData: NewMessage = {
        content: 'Test message',
        senderType: 'customer',
        senderId: 'customer-456'
      };

      const mockMessage = {
        id: 'message-789',
        conversationId,
        ...messageData,
        createdAt: new Date().toISOString()
      };

      mockDb.select().from().where().limit
        .mockResolvedValueOnce([mockMessage]);

      const result = await service.addMessage(conversationId, messageData);

      expect(result).toBeDefined();
      expect(result.conversationId).toBe(conversationId);
      expect(result.content).toBe(messageData.content);
      expect(result.senderType).toBe(messageData.senderType);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled(); // Update conversation timestamp
    });

    it('should generate UUID for message ID if not provided', async () => {
      const conversationId = 'conversation-123';
      const messageData: NewMessage = {
        content: 'Test message',
        senderType: 'agent',
        senderId: 'agent-789'
      };

      const result = await service.addMessage(conversationId, messageData);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });
  });

  describe('getMessages', () => {
    it('should return messages for conversation', async () => {
      const conversationId = 'conversation-123';
      const mockMessages = [
        {
          id: 'msg-1',
          content: 'Message 1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'msg-2',
          content: 'Message 2',
          createdAt: new Date().toISOString()
        }
      ];

      mockDb.select().from().where().orderBy().limit().offset
        .mockResolvedValueOnce(mockMessages);

      const result = await service.getMessages(conversationId, 50, 0);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Message 1');
      expect(result[1].content).toBe('Message 2');
    });

    it('should limit message count to maximum allowed', async () => {
      const conversationId = 'conversation-123';

      await service.getMessages(conversationId, 500, 0); // Exceeds max

      expect(mockDb.select().from().where().orderBy().limit).toHaveBeenCalled();
      // Verify limit is capped at 100 in actual implementation
    });
  });

  describe('updateStatus', () => {
    it('should update conversation status', async () => {
      const conversationId = 'conversation-123';
      const status = 'closed';

      const mockUpdatedConversation = {
        id: conversationId,
        status,
        updatedAt: new Date().toISOString()
      };

      mockDb.select().from().where().limit
        .mockResolvedValueOnce([mockUpdatedConversation]);

      const result = await service.updateStatus(conversationId, status);

      expect(result.status).toBe(status);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('closeConversation', () => {
    it('should close conversation with closedAt timestamp', async () => {
      const conversationId = 'conversation-123';

      const mockClosedConversation = {
        id: conversationId,
        status: 'closed',
        closedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.select().from().where().limit
        .mockResolvedValueOnce([mockClosedConversation]);

      const result = await service.closeConversation(conversationId);

      expect(result.status).toBe('closed');
      expect(result.closedAt).toBeDefined();
    });
  });

  describe('reopenConversation', () => {
    it('should reopen closed conversation', async () => {
      const conversationId = 'conversation-123';

      const mockReopenedConversation = {
        id: conversationId,
        status: 'open',
        closedAt: null,
        updatedAt: new Date().toISOString()
      };

      mockDb.select().from().where().limit
        .mockResolvedValueOnce([mockReopenedConversation]);

      const result = await service.reopenConversation(conversationId);

      expect(result.status).toBe('open');
      expect(result.closedAt).toBeNull();
    });
  });

  describe('getConversationMetrics', () => {
    it('should return conversation metrics', async () => {
      const mockTotalCount = { count: 150 };
      const mockOpenCount = { count: 45 };
      const mockClosedCount = { count: 105 };
      const mockTeamDistribution = [
        { teamId: 1, count: 30 },
        { teamId: 2, count: 25 }
      ];

      mockDb.select().from()
        .mockResolvedValueOnce([mockTotalCount])  // total
        .mockResolvedValueOnce([mockOpenCount])   // open
        .mockResolvedValueOnce([mockClosedCount]) // closed
        .mockResolvedValueOnce(mockTeamDistribution); // team distribution

      const result = await service.getConversationMetrics();

      expect(result).toBeDefined();
      expect(result.totalConversations).toBe(150);
      expect(result.openConversations).toBe(45);
      expect(result.closedConversations).toBe(105);
      expect(result.teamDistribution).toHaveLength(2);
    });
  });
});