// tests/smoke/auto-reply-smoke.test.ts
// Smoke tests: verify imports work, minimal inputs produce expected defaults

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
  autoReplySchedules: { teamId: {}, isActive: {}, name: 'auto_reply_schedules' },
  messages: { name: 'messages' },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-smoke'),
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

vi.mock('@/utils/line', () => ({
  sendLineReply: vi.fn().mockResolvedValue(true),
  pushLineMessage: vi.fn().mockResolvedValue(true),
  createTextMessage: vi.fn((text: string) => ({ type: 'text', text })),
  createImageMessage: vi.fn((url: string, preview: string) => ({ type: 'image', originalContentUrl: url, previewImageUrl: preview })),
}));

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastNewMessage: vi.fn().mockResolvedValue({ conversationBroadcast: true, globalBroadcast: true }),
  })),
}));

let mockRuleRows: any[] = [];
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockRuleRows)),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn().mockReturnThis() })),
  })),
}));

const kvStore = new Map<string, string>();
const mockKV = {
  get: vi.fn(async (key: string, format?: string) => {
    const val = kvStore.get(key);
    if (!val) return null;
    return format === 'json' ? JSON.parse(val) : val;
  }),
  put: vi.fn(async (key: string, value: string) => { kvStore.set(key, value); }),
  delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
};

function createMockEnv() {
  return { DB: {} as any, CACHE: mockKV, LINE_CHANNEL_ACCESS_TOKEN: 'test-token' } as any;
}

// ==================== Tests ====================

describe('Auto-Reply Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvStore.clear();
    mockRuleRows = [];
  });

  // ───────────── Import Verification ─────────────

  describe('imports', () => {
    it('should import all engine services without error', async () => {
      const engine = await import('@modules/auto-reply/services/auto-reply-engine');
      expect(typeof engine.evaluate).toBe('function');
      expect(typeof engine.evaluateWelcome).toBe('function');
      expect(typeof engine.invalidateRulesCache).toBe('function');
    });

    it('should import action-executor without error', async () => {
      const executor = await import('@modules/auto-reply/services/action-executor');
      expect(typeof executor.executeActions).toBe('function');
    });

    it('should import condition-matcher without error', async () => {
      const matcher = await import('@modules/auto-reply/services/condition-matcher');
      expect(typeof matcher.matchConditions).toBe('function');
    });

    it('should import schedule-service without error', async () => {
      const schedule = await import('@modules/auto-reply/services/schedule-service');
      expect(typeof schedule.isWithinBusinessHours).toBe('function');
      expect(typeof schedule.invalidateScheduleCache).toBe('function');
    });

    it('should import all types without error', async () => {
      const types = await import('@modules/auto-reply/types');
      // Type-only imports won't have runtime values, but the module should load
      expect(types).toBeDefined();
    });
  });

  // ───────────── Minimal Input Defaults ─────────────

  describe('minimal inputs — expected defaults', () => {
    it('evaluate() should return matched:false with no rules', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      const { evaluate } = await import('@modules/auto-reply/services/auto-reply-engine');
      const result = await evaluate({
        message: { content: 'test', messageType: 'text', platform: 'line' },
        conversationId: 'conv-1',
        teamId: 1,
        replyToken: null,
        customerId: 1,
        platformUserId: 'U1',
      }, env);

      expect(result.matched).toBe(false);
    });

    it('evaluateWelcome() should return matched:false with no welcome rules', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));
      kvStore.set('auto-reply:rules:global', JSON.stringify([]));

      const { evaluateWelcome } = await import('@modules/auto-reply/services/auto-reply-engine');
      const result = await evaluateWelcome(1, null, 'conv-1', 1, 'U1', env);

      expect(result.matched).toBe(false);
    });

    it('matchConditions() should return false for empty conditions', async () => {
      const { matchConditions } = await import('@modules/auto-reply/services/condition-matcher');
      const result = matchConditions('hello', 'text', []);
      expect(result).toBe(false);
    });

    it('executeActions() should return error for empty actions', async () => {
      const { executeActions } = await import('@modules/auto-reply/services/action-executor');
      const result = await executeActions([], null, 'U1', createMockEnv());
      expect(result.success).toBe(false);
      expect(result.error).toBe('No actions to execute');
    });

    it('invalidateRulesCache() should complete for non-existent key', async () => {
      const env = createMockEnv();
      const { invalidateRulesCache } = await import('@modules/auto-reply/services/auto-reply-engine');

      // Should not throw even when key doesn't exist
      await expect(invalidateRulesCache(99999, env)).resolves.toBeUndefined();
    });

    it('invalidateScheduleCache() should complete for non-existent key', async () => {
      const env = createMockEnv();
      const { invalidateScheduleCache } = await import('@modules/auto-reply/services/schedule-service');

      // Should not throw even when key doesn't exist
      await expect(invalidateScheduleCache(99999, env)).resolves.toBeUndefined();
    });
  });
});
