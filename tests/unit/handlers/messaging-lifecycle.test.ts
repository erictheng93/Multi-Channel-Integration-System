/**
 * Messaging Lifecycle Chain Tests
 *
 * Tests the complete message lifecycle through sequential API calls:
 * 1. POST /api/messages → Create message
 * 2. GET  /api/messages/:id → Query created message
 * 3. PUT  /api/messages/:id → Update message content
 * 4. GET  /api/messages/:id → Verify update applied
 * 5. DELETE /api/messages/:id → Recall message
 * 6. GET  /api/messages/:id → Verify recall state
 *
 * This fills the gap identified in the test coverage report:
 * "欠缺「建立訊息 -> 查詢訊息 -> 更新訊息 -> 撤回訊息」的完整 API 鏈路測試"
 *
 * Mock Strategy:
 * - Stateful in-memory store simulating real DB behavior across operations
 * - Tracks message state changes through the full lifecycle
 * - Verifies each step receives the correct state from prior steps
 *
 * @see src/handlers/messaging/routes/crud.ts
 * @see tests/unit/handlers/messaging-crud.test.ts (individual operation tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@backend/types';

// ============================================================================
// Stateful In-Memory Store (simulates real DB across lifecycle)
// ============================================================================

/** In-memory message store for lifecycle tracking */
let messageStore: Map<string, Record<string, any>>;

/** In-memory conversation store */
let conversationStore: Map<string, Record<string, any>>;

/** In-memory attachment store */
let attachmentStore: Map<string, Record<string, any>>;

/** JWT payload for auth simulation */
let mockJwtPayload: {
  userId: number | string;
  username: string;
  role: string;
  displayName?: string;
  teamId?: number;
};

// Mock JWT auth middleware
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c: any, next: any) => {
    c.set('jwtPayload', mockJwtPayload);
    return next();
  })
}));

// Stateful DB mock that reads/writes to in-memory stores
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => {
    let selectCallCount = 0;

    return {
      select: vi.fn().mockImplementation((selectFields?: any) => {
        selectCallCount++;
        const chain: Record<string, any> = {};

        chain.from = vi.fn().mockReturnValue(chain);
        chain.leftJoin = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.get = vi.fn().mockImplementation(() => {
          // Heuristic: If selectFields has exactly {id: ...} → conversation lookup (POST create)
          if (selectFields && Object.keys(selectFields).length === 1 && selectFields.id) {
            for (const [, conv] of conversationStore.entries()) {
              return Promise.resolve(conv);
            }
            return Promise.resolve(null);
          }

          // Message lookup - return the last inserted message
          const msgs = Array.from(messageStore.values());
          if (msgs.length > 0) {
            return Promise.resolve({ ...msgs[msgs.length - 1] });
          }

          // Fall back to conversation if no messages exist
          for (const [, conv] of conversationStore.entries()) {
            return Promise.resolve(conv);
          }

          return Promise.resolve(null);
        });
        chain.all = vi.fn().mockImplementation(() => Promise.resolve([]));
        return chain;
      }),

      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values: any) => {
          // Store in messageStore
          if (values.id && values.conversationId && values.content !== undefined) {
            messageStore.set(values.id, { ...values });
          }
          return Promise.resolve({ success: true });
        })
      })),

      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((setValues: any) => ({
          where: vi.fn().mockImplementation(() => {
            // Detect target table from setValues fields:
            // - lastMessageAt present → conversation timestamp update
            // - messageId present (as a value to set) → attachment linking
            // - anything else → message update
            if (setValues.lastMessageAt) {
              for (const [, conv] of conversationStore.entries()) {
                Object.assign(conv, setValues);
              }
            } else if ('messageId' in setValues && !('content' in setValues)) {
              for (const [, att] of attachmentStore.entries()) {
                att.messageId = setValues.messageId;
              }
            } else {
              // Message update - apply to the last message in the store
              const msgs = Array.from(messageStore.entries());
              if (msgs.length > 0) {
                const lastMsg = msgs[msgs.length - 1];
                Object.assign(lastMsg[1], setValues);
              }
            }
            return Promise.resolve({ success: true });
          })
        }))
      }))
    };
  })
}));

// Import handler AFTER mocks are registered
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

function resetStores() {
  messageStore = new Map();
  conversationStore = new Map();
  attachmentStore = new Map();
  mockJwtPayload = {
    userId: 1,
    username: 'test-agent',
    role: 'agent',
    displayName: 'Test Agent',
    teamId: 1
  };
}

// ============================================================================
// Lifecycle Chain Tests
// ============================================================================

describe('Message Lifecycle Chain Tests (建立→查詢→更新→撤回)', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    app = createTestApp();

    // Pre-populate a conversation
    conversationStore.set('conv-lifecycle-001', {
      id: 'conv-lifecycle-001',
      status: 'active',
      priority: 'normal',
      lastMessageAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    });
  });

  describe('Complete CRUD Lifecycle', () => {
    it('Step 1: POST → should create a message successfully', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Hello from lifecycle test'
        })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.content).toBe('Hello from lifecycle test');
      expect(body.data.conversationId).toBe('conv-lifecycle-001');
      expect(body.data.senderType).toBe('agent');
      expect(body.data.agentSenderId).toBe('1');
      expect(body.data.id).toMatch(/^msg_/);
    });

    it('Step 2: GET → should retrieve the created message', async () => {
      // First create a message so it exists in the store
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Message for retrieval'
        })
      });

      const createBody = await createRes.json();
      const messageId = createBody.data.id;
      expect(messageId).toBeTruthy();

      // Now query it
      const getRes = await app.request(`/api/messages/${messageId}`);
      expect(getRes.status).toBe(200);

      const getBody = await getRes.json();
      expect(getBody.success).toBe(true);
      expect(getBody.data.content).toBe('Message for retrieval');
      expect(getBody.data.conversationId).toBe('conv-lifecycle-001');
    });

    it('Step 3: PUT → should update the message content', async () => {
      // Create message
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Original content'
        })
      });
      const createBody = await createRes.json();
      const messageId = createBody.data.id;

      // Update message
      const updateRes = await app.request(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Updated content'
        })
      });

      expect(updateRes.status).toBe(200);
      const updateBody = await updateRes.json();
      expect(updateBody.success).toBe(true);

      // Verify update was applied in the store
      const storedMsg = messageStore.get(messageId);
      expect(storedMsg).toBeDefined();
      expect(storedMsg!.content).toBe('Updated content');
    });

    it('Step 4: DELETE → should recall the message', async () => {
      // Create message
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Message to be recalled'
        })
      });
      const createBody = await createRes.json();
      const messageId = createBody.data.id;

      // Recall message
      const deleteRes = await app.request(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });

      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.success).toBe(true);
      expect(deleteBody.data.isRecalled).toBe(true);
      expect(deleteBody.data.recalledAt).toBeTruthy();
      expect(deleteBody.data.recalledBy.id).toBe('1');
      expect(deleteBody.data.recalledBy.name).toBe('Test Agent');

      // Verify store state after recall
      const storedMsg = messageStore.get(messageId);
      expect(storedMsg!.isRecalled).toBe(true);
      expect(storedMsg!.content).toBe('[This message has been recalled]');
    });

    it('Full chain: CREATE → GET → UPDATE → GET → RECALL → verify final state', async () => {
      // === Step 1: CREATE ===
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Full lifecycle message',
          messageType: 'text'
        })
      });
      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      const messageId = createBody.data.id;
      expect(messageId).toMatch(/^msg_/);
      expect(createBody.data.content).toBe('Full lifecycle message');

      // Verify store after create
      expect(messageStore.has(messageId)).toBe(true);
      const afterCreate = messageStore.get(messageId)!;
      expect(afterCreate.content).toBe('Full lifecycle message');
      expect(afterCreate.isRecalled).toBeFalsy();

      // === Step 2: GET (verify created state) ===
      const get1Res = await app.request(`/api/messages/${messageId}`);
      expect(get1Res.status).toBe(200);
      const get1Body = await get1Res.json();
      expect(get1Body.data.content).toBe('Full lifecycle message');

      // === Step 3: UPDATE ===
      const updateRes = await app.request(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Updated lifecycle message'
        })
      });
      expect(updateRes.status).toBe(200);

      // Verify store after update
      const afterUpdate = messageStore.get(messageId)!;
      expect(afterUpdate.content).toBe('Updated lifecycle message');
      expect(afterUpdate.updatedAt).toBeTruthy();

      // === Step 4: GET (verify updated state) ===
      const get2Res = await app.request(`/api/messages/${messageId}`);
      expect(get2Res.status).toBe(200);
      const get2Body = await get2Res.json();
      // Content should be the updated value
      expect(get2Body.data.content).toBe('Updated lifecycle message');

      // === Step 5: RECALL ===
      const deleteRes = await app.request(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });
      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.data.isRecalled).toBe(true);

      // === Step 6: Verify final state in store ===
      const finalState = messageStore.get(messageId)!;
      expect(finalState.isRecalled).toBe(true);
      expect(finalState.content).toBe('[This message has been recalled]');
      expect(finalState.recalledAt).toBeTruthy();
    });
  });

  describe('Lifecycle Edge Cases', () => {
    it('should prevent updating a recalled message', async () => {
      // Create and recall
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Will be recalled'
        })
      });
      const messageId = (await createRes.json()).data.id;

      // Recall
      await app.request(`/api/messages/${messageId}`, { method: 'DELETE' });
      expect(messageStore.get(messageId)!.isRecalled).toBe(true);

      // Attempt to update after recall → should fail
      const updateRes = await app.request(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Should not work' })
      });

      expect(updateRes.status).toBe(400);
      const body = await updateRes.json();
      expect(body.success).toBe(false);
    });

    it('should prevent double recall', async () => {
      // Create
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Double recall test'
        })
      });
      const messageId = (await createRes.json()).data.id;

      // First recall → success
      const recall1 = await app.request(`/api/messages/${messageId}`, { method: 'DELETE' });
      expect(recall1.status).toBe(200);

      // Second recall → should fail
      const recall2 = await app.request(`/api/messages/${messageId}`, { method: 'DELETE' });
      expect(recall2.status).toBe(400);
      const body = await recall2.json();
      expect(body.success).toBe(false);
    });

    it('should reject empty content on create', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: ''
        })
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should reject empty content on update', async () => {
      // Create
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Valid content'
        })
      });
      const messageId = (await createRes.json()).data.id;

      // Update with empty content → should fail
      const updateRes = await app.request(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' })
      });

      expect(updateRes.status).toBe(400);
    });

    it('should reject missing conversationId on create', async () => {
      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'No conversation ID'
        })
      });

      expect(res.status).toBe(400);
    });

    it('should return 404 when getting non-existent message', async () => {
      // Clear the store so nothing is found
      messageStore.clear();
      conversationStore.clear();

      const res = await app.request('/api/messages/msg-nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('Multi-message Lifecycle', () => {
    it('should create multiple messages in the same conversation', async () => {
      // Create message 1
      const res1 = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'First message'
        })
      });
      expect(res1.status).toBe(201);
      const msg1Id = (await res1.json()).data.id;

      // Create message 2
      const res2 = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Second message'
        })
      });
      expect(res2.status).toBe(201);
      const msg2Id = (await res2.json()).data.id;

      // Both should exist in store with distinct IDs
      expect(messageStore.size).toBe(2);
      expect(msg1Id).not.toBe(msg2Id);
      expect(messageStore.get(msg1Id)!.content).toBe('First message');
      expect(messageStore.get(msg2Id)!.content).toBe('Second message');

      // Both belong to the same conversation
      expect(messageStore.get(msg1Id)!.conversationId).toBe('conv-lifecycle-001');
      expect(messageStore.get(msg2Id)!.conversationId).toBe('conv-lifecycle-001');
    });

    it('should recall a message and return correct recall metadata', async () => {
      // Create a message
      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Message to recall'
        })
      });
      const messageId = (await createRes.json()).data.id;

      // Recall it
      const recallRes = await app.request(`/api/messages/${messageId}`, { method: 'DELETE' });
      expect(recallRes.status).toBe(200);

      const body = await recallRes.json();
      expect(body.data.isRecalled).toBe(true);
      expect(body.data.conversationId).toBe('conv-lifecycle-001');
      expect(body.data.recalledBy.id).toBe('1');
    });
  });

  describe('Permission Checks in Lifecycle', () => {
    it('should allow admin to recall any agent message', async () => {
      // Create as agent
      mockJwtPayload = { userId: 10, username: 'agent-10', role: 'agent', displayName: 'Agent 10' };

      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Agent message'
        })
      });
      const messageId = (await createRes.json()).data.id;

      // Switch to admin
      mockJwtPayload = { userId: 99, username: 'admin', role: 'admin', displayName: 'Admin User' };

      // Admin should be able to recall
      const deleteRes = await app.request(`/api/messages/${messageId}`, { method: 'DELETE' });
      expect(deleteRes.status).toBe(200);
      const body = await deleteRes.json();
      expect(body.data.recalledBy.id).toBe('99');
      expect(body.data.recalledBy.name).toBe('Admin User');
    });

    it('should prevent non-sender agent from updating another agents message', async () => {
      // Create as agent 10
      mockJwtPayload = { userId: 10, username: 'agent-10', role: 'agent', displayName: 'Agent 10' };

      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Agent 10 message'
        })
      });
      const messageId = (await createRes.json()).data.id;

      // Switch to agent 20
      mockJwtPayload = { userId: 20, username: 'agent-20', role: 'agent', displayName: 'Agent 20' };

      // Should be denied
      const updateRes = await app.request(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hijacked!' })
      });

      expect(updateRes.status).toBe(403);
    });

    it('should prevent non-sender agent from recalling another agents message', async () => {
      // Create as agent 10
      mockJwtPayload = { userId: 10, username: 'agent-10', role: 'agent', displayName: 'Agent 10' };

      const createRes = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv-lifecycle-001',
          content: 'Cannot recall this'
        })
      });
      const messageId = (await createRes.json()).data.id;

      // Switch to agent 20
      mockJwtPayload = { userId: 20, username: 'agent-20', role: 'agent', displayName: 'Agent 20' };

      const deleteRes = await app.request(`/api/messages/${messageId}`, { method: 'DELETE' });
      expect(deleteRes.status).toBe(403);
    });
  });
});
