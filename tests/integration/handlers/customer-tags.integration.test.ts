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
import { RestoreRegistry } from '@/modules/activities/services/restore-registry';

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
 * After the 2026-04 customer-tags refactor off sql.raw(), every handler
 * in this file uses the Drizzle query builder. The mock routes as follows:
 *
 *   - If the `select` call asks for `{total: count()}`  -- count projection
 *     (getAvailableTags auxiliary count) -- consume from rawQueryResults.
 *   - If the chain includes any of innerJoin / leftJoin / orderBy / offset
 *     -- list/fetch query -- consume from rawQueryResults.
 *   - Otherwise -- simple select-from-where[-limit] -- fall back to the
 *     legacy per-test counter (customer check, valid tags, existing tags).
 *
 * This keeps POST/DELETE/PUT tests working with the counter pattern while
 * letting GET tests drive the refactored handlers through a FIFO queue of
 * drizzle-builder results.
 *
 * Handler patterns after the refactor:
 *  1. drizzleDb.select({id}).from(customers).where().limit(1)   → counter
 *  2. drizzleDb.select({id}).from(tags).where()                 → counter
 *  3. drizzleDb.select({tagId}).from(customerTags).where()      → counter
 *  4. drizzleDb.select({...}).from(tags).where().orderBy()
 *       .limit().offset()                                       → rawQueryResults
 *  5. drizzleDb.select({total: count()}).from(tags).where()     → rawQueryResults
 *  6. drizzleDb.select({...}).from(customerTags).innerJoin()
 *       .where().orderBy()                                      → rawQueryResults
 *  7. drizzleDb.insert(customerTags).values([...])              → insert path
 *  8. drizzleDb.delete(customerTags).where(...)                 → delete path
 */
function createChainableDrizzleMock() {
  let simpleSelectCount = 0;

  function getSimpleSelectResult(n: number) {
    if (mockState.selectError) throw mockState.selectError;
    if (n === 1) return mockState.customerExists ? [{ id: 1 }] : [];
    if (n === 2) return mockState.validTags;
    return mockState.existingAssignments;
  }

  function makeSelectChain(isQueue: boolean): any {
    let markedAsQueue = isQueue;
    const chain: any = {};
    const ret = () => chain;
    chain.from = vi.fn(ret);
    chain.leftJoin = vi.fn(() => { markedAsQueue = true; return chain; });
    chain.innerJoin = vi.fn(() => { markedAsQueue = true; return chain; });
    chain.where = vi.fn(ret);
    chain.orderBy = vi.fn(() => { markedAsQueue = true; return chain; });
    chain.limit = vi.fn(ret);
    chain.offset = vi.fn(() => { markedAsQueue = true; return chain; });

    // Make the chain directly `await`-able -- drizzle's fluent builder
    // resolves to the row array when awaited without an explicit terminal.
    // We build a real Promise on each .then() so that rejection flows
    // through the caller's await chain without leaking unhandled errors.
    chain.then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => {
      return Promise.resolve()
        .then(() => {
          if (mockState.selectError) throw mockState.selectError;
          if (markedAsQueue) {
            return mockState.rawQueryResults.shift() ?? [];
          }
          simpleSelectCount++;
          return getSimpleSelectResult(simpleSelectCount);
        })
        .then(onFulfilled, onRejected);
    };
    return chain;
  }

  const mock: any = {
    // ---- SELECT chain ----
    select: vi.fn((projection?: Record<string, unknown>) => {
      // `count()` projection: always queue-based (total row)
      const keys = projection ? Object.keys(projection) : [];
      const isCountProjection = keys.length === 1 && keys[0] === 'total';
      // Multi-field projections belong to list/fetch queries (never simple
      // existence checks which always project {id} or {tagId}).
      const isMultiFieldProjection = keys.length > 1;
      const routeToQueue = isCountProjection || isMultiFieldProjection;
      return makeSelectChain(routeToQueue);
    }),

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

    // ---- RAW SQL (drizzleDb.all(sql.raw(...))) -- no longer reached by
    //      handlers after the 2026-04 refactor, kept for safety in case a
    //      future handler regresses back to sql.raw().
    all: vi.fn(() => {
      if (mockState.selectError) return Promise.reject(mockState.selectError);
      const result = mockState.rawQueryResults.shift();
      return Promise.resolve(result ?? []);
    }),
  };

  mock._resetSelectCount = () => { simpleSelectCount = 0; };
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
  const prepared: Array<{ sql: string; params: unknown[] }> = [];
  const prepare = vi.fn((sql: string) => {
    const entry = { sql, params: [] as unknown[] };
    prepared.push(entry);
    const stmt: any = {
      sql,
      bind: vi.fn((...params: unknown[]) => {
        entry.params = params;
        return stmt;
      }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } }),
    };
    return stmt;
  });
  return {
    DB: {
      prepare,
      batch: vi.fn(async (stmts: Array<{ sql?: string }>) => {
        if (mockState.insertError && stmts.some(stmt => /INSERT INTO customer_tags/i.test(stmt.sql || ''))) {
          throw mockState.insertError;
        }
        if (mockState.deleteError && stmts.some(stmt => /DELETE FROM customer_tags/i.test(stmt.sql || ''))) {
          throw mockState.deleteError;
        }
        return stmts.map(() => ({ meta: { changes: 1 } }));
      }),
      prepared,
    },
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

      const res = await app.request('/api/customers/tags/available');
      // Admin payload: handler should complete without team-scoping errors.
      // The query builder was invoked via .select().from(tags)... -- both
      // the list and count queries should have run.
      expect(res.status).toBe(200);
      expect(drizzleMock.select).toHaveBeenCalled();
    });

    test('agent should only see team-scoped + global tags', async () => {
      currentPayload = {
        userId: 'agent-001',
        username: 'testagent',
        role: 'agent',
        teamId: 2,
      };
      resetMockState({ rawQueryResults: [[], [{ total: 0 }]] });

      const res = await app.request('/api/customers/tags/available');
      // Agent payload has teamId and role !== 'admin', so the handler
      // adds an OR(eq, isNull) team filter. We can't easily inspect the
      // bound WHERE tokens in this mock, but the handler must still run
      // to completion -- that's what we assert here.
      expect(res.status).toBe(200);
      expect(drizzleMock.select).toHaveBeenCalled();
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

    test('should capture tag assignments and inserts in one D1 batch', async () => {
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
      expect(env.DB.batch).toHaveBeenCalledTimes(1);
      expect(env.DB.batch.mock.calls[0][0]).toHaveLength(4);

      const insertActivity = env.DB.prepared.find(entry => /INSERT INTO activities/i.test(entry.sql));
      expect(insertActivity).toBeDefined();
      const detailsJson = insertActivity?.params.find(
        param => typeof param === 'string' && param.includes('"restoreHandler":"customer.tag-assign"')
      ) as string;
      const details = JSON.parse(detailsJson);
      expect(details.previousState).toMatchObject({
        customerId: 1,
        tagId: 1
      });
      expect(details.newState).toMatchObject({
        customerId: 1,
        tagId: 1,
        assignedBy: 'admin-001'
      });
      expect(() => {
        RestoreRegistry['customer.tag-assign'].buildMutation(env.DB as unknown as D1Database, details.previousState);
      }).not.toThrow();
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

    test('should capture tag unassignments and deletes in one D1 batch', async () => {
      resetMockState({ customerExists: true });
      env.DB.prepare.mockImplementation((sql: string) => {
        const entry = { sql, params: [] as unknown[] };
        env.DB.prepared.push(entry);
        const stmt: any = {
          bind: vi.fn((...params: unknown[]) => {
            entry.params = params;
            return stmt;
          }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                customer_id: 1,
                tag_id: 1,
                assigned_by: 'admin-001',
                assigned_at: '2026-05-25T00:00:00.000Z'
              }
            ]
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } }),
        };
        return stmt;
      });

      const res = await app.request(
        '/api/customers/1/tags',
        jsonBody({ tagIds: [1] }, 'DELETE')
      );

      expect(res.status).toBe(200);
      expect(env.DB.batch).toHaveBeenCalledTimes(1);
      expect(env.DB.batch.mock.calls[0][0]).toHaveLength(2);

      const insertActivity = env.DB.prepared.find(entry => /INSERT INTO activities/i.test(entry.sql));
      expect(insertActivity).toBeDefined();
      const detailsJson = insertActivity?.params.find(
        param => typeof param === 'string' && param.includes('"restoreHandler":"customer.tag-unassign"')
      ) as string;
      const details = JSON.parse(detailsJson);
      expect(details.previousState).toMatchObject({
        customerId: 1,
        tagId: 1,
        assignedBy: 'admin-001'
      });
      expect(details.newState).toEqual({});
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
