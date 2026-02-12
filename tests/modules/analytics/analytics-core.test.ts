// Analytics Core Service Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import type { AnalyticsServiceConfig, ConversationAnalyticsQuery } from '@modules/analytics/types/analytics-types';

// Mock dependencies with complete Drizzle ORM query builder chain
const mockDB = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({ count: 100 })),
        all: vi.fn(() => Promise.resolve([])),
        groupBy: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ count: 100 })),
          all: vi.fn(() => Promise.resolve([]))
        })),
        orderBy: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ count: 100 })),
          all: vi.fn(() => Promise.resolve([]))
        })),
        limit: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ count: 100 })),
          all: vi.fn(() => Promise.resolve([]))
        }))
      })),
      groupBy: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({ count: 100 })),
        all: vi.fn(() => Promise.resolve([])),
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ count: 100 })),
          all: vi.fn(() => Promise.resolve([]))
        }))
      })),
      orderBy: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({ count: 100 })),
        all: vi.fn(() => Promise.resolve([]))
      })),
      limit: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({ count: 100 })),
        all: vi.fn(() => Promise.resolve([]))
      }))
    }))
  })),
  run: vi.fn(() => Promise.resolve({ results: [] }))
};

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
};

const mockEnv = {
  DB: mockDB,
  KV: mockKV,
  ENVIRONMENT: 'test'
};

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let config: AnalyticsServiceConfig;

  beforeEach(() => {
    config = {
      database: mockDB as any,
      kv: mockKV,
      env: mockEnv
    };

    analyticsService = new AnalyticsService(config);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConversationAnalytics', () => {
    test('應該返回對話分析數據', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations', 'active_conversations'],
        filters: {
          teamId: 1
        }
      };

      // Mock database response
      mockDB.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ count: 50 })),
            all: vi.fn(() => Promise.resolve([]))
          }))
        }))
      });

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalRecords).toBeGreaterThanOrEqual(0);
      expect(result.metadata.queryTime).toBeGreaterThanOrEqual(0);
    });

    test('應該驗證查詢參數', async () => {
      const invalidQuery = {
        // 缺少 timeRange 和 startDate
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(invalidQuery as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('應該處理時間範圍', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '24h',
        metrics: ['total_conversations']
      };

      mockDB.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ count: 25 })),
            all: vi.fn(() => Promise.resolve([]))
          }))
        }))
      });

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(mockDB.select).toHaveBeenCalled();
    });

    test('應該處理篩選條件', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          teamId: 2,
          platform: 'line',
          status: 'active'
        }
      };

      mockDB.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ count: 15 })),
            all: vi.fn(() => Promise.resolve([]))
          }))
        }))
      });

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data.summary.totalConversations).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMessageAnalytics', () => {
    test('應該返回消息分析數據', async () => {
      const query = {
        timeRange: '7d' as const,
        metrics: ['total_messages', 'messages_per_hour']
      };

      mockDB.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ count: 1000 })),
            all: vi.fn(() => Promise.resolve([]))
          }))
        }))
      });

      const result = await analyticsService.getMessageAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(result.data.volume).toBeDefined();
    });
  });

  describe('getUserAnalytics', () => {
    test('應該返回用戶分析數據', async () => {
      const query = {
        timeRange: '7d' as const,
        metrics: ['active_users', 'user_activity'],
        userType: 'agent' as const
      };

      mockDB.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ count: 20 })),
            all: vi.fn(() => Promise.resolve([]))
          }))
        }))
      });

      const result = await analyticsService.getUserAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.summary).toBeDefined();
    });
  });

  describe('getPerformanceAnalytics', () => {
    test('應該返回性能分析數據', async () => {
      const query = {
        timeRange: '24h' as const,
        metrics: ['response_times', 'throughput', 'error_rates']
      };

      const result = await analyticsService.getPerformanceAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(result.data.trends).toBeDefined();
    });
  });

  describe('getCustomAnalytics', () => {
    test('應該執行自定義查詢', async () => {
      const query = {
        timeRange: '7d' as const,
        query: 'SELECT COUNT(*) as total FROM conversations',
        parameters: { teamId: 1 }
      };

      const result = await analyticsService.getCustomAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe('exportAnalytics', () => {
    test('應該導出分析數據', async () => {
      const query = {
        timeRange: '7d' as const,
        format: 'json' as const,
        metrics: ['total_conversations']
      };

      // Mock conversation analytics call
      mockDB.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ count: 50 })),
            all: vi.fn(() => Promise.resolve([]))
          }))
        }))
      });

      const result = await analyticsService.exportAnalytics(query);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.fileUrl).toBeDefined();
      expect(result.data!.format).toBe('json');
      expect(result.data!.generatedAt).toBeDefined();
    });

    test('應該支持不同的導出格式', async () => {
      const formats: Array<'json' | 'csv' | 'xlsx' | 'pdf'> = ['json', 'csv', 'xlsx', 'pdf'];

      for (const format of formats) {
        const query = {
          timeRange: '7d' as const,
          format,
          metrics: ['total_conversations']
        };

        mockDB.select.mockReturnValue({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ count: 50 })),
              all: vi.fn(() => Promise.resolve([]))
            }))
          }))
        });

        const result = await analyticsService.exportAnalytics(query);
        expect(result.success).toBe(true);
        expect(result.data!.format).toBe(format);
      }
    });
  });

  describe('錯誤處理', () => {
    test('應該處理數據庫錯誤', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations']
      };

      // Mock database error
      mockDB.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await analyticsService.getConversationAnalytics(query);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Database connection failed');
    });

    test('應該處理無效的時間範圍', async () => {
      const query = {
        startDate: '2024-01-01',
        endDate: '2023-12-31', // endDate < startDate
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('緩存功能', () => {
    test('應該支持 KV 緩存', async () => {
      if (!mockKV) return;

      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations']
      };

      // Mock cache miss, then cache hit
      mockKV.get.mockResolvedValueOnce(null);
      mockDB.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ count: 50 })),
            all: vi.fn(() => Promise.resolve([]))
          }))
        }))
      });

      const result1 = await analyticsService.getConversationAnalytics(query);
      expect(result1).toBeDefined();

      // Second call should potentially use cache
      const result2 = await analyticsService.getConversationAnalytics(query);
      expect(result2).toBeDefined();
    });
  });
});

/**
 * Integration test helper
 */
export function createTestAnalyticsService(): AnalyticsService {
  const testConfig: AnalyticsServiceConfig = {
    database: mockDB as any,
    kv: mockKV,
    env: mockEnv
  };

  return new AnalyticsService(testConfig);
}

/**
 * Test data generators
 */
export const TestDataGenerators = {
  conversationAnalyticsQuery: (overrides = {}): ConversationAnalyticsQuery => ({
    timeRange: '7d',
    metrics: ['total_conversations', 'active_conversations'],
    filters: {
      teamId: 1
    },
    ...overrides
  }),

  mockConversationSummary: () => ({
    totalConversations: 100,
    activeConversations: 25,
    closedConversations: 75,
    averageDuration: 45,
    averageMessagesPerConversation: 8,
    averageFirstResponseTime: 2.5,
    averageResolutionTime: 15,
    customerSatisfactionScore: 4.2,
    period: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-08T00:00:00Z'
    }
  }),

  mockTimeSeriesData: () => [
    { timestamp: '2024-01-01T00:00:00Z', value: 10, label: 'Day 1' },
    { timestamp: '2024-01-02T00:00:00Z', value: 15, label: 'Day 2' },
    { timestamp: '2024-01-03T00:00:00Z', value: 12, label: 'Day 3' },
    { timestamp: '2024-01-04T00:00:00Z', value: 18, label: 'Day 4' },
    { timestamp: '2024-01-05T00:00:00Z', value: 20, label: 'Day 5' },
    { timestamp: '2024-01-06T00:00:00Z', value: 16, label: 'Day 6' },
    { timestamp: '2024-01-07T00:00:00Z', value: 22, label: 'Day 7' }
  ]
};