// tests/unit/modules/auto-reply/services/error-propagation.test.ts
// Tests: failure in sub-services doesn't crash the pipeline

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mocks ====================

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  isNull: (col: any) => ({ type: 'isNull', col }),
}));

vi.mock('@/db/schema', () => ({
  autoReplyRules: { teamId: {}, isActive: {}, deletedAt: {}, priority: {}, name: 'auto_reply_rules' },
  autoReplyConditions: { ruleId: {}, name: 'auto_reply_conditions' },
  autoReplyActions: { ruleId: {}, name: 'auto_reply_actions' },
  autoReplyLogs: { name: 'auto_reply_logs' },
  messages: { name: 'messages' },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-error'),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-17T12:00:00.000Z'),
  nowMs: vi.fn(() => 1742212800000),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

const mockExecuteActions = vi.fn();
vi.mock('@modules/auto-reply/services/action-executor', () => ({
  executeActions: (...args: any[]) => mockExecuteActions(...args),
}));

const mockIsWithinBusinessHours = vi.fn();
vi.mock('@modules/auto-reply/services/schedule-service', () => ({
  isWithinBusinessHours: (...args: any[]) => mockIsWithinBusinessHours(...args),
}));

const mockBroadcastNewMessage = vi.fn().mockResolvedValue({ conversationBroadcast: true, globalBroadcast: true });
vi.mock('@/services/websocket-broadcast-service', () => ({
  // A regular function, so `new WebSocketBroadcastService()` works on the mock
  WebSocketBroadcastService: vi.fn(function () {
    return { broadcastNewMessage: mockBroadcastNewMessage };
  }),
}));

let mockRuleRows: any[] = [];
const mockInsertValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockRuleRows)),
        })),
        // hydrateRulesWithRelations awaits select().from(conditions|actions) directly
        then: (resolve: (v: unknown[]) => void) => resolve([]),
      })),
    })),
    insert: mockInsert,
  })),
}));

const kvStore = new Map<string, string>();
const mockKV = {
  get: vi.fn(async (key: string, format?: string) => {
    const val = kvStore.get(key);
    if (!val) return null;
    return format === 'json' ? JSON.parse(val) : val;
  }),
  put: vi.fn(async (key: string, value: string) => {
    kvStore.set(key, value);
  }),
  delete: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
};

function createMockEnv() {
  return {
    DB: {} as any,
    CACHE: mockKV,
    LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  } as any;
}

// ==================== Import after mocks ====================

import { evaluate } from '@modules/auto-reply/services/auto-reply-engine';

// ==================== Helpers ====================

function createRule(overrides: Record<string, any> = {}) {
  return {
    id: 1, teamId: 1, name: 'Test Rule', triggerType: 'keyword',
    priority: 100, isActive: true, createdBy: 'admin-1',
    createdAt: '2026-03-17T00:00:00Z', updatedAt: '2026-03-17T00:00:00Z',
    deletedAt: null,
    conditions: [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }],
    actions: [{ id: 1, ruleId: 1, actionType: 'reply_text', content: JSON.stringify({ text: 'Reply' }), sortOrder: 0 }],
    ...overrides,
  };
}

function createInput(overrides: Record<string, any> = {}) {
  return {
    message: { content: 'hello world', messageType: 'text', platform: 'line' as const },
    conversationId: 'conv-error-test',
    teamId: 1,
    replyToken: 'reply-token',
    customerId: 42,
    platformUserId: 'U123',
    ...overrides,
  };
}

// ==================== Tests ====================

describe('error-propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvStore.clear();
    mockRuleRows = [];
    mockExecuteActions.mockResolvedValue({ success: true, replyMethod: 'reply_api', messageCount: 1 });
    mockIsWithinBusinessHours.mockResolvedValue(true);
    // Implementations set by individual tests must not leak into the next one
    mockInsertValues.mockReset().mockResolvedValue(undefined);
    mockBroadcastNewMessage.mockReset().mockResolvedValue({ conversationBroadcast: true, globalBroadcast: true });
    mockKV.put.mockReset().mockImplementation(async (key: string, value: string) => {
      kvStore.set(key, value);
    });
  });

  // ───────────── Action Errors ─────────────

  describe('action errors', () => {
    it('should return error in result object, not throw', async () => {
      const env = createMockEnv();
      const rule = createRule();
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      mockExecuteActions.mockResolvedValue({
        success: false,
        replyMethod: 'push_api',
        messageCount: 0,
        error: 'Both APIs failed',
      });

      // Should NOT throw
      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
      expect(result.error).toBe('Both APIs failed');
    });

  });

  // ───────────── Condition Errors ─────────────

  describe('condition errors', () => {
    it('should continue to next rule when condition evaluation fails', async () => {
      const env = createMockEnv();
      // First rule has invalid regex condition, second rule is a fallback
      const rules = [
        createRule({
          id: 1, name: 'Bad Regex Rule', priority: 10,
          conditions: [{ id: 1, ruleId: 1, conditionType: 'regex', value: '[bad(', caseSensitive: false, matchMode: 'any' }],
        }),
        createRule({
          id: 2, name: 'Fallback', triggerType: 'fallback', priority: 100,
          conditions: [],
        }),
      ];
      kvStore.set('auto-reply:rules:1', JSON.stringify(rules));
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      const result = await evaluate(createInput(), env);
      // Bad regex returns false → engine moves to next rule → fallback matches
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(2);
      expect(result.ruleName).toBe('Fallback');
    });
  });

  // ───────────── Side Effect Errors ─────────────

  describe('side effect errors (log, WS, KV)', () => {
    it('should not throw from evaluate() when log insert fails', async () => {
      const env = createMockEnv();
      const rule = createRule();
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      // Make insert fail (for both messages and logs)
      mockInsertValues.mockRejectedValue(new Error('D1 insert failed'));

      // The reply already went out, so the result still reports success
      const result = await evaluate(createInput(), env);
      expect(result).toMatchObject({ matched: true, ruleId: 1, replyMethod: 'reply_api' });
      expect(result.error).toBeUndefined();
      expect(mockBroadcastNewMessage).toHaveBeenCalledOnce();
    });

    it('should not throw from evaluate() when WS broadcast fails', async () => {
      const env = createMockEnv();
      const rule = createRule();
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      mockBroadcastNewMessage.mockRejectedValue(new Error('WebSocket error'));

      const result = await evaluate(createInput(), env);
      expect(mockBroadcastNewMessage).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ matched: true, ruleId: 1 });
      expect(result.error).toBeUndefined();
    });

    it('should not throw from evaluate() when KV cache write fails', async () => {
      const env = createMockEnv();
      // No cache → engine queries D1 → tries to write cache → fails
      mockRuleRows = [{ ...createRule({ id: 7, triggerType: 'fallback' }), conditions: undefined, actions: undefined }];
      mockKV.put.mockRejectedValue(new Error('KV write error'));

      const result = await evaluate(createInput(), env);
      expect(mockKV.put).toHaveBeenCalled();
      // The rule loaded from D1 is still evaluated despite the cache write failure
      expect(result).toMatchObject({ matched: true, ruleId: 7 });
    });
  });
});
