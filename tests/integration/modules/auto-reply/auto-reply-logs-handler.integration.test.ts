// tests/integration/modules/auto-reply/auto-reply-logs-handler.integration.test.ts
// Security-focused integration tests for the auto-reply logs handler.
//
// This handler was rewritten to eliminate a template-literal SQL injection
// where `platform` and `dateFrom` query parameters were interpolated into a
// `sql.raw()` call. The new implementation uses Drizzle's typed query builder
// exclusively (every value is bound as a parameter) AND rejects obviously bad
// input up front with a 400.
//
// These tests pin that behaviour so the bug cannot be silently reintroduced.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ==================== Mocks (hoisted above imports) ====================

// JWT middleware — inject payload into context, skip real token verification
let currentPayload: Record<string, unknown> = {
  userId: 'agent-007',
  username: 'testagent',
  role: 'agent',
  primaryTeamId: 1,
};

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('jwtPayload', { ...currentPayload });
    return next();
  }),
}));

// Drizzle operators — return opaque token objects so we can inspect call args
vi.mock('drizzle-orm', () => ({
  eq: (col: any, value: any) => ({ _op: 'eq', col, value }),
  and: (...args: any[]) => ({ _op: 'and', args: args.filter(Boolean) }),
  or: (...args: any[]) => ({ _op: 'or', args: args.filter(Boolean) }),
  isNull: (col: any) => ({ _op: 'isNull', col }),
  gte: (col: any, value: any) => ({ _op: 'gte', col, value }),
  desc: (col: any) => ({ _op: 'desc', col }),
  count: () => ({ _op: 'count' }),
}));

// Schema tables — stub objects used only as identity markers
vi.mock('@/db/schema', () => ({
  autoReplyLogs: {
    _table: 'auto_reply_logs',
    id: { _col: 'id' },
    ruleId: { _col: 'rule_id' },
    conversationId: { _col: 'conversation_id' },
    customerId: { _col: 'customer_id' },
    triggerContent: { _col: 'trigger_content' },
    responseContent: { _col: 'response_content' },
    matchedCondition: { _col: 'matched_condition' },
    platform: { _col: 'platform' },
    replyMethod: { _col: 'reply_method' },
    createdAt: { _col: 'created_at' },
  },
  autoReplyRules: {
    _table: 'auto_reply_rules',
    id: { _col: 'id' },
    teamId: { _col: 'team_id' },
    name: { _col: 'name' },
  },
}));

// Timestamp + logger — lightweight stubs
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-04-09T00:00:00.000Z'),
  nowMs: vi.fn(() => 1775952000000),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// ─── Drizzle query-builder chain mock ───
// Every query shape used by the handler is the same fluent chain:
//   select(...).from(...).leftJoin(...).where(...).orderBy?.limit?.offset?
// We capture every call so tests can assert on bound values.
type ChainCall = {
  select?: unknown;
  from?: unknown;
  leftJoin?: [unknown, unknown];
  where?: unknown;
  orderBy?: unknown;
  limit?: number;
  offset?: number;
};

let chainCalls: ChainCall[] = [];
let selectRowsQueue: unknown[][] = [];

function createChain(): any {
  const call: ChainCall = {};
  chainCalls.push(call);
  const chain: any = {};
  chain.from = vi.fn((t: unknown) => { call.from = t; return chain; });
  chain.leftJoin = vi.fn((t: unknown, on: unknown) => {
    call.leftJoin = [t, on];
    return chain;
  });
  chain.where = vi.fn((w: unknown) => { call.where = w; return chain; });
  chain.orderBy = vi.fn((o: unknown) => { call.orderBy = o; return chain; });
  chain.limit = vi.fn((l: number) => { call.limit = l; return chain; });
  chain.offset = vi.fn((o: number) => { call.offset = o; return chain; });
  // Chain is directly await-able: it resolves to the next queued row set
  chain.then = (resolve: (v: unknown) => void) => {
    const rows = selectRowsQueue.shift() ?? [];
    return Promise.resolve(rows).then(resolve);
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn((projection: unknown) => {
    const chain = createChain();
    chainCalls[chainCalls.length - 1].select = projection;
    return chain;
  }),
};

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => mockDb),
}));

// ==================== Import handler after mocks ====================
import autoReplyLogsHandler from '@modules/auto-reply/handlers/auto-reply-logs';

// ==================== Test App Factory ====================

function createTestApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.env = {
      DB: {} as any,
      CACHE: {} as any,
      JWT_SECRET: 'test-secret',
    } as any;
    await next();
  });
  app.route('/api/auto-reply/logs', autoReplyLogsHandler);
  return app;
}

// ==================== Tests ====================

describe('Auto-Reply Logs Handler -- Security Regression', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    chainCalls = [];
    selectRowsQueue = [];
    currentPayload = {
      userId: 'agent-007',
      username: 'testagent',
      role: 'agent',
      primaryTeamId: 1,
    };
    app = createTestApp();
  });

  // ───────────── Health check (smoke) ─────────────

  describe('GET /health', () => {
    it('responds without touching the DB', async () => {
      const res = await app.request('/api/auto-reply/logs/health');
      expect(res.status).toBe(200);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  // ───────────── Input validation: platform ─────────────

  describe('GET / -- platform query parameter', () => {
    it('rejects SQL-injection payload as 400 without querying the DB', async () => {
      const payload = encodeURIComponent(
        "line' UNION SELECT username, password_hash FROM agents--"
      );
      const res = await app.request(
        `/api/auto-reply/logs?teamId=1&platform=${payload}`
      );
      expect(res.status).toBe(400);
      // Error body shape is `{ success: false, error: <message string>, ... }`
      const body = (await res.json()) as { error?: string };
      expect(String(body.error)).toMatch(/platform must be one of/);
      // Critical assertion: DB was NEVER touched. If this fails the handler
      // has been reverted to the concatenation pattern and is re-exploitable.
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('rejects a quote-only payload as 400', async () => {
      const res = await app.request(
        "/api/auto-reply/logs?teamId=1&platform=" + encodeURIComponent("'")
      );
      expect(res.status).toBe(400);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('rejects an unknown but syntactically-safe value as 400', async () => {
      const res = await app.request('/api/auto-reply/logs?teamId=1&platform=telegram');
      expect(res.status).toBe(400);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('accepts a known platform and binds it via eq() (parameterised)', async () => {
      selectRowsQueue = [[], [{ total: 0 }], [{ total: 0 }]];
      const res = await app.request('/api/auto-reply/logs?teamId=1&platform=line');
      expect(res.status).toBe(200);
      // The list query is the first select; its where clause must contain
      // an eq({col: platform}, 'line') token -- not a raw string.
      const listCall = chainCalls[0];
      expect(listCall?.where).toBeDefined();
      const whereJson = JSON.stringify(listCall.where);
      expect(whereJson).toContain('"_op":"eq"');
      expect(whereJson).toContain('"value":"line"');
      // And absolutely no raw string interpolation should appear
      expect(whereJson).not.toContain("platform = 'line'");
    });
  });

  // ───────────── Input validation: dateFrom ─────────────

  describe('GET / -- dateFrom query parameter', () => {
    it('rejects an obviously non-date payload as 400', async () => {
      const payload = encodeURIComponent("2020-01-01'; DROP TABLE agents--");
      const res = await app.request(
        `/api/auto-reply/logs?teamId=1&dateFrom=${payload}`
      );
      expect(res.status).toBe(400);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('accepts a valid ISO date and binds it via gte()', async () => {
      selectRowsQueue = [[], [{ total: 0 }], [{ total: 0 }]];
      const res = await app.request(
        '/api/auto-reply/logs?teamId=1&dateFrom=2026-04-01T00:00:00.000Z'
      );
      expect(res.status).toBe(200);
      const listWhere = JSON.stringify(chainCalls[0]?.where);
      expect(listWhere).toContain('"_op":"gte"');
      expect(listWhere).toContain('2026-04-01');
    });
  });

  // ───────────── Input validation: ruleId ─────────────

  describe('GET / -- ruleId query parameter', () => {
    it('rejects a non-numeric ruleId as 400', async () => {
      const res = await app.request('/api/auto-reply/logs?teamId=1&ruleId=abc');
      expect(res.status).toBe(400);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('accepts a numeric ruleId and binds it via eq()', async () => {
      selectRowsQueue = [[], [{ total: 0 }], [{ total: 0 }]];
      const res = await app.request('/api/auto-reply/logs?teamId=1&ruleId=42');
      expect(res.status).toBe(200);
      const listWhere = JSON.stringify(chainCalls[0]?.where);
      expect(listWhere).toContain('"_op":"eq"');
      expect(listWhere).toContain('"value":42');
    });
  });

  // ───────────── Happy path: parameterisation across the board ─────────────

  describe('GET / -- happy path', () => {
    it('runs three SELECT queries with parameterised team scoping', async () => {
      selectRowsQueue = [
        [{ id: 1, rule_id: 10, rule_name: 'Welcome' }],
        [{ total: 1 }],
        [{ total: 1 }],
      ];
      const res = await app.request('/api/auto-reply/logs?teamId=1');
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { items: unknown[]; total: number; todayTotal: number };
      };
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.total).toBe(1);
      expect(body.data.todayTotal).toBe(1);

      // Three chain calls: list + total count + today count
      expect(chainCalls).toHaveLength(3);

      // Every where clause must be an `and(...)` token (never a raw string)
      for (const call of chainCalls) {
        expect(typeof call.where).toBe('object');
        expect(JSON.stringify(call.where)).toContain('"_op":"and"');
      }
    });

    it('derives teamId from JWT payload when no query param is provided', async () => {
      currentPayload.primaryTeamId = 7;
      selectRowsQueue = [[], [{ total: 0 }], [{ total: 0 }]];
      const res = await app.request('/api/auto-reply/logs');
      expect(res.status).toBe(200);
      // The team scoping token should reference team_id = 7
      const listWhere = JSON.stringify(chainCalls[0]?.where);
      expect(listWhere).toContain('"value":7');
    });

    it('returns 400 when no teamId can be resolved', async () => {
      currentPayload = { userId: 'x', role: 'agent' }; // no primaryTeamId
      const res = await app.request('/api/auto-reply/logs');
      expect(res.status).toBe(400);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });
});
