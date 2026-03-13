// tests/unit/modules/auto-reply/services/condition-matcher.test.ts
// Unit tests for the condition matcher — pure function, no mocking needed

import { describe, it, expect } from 'vitest';
import { matchConditions } from '@modules/auto-reply/services/condition-matcher';
import type { AutoReplyConditionData } from '@modules/auto-reply/types';

// ==================== Helper ====================

function createCondition(
  overrides: Partial<AutoReplyConditionData> = {}
): AutoReplyConditionData {
  return {
    id: 1,
    ruleId: 1,
    conditionType: 'contains',
    value: 'hello',
    caseSensitive: false,
    matchMode: 'any',
    ...overrides,
  };
}

// ==================== Tests ====================

describe('matchConditions', () => {
  // ───────────── Empty / Edge Cases ─────────────

  describe('edge cases', () => {
    it('should return false when conditions array is empty', () => {
      expect(matchConditions('hello', 'text', [])).toBe(false);
    });

    it('should return false for empty content with contains condition', () => {
      const conditions = [createCondition({ conditionType: 'contains', value: 'hello' })];
      expect(matchConditions('', 'text', conditions)).toBe(false);
    });

    it('should handle unknown condition type gracefully', () => {
      const conditions = [createCondition({ conditionType: 'unknown' as any, value: 'test' })];
      expect(matchConditions('test', 'text', conditions)).toBe(false);
    });
  });

  // ───────────── Exact Match ─────────────

  describe('exact match', () => {
    it('should match exact text (case insensitive)', () => {
      const conditions = [createCondition({ conditionType: 'exact', value: 'Hello' })];
      expect(matchConditions('hello', 'text', conditions)).toBe(true);
      expect(matchConditions('Hello', 'text', conditions)).toBe(true);
      expect(matchConditions('HELLO', 'text', conditions)).toBe(true);
    });

    it('should match exact text (case sensitive)', () => {
      const conditions = [createCondition({ conditionType: 'exact', value: 'Hello', caseSensitive: true })];
      expect(matchConditions('Hello', 'text', conditions)).toBe(true);
      expect(matchConditions('hello', 'text', conditions)).toBe(false);
      expect(matchConditions('HELLO', 'text', conditions)).toBe(false);
    });

    it('should trim content for exact match', () => {
      const conditions = [createCondition({ conditionType: 'exact', value: 'hello' })];
      expect(matchConditions('  hello  ', 'text', conditions)).toBe(true);
    });

    it('should not match partial text for exact', () => {
      const conditions = [createCondition({ conditionType: 'exact', value: 'hello' })];
      expect(matchConditions('hello world', 'text', conditions)).toBe(false);
    });
  });

  // ───────────── Contains Match ─────────────

  describe('contains match', () => {
    it('should match substring (case insensitive)', () => {
      const conditions = [createCondition({ conditionType: 'contains', value: 'price' })];
      expect(matchConditions('What is the price?', 'text', conditions)).toBe(true);
      expect(matchConditions('PRICE list please', 'text', conditions)).toBe(true);
    });

    it('should match substring (case sensitive)', () => {
      const conditions = [createCondition({ conditionType: 'contains', value: 'Price', caseSensitive: true })];
      expect(matchConditions('What is the Price?', 'text', conditions)).toBe(true);
      expect(matchConditions('what is the price?', 'text', conditions)).toBe(false);
    });

    it('should not match when substring is absent', () => {
      const conditions = [createCondition({ conditionType: 'contains', value: 'discount' })];
      expect(matchConditions('What is the price?', 'text', conditions)).toBe(false);
    });

    it('should match Chinese characters', () => {
      const conditions = [createCondition({ conditionType: 'contains', value: '價格' })];
      expect(matchConditions('請問價格是多少？', 'text', conditions)).toBe(true);
      expect(matchConditions('商品資訊', 'text', conditions)).toBe(false);
    });
  });

  // ───────────── Regex Match ─────────────

  describe('regex match', () => {
    it('should match valid regex pattern', () => {
      const conditions = [createCondition({ conditionType: 'regex', value: '\\d{3}-\\d{4}' })];
      expect(matchConditions('Call 123-4567', 'text', conditions)).toBe(true);
      expect(matchConditions('No number here', 'text', conditions)).toBe(false);
    });

    it('should match regex case insensitive by default', () => {
      const conditions = [createCondition({ conditionType: 'regex', value: '^hello' })];
      expect(matchConditions('Hello world', 'text', conditions)).toBe(true);
      expect(matchConditions('HELLO world', 'text', conditions)).toBe(true);
    });

    it('should match regex case sensitive when set', () => {
      const conditions = [createCondition({ conditionType: 'regex', value: '^Hello', caseSensitive: true })];
      expect(matchConditions('Hello world', 'text', conditions)).toBe(true);
      expect(matchConditions('hello world', 'text', conditions)).toBe(false);
    });

    it('should handle invalid regex gracefully (return false)', () => {
      const conditions = [createCondition({ conditionType: 'regex', value: '[invalid(' })];
      expect(matchConditions('test', 'text', conditions)).toBe(false);
    });

    it('should match multi-keyword regex pattern', () => {
      const conditions = [createCondition({ conditionType: 'regex', value: '(價格|價錢|多少錢)' })];
      expect(matchConditions('請問價格', 'text', conditions)).toBe(true);
      expect(matchConditions('這個多少錢', 'text', conditions)).toBe(true);
      expect(matchConditions('你好', 'text', conditions)).toBe(false);
    });
  });

  // ───────────── Message Type Match ─────────────

  describe('message_type match', () => {
    it('should match message type', () => {
      const conditions = [createCondition({ conditionType: 'message_type', value: 'image' })];
      expect(matchConditions('[圖片]', 'image', conditions)).toBe(true);
      expect(matchConditions('[圖片]', 'text', conditions)).toBe(false);
    });

    it('should match sticker type', () => {
      const conditions = [createCondition({ conditionType: 'message_type', value: 'sticker' })];
      expect(matchConditions('[貼圖]', 'sticker', conditions)).toBe(true);
      expect(matchConditions('[貼圖]', 'image', conditions)).toBe(false);
    });
  });

  // ───────────── Match Mode: ANY (OR) ─────────────

  describe('matchMode: any (OR logic)', () => {
    it('should match when at least one condition matches', () => {
      const conditions = [
        createCondition({ id: 1, conditionType: 'contains', value: 'hello', matchMode: 'any' }),
        createCondition({ id: 2, conditionType: 'contains', value: 'bye', matchMode: 'any' }),
      ];
      expect(matchConditions('hello there', 'text', conditions)).toBe(true);
      expect(matchConditions('goodbye', 'text', conditions)).toBe(true); // contains 'bye'
    });

    it('should not match when no conditions match', () => {
      const conditions = [
        createCondition({ id: 1, conditionType: 'contains', value: 'hello', matchMode: 'any' }),
        createCondition({ id: 2, conditionType: 'contains', value: 'bye', matchMode: 'any' }),
      ];
      expect(matchConditions('good morning', 'text', conditions)).toBe(false);
    });
  });

  // ───────────── Match Mode: ALL (AND) ─────────────

  describe('matchMode: all (AND logic)', () => {
    it('should match only when ALL conditions match', () => {
      const conditions = [
        createCondition({ id: 1, conditionType: 'contains', value: 'order', matchMode: 'all' }),
        createCondition({ id: 2, conditionType: 'contains', value: 'status', matchMode: 'all' }),
      ];
      expect(matchConditions('check order status', 'text', conditions)).toBe(true);
      expect(matchConditions('check order', 'text', conditions)).toBe(false);
      expect(matchConditions('check status', 'text', conditions)).toBe(false);
    });
  });

  // ───────────── Mixed Condition Types ─────────────

  describe('mixed condition types', () => {
    it('should handle mix of exact and contains with OR', () => {
      const conditions = [
        createCondition({ id: 1, conditionType: 'exact', value: '你好', matchMode: 'any' }),
        createCondition({ id: 2, conditionType: 'contains', value: '價格', matchMode: 'any' }),
      ];
      expect(matchConditions('你好', 'text', conditions)).toBe(true);
      expect(matchConditions('請問價格', 'text', conditions)).toBe(true);
      expect(matchConditions('再見', 'text', conditions)).toBe(false);
    });

    it('should handle mix of regex and message_type with OR', () => {
      const conditions = [
        createCondition({ id: 1, conditionType: 'regex', value: '^(hi|hello)', matchMode: 'any' }),
        createCondition({ id: 2, conditionType: 'message_type', value: 'sticker', matchMode: 'any' }),
      ];
      expect(matchConditions('hi there', 'text', conditions)).toBe(true);
      expect(matchConditions('[貼圖]', 'sticker', conditions)).toBe(true);
      expect(matchConditions('goodbye', 'text', conditions)).toBe(false);
    });
  });
});
