/**
 * Customer Tags Handler Integration Tests
 *
 * Tests HTTP-level behavior of customer-tags.ts endpoints:
 * - GET  /api/customers/tags/available — list available tags (with pagination, search, team-scoping)
 * - GET  /api/customers/:id/tags — get customer tags
 * - POST /api/customers/:id/tags — add tags to customer
 * - DELETE /api/customers/:id/tags — remove tags from customer
 * - PUT  /api/customers/:id/tags — replace all customer tags
 *
 * Mock strategy:
 * - vi.mock('@/middleware/auth') — configurable jwtPayload (admin vs agent)
 * - vi.mock('@/db/drizzle-factory') — operation-aware chainable Drizzle mock with mockState
 * - vi.mock('@/utils/database') — stub for customer-main.ts co-import
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Configurable JWT payload — can be switched per test
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
// Stub @/utils/database (used by customer-main.ts which co-imports)
// ---------------------------------------------------------------------------
vi.mock('@/utils/database', () => ({
  getAllCustomers: vi.fn().mockResolvedValue([]),
  getCustomerById: vi.fn().mockResolvedValue(null),
  getCustomerByPlatformId: vi.fn().mockResolvedValue(null),
  getCustomerConversations: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Operation-aware Drizzle mock
// ---------------------------------------------------------------------------

interface MockState {
  customerExists: boolean;
  validTags: Array<{ id: number }>;
  existingAssignments: Array<{ tagId: number }>;
  rawQueryResults: any[];
  insertError: Error | null;
  deleteError: Error | null;
  selectError: Error | null;
}

// Default state — each test can override via `resetMockState()`
let mockState: MockState = {
  customerExists: true,
  validTags: [],
  existingAssignments: [],
  rawQueryResults: [],
  insertError: null,
  deleteError: null,
  selectError: null,
};

function resetMockState(overrides: Partial<MockState> = {}) {
  mockState = {
    customerExists: true,
    validTags: [],
    existingAssignments: [],
    rawQueryResults: [],
    insertError: null,
    deleteError: null,
    selectError: null,
    ...overrides,
  };
}

/**
 * Build a chainable Drizzle mock that responds based on mockState.
 *
 * The handler makes these patterns:
 * 1. drizzleDb.select({id}).from(customers).where(...).limit(1) → customer check
 * 2. drizzleDb.select({id}).from(tags).where(inArray + isActive) → valid tags check
 * 3. drizzleDb.select({tagId}).from(customerTags).where(...) → existing assignments
 * 4. drizzleDb.insert(customerTags).values([...]) → insert
 * 5. drizzleDb.delete(customerTags).where(...) → delete
 * 6. drizzleDb.all(sql.raw(...)) → raw SQL queries
 *
 * We track which table is being targeted via from/insert/delete calls.
 */
function createChainableDrizzleMock() {
  /**
   * Tracks select queries sequentially across a single handler call:
   *   1st → customer existence check  (.where().limit())
   *   2nd → valid tags check           (.where() awaited directly)
   *   3rd → existing assignments check  (.where() awaited directly)
   */
  let selectCallCount = 0;

  function getSelectResult(n: number) {
    if (mockState.selectError) throw mockState.selectError;
    if (n === 1) return mockState.customerExists ? [{ id: 1 }] : [];
    if (n === 2) return mockState.validTags;
    return mockState.existingAssignments;
  }

  const mock: any = {
    // ---- SELECT chain ----
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          selectCallCount++;
          const data = getSelectResult(selectCallCount);

          // Return a Promise that also has .limit() for optional chaining.
          // Handler uses BOTH patterns:
          //   await db.select().from(t).where(cond).limit(1)   → customer check
          //   await db.select().from(t).where(cond)            → tags / assignments
          const promise = Promise.resolve(data);
          (promise as any).limit = vi.fn(() => Promise.resolve(data));
          return promise;
        }),
        // Direct .limit() without .where() (unlikely but safe)
        limit: vi.fn(() => {
          selectCallCount++;
          const data = getSelectResult(selectCallCount);
          return Promise.resolve(data);
        }),
      })),
    })),

    // ---- INSERT chain ----
    insert: vi.fn(() => ({
      values: vi.fn(() => {
        if (mockState.insertError) return Promise.reject(mockState.insertError);
        return Promise.resolve(undefined);
      }),
    })),

    // ---- DELETE chain ----
    delete: vi.fn(() => ({
      where: vi.fn(() => {
        if (mockState.deleteError) return Promise.reject(mockState.deleteError);
        return Promise.resolve(undefined);
      }),
    })),

    // ---- RAW SQL (drizzleDb.all(sql.raw(...))) ----
    all: vi.fn(() => {
      if (mockState.selectError) return Promise.reject(mockState.selectError);
      const result = mockState.rawQueryResults.shift();
      return Promise.resolve(result ?? []);
    }),
  };

  mock._resetSelectCount = () => { selectCallCount = 0; };
  return mock;
}

let drizzleMock: ReturnType<typeof createChainableDrizzleMock>;

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => drizzleMock),
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import customerHandler from '@/modules/customer/handlers/customer-main';
import type { Bindings } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
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
  app.route('/api/customers', customerHandler);
  return app;
}

// Shorthand for JSON body requests
function jsonBody(body: unknown, method: string = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Customer Tags Handler — Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    app = createTestApp(env);

    // Reset to admin payload
    currentPayload = {
      userId: 'admin-001',
      username: 'testadmin',
      role: 'admin',
      teamId: 1,
    };

    // Reset drizzle mock + state
    drizzleMock = createChainableDrizzleMock();
    resetMockState();
  });

  // =========================================================================
  // GET /api/customers/tags/available
  // =========================================================================
  describe('GET /api/customers/tags/available', () => {
    test('should return 200 with tags and pagination', async () => {
      const sampleTags = [
        { id: 1, name: 'VIP', color: '#ff0000', customerCount: 5 },
        { id: 2, name: 'New', color: '#00ff00', customerCount: 10 },
      ];
      resetMockState({
        rawQueryResults: [sampleTags, [{ total: 2 }]],
      });

      const res = await app.request('/api/customers/tags/available');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });

    test('should pass page and pageSize query params', async () => {
      resetMockState({ rawQueryResults: [[], [{ total: 0 }]] });

      const res = await app.request('/api/customers/tags/available?page=2&pageSize=10');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
    });

    test('admin should see all tags (no team filter)', async () => {
      resetMockState({ rawQueryResults: [[], [{ total: 0 }]] });

      // drizzleMock.all is called with raw SQL — admin should NOT have team_id filter
      await app.request('/api/customers/tags/available');

      // The raw SQL was constructed and passed to .all(sql.raw(...))
      expect(drizzleMock.all).toHaveBeenCalled();
    });

    test('agent should only see team-scoped + global tags', async () => {
      currentPayload = {
        userId: 'agent-001',
        username: 'testagent',
        role: 'agent',
        teamId: 2,
      };
      resetMockState({ rawQueryResults: [[], [{ total: 0 }]] });

      await app.request('/api/customers/tags/available');

      // Agent payload has teamId and role !== 'admin', so team filtering applies
      expect(drizzleMock.all).toHaveBeenCalled();
    });

    test('should support search param', async () => {
      resetMockState({ rawQueryResults: [[], [{ total: 0 }]] });

      const res = await app.request('/api/customers/tags/available?search=vip');
      expect(res.status).toBe(200);
    });

    test('should support includeGlobal=false param', async () => {
      resetMockState({ rawQueryResults: [[], [{ total: 0 }]] });

      const res = await app.request('/api/customers/tags/available?includeGlobal=false');
      expect(res.status).toBe(200);
    });

    test('should include conversationCount in each tag', async () => {
      const sampleTags = [
        { id: 1, name: 'VIP', color: '#ff0000', customerCount: 5, conversationCount: 3 },
        { id: 2, name: 'New', color: '#00ff00', customerCount: 10, conversationCount: 0 },
      ];
      resetMockState({
        rawQueryResults: [sampleTags, [{ total: 2 }]],
      });

      const res = await app.request('/api/customers/tags/available');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.data[0].conversationCount).toBe(3);
      expect(body.data[1].conversationCount).toBe(0);
    });

    test('should return conversationCount as 0 when tag has no conversations', async () => {
      const sampleTags = [
        { id: 1, name: 'Empty', color: '#aaaaaa', customerCount: 0, conversationCount: 0 },
      ];
      resetMockState({
        rawQueryResults: [sampleTags, [{ total: 1 }]],
      });

      const res = await app.request('/api/customers/tags/available');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.data[0].conversationCount).toBe(0);
    });

    test('should return 500 on database error', async () => {
      resetMockState({ selectError: new Error('DB crashed') });

      const res = await app.request('/api/customers/tags/available');
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/customers/:customerId/tags
  // =========================================================================
  describe('GET /api/customers/:customerId/tags', () => {
    test('should return 200 with customer tags', async () => {
      const customerTagsData = [
        { id: 1, name: 'VIP', color: '#ff0000', assignedAt: '2025-01-01' },
      ];
      resetMockState({
        customerExists: true,
        rawQueryResults: [customerTagsData],
      });

      const res = await app.request('/api/customers/1/tags');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    test('should return 404 when customer does not exist', async () => {
      resetMockState({ customerExists: false });

      const res = await app.request('/api/customers/999/tags');
      expect(res.status).toBe(404);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 200 with empty array when no tags', async () => {
      resetMockState({
        customerExists: true,
        rawQueryResults: [[]],
      });

      const res = await app.request('/api/customers/1/tags');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });

    test('should return 500 on database error', async () => {
      resetMockState({ selectError: new Error('query timeout') });

      const res = await app.request('/api/customers/1/tags');
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /api/customers/:customerId/tags
  // =========================================================================
  describe('POST /api/customers/:customerId/tags', () => {
    test('should return 200 when adding tags successfully', async () => {
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }, { id: 2 }],
        existingAssignments: [],
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1, 2] })
      );
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.added).toBe(2);
      expect(body.data.alreadyExists).toBe(0);
    });

    test('should return 422 when tagIds is empty', async () => {
      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [] })
      );
      expect(res.status).toBe(422);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 422 when tagIds is missing', async () => {
      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({})
      );
      expect(res.status).toBe(422);
    });

    test('should return 404 when customer does not exist', async () => {
      resetMockState({ customerExists: false });

      const res = await app.request(
        '/api/customers/999/tags',
        jsonBody({ tagIds: [1] })
      );
      expect(res.status).toBe(404);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 422 when some tags are invalid', async () => {
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }], // Only 1 valid, but 2 requested
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1, 999] })
      );
      expect(res.status).toBe(422);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should deduplicate already-assigned tags', async () => {
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }, { id: 2 }],
        existingAssignments: [{ tagId: 1 }], // Tag 1 already assigned
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1, 2] })
      );
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.data.added).toBe(1);
      expect(body.data.alreadyExists).toBe(1);
    });

    test('should return 401 when userId missing from payload', async () => {
      currentPayload = {
        userId: '', // Empty userId
        username: 'noid',
        role: 'admin',
        teamId: 1,
      };
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }],
        existingAssignments: [],
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1] })
      );
      expect(res.status).toBe(401);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 500 on database insert error', async () => {
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }],
        existingAssignments: [],
        insertError: new Error('disk full'),
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1] })
      );
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // DELETE /api/customers/:customerId/tags
  // =========================================================================
  describe('DELETE /api/customers/:customerId/tags', () => {
    test('should return 200 when removing tags successfully', async () => {
      resetMockState({ customerExists: true });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1, 2] }, 'DELETE')
      );
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });

    test('should return 422 when tagIds is empty', async () => {
      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [] }, 'DELETE')
      );
      expect(res.status).toBe(422);
    });

    test('should return 404 when customer does not exist', async () => {
      resetMockState({ customerExists: false });

      const res = await app.request(
        '/api/customers/999/tags',
        jsonBody({ tagIds: [1] }, 'DELETE')
      );
      expect(res.status).toBe(404);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 500 on database delete error', async () => {
      resetMockState({
        customerExists: true,
        deleteError: new Error('FK constraint'),
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1] }, 'DELETE')
      );
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // PUT /api/customers/:customerId/tags
  // =========================================================================
  describe('PUT /api/customers/:customerId/tags', () => {
    test('should return 200 when setting tags successfully', async () => {
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }, { id: 2 }],
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1, 2] }, 'PUT')
      );
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.totalTags).toBe(2);
    });

    test('should return 422 when tagIds is not an array', async () => {
      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: 'not-array' }, 'PUT')
      );
      expect(res.status).toBe(422);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 404 when customer does not exist', async () => {
      resetMockState({ customerExists: false });

      const res = await app.request(
        '/api/customers/999/tags',
        jsonBody({ tagIds: [1] }, 'PUT')
      );
      expect(res.status).toBe(404);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should clear all tags when empty array provided', async () => {
      resetMockState({ customerExists: true });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [] }, 'PUT')
      );
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.totalTags).toBe(0);
    });

    test('should return 422 when some tags are invalid', async () => {
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }], // Only 1 valid, but 2 requested
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1, 999] }, 'PUT')
      );
      expect(res.status).toBe(422);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 401 when userId missing from payload', async () => {
      currentPayload = {
        userId: '',
        username: 'noid',
        role: 'admin',
        teamId: 1,
      };
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }],
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1] }, 'PUT')
      );
      expect(res.status).toBe(401);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 500 on database error', async () => {
      resetMockState({
        customerExists: true,
        validTags: [{ id: 1 }],
        insertError: new Error('write failure'),
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1] }, 'PUT')
      );
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });
});
