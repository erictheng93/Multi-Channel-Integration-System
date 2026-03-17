// tests/unit/modules/auto-reply/services/auto-reply-engine.test.ts
// Unit tests for the auto-reply evaluation engine

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mocks ====================

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  isNull: (col: any) => ({ type: 'isNull', col }),
}));

// Mock schema
vi.mock('@/db/schema', () => ({
  autoReplyRules: { teamId: {}, isActive: {}, deletedAt: {}, priority: {}, name: 'auto_reply_rules' },
  autoReplyConditions: { ruleId: {}, name: 'auto_reply_conditions' },
  autoReplyActions: { ruleId: {}, name: 'auto_reply_actions' },
  autoReplyLogs: { name: 'auto_reply_logs' },
  messages: { name: 'messages' },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// Mock timestamp
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-13T12:00:00.000Z'),
  nowMs: vi.fn(() => 1741867200000),
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Action Executor mock ───
const mockExecuteActions = vi.fn();
vi.mock('@modules/auto-reply/services/action-executor', () => ({
  executeActions: (...args: any[]) => mockExecuteActions(...args),
}));

// ─── Schedule Service mock ───
const mockIsWithinBusinessHours = vi.fn();
vi.mock('@modules/auto-reply/services/schedule-service', () => ({
  isWithinBusinessHours: (...args: any[]) => mockIsWithinBusinessHours(...args),
}));

// ─── WebSocket Broadcast mock ───
const mockBroadcastNewMessage = vi.fn().mockResolvedValue({ conversationBroadcast: true, globalBroadcast: true });
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastNewMessage: mockBroadcastNewMessage,
  })),
}));

// ─── Drizzle DB mock ───
let mockRuleRows: any[] = [];
let mockConditionRows: any[] = [];
let mockActionRows: any[] = [];
const mockInsertValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockRuleRows)),
        })),
        // For conditions and actions (no where/orderBy)
        then: undefined,
      })),
    })),
    insert: mockInsert,
  })),
}));

// ─── KV Cache mock ───
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

import { evaluate, evaluateWelcome, invalidateRulesCache } from '@modules/auto-reply/services/auto-reply-engine';

// ==================== Test Fixtures ====================

function createRuleFixture(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    teamId: 1,
    name: 'Test Rule',
    triggerType: 'keyword',
    priority: 100,
    isActive: true,
    createdBy: 'admin-1',
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
    deletedAt: null,
    conditions: [{
      id: 1,
      ruleId: 1,
      conditionType: 'contains',
      value: 'hello',
      caseSensitive: false,
      matchMode: 'any',
    }],
    actions: [{
      id: 1,
      ruleId: 1,
      actionType: 'reply_text',
      content: JSON.stringify({ text: 'Hi there!' }),
      sortOrder: 0,
    }],
    ...overrides,
  };
}

function createInput(overrides: Record<string, any> = {}) {
  return {
    message: { content: 'hello world', messageType: 'text', platform: 'line' as const },
    conversationId: 'conv-123',
    teamId: 1,
    replyToken: 'reply-token-abc',
    customerId: 42,
    platformUserId: 'U1234567890',
    ...overrides,
  };
}

// ==================== Tests ====================

describe('auto-reply-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvStore.clear();
    mockRuleRows = [];
    mockConditionRows = [];
    mockActionRows = [];
    mockExecuteActions.mockResolvedValue({
      success: true,
      replyMethod: 'reply_api',
      messageCount: 1,
    });
    mockIsWithinBusinessHours.mockResolvedValue(true);
    // Pre-cache empty global rules so tests don't need D1 for global query
    kvStore.set('auto-reply:rules:global', JSON.stringify([]));
  });

  // ───────────── No Rules ─────────────

  describe('no rules configured', () => {
    it('should return matched:false when no rules exist for team', async () => {
      const env = createMockEnv();
      // Empty KV cache → will query D1 which also returns empty
      // Pre-cache empty rules
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));

      const result = await evaluate(createInput(), env);

      expect(result.matched).toBe(false);
    });
  });

  // ───────────── Priority Ordering ─────────────

  describe('priority ordering (first match wins)', () => {
    it('should match higher priority rule first (lower number = higher priority)', async () => {
      const env = createMockEnv();

      const lowPriorityRule = createRuleFixture({
        id: 2,
        name: 'Low Priority',
        priority: 200,
        conditions: [{ id: 2, ruleId: 2, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }],
        actions: [{ id: 2, ruleId: 2, actionType: 'reply_text', content: JSON.stringify({ text: 'Low' }), sortOrder: 0 }],
      });

      const highPriorityRule = createRuleFixture({
        id: 1,
        name: 'High Priority',
        priority: 10,
        conditions: [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' }],
        actions: [{ id: 1, ruleId: 1, actionType: 'reply_text', content: JSON.stringify({ text: 'High' }), sortOrder: 0 }],
      });

      // Rules are pre-sorted by priority in the cache
      kvStore.set('auto-reply:rules:1', JSON.stringify([highPriorityRule, lowPriorityRule]));

      const result = await evaluate(createInput(), env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(1);
      expect(result.ruleName).toBe('High Priority');
    });
  });

  // ───────────── Trigger Type Filtering ─────────────

  describe('trigger type filtering', () => {
    it('should skip welcome rules (handled separately)', async () => {
      const env = createMockEnv();
      const welcomeRule = createRuleFixture({ triggerType: 'welcome' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([welcomeRule]));

      const result = await evaluate(createInput(), env);

      expect(result.matched).toBe(false);
    });

    it('should only match keyword rules for text messages', async () => {
      const env = createMockEnv();
      const keywordRule = createRuleFixture({ triggerType: 'keyword' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([keywordRule]));

      // Text message with matching content → should match
      const textResult = await evaluate(createInput(), env);
      expect(textResult.matched).toBe(true);

      // Image message → keyword rule should not be eligible
      const imageResult = await evaluate(
        createInput({ message: { content: '[圖片]', messageType: 'image', platform: 'line' } }),
        env
      );
      expect(imageResult.matched).toBe(false);
    });

    it('should match off_hours rule only when outside business hours', async () => {
      const env = createMockEnv();
      const offHoursRule = createRuleFixture({
        triggerType: 'off_hours',
        conditions: [], // off_hours doesn't need conditions
      });
      kvStore.set('auto-reply:rules:1', JSON.stringify([offHoursRule]));

      // During business hours → should NOT match
      mockIsWithinBusinessHours.mockResolvedValue(true);
      const duringResult = await evaluate(createInput(), env);
      expect(duringResult.matched).toBe(false);

      // Outside business hours → should match
      mockIsWithinBusinessHours.mockResolvedValue(false);
      const outsideResult = await evaluate(createInput(), env);
      expect(outsideResult.matched).toBe(true);
    });

    it('should always match fallback rule', async () => {
      const env = createMockEnv();
      const fallbackRule = createRuleFixture({
        triggerType: 'fallback',
        conditions: [], // fallback doesn't need conditions
      });
      kvStore.set('auto-reply:rules:1', JSON.stringify([fallbackRule]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
    });
  });

  // ───────────── Keyword Condition Matching ─────────────

  describe('keyword condition matching', () => {
    it('should not match keyword rule with empty conditions', async () => {
      const env = createMockEnv();
      const rule = createRuleFixture({ conditions: [] });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(false);
    });

    it('should match keyword rule when content matches condition', async () => {
      const env = createMockEnv();
      const rule = createRuleFixture({
        conditions: [{
          id: 1, ruleId: 1, conditionType: 'contains', value: 'hello',
          caseSensitive: false, matchMode: 'any',
        }],
      });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate(createInput({ message: { content: 'hello world', messageType: 'text', platform: 'line' } }), env);
      expect(result.matched).toBe(true);
    });

    it('should not match keyword rule when content does not match', async () => {
      const env = createMockEnv();
      const rule = createRuleFixture({
        conditions: [{
          id: 1, ruleId: 1, conditionType: 'contains', value: 'discount',
          caseSensitive: false, matchMode: 'any',
        }],
      });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate(createInput({ message: { content: 'hello world', messageType: 'text', platform: 'line' } }), env);
      expect(result.matched).toBe(false);
    });
  });

  // ───────────── Action Execution ─────────────

  describe('action execution', () => {
    it('should call executeActions when rule matches', async () => {
      const env = createMockEnv();
      const rule = createRuleFixture();
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      await evaluate(createInput(), env);

      expect(mockExecuteActions).toHaveBeenCalledWith(
        rule.actions,
        'reply-token-abc',
        'U1234567890',
        env
      );
    });

    it('should return replyMethod from action executor result', async () => {
      const env = createMockEnv();
      const rule = createRuleFixture();
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      mockExecuteActions.mockResolvedValue({
        success: true,
        replyMethod: 'push_api',
        messageCount: 1,
      });

      const result = await evaluate(createInput(), env);
      expect(result.replyMethod).toBe('push_api');
    });

    it('should return error when action execution fails', async () => {
      const env = createMockEnv();
      const rule = createRuleFixture();
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      mockExecuteActions.mockResolvedValue({
        success: false,
        replyMethod: 'reply_api',
        messageCount: 0,
        error: 'LINE API error',
      });

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
      expect(result.error).toBe('LINE API error');
    });
  });

  // ───────────── WebSocket Broadcast ─────────────

  describe('WebSocket broadcast', () => {
    it('should broadcast auto-reply message on successful match', async () => {
      const env = createMockEnv();
      const rule = createRuleFixture();
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      await evaluate(createInput(), env);

      expect(mockBroadcastNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-123',
          source: 'api',
          teamId: 1,
        })
      );
    });
  });

  // ───────────── Error Handling ─────────────

  describe('error handling', () => {
    it('should return matched:false with error on exception', async () => {
      const env = createMockEnv();

      // Force KV to throw
      mockKV.get.mockRejectedValueOnce(new Error('KV exploded'));

      // Also need D1 to fail — mock createDbClient to throw
      const { createDbClient } = await import('@/db/drizzle-factory');
      (createDbClient as any).mockImplementationOnce(() => {
        throw new Error('D1 exploded');
      });

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ───────────── Disabled Rules ─────────────

  describe('disabled rules', () => {
    it('should not include inactive rules (they are filtered at query time)', async () => {
      const env = createMockEnv();
      // Only active rules should be in the cache
      const activeRule = createRuleFixture({ id: 1, isActive: true });
      kvStore.set('auto-reply:rules:1', JSON.stringify([activeRule]));

      const result = await evaluate(createInput(), env);
      expect(result.matched).toBe(true);
    });
  });

  // ───────────── evaluateWelcome ─────────────

  describe('evaluateWelcome', () => {
    it('should return matched:false when no welcome rules exist', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));

      const result = await evaluateWelcome(1, 'reply-token', 'conv-1', 42, 'U123', env);
      expect(result.matched).toBe(false);
    });

    it('should match and execute welcome rule', async () => {
      const env = createMockEnv();
      const welcomeRule = createRuleFixture({
        triggerType: 'welcome',
        name: 'Welcome Message',
        conditions: [],
        actions: [{
          id: 1, ruleId: 1, actionType: 'reply_text',
          content: JSON.stringify({ text: 'Welcome!' }),
          sortOrder: 0,
        }],
      });
      kvStore.set('auto-reply:rules:1', JSON.stringify([welcomeRule]));

      const result = await evaluateWelcome(1, 'reply-token', 'conv-1', 42, 'U123', env);

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Welcome Message');
      expect(mockExecuteActions).toHaveBeenCalled();
    });

    it('should use highest priority welcome rule when multiple exist', async () => {
      const env = createMockEnv();
      const rules = [
        createRuleFixture({ id: 1, triggerType: 'welcome', name: 'Welcome High', priority: 10 }),
        createRuleFixture({ id: 2, triggerType: 'welcome', name: 'Welcome Low', priority: 200 }),
        createRuleFixture({ id: 3, triggerType: 'keyword', name: 'Not Welcome' }), // should be filtered out
      ];
      kvStore.set('auto-reply:rules:1', JSON.stringify(rules));

      const result = await evaluateWelcome(1, 'reply-token', 'conv-1', 42, 'U123', env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(1);
      expect(result.ruleName).toBe('Welcome High');
    });
  });

  // ───────────── Cache Invalidation ─────────────

  describe('invalidateRulesCache', () => {
    it('should delete KV cache key for team', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:5', JSON.stringify([createRuleFixture()]));

      await invalidateRulesCache(5, env);

      expect(mockKV.delete).toHaveBeenCalledWith('auto-reply:rules:5');
    });

    it('should delete global KV cache key when teamId is null', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:global', JSON.stringify([createRuleFixture()]));

      await invalidateRulesCache(null, env);

      expect(mockKV.delete).toHaveBeenCalledWith('auto-reply:rules:global');
    });
  });

  // ───────────── Global Rules (teamId = null) ─────────────

  describe('global rules (channel-level)', () => {
    it('should match global rules when teamId is null', async () => {
      const env = createMockEnv();
      const globalRule = createRuleFixture({ id: 10, teamId: null, name: 'Global Keyword' });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalRule]));

      const result = await evaluate(createInput({ teamId: null }), env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(10);
      expect(result.ruleName).toBe('Global Keyword');
    });

    it('should merge global and team rules with team rules winning at same priority', async () => {
      const env = createMockEnv();
      const globalRule = createRuleFixture({
        id: 10, teamId: null, name: 'Global Fallback',
        triggerType: 'fallback', priority: 100, conditions: [],
      });
      const teamRule = createRuleFixture({
        id: 20, teamId: 1, name: 'Team Fallback',
        triggerType: 'fallback', priority: 100, conditions: [],
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalRule]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([teamRule]));

      const result = await evaluate(createInput({ teamId: 1 }), env);

      expect(result.matched).toBe(true);
      // Team rule should win at same priority
      expect(result.ruleId).toBe(20);
      expect(result.ruleName).toBe('Team Fallback');
    });

    it('should use global rule when no team rules exist', async () => {
      const env = createMockEnv();
      const globalRule = createRuleFixture({
        id: 10, teamId: null, name: 'Global Welcome',
        triggerType: 'welcome',
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalRule]));
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));

      const result = await evaluateWelcome(1, 'reply-token', 'conv-1', 42, 'U123', env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(10);
    });

    it('should evaluateWelcome with null teamId using global rules', async () => {
      const env = createMockEnv();
      const globalWelcome = createRuleFixture({
        id: 10, teamId: null, name: 'Global Welcome',
        triggerType: 'welcome',
        actions: [{ id: 1, ruleId: 10, actionType: 'reply_text', content: JSON.stringify({ text: 'Welcome!' }), sortOrder: 0 }],
      });
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalWelcome]));

      const result = await evaluateWelcome(null, 'reply-token', 'conv-1', 42, 'U123', env);

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Global Welcome');
    });
  });
});
