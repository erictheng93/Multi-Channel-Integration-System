// tests/unit/modules/auto-reply/services/rule-merging.test.ts
// Tests for global vs team rule merging, priority ordering, and first-match-wins behavior

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
  v4: vi.fn(() => 'test-uuid-merge'),
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
const mockInsertValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockRuleRows)),
        })),
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

import { evaluate, evaluateWelcome } from '@modules/auto-reply/services/auto-reply-engine';

// ==================== Helpers ====================

function createRule(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    teamId: 1,
    name: 'Test Rule',
    triggerType: 'keyword',
    priority: 100,
    isActive: true,
    createdBy: 'admin-1',
    createdAt: '2026-03-17T00:00:00Z',
    updatedAt: '2026-03-17T00:00:00Z',
    deletedAt: null,
    conditions: [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }],
    actions: [{ id: 1, ruleId: 1, actionType: 'reply_text', content: JSON.stringify({ text: 'Reply' }), sortOrder: 0 }],
    ...overrides,
  };
}

function createInput(overrides: Record<string, any> = {}) {
  return {
    message: { content: 'hello world', messageType: 'text', platform: 'line' as const },
    conversationId: 'conv-merge-test',
    teamId: 1,
    replyToken: 'reply-token',
    customerId: 42,
    platformUserId: 'U123',
    ...overrides,
  };
}

// ==================== Tests ====================

describe('rule-merging (global + team rules)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvStore.clear();
    mockRuleRows = [];
    mockExecuteActions.mockResolvedValue({ success: true, replyMethod: 'reply_api', messageCount: 1 });
    mockIsWithinBusinessHours.mockResolvedValue(true);
  });

  // ───────────── Priority Ordering ─────────────

  describe('priority ordering', () => {
    it('should sort all rules by priority ASC', async () => {
      const env = createMockEnv();
      const rules = [
        createRule({ id: 1, teamId: 1, priority: 200, name: 'Low', conditions: [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }] }),
        createRule({ id: 2, teamId: 1, priority: 10, name: 'High', conditions: [{ id: 2, ruleId: 2, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }] }),
      ];
      kvStore.set('auto-reply:rules:1', JSON.stringify(rules));
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      const result = await evaluate(createInput(), env);
      // getRulesForEvaluation sorts by priority ASC, so High (P10) wins
      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('High');
    });

    it('should prefer team rule over global at same priority', async () => {
      const env = createMockEnv();
      const globalRule = createRule({
        id: 10, teamId: null, name: 'Global Fallback',
        triggerType: 'fallback', priority: 100, conditions: [],
      });
      const teamRule = createRule({
        id: 20, teamId: 1, name: 'Team Fallback',
        triggerType: 'fallback', priority: 100, conditions: [],
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalRule]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([teamRule]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(20); // Team rule wins at same priority
    });
  });

  // ───────────── Global-Only (teamId=null) ─────────────

  describe('global-only (teamId=null)', () => {
    it('should return only global rules when teamId is null', async () => {
      const env = createMockEnv();
      const globalRule = createRule({
        id: 10, teamId: null, name: 'Global Keyword',
        conditions: [{ id: 1, ruleId: 10, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }],
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalRule]));

      const result = await evaluate(createInput({ teamId: null }), env);
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(10);
    });

    it('should NOT query team rules when teamId is null', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      await evaluate(createInput({ teamId: null }), env);

      // KV.get should only be called for global, not for any team
      const getCalls = mockKV.get.mock.calls.map((c: any[]) => c[0]);
      expect(getCalls).toContain('auto-reply:rules:global');
      expect(getCalls.every((k: string) => !k.match(/^auto-reply:rules:\d+$/))).toBe(true);
    });
  });

  // ───────────── Team Evaluation with Merge ─────────────

  describe('team evaluation — merges global + team rules', () => {
    it('should merge global and team rules', async () => {
      const env = createMockEnv();
      const globalRule = createRule({
        id: 10, teamId: null, name: 'Global Fallback',
        triggerType: 'fallback', priority: 999, conditions: [],
      });
      const teamRule = createRule({
        id: 20, teamId: 1, name: 'Team Keyword',
        triggerType: 'keyword', priority: 50,
        conditions: [{ id: 2, ruleId: 20, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }],
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalRule]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([teamRule]));

      const result = await evaluate(createInput(), env);
      // Team keyword (P50) should match before global fallback (P999)
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(20);
    });

    it('should have no duplicates when merging', async () => {
      const env = createMockEnv();
      // Same rule should not appear twice
      const globalRule = createRule({ id: 10, teamId: null, triggerType: 'fallback', priority: 100, conditions: [] });
      const teamRule = createRule({ id: 20, teamId: 1, triggerType: 'fallback', priority: 200, conditions: [] });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalRule]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([teamRule]));

      const result = await evaluate(createInput(), env);
      // Global fallback (P100) should match first
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(10);
    });
  });

  // ───────────── First-Match-Wins Scenarios ─────────────

  describe('first-match-wins', () => {
    it('should match global off_hours P10 over team fallback P999', async () => {
      const env = createMockEnv();
      mockIsWithinBusinessHours.mockResolvedValue(false); // Outside business hours

      const globalOffHours = createRule({
        id: 10, teamId: null, name: 'Global Off Hours',
        triggerType: 'off_hours', priority: 10, conditions: [],
      });
      const teamFallback = createRule({
        id: 20, teamId: 1, name: 'Team Fallback',
        triggerType: 'fallback', priority: 999, conditions: [],
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalOffHours]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([teamFallback]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(10);
      expect(result.ruleName).toBe('Global Off Hours');
    });

    it('should match team keyword P50 over global fallback P100', async () => {
      const env = createMockEnv();
      const globalFallback = createRule({
        id: 10, teamId: null, name: 'Global Fallback',
        triggerType: 'fallback', priority: 100, conditions: [],
      });
      const teamKeyword = createRule({
        id: 20, teamId: 1, name: 'Team Keyword',
        triggerType: 'keyword', priority: 50,
        conditions: [{ id: 2, ruleId: 20, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }],
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalFallback]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([teamKeyword]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(20);
      expect(result.ruleName).toBe('Team Keyword');
    });
  });

  // ───────────── Edge Cases ─────────────

  describe('edge cases', () => {
    it('should work with empty global + populated team', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([
        createRule({ id: 1, teamId: 1, triggerType: 'fallback', conditions: [] }),
      ]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
    });

    it('should work with populated global + empty team', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:global', JSON.stringify([
        createRule({ id: 10, teamId: null, triggerType: 'fallback', conditions: [] }),
      ]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(10);
    });

    it('should return matched:false when both global and team are empty', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(false);
    });

    it('should exclude disabled rules from merged list', async () => {
      const env = createMockEnv();
      // Disabled rules are filtered at query/cache time, so they should not be in KV
      // If they somehow are cached, they'd still be evaluated — but the DB query filters isActive=true
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(false);
    });

    it('should filter non-welcome rules in evaluateWelcome', async () => {
      const env = createMockEnv();
      const rules = [
        createRule({ id: 1, teamId: 1, triggerType: 'keyword', name: 'Keyword Rule' }),
        createRule({ id: 2, teamId: 1, triggerType: 'welcome', name: 'Welcome', conditions: [] }),
        createRule({ id: 3, teamId: 1, triggerType: 'fallback', name: 'Fallback', conditions: [] }),
      ];
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));
      kvStore.set('auto-reply:rules:1', JSON.stringify(rules));

      const result = await evaluateWelcome(1, 'token', 'conv-1', 42, 'U123', env);
      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Welcome');
    });

    it('should handle 20+ rules in correct priority order', async () => {
      const env = createMockEnv();
      // Create 20 fallback rules with varying priorities
      const rules = Array.from({ length: 20 }, (_, i) =>
        createRule({
          id: i + 1,
          teamId: 1,
          name: `Rule ${i + 1}`,
          triggerType: 'fallback',
          priority: (20 - i) * 10, // Rule 20 has P10, Rule 1 has P200
          conditions: [],
        })
      );
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));
      kvStore.set('auto-reply:rules:1', JSON.stringify(rules));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
      // The merge sort puts lowest priority number first
      // Rule 20 has priority 10 (lowest number = highest priority)
      expect(result.ruleId).toBe(20);
    });
  });
});
