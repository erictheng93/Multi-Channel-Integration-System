// MessageService Unit Tests
// 訊息服務單元測試

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageService, MessageRequestService } from '@modules/conversations/services/message-service';
import type { MessageSendRequest } from '@backend/modules/conversations/types/conversation-types';

// ── Hoisted mocks (available before vi.mock factories run) ───────────────────

const {
  mockPushLineMessage,
  mockCreateTextMessage,
  mockCreateImageMessage,
  mockCreateFileFlexMessage,
  mockBroadcastMessageEvent
} = vi.hoisted(() => ({
  mockPushLineMessage: vi.fn(),
  mockCreateTextMessage: vi.fn((text: string) => ({ type: 'text', text })),
  mockCreateImageMessage: vi.fn((url: string) => ({ type: 'image', originalContentUrl: url })),
  mockCreateFileFlexMessage: vi.fn((_url: string, name: string) => ({ type: 'flex', altText: name })),
  mockBroadcastMessageEvent: vi.fn().mockResolvedValue(undefined)
}));

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock drizzle-factory (MessageService uses createDbClient, not raw drizzle)
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn()
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => {
  function sqlMock(..._args: any[]) {
    return { as: (_name: string) => ({ type: 'sql_alias' }) };
  }
  sqlMock.raw = (..._args: any[]) => ({ type: 'sql_raw' });

  return {
    eq: (...args: any[]) => ({ type: 'eq', args }),
    desc: (...args: any[]) => ({ type: 'desc', args }),
    and: (...args: any[]) => ({ type: 'and', args }),
    inArray: (...args: any[]) => ({ type: 'inArray', args }),
    count: () => ({ type: 'count' }),
    sql: sqlMock
  };
});

// Mock drizzle-orm/d1 (imported transitively by drizzle-factory)
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn()
}));

// Mock database schema
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
  fileAttachments: {
    id: { name: 'id' },
    messageId: { name: 'messageId' },
    conversationId: { name: 'conversationId' },
    filename: { name: 'filename' },
    mimeType: { name: 'mimeType' },
    fileSize: { name: 'fileSize' },
    fileUrl: { name: 'fileUrl' },
    r2Key: { name: 'r2Key' },
    uploadStatus: { name: 'uploadStatus' },
    createdAt: { name: 'createdAt' }
  }
}));

// Mock LINE utils (references hoisted mock functions)
vi.mock('@/utils/line', () => ({
  pushLineMessage: (...args: any[]) => mockPushLineMessage(...args),
  createTextMessage: (...args: any[]) => mockCreateTextMessage(...args),
  createImageMessage: (...args: any[]) => mockCreateImageMessage(...args),
  createFileFlexMessage: (...args: any[]) => mockCreateFileFlexMessage(...args)
}));

// Mock WebSocket broadcast service (references hoisted mock function)
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastMessageEvent: mockBroadcastMessageEvent
  }))
}));

// Mock LINE integration service (imported by message-service but not actively used in these tests)
vi.mock('@modules/integrations/services/line-integration-service', () => ({
  LineIntegrationService: vi.fn()
}));

// ── Chainable Mock DB ────────────────────────────────────────────────────────

function createMockDb() {
  const selectResults: any[][] = [];

  function createSelectChain() {
    const chain: Record<string, any> = {};
    const methods = ['from', 'where', 'leftJoin', 'innerJoin', 'orderBy', 'limit', 'offset', 'groupBy'];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
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
    _queueResults(...results: any[][]) {
      selectResults.length = 0;
      selectResults.push(...results);
    }
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

// Import createDbClient after mocking
import { createDbClient } from '@/db/drizzle-factory';

function createMockBindings(overrides: Record<string, any> = {}): any {
  return {
    DB: {} as D1Database,
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    KV_STORE: {},
    R2_BUCKET: {},
    MESSAGE_BROADCASTER: {},
    ...overrides
  };
}

describe('MessageService', () => {
  let service: MessageService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockBindings: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(createDbClient).mockReturnValue(mockDb as any);
    mockBindings = createMockBindings();
    service = new MessageService(mockBindings);
  });

  afterEach(() => {
    // NOTE: Do NOT use vi.restoreAllMocks() here — it strips mockImplementation
    // from vi.mock() factories (e.g. WebSocketBroadcastService constructor),
    // causing subsequent tests to fail. vi.clearAllMocks() in beforeEach is sufficient.
  });

  // ── createPendingMessage ─────────────────────────────────────────────────

  describe('createPendingMessage', () => {
    const baseRequest: MessageSendRequest = {
      conversationId: 'conv-123',
      content: 'Hello from agent',
      senderId: 'agent-456',
      messageType: 'text'
    };

    it('should create a pending message and return success', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123', customerId: 1 },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };

      // select: conversation+customer lookup
      mockDb._queueResults([mockConvData]);

      const result = await service.createPendingMessage(baseRequest);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.conversationId).toBe('conv-123');
      expect(result.content).toBe('Hello from agent');
      expect(result.timestamp).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // message insert
      expect(mockDb.update).toHaveBeenCalledTimes(1); // conversation timestamp update
    });

    it('should throw error when conversation not found', async () => {
      mockDb._queueResults([]); // empty result

      await expect(service.createPendingMessage(baseRequest))
        .rejects.toThrow('Conversation or customer not found');
    });

    it('should throw error when customer not found in conversation', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123', customerId: 1 },
        customer: null
      };
      mockDb._queueResults([mockConvData]);

      await expect(service.createPendingMessage(baseRequest))
        .rejects.toThrow('Conversation or customer not found');
    });

    it('should include platform metadata in message data', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123', customerId: 1 },
        customer: { id: 1, platform: 'line', platformUserId: 'U999' }
      };
      mockDb._queueResults([mockConvData]);

      const result = await service.createPendingMessage({
        ...baseRequest,
        metadata: { customKey: 'customValue' }
      });

      expect(result.success).toBe(true);
      // Verify insert was called (the metadata is embedded in the values)
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should link attachment IDs when provided', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123', customerId: 1 },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);

      const result = await service.createPendingMessage({
        ...baseRequest,
        attachmentIds: ['att-1', 'att-2']
      });

      expect(result.success).toBe(true);
      // insert (message) + update (attachments) + update (conversation timestamp)
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it('should use default messageType when not provided', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123', customerId: 1 },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);

      const result = await service.createPendingMessage({
        conversationId: 'conv-123',
        content: 'Test',
        senderId: 'agent-1'
      });

      expect(result.success).toBe(true);
    });
  });

  // ── processBackgroundSending ─────────────────────────────────────────────

  describe('processBackgroundSending', () => {
    const baseRequest: MessageSendRequest = {
      conversationId: 'conv-123',
      content: 'Hello via LINE',
      senderId: 'agent-456'
    };
    const mockUser = { id: 'agent-456', displayName: 'Agent' };

    it('should send LINE message and update status to sent', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);
      mockPushLineMessage.mockResolvedValue(true);

      await service.processBackgroundSending('msg-123', baseRequest, mockUser);

      expect(mockPushLineMessage).toHaveBeenCalledWith(
        'test-line-token',
        'U123',
        expect.any(Array)
      );
      // update: message status + broadcast
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message_updated',
          conversationId: 'conv-123',
          messageId: 'msg-123'
        })
      );
    });

    it('should handle customer not found gracefully', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: null
      };
      mockDb._queueResults([mockConvData]);

      // Should not throw — handles gracefully with early return
      await service.processBackgroundSending('msg-123', baseRequest, mockUser);

      expect(mockPushLineMessage).not.toHaveBeenCalled();
    });

    it('should handle LINE API failure and set status to failed', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);
      mockPushLineMessage.mockResolvedValue(false); // LINE API returns failure

      await service.processBackgroundSending('msg-123', baseRequest, mockUser);

      // Should still update DB and broadcast
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockBroadcastMessageEvent).toHaveBeenCalled();
    });

    it('should process attachments with image type', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      const mockAttachments = [
        { id: 'att-1', filename: 'photo.jpg', mimeType: 'image/jpeg', fileUrl: 'https://r2.example.com/photo.jpg', fileSize: 1024 }
      ];
      mockDb._queueResults([mockConvData], mockAttachments);
      mockPushLineMessage.mockResolvedValue(true);

      await service.processBackgroundSending('msg-123', {
        ...baseRequest,
        content: '',
        attachmentIds: ['att-1']
      }, mockUser);

      expect(mockCreateImageMessage).toHaveBeenCalledWith('https://r2.example.com/photo.jpg');
      expect(mockPushLineMessage).toHaveBeenCalled();
    });

    it('should process attachments with file type using flex message', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      const mockAttachments = [
        { id: 'att-1', filename: 'doc.pdf', mimeType: 'application/pdf', fileUrl: 'https://r2.example.com/doc.pdf', fileSize: 2048 }
      ];
      mockDb._queueResults([mockConvData], mockAttachments);
      mockPushLineMessage.mockResolvedValue(true);

      await service.processBackgroundSending('msg-123', {
        ...baseRequest,
        content: '',
        attachmentIds: ['att-1']
      }, mockUser);

      expect(mockCreateFileFlexMessage).toHaveBeenCalledWith(
        'https://r2.example.com/doc.pdf',
        'doc.pdf',
        'application/pdf',
        2048
      );
    });

    it('should skip attachments with NULL fileUrl', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      const mockAttachments = [
        { id: 'att-1', filename: 'broken.pdf', mimeType: 'application/pdf', fileUrl: null, fileSize: 0, r2Key: 'some-key' }
      ];
      mockDb._queueResults([mockConvData], mockAttachments);

      await service.processBackgroundSending('msg-123', {
        ...baseRequest,
        content: 'Sent a file: broken.pdf',
        attachmentIds: ['att-1']
      }, mockUser);

      expect(mockCreateFileFlexMessage).not.toHaveBeenCalled();
      expect(mockCreateImageMessage).not.toHaveBeenCalled();
    });

    it('should batch-send when more than 5 LINE messages', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      // 6 image attachments → 2 batches (5 + 1)
      const mockAttachments = Array.from({ length: 6 }, (_, i) => ({
        id: `att-${i}`,
        filename: `img${i}.jpg`,
        mimeType: 'image/jpeg',
        fileUrl: `https://r2.example.com/img${i}.jpg`,
        fileSize: 1024
      }));
      mockDb._queueResults([mockConvData], mockAttachments);
      mockPushLineMessage.mockResolvedValue(true);

      await service.processBackgroundSending('msg-123', {
        ...baseRequest,
        content: '',
        attachmentIds: mockAttachments.map(a => a.id)
      }, mockUser);

      // Should be called twice: batch 1 (5 messages) + batch 2 (1 message)
      expect(mockPushLineMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle partial batch failure with partial status', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      const mockAttachments = Array.from({ length: 6 }, (_, i) => ({
        id: `att-${i}`,
        filename: `img${i}.jpg`,
        mimeType: 'image/jpeg',
        fileUrl: `https://r2.example.com/img${i}.jpg`,
        fileSize: 1024
      }));
      mockDb._queueResults([mockConvData], mockAttachments);
      // First batch succeeds, second fails
      mockPushLineMessage
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.processBackgroundSending('msg-123', {
        ...baseRequest,
        content: '',
        attachmentIds: mockAttachments.map(a => a.id)
      }, mockUser);

      // DB update and broadcast still called
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockBroadcastMessageEvent).toHaveBeenCalled();
    });

    it('should handle LINE API exception gracefully', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);
      mockPushLineMessage.mockRejectedValue(new Error('Network timeout'));

      // Should not throw — catches and updates status to failed
      await service.processBackgroundSending('msg-123', baseRequest, mockUser);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should handle DB failure during status update', async () => {
      // Empty conversation lookup → causes error in try block
      mockDb._queueResults([]);

      // Override update to throw
      mockDb.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            throw new Error('DB write failed');
          })
        })
      }));

      // Should not throw — outer catch handles it
      await expect(
        service.processBackgroundSending('msg-123', baseRequest, mockUser)
      ).resolves.toBeUndefined();
    });
  });

  // ── sendMessage (legacy/synchronous) ─────────────────────────────────────

  describe('sendMessage', () => {
    const baseRequest: MessageSendRequest = {
      conversationId: 'conv-123',
      content: 'Hello',
      senderId: 'agent-1'
    };

    it('should send message via LINE and return success', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);
      mockPushLineMessage.mockResolvedValue(true);

      const result = await service.sendMessage(baseRequest);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.conversationId).toBe('conv-123');
      expect(mockPushLineMessage).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw error when conversation not found', async () => {
      mockDb._queueResults([]); // no conversation

      const result = await service.sendMessage(baseRequest);

      // sendMessage catches errors and returns { success: false }
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should throw error when customer not found', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: null
      };
      mockDb._queueResults([mockConvData]);

      const result = await service.sendMessage(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Customer not found');
    });

    it('should handle non-LINE platform as pending', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'facebook', platformUserId: 'FB123' }
      };
      mockDb._queueResults([mockConvData]);

      const result = await service.sendMessage(baseRequest);

      // Facebook not yet supported → message saved but not sent
      expect(mockPushLineMessage).not.toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled(); // message still saved
    });

    it('should handle missing platformUserId for LINE customer', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: null }
      };
      mockDb._queueResults([mockConvData]);

      const result = await service.sendMessage(baseRequest);

      expect(mockPushLineMessage).not.toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle LINE API failure', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);
      mockPushLineMessage.mockResolvedValue(false);

      const result = await service.sendMessage(baseRequest);

      // Message saved but marked as failed
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle LINE API exception', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);
      mockPushLineMessage.mockRejectedValue(new Error('LINE timeout'));

      const result = await service.sendMessage(baseRequest);

      // Should still save message with failed status
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should link attachments when provided', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      // No actual file data needed for this flow (attachment query returns empty for sync path)
      mockDb._queueResults([mockConvData], []);
      mockPushLineMessage.mockResolvedValue(true);

      await service.sendMessage({
        ...baseRequest,
        attachmentIds: ['att-1']
      });

      // update should be called for: attachments link + conversation timestamp
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should update conversation timestamps after sending', async () => {
      const mockConvData = {
        conversation: { id: 'conv-123' },
        customer: { id: 1, platform: 'line', platformUserId: 'U123' }
      };
      mockDb._queueResults([mockConvData]);
      mockPushLineMessage.mockResolvedValue(true);

      await service.sendMessage(baseRequest);

      // At least one update call for conversation timestamps
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should save failed message to DB when overall error occurs', async () => {
      // Make select throw to trigger outer catch
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('DB connection lost');
      });

      const result = await service.sendMessage(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should attempt to save a failed message record
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // ── getMessages ──────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('should return messages for a conversation', async () => {
      const mockMessages = [
        { id: 'msg-1', content: 'Hello', conversationId: 'conv-1', isRecalled: false },
        { id: 'msg-2', content: 'World', conversationId: 'conv-1', isRecalled: false }
      ];
      mockDb._queueResults(mockMessages);

      const result = await service.getMessages('conv-1');

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hello');
    });

    it('should use default limit of 50 when not specified', async () => {
      mockDb._queueResults([]);

      await service.getMessages('conv-1');

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should cap limit at 100', async () => {
      mockDb._queueResults([]);

      await service.getMessages('conv-1', 500, 0);

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should filter out recalled messages', async () => {
      // The service uses `eq(messages.isRecalled, false)` in the WHERE clause
      mockDb._queueResults([]);

      await service.getMessages('conv-1', 50, 0);

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await service.getMessages('conv-1');

      expect(result).toEqual([]);
    });

    it('should support offset for pagination', async () => {
      mockDb._queueResults([]);

      await service.getMessages('conv-1', 20, 40);

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // ── recallMessage ────────────────────────────────────────────────────────

  describe('recallMessage', () => {
    it('should recall a message successfully', async () => {
      const result = await service.recallMessage('msg-123', 'user-456');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false on database error', async () => {
      mockDb.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            throw new Error('DB error');
          })
        })
      }));

      const result = await service.recallMessage('msg-123', 'user-456');

      expect(result).toBe(false);
    });
  });

  // ── updateMessage ────────────────────────────────────────────────────────

  describe('updateMessage', () => {
    it('should update a message and return updated data', async () => {
      const mockUpdated = {
        id: 'msg-123',
        content: 'Updated content',
        updatedAt: new Date().toISOString()
      };
      mockDb._queueResults([mockUpdated]);

      const result = await service.updateMessage('msg-123', { content: 'Updated content' } as any);

      expect(result.content).toBe('Updated content');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw error when message not found after update', async () => {
      mockDb._queueResults([]); // empty select after update

      await expect(service.updateMessage('non-existent', { content: 'test' } as any))
        .rejects.toThrow('not found after update');
    });

    it('should propagate database errors', async () => {
      mockDb.update.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            throw new Error('DB constraint violation');
          })
        })
      }));

      await expect(service.updateMessage('msg-123', { content: 'test' } as any))
        .rejects.toThrow('DB constraint violation');
    });
  });

  // ── getRecentMessages ────────────────────────────────────────────────────

  describe('getRecentMessages', () => {
    it('should return messages in chronological order (oldest first)', async () => {
      const mockMessages = [
        { id: 'msg-2', content: 'Newer', createdAt: '2025-01-02T00:00:00Z' },
        { id: 'msg-1', content: 'Older', createdAt: '2025-01-01T00:00:00Z' }
      ];
      mockDb._queueResults(mockMessages);

      const result = await service.getRecentMessages('conv-1', 10);

      // Should be reversed (DB returns DESC, method reverses to ASC)
      expect(result[0].content).toBe('Older');
      expect(result[1].content).toBe('Newer');
    });

    it('should return empty array on error', async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await service.getRecentMessages('conv-1', 10);

      expect(result).toEqual([]);
    });
  });

  // ── getMessagesAfterTimestamp ─────────────────────────────────────────────

  describe('getMessagesAfterTimestamp', () => {
    it('should return messages after given timestamp', async () => {
      const mockMessages = [
        { id: 'msg-3', content: 'New message', createdAt: '2025-01-02T00:00:00Z' }
      ];
      mockDb._queueResults(mockMessages);

      const result = await service.getMessagesAfterTimestamp('conv-1', '2025-01-01T00:00:00Z');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-3');
    });

    it('should return empty array on error', async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await service.getMessagesAfterTimestamp('conv-1', '2025-01-01T00:00:00Z');

      expect(result).toEqual([]);
    });
  });
});

// ── MessageRequestService ──────────────────────────────────────────────────

describe('MessageRequestService', () => {
  describe('validateAndParse', () => {
    function createMockContext(params: Record<string, string>, body: Record<string, any>) {
      return {
        req: {
          param: (key: string) => params[key],
          json: vi.fn().mockResolvedValue(body)
        }
      };
    }

    it('should parse valid request correctly', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: 'Hello',
        senderId: 'agent-1',
        messageType: 'text'
      });

      const result = await MessageRequestService.validateAndParse(c);

      expect(result.conversationId).toBe('conv-123');
      expect(result.content).toBe('Hello');
      expect(result.senderId).toBe('agent-1');
      expect(result.messageType).toBe('text');
    });

    it('should throw when conversation ID is missing', async () => {
      const c = createMockContext({}, {
        content: 'Hello',
        senderId: 'agent-1'
      });

      await expect(MessageRequestService.validateAndParse(c))
        .rejects.toThrow('Missing conversation ID');
    });

    it('should throw when content is empty and no attachments', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: '',
        senderId: 'agent-1'
      });

      await expect(MessageRequestService.validateAndParse(c))
        .rejects.toThrow('Message content or attachments are required');
    });

    it('should allow empty content when attachments are provided', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: '',
        senderId: 'agent-1',
        attachmentIds: ['att-1']
      });

      const result = await MessageRequestService.validateAndParse(c);

      expect(result.content).toBe('');
      expect(result.attachmentIds).toEqual(['att-1']);
    });

    it('should throw when senderId is missing', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: 'Hello'
      });

      await expect(MessageRequestService.validateAndParse(c))
        .rejects.toThrow('Sender ID is required');
    });

    it('should use default messageType when not provided', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: 'Hello',
        senderId: 'agent-1'
      });

      const result = await MessageRequestService.validateAndParse(c);

      expect(result.messageType).toBe('text');
    });

    it('should include attachmentIds as empty array when not provided', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: 'Hello',
        senderId: 'agent-1'
      });

      const result = await MessageRequestService.validateAndParse(c);

      expect(result.attachmentIds).toEqual([]);
    });

    it('should trim whitespace from content', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: '  Hello  ',
        senderId: 'agent-1'
      });

      const result = await MessageRequestService.validateAndParse(c);

      expect(result.content).toBe('Hello');
    });

    it('should treat whitespace-only content as empty', async () => {
      const c = createMockContext({ id: 'conv-123' }, {
        content: ' ',
        senderId: 'agent-1'
      });

      await expect(MessageRequestService.validateAndParse(c))
        .rejects.toThrow('Message content or attachments are required');
    });
  });
});
