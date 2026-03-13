// tests/integration/modules/auto-reply/auto-reply-rules-handler.integration.test.ts
// Integration tests for auto-reply rules CRUD handler (HTTP layer)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ==================== Mocks (before imports) ====================

// JWT auth — inject payload into context
let currentPayload: Record<string, any> = {
  userId: 'admin-001',
  username: 'testadmin',
  role: 'admin',
  primaryTeamId: 1,
};

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('jwtPayload', { ...currentPayload });
    return next();
  }),
}));

// Drizzle ORM
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  isNull: (col: any) => ({ type: 'isNull', col }),
}));

// Schema tables
vi.mock('@/db/schema', () => ({
  autoReplyRules: { id: {}, teamId: {}, isActive: {}, deletedAt: {}, priority: {}, name: 'auto_reply_rules' },
  autoReplyConditions: { ruleId: {}, name: 'auto_reply_conditions' },
  autoReplyActions: { ruleId: {}, name: 'auto_reply_actions' },
}));

// Timestamp
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-13T12:00:00.000Z'),
  nowMs: vi.fn(() => 1741867200000),
}));

// Logger
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// Mock the engine's invalidateRulesCache (avoid pulling in full engine deps)
vi.mock('@modules/auto-reply/services/auto-reply-engine', () => ({
  invalidateRulesCache: vi.fn().mockResolvedValue(undefined),
}));

// ─── Stateful Drizzle mock ───
let selectResults: any[][] = [];
let selectCallIndex = 0;
let insertedRule: any = null;
let getResult: any = null;

function createChainedSelect() {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.get = vi.fn().mockImplementation(() => getResult);
  // Make it thenable (for await on select without .get())
  chain.then = (resolve: (v: any) => void) => {
    const result = selectResults[selectCallIndex] || [];
    selectCallIndex++;
    return Promise.resolve(result).then(resolve);
  };
  return chain;
}

function createChainedInsert() {
  const chain: Record<string, any> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockImplementation(() => {
    return Promise.resolve(insertedRule ? [insertedRule] : []);
  });
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createChainedUpdate() {
  const chain: Record<string, any> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createChainedDelete() {
  const chain: Record<string, any> = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => createChainedSelect()),
  insert: vi.fn(() => createChainedInsert()),
  update: vi.fn(() => createChainedUpdate()),
  delete: vi.fn(() => createChainedDelete()),
};

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => mockDb),
}));

// KV cache mock
const mockKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

// ==================== Import handler after mocks ====================
import autoReplyRulesHandler from '@modules/auto-reply/handlers/auto-reply-rules';

// ==================== Test App Factory ====================

function createTestApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.env = {
      DB: {} as any,
      CACHE: mockKV,
      LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
      JWT_SECRET: 'test-secret',
    } as any;
    await next();
  });
  app.route('/api/auto-reply/rules', autoReplyRulesHandler);
  return app;
}

// ==================== Tests ====================

describe('Auto-Reply Rules Handler — Integration', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectCallIndex = 0;
    insertedRule = null;
    getResult = null;
    currentPayload = {
      userId: 'admin-001',
      username: 'testadmin',
      role: 'admin',
      primaryTeamId: 1,
    };
    app = createTestApp();
  });

  // ───────────── Health Check ─────────────

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await app.request('/api/auto-reply/rules/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
    });
  });

  // ───────────── List Rules ─────────────

  describe('GET / (list rules)', () => {
    it('should return paginated rules list', async () => {
      // Mock: rules query returns 1 rule
      selectResults = [
        [{ id: 1, teamId: 1, name: 'Test Rule', triggerType: 'keyword', priority: 100, isActive: true, createdBy: 'admin-001', createdAt: '2026-03-13', updatedAt: '2026-03-13', deletedAt: null }],
        [{ id: 1 }], // count query
        [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }], // conditions
        [{ id: 1, ruleId: 1, actionType: 'reply_text', content: '{"text":"Hi"}', sortOrder: 0 }], // actions
      ];

      const res = await app.request('/api/auto-reply/rules?teamId=1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('should return 400 when teamId is missing and not in JWT', async () => {
      currentPayload = { userId: 'admin-001', role: 'admin' };
      app = createTestApp();

      const res = await app.request('/api/auto-reply/rules');
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // ───────────── Create Rule ─────────────

  describe('POST / (create rule)', () => {
    it('should create a keyword rule with conditions and actions', async () => {
      insertedRule = {
        id: 1,
        teamId: 1,
        name: 'Price Inquiry',
        triggerType: 'keyword',
        priority: 50,
        isActive: true,
        createdBy: 'admin-001',
        createdAt: '2026-03-13T12:00:00.000Z',
        updatedAt: '2026-03-13T12:00:00.000Z',
        deletedAt: null,
      };

      // Mock conditions/actions re-fetch after create
      selectResults = [
        [{ id: 1, ruleId: 1, conditionType: 'contains', value: '價格', caseSensitive: false, matchMode: 'any', createdAt: '2026-03-13' }],
        [{ id: 1, ruleId: 1, actionType: 'reply_text', content: '{"text":"我們的價格是..."}', sortOrder: 0, createdAt: '2026-03-13' }],
      ];

      const res = await app.request('/api/auto-reply/rules?teamId=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Price Inquiry',
          triggerType: 'keyword',
          priority: 50,
          conditions: [
            { conditionType: 'contains', value: '價格' },
          ],
          actions: [
            { actionType: 'reply_text', content: '{"text":"我們的價格是..."}' },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Price Inquiry');

      // Should invalidate KV cache
      const { invalidateRulesCache } = await import('@modules/auto-reply/services/auto-reply-engine');
      expect(invalidateRulesCache).toHaveBeenCalled();
    });

    it('should return 400 for missing rule name', async () => {
      const res = await app.request('/api/auto-reply/rules?teamId=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'keyword' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid triggerType', async () => {
      const res = await app.request('/api/auto-reply/rules?teamId=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', triggerType: 'invalid_type' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('triggerType');
    });

    it('should return 400 for invalid conditionType', async () => {
      insertedRule = { id: 1, teamId: 1, name: 'Test', triggerType: 'keyword', priority: 100, isActive: true, createdBy: null, createdAt: '', updatedAt: '', deletedAt: null };

      const res = await app.request('/api/auto-reply/rules?teamId=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          triggerType: 'keyword',
          conditions: [{ conditionType: 'bad_type', value: 'test' }],
        }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const res = await app.request('/api/auto-reply/rules?teamId=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{{{',
      });
      expect(res.status).toBe(400);
    });
  });

  // ───────────── Update Rule ─────────────

  describe('PUT /:id (update rule)', () => {
    it('should update an existing rule', async () => {
      // Mock: rule exists
      getResult = {
        id: 1, teamId: 1, name: 'Old Name', triggerType: 'keyword',
        priority: 100, isActive: true, deletedAt: null,
      };

      // Mock: re-fetch after update
      selectResults = [
        [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'new', caseSensitive: false, matchMode: 'any' }],
        [{ id: 1, ruleId: 1, actionType: 'reply_text', content: '{"text":"Updated"}', sortOrder: 0 }],
      ];

      const res = await app.request('/api/auto-reply/rules/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name', priority: 10 }),
      });

      expect(res.status).toBe(200);
      const { invalidateRulesCache } = await import('@modules/auto-reply/services/auto-reply-engine');
      expect(invalidateRulesCache).toHaveBeenCalled();
    });

    it('should return 404 for non-existent rule', async () => {
      getResult = null; // not found

      const res = await app.request('/api/auto-reply/rules/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid rule ID', async () => {
      const res = await app.request('/api/auto-reply/rules/abc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ───────────── Delete Rule (Soft) ─────────────

  describe('DELETE /:id (soft delete)', () => {
    it('should soft-delete an existing rule', async () => {
      getResult = { id: 1, teamId: 1, name: 'To Delete', deletedAt: null };

      const res = await app.request('/api/auto-reply/rules/1', { method: 'DELETE' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(1);

      // Should call update to set deletedAt
      expect(mockDb.update).toHaveBeenCalled();
      // Should invalidate cache
      const { invalidateRulesCache } = await import('@modules/auto-reply/services/auto-reply-engine');
      expect(invalidateRulesCache).toHaveBeenCalled();
    });

    it('should return 404 for already-deleted rule', async () => {
      getResult = null;

      const res = await app.request('/api/auto-reply/rules/1', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });
});
