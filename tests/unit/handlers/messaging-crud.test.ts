/**
 * Messaging CRUD Handler Unit Tests
 *
 * Tests all 4 endpoints in src/handlers/messaging/routes/crud.ts:
 * 1. GET /api/messages/:id    - Get single message with joined data
 * 2. POST /api/messages       - Create message with attachment linking
 * 3. PUT /api/messages/:id    - Update message with permission checks
 * 4. DELETE /api/messages/:id - Recall message with deadline validation
 *
 * Mock Strategy:
 * - Operation-aware DB mock: tracks select/insert/update/delete chains
 * - Configurable per-test results via mockState
 * - JWT auth middleware bypassed with mock jwtPayload
 *
 * @see src/handlers/messaging/routes/crud.ts
 * @see tests/unit/handlers/export.test.ts (pattern reference)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@backend/types';

// ============================================================================
// Mock Setup (MUST be before handler import)
// ============================================================================

// Configurable mock state — set per-test in beforeEach or individual tests
let mockState: {
  // GET /:id — result from select().from(messages).leftJoin(...)...get()
  getMessage: any;
  // POST / — result from select().from(conversations)...get()
  getConversation: any;
  // PUT /:id — result from select().from(messages)...get() for existence check
  getExistingMessage: any;
  // PUT /:id — result from select().from(messages)...get() after update
  getUpdatedMessage: any;
  // DELETE /:id — result from select().from(messages)...get() for existence check
  getDeleteTarget: any;
  // POST / — results from select().from(fileAttachments)...all()
  getAttachments: any[];
} = {
  getMessage: null,
  getConversation: null,
  getExistingMessage: null,
  getUpdatedMessage: null,
  getDeleteTarget: null,
  getAttachments: []
};

let mockDbError: Error | null = null;
let mockInsertError: Error | null = null;
let mockUpdateError: Error | null = null;

// Track DB operations for assertions
let dbOperations: {
  inserts: { values: any }[];
  updates: { set: any }[];
};

// Which endpoint is being tested — set in beforeEach per describe block
let activeEndpoint: 'get' | 'post' | 'put' | 'delete' = 'get';

// Mock JWT auth middleware — bypass authentication, inject jwtPayload
let mockJwtPayload: {
  userId: number | string;
  username: string;
  role: string;
  displayName?: string;
  teamId?: number;
};

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c: any, next: any) => {
    c.set('jwtPayload', mockJwtPayload);
    return next();
  })
}));

// Mock drizzle-factory with operation-aware chainable DB mock
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => {
    let selectCallCount = 0;

    return {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;

        if (mockDbError) {
          // Return chain that rejects on terminal methods
          const errorChain: Record<string, any> = {};
          errorChain.from = vi.fn().mockReturnValue(errorChain);
          errorChain.leftJoin = vi.fn().mockReturnValue(errorChain);
          errorChain.where = vi.fn().mockReturnValue(errorChain);
          errorChain.get = vi.fn().mockRejectedValue(mockDbError);
          errorChain.all = vi.fn().mockRejectedValue(mockDbError);
          return errorChain;
        }

        const getResult = (): any => {
          if (activeEndpoint === 'get') {
            return mockState.getMessage;
          }
          if (activeEndpoint === 'post') {
            if (selectCallCount === 1) return mockState.getConversation;
            return mockState.getAttachments;
          }
          if (activeEndpoint === 'put') {
            if (selectCallCount === 1) return mockState.getExistingMessage;
            return mockState.getUpdatedMessage;
          }
          if (activeEndpoint === 'delete') {
            return mockState.getDeleteTarget;
          }
          return null;
        };

        const chain: Record<string, any> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.leftJoin = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.get = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
        chain.all = vi.fn().mockImplementation(() => {
          const result = getResult();
          return Promise.resolve(Array.isArray(result) ? result : []);
        });
        return chain;
      }),

      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values: any) => {
          dbOperations.inserts.push({ values });
          if (mockInsertError) return Promise.reject(mockInsertError);
          return Promise.resolve({ success: true });
        })
      })),

      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((setValues: any) => ({
          where: vi.fn().mockImplementation(() => {
            dbOperations.updates.push({ set: setValues });
            if (mockUpdateError) return Promise.reject(mockUpdateError);
            return Promise.resolve({ success: true });
          })
        }))
      }))
    };
  })
}));

// Mock replyToMessageId validation — always pass in handler unit tests
// (existence validation is tested separately in validate-reply-to.test.ts)
vi.mock('@/utils/validate-reply-to', () => ({
  validateReplyToMessageId: vi.fn().mockResolvedValue({ valid: true })
}));

// Import handler AFTER mocks are registered
import crudRoutes from '@/handlers/messaging/routes/crud';

// ============================================================================
// Test Utilities
// ============================================================================

function createTestApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    c.env = { DB: {} } as any;
    await next();
  });
  app.route('/api/messages', crudRoutes);
  return app;
}

function resetMockState() {
  mockState = {
    getMessage: null,
    getConversation: null,
    getExistingMessage: null,
    getUpdatedMessage: null,
    getDeleteTarget: null,
    getAttachments: []
  };
  mockDbError = null;
  mockInsertError = null;
  mockUpdateError = null;
  dbOperations = { inserts: [], updates: [] };
  mockJwtPayload = {
    userId: 1,
    username: 'test-agent',
    role: 'agent',
    displayName: 'Test Agent',
    teamId: 1
  };
}

/** Create a mock message row as returned from DB join query (GET /:id) */
function createMockMessageRow(overrides: Record<string, any> = {}) {
  return {
    id: 'msg-001',
    conversationId: 'conv-001',
    senderType: 'agent',
    customerSenderId: null as number | null,
    agentSenderId: 'agent-1' as string | null,
    content: 'Hello, how can I help?',
    messageType: 'text',
    platformMessageId: null as string | null,
    isRecalled: false,
    recallDeadline: null as string | null,
    recalledAt: null as string | null,
    isSent: true,
    sentAt: '2024-06-15T10:00:00Z',
    deliveryStatus: 'delivered',
    replyToMessageId: null as string | null,
    threadId: null as string | null,
    sessionId: null as string | null,
    sessionSequence: null as number | null,
    metadata: null as string | null,
    createdAt: '2024-06-15T10:00:00Z',
    // Joined fields
    conversationStatus: 'active',
    conversationPriority: 'normal',
    agentName: 'Agent Alice' as string | null,
    agentRole: 'agent' as string | null,
    customerName: null as string | null,
    customerPlatform: null as string | null,
    ...overrides
  };
}

/** Create a mock existing message row (PUT/DELETE checks) */
function createMockExistingMessage(overrides: Record<string, any> = {}) {
  return {
    id: 'msg-001',
    conversationId: 'conv-001',
    agentSenderId: '1', // matches mockJwtPayload.userId.toString()
    senderType: 'agent',
    isRecalled: false,
    recallDeadline: null as string | null,
    content: 'Original content',
    createdAt: '2024-06-15T10:00:00Z',
    ...overrides
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Messaging CRUD Handler', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
    app = createTestApp();
  });

  // ==========================================================================
  // A. GET /api/messages/:id — Get Single Message
  // ==========================================================================
  describe('GET /api/messages/:id', () => {
    beforeEach(() => {
      activeEndpoint = 'get';
    });

    it('should return message with full detail when found', async () => {
      mockState.getMessage = createMockMessageRow();

      const res = await app.request('/api/messages/msg-001');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('msg-001');
      expect(body.data.conversationId).toBe('conv-001');
      expect(body.data.content).toBe('Hello, how can I help?');
    });

    it('should build senderInfo correctly for agent senderType', async () => {
      mockState.getMessage = createMockMessageRow({
        senderType: 'agent',
        agentSenderId: 'agent-1',
        agentName: 'Agent Alice',
        agentRole: 'admin'
      });

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.data.senderInfo).toEqual({
        id: 'agent-1',
        name: 'Agent Alice',
        role: 'admin'
      });
    });

    it('should build senderInfo correctly for customer senderType', async () => {
      mockState.getMessage = createMockMessageRow({
        senderType: 'customer',
        customerSenderId: 42,
        customerName: 'Customer Bob',
        customerPlatform: 'line',
        agentSenderId: null,
        agentName: null,
        agentRole: null
      });

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.data.senderInfo).toEqual({
        id: 42,
        name: 'Customer Bob',
        platform: 'line'
      });
    });

    it('should return null senderInfo for system senderType', async () => {
      mockState.getMessage = createMockMessageRow({
        senderType: 'system',
        agentSenderId: null,
        customerSenderId: null
      });

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.data.senderInfo).toBeNull();
    });

    it('should parse metadata JSON string correctly', async () => {
      mockState.getMessage = createMockMessageRow({
        metadata: '{"source":"line","stickerId":"12345"}'
      });

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.data.metadata).toEqual({
        source: 'line',
        stickerId: '12345'
      });
    });

    it('should return null metadata when metadata is null', async () => {
      mockState.getMessage = createMockMessageRow({ metadata: null });

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.data.metadata).toBeNull();
    });

    it('should include conversationInfo in response', async () => {
      mockState.getMessage = createMockMessageRow({
        conversationStatus: 'closed',
        conversationPriority: 'high'
      });

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.data.conversationInfo).toEqual({
        status: 'closed',
        priority: 'high'
      });
    });

    it('should convert isRecalled and isSent to boolean', async () => {
      // D1/SQLite stores booleans as 0/1 integers
      mockState.getMessage = createMockMessageRow({
        isRecalled: 0,
        isSent: 1
      });

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.data.isRecalled).toBe(false);
      expect(body.data.isSent).toBe(true);
    });

    it('should return 404 when message is not found', async () => {
      mockState.getMessage = null;

      const res = await app.request('/api/messages/nonexistent');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('not found');
    });

    it('should return 500 on database error', async () => {
      mockDbError = new Error('Database connection lost');

      const res = await app.request('/api/messages/msg-001');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Database connection lost');
    });

    it('should return generic message for non-Error throws', async () => {
      mockDbError = 'string error' as any;

      const res = await app.request('/api/messages/msg-001');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Failed to get message');
    });

    it('should include timestamp in response', async () => {
      mockState.getMessage = createMockMessageRow();

      const res = await app.request('/api/messages/msg-001');
      const body = await res.json();

      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ==========================================================================
  // B. POST /api/messages — Create New Message
  // ==========================================================================
  describe('POST /api/messages', () => {
    beforeEach(() => {
      activeEndpoint = 'post';
    });

    it('should create message successfully with minimum fields', async () => {
      mockState.getConversation = { id: 'conv-001' };

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Hello world'
        })
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.conversationId).toBe('conv-001');
      expect(body.data.content).toBe('Hello world');
      expect(body.data.senderType).toBe('agent');
      expect(body.data.messageType).toBe('text');
      expect(body.message).toBe('Message created successfully');
    });

    it('should generate unique message ID with msg_ prefix', async () => {
      mockState.getConversation = { id: 'conv-001' };

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Test message'
        })
      });
      const body = await res.json();

      expect(body.data.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('should use agentSenderId from JWT payload', async () => {
      mockJwtPayload = { userId: 42, username: 'agent-42', role: 'agent', displayName: 'Agent 42' };
      mockState.getConversation = { id: 'conv-001' };

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Test message'
        })
      });
      const body = await res.json();

      expect(body.data.agentSenderId).toBe('42');
    });

    it('should update conversation lastMessageAt and updatedAt', async () => {
      mockState.getConversation = { id: 'conv-001' };

      await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Test message'
        })
      });

      // Should have 2 updates: one for the conversation
      const convUpdate = dbOperations.updates.find(
        u => u.set.lastMessageAt && u.set.updatedAt
      );
      expect(convUpdate).toBeDefined();
      expect(convUpdate!.set.lastMessageAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(convUpdate!.set.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should link attachments when attachmentIds provided', async () => {
      mockState.getConversation = { id: 'conv-001' };
      mockState.getAttachments = [
        { id: 'att-1', messageId: 'msg-001', filename: 'file.pdf' }
      ];

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'See attached',
          attachmentIds: ['att-1', 'att-2']
        })
      });
      const body = await res.json();

      expect(body.success).toBe(true);
      // Attachment linking produces update operations (one per attachment)
      const attachmentUpdates = dbOperations.updates.filter(u => u.set.messageId);
      expect(attachmentUpdates.length).toBeGreaterThanOrEqual(1);
    });

    it('should return file_attachments in response', async () => {
      mockState.getConversation = { id: 'conv-001' };
      mockState.getAttachments = [
        { id: 'att-1', messageId: 'msg-new', filename: 'doc.pdf', mimeType: 'application/pdf' }
      ];

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Attached',
          attachmentIds: ['att-1']
        })
      });
      const body = await res.json();

      expect(body.data.file_attachments).toHaveLength(1);
      expect(body.data.file_attachments[0].filename).toBe('doc.pdf');
    });

    it('should accept optional messageType, replyToMessageId, and metadata', async () => {
      mockState.getConversation = { id: 'conv-001' };

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Image message',
          messageType: 'image',
          replyToMessageId: 'msg-parent',
          metadata: { width: 800, height: 600 }
        })
      });
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.messageType).toBe('image');
    });

    it('should return 400 when conversationId is missing', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'No conversation' })
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('required');
    });

    it('should return 400 when content is missing', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-001' })
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should return 400 when content is empty/whitespace', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-001', content: '   ' })
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should return 400 on invalid JSON body', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json'
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe('Invalid JSON data');
    });

    it('should return 404 when conversation does not exist', async () => {
      mockState.getConversation = null;

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-nonexistent',
          content: 'Hello'
        })
      });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toContain('not found');
    });

    it('should return 500 on database error', async () => {
      mockDbError = new Error('Insert failed');

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Test'
        })
      });
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should return generic error message for non-Error throws', async () => {
      mockDbError = { code: 'UNKNOWN' } as any;

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Test'
        })
      });
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Failed to create message');
    });
  });

  // ==========================================================================
  // C. PUT /api/messages/:id — Update Message
  // ==========================================================================
  describe('PUT /api/messages/:id', () => {
    beforeEach(() => {
      activeEndpoint = 'put';
    });

    it('should update message content successfully as sender', async () => {
      mockState.getExistingMessage = createMockExistingMessage();
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Updated content',
        messageType: 'text',
        metadata: null,
        createdAt: '2024-06-15T10:00:00Z'
      };

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Updated content' })
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Message updated successfully');
    });

    it('should update message when user is admin (even if not sender)', async () => {
      mockJwtPayload = { userId: 99, username: 'admin-user', role: 'admin', displayName: 'Admin' };
      mockState.getExistingMessage = createMockExistingMessage({
        agentSenderId: '1' // Different from admin userId 99
      });
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Admin edit',
        messageType: 'text',
        metadata: null,
        createdAt: '2024-06-15T10:00:00Z'
      };

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Admin edit' })
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('should return 403 when non-sender non-admin tries to update', async () => {
      mockJwtPayload = { userId: 99, username: 'other-agent', role: 'agent' };
      mockState.getExistingMessage = createMockExistingMessage({
        agentSenderId: '1', // Different from userId 99
        senderType: 'agent'
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Unauthorized edit' })
      });
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Only the sender or admin');
    });

    it('should return 400 when trying to update a recalled message', async () => {
      mockState.getExistingMessage = createMockExistingMessage({
        isRecalled: true
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New content' })
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('recalled');
    });

    it('should return 400 when content is empty string', async () => {
      mockState.getExistingMessage = createMockExistingMessage();

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '   ' })
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('empty');
    });

    it('should allow updating messageType alone', async () => {
      mockState.getExistingMessage = createMockExistingMessage();
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Original content',
        messageType: 'image',
        metadata: null,
        createdAt: '2024-06-15T10:00:00Z'
      };

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageType: 'image' })
      });
      expect(res.status).toBe(200);

      // Verify update was called
      expect(dbOperations.updates.length).toBeGreaterThanOrEqual(1);
      const updateOp = dbOperations.updates[0];
      expect(updateOp.set.messageType).toBe('image');
    });

    it('should serialize metadata to JSON string on update', async () => {
      mockState.getExistingMessage = createMockExistingMessage();
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Original content',
        messageType: 'text',
        metadata: '{"key":"value"}',
        createdAt: '2024-06-15T10:00:00Z'
      };

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { key: 'value' } })
      });
      expect(res.status).toBe(200);

      const updateOp = dbOperations.updates[0];
      expect(updateOp.set.metadata).toBe('{"key":"value"}');
    });

    it('should parse metadata in updated response', async () => {
      mockState.getExistingMessage = createMockExistingMessage();
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Content',
        messageType: 'text',
        metadata: '{"parsed":true}',
        createdAt: '2024-06-15T10:00:00Z'
      };

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Content' })
      });
      const body = await res.json();

      expect(body.data.metadata).toEqual({ parsed: true });
    });

    it('should return null metadata when updated message has no metadata', async () => {
      mockState.getExistingMessage = createMockExistingMessage();
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Content',
        messageType: 'text',
        metadata: null,
        createdAt: '2024-06-15T10:00:00Z'
      };

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Content' })
      });
      const body = await res.json();

      expect(body.data.metadata).toBeNull();
    });

    it('should return 404 when message does not exist', async () => {
      mockState.getExistingMessage = null;

      const res = await app.request('/api/messages/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New content' })
      });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toContain('not found');
    });

    it('should return 400 on invalid JSON body', async () => {
      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}'
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe('Invalid JSON data');
    });

    it('should set updatedAt timestamp on update', async () => {
      mockState.getExistingMessage = createMockExistingMessage();
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'New',
        messageType: 'text',
        metadata: null,
        createdAt: '2024-06-15T10:00:00Z'
      };

      await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New' })
      });

      const updateOp = dbOperations.updates[0];
      expect(updateOp.set.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return 500 on database error', async () => {
      mockDbError = new Error('Update failed');

      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New' })
      });
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // ==========================================================================
  // D. DELETE /api/messages/:id — Recall Message
  // ==========================================================================
  describe('DELETE /api/messages/:id', () => {
    beforeEach(() => {
      activeEndpoint = 'delete';
    });

    it('should recall message successfully as sender', async () => {
      mockState.getDeleteTarget = createMockExistingMessage();

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('msg-001');
      expect(body.data.isRecalled).toBe(true);
      expect(body.data.recalledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.message).toBe('Message recalled successfully');
    });

    it('should include recalledBy info from JWT payload', async () => {
      mockJwtPayload = {
        userId: 5,
        username: 'agent-5',
        role: 'agent',
        displayName: 'Agent Five'
      };
      mockState.getDeleteTarget = createMockExistingMessage({
        agentSenderId: '5' // Match userId
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      const body = await res.json();

      expect(body.data.recalledBy).toEqual({
        id: '5',
        name: 'Agent Five'
      });
    });

    it('should use "Unknown User" when displayName is not set', async () => {
      mockJwtPayload = {
        userId: 5,
        username: 'agent-5',
        role: 'agent'
        // No displayName
      };
      mockState.getDeleteTarget = createMockExistingMessage({
        agentSenderId: '5'
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      const body = await res.json();

      expect(body.data.recalledBy.name).toBe('Unknown User');
    });

    it('should allow admin to recall any message', async () => {
      mockJwtPayload = { userId: 99, username: 'admin', role: 'admin', displayName: 'Admin' };
      mockState.getDeleteTarget = createMockExistingMessage({
        agentSenderId: '1', // Different from admin userId 99
        senderType: 'agent'
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.isRecalled).toBe(true);
    });

    it('should return 403 when non-sender non-admin tries to recall', async () => {
      mockJwtPayload = { userId: 99, username: 'other-agent', role: 'agent' };
      mockState.getDeleteTarget = createMockExistingMessage({
        agentSenderId: '1', // Different from userId 99
        senderType: 'agent'
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toContain('Only the sender or admin');
    });

    it('should return 400 when message is already recalled', async () => {
      mockState.getDeleteTarget = createMockExistingMessage({
        isRecalled: true
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('already been recalled');
    });

    it('should return 400 when recall deadline has passed', async () => {
      const pastDeadline = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      mockState.getDeleteTarget = createMockExistingMessage({
        recallDeadline: pastDeadline
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('deadline has passed');
    });

    it('should allow recall when deadline is in the future', async () => {
      const futureDeadline = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      mockState.getDeleteTarget = createMockExistingMessage({
        recallDeadline: futureDeadline
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.isRecalled).toBe(true);
    });

    it('should allow recall when no deadline is set (null)', async () => {
      mockState.getDeleteTarget = createMockExistingMessage({
        recallDeadline: null
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.isRecalled).toBe(true);
    });

    it('should perform soft delete: set isRecalled=true and replace content', async () => {
      mockState.getDeleteTarget = createMockExistingMessage();

      await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });

      const updateOp = dbOperations.updates[0];
      expect(updateOp.set.isRecalled).toBe(true);
      expect(updateOp.set.content).toBe('[This message has been recalled]');
      expect(updateOp.set.recalledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return conversationId in recall response', async () => {
      mockState.getDeleteTarget = createMockExistingMessage({
        conversationId: 'conv-specific'
      });

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      const body = await res.json();

      expect(body.data.conversationId).toBe('conv-specific');
    });

    it('should return 404 when message does not exist', async () => {
      mockState.getDeleteTarget = null;

      const res = await app.request('/api/messages/nonexistent', {
        method: 'DELETE'
      });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toContain('not found');
    });

    it('should return 500 on database error', async () => {
      mockDbError = new Error('Delete operation failed');

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Delete operation failed');
    });

    it('should return generic message for non-Error throws', async () => {
      mockDbError = 42 as any;

      const res = await app.request('/api/messages/msg-001', {
        method: 'DELETE'
      });
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Failed to recall message');
    });
  });
});
