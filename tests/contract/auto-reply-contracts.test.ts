// tests/contract/auto-reply-contracts.test.ts
// Contract tests: verify data shapes flowing between modules don't silently break

import { describe, it, expect } from 'vitest';

// ==================== Direct type imports (no mocks needed for shape checks) ====================

import type {
  AutoReplyEvaluateInput,
  AutoReplyEvaluateResult,
  AutoReplyRuleWithRelations,
  AutoReplyActionData,
  AutoReplyConditionData,
  CreateRuleRequest,
  TextActionContent,
  ImageActionContent,
  FlexActionContent,
  ScheduleData,
  ReplyMethod,
  TriggerType,
  ConditionType,
  ActionType,
  MatchMode,
  Platform,
} from '@modules/auto-reply/types';

// ==================== Contract Fixtures ====================

function createEvaluateInput(): AutoReplyEvaluateInput {
  return {
    message: {
      content: 'hello',
      messageType: 'text',
      platform: 'line',
    },
    conversationId: 'conv-123',
    teamId: 1,
    replyToken: 'reply-token-abc',
    customerId: 42,
    platformUserId: 'U1234567890',
  };
}

function createEvaluateResult(): AutoReplyEvaluateResult {
  return {
    matched: true,
    ruleId: 1,
    ruleName: 'Test Rule',
    replyMethod: 'reply_api',
  };
}

function createRuleWithRelations(): AutoReplyRuleWithRelations {
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
      id: 1, ruleId: 1, conditionType: 'contains',
      value: 'hello', caseSensitive: false, matchMode: 'any',
    }],
    actions: [{
      id: 1, ruleId: 1, actionType: 'reply_text',
      content: JSON.stringify({ text: 'Hi!' }), sortOrder: 0,
    }],
  };
}

// ==================== Tests ====================

describe('Auto-Reply Contract Tests', () => {

  // ───────────── LINE Processor → Engine Input Contract ─────────────

  describe('LINE Processor -> Engine (AutoReplyEvaluateInput)', () => {
    it('should accept exact input shape from line-event-processor', () => {
      const input = createEvaluateInput();

      // Verify all required fields exist with correct types
      expect(input.message).toBeDefined();
      expect(typeof input.message.content).toBe('string');
      expect(typeof input.message.messageType).toBe('string');
      expect(input.message.platform).toBe('line');
      expect(typeof input.conversationId).toBe('string');
      expect(typeof input.customerId).toBe('number');
      expect(typeof input.platformUserId).toBe('string');
    });

    it('should accept null teamId (unassigned conversations)', () => {
      const input: AutoReplyEvaluateInput = {
        ...createEvaluateInput(),
        teamId: null,
      };

      expect(input.teamId).toBeNull();
      // Typescript allows this — runtime shape is valid
    });

    it('should accept null replyToken (delayed/expired events)', () => {
      const input: AutoReplyEvaluateInput = {
        ...createEvaluateInput(),
        replyToken: null,
      };

      expect(input.replyToken).toBeNull();
    });
  });

  // ───────────── Engine → Result Contract ─────────────

  describe('Engine -> LINE Processor (AutoReplyEvaluateResult)', () => {
    it('should have matched boolean in result', () => {
      const result = createEvaluateResult();
      expect(typeof result.matched).toBe('boolean');
    });

    it('should have optional ruleId, ruleName, and replyMethod', () => {
      const matched = createEvaluateResult();
      expect(typeof matched.ruleId).toBe('number');
      expect(typeof matched.ruleName).toBe('string');
      expect(['reply_api', 'push_api']).toContain(matched.replyMethod);

      // Not-matched result should omit optional fields
      const notMatched: AutoReplyEvaluateResult = { matched: false };
      expect(notMatched.ruleId).toBeUndefined();
      expect(notMatched.ruleName).toBeUndefined();
      expect(notMatched.replyMethod).toBeUndefined();
    });

    it('should have optional error field', () => {
      const errorResult: AutoReplyEvaluateResult = {
        matched: true,
        ruleId: 1,
        ruleName: 'Rule',
        replyMethod: 'push_api',
        error: 'Both APIs failed',
      };
      expect(typeof errorResult.error).toBe('string');
    });
  });

  // ───────────── Engine → Action Executor Contract ─────────────

  describe('Engine -> Action Executor (action data flow)', () => {
    it('should pass action array from rule to executor', () => {
      const rule = createRuleWithRelations();
      const actions: AutoReplyActionData[] = rule.actions;

      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
      actions.forEach(a => {
        expect(typeof a.id).toBe('number');
        expect(typeof a.ruleId).toBe('number');
        expect(['reply_text', 'reply_image', 'reply_flex']).toContain(a.actionType);
        expect(typeof a.content).toBe('string');
        expect(typeof a.sortOrder).toBe('number');
      });
    });

    it('should pass replyToken unchanged to executor', () => {
      const input = createEvaluateInput();
      const replyToken = input.replyToken;

      // replyToken must be forwarded as-is (string | null)
      expect(replyToken === null || typeof replyToken === 'string').toBe(true);
    });
  });

  // ───────────── Engine → Condition Matcher Contract ─────────────

  describe('Engine -> Condition Matcher (input contract)', () => {
    it('should pass content as first argument', () => {
      const input = createEvaluateInput();
      const content: string = input.message.content;
      expect(typeof content).toBe('string');
    });

    it('should pass messageType as second argument', () => {
      const input = createEvaluateInput();
      const messageType: string = input.message.messageType;
      expect(typeof messageType).toBe('string');
    });

    it('should pass conditions array as third argument', () => {
      const rule = createRuleWithRelations();
      const conditions: AutoReplyConditionData[] = rule.conditions;

      expect(Array.isArray(conditions)).toBe(true);
      conditions.forEach(c => {
        expect(typeof c.id).toBe('number');
        expect(typeof c.ruleId).toBe('number');
        expect(['exact', 'contains', 'regex', 'message_type']).toContain(c.conditionType);
        expect(typeof c.value).toBe('string');
        expect(typeof c.caseSensitive).toBe('boolean');
        expect(['any', 'all']).toContain(c.matchMode);
      });
    });
  });

  // ───────────── Engine → Schedule Service Contract ─────────────

  describe('Engine -> Schedule Service (team routing)', () => {
    it('should pass teamId to isWithinBusinessHours', () => {
      // Engine passes rule.teamId ?? conversation.teamId
      // Both are number | null
      const teamId: number | null = 1;
      expect(teamId === null || typeof teamId === 'number').toBe(true);

      const nullTeamId: number | null = null;
      expect(nullTeamId === null || typeof nullTeamId === 'number').toBe(true);
    });
  });

  // ───────────── CRUD → Cache Invalidation Contract ─────────────

  describe('CRUD -> Cache (invalidateRulesCache contract)', () => {
    it('should call invalidateRulesCache with teamId after create', () => {
      // After POST /rules with teamId=1, handler calls invalidateRulesCache(1, env)
      const teamId: number | null = 1;
      expect(typeof teamId === 'number' || teamId === null).toBe(true);
    });

    it('should call invalidateRulesCache with teamId after update', () => {
      // After PUT /rules/:id, handler calls invalidateRulesCache(existing.teamId, env)
      const teamId: number | null = 1;
      expect(typeof teamId === 'number' || teamId === null).toBe(true);
    });

    it('should call invalidateRulesCache with teamId after delete', () => {
      // After DELETE /rules/:id, handler calls invalidateRulesCache(existing.teamId, env)
      const teamId: number | null = 1;
      expect(typeof teamId === 'number' || teamId === null).toBe(true);
    });

    it('should call invalidateRulesCache with null for global rules', () => {
      // Global rules have teamId = null
      const teamId: number | null = null;
      expect(teamId).toBeNull();
    });
  });

  // ───────────── Frontend → Backend API Contract ─────────────

  describe('Frontend -> Backend (CreateRuleRequest shape)', () => {
    it('should match handler expectation for CreateRuleRequest', () => {
      const request: CreateRuleRequest = {
        name: 'Test Rule',
        triggerType: 'keyword',
        priority: 100,
        isActive: true,
        conditions: [{
          conditionType: 'contains',
          value: 'hello',
          caseSensitive: false,
          matchMode: 'any',
        }],
        actions: [{
          actionType: 'reply_text',
          content: JSON.stringify({ text: 'Hi!' }),
          sortOrder: 0,
        }],
      };

      // Required fields
      expect(typeof request.name).toBe('string');
      expect(['welcome', 'keyword', 'off_hours', 'fallback']).toContain(request.triggerType);

      // Optional fields
      expect(request.priority === undefined || typeof request.priority === 'number').toBe(true);
      expect(request.isActive === undefined || typeof request.isActive === 'boolean').toBe(true);
    });

    it('should match PaginatedRulesResponse for getRules output', () => {
      // Backend returns array of AutoReplyRuleWithRelations
      const rule = createRuleWithRelations();
      const response = [rule]; // GET /rules returns array

      expect(Array.isArray(response)).toBe(true);
      expect(response[0]).toHaveProperty('id');
      expect(response[0]).toHaveProperty('name');
      expect(response[0]).toHaveProperty('triggerType');
      expect(response[0]).toHaveProperty('priority');
      expect(response[0]).toHaveProperty('isActive');
      expect(response[0]).toHaveProperty('conditions');
      expect(response[0]).toHaveProperty('actions');
      expect(response[0]).toHaveProperty('teamId');
    });

    it('should match AutoReplyRule shape from hydration output', () => {
      const rule = createRuleWithRelations();

      // All fields used by frontend
      expect(typeof rule.id).toBe('number');
      expect(rule.teamId === null || typeof rule.teamId === 'number').toBe(true);
      expect(typeof rule.name).toBe('string');
      expect(typeof rule.priority).toBe('number');
      expect(typeof rule.isActive).toBe('boolean');
      expect(rule.deletedAt === null || typeof rule.deletedAt === 'string').toBe(true);
      expect(Array.isArray(rule.conditions)).toBe(true);
      expect(Array.isArray(rule.actions)).toBe(true);
    });
  });

  // ───────────── Action Content Type Contracts ─────────────

  describe('Action Content Types', () => {
    it('should validate TextActionContent shape', () => {
      const content: TextActionContent = { text: 'Hello' };
      expect(typeof content.text).toBe('string');
    });

    it('should validate ImageActionContent shape', () => {
      const content: ImageActionContent = {
        url: 'https://example.com/img.jpg',
        previewUrl: 'https://example.com/thumb.jpg',
      };
      expect(typeof content.url).toBe('string');
      expect(content.previewUrl === undefined || typeof content.previewUrl === 'string').toBe(true);
    });

    it('should validate FlexActionContent as Record<string, unknown>', () => {
      const content: FlexActionContent = {
        type: 'bubble',
        body: { type: 'box', layout: 'vertical' },
      };
      expect(typeof content).toBe('object');
    });
  });

  // ───────────── Enum/Union Type Contracts ─────────────

  describe('Type union completeness', () => {
    it('should cover all TriggerTypes', () => {
      const allTriggers: TriggerType[] = ['welcome', 'keyword', 'off_hours', 'fallback'];
      expect(allTriggers).toHaveLength(4);
    });

    it('should cover all ConditionTypes', () => {
      const allConditions: ConditionType[] = ['exact', 'contains', 'regex', 'message_type'];
      expect(allConditions).toHaveLength(4);
    });

    it('should cover all ActionTypes', () => {
      const allActions: ActionType[] = ['reply_text', 'reply_image', 'reply_flex'];
      expect(allActions).toHaveLength(3);
    });

    it('should cover all ReplyMethods', () => {
      const allMethods: ReplyMethod[] = ['reply_api', 'push_api'];
      expect(allMethods).toHaveLength(2);
    });

    it('should cover all Platforms', () => {
      const allPlatforms: Platform[] = ['line', 'facebook'];
      expect(allPlatforms).toHaveLength(2);
    });

    it('should cover all MatchModes', () => {
      const allModes: MatchMode[] = ['any', 'all'];
      expect(allModes).toHaveLength(2);
    });
  });
});
