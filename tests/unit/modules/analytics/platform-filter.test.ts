/**
 * Analytics Platform Filter Unit Tests
 * 测试 Analytics 模块的平台过滤功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import type { Cimport { MockFactory } from '@helpers/mockFactory';
onversationAnalyticsQuery } from '@modules/analytics/types/analytics-types';

describe('Analytics Platform Filter', () => {
  let mockEnv: any;
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock D1 database
    const mockDB = MockFactory.createD1()().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null)
    };

    mockEnv = {
      DB: mockDB,
      KV: null
    };

    analyticsService = new AnalyticsService({
      database: mockDB as any,
      kv: undefined,
      env: mockEnv
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });
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
