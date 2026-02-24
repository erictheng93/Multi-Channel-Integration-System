/**
 * Tag Service Handler — Integration Tests
 *
 * Tests HTTP-level behavior of the tag-main.ts handler endpoints:
 *
 * CRUD:
 *   GET    /api/tags           — list tags (pagination, search)
 *   POST   /api/tags           — create tag (validation, duplicate check)
 *   GET    /api/tags/:id       — get tag details
 *   PUT    /api/tags/:id       — update tag (partial, duplicate name check)
 *   DELETE /api/tags/:id       — soft-delete tag
 *
 * Specialized:
 *   POST   /api/tags/bulk      — bulk activate/deactivate/update_color
 *   GET    /api/tags/:id/stats — usage statistics
 *   GET    /api/tags/:id/customers — customer list for tag
 *
 * Mock strategy:
 *   - vi.mock('@/middleware/auth') — bypasses JWT for all tests
 *   - vi.mock('@/db/drizzle-factory') — operation-aware Drizzle mock with call counter
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Configurable JWT payload
// ---------------------------------------------------------------------------
let currentPayload = {
  userId: 'admin-001',
  username: 'testadmin',
  role: 'admin' as string,
  teamId: 1,
};

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((_c: any, next: any) => {
    _c.set('jwtPayload', { ...currentPayload });
    return next();
  }),
  requireRole: vi.fn(() => (_c: any, next: any) => next()),
}));

// ---------------------------------------------------------------------------
// Mock state — reset before each test
// ---------------------------------------------------------------------------

interface MockState {
  /** Sequential results for drizzleDb.get() calls */
  getResults: Array<Record<string, unknown> | null>;
  /** Sequential results for drizzleDb.all() calls */
  allResults: Array<Array<Record<string, unknown>>>;
  /** Result for drizzleDb.insert().values().returning() */
  insertResult: Array<Record<string, unknown>>;
  /** Result for drizzleDb.select().from().where().limit() (duplicate checks) */
  selectResult: Array<Record<string, unknown>>;
  /** If set, all DB calls throw this error */
  dbError: Error | null;
}

let mockState: MockState;

function resetMockState(overrides: Partial<MockState> = {}) {
  mockState = {
    getResults: [],
    allResults: [],
    insertResult: [],
    selectResult: [],
    dbError: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Operation-aware Drizzle mock — created per-test via factory
// ---------------------------------------------------------------------------

function createDrizzleMock() {
  let getCallIndex = 0;
  let allCallIndex = 0;

  const chainable = () => ({
    from: () => ({
      where: () => ({
        limit: () => {
          if (mockState.dbError) return Promise.reject(mockState.dbError);
          return Promise.resolve(mockState.selectResult);
        },
      }),
    }),
    values: () => ({
      returning: () => {
        if (mockState.dbError) return Promise.reject(mockState.dbError);
        return Promise.resolve(mockState.insertResult);
      },
    }),
    set: () => ({
      where: () => {
        if (mockState.dbError) return Promise.reject(mockState.dbError);
        return Promise.resolve();
      },
    }),
  });

  return {
    get: vi.fn((): any => {
      if (mockState.dbError) return Promise.reject(mockState.dbError);
      const result = mockState.getResults[getCallIndex] ?? null;
      getCallIndex++;
      return Promise.resolve(result);
    }),
    all: vi.fn((): any => {
      if (mockState.dbError) return Promise.reject(mockState.dbError);
      const result = mockState.allResults[allCallIndex] ?? [];
      allCallIndex++;
      return Promise.resolve(result);
    }),
    run: vi.fn((): any => {
      if (mockState.dbError) return Promise.reject(mockState.dbError);
      return Promise.resolve();
    }),
    insert: vi.fn(() => chainable()),
    select: vi.fn(() => chainable()),
    update: vi.fn(() => chainable()),
    delete: vi.fn(() => chainable()),
  };
}

let drizzleMock: ReturnType<typeof createDrizzleMock>;

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => drizzleMock),
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks are registered
// ---------------------------------------------------------------------------

import tagMainHandler from '@/modules/tags/handlers/tag-main';
import type { Bindings } from '@/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockEnv() {
  return {
    DB: { prepare: vi.fn() },
    SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    JWT_SECRET: 'test-secret',
  };
}

function createTestApp(env: ReturnType<typeof createMockEnv>) {
  const app = new Hono<{ Bindings: Bindings }>();
  // Inject mock env bindings so c.env.DB is available
  app.use('*', async (c, next) => {
    c.env = env as any;
    await next();
  });
  app.route('/api/tags', tagMainHandler);
  return app;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Tag Service Handler', () => {
  let app: ReturnType<typeof createTestApp>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    app = createTestApp(env);
    drizzleMock = createDrizzleMock();
    resetMockState();
  });

  // =========================================================================
  // Health check
  // =========================================================================

  describe('GET /health', () => {
    test('returns healthy status', async () => {
      const res = await app.request('/api/tags/health');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.handler).toBe('tag-main');
    });
  });

  // =========================================================================
  // GET / — list tags
  // =========================================================================

  describe('GET / — list tags', () => {
    test('returns paginated tag list', async () => {
      resetMockState({
        allResults: [[
          { id: 1, name: 'VIP', color: '#FF0000', description: null, team_id: null, is_active: 1, created_by: 'admin', created_at: '2026-01-01', updated_at: '2026-01-01', customer_count: 3, conversation_count: 2 },
          { id: 2, name: 'Premium', color: '#00FF00', description: 'High tier', team_id: null, is_active: 1, created_by: 'admin', created_at: '2026-01-02', updated_at: '2026-01-02', customer_count: 0, conversation_count: 0 },
        ]],
        getResults: [{ total: 2 }],
      });

      const res = await app.request('/api/tags');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      // paginatedResponse wraps data as { items, page, pageSize, total, totalPages, ... }
      expect(json.data.items).toHaveLength(2);
      expect(json.data.items[0].name).toBe('VIP');
      expect(json.data.items[0].customerCount).toBe(3);
      expect(json.data.items[0].conversationCount).toBe(2);
      expect(json.data.items[1].name).toBe('Premium');
    });

    test('maps isActive as boolean from integer', async () => {
      resetMockState({
        allResults: [[
          { id: 1, name: 'Active', color: '#CCC', description: null, team_id: null, is_active: 1, created_by: 'admin', created_at: '2026-01-01', updated_at: '2026-01-01', customer_count: 0, conversation_count: 0 },
        ]],
        getResults: [{ total: 1 }],
      });

      const res = await app.request('/api/tags');
      const json = await res.json() as any;
      expect(json.data.items[0].isActive).toBe(true);
    });

    test('returns empty list when no tags exist', async () => {
      resetMockState({
        allResults: [[]],
        getResults: [{ total: 0 }],
      });

      const res = await app.request('/api/tags');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.items).toHaveLength(0);
    });

    test('handles database errors gracefully', async () => {
      resetMockState({ dbError: new Error('DB connection failed') });

      const res = await app.request('/api/tags');
      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST / — create tag
  // =========================================================================

  describe('POST / — create tag', () => {
    test('creates a tag successfully', async () => {
      resetMockState({
        selectResult: [], // no duplicate
        insertResult: [{
          id: 10, name: 'New Tag', color: '#3B82F6', description: null,
          teamId: null, isActive: true, createdBy: 'admin-001',
          createdAt: '2026-01-10', updatedAt: '2026-01-10',
        }],
      });

      const res = await app.request('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Tag' }),
      });
      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('New Tag');
      expect(json.data.color).toBe('#3B82F6');
      expect(json.data.customerCount).toBe(0);
      expect(json.data.conversationCount).toBe(0);
    });

    test('rejects empty tag name', async () => {
      const res = await app.request('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing tag name', async () => {
      const res = await app.request('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    test('rejects invalid color format', async () => {
      const res = await app.request('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', color: 'red' }),
      });
      expect(res.status).toBe(422);
    });

    test('rejects duplicate tag name with 409', async () => {
      resetMockState({
        selectResult: [{ id: 1 }], // existing tag found
      });

      const res = await app.request('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Existing' }),
      });
      expect(res.status).toBe(409);
    });

    test('accepts valid hex color #RGB (3-digit)', async () => {
      resetMockState({
        selectResult: [],
        insertResult: [{
          id: 11, name: 'ColorTest', color: '#FF5533', description: null,
          teamId: null, isActive: true, createdBy: 'admin-001',
          createdAt: '2026-01-10', updatedAt: '2026-01-10',
        }],
      });

      const res = await app.request('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'ColorTest', color: '#F53' }),
      });
      expect(res.status).toBe(201);
    });

    test('handles invalid JSON with 400', async () => {
      const res = await app.request('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      });
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GET /:id — get tag details
  // =========================================================================

  describe('GET /:id — get tag details', () => {
    test('returns tag details with counts', async () => {
      resetMockState({
        getResults: [{
          id: 1, name: 'VIP', color: '#FF0000', description: 'Top tier',
          team_id: null, team_name: null, is_active: 1,
          created_by: 'admin', created_by_name: 'Admin User',
          customer_count: 5, conversation_count: 3,
          created_at: '2026-01-01', updated_at: '2026-01-15',
        }],
      });

      const res = await app.request('/api/tags/1');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.name).toBe('VIP');
      expect(json.data.customerCount).toBe(5);
      expect(json.data.conversationCount).toBe(3);
      expect(json.data.createdByName).toBe('Admin User');
      expect(json.data.isActive).toBe(true);
    });

    test('returns 404 when tag not found', async () => {
      resetMockState({
        getResults: [null],
      });

      const res = await app.request('/api/tags/999');
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // PUT /:id — update tag
  // =========================================================================

  describe('PUT /:id — update tag', () => {
    test('updates tag successfully', async () => {
      resetMockState({
        getResults: [
          // 1st get: existingTag check
          { id: 1, name: 'OldName', color: '#FF0000', is_active: 1 },
          // 3rd get (after run): updatedTag with counts
          { id: 1, name: 'NewName', color: '#00FF00', description: null, team_id: null, is_active: 1, created_by: 'admin', customer_count: 2, conversation_count: 1, created_at: '2026-01-01', updated_at: '2026-01-15' },
        ],
        selectResult: [], // no duplicate name
      });

      const res = await app.request('/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'NewName', color: '#00FF00' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.name).toBe('NewName');
    });

    test('returns 404 when tag not found', async () => {
      resetMockState({
        getResults: [null],
      });

      const res = await app.request('/api/tags/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      });
      expect(res.status).toBe(404);
    });

    test('rejects invalid color format', async () => {
      resetMockState({
        getResults: [{ id: 1, name: 'Test', color: '#FF0000', is_active: 1 }],
      });

      const res = await app.request('/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: 'not-a-color' }),
      });
      expect(res.status).toBe(422);
    });

    test('rejects duplicate tag name with 422', async () => {
      resetMockState({
        getResults: [{ id: 1, name: 'OldName', color: '#FF0000', is_active: 1 }],
        selectResult: [{ id: 2 }], // another tag has this name
      });

      const res = await app.request('/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Taken' }),
      });
      expect(res.status).toBe(422);
    });
  });

  // =========================================================================
  // DELETE /:id — soft delete tag
  // =========================================================================

  describe('DELETE /:id — soft delete', () => {
    test('soft deletes a tag successfully', async () => {
      resetMockState({
        getResults: [{ id: 1, name: 'ToDelete', is_active: 1 }],
      });

      const res = await app.request('/api/tags/1', { method: 'DELETE' });
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
    });

    test('returns 404 when tag not found', async () => {
      resetMockState({
        getResults: [null],
      });

      const res = await app.request('/api/tags/999', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // POST /bulk — bulk operations
  // =========================================================================

  describe('POST /bulk — bulk operations', () => {
    function bulkReq(body: unknown) {
      return app.request('/api/tags/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    test('activates tags in bulk', async () => {
      const res = await bulkReq({ operation: 'activate', tagIds: [1, 2, 3] });
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.message).toContain('activate');
    });

    test('deactivates tags in bulk', async () => {
      const res = await bulkReq({ operation: 'deactivate', tagIds: [1, 2] });
      expect(res.status).toBe(200);
    });

    test('updates color in bulk', async () => {
      const res = await bulkReq({ operation: 'update_color', tagIds: [1], data: { color: '#00FF00' } });
      expect(res.status).toBe(200);
    });

    test('rejects update_color without color data', async () => {
      const res = await bulkReq({ operation: 'update_color', tagIds: [1] });
      expect(res.status).toBe(422);
    });

    test('rejects empty tagIds array', async () => {
      const res = await bulkReq({ operation: 'activate', tagIds: [] });
      expect(res.status).toBe(422);
    });

    test('rejects missing tagIds', async () => {
      const res = await bulkReq({ operation: 'activate' });
      expect(res.status).toBe(422);
    });

    test('rejects invalid operation type', async () => {
      const res = await bulkReq({ operation: 'invalid_op', tagIds: [1] });
      expect(res.status).toBe(422);
    });

    test('rejects non-numeric tag IDs', async () => {
      const res = await bulkReq({ operation: 'activate', tagIds: [1, 'abc', 3] });
      expect(res.status).toBe(400);
    });

    test('handles invalid JSON with 400', async () => {
      const res = await app.request('/api/tags/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ broken json',
      });
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GET /:id/stats — usage statistics
  // =========================================================================

  describe('GET /:id/stats — usage statistics', () => {
    test('returns complete usage statistics', async () => {
      resetMockState({
        getResults: [
          // 1st: tag exists
          { id: 1, name: 'VIP', color: '#FF0000', is_active: 1 },
          // 2nd: customer stats
          { total_customers: 10, line_customers: 7, facebook_customers: 3 },
          // 3rd: conversation stats
          { total_conversations: 5, active_conversations: 3, closed_conversations: 2 },
        ],
        allResults: [
          // 1st: usage trend
          [{ date: '2026-01-15', assignments: 3 }, { date: '2026-01-14', assignments: 1 }],
          // 2nd: top assigners
          [{ display_name: 'Agent A', assignments: 5 }],
        ],
      });

      const res = await app.request('/api/tags/1/stats');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.tagInfo.name).toBe('VIP');
      expect(json.data.customers.total).toBe(10);
      expect(json.data.customers.byPlatform.line).toBe(7);
      expect(json.data.customers.byPlatform.facebook).toBe(3);
      expect(json.data.conversations.total).toBe(5);
      expect(json.data.conversations.active).toBe(3);
      expect(json.data.conversations.closed).toBe(2);
      expect(json.data.usageTrend).toHaveLength(2);
      expect(json.data.topAssigners).toHaveLength(1);
      expect(json.data.topAssigners[0].name).toBe('Agent A');
    });

    test('returns 404 when tag not found', async () => {
      resetMockState({
        getResults: [null],
      });

      const res = await app.request('/api/tags/999/stats');
      expect(res.status).toBe(404);
    });

    test('returns zero stats when tag has no usage', async () => {
      resetMockState({
        getResults: [
          { id: 1, name: 'Empty', color: '#CCC', is_active: 1 },
          { total_customers: 0, line_customers: 0, facebook_customers: 0 },
          { total_conversations: 0, active_conversations: 0, closed_conversations: 0 },
        ],
        allResults: [[], []],
      });

      const res = await app.request('/api/tags/1/stats');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.customers.total).toBe(0);
      expect(json.data.conversations.total).toBe(0);
      expect(json.data.usageTrend).toHaveLength(0);
      expect(json.data.topAssigners).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET /:id/customers — tag customers
  // =========================================================================

  describe('GET /:id/customers — tag customers', () => {
    test('returns paginated customer list', async () => {
      resetMockState({
        getResults: [
          // 1st: tag exists
          { id: 1, name: 'VIP', deleted_at: null },
          // 2nd: count
          { total: 2 },
        ],
        allResults: [[
          { id: 'cust-1', platform: 'line', display_name: 'Alice', avatar_url: null, assigned_at: '2026-01-10' },
          { id: 'cust-2', platform: 'facebook', display_name: 'Bob', avatar_url: null, assigned_at: '2026-01-11' },
        ]],
      });

      const res = await app.request('/api/tags/1/customers');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.customers).toHaveLength(2);
      expect(json.data.pagination.total).toBe(2);
    });

    test('returns 404 when tag not found', async () => {
      resetMockState({
        getResults: [null],
      });

      const res = await app.request('/api/tags/999/customers');
      expect(res.status).toBe(404);
    });

    test('returns empty list when tag has no customers', async () => {
      resetMockState({
        getResults: [
          { id: 1, name: 'NoCustomers', deleted_at: null },
          { total: 0 },
        ],
        allResults: [[]],
      });

      const res = await app.request('/api/tags/1/customers');
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.customers).toHaveLength(0);
      expect(json.data.pagination.total).toBe(0);
      expect(json.data.pagination.totalPages).toBe(0);
    });
  });
});
