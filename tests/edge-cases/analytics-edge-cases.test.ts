// Analytics Edge Cases and Boundary Conditions Test
// 邊界條件和極端場景測試

import { describe, test, expect, beforeAll, vi } from 'vitest';
import { createDbClient } from '@/db/drizzle-factory';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import type { ConversationAnalyticsQuery } from '../../src/modules/analytics/types/analytics-types';


/**
 * 邊界條件測試配置
 * 測試極端輸入和異常場景的處理
 */
describe('Analytics Edge Cases and Boundary Conditions', () => {
  let analyticsService: AnalyticsService;
  let testEnv: Record<string, string>;

  beforeAll(async () => {
    try {
      testEnv = {
        ENVIRONMENT: 'test',
        JWT_SECRET: 'test-secret-key'
      };

      const mockD1 = {
        prepare: vi.fn().mockImplementation(() => ({
          bind: vi.fn().mockImplementation(function() {
            return {
              all: vi.fn().mockResolvedValue({ results: [] }),
              raw: vi.fn().mockResolvedValue([]),
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ success: true, meta: {} })
            };
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          raw: vi.fn().mockResolvedValue([]),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true, meta: {} })
        })),
        batch: vi.fn().mockResolvedValue([]),
        dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 })
      } as unknown as D1Database;

      analyticsService = new AnalyticsService({
        database: createDbClient(mockD1),
        kv: undefined,
        env: testEnv
      });

    } catch (error) {
      console.error(' Failed to initialize edge cases test environment:', error);
      throw error;
    }
  });

  describe('Time range validation', () => {
    test('rejects a range whose end is before its start', async () => {
      const result = await analyticsService.getConversationAnalytics({
        startDate: '2024-12-31',
        endDate: '2024-01-01',
        metrics: ['total_conversations']
      } as never);

      expect(result.success).toBe(false);
      expect(result.metadata?.errorCode).toBe('VALIDATION_ERROR');
    });

    test('accepts a same-day range (start equals end)', async () => {
      const result = await analyticsService.getConversationAnalytics({
        startDate: '2024-06-15',
        endDate: '2024-06-15',
        metrics: ['total_conversations']
      } as never);

      expect(result.success).toBe(true);
    });
  });

  describe('Empty data', () => {
    test('an empty result set yields zero totals', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '1h',
        metrics: ['total_conversations'],
        filters: { teamId: 999999 }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data.summary.totalConversations).toBe(0);
    });
  });
});
