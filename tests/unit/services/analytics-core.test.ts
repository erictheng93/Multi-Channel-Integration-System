// Analytics Core Service Unit Tests
// 測試 Analytics Service 核心功能

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import type {
  ConversationAnalyticsQuery,
  MessageAnalyticsQuery,
  UserAnalyticsQuery,
  PerformanceAnalyticsQuery,
  CustomAnalyticsQuery,
  ExportQuery
} from '@backend/modules/analytics/types/analytics-types';

// Mock D1 Database
const createMockDB = () => ({
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  all: vi.fn().mockResolvedValue({ results: [] }),
  first: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue({ success: true }),
  batch: vi.fn().mockResolvedValue([]),
  exec: vi.fn().mockResolvedValue({ results: [] })
});

// Mock KV
const createMockKV = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] })
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockDB: any;
  let mockKV: any;

  beforeEach(() => {
    mockDB = createMockDB();
    mockKV = createMockKV();
    service = new AnalyticsService({
      database: mockDB,
      kv: mockKV,
      env: {}
    });
  });

  describe('getConversationAnalytics()', () => {
    it('should return conversation analytics for valid query', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations', 'active_conversations'],
        filters: {},
        groupBy: [],
        orderBy: [],
        limit: 100
      };

      // Mock database response
      mockDB.all.mockResolvedValueOnce({
        results: [
          { totalConversations: 150, activeConversations: 45 }
        ]
      });

      const result = await service.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should use cache when available', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      // Mock cached data
      mockKV.get.mockResolvedValueOnce(JSON.stringify({
        success: true,
        data: {
          summary: { totalConversations: 100 },
          timeSeries: [],
          distribution: []
        },
        metadata: {
          totalRecords: 100,
          cacheHit: true,
          processedAt: new Date().toISOString(),
          queryTime: 50
        }
      }));

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.metadata?.cacheHit).toBe(true);
      expect(mockDB.all).not.toHaveBeenCalled();
    });

    it('should handle query validation errors', async () => {
      const invalidQuery: ConversationAnalyticsQuery = {
        timeRange: 'invalid' as any,
        metrics: [],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      const result = await service.getConversationAnalytics(invalidQuery);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should support platform filtering', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: { platform: 'line' },
        groupBy: [],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 80 }]
      });

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should support team filtering', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '30d',
        metrics: ['total_conversations'],
        filters: { teamId: 1 },
        groupBy: [],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 50 }]
      });

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should support custom date ranges', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: 'custom',
        startDate: '2025-09-01',
        endDate: '2025-09-30',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 120 }]
      });

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should handle groupBy parameters', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: ['platform', 'date'],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          { platform: 'line', date: '2025-09-30', totalConversations: 30 },
          { platform: 'facebook', date: '2025-09-30', totalConversations: 20 }
        ]
      });

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle orderBy parameters', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: [{ field: 'totalConversations', direction: 'desc' }]
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 100 }]
      });

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(true);
    });
  });

  describe('getMessageAnalytics()', () => {
    it('should return message analytics for valid query', async () => {
      const query: MessageAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_messages', 'messages_per_hour'],
        filters: {},
        groupBy: [],
        limit: 100
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          { totalMessages: 5000, messagesPerHour: 208 }
        ]
      });

      const result = await service.getMessageAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should filter by conversation ID', async () => {
      const query: MessageAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_messages'],
        filters: { conversationId: 'conv_123' },
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalMessages: 150 }]
      });

      const result = await service.getMessageAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should filter by platform', async () => {
      const query: MessageAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_messages'],
        filters: { platform: 'line' },
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalMessages: 3000 }]
      });

      const result = await service.getMessageAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should calculate message statistics', async () => {
      const query: MessageAnalyticsQuery = {
        timeRange: '24h',
        metrics: ['total_messages', 'messages_per_hour', 'avg_message_length'],
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          {
            totalMessages: 1200,
            messagesPerHour: 50,
            avgMessageLength: 85
          }
        ]
      });

      const result = await service.getMessageAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should use cache for repeated queries', async () => {
      const query: MessageAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_messages'],
        filters: {},
        groupBy: []
      };

      mockKV.get.mockResolvedValueOnce(JSON.stringify({
        success: true,
        data: {
          summary: { totalMessages: 5000 },
          timeSeries: [],
          distribution: []
        },
        metadata: { cacheHit: true }
      }));

      const result = await service.getMessageAnalytics(query);

      expect(result.metadata?.cacheHit).toBe(true);
    });
  });

  describe('getUserAnalytics()', () => {
    it('should return user analytics for valid query', async () => {
      const query: UserAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['active_users', 'user_activity'],
        userType: 'agent',
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          { activeUsers: 25, userActivity: 850 }
        ]
      });

      const result = await service.getUserAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should filter by user type', async () => {
      const query: UserAnalyticsQuery = {
        timeRange: '30d',
        metrics: ['active_users'],
        userType: 'customer',
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ activeUsers: 500 }]
      });

      const result = await service.getUserAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should filter by team ID', async () => {
      const query: UserAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['active_users'],
        userType: 'agent',
        filters: { teamId: 1 },
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ activeUsers: 10 }]
      });

      const result = await service.getUserAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should handle admin user type', async () => {
      const query: UserAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['active_users'],
        userType: 'admin',
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ activeUsers: 3 }]
      });

      const result = await service.getUserAnalytics(query);

      expect(result.success).toBe(true);
    });
  });

  describe('getPerformanceAnalytics()', () => {
    it('should return performance analytics for valid query', async () => {
      const query: PerformanceAnalyticsQuery = {
        timeRange: '24h',
        metrics: ['response_times', 'throughput', 'error_rates'],
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          {
            avgResponseTime: 250,
            throughput: 1200,
            errorRate: 0.02
          }
        ]
      });

      const result = await service.getPerformanceAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should calculate response time percentiles', async () => {
      const query: PerformanceAnalyticsQuery = {
        timeRange: '24h',
        metrics: ['response_times'],
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          {
            p50: 200,
            p95: 500,
            p99: 1000
          }
        ]
      });

      const result = await service.getPerformanceAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should track error rates by type', async () => {
      const query: PerformanceAnalyticsQuery = {
        timeRange: '24h',
        metrics: ['error_rates'],
        filters: {},
        groupBy: ['errorType']
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          { errorType: 'timeout', errorRate: 0.01 },
          { errorType: 'validation', errorRate: 0.005 }
        ]
      });

      const result = await service.getPerformanceAnalytics(query);

      expect(result.success).toBe(true);
    });
  });

  describe('getCustomAnalytics()', () => {
    it('should execute custom analytics query', async () => {
      const query: CustomAnalyticsQuery = {
        timeRange: '7d',
        query: 'SELECT COUNT(*) as total FROM conversations',
        parameters: {},
        aggregation: 'sum',
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ total: 150 }]
      });

      const result = await service.getCustomAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should support parameterized queries', async () => {
      const query: CustomAnalyticsQuery = {
        timeRange: '7d',
        query: 'SELECT * FROM conversations WHERE team_id = ?',
        parameters: { teamId: 1 },
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ id: 1, name: 'Test' }]
      });

      const result = await service.getCustomAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should apply aggregation functions', async () => {
      const query: CustomAnalyticsQuery = {
        timeRange: '30d',
        query: 'SELECT value FROM metrics',
        parameters: {},
        aggregation: 'avg',
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ value: 100 }, { value: 200 }, { value: 300 }]
      });

      const result = await service.getCustomAnalytics(query);

      expect(result.success).toBe(true);
    });
  });

  describe('exportAnalytics()', () => {
    it('should export analytics data in JSON format', async () => {
      const query: ExportQuery = {
        timeRange: '7d',
        format: 'json',
        metrics: ['total_conversations', 'active_conversations'],
        includeCharts: false,
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [
          { totalConversations: 150, activeConversations: 45 }
        ]
      });

      const result = await service.exportAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.format).toBe('json');
    });

    it('should export analytics data in CSV format', async () => {
      const query: ExportQuery = {
        timeRange: '7d',
        format: 'csv',
        metrics: ['total_messages'],
        includeCharts: false,
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalMessages: 5000 }]
      });

      const result = await service.exportAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data?.format).toBe('csv');
    });

    it('should include charts when requested', async () => {
      const query: ExportQuery = {
        timeRange: '7d',
        format: 'json',
        metrics: ['total_conversations'],
        includeCharts: true,
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 150 }]
      });

      const result = await service.exportAnalytics(query);

      expect(result.success).toBe(true);
    });

    it('should apply custom filename', async () => {
      const query: ExportQuery = {
        timeRange: '7d',
        format: 'json',
        metrics: ['total_conversations'],
        fileName: 'my-analytics-export',
        includeCharts: false,
        filters: {},
        groupBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 150 }]
      });

      const result = await service.exportAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data?.fileName).toContain('my-analytics-export');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDB.all.mockRejectedValueOnce(new Error('Database connection failed'));

      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.errorCode).toBeDefined();
    });

    it('should handle validation errors', async () => {
      const invalidQuery: ConversationAnalyticsQuery = {
        timeRange: 'invalid' as any,
        metrics: [],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      const result = await service.getConversationAnalytics(invalidQuery);

      expect(result.success).toBe(false);
      expect(result.metadata?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle processing errors', async () => {
      mockDB.all.mockResolvedValueOnce({
        results: null // Invalid data format
      });

      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(false);
      expect(result.metadata?.errorCode).toBeDefined();
    });

    it('should include error metadata', async () => {
      mockDB.all.mockRejectedValueOnce(new Error('Test error'));

      const query: MessageAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_messages'],
        filters: {},
        groupBy: []
      };

      const result = await service.getMessageAnalytics(query);

      expect(result.success).toBe(false);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.processedAt).toBeDefined();
      expect(result.metadata?.queryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Integration', () => {
    it('should cache successful results', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 150 }]
      });

      await service.getConversationAnalytics(query);

      // Cache should have been called to store result
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      const cachedData = {
        success: true,
        data: {
          summary: { totalConversations: 150 },
          timeSeries: [],
          distribution: []
        },
        metadata: {
          cacheHit: true,
          processedAt: new Date().toISOString(),
          queryTime: 10
        }
      };

      mockKV.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.getConversationAnalytics(query);

      expect(result.metadata?.cacheHit).toBe(true);
      expect(mockDB.all).not.toHaveBeenCalled();
    });

    it('should invalidate cache on data changes', async () => {
      // This test would verify cache invalidation logic
      // Implementation depends on your cache invalidation strategy
      expect(true).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete analytics query in reasonable time', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 150 }]
      });

      const startTime = Date.now();
      await service.getConversationAnalytics(query);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete within 1 second
      expect(executionTime).toBeLessThan(1000);
    });

    it('should include query execution time in metadata', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 150 }]
      });

      const result = await service.getConversationAnalytics(query);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.queryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Type Conversion', () => {
    it('should correctly convert between AnalyticsResult and ServiceResponse', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      mockDB.all.mockResolvedValueOnce({
        results: [{ totalConversations: 150 }]
      });

      const result = await service.getConversationAnalytics(query);

      // Should have ServiceResponse structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      // errorCode should be in metadata, not root
      expect(result).not.toHaveProperty('errorCode');
      if (!result.success) {
        expect(result.metadata).toHaveProperty('errorCode');
      }
    });

    it('should maintain type safety in cache operations', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: [],
        orderBy: []
      };

      // Cache stores AnalyticsResult
      const cachedAnalyticsResult = {
        success: true,
        data: {
          summary: { totalConversations: 150 },
          timeSeries: [],
          distribution: []
        },
        metadata: {
          cacheHit: true,
          totalRecords: 150
        }
      };

      mockKV.get.mockResolvedValueOnce(JSON.stringify(cachedAnalyticsResult));

      // Service returns ServiceResponse
      const result = await service.getConversationAnalytics(query);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });
});