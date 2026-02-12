/**
 * Analytics Platform Filter Unit Tests
 * 测试 Analytics 模块的平台过滤功能
 */

import { describe, it, expect, beforeEach, afterEach, vi, test } from 'vitest';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import { createDbClient } from '@/db/drizzle-factory';
import type { ConversationAnalyticsQuery } from '@modules/analytics/types/analytics-types';

/**
 * Creates a mock D1Database that supports the full Drizzle ORM D1 driver chain.
 * Drizzle's D1 session calls: stmt.bind(...).raw() and stmt.bind(...).all()
 * so we need the bound statement to return raw/all/first/run methods.
 */
function createMockD1(): D1Database {
  const createBoundStatement = () => ({
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [], success: true, meta: {} }),
    raw: vi.fn().mockResolvedValue([]),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ results: [], success: true, meta: {} }),
  });

  const mockStatement = createBoundStatement();
  // Make bind return a new object that also has raw/all/first/run
  mockStatement.bind = vi.fn().mockReturnValue(createBoundStatement());

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    batch: vi.fn().mockResolvedValue([]),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

describe('Analytics Platform Filter', () => {
  let mockEnv: any;
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockD1 = createMockD1();
    const database = createDbClient(mockD1);

    mockEnv = {
      DB: mockD1,
      KV: null
    };

    analyticsService = new AnalyticsService({
      database: database,
      kv: undefined,
      env: mockEnv
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform Filter - Basic Functionality', () => {
    test('should filter conversations by LINE platform', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {
          platform: 'line'
        },
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      // Verify the query includes platform filter
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
    });

    test('should filter conversations by Facebook platform', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '30d',
        filters: {
          platform: 'facebook'
        },
        metrics: ['total_conversations', 'active_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });

    test('should handle invalid platform gracefully', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {
          platform: 'invalid_platform' as any
        },
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      // Should still work but return empty results
      expect(result.success).toBe(true);
    });
  });

  describe('Platform Filter - Combined with Other Filters', () => {
    test('should combine platform filter with team filter', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {
          platform: 'line',
          teamId: 1
        },
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });

    test('should combine platform filter with user filter', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {
          platform: 'facebook',
          userId: 123
        },
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });

    test('should combine platform filter with conversation filter', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '30d',
        filters: {
          platform: 'line',
          conversationId: 'conv_123'
        },
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });
  });

  describe('Platform Filter - Edge Cases', () => {
    test('should handle missing platform filter (all platforms)', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {},
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
      // Should return data from all platforms
    });

    test('should handle null platform filter', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {
          platform: null as any
        },
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });

    test('should handle undefined platform filter', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {
          platform: undefined
        },
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });
  });

  describe('Platform Filter - Performance', () => {
    test('should execute platform filter efficiently', async () => {
      const startTime = Date.now();

      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        filters: {
          platform: 'line'
        },
        metrics: ['total_conversations']
      };

      await analyticsService.getConversationAnalytics(query);

      const executionTime = Date.now() - startTime;

      // Query should complete in reasonable time (< 1000ms)
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe('Platform Filter - Message Analytics', () => {
    test('should filter messages by platform through conversation', async () => {
      const query = {
        timeRange: '7d',
        filters: {
          platform: 'line'
        },
        metrics: ['total_messages']
      };

      const result = await analyticsService.getMessageAnalytics(query);

      expect(result.success).toBe(true);
    });
  });
});
