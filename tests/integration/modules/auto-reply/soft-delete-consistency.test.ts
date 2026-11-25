// tests/integration/modules/auto-reply/soft-delete-consistency.test.ts
// Tests: soft-deleted rules excluded from evaluation, logs preserved, CRUD behavior

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mocks ====================

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  isNull: (col: any) => ({ type: 'isNull', col }),
}));

vi.mock('@/db/schema', () => ({
  autoReplyRules: { teamId: 'col:teamId', isActive: 'col:isActive', deletedAt: 'col:deletedAt', priority: {}, name: 'auto_reply_rules' },
  autoReplyConditions: { ruleId: {}, name: 'auto_reply_conditions' },
  autoReplyActions: { ruleId: {}, name: 'auto_reply_actions' },
  autoReplyLogs: { name: 'auto_reply_logs' },
  messages: { name: 'messages' },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-softdel'),
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
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastNewMessage: mockBroadcastNewMessage,
  })),
}));

let mockRuleRows: any[] = [];
const mockWhere = vi.fn();
const mockInsertValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((...args: any[]) => {
          mockWhere(...args);
          return {
            orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockRuleRows)),
          };
        }),
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

import { evaluate, invalidateRulesCache } from '@modules/auto-reply/services/auto-reply-engine';

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
    conversationId: 'conv-softdel-test',
    teamId: 1,
    replyToken: 'reply-token',
    customerId: 42,
    platformUserId: 'U123',
    ...overrides,
  };
}

// ==================== Tests ====================

describe('soft-delete consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvStore.clear();
    mockRuleRows = [];
    mockExecuteActions.mockResolvedValue({ success: true, replyMethod: 'reply_api', messageCount: 1 });
    mockIsWithinBusinessHours.mockResolvedValue(true);
  });

  it('cache-miss rule load filters on deletedAt IS NULL and isActive = true', async () => {
    await evaluate(createInput(), createMockEnv());

    // One where() per scope (team rules + global rules). Every one must exclude deleted/inactive rows,
    // because the engine does not re-check deletedAt in memory.
    expect(mockWhere).toHaveBeenCalledTimes(2);
    for (const call of mockWhere.mock.calls) {
      const clause = JSON.stringify(call[0]);
      expect(clause).toContain('{"type":"isNull","col":"col:deletedAt"}');
      expect(clause).toContain('"col:isActive",true');
    }
  });

  it('does not match after invalidation when D1 no longer returns the deleted rule', async () => {
    const env = createMockEnv();
    kvStore.set('auto-reply:rules:1', JSON.stringify([createRule({ id: 1 })]));
    kvStore.set('auto-reply:rules:global', JSON.stringify([]));
    expect((await evaluate(createInput(), env)).matched).toBe(true);

    await invalidateRulesCache(1, env);
    mockRuleRows = [];

    expect((await evaluate(createInput(), env)).matched).toBe(false);
  });

  it('writes the audit log with the ruleId so logs stay joinable after the rule is deleted', async () => {
    const env = createMockEnv();
    kvStore.set('auto-reply:rules:1', JSON.stringify([createRule({ id: 42 })]));
    kvStore.set('auto-reply:rules:global', JSON.stringify([]));

    await evaluate(createInput(), env);

    expect(mockInsertValues.mock.calls.some((call: any[]) => call[0]?.ruleId === 42)).toBe(true);
  });

  it('matches a cached global fallback rule when the conversation has no team', async () => {
    const env = createMockEnv();
    kvStore.set(
      'auto-reply:rules:global',
      JSON.stringify([createRule({ id: 10, teamId: null, triggerType: 'fallback', conditions: [] })])
    );

    const result = await evaluate(createInput({ teamId: null }), env);

    expect(result.matched).toBe(true);
    expect(result.ruleId).toBe(10);
  });
});
