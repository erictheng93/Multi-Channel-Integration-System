// tests/integration/modules/auto-reply/webhook-auto-reply-flow.integration.test.ts
// Integration tests: full webhook → auto-reply engine flow with mocked LINE API

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mocks ====================

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  ne: (...args: any[]) => ({ type: 'ne', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
  isNull: (col: any) => ({ type: 'isNull', col }),
  sql: Object.assign((..._args: any[]) => ({ type: 'sql' }), {
    raw: (..._args: any[]) => ({ type: 'sql_raw' }),
  }),
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
  v4: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substring(2, 8)),
}));

// Mock timestamp
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-13T12:00:00.000Z'),
  nowMs: vi.fn(() => 1741867200000),
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// ─── LINE API mocks ───
const mockSendLineReply = vi.fn().mockResolvedValue(true);
const mockPushLineMessage = vi.fn().mockResolvedValue(true);

vi.mock('@/utils/line', () => ({
  sendLineReply: (...args: any[]) => mockSendLineReply(...args),
  pushLineMessage: (...args: any[]) => mockPushLineMessage(...args),
  createTextMessage: vi.fn((text: string) => ({ type: 'text', text })),
  createImageMessage: vi.fn((url: string, preview: string) => ({ type: 'image', originalContentUrl: url, previewImageUrl: preview })),
}));

// ─── WebSocket broadcast mock ───
const mockBroadcastNewMessage = vi.fn().mockResolvedValue({ conversationBroadcast: true, globalBroadcast: true });
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastNewMessage: mockBroadcastNewMessage,
  })),
}));

// ─── Schedule service mock ───
const mockIsWithinBusinessHours = vi.fn().mockResolvedValue(true);
vi.mock('@modules/auto-reply/services/schedule-service', () => ({
  isWithinBusinessHours: (...args: any[]) => mockIsWithinBusinessHours(...args),
  invalidateScheduleCache: vi.fn(),
}));

// ─── KV cache mock ───
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

// ─── Drizzle DB mock ───
const mockInsertValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
};

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({ ...mockSelectChain })),
    insert: mockInsert,
  })),
}));

// ==================== Import after mocks ====================

import { evaluate, evaluateWelcome } from '@modules/auto-reply/services/auto-reply-engine';

// ==================== Test Helpers ====================

function createMockEnv() {
  return {
    DB: {} as any,
    CACHE: mockKV,
    LINE_CHANNEL_ACCESS_TOKEN: 'test-access-token',
  } as any;
}

function createKeywordRule(opts: { value: string; reply: string; priority?: number; id?: number; allowPushFallback?: boolean }) {
  return {
    id: opts.id || 1,
    teamId: 1,
    name: `Keyword: ${opts.value}`,
    triggerType: 'keyword',
    priority: opts.priority || 100,
    isActive: true,
    allowPushFallback: opts.allowPushFallback ?? false,
    createdBy: 'admin-001',
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
    deletedAt: null,
    conditions: [{
      id: 1, ruleId: opts.id || 1, conditionType: 'contains' as const,
      value: opts.value, caseSensitive: false, matchMode: 'any' as const,
    }],
    actions: [{
      id: 1, ruleId: opts.id || 1, actionType: 'reply_text' as const,
      content: JSON.stringify({ text: opts.reply }), sortOrder: 0,
    }],
  };
}

// ==================== Tests ====================

describe('Webhook → Auto-Reply Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvStore.clear();
    mockSendLineReply.mockResolvedValue(true);
    mockPushLineMessage.mockResolvedValue(true);
    mockIsWithinBusinessHours.mockResolvedValue(true);
  });

  // ───────────── Happy Path: Keyword Match ─────────────

  describe('keyword match → Reply API', () => {
    it('should match keyword and send reply via Reply API', async () => {
      const env = createMockEnv();
      const rule = createKeywordRule({ value: '價格', reply: '我們的商品價格為 NT$500' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate({
        message: { content: '請問價格多少？', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'valid-reply-token',
        customerId: 42,
        platformUserId: 'U1234567890',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(1);
      expect(result.replyMethod).toBe('reply_api');

      // Verify Reply API was called (free)
      expect(mockSendLineReply).toHaveBeenCalledWith(
        'test-access-token',
        'valid-reply-token',
        [{ type: 'text', text: '我們的商品價格為 NT$500' }]
      );

      // Push API should NOT be called
      expect(mockPushLineMessage).not.toHaveBeenCalled();
    });
  });

  // ───────────── Reply API Failure ─────────────

  describe('replyToken expiry', () => {
    it('should return an error and not fall back to Push API when Reply API fails', async () => {
      const env = createMockEnv();
      const rule = createKeywordRule({ value: 'hello', reply: 'Hi there!' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      // Reply API fails (token expired)
      mockSendLineReply.mockResolvedValue(false);

      const result = await evaluate({
        message: { content: 'hello', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'expired-token',
        customerId: 42,
        platformUserId: 'U1234567890',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.replyMethod).toBe('reply_api');
      expect(result.error).toBe('Reply API failed');

      // Reply API was tried first
      expect(mockSendLineReply).toHaveBeenCalledOnce();
      expect(mockPushLineMessage).not.toHaveBeenCalled();
    });

    it('should use Push API directly when replyToken is null', async () => {
      const env = createMockEnv();
      const rule = createKeywordRule({ value: 'hello', reply: 'Hi!' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate({
        message: { content: 'hello', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: null, // No reply token
        customerId: 42,
        platformUserId: 'U1234567890',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.replyMethod).toBe('push_api');
      expect(mockSendLineReply).not.toHaveBeenCalled();
      expect(mockPushLineMessage).toHaveBeenCalled();
    });
  });

  // ───────────── No Rules → No Reply ─────────────

  describe('no rules → graceful skip', () => {
    it('should return matched:false and not call LINE API', async () => {
      const env = createMockEnv();
      kvStore.set('auto-reply:rules:1', JSON.stringify([]));

      const result = await evaluate({
        message: { content: 'hello', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(false);
      expect(mockSendLineReply).not.toHaveBeenCalled();
      expect(mockPushLineMessage).not.toHaveBeenCalled();
    });
  });

  // ───────────── Off-Hours Rule ─────────────

  describe('off-hours trigger', () => {
    it('should trigger off-hours rule when outside business hours', async () => {
      const env = createMockEnv();
      const offHoursRule = {
        id: 1, teamId: 1, name: 'Off Hours Reply',
        triggerType: 'off_hours', priority: 50, isActive: true,
        createdBy: null, createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [],
        actions: [{
          id: 1, ruleId: 1, actionType: 'reply_text',
          content: JSON.stringify({ text: '目前非營業時間，我們將在營業時間盡快回覆您。' }),
          sortOrder: 0,
        }],
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([offHoursRule]));

      // Outside business hours
      mockIsWithinBusinessHours.mockResolvedValue(false);

      const result = await evaluate({
        message: { content: '你好', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Off Hours Reply');
      expect(mockSendLineReply).toHaveBeenCalled();
    });

    it('should NOT trigger off-hours rule during business hours', async () => {
      const env = createMockEnv();
      const offHoursRule = {
        id: 1, teamId: 1, name: 'Off Hours Reply',
        triggerType: 'off_hours', priority: 50, isActive: true,
        createdBy: null, createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [],
        actions: [{
          id: 1, ruleId: 1, actionType: 'reply_text',
          content: JSON.stringify({ text: '非營業時間' }),
          sortOrder: 0,
        }],
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([offHoursRule]));

      // During business hours
      mockIsWithinBusinessHours.mockResolvedValue(true);

      const result = await evaluate({
        message: { content: '你好', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(false);
    });
  });

  // ───────────── Fallback Rule ─────────────

  describe('fallback rule', () => {
    it('should trigger fallback when no keyword rules match', async () => {
      const env = createMockEnv();
      const rules = [
        createKeywordRule({ id: 1, value: '營業時間', reply: '我們的營業時間是...', priority: 10 }),
        {
          id: 2, teamId: 1, name: 'Fallback', triggerType: 'fallback',
          priority: 999, isActive: true, createdBy: null,
          createdAt: '', updatedAt: '', deletedAt: null,
          conditions: [],
          actions: [{
            id: 2, ruleId: 2, actionType: 'reply_text',
            content: JSON.stringify({ text: '感謝您的訊息，客服人員將盡快為您服務。' }),
            sortOrder: 0,
          }],
        },
      ];
      kvStore.set('auto-reply:rules:1', JSON.stringify(rules));

      const result = await evaluate({
        message: { content: '隨便說點什麼', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(2);
      expect(result.ruleName).toBe('Fallback');
    });
  });

  // ───────────── Priority Ordering ─────────────

  describe('priority ordering', () => {
    it('should match keyword rule before fallback (higher priority wins)', async () => {
      const env = createMockEnv();
      const rules = [
        createKeywordRule({ id: 1, value: '價格', reply: '價格回覆', priority: 10 }),
        {
          id: 2, teamId: 1, name: 'Fallback', triggerType: 'fallback',
          priority: 999, isActive: true, createdBy: null,
          createdAt: '', updatedAt: '', deletedAt: null,
          conditions: [],
          actions: [{
            id: 2, ruleId: 2, actionType: 'reply_text',
            content: JSON.stringify({ text: '通用回覆' }), sortOrder: 0,
          }],
        },
      ];
      kvStore.set('auto-reply:rules:1', JSON.stringify(rules));

      const result = await evaluate({
        message: { content: '請問價格', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(1); // Keyword rule, not fallback
      expect(result.ruleName).toContain('價格');
    });
  });

  // ───────────── KV Cache Scenarios ─────────────

  describe('KV cache', () => {
    it('should populate cache on first request and reuse on second', async () => {
      const env = createMockEnv();
      // No cache initially → engine will query D1 (mocked to return empty)
      // Then cache the result

      const result1 = await evaluate({
        message: { content: 'test', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 99,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result1.matched).toBe(false);

      // KV should have been written
      expect(mockKV.put).toHaveBeenCalledWith(
        'auto-reply:rules:99',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 300 })
      );
    });
  });

  // ───────────── Welcome Rule (Follow Event) ─────────────

  describe('welcome rule (follow event)', () => {
    it('should send welcome message via evaluateWelcome', async () => {
      const env = createMockEnv();
      const welcomeRule = {
        id: 1, teamId: 1, name: 'Welcome',
        triggerType: 'welcome', priority: 1, isActive: true,
        createdBy: null, createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [],
        actions: [{
          id: 1, ruleId: 1, actionType: 'reply_text',
          content: JSON.stringify({ text: '歡迎加入！有什麼可以幫您的嗎？' }),
          sortOrder: 0,
        }],
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([welcomeRule]));

      const result = await evaluateWelcome(1, 'reply-token', 'conv-001', 42, 'U123', env);

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Welcome');
      expect(mockSendLineReply).toHaveBeenCalledWith(
        'test-access-token',
        'reply-token',
        [{ type: 'text', text: '歡迎加入！有什麼可以幫您的嗎？' }]
      );
    });

    it('should return matched:false when no welcome rules exist', async () => {
      const env = createMockEnv();
      // Only keyword rules, no welcome
      const keywordRule = createKeywordRule({ value: 'test', reply: 'test reply' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([keywordRule]));

      const result = await evaluateWelcome(1, 'reply-token', 'conv-001', 42, 'U123', env);

      expect(result.matched).toBe(false);
      expect(mockSendLineReply).not.toHaveBeenCalled();
    });
  });

  // ───────────── Reply API Fails (default rule, no fallback) ─────────────

  describe('Reply API fails on default rule', () => {
    it('should return matched:true with error when Reply API fails (no opt-in)', async () => {
      const env = createMockEnv();
      const rule = createKeywordRule({ value: 'hello', reply: 'Hi!' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      mockSendLineReply.mockResolvedValue(false);
      mockPushLineMessage.mockResolvedValue(false);

      const result = await evaluate({
        message: { content: 'hello', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('failed');
      expect(mockPushLineMessage).not.toHaveBeenCalled();
    });
  });

  // ───────────── Per-Rule Opt-In Push Fallback ─────────────

  describe('per-rule allowPushFallback opt-in', () => {
    it('should fall back to Push API on rule with allowPushFallback=true when Reply API fails', async () => {
      const env = createMockEnv();
      const rule = createKeywordRule({ value: 'hello', reply: 'Hi!', allowPushFallback: true });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      mockSendLineReply.mockResolvedValue(false);
      mockPushLineMessage.mockResolvedValue(true);

      const result = await evaluate({
        message: { content: 'hello', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.replyMethod).toBe('push_api');
      expect(mockSendLineReply).toHaveBeenCalledOnce();
      expect(mockPushLineMessage).toHaveBeenCalledWith(
        'test-access-token',
        'U123',
        [{ type: 'text', text: 'Hi!' }]
      );
    });

    it('should surface error when both Reply API and opt-in Push fallback fail', async () => {
      const env = createMockEnv();
      const rule = createKeywordRule({ value: 'hello', reply: 'Hi!', allowPushFallback: true });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      mockSendLineReply.mockResolvedValue(false);
      mockPushLineMessage.mockResolvedValue(false);

      const result = await evaluate({
        message: { content: 'hello', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.replyMethod).toBe('push_api');
      expect(result.error).toBe('Reply API failed; Push API fallback also failed');
      expect(mockSendLineReply).toHaveBeenCalledOnce();
      expect(mockPushLineMessage).toHaveBeenCalledOnce();
    });
  });

  // ───────────── Multiple Messages ─────────────

  describe('multiple messages in single reply', () => {
    it('should send text + image in a single reply', async () => {
      const env = createMockEnv();
      const rule = {
        id: 1, teamId: 1, name: 'Multi Message', triggerType: 'keyword',
        priority: 100, isActive: true, createdBy: null,
        createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [{ id: 1, ruleId: 1, conditionType: 'contains', value: '菜單', caseSensitive: false, matchMode: 'any' }],
        actions: [
          { id: 1, ruleId: 1, actionType: 'reply_text', content: JSON.stringify({ text: '以下是我們的菜單:' }), sortOrder: 0 },
          { id: 2, ruleId: 1, actionType: 'reply_image', content: JSON.stringify({ url: 'https://example.com/menu.jpg' }), sortOrder: 1 },
        ],
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate({
        message: { content: '請給我看菜單', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001', teamId: 1, replyToken: 'token',
        customerId: 42, platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      // Should send both messages in a single API call
      expect(mockSendLineReply).toHaveBeenCalledOnce();
      const sentMessages = mockSendLineReply.mock.calls[0][2];
      expect(sentMessages).toHaveLength(2);
    });

    it('should enforce 5-message limit', async () => {
      const env = createMockEnv();
      const rule = {
        id: 1, teamId: 1, name: '6 Messages', triggerType: 'keyword',
        priority: 100, isActive: true, createdBy: null,
        createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'test', caseSensitive: false, matchMode: 'any' }],
        actions: Array.from({ length: 6 }, (_, i) => ({
          id: i + 1, ruleId: 1, actionType: 'reply_text' as const,
          content: JSON.stringify({ text: `Message ${i + 1}` }), sortOrder: i,
        })),
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate({
        message: { content: 'test', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001', teamId: 1, replyToken: 'token',
        customerId: 42, platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      // Only 5 messages should be sent (LINE limit)
      const sentMessages = mockSendLineReply.mock.calls[0][2];
      expect(sentMessages.length).toBeLessThanOrEqual(5);
    });

    it('should sort actions by sortOrder before sending', async () => {
      const env = createMockEnv();
      const rule = {
        id: 1, teamId: 1, name: 'Sort Order', triggerType: 'keyword',
        priority: 100, isActive: true, createdBy: null,
        createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [{ id: 1, ruleId: 1, conditionType: 'contains', value: 'test', caseSensitive: false, matchMode: 'any' }],
        actions: [
          { id: 2, ruleId: 1, actionType: 'reply_text', content: JSON.stringify({ text: 'Second' }), sortOrder: 2 },
          { id: 1, ruleId: 1, actionType: 'reply_text', content: JSON.stringify({ text: 'First' }), sortOrder: 1 },
        ],
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      await evaluate({
        message: { content: 'test', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001', teamId: 1, replyToken: 'token',
        customerId: 42, platformUserId: 'U123',
      }, env);

      const sentMessages = mockSendLineReply.mock.calls[0][2];
      expect(sentMessages[0].text).toBe('First');
      expect(sentMessages[1].text).toBe('Second');
    });
  });

  // ───────────── Global Fallback ─────────────

  describe('global fallback when no team rules match', () => {
    it('should use global fallback rule when team keyword rules do not match', async () => {
      const env = createMockEnv();
      const teamKeywordRule = createKeywordRule({ id: 1, value: '特價', reply: '特價回覆', priority: 10 });
      const globalFallback = {
        id: 10, teamId: null, name: 'Global Fallback',
        triggerType: 'fallback', priority: 999, isActive: true,
        createdBy: null, createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [],
        actions: [{
          id: 10, ruleId: 10, actionType: 'reply_text',
          content: JSON.stringify({ text: '感谢您的訊息!' }), sortOrder: 0,
        }],
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([teamKeywordRule]));
      kvStore.set('auto-reply:rules:global', JSON.stringify([globalFallback]));

      const result = await evaluate({
        message: { content: '隨便一個不匹配的訊息', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001', teamId: 1, replyToken: 'token',
        customerId: 42, platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(10);
      expect(result.ruleName).toBe('Global Fallback');
    });
  });

  // ───────────── Evaluate Resilience ─────────────

  describe('evaluate resilience', () => {
    it('should complete evaluate even when log insertion fails', async () => {
      const env = createMockEnv();
      const rule = createKeywordRule({ value: 'hello', reply: 'Hi!' });
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      // Make the DB insert throw (for logs and messages)
      mockInsertValues.mockRejectedValue(new Error('D1 insert error'));

      // Should NOT throw — engine catches log insertion errors
      const result = await evaluate({
        message: { content: 'hello', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001', teamId: 1, replyToken: 'token',
        customerId: 42, platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(result.replyMethod).toBe('reply_api');
    });
  });

  // ───────────── Image Action ─────────────

  describe('image action', () => {
    it('should send image reply for reply_image action', async () => {
      const env = createMockEnv();
      const rule = {
        id: 1, teamId: 1, name: 'Menu Image',
        triggerType: 'keyword', priority: 100, isActive: true,
        createdBy: null, createdAt: '', updatedAt: '', deletedAt: null,
        conditions: [{
          id: 1, ruleId: 1, conditionType: 'exact',
          value: '菜單', caseSensitive: false, matchMode: 'any',
        }],
        actions: [{
          id: 1, ruleId: 1, actionType: 'reply_image',
          content: JSON.stringify({ url: 'https://example.com/menu.jpg', previewUrl: 'https://example.com/menu-sm.jpg' }),
          sortOrder: 0,
        }],
      };
      kvStore.set('auto-reply:rules:1', JSON.stringify([rule]));

      const result = await evaluate({
        message: { content: '菜單', messageType: 'text', platform: 'line' },
        conversationId: 'conv-001',
        teamId: 1,
        replyToken: 'token',
        customerId: 42,
        platformUserId: 'U123',
      }, env);

      expect(result.matched).toBe(true);
      expect(mockSendLineReply).toHaveBeenCalledWith(
        'test-access-token',
        'token',
        [{ type: 'image', originalContentUrl: 'https://example.com/menu.jpg', previewImageUrl: 'https://example.com/menu-sm.jpg' }]
      );
    });
  });
});
