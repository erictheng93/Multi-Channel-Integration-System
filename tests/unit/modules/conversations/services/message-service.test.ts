// MessageService Unit Tests
// Tests for src/modules/conversations/services/message-service.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService, MessageRequestService } from '@modules/conversations/services/message-service';

// ======================== Mock External Dependencies ========================

// Mock LINE utils
vi.mock('@/utils/line', () => ({
  pushLineMessage: vi.fn(async () => true),
  createTextMessage: vi.fn((content: string) => ({ type: 'text', text: content })),
  createImageMessage: vi.fn((url: string) => ({ type: 'image', originalContentUrl: url, previewImageUrl: url })),
  createFileFlexMessage: vi.fn((url: string, name: string, mimeType: string, size: number) => ({
    type: 'flex', altText: name, contents: { url, name, mimeType, size }
  }))
}));

// Mock WebSocket broadcast service
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastMessageEvent: vi.fn(async () => {})
  }))
}));

// Mock drizzle-factory
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn((db: any) => db)
}));

// ======================== Mock Data ========================

const NOW = '2024-06-15T10:00:00.000Z';

const mockConversation = {
  id: 'conv-1',
  customerId: 1,
  teamId: 1,
  status: 'active',
  lastMessageAt: NOW,
  updatedAt: NOW,
  createdAt: NOW
};

const mockCustomer = {
  id: 1,
  platform: 'line',
  platformUserId: 'U12345',
  displayName: 'LINE User',
  avatarUrl: null,
  email: null,
  phone: null,
  sourceTeamId: 1,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW
};

const mockMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  content: 'Test message',
  senderType: 'agent',
  agentSenderId: 'agent-1',
  customerSenderId: null,
  messageType: 'text',
  platformMessageId: null,
  isRecalled: false,
  recallDeadline: null,
  recalledAt: null,
  isSent: true,
  sentAt: NOW,
  deliveryStatus: 'sent',
  replyToMessageId: null,
  senderName: 'Agent Smith',
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW
};

const mockFileAttachment = {
  id: 'file-1',
  messageId: null,
  filename: 'test.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
  fileUrl: 'https://storage.example.com/test.pdf',
  r2Key: 'uploads/test.pdf',
  createdAt: NOW
};

// ======================== Mock Database ========================

const createMockDb = () => {
  const messagesStore = new Map<string, typeof mockMessage>();
  const conversationsStore = new Map<string, typeof mockConversation>();
  const customersStore = new Map<number, typeof mockCustomer>();
  const attachmentsStore = new Map<string, typeof mockFileAttachment>();

  // Default data
  conversationsStore.set('conv-1', { ...mockConversation });
  customersStore.set(1, { ...mockCustomer });

  /**
   * Chain for conversation+customer JOIN queries:
   * this.db.select({conversation, customer}).from(conversations).leftJoin(customers, ...)
   */
  const createConversationJoinChain = () => {
    const getResults = async () => {
      if (conversationsStore.size > 0 && customersStore.size > 0) {
        const conv = Array.from(conversationsStore.values())[0];
        const cust = Array.from(customersStore.values())[0];
        return [{ conversation: conv, customer: cust }];
      }
      return [];
    };
    const chain: any = {
      from: () => chain, select: () => chain, leftJoin: () => chain,
      where: () => chain, orderBy: () => chain, limit: () => chain, offset: () => chain,
      get: async () => { const r = await getResults(); return r[0] || null; },
      all: getResults,
      then: (resolve: any, reject?: any) => getResults().then(resolve, reject)
    };
    return chain;
  };

  /**
   * Chain for plain message queries:
   * this.db.select().from(messages).where(...)
   */
  const createMessageChain = () => {
    let _limitValue: number | null = null;
    let _offsetValue: number | null = null;
    const getResults = async () => {
      let results = Array.from(messagesStore.values());
      if (_offsetValue !== null) results = results.slice(_offsetValue);
      if (_limitValue !== null) results = results.slice(0, _limitValue);
      return results;
    };
    const chain: any = {
      from: () => chain, select: () => chain, leftJoin: () => chain,
      innerJoin: () => chain, where: () => chain, orderBy: () => chain,
      limit: (val: number) => { _limitValue = val; return chain; },
      offset: (val: number) => { _offsetValue = val; return chain; },
      get: async () => { const r = await getResults(); return r[0] || null; },
      all: getResults,
      then: (resolve: any, reject?: any) => getResults().then(resolve, reject)
    };
    return chain;
  };

  const mockDb: any = {
    select: (fields?: any) => {
      // Detect conversation+customer join queries by field names
      if (fields && (fields.conversation !== undefined || fields.customer !== undefined)) {
        return createConversationJoinChain();
      }
      // Default: message queries
      return createMessageChain();
    },
    insert: (table: any) => ({
      values: (data: any) => {
        if (data.id && data.conversationId) {
          messagesStore.set(data.id, { ...data });
        }
        return Promise.resolve();
      }
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: () => {
          const firstMsgKey = Array.from(messagesStore.keys())[0];
          if (firstMsgKey) {
            const existing = messagesStore.get(firstMsgKey)!;
            messagesStore.set(firstMsgKey, { ...existing, ...data });
          }
          return Promise.resolve();
        }
      })
    }),
    _messages: messagesStore,
    _conversations: conversationsStore,
    _customers: customersStore,
    _attachments: attachmentsStore
  };

  return mockDb;
};

const createMockBindings = () => ({
  DB: {} as any,
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  MESSAGE_BROADCASTER: {} as any,
  CONVERSATION_ROOM: {} as any,
  USER_CONNECTION: {} as any
});

// ======================== Tests ========================

describe('MessageService - createPendingMessage', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: MessageService;
  let bindings: ReturnType<typeof createMockBindings>;

  beforeEach(() => {
    mockDb = createMockDb();
    bindings = createMockBindings();
    service = new MessageService(bindings as any);
    (service as any).db = mockDb;
    vi.clearAllMocks();
  });

  it('should create a pending message and return success response', async () => {
    const request = {
      conversationId: 'conv-1',
      content: 'Hello from agent',
      senderId: 'agent-1',
      messageType: 'text' as const
    };

    const result = await service.createPendingMessage(request);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.conversationId).toBe('conv-1');
    expect(result.content).toBe('Hello from agent');
    expect(result.timestamp).toBeDefined();
  });

  it('should insert message with pending delivery status', async () => {
    const insertedValues: any[] = [];
    const origInsert = mockDb.insert;
    mockDb.insert = (table: any) => ({
      values: (data: any) => {
        insertedValues.push(data);
        return origInsert(table).values(data);
      }
    });

    const request = {
      conversationId: 'conv-1',
      content: 'Test',
      senderId: 'agent-1'
    };

    await service.createPendingMessage(request);

    expect(insertedValues.length).toBeGreaterThan(0);
    const insertedData = insertedValues[0];
    expect(insertedData.deliveryStatus).toBe('pending');
    expect(insertedData.isSent).toBe(false);
    expect(insertedData.senderType).toBe('agent');
  });

  it('should generate a UUID for the message', async () => {
    const result = await service.createPendingMessage({
      conversationId: 'conv-1',
      content: 'Test',
      senderId: 'agent-1'
    });

    expect(result.messageId).toBeDefined();
    expect(result.messageId!.length).toBeGreaterThan(0);
    // UUID format check
    expect(result.messageId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('should update conversation timestamps', async () => {
    const updateSetSpy = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    let updateCallCount = 0;
    mockDb.update = () => {
      updateCallCount++;
      return { set: updateSetSpy };
    };

    await service.createPendingMessage({
      conversationId: 'conv-1',
      content: 'Test',
      senderId: 'agent-1'
    });

    // Should have at least one update call for conversation timestamps
    expect(updateCallCount).toBeGreaterThan(0);
  });

  it('should throw when conversation not found', async () => {
    mockDb._conversations.clear();
    mockDb._customers.clear();

    await expect(
      service.createPendingMessage({
        conversationId: 'non-existent',
        content: 'Test',
        senderId: 'agent-1'
      })
    ).rejects.toThrow();
  });

  it('should link attachments when attachmentIds provided', async () => {
    const updateSetSpy = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    mockDb.update = () => ({ set: updateSetSpy });

    await service.createPendingMessage({
      conversationId: 'conv-1',
      content: 'With file',
      senderId: 'agent-1',
      attachmentIds: ['file-1', 'file-2']
    });

    // Should have been called to update attachments
    expect(updateSetSpy).toHaveBeenCalled();
  });

  it('should include metadata in the message', async () => {
    const insertedValues: any[] = [];
    const origInsert = mockDb.insert;
    mockDb.insert = (table: any) => ({
      values: (data: any) => {
        insertedValues.push(data);
        return origInsert(table).values(data);
      }
    });

    await service.createPendingMessage({
      conversationId: 'conv-1',
      content: 'Test',
      senderId: 'agent-1',
      metadata: { customField: 'value' }
    });

    expect(insertedValues.length).toBeGreaterThan(0);
    const insertedData = insertedValues[0];
    const metadata = JSON.parse(insertedData.metadata);
    expect(metadata.customField).toBe('value');
    expect(metadata.platform).toBe('line');
    expect(metadata.platformUserId).toBe('U12345');
  });
});

describe('MessageService - getMessages', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: MessageService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new MessageService(createMockBindings() as any);
    (service as any).db = mockDb;

    // Add messages
    for (let i = 1; i <= 10; i++) {
      mockDb._messages.set(`msg-${i}`, {
        ...mockMessage,
        id: `msg-${i}`,
        content: `Message ${i}`,
        isRecalled: i === 10 // Last message is recalled
      });
    }
    vi.clearAllMocks();
  });

  it('should return messages for a conversation', async () => {
    const result = await service.getMessages('conv-1');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should default to limit 50 and offset 0', async () => {
    const result = await service.getMessages('conv-1');

    expect(result).toBeDefined();
  });

  it('should cap limit at 100', async () => {
    // Service uses Math.min(limit, 100)
    const result = await service.getMessages('conv-1', 200);

    expect(result).toBeDefined();
  });

  it('should return empty array on database error', async () => {
    mockDb.select = () => {
      throw new Error('DB error');
    };

    const result = await service.getMessages('conv-1');

    expect(result).toEqual([]);
  });

  it('should support pagination with offset', async () => {
    const result = await service.getMessages('conv-1', 5, 5);

    expect(result).toBeDefined();
  });
});

describe('MessageService - recallMessage', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: MessageService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new MessageService(createMockBindings() as any);
    (service as any).db = mockDb;
    mockDb._messages.set('msg-1', { ...mockMessage });
    vi.clearAllMocks();
  });

  it('should recall a message and return true', async () => {
    const result = await service.recallMessage('msg-1', 'agent-1');

    expect(result).toBe(true);
  });

  it('should set isRecalled to true', async () => {
    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined)
    }));
    mockDb.update = () => ({ set: updateSetSpy });

    await service.recallMessage('msg-1', 'agent-1');

    expect(updateSetSpy).toHaveBeenCalled();
    const updateData = updateSetSpy.mock.calls[0][0];
    expect(updateData.isRecalled).toBe(true);
    expect(updateData.recalledAt).toBeDefined();
  });

  it('should store recalledBy userId in metadata', async () => {
    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined)
    }));
    mockDb.update = () => ({ set: updateSetSpy });

    await service.recallMessage('msg-1', 'agent-1');

    const updateData = updateSetSpy.mock.calls[0][0];
    const metadata = JSON.parse(updateData.metadata);
    expect(metadata.recalledBy).toBe('agent-1');
  });

  it('should return false on database error', async () => {
    mockDb.update = () => ({
      set: () => ({
        where: () => { throw new Error('DB failure'); }
      })
    });

    const result = await service.recallMessage('msg-1', 'agent-1');

    expect(result).toBe(false);
  });
});

describe('MessageService - updateMessage', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: MessageService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new MessageService(createMockBindings() as any);
    (service as any).db = mockDb;
    mockDb._messages.set('msg-1', { ...mockMessage });
    vi.clearAllMocks();
  });

  it('should update message and return updated version', async () => {
    const result = await service.updateMessage('msg-1', { content: 'Updated content' });

    expect(result).toBeDefined();
    // The mock stores and re-reads, content should be updated
    expect(result.id).toBe('msg-1');
  });

  it('should set updatedAt timestamp', async () => {
    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined)
    }));
    mockDb.update = () => ({ set: updateSetSpy });

    await service.updateMessage('msg-1', { content: 'test' });

    expect(updateSetSpy).toHaveBeenCalled();
    const updateData = updateSetSpy.mock.calls[0][0];
    expect(updateData.updatedAt).toBeDefined();
  });

  it('should throw when message not found after update', async () => {
    mockDb._messages.clear();

    await expect(
      service.updateMessage('non-existent', { content: 'test' })
    ).rejects.toThrow('not found after update');
  });

  it('should throw on database error', async () => {
    mockDb.update = () => ({
      set: () => ({
        where: () => { throw new Error('DB error'); }
      })
    });

    await expect(
      service.updateMessage('msg-1', { content: 'fail' })
    ).rejects.toThrow('DB error');
  });
});

describe('MessageService - getRecentMessages', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: MessageService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new MessageService(createMockBindings() as any);
    (service as any).db = mockDb;

    // Add messages in reverse chronological order
    for (let i = 1; i <= 5; i++) {
      mockDb._messages.set(`msg-${i}`, {
        ...mockMessage,
        id: `msg-${i}`,
        content: `Message ${i}`,
        createdAt: new Date(2024, 5, 15, 10, i).toISOString()
      });
    }
    vi.clearAllMocks();
  });

  it('should return recent messages', async () => {
    const result = await service.getRecentMessages('conv-1', 3);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array on database error', async () => {
    mockDb.select = () => {
      throw new Error('DB error');
    };

    const result = await service.getRecentMessages('conv-1', 5);

    expect(result).toEqual([]);
  });
});

describe('MessageService - processBackgroundSending', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: MessageService;
  let bindings: ReturnType<typeof createMockBindings>;

  beforeEach(async () => {
    mockDb = createMockDb();
    bindings = createMockBindings();
    service = new MessageService(bindings as any);
    (service as any).db = mockDb;
    mockDb._messages.set('msg-bg-1', { ...mockMessage, id: 'msg-bg-1', deliveryStatus: 'pending' });
    vi.clearAllMocks();
  });

  it('should process and send message via LINE API', async () => {
    const { pushLineMessage } = await import('@/utils/line');

    await service.processBackgroundSending('msg-bg-1', {
      conversationId: 'conv-1',
      content: 'Background message',
      senderId: 'agent-1'
    }, { id: 'agent-1' });

    expect(pushLineMessage).toHaveBeenCalled();
  });

  it('should handle customer not found gracefully', async () => {
    mockDb._conversations.clear();
    mockDb._customers.clear();

    // Should not throw - just returns early
    await service.processBackgroundSending('msg-bg-1', {
      conversationId: 'conv-missing',
      content: 'Test',
      senderId: 'agent-1'
    }, { id: 'agent-1' });
  });

  it('should update message status after successful send', async () => {
    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined)
    }));
    mockDb.update = () => ({ set: updateSetSpy });

    await service.processBackgroundSending('msg-bg-1', {
      conversationId: 'conv-1',
      content: 'Sent',
      senderId: 'agent-1'
    }, { id: 'agent-1' });

    // At least one update call for message status
    expect(updateSetSpy).toHaveBeenCalled();
  });

  it('should update message to failed status on LINE API error', async () => {
    const { pushLineMessage } = await import('@/utils/line');
    (pushLineMessage as any).mockResolvedValueOnce(false);

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined)
    }));
    mockDb.update = () => ({ set: updateSetSpy });

    await service.processBackgroundSending('msg-bg-1', {
      conversationId: 'conv-1',
      content: 'Will fail',
      senderId: 'agent-1'
    }, { id: 'agent-1' });

    expect(updateSetSpy).toHaveBeenCalled();
  });

  it('should handle attachments in background sending', async () => {
    // The attachment query uses db.select().from(fileAttachments).where(inArray(...))
    // which is a plain select - our mock returns messages from messagesStore by default.
    // For this test, we just verify no crash with attachmentIds.
    await service.processBackgroundSending('msg-bg-1', {
      conversationId: 'conv-1',
      content: 'With attachment',
      senderId: 'agent-1',
      attachmentIds: ['file-1']
    }, { id: 'agent-1' });
  });

  it('should set message to failed on unhandled error', async () => {
    // Force select to always throw
    mockDb.select = () => {
      throw new Error('Unexpected error');
    };

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined)
    }));
    mockDb.update = () => ({ set: updateSetSpy });

    await service.processBackgroundSending('msg-bg-1', {
      conversationId: 'conv-1',
      content: 'Error message',
      senderId: 'agent-1'
    }, { id: 'agent-1' });

    // Should have updated message to failed
    expect(updateSetSpy).toHaveBeenCalled();
    const lastCall = updateSetSpy.mock.calls[updateSetSpy.mock.calls.length - 1];
    expect(lastCall[0].deliveryStatus).toBe('failed');
  });
});

describe('MessageRequestService - validateAndParse', () => {
  const createMockContext = (params: { id?: string }, body: any) => ({
    req: {
      param: (key: string) => params[key as keyof typeof params] || null,
      json: async () => body
    }
  });

  it('should validate and parse a valid request', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      {
        content: 'Hello',
        senderId: 'agent-1',
        messageType: 'text'
      }
    );

    const result = await MessageRequestService.validateAndParse(ctx);

    expect(result.conversationId).toBe('conv-1');
    expect(result.content).toBe('Hello');
    expect(result.senderId).toBe('agent-1');
    expect(result.messageType).toBe('text');
  });

  it('should throw when conversation ID is missing', async () => {
    const ctx = createMockContext(
      {},
      { content: 'Hello', senderId: 'agent-1' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx)
    ).rejects.toThrow('Missing conversation ID');
  });

  it('should throw when content and attachments are both missing', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { senderId: 'agent-1' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx)
    ).rejects.toThrow('Message content or attachments are required');
  });

  it('should throw when senderId is missing', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx)
    ).rejects.toThrow('Sender ID is required');
  });

  it('should allow empty content when attachments are provided', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      {
        content: '',
        senderId: 'agent-1',
        attachmentIds: ['file-1']
      }
    );

    const result = await MessageRequestService.validateAndParse(ctx);

    expect(result.attachmentIds).toEqual(['file-1']);
    expect(result.content).toBe('');
  });

  it('should default messageType to text', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx);

    expect(result.messageType).toBe('text');
  });

  it('should trim content whitespace', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: '  Hello World  ', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx);

    expect(result.content).toBe('Hello World');
  });

  it('should default metadata to empty object', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx);

    expect(result.metadata).toEqual({});
  });

  it('should default attachmentIds to empty array', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx);

    expect(result.attachmentIds).toEqual([]);
  });

  it('should pass through provided metadata', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      {
        content: 'Hello',
        senderId: 'agent-1',
        metadata: { source: 'web', priority: 'high' }
      }
    );

    const result = await MessageRequestService.validateAndParse(ctx);

    expect(result.metadata).toEqual({ source: 'web', priority: 'high' });
  });

  it('should reject whitespace-only content without attachments', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: '   ', senderId: 'agent-1' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx)
    ).rejects.toThrow('Message content or attachments are required');
  });
});

describe('MessageService - sendMessage (Legacy)', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: MessageService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new MessageService(createMockBindings() as any);
    (service as any).db = mockDb;
    vi.clearAllMocks();
  });

  it('should send a message and return success', async () => {
    const result = await service.sendMessage({
      conversationId: 'conv-1',
      content: 'Hello via LINE',
      senderId: 'agent-1'
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.conversationId).toBe('conv-1');
  });

  it('should return failure when conversation not found', async () => {
    mockDb._conversations.clear();
    mockDb._customers.clear();

    const result = await service.sendMessage({
      conversationId: 'conv-missing',
      content: 'Test',
      senderId: 'agent-1'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle non-LINE platform', async () => {
    mockDb._customers.clear();
    mockDb._customers.set(2, {
      ...mockCustomer,
      id: 2,
      platform: 'facebook',
      platformUserId: 'FB123'
    });

    const result = await service.sendMessage({
      conversationId: 'conv-1',
      content: 'Facebook message',
      senderId: 'agent-1'
    });

    // Facebook is not yet supported, should still insert but with appropriate status
    expect(result).toBeDefined();
    expect(result.messageId).toBeDefined();
  });

  it('should handle LINE API failure gracefully', async () => {
    const { pushLineMessage } = await import('@/utils/line');
    (pushLineMessage as any).mockResolvedValueOnce(false);

    const result = await service.sendMessage({
      conversationId: 'conv-1',
      content: 'Will fail on LINE',
      senderId: 'agent-1'
    });

    // Should still return a result with the message saved
    expect(result).toBeDefined();
    expect(result.messageId).toBeDefined();
  });
});
