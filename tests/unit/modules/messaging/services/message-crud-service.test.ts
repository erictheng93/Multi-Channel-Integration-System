// MessageCrudService Unit Tests
// Tests for src/modules/messaging/services/message-crud.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import {
  MessageNotFoundError,
  InvalidMessageDataError,
  type Message,
  type SenderType,
  type MessageType,
  type DeliveryStatus,
  type MessageSearchQuery
} from '@modules/messaging/types/message-types';

// ======================== Mock Data ========================

const NOW = '2024-06-15T10:00:00.000Z';
const RECALL_DEADLINE = '2024-06-15T10:30:00.000Z';

const mockMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  senderType: 'agent',
  customerSenderId: null,
  agentSenderId: 'agent-1',
  content: 'Hello, how can I help you?',
  messageType: 'text',
  platformMessageId: null,
  isRecalled: false,
  recallDeadline: RECALL_DEADLINE,
  recalledAt: null,
  isSent: true,
  sentAt: NOW,
  deliveryStatus: 'sent',
  replyToMessageId: null,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW
};

const mockCustomer = {
  id: 1,
  displayName: 'Customer A',
  avatarUrl: 'https://example.com/avatar.png',
  platform: 'line',
  platformUserId: 'U123',
  email: null,
  phone: null,
  sourceTeamId: null,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW
};

const mockAgent = {
  id: 'agent-1',
  displayName: 'Agent Smith',
  email: 'agent@example.com',
  role: 'agent',
  teamId: 1,
  isActive: true,
  passwordHash: '',
  passwordPolicy: 'changeable',
  lastActive: null,
  lastLoginAt: null,
  createdAt: NOW,
  updatedAt: NOW
};

// ======================== Drizzle Mock ========================

const createMockDrizzle = () => {
  const messagesStore = new Map<string, typeof mockMessage>();
  const recallLogs: Array<{ messageId: string; userId: string; action: string; createdAt: string }> = [];

  // Reset with default data
  messagesStore.set('msg-1', { ...mockMessage });

  /**
   * Creates a Drizzle-like query chain.
   * @param joined - if true, results are wrapped as {message, customerSender, agentSender}
   */
  const createChain = (joined: boolean = false) => {
    let _limitValue: number | null = null;
    let _offsetValue: number | null = null;

    const getRawResults = async () => {
      let results = Array.from(messagesStore.values());
      if (_offsetValue !== null) results = results.slice(_offsetValue);
      if (_limitValue !== null) results = results.slice(0, _limitValue);
      return results;
    };

    const getResults = async () => {
      const raw = await getRawResults();
      if (!joined) return raw;
      // Wrap in join format: {message, customerSender, agentSender}
      return raw.map(msg => ({
        message: msg,
        customerSender: msg.customerSenderId ? { ...mockCustomer } : null,
        agentSender: msg.agentSenderId ? { ...mockAgent } : null
      }));
    };

    const chain: any = {
      from: () => chain,
      select: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (value: number) => { _limitValue = value; return chain; },
      offset: (value: number) => { _offsetValue = value; return chain; },
      get: async () => {
        if (joined) {
          const results = await getResults();
          if (results.length === 0) return null;
          return results[0];
        }
        const msgs = Array.from(messagesStore.values());
        if (msgs.length === 0) return null;
        return msgs[0];
      },
      all: getResults,
      // Make chain thenable so `await chain` resolves to array (like drizzle)
      then: (resolve: any, reject?: any) => getResults().then(resolve, reject)
    };

    return chain;
  };

  // Count chain for SELECT COUNT(*) queries
  const createCountChain = () => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      get: async () => ({ count: messagesStore.size })
    };
    return chain;
  };

  const mockDb = {
    select: (fields?: any) => {
      // Detect count queries: select({ count: count() })
      if (fields && fields.count !== undefined) {
        return createCountChain();
      }
      // Detect joined queries: select({ message, customerSender, agentSender })
      if (fields && fields.message !== undefined) {
        return createChain(true);
      }
      // Simple select
      return createChain(false);
    },
    insert: (table: any) => ({
      values: (data: any) => {
        if (data.messageId !== undefined && data.userId !== undefined) {
          // Recall log insert
          recallLogs.push(data);
          return Promise.resolve();
        }
        // Message insert
        messagesStore.set(data.id, { ...data });
        return Promise.resolve();
      }
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: () => {
          // Update first matching message
          const firstKey = Array.from(messagesStore.keys())[0];
          if (firstKey) {
            const existing = messagesStore.get(firstKey)!;
            messagesStore.set(firstKey, { ...existing, ...data });
          }
          return Promise.resolve();
        }
      })
    }),
    _store: messagesStore,
    _recallLogs: recallLogs
  };

  return mockDb;
};

// ======================== Tests ========================

describe('MessageCrudService - Query Operations', () => {
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let service: MessageCrudService;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    // Inject the mock drizzle DB into the service
    service = new MessageCrudService({} as any);
    (service as any).drizzleDb = mockDrizzle;
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a message when found', async () => {
      const result = await service.findById('msg-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('msg-1');
      expect(result!.content).toBe('Hello, how can I help you?');
      expect(result!.senderType).toBe('agent');
      expect(result!.isRecalled).toBe(false);
      expect(result!.isSent).toBe(true);
    });

    it('should return null when message not found', async () => {
      mockDrizzle._store.clear();

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should correctly transform boolean fields', async () => {
      // DB stores booleans as 0/1 in SQLite
      mockDrizzle._store.set('msg-bool', {
        ...mockMessage,
        id: 'msg-bool',
        isRecalled: 0 as any,
        isSent: 1 as any
      });

      // Clear default and set only our test message
      mockDrizzle._store.delete('msg-1');

      const result = await service.findById('msg-bool');

      expect(result!.isRecalled).toBe(false);
      expect(result!.isSent).toBe(true);
    });

    it('should parse metadata JSON string', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set('msg-meta', {
        ...mockMessage,
        id: 'msg-meta',
        metadata: JSON.stringify({ platform: { messageId: 'line-123' } })
      });

      const result = await service.findById('msg-meta');

      expect(result!.metadata).toEqual({ platform: { messageId: 'line-123' } });
    });

    it('should handle null metadata gracefully', async () => {
      const result = await service.findById('msg-1');

      expect(result!.metadata).toBeUndefined();
    });
  });

  describe('findByIdWithDetails', () => {
    it('should return message with sender details', async () => {
      // Default data has agentSenderId set, so agent sender should be returned
      const result = await service.findByIdWithDetails('msg-1');

      expect(result).toBeDefined();
      expect(result!.senderName).toBe('Agent Smith');
      expect(result!.attachments).toEqual([]);
      expect(result!.reactions).toEqual([]);
      expect(result!.readReceipts).toEqual([]);
    });

    it('should return customer sender name when customer sent message', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set('msg-cust', {
        ...mockMessage,
        id: 'msg-cust',
        senderType: 'customer',
        customerSenderId: 1,
        agentSenderId: null
      });

      const result = await service.findByIdWithDetails('msg-cust');

      expect(result!.senderName).toBe('Customer A');
      expect(result!.senderAvatar).toBe('https://example.com/avatar.png');
    });

    it('should return null when message not found', async () => {
      mockDrizzle._store.clear();

      const result = await service.findByIdWithDetails('non-existent');

      expect(result).toBeNull();
    });

    it('should fallback to Unknown for sender name when no sender found', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set('msg-nosender', {
        ...mockMessage,
        id: 'msg-nosender',
        customerSenderId: null,
        agentSenderId: null
      });

      const result = await service.findByIdWithDetails('msg-nosender');

      expect(result!.senderName).toBe('Unknown');
    });
  });

  describe('getConversationMessages', () => {
    beforeEach(() => {
      mockDrizzle._store.clear();
      for (let i = 1; i <= 10; i++) {
        mockDrizzle._store.set(`msg-${i}`, {
          ...mockMessage,
          id: `msg-${i}`,
          content: `Message ${i}`,
          createdAt: new Date(2024, 5, 15, 10, i).toISOString()
        });
      }
    });

    it('should return messages with total count', async () => {
      const result = await service.getConversationMessages('conv-1');

      expect(result.messages).toBeDefined();
      expect(result.total).toBe(10);
    });

    it('should apply pagination with limit and offset', async () => {
      const result = await service.getConversationMessages('conv-1', 3, 0);

      expect(result.messages.length).toBeLessThanOrEqual(3);
    });

    it('should default to 50 messages and 0 offset', async () => {
      const result = await service.getConversationMessages('conv-1');

      expect(result.messages).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });

    it('should include sender name in message list items', async () => {
      const result = await service.getConversationMessages('conv-1');

      expect(result.messages.length).toBeGreaterThan(0);
      // Messages should have senderName from the joined agent/customer data
      result.messages.forEach(msg => {
        expect(msg.senderName).toBeDefined();
      });
    });

    it('should return empty messages when no messages exist', async () => {
      mockDrizzle._store.clear();

      const result = await service.getConversationMessages('conv-empty');

      expect(result.total).toBe(0);
    });
  });

  describe('searchMessages', () => {
    beforeEach(() => {
      mockDrizzle._store.clear();
      for (let i = 1; i <= 5; i++) {
        mockDrizzle._store.set(`msg-${i}`, {
          ...mockMessage,
          id: `msg-${i}`,
          content: i <= 3 ? 'Hello customer' : 'Goodbye customer',
          senderType: i <= 3 ? 'agent' : 'customer',
          messageType: 'text',
          isRecalled: i === 5 ? true : false,
          deliveryStatus: i === 4 ? 'failed' : 'sent'
        });
      }
    });

    it('should search messages with content filter', async () => {
      const query: MessageSearchQuery = { content: 'Hello' };
      const result = await service.searchMessages(query);

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
    });

    it('should include pagination in results', async () => {
      const query: MessageSearchQuery = {
        limit: 2,
        offset: 0
      };
      const result = await service.searchMessages(query);

      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.offset).toBe(0);
      expect(typeof result.pagination.hasMore).toBe('boolean');
    });

    it('should default limit to 50 and offset to 0', async () => {
      const query: MessageSearchQuery = {};
      const result = await service.searchMessages(query);

      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.offset).toBe(0);
    });

    it('should support senderType filter', async () => {
      const query: MessageSearchQuery = { senderType: 'agent' };
      const result = await service.searchMessages(query);

      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });

    it('should support conversationId filter', async () => {
      const query: MessageSearchQuery = { conversationId: 'conv-1' };
      const result = await service.searchMessages(query);

      expect(result).toBeDefined();
    });

    it('should support date range filter', async () => {
      const query: MessageSearchQuery = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      };
      const result = await service.searchMessages(query);

      expect(result).toBeDefined();
    });

    it('should support isRecalled filter', async () => {
      const query: MessageSearchQuery = { isRecalled: false };
      const result = await service.searchMessages(query);

      expect(result).toBeDefined();
    });

    it('should support deliveryStatus filter', async () => {
      const query: MessageSearchQuery = { deliveryStatus: 'sent' };
      const result = await service.searchMessages(query);

      expect(result).toBeDefined();
    });

    it('should return empty results for no matches', async () => {
      mockDrizzle._store.clear();
      const query: MessageSearchQuery = { content: 'nonexistent' };
      const result = await service.searchMessages(query);

      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
});

describe('MessageCrudService - Write Operations', () => {
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let service: MessageCrudService;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    service = new MessageCrudService({} as any);
    (service as any).drizzleDb = mockDrizzle;
    mockDrizzle._store.clear();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new message successfully', async () => {
      const messageData = {
        conversationId: 'conv-1',
        senderType: 'agent' as SenderType,
        agentSenderId: 'agent-1',
        content: 'New message content',
        messageType: 'text' as MessageType
      };

      const result = await service.create(messageData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.conversationId).toBe('conv-1');
      expect(result.content).toBe('New message content');
      expect(result.senderType).toBe('agent');
      expect(result.messageType).toBe('text');
      expect(result.isRecalled).toBe(false);
      expect(result.isSent).toBe(true);
      expect(result.deliveryStatus).toBe('sent');
    });

    it('should generate a UUID for new message', async () => {
      const result = await service.create({
        conversationId: 'conv-1',
        senderType: 'agent' as SenderType,
        content: 'Test',
        messageType: 'text' as MessageType
      });

      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('should set recall deadline to 30 minutes from now', async () => {
      const beforeCreate = Date.now();

      const result = await service.create({
        conversationId: 'conv-1',
        senderType: 'agent' as SenderType,
        content: 'Test',
        messageType: 'text' as MessageType
      });

      const recallDeadline = new Date(result.recallDeadline!).getTime();
      const expectedMin = beforeCreate + 30 * 60 * 1000 - 5000; // 5s tolerance
      const expectedMax = beforeCreate + 30 * 60 * 1000 + 5000;

      expect(recallDeadline).toBeGreaterThanOrEqual(expectedMin);
      expect(recallDeadline).toBeLessThanOrEqual(expectedMax);
    });

    it('should handle customer sender', async () => {
      const result = await service.create({
        conversationId: 'conv-1',
        senderType: 'customer' as SenderType,
        customerSenderId: 1,
        content: 'Customer message',
        messageType: 'text' as MessageType
      });

      expect(result.senderType).toBe('customer');
      expect(result.customerSenderId).toBe(1);
      expect(result.agentSenderId).toBeNull();
    });

    it('should serialize metadata to JSON', async () => {
      const metadata = { platform: { messageId: 'line-456' } };

      const result = await service.create({
        conversationId: 'conv-1',
        senderType: 'agent' as SenderType,
        content: 'With metadata',
        messageType: 'text' as MessageType,
        metadata
      });

      expect(result.metadata).toEqual(metadata);
    });

    it('should handle optional fields as null', async () => {
      const result = await service.create({
        conversationId: 'conv-1',
        senderType: 'agent' as SenderType,
        content: 'Minimal message',
        messageType: 'text' as MessageType
      });

      expect(result.platformMessageId).toBeNull();
      expect(result.replyToMessageId).toBeNull();
    });

    it('should support reply to message', async () => {
      const result = await service.create({
        conversationId: 'conv-1',
        senderType: 'agent' as SenderType,
        content: 'Reply message',
        messageType: 'text' as MessageType,
        replyToMessageId: 'msg-original'
      });

      expect(result.replyToMessageId).toBe('msg-original');
    });

    it('should support different message types', async () => {
      const types: MessageType[] = ['text', 'image', 'file', 'sticker'];

      for (const type of types) {
        mockDrizzle._store.clear();
        const result = await service.create({
          conversationId: 'conv-1',
          senderType: 'agent' as SenderType,
          content: `${type} message`,
          messageType: type
        });

        expect(result.messageType).toBe(type);
      }
    });

    it('should throw InvalidMessageDataError on database error', async () => {
      // Override insert to throw
      mockDrizzle.insert = () => ({
        values: () => {
          throw new Error('DB insert failed');
        }
      }) as any;

      await expect(
        service.create({
          conversationId: 'conv-1',
          senderType: 'agent' as SenderType,
          content: 'Will fail',
          messageType: 'text' as MessageType
        })
      ).rejects.toThrow(InvalidMessageDataError);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockDrizzle._store.set('msg-1', { ...mockMessage });
    });

    it('should update message content', async () => {
      const result = await service.update('msg-1', {
        content: 'Updated content'
      });

      expect(result).toBeDefined();
      expect(result.content).toBe('Updated content');
    });

    it('should update delivery status', async () => {
      const result = await service.update('msg-1', {
        deliveryStatus: 'delivered' as DeliveryStatus
      });

      expect(result).toBeDefined();
      expect(result.deliveryStatus).toBe('delivered');
    });

    it('should update metadata', async () => {
      const newMetadata = { platform: { messageId: 'updated-123' } };
      const result = await service.update('msg-1', {
        metadata: newMetadata
      });

      expect(result).toBeDefined();
    });

    it('should throw MessageNotFoundError when message does not exist', async () => {
      mockDrizzle._store.clear();

      await expect(
        service.update('non-existent', { content: 'Test' })
      ).rejects.toThrow(MessageNotFoundError);
    });

    it('should re-throw MessageNotFoundError without wrapping', async () => {
      mockDrizzle._store.clear();

      try {
        await service.update('non-existent', { content: 'Test' });
      } catch (error) {
        expect(error).toBeInstanceOf(MessageNotFoundError);
        expect((error as any).code).toBe('MESSAGE_NOT_FOUND');
      }
    });
  });

  describe('markAsRecalled', () => {
    beforeEach(() => {
      mockDrizzle._store.set('msg-1', { ...mockMessage });
    });

    it('should mark message as recalled', async () => {
      const result = await service.markAsRecalled('msg-1', 'Wrong message');

      expect(result).toBeDefined();
      expect(result.isRecalled).toBe(true);
      expect(result.recalledAt).toBeDefined();
    });

    it('should create a recall log entry', async () => {
      await service.markAsRecalled('msg-1', 'Test reason');

      expect(mockDrizzle._recallLogs.length).toBeGreaterThan(0);
      const log = mockDrizzle._recallLogs[0];
      expect(log.messageId).toBe('msg-1');
      expect(log.action).toContain('Test reason');
    });

    it('should use default reason when none provided', async () => {
      await service.markAsRecalled('msg-1');

      const log = mockDrizzle._recallLogs[0];
      expect(log.action).toContain('Manual recall');
    });

    it('should throw MessageNotFoundError for non-existent message', async () => {
      mockDrizzle._store.clear();

      await expect(
        service.markAsRecalled('non-existent')
      ).rejects.toThrow(MessageNotFoundError);
    });

    it('should use agentSenderId as userId in recall log', async () => {
      await service.markAsRecalled('msg-1');

      const log = mockDrizzle._recallLogs[0];
      expect(log.userId).toBe('agent-1');
    });

    it('should use system as userId when no agentSenderId', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set('msg-customer', {
        ...mockMessage,
        id: 'msg-customer',
        agentSenderId: null,
        senderType: 'customer',
        customerSenderId: 1
      });

      await service.markAsRecalled('msg-customer');

      const log = mockDrizzle._recallLogs[0];
      expect(log.userId).toBe('system');
    });
  });
});

describe('MessageCrudService - Utility Methods', () => {
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let service: MessageCrudService;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    service = new MessageCrudService({} as any);
    (service as any).drizzleDb = mockDrizzle;
    vi.clearAllMocks();
  });

  describe('canRecallMessage', () => {
    it('should return canRecall: true for valid message within deadline', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set('msg-valid', {
        ...mockMessage,
        id: 'msg-valid',
        isRecalled: false,
        recallDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
      });

      const result = await service.canRecallMessage('msg-valid');

      expect(result.canRecall).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return canRecall: false for non-existent message', async () => {
      mockDrizzle._store.clear();

      const result = await service.canRecallMessage('non-existent');

      expect(result.canRecall).toBe(false);
      expect(result.reason).toBe('Message not found');
    });

    it('should return canRecall: false for already recalled message', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set('msg-recalled', {
        ...mockMessage,
        id: 'msg-recalled',
        isRecalled: true,
        recalledAt: NOW
      });

      const result = await service.canRecallMessage('msg-recalled');

      expect(result.canRecall).toBe(false);
      expect(result.reason).toBe('Message already recalled');
    });

    it('should return canRecall: false when recall deadline exceeded', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set('msg-expired', {
        ...mockMessage,
        id: 'msg-expired',
        isRecalled: false,
        recallDeadline: '2020-01-01T00:00:00.000Z' // Past deadline
      });

      const result = await service.canRecallMessage('msg-expired');

      expect(result.canRecall).toBe(false);
      expect(result.reason).toBe('Recall deadline exceeded');
    });

    it('should handle errors gracefully', async () => {
      // Override select to throw
      mockDrizzle.select = () => {
        throw new Error('DB error');
      };

      const result = await service.canRecallMessage('any-id');

      expect(result.canRecall).toBe(false);
      expect(result.reason).toBe('Error checking recall eligibility');
    });
  });
});

describe('MessageCrudService - Error Handling', () => {
  it('should handle database connection failure in findById', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => { throw new Error('Connection refused'); }
          })
        })
      })
    };

    const service = new MessageCrudService({} as any);
    (service as any).drizzleDb = errorDb;

    await expect(service.findById('any-id')).rejects.toThrow('Connection refused');
  });

  it('should handle database failure in searchMessages', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => { throw new Error('DB timeout'); }
          })
        })
      })
    };

    const service = new MessageCrudService({} as any);
    (service as any).drizzleDb = errorDb;

    await expect(
      service.searchMessages({ content: 'test' })
    ).rejects.toThrow('DB timeout');
  });
});
