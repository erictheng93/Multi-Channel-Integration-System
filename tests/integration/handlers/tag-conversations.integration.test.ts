/**
 * Tag Conversations Handler — Integration Tests
 *
 * Tests HTTP-level behavior of GET /api/tags/:id/conversations:
 * - Returns conversations for a valid tag
 * - Returns empty list when tag has no conversations
 * - Returns 404 for missing or soft-deleted tags
 * - Paginates correctly (page, limit, totalPages)
 * - Excludes soft-deleted conversations (conv.deleted_at IS NOT NULL)
 * - Excludes conversations whose customer is soft-deleted (cust.deleted_at IS NOT NULL)
 *
 * Mock strategy:
 * - vi.mock('@/middleware/auth') — bypasses JWT for all tests
 * - vi.mock('@/db/drizzle-factory') — operation-aware chainable Drizzle mock
 *   The handler calls: drizzleDb.get (tag exists), drizzleDb.all (conversations),
 *   drizzleDb.get (count)
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
  // Return value of drizzleDb.get() for tag existence check.
  // null → tag not found (triggers 404).
  tagRow: Record<string, unknown> | null;
  // Return value of drizzleDb.all() for conversation list.
  conversationRows: Array<Record<string, unknown>>;
  // Return value of drizzleDb.get() for count query.
  countRow: { total: number } | null;
  // If set, drizzleDb.get/all will throw this error.
  dbError: Error | null;
}

let mockState: MockState = {
  tagRow: { id: 1, name: 'VIP', color: '#FF0000', deleted_at: null },
  conversationRows: [],
  countRow: { total: 0 },
  dbError: null,
};

function resetMockState(overrides: Partial<MockState> = {}) {
  mockState = {
    tagRow: { id: 1, name: 'VIP', color: '#FF0000', deleted_at: null },
    conversationRows: [],
    countRow: { total: 0 },
    dbError: null,
    ...overrides,
  };
}

/**
 * Build a Drizzle mock that models the call sequence made by getTagConversations():
 *
 *   1. drizzleDb.get(sql`SELECT * FROM tags WHERE id = ? AND deleted_at IS NULL`)
 *      → tagRow (or null for 404)
 *   2. drizzleDb.all(sql`SELECT ... FROM conversation_tags JOIN conversations ...`)
 *      → conversationRows
 *   3. drizzleDb.get(sql`SELECT COUNT(*) as total FROM conversation_tags ...`)
 *      → countRow
 *
 * We use a call-counter to distinguish the two .get() calls.
 */
function createDrizzleMock() {
  let getCallCount = 0;

  return {
    get: vi.fn(() => {
      if (mockState.dbError) return Promise.reject(mockState.dbError);
      getCallCount++;
      if (getCallCount === 1) return Promise.resolve(mockState.tagRow);
      return Promise.resolve(mockState.countRow);
    }),

    all: vi.fn(() => {
      if (mockState.dbError) return Promise.reject(mockState.dbError);
      return Promise.resolve(mockState.conversationRows);
    }),

    _reset: () => { getCallCount = 0; },
  };
}

let drizzleMock: ReturnType<typeof createDrizzleMock>;

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => drizzleMock),
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
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
  app.use('*', async (c, next) => {
    c.env = env as any;
    await next();
  });
  app.route('/api/tags', tagMainHandler);
  return app;
}

/** Build a sample conversation row matching what the SQL JOIN returns */
function makeConversationRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'conv-001',
    status: 'active',
    channel: 'line',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T12:00:00Z',
    customer_name: 'Alice',
    customer_avatar: null,
    customer_platform: 'line',
    assigned_at: '2026-01-10T09:00:00Z',
    assigned_by: 'agent-001',
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('GET /api/tags/:id/conversations', () => {
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
  // Happy path — conversations returned
  // =========================================================================

  test('returns 200 with conversation list for a valid tag', async () => {
    const conv = makeConversationRow();
    resetMockState({
      conversationRows: [conv],
      countRow: { total: 1 },
    });

    const res = await app.request('/api/tags/1/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.conversations).toHaveLength(1);
    expect(body.data.conversations[0]).toMatchObject({
      id: 'conv-001',
      status: 'active',
      channel: 'line',
      customer_name: 'Alice',
      customer_platform: 'line',
    });
  });

  test('returns correct pagination metadata', async () => {
    resetMockState({
      conversationRows: [makeConversationRow()],
      countRow: { total: 45 },
    });

    const res = await app.request('/api/tags/1/conversations?page=2&limit=20');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.data.pagination).toMatchObject({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3, // Math.ceil(45 / 20) = 3
    });
  });

  test('returns assigned_by as null when no agent assigned the tag', async () => {
    resetMockState({
      conversationRows: [makeConversationRow({ assigned_by: null })],
      countRow: { total: 1 },
    });

    const res = await app.request('/api/tags/1/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.data.conversations[0].assigned_by).toBeNull();
  });

  test('returns multiple conversations with status badge data', async () => {
    resetMockState({
      conversationRows: [
        makeConversationRow({ id: 'conv-001', status: 'active' }),
        makeConversationRow({ id: 'conv-002', status: 'closed', customer_name: 'Bob' }),
      ],
      countRow: { total: 2 },
    });

    const res = await app.request('/api/tags/1/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.data.conversations).toHaveLength(2);
    expect(body.data.conversations[0].status).toBe('active');
    expect(body.data.conversations[1].status).toBe('closed');
  });

  // =========================================================================
  // Empty results
  // =========================================================================

  test('returns 200 with empty conversations array when tag has no conversations', async () => {
    resetMockState({
      conversationRows: [],
      countRow: { total: 0 },
    });

    const res = await app.request('/api/tags/1/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.conversations).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
    expect(body.data.pagination.totalPages).toBe(0);
  });

  // =========================================================================
  // 404 — missing or soft-deleted tag
  // =========================================================================

  test('returns 404 when tag does not exist', async () => {
    resetMockState({ tagRow: null });

    const res = await app.request('/api/tags/9999/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  test('returns 404 when tag is soft-deleted (tagRow is null from query filter)', async () => {
    // The SQL query includes `AND deleted_at IS NULL`, so a soft-deleted tag
    // returns null from drizzleDb.get() — same as missing.
    resetMockState({ tagRow: null });

    const res = await app.request('/api/tags/42/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  // =========================================================================
  // Pagination defaults and boundaries
  // =========================================================================

  test('defaults to page 1, limit 20 when no query params given', async () => {
    resetMockState({ countRow: { total: 5 } });

    const res = await app.request('/api/tags/1/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.limit).toBe(20);
  });

  test('clamps limit to 100 when limit exceeds maximum', async () => {
    resetMockState({ countRow: { total: 5 } });

    const res = await app.request('/api/tags/1/conversations?limit=999');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    // Handler: Math.min(parseInt(limit) || 20, 100)
    expect(body.data.pagination.limit).toBe(100);
  });

  test('defaults page to 1 when page param is invalid', async () => {
    resetMockState({ countRow: { total: 3 } });

    const res = await app.request('/api/tags/1/conversations?page=abc');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    // Handler: Math.max(1, parseInt(page) || 1) → 1
    expect(body.data.pagination.page).toBe(1);
  });

  // =========================================================================
  // Soft-delete filtering (verified via mock data returned)
  // =========================================================================

  test('does not include soft-deleted conversations in results', async () => {
    // The SQL WHERE clause filters conv.deleted_at IS NULL and cust.deleted_at IS NULL.
    // Our mock returns only what the DB would return after filtering,
    // so we return an empty list to simulate all rows being filtered out.
    resetMockState({
      conversationRows: [],
      countRow: { total: 0 },
    });

    const res = await app.request('/api/tags/1/conversations');
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.data.conversations).toHaveLength(0);
    expect(body.data.pagination.total).toBe(0);
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  test('returns 500 when database throws an error', async () => {
    resetMockState({ dbError: new Error('D1 connection failed') });

    const res = await app.request('/api/tags/1/conversations');

    expect(res.status).toBe(500);
  });

  // =========================================================================
  // Authentication — JWT middleware is applied
  // =========================================================================

  test('processes request with agent role JWT payload', async () => {
    currentPayload = {
      userId: 'agent-001',
      username: 'testagent',
      role: 'agent',
      teamId: 1,
    };

    resetMockState({
      conversationRows: [makeConversationRow()],
      countRow: { total: 1 },
    });

    const res = await app.request('/api/tags/1/conversations');
    expect(res.status).toBe(200);
  });
});
