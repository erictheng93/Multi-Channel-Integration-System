/**
 * Conversation Handlers — Integration Tests
 *
 * Tests HTTP-level behavior of conversation endpoints:
 * - GET /api/conversations (list with filters)
 * - GET /api/conversations/:id (single conversation detail)
 * - POST /api/conversations/:id/assign
 * - POST /api/conversations/:id/unassign
 * - POST /api/conversations/bulk
 * - GET /api/conversations/:id/tags
 * - POST /api/conversations/:id/tags
 * - GET /api/conversations/:id/messages
 *
 * Mock strategy:
 * - vi.mock('@/middleware/auth') — bypasses JWT for all tests
 * - vi.mock('@/db/drizzle-factory') — chainable Drizzle mock
 * - vi.mock('@/services/permission-service') — controls permission results
 * - vi.mock('@/services/websocket-broadcast-service') — stubs WebSocket broadcasts
 * - vi.mock('@modules/conversations/services/message-service') — stubs message services
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Configurable user payload (set by jwtAuth mock)
// ---------------------------------------------------------------------------
let currentUser = {
  id: 1,
  username: 'testadmin',
  displayName: 'Test Admin',
  role: 'admin' as string,
  isActive: true,
  primaryTeamId: 1,
};

let currentJwtPayload = {
  userId: '1',
  username: 'testadmin',
  role: 'admin' as string,
  primaryTeamId: 1,
};

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('user', { ...currentUser });
    c.set('jwtPayload', { ...currentJwtPayload });
    return next();
  }),
  requireRole: vi.fn(() => (_c: any, next: any) => next()),
}));

// ---------------------------------------------------------------------------
// Permission service mock
// ---------------------------------------------------------------------------
let permissionCheckResult = true;
let visibleConversationIds: string[] = ['conv-001', 'conv-002', 'conv-003'];

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    checkPermission: vi.fn(() => Promise.resolve(permissionCheckResult)),
    getVisibleConversations: vi.fn(() => Promise.resolve(visibleConversationIds)),
  },
}));

// ---------------------------------------------------------------------------
// WebSocket broadcast service mock
// ---------------------------------------------------------------------------
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined),
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined),
    broadcastNewMessage: vi.fn().mockResolvedValue({ conversationBroadcast: true, globalBroadcast: true }),
    broadcastConversationTransferred: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Message service mock
// ---------------------------------------------------------------------------
vi.mock('@modules/conversations/services/message-service', () => ({
  MessageRequestService: {
    validateAndParse: vi.fn().mockResolvedValue({
      conversationId: 'conv-001',
      content: 'Hello',
      senderId: '1',
      messageType: 'text',
    }),
  },
  MessageService: vi.fn().mockImplementation(() => ({
    createPendingMessage: vi.fn().mockResolvedValue({
      messageId: 'msg-001',
      message: {
        id: 'msg-001',
        conversationId: 'conv-001',
        content: 'Hello',
        messageType: 'text',
        agentSenderId: '1',
        createdAt: '2026-01-01T00:00:00Z',
        metadata: null,
      },
    }),
    processBackgroundSending: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Drizzle mock — operation-aware chainable mock
// ---------------------------------------------------------------------------

/** Tracks all mock DB state. Reset before each test. */
interface MockDbState {
  // SELECT results by scenario
  selectResults: any[];
  selectGetResult: any;
  // UPDATE/INSERT/DELETE tracking
  updateCalled: boolean;
  insertCalled: boolean;
  deleteCalled: boolean;
  // Error simulation
  dbError: Error | null;
}

let mockDbState: MockDbState;

function resetMockDbState(overrides: Partial<MockDbState> = {}) {
  mockDbState = {
    selectResults: [],
    selectGetResult: undefined,
    updateCalled: false,
    insertCalled: false,
    deleteCalled: false,
    dbError: null,
    ...overrides,
  };
}

/**
 * Create a chainable Drizzle-like mock.
 * Supports: select().from().where().leftJoin().innerJoin().limit().offset().orderBy().get()
 * update().set().where()
 * insert().values().onConflictDoNothing()
 * delete().where()
 * selectDistinct().from().where()
 */
function createDrizzleMock() {
  const selectChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    get: vi.fn(() => {
      if (mockDbState.dbError) return Promise.reject(mockDbState.dbError);
      return Promise.resolve(mockDbState.selectGetResult);
    }),
    all: vi.fn(() => {
      if (mockDbState.dbError) return Promise.reject(mockDbState.dbError);
      return Promise.resolve(mockDbState.selectResults);
    }),
    then: function (resolve: any, reject: any) {
      if (mockDbState.dbError) return reject(mockDbState.dbError);
      return resolve(mockDbState.selectResults);
    },
  };

  // Make select chain thenable (for await without .get())
  Object.defineProperty(selectChain, 'then', {
    value: function (resolve: any, reject?: any) {
      if (mockDbState.dbError) {
        return reject ? reject(mockDbState.dbError) : Promise.reject(mockDbState.dbError);
      }
      return resolve(mockDbState.selectResults);
    },
    enumerable: false,
    writable: true,
  });

  const updateChain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => {
      mockDbState.updateCalled = true;
      if (mockDbState.dbError) return Promise.reject(mockDbState.dbError);
      return Promise.resolve();
    }),
  };

  const insertChain: any = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn(() => {
      mockDbState.insertCalled = true;
      if (mockDbState.dbError) return Promise.reject(mockDbState.dbError);
      return Promise.resolve();
    }),
    then: function (resolve: any, reject?: any) {
      mockDbState.insertCalled = true;
      if (mockDbState.dbError) {
        return reject ? reject(mockDbState.dbError) : Promise.reject(mockDbState.dbError);
      }
      return resolve(undefined);
    },
  };

  Object.defineProperty(insertChain, 'then', {
    value: insertChain.then,
    enumerable: false,
    writable: true,
  });

  const deleteChain: any = {
    where: vi.fn(() => {
      mockDbState.deleteCalled = true;
      if (mockDbState.dbError) return Promise.reject(mockDbState.dbError);
      return Promise.resolve();
    }),
  };

  return {
    select: vi.fn(() => selectChain),
    selectDistinct: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
    insert: vi.fn(() => insertChain),
    delete: vi.fn(() => deleteChain),
    _selectChain: selectChain,
    _updateChain: updateChain,
    _insertChain: insertChain,
    _deleteChain: deleteChain,
  };
}

let drizzleMock: ReturnType<typeof createDrizzleMock>;

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => drizzleMock),
}));

// ---------------------------------------------------------------------------
// Stub out logger, timestamp, and message helpers
// ---------------------------------------------------------------------------
vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000),
}));

vi.mock('@/core/error-handler', () => ({
  globalErrorHandler: {
    handleError: vi.fn((c: any, error: any) => {
      return c.json(
        { success: false, error: error?.message || 'Internal server error' },
        500
      );
    }),
  },
}));

vi.mock('../utils/message-helpers', () => ({
  getDisplayContent: vi.fn((content: string | null, _type: string | null) => content),
}));

// ---------------------------------------------------------------------------
// Import handler after all mocks are established
// ---------------------------------------------------------------------------
import conversationsMainHandler from '@/modules/conversations/handlers/index';
import type { Bindings } from '@/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockEnv() {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ success: true, results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
    },
    SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    JWT_SECRET: 'test-secret',
    R2_BUCKET: { put: vi.fn().mockResolvedValue(undefined) },
    MESSAGE_BROADCASTER: { get: vi.fn() },
  };
}

function createTestApp(env: ReturnType<typeof createMockEnv>) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    // Provide executionCtx mock for waitUntil
    // Hono's c.executionCtx is a getter that throws if not set,
    // so we must override via Object.defineProperty.
    Object.defineProperty(c, 'executionCtx', {
      get: () => ({ waitUntil: vi.fn() }),
      configurable: true,
    });
    c.env = env as any;
    await next();
  });
  app.route('/api/conversations', conversationsMainHandler);
  return app;
}

function makeRequest(
  app: ReturnType<typeof createTestApp>,
  path: string,
  options?: RequestInit
) {
  return app.request(path, options);
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Conversation Handlers Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    app = createTestApp(env);
    drizzleMock = createDrizzleMock();
    resetMockDbState();

    // Reset user/permission defaults
    currentUser = {
      id: 1,
      username: 'testadmin',
      displayName: 'Test Admin',
      role: 'admin',
      isActive: true,
      primaryTeamId: 1,
    };
    currentJwtPayload = {
      userId: '1',
      username: 'testadmin',
      role: 'admin',
      primaryTeamId: 1,
    };
    permissionCheckResult = true;
    visibleConversationIds = ['conv-001', 'conv-002', 'conv-003'];
  });

  // =========================================================================
  // GET /api/conversations — List conversations
  // =========================================================================

  describe('GET /api/conversations', () => {
    test('returns 200 with empty data when no visible conversations', async () => {
      visibleConversationIds = [];

      const res = await makeRequest(app, '/api/conversations');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    test('returns 200 with conversation list', async () => {
      visibleConversationIds = ['conv-001'];

      // Mock: drizzle select returns conversation + customer + team JOIN result
      const joinResult = {
        conversations: {
          id: 'conv-001',
          status: 'active',
          customerId: 'cust-001',
          assignedTeamId: 1,
          updatedAt: '2026-01-15T10:00:00Z',
          lastMessageAt: '2026-01-15T10:00:00Z',
        },
        customers: {
          id: 'cust-001',
          displayName: 'Alice',
          platform: 'line',
          platformUserId: 'U123',
          avatarUrl: null,
          createdAt: '2026-01-01T00:00:00Z',
        },
        teams: {
          id: 1,
          name: 'Support Team',
          description: 'Main support',
        },
      };
      resetMockDbState({ selectResults: [joinResult] });

      const res = await makeRequest(app, '/api/conversations');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('conv-001');
      expect(body.data[0].customer.displayName).toBe('Alice');
      expect(body.data[0].assignedTeam.name).toBe('Support Team');
    });

    test('returns 200 with empty data when tag filter yields no results', async () => {
      visibleConversationIds = ['conv-001'];
      // First call returns tag-filtered conversation IDs (empty)
      resetMockDbState({ selectResults: [] });

      const res = await makeRequest(app, '/api/conversations?tagIds=1,2');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  // =========================================================================
  // GET /api/conversations/:id — Single conversation detail
  // =========================================================================

  describe('GET /api/conversations/:id', () => {
    test('returns 200 with conversation detail', async () => {
      const joinResult = {
        conversations: {
          id: 'conv-001',
          status: 'active',
          customerId: 'cust-001',
          assignedTeamId: 1,
          updatedAt: '2026-01-15T10:00:00Z',
        },
        customers: {
          id: 'cust-001',
          displayName: 'Alice',
          platform: 'line',
          platformUserId: 'U123',
          avatarUrl: null,
          email: 'alice@test.com',
          phone: null,
          sourceTeamId: 1,
          metadata: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        teams: {
          id: 1,
          name: 'Support Team',
        },
      };
      resetMockDbState({ selectResults: [joinResult] });

      const res = await makeRequest(app, '/api/conversations/conv-001');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('conv-001');
      expect(body.data.customer.displayName).toBe('Alice');
      expect(body.data.customer.name).toBe('Alice'); // mapped name field
      expect(body.data.assignedTeam.name).toBe('Support Team');
    });

    test('returns 404 when conversation not found', async () => {
      resetMockDbState({ selectResults: [] });

      const res = await makeRequest(app, '/api/conversations/nonexistent');
      const body = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toContain('not found');
    });

    test('returns 403 when permission denied', async () => {
      permissionCheckResult = false;

      const res = await makeRequest(app, '/api/conversations/conv-001');
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error).toContain('Permission denied');
    });
  });

  // =========================================================================
  // POST /api/conversations/:id/assign
  // =========================================================================

  describe('POST /api/conversations/:id/assign', () => {
    test('returns 200 on successful team assignment', async () => {
      // Mock: update succeeds, then re-fetch returns updated conversation
      const updatedJoinResult = {
        conversations: {
          id: 'conv-001',
          status: 'assigned',
          assignedTeamId: 2,
          customerId: 'cust-001',
        },
        teams: {
          id: 2,
          name: 'Sales Team',
        },
        customers: {
          id: 'cust-001',
          displayName: 'Alice',
        },
      };
      resetMockDbState({ selectResults: [updatedJoinResult] });

      // Mock team name lookup via .get()
      drizzleMock._selectChain.get.mockResolvedValue({ name: 'Sales Team' });

      const res = await makeRequest(app, '/api/conversations/conv-001/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: 2, reason: 'Escalation' }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('assigned successfully');
      expect(body.data.assignedTeamId).toBe(2);
    });

    test('returns 400 when teamId is missing', async () => {
      const res = await makeRequest(app, '/api/conversations/conv-001/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(400);
      expect(body.error).toContain('Team ID is required');
    });

    test('returns 403 when permission denied', async () => {
      permissionCheckResult = false;

      const res = await makeRequest(app, '/api/conversations/conv-001/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: 2 }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error).toContain('Permission denied');
    });
  });

  // =========================================================================
  // POST /api/conversations/:id/unassign
  // =========================================================================

  describe('POST /api/conversations/:id/unassign', () => {
    test('returns 200 on successful unassignment', async () => {
      // First select: check conversation exists (with team join)
      const existingConv = {
        conversations: {
          id: 'conv-001',
          status: 'assigned',
          assignedTeamId: 2,
        },
        teams: {
          id: 2,
          name: 'Sales Team',
        },
      };
      // After unassign, re-fetch returns updated conversation
      const unassignedConv = {
        conversations: {
          id: 'conv-001',
          status: 'active',
          assignedTeamId: null,
        },
        teams: null,
        customers: {
          id: 'cust-001',
          displayName: 'Alice',
          platformUserId: 'U123',
          platform: 'line',
          avatarUrl: null,
          createdAt: '2026-01-01T00:00:00Z',
        },
      };

      // The handler calls select twice:
      // 1. Check conversation exists -> existingConv
      // 2. Re-fetch after update -> unassignedConv
      let selectCallCount = 0;
      const originalThen = drizzleMock._selectChain.then;
      drizzleMock._selectChain.then = function (resolve: any, reject?: any) {
        selectCallCount++;
        if (selectCallCount === 1) {
          return resolve([existingConv]);
        }
        return resolve([unassignedConv]);
      };

      const res = await makeRequest(app, '/api/conversations/conv-001/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'No longer needed' }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('unassigned successfully');
    });

    test('returns 404 when conversation does not exist', async () => {
      resetMockDbState({ selectResults: [] });

      const res = await makeRequest(app, '/api/conversations/nonexistent/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(body.error).toContain('not found');
    });

    test('returns 400 when conversation is not assigned', async () => {
      const notAssignedConv = {
        conversations: {
          id: 'conv-001',
          status: 'active',
          assignedTeamId: null,
        },
        teams: null,
      };
      resetMockDbState({ selectResults: [notAssignedConv] });

      const res = await makeRequest(app, '/api/conversations/conv-001/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(400);
      expect(body.error).toContain('not assigned');
    });

    test('returns 403 when permission denied', async () => {
      permissionCheckResult = false;

      const res = await makeRequest(app, '/api/conversations/conv-001/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error).toContain('Permission denied');
    });
  });

  // =========================================================================
  // POST /api/conversations/bulk
  // =========================================================================

  describe('POST /api/conversations/bulk', () => {
    test('returns 200 on successful bulk assign', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'assign',
          conversationIds: ['conv-001', 'conv-002'],
          data: { teamId: 2 },
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.affectedCount).toBe(2);
      expect(body.data.operation).toBe('assign');
    });

    test('returns 200 on successful bulk set_priority', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'set_priority',
          conversationIds: ['conv-001'],
          data: { priority: 'high' },
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.operation).toBe('set_priority');
    });

    test('returns 200 on successful bulk add_tags', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'add_tags',
          conversationIds: ['conv-001', 'conv-002'],
          data: { tagIds: [1, 2] },
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.operation).toBe('add_tags');
      expect(body.data.affectedCount).toBe(2);
    });

    test('returns 200 on successful bulk remove_tags', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'remove_tags',
          conversationIds: ['conv-001'],
          data: { tagIds: [1] },
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.operation).toBe('remove_tags');
    });

    test('returns validation error when conversationIds is empty', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'assign',
          conversationIds: [],
          data: { teamId: 2 },
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
    });

    test('returns validation error when conversationIds exceeds 100', async () => {
      const largeIds = Array.from({ length: 101 }, (_, i) => `conv-${i}`);
      // Make all 101 IDs "visible"
      visibleConversationIds = largeIds;

      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'assign',
          conversationIds: largeIds,
          data: { teamId: 2 },
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
    });

    test('returns validation error for invalid operation', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'invalid_op',
          conversationIds: ['conv-001'],
          data: {},
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
    });

    test('returns 403 when user lacks access to some conversations', async () => {
      // User can only see conv-001, not conv-999
      visibleConversationIds = ['conv-001'];

      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'assign',
          conversationIds: ['conv-001', 'conv-999'],
          data: { teamId: 2 },
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Permission denied');
    });

    test('returns validation error for close/reopen operations (deprecated)', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'close',
          conversationIds: ['conv-001'],
          data: {},
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
    });

    test('returns validation error for assign without teamId', async () => {
      const res = await makeRequest(app, '/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'assign',
          conversationIds: ['conv-001'],
          data: {},
        }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/conversations/:id/tags
  // =========================================================================

  describe('GET /api/conversations/:id/tags', () => {
    test('returns 200 with tag list for a conversation', async () => {
      // First call: check conversation exists via .get()
      drizzleMock._selectChain.get.mockResolvedValueOnce({ id: 'conv-001' });

      // Second call: get tags (thenable)
      const tagResults = [
        {
          tagId: 1,
          assignedBy: 'admin-001',
          assignedAt: '2026-01-10T00:00:00Z',
          tagName: 'VIP',
          tagColor: '#FF0000',
          tagDescription: 'VIP customers',
        },
        {
          tagId: 2,
          assignedBy: 'admin-001',
          assignedAt: '2026-01-11T00:00:00Z',
          tagName: 'Priority',
          tagColor: '#00FF00',
          tagDescription: 'High priority',
        },
      ];

      let selectCallCount = 0;
      drizzleMock._selectChain.get.mockImplementation(() => {
        // .get() is only used for the first call (conversation existence check)
        return Promise.resolve({ id: 'conv-001' });
      });

      // Override then for the tag list query
      const origThen = drizzleMock._selectChain.then;
      drizzleMock._selectChain.then = function (resolve: any) {
        selectCallCount++;
        return resolve(tagResults);
      };

      const res = await makeRequest(app, '/api/conversations/conv-001/tags');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe('VIP');
      expect(body.data[0].color).toBe('#FF0000');
      expect(body.data[1].name).toBe('Priority');
    });

    test('returns 404 when conversation does not exist', async () => {
      drizzleMock._selectChain.get.mockResolvedValue(null);

      const res = await makeRequest(app, '/api/conversations/nonexistent/tags');
      const body = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toContain('not found');
    });
  });

  // =========================================================================
  // POST /api/conversations/:id/tags
  // =========================================================================

  describe('POST /api/conversations/:id/tags', () => {
    test('returns 200 on successful tag addition', async () => {
      // Conversation existence check
      drizzleMock._selectChain.get.mockResolvedValue({ id: 'conv-001' });

      const res = await makeRequest(app, '/api/conversations/conv-001/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [1, 2, 3] }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Tags added');
    });

    test('returns 404 when conversation does not exist', async () => {
      drizzleMock._selectChain.get.mockResolvedValue(null);

      const res = await makeRequest(app, '/api/conversations/nonexistent/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [1] }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
    });

    test('returns 422 when tagIds is empty', async () => {
      const res = await makeRequest(app, '/api/conversations/conv-001/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [] }),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
    });

    test('returns 422 when tagIds is missing', async () => {
      const res = await makeRequest(app, '/api/conversations/conv-001/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/conversations/:id/messages
  // =========================================================================

  describe('GET /api/conversations/:id/messages', () => {
    test('returns 200 with paginated messages', async () => {
      // Conversation existence check
      drizzleMock._selectChain.get
        .mockResolvedValueOnce({ id: 'conv-001' }) // conversation exists
        .mockResolvedValueOnce({ count: 2 }); // total count

      const messageRows = [
        {
          id: 'msg-001',
          conversationId: 'conv-001',
          senderType: 'agent',
          customerSenderId: null,
          agentSenderId: '1',
          content: 'Hello there!',
          messageType: 'text',
          platformMessageId: null,
          isSent: true,
          deliveryStatus: 'delivered',
          metadata: null,
          sentAt: '2026-01-15T10:00:00Z',
          recallDeadline: null,
          recalledAt: null,
          isRecalled: false,
          createdAt: '2026-01-15T10:00:00Z',
          customerName: null,
          agentName: 'Test Admin',
        },
        {
          id: 'msg-002',
          conversationId: 'conv-001',
          senderType: 'customer',
          customerSenderId: 'cust-001',
          agentSenderId: null,
          content: 'Hi!',
          messageType: 'text',
          platformMessageId: 'line-msg-123',
          isSent: true,
          deliveryStatus: 'delivered',
          metadata: null,
          sentAt: '2026-01-15T09:55:00Z',
          recallDeadline: null,
          recalledAt: null,
          isRecalled: false,
          createdAt: '2026-01-15T09:55:00Z',
          customerName: 'Alice',
          agentName: null,
        },
      ];
      resetMockDbState({ selectResults: messageRows });

      const res = await makeRequest(app, '/api/conversations/conv-001/messages?page=1&pageSize=30');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(30);
      // Agent message sender type stays 'agent'
      expect(body.data.items[0].senderType).toBe('agent');
      expect(body.data.items[0].senderName).toBe('Test Admin');
      // Customer message sender type is mapped to 'user'
      expect(body.data.items[1].senderType).toBe('user');
      expect(body.data.items[1].senderName).toBe('Alice');
    });

    test('returns 404 when conversation does not exist', async () => {
      drizzleMock._selectChain.get.mockResolvedValue(null);

      const res = await makeRequest(app, '/api/conversations/nonexistent/messages');
      const body = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toContain('not found');
    });

    test('returns 403 when permission denied', async () => {
      permissionCheckResult = false;

      const res = await makeRequest(app, '/api/conversations/conv-001/messages');
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });

    test('clamps pageSize to max 100', async () => {
      drizzleMock._selectChain.get
        .mockResolvedValueOnce({ id: 'conv-001' })
        .mockResolvedValueOnce({ count: 0 });
      resetMockDbState({ selectResults: [] });

      const res = await makeRequest(app, '/api/conversations/conv-001/messages?pageSize=999');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.data.pageSize).toBe(100);
    });

    test('handles invalid page param gracefully (NaN serialized as null)', async () => {
      // Note: parseInt('abc') = NaN, Math.max(1, NaN) = NaN in JS.
      // NaN is serialized as null in JSON. This tests current handler behavior.
      drizzleMock._selectChain.get
        .mockResolvedValueOnce({ id: 'conv-001' })
        .mockResolvedValueOnce({ count: 0 });
      resetMockDbState({ selectResults: [] });

      const res = await makeRequest(app, '/api/conversations/conv-001/messages?page=abc');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // page is NaN in JS which becomes null in JSON
      expect(body.data.page).toBeNull();
    });
  });

  // =========================================================================
  // Unread count in conversation list response
  // =========================================================================

  describe('GET /api/conversations — unreadCount', () => {
    test('should include unreadCount in response when unread messages exist', async () => {
      resetMockDbState({
        selectResults: [
          {
            conversations: {
              id: 'conv-001',
              customerId: 1,
              assignedTeamId: null,
              status: 'active',
              priority: null,
              firstResponseAt: null,
              closedAt: null,
              lastMessageAt: '2026-01-01T00:00:00Z',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
              deletedAt: null,
            },
            customers: {
              id: 1,
              displayName: 'Test Customer',
              platform: 'line',
              platformUserId: 'U123',
              avatarUrl: null,
              createdAt: '2026-01-01T00:00:00Z',
            },
            teams: null,
          },
        ],
      });

      // Mock DB.prepare to return lastMessage + unread counts
      const mockAll = vi.fn()
        .mockResolvedValueOnce({ success: true, results: [
          { messageId: 'msg-1', conversationId: 'conv-001', content: 'Hello', createdAt: '2026-01-01T00:00:00Z', senderType: 'customer', messageType: 'text' }
        ] })  // latestMessages query
        .mockResolvedValueOnce({ success: true, results: [
          { conversationId: 'conv-001', unreadCount: 3 }
        ] });  // unreadCount query

      env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: mockAll,
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const res = await makeRequest(app, '/api/conversations');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data[0].unreadCount).toBe(3);
    });

    test('should return unreadCount 0 when no unread messages', async () => {
      resetMockDbState({
        selectResults: [
          {
            conversations: {
              id: 'conv-001',
              customerId: 1,
              assignedTeamId: null,
              status: 'active',
              priority: null,
              firstResponseAt: null,
              closedAt: null,
              lastMessageAt: '2026-01-01T00:00:00Z',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
              deletedAt: null,
            },
            customers: {
              id: 1,
              displayName: 'Test Customer',
              platform: 'line',
              platformUserId: 'U123',
              avatarUrl: null,
              createdAt: '2026-01-01T00:00:00Z',
            },
            teams: null,
          },
        ],
      });

      // Mock: last message from agent, no unread
      const mockAll = vi.fn()
        .mockResolvedValueOnce({ success: true, results: [
          { messageId: 'msg-1', conversationId: 'conv-001', content: 'Agent reply', createdAt: '2026-01-01T01:00:00Z', senderType: 'agent', messageType: 'text' }
        ] })
        .mockResolvedValueOnce({ success: true, results: [] });  // empty = no unread

      env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: mockAll,
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const res = await makeRequest(app, '/api/conversations');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.data[0].unreadCount).toBe(0);
    });
  });

  // =========================================================================
  // Regression: D1 100-bound-parameter limit on the latest-messages query
  // =========================================================================
  //
  // Incident (2026-04-14): all conversations in the list view showed
  // "暫無訊息" because the latest-messages SQL bound conversationIds twice
  // (inner subquery + outer WHERE). At 52 conversations that is 104 bindings,
  // one over D1's hard cap of 100 per query. D1 threw, the catch swallowed
  // the error silently, and every conversation ended up with lastMessage=null.
  //
  // These tests lock in three properties that, together, prevent regression:
  //   1. bind() is never called with more than 100 parameters
  //   2. the handler produces lastMessage for every conversation end-to-end,
  //      even when conversation count exceeds the chunk threshold
  //   3. when the latest-messages query is split into chunks, each chunk
  //      stays within the D1 parameter budget

  describe('GET /api/conversations — D1 parameter limit regression', () => {
    // A fake D1-like prepare()/bind() mock that:
    //   * records every prepare SQL and its bind args
    //   * simulates D1's real 100-parameter rejection (throws if exceeded)
    //   * returns a synthetic latest-message row for each conversation id it sees
    // This gives us end-to-end behaviour matching production without a real DB.
    function installD1Mock(env: ReturnType<typeof createMockEnv>) {
      const prepared: Array<{ sql: string; bindArgs: any[] }> = [];

      env.DB.prepare = vi.fn((sql: string) => {
        const record: { sql: string; bindArgs: any[] } = { sql, bindArgs: [] };
        prepared.push(record);

        return {
          bind: vi.fn((...args: any[]) => {
            record.bindArgs = args;

            // Simulate D1's hard limit so buggy code surfaces the failure
            // instead of silently succeeding in the unit test.
            if (args.length > 100) {
              const err = new Error(
                `D1_ERROR: too many SQL variables (got ${args.length}, max 100)`
              );
              return {
                first: vi.fn().mockRejectedValue(err),
                all: vi.fn().mockRejectedValue(err),
                run: vi.fn().mockRejectedValue(err),
              };
            }

            // Route responses by SQL content
            const isLatestMessages =
              sql.includes('MAX(created_at)') && sql.includes('GROUP BY conversation_id');
            const isUnreadCount =
              sql.includes('unreadCount') && sql.includes('sender_type');

            if (isLatestMessages) {
              // Dedupe ids — in the fixed code bind receives N ids,
              // in the buggy code it receives 2N (duplicated).
              const uniqueIds = Array.from(new Set(args));
              return {
                first: vi.fn().mockResolvedValue(null),
                all: vi.fn().mockResolvedValue({
                  success: true,
                  results: uniqueIds.map((id) => ({
                    messageId: `msg-${id}`,
                    conversationId: id,
                    content: `Hello from ${id}`,
                    createdAt: '2026-01-01T00:00:00Z',
                    senderType: 'customer',
                    messageType: 'text',
                  })),
                }),
                run: vi.fn(),
              };
            }

            if (isUnreadCount) {
              return {
                first: vi.fn().mockResolvedValue(null),
                all: vi.fn().mockResolvedValue({ success: true, results: [] }),
                run: vi.fn(),
              };
            }

            // Fallback (e.g. the debug single-row lookup)
            return {
              first: vi.fn().mockResolvedValue(null),
              all: vi.fn().mockResolvedValue({ success: true, results: [] }),
              run: vi.fn(),
            };
          }),
        } as any;
      }) as any;

      return prepared;
    }

    // Build N fake joined conversation rows that Drizzle's select() will return.
    function seedConversations(n: number) {
      const ids = Array.from({ length: n }, (_, i) =>
        `conv-${i.toString().padStart(4, '0')}`
      );
      visibleConversationIds = [...ids];
      resetMockDbState({
        selectResults: ids.map((id) => ({
          conversations: {
            id,
            customerId: 1,
            assignedTeamId: null,
            status: 'active',
            priority: null,
            firstResponseAt: null,
            closedAt: null,
            lastMessageAt: '2026-01-01T00:00:00Z',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            deletedAt: null,
          },
          customers: {
            id: 1,
            displayName: `Customer ${id}`,
            platform: 'line',
            platformUserId: `U-${id}`,
            avatarUrl: null,
            createdAt: '2026-01-01T00:00:00Z',
          },
          teams: null,
        })),
      });
      return ids;
    }

    test('bind() is never called with more than 100 parameters (52 conversations)', async () => {
      seedConversations(52);
      const prepared = installD1Mock(env);

      const res = await makeRequest(app, '/api/conversations');
      expect(res.status).toBe(200);

      // Must have attempted the latest-messages query at least once
      const latestMsgCalls = prepared.filter(
        (p) =>
          p.sql.includes('MAX(created_at)') && p.sql.includes('GROUP BY conversation_id')
      );
      expect(latestMsgCalls.length).toBeGreaterThanOrEqual(1);

      // Every prepared bind stays under the D1 100-param limit
      for (const call of prepared) {
        expect(call.bindArgs.length).toBeLessThanOrEqual(100);
      }
    });

    test('populates lastMessage for every conversation (52 conversations, end-to-end)', async () => {
      const ids = seedConversations(52);
      installD1Mock(env);

      const res = await makeRequest(app, '/api/conversations');
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(52);

      // Every conversation must carry the synthetic last-message content.
      // With the 104-parameter bug this collapses to "暫無訊息" in the UI
      // because lastMessageContent is null.
      for (const conv of body.data) {
        expect(conv.lastMessageContent).toBeTruthy();
        expect(conv.lastMessage).not.toBeNull();
        expect(conv.lastMessage.content).toContain('Hello from conv-');
      }
      expect(body.data.map((c: any) => c.id).sort()).toEqual([...ids].sort());
    });

    test('chunks the latest-messages query when visible conversations exceed CHUNK_SIZE', async () => {
      // 150 > CHUNK_SIZE (90) — must produce at least 2 prepared queries
      // and every chunk must still respect the 100-param budget.
      seedConversations(150);
      const prepared = installD1Mock(env);

      const res = await makeRequest(app, '/api/conversations');
      expect(res.status).toBe(200);

      const latestMsgCalls = prepared.filter(
        (p) =>
          p.sql.includes('MAX(created_at)') && p.sql.includes('GROUP BY conversation_id')
      );
      expect(latestMsgCalls.length).toBeGreaterThanOrEqual(2);

      for (const call of latestMsgCalls) {
        expect(call.bindArgs.length).toBeLessThanOrEqual(100);
      }

      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(150);
      for (const conv of body.data) {
        expect(conv.lastMessageContent).toBeTruthy();
      }
    });
  });

  // =========================================================================
  // Health check endpoint (no auth needed)
  // =========================================================================

  describe('GET /api/conversations/health', () => {
    test('returns healthy status', async () => {
      const res = await makeRequest(app, '/api/conversations/health');
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.module).toBe('conversations');
    });
  });
});
