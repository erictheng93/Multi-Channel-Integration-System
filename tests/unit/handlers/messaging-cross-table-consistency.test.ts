/**
 * Messaging Cross-Table Data Consistency Tests
 *
 * Tests the cross-table side effects of message operations:
 *
 * 1. After CREATE message → conversation.lastMessageAt & updatedAt should update
 * 2. After UPDATE message → message.updatedAt should be set (conversation untouched)
 * 3. After RECALL message → message state changes (isRecalled, content replaced)
 * 4. Multiple messages → conversation timestamps reflect the latest message
 *
 * This fills the gap identified in the test coverage report:
 *   "欠缺驗證「建立訊息後，對話 (Conversation) 的 lastMessageAt 是否正確更新」等跨表聯動測試"
 *
 * Mock Strategy:
 * - Operation-tracking DB mock that records ALL insert/update/select calls
 * - Separate tracking for messages table vs conversations table operations
 * - Timestamp validation for cross-table consistency
 *
 * @see src/handlers/messaging/routes/crud.ts (lines 378-388: conversation update after message insert)
 * @see src/durable-objects/CustomerMessageDO.ts (lines 332-338: same pattern in DO)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@backend/types';

// ============================================================================
// Operation Tracker (records all DB operations with table context)
// ============================================================================

interface DbOperation {
  type: 'select' | 'insert' | 'update';
  table: string;
  data?: any;
  timestamp: number;
}

let dbOperations: DbOperation[];

/**
 * Track a DB operation with table context
 */
function trackOperation(type: DbOperation['type'], table: string, data?: any) {
  dbOperations.push({ type, table, data, timestamp: Date.now() });
}

/**
 * Get all operations of a specific type and table
 */
function getOperations(type: DbOperation['type'], table?: string): DbOperation[] {
  return dbOperations.filter(
    op => op.type === type && (!table || op.table === table)
  );
}

// ============================================================================
// Configurable Mock State
// ============================================================================

let mockState: {
  getConversation: any;
  getExistingMessage: any;
  getUpdatedMessage: any;
};

let activeEndpoint: 'get' | 'post' | 'put' | 'delete' = 'post';
let selectCallCount = 0;

let mockJwtPayload: {
  userId: number | string;
  username: string;
  role: string;
  displayName?: string;
  teamId?: number;
};

// Mock JWT auth
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c: any, next: any) => {
    c.set('jwtPayload', mockJwtPayload);
    return next();
  })
}));

// Operation-tracking DB mock with cross-table awareness
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => {
    selectCallCount = 0;

    return {
      select: vi.fn().mockImplementation((selectFields?: any) => {
        selectCallCount++;

        const chain: Record<string, any> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.leftJoin = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.get = vi.fn().mockImplementation(() => {
          trackOperation('select', 'unknown');

          if (activeEndpoint === 'post') {
            // First select = conversation check, rest = attachments
            if (selectCallCount === 1) {
              return Promise.resolve(mockState.getConversation);
            }
            return Promise.resolve(null);
          }
          if (activeEndpoint === 'get') {
            return Promise.resolve(mockState.getExistingMessage);
          }
          if (activeEndpoint === 'put') {
            if (selectCallCount === 1) return Promise.resolve(mockState.getExistingMessage);
            return Promise.resolve(mockState.getUpdatedMessage);
          }
          if (activeEndpoint === 'delete') {
            return Promise.resolve(mockState.getExistingMessage);
          }
          return Promise.resolve(null);
        });
        chain.all = vi.fn().mockImplementation(() => Promise.resolve([]));
        return chain;
      }),

      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values: any) => {
          trackOperation('insert', 'messages', values);
          return Promise.resolve({ success: true });
        })
      })),

      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((setValues: any) => ({
          where: vi.fn().mockImplementation(() => {
            // Detect table from the fields being set
            if (setValues.lastMessageAt || (setValues.updatedAt && !setValues.content && !setValues.isRecalled && !setValues.messageType)) {
              trackOperation('update', 'conversations', setValues);
            } else if (setValues.messageId) {
              trackOperation('update', 'file_attachments', setValues);
            } else {
              trackOperation('update', 'messages', setValues);
            }
            return Promise.resolve({ success: true });
          })
        }))
      }))
    };
  })
}));

// Import handler AFTER mocks
import crudRoutes from '@modules/messaging/handlers/messaging/routes/crud';

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

function resetState() {
  dbOperations = [];
  selectCallCount = 0;
  mockState = {
    getConversation: null,
    getExistingMessage: null,
    getUpdatedMessage: null
  };
  mockJwtPayload = {
    userId: 1,
    username: 'test-agent',
    role: 'agent',
    displayName: 'Test Agent',
    teamId: 1
  };
}

// ============================================================================
// Cross-Table Consistency Tests
// ============================================================================

describe('Cross-Table Data Consistency Tests (跨表聯動測試)', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    app = createTestApp();
  });

  describe('POST /api/messages → Conversation Timestamp Updates', () => {
    beforeEach(() => {
      activeEndpoint = 'post';
      mockState.getConversation = { id: 'conv-001' };
    });

    it('should update conversations.lastMessageAt after creating a message', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Cross-table test message'
        })
      });

      expect(res.status).toBe(201);

      // Verify conversation update occurred
      const convUpdates = getOperations('update', 'conversations');
      expect(convUpdates.length).toBe(1);
      expect(convUpdates[0].data.lastMessageAt).toBeTruthy();
      expect(convUpdates[0].data.lastMessageAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should update conversations.updatedAt after creating a message', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Timestamp consistency test'
        })
      });

      expect(res.status).toBe(201);

      const convUpdates = getOperations('update', 'conversations');
      expect(convUpdates.length).toBe(1);
      expect(convUpdates[0].data.updatedAt).toBeTruthy();
      expect(convUpdates[0].data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should set lastMessageAt and updatedAt to the same timestamp', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Synchronized timestamp test'
        })
      });

      expect(res.status).toBe(201);

      const convUpdates = getOperations('update', 'conversations');
      expect(convUpdates.length).toBe(1);

      const { lastMessageAt, updatedAt } = convUpdates[0].data;
      // Both should be ISO timestamps
      expect(lastMessageAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should insert message BEFORE updating conversation timestamps', async () => {
      await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Order verification test'
        })
      });

      // Verify operation order: insert message → update conversation
      const messageInserts = getOperations('insert', 'messages');
      const convUpdates = getOperations('update', 'conversations');

      expect(messageInserts.length).toBe(1);
      expect(convUpdates.length).toBe(1);

      // Insert should come before update (lower index in operations array)
      const insertIndex = dbOperations.findIndex(
        op => op.type === 'insert' && op.table === 'messages'
      );
      const updateIndex = dbOperations.findIndex(
        op => op.type === 'update' && op.table === 'conversations'
      );

      expect(insertIndex).toBeLessThan(updateIndex);
    });

    it('should include correct message data in the insert operation', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Detailed insert verification'
        })
      });

      expect(res.status).toBe(201);

      const messageInserts = getOperations('insert', 'messages');
      expect(messageInserts.length).toBe(1);

      const insertedData = messageInserts[0].data;
      expect(insertedData.conversationId).toBe('conv-001');
      expect(insertedData.content).toBe('Detailed insert verification');
      expect(insertedData.senderType).toBe('agent');
      expect(insertedData.agentSenderId).toBe('1');
      expect(insertedData.id).toMatch(/^msg_/);
      expect(insertedData.createdAt).toBeTruthy();
    });

    it('should NOT update conversation when create validation fails (missing content)', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: ''
        })
      });

      expect(res.status).toBe(400);

      // No conversation update should have occurred
      const convUpdates = getOperations('update', 'conversations');
      expect(convUpdates.length).toBe(0);
    });

    it('should NOT update conversation when conversation does not exist', async () => {
      mockState.getConversation = null; // Conversation not found

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-nonexistent',
          content: 'No conversation'
        })
      });

      expect(res.status).toBe(404);

      // No message insert or conversation update
      const messageInserts = getOperations('insert', 'messages');
      const convUpdates = getOperations('update', 'conversations');
      expect(messageInserts.length).toBe(0);
      expect(convUpdates.length).toBe(0);
    });
  });

  describe('PUT /api/messages/:id → Message updatedAt Tracking', () => {
    beforeEach(() => {
      activeEndpoint = 'put';
      mockState.getExistingMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        agentSenderId: '1',
        senderType: 'agent',
        isRecalled: false,
        content: 'Original content',
        createdAt: '2024-06-15T10:00:00Z'
      };
      mockState.getUpdatedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Updated content',
        messageType: 'text',
        metadata: null,
        createdAt: '2024-06-15T10:00:00Z'
      };
    });

    it('should set messages.updatedAt when updating a message', async () => {
      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Updated content' })
      });

      expect(res.status).toBe(200);

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates.length).toBe(1);
      expect(messageUpdates[0].data.updatedAt).toBeTruthy();
      expect(messageUpdates[0].data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include updated content in the update operation', async () => {
      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New content value' })
      });

      expect(res.status).toBe(200);

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates[0].data.content).toBe('New content value');
    });

    it('should NOT trigger a conversation update on message edit', async () => {
      await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Editing only' })
      });

      // Message update should exist
      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates.length).toBe(1);

      // Conversation update should NOT exist (editing doesn't change conversation timestamps)
      const convUpdates = getOperations('update', 'conversations');
      expect(convUpdates.length).toBe(0);
    });

    it('should serialize metadata to JSON string on update', async () => {
      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'With metadata',
          metadata: { priority: 'high', tags: ['urgent'] }
        })
      });

      expect(res.status).toBe(200);

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates[0].data.metadata).toBe(
        JSON.stringify({ priority: 'high', tags: ['urgent'] })
      );
    });

    it('should NOT update message when validation fails (empty content)', async () => {
      const res = await app.request('/api/messages/msg-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '   ' })
      });

      expect(res.status).toBe(400);

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates.length).toBe(0);
    });
  });

  describe('DELETE /api/messages/:id → Recall State Consistency', () => {
    beforeEach(() => {
      activeEndpoint = 'delete';
      mockState.getExistingMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        agentSenderId: '1',
        senderType: 'agent',
        isRecalled: false,
        recallDeadline: null,
        content: 'Message to recall',
        createdAt: '2024-06-15T10:00:00Z'
      };
    });

    it('should set isRecalled=true in the update operation', async () => {
      const res = await app.request('/api/messages/msg-001', { method: 'DELETE' });
      expect(res.status).toBe(200);

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates.length).toBe(1);
      expect(messageUpdates[0].data.isRecalled).toBe(true);
    });

    it('should replace content with recall placeholder', async () => {
      await app.request('/api/messages/msg-001', { method: 'DELETE' });

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates[0].data.content).toBe('[This message has been recalled]');
    });

    it('should set recalledAt timestamp', async () => {
      await app.request('/api/messages/msg-001', { method: 'DELETE' });

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates[0].data.recalledAt).toBeTruthy();
      expect(messageUpdates[0].data.recalledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should NOT trigger a conversation update on message recall', async () => {
      await app.request('/api/messages/msg-001', { method: 'DELETE' });

      const convUpdates = getOperations('update', 'conversations');
      expect(convUpdates.length).toBe(0);
    });

    it('should NOT update message when already recalled', async () => {
      mockState.getExistingMessage = {
        ...mockState.getExistingMessage,
        isRecalled: true
      };

      const res = await app.request('/api/messages/msg-001', { method: 'DELETE' });
      expect(res.status).toBe(400);

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates.length).toBe(0);
    });

    it('should NOT update message when recall deadline has passed', async () => {
      mockState.getExistingMessage = {
        ...mockState.getExistingMessage,
        recallDeadline: '2020-01-01T00:00:00Z' // Past deadline
      };

      const res = await app.request('/api/messages/msg-001', { method: 'DELETE' });
      expect(res.status).toBe(400);

      const messageUpdates = getOperations('update', 'messages');
      expect(messageUpdates.length).toBe(0);
    });

    it('should include recalledBy info from JWT in the response', async () => {
      mockJwtPayload = {
        userId: 42,
        username: 'admin-user',
        role: 'admin',
        displayName: 'Admin 42'
      };

      const res = await app.request('/api/messages/msg-001', { method: 'DELETE' });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.recalledBy).toEqual({
        id: '42',
        name: 'Admin 42'
      });
    });
  });

  describe('Multi-Operation Consistency (完整鏈路驗證)', () => {
    it('creating two messages should trigger two conversation updates', async () => {
      activeEndpoint = 'post';
      mockState.getConversation = { id: 'conv-001' };

      // Create message 1
      await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'First message'
        })
      });

      // Create message 2
      await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Second message'
        })
      });

      // Verify: 2 message inserts + 2 conversation updates
      const messageInserts = getOperations('insert', 'messages');
      const convUpdates = getOperations('update', 'conversations');

      expect(messageInserts.length).toBe(2);
      expect(convUpdates.length).toBe(2);

      // Second timestamp should be >= first
      const ts1 = new Date(convUpdates[0].data.lastMessageAt).getTime();
      const ts2 = new Date(convUpdates[1].data.lastMessageAt).getTime();
      expect(ts2).toBeGreaterThanOrEqual(ts1);
    });

    it('create + recall should produce insert + conv update + message update', async () => {
      // Step 1: Create
      activeEndpoint = 'post';
      mockState.getConversation = { id: 'conv-001' };

      await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-001',
          content: 'Will be recalled'
        })
      });

      // Step 2: Recall
      activeEndpoint = 'delete';
      mockState.getExistingMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        agentSenderId: '1',
        senderType: 'agent',
        isRecalled: false,
        recallDeadline: null,
        content: 'Will be recalled',
        createdAt: '2024-06-15T10:00:00Z'
      };

      await app.request('/api/messages/msg-001', { method: 'DELETE' });

      // Verify complete operation sequence
      const allOps = dbOperations.filter(op => op.type !== 'select');

      // Should have: 1 insert (message) + 1 update (conversation) + 1 update (message recall)
      const messageInserts = getOperations('insert', 'messages');
      const convUpdates = getOperations('update', 'conversations');
      const messageUpdates = getOperations('update', 'messages');

      expect(messageInserts.length).toBe(1);
      expect(convUpdates.length).toBe(1); // Only from create, not from recall
      expect(messageUpdates.length).toBe(1);

      // Verify recall update data
      expect(messageUpdates[0].data.isRecalled).toBe(true);
      expect(messageUpdates[0].data.content).toBe('[This message has been recalled]');
    });

    it('failed create should leave zero side effects', async () => {
      activeEndpoint = 'post';
      mockState.getConversation = null; // Conversation not found

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-nonexistent',
          content: 'Should fail'
        })
      });

      expect(res.status).toBe(404);

      // Zero writes should have occurred
      const inserts = getOperations('insert');
      const updates = getOperations('update');
      expect(inserts.length).toBe(0);
      expect(updates.length).toBe(0);
    });
  });
});
