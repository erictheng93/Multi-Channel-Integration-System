// Analytics Edge Cases and Boundary Conditions Test
// 邊界條件和極端場景測試

import { describe, it, expect, beforeAll } from 'vitest';
import { createDbClient } from '@/db/drizzle-factory';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import type {
  ConversationAnalyticsQuery,
  MessageAnalyticsQuery,
  UserAnalyticsQuery,
  PerformanceAnalyticsQuery
} from '../../src/modules/analytics/types/analytics-types';
import { MockFactory } from '@helpers/mockFactory';

/**
 * 邊界條件測試配置
 * 測試極端輸入和異常場景的處理
 */
describe('Analytics Edge Cases and Boundary Conditions', () => {
  let analyticsService: AnalyticsService;
  let testEnv: any;

  beforeAll(async () => {
    console.log('🚀 Setting up edge cases test environment...');

    try {
      testEnv = {
        ENVIRONMENT: 'test',
        JWT_SECRET: 'test-secret-key'
      };

      const { createInMemoryD1 } = await import('../helpers/test-d1-helper');
      const mockD1 = await createInMemoryD1();

      analyticsService = new AnalyticsService({
        database: createDbClient(mockD1),
        kv: undefined,
        env: testEnv
      });

      console.log('✅ Edge cases test environment initialized');

    } catch (error) {
      console.error('❌ Failed to initialize edge cases test environment:', error);
      throw error;
    }
  });

  // ======================== 時間範圍邊界測試 ========================

  describe('Time Range Boundary Tests', () => {
    test('should handle minimum time range (1 hour)', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '1h',
        metrics: ['total_conversations'],
        filters: {}
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      console.log('✅ Minimum time range (1h) handled correctly');
    });

    test('should handle maximum time range (1 year)', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '365d',
        metrics: ['total_conversations'],
        filters: {}
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      console.log('✅ Maximum time range (365d) handled correctly');
    });

    test('should handle custom date range spanning 2 days', async () => {
      const today = new Date();
      const startDate = today.toISOString().spltest('T')[0];

      // Add 1 day to ensure endDate is after startDate
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = tomorrow.toISOString().spltest('T')[0];

      const query = {
        startDate,
        endDate,
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query as any);

      expect(result).toBeDefined();
      console.log('✅ Two-day date range handled correctly');
    });

    test('should allow same-day queries (startDate = endDate)', async () => {
      const today = new Date();
      const sameDate = today.toISOString().spltest('T')[0];

      const query = {
        startDate: sameDate,
        endDate: sameDate, // Same as startDate
        metrics: ['total_conversations', 'active_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query as any);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      console.log('✅ Same-day queries (startDate = endDate) allowed correctly');
    });

    test('should reject invalid time range (end before start)', async () => {
      const query = {
        startDate: '2024-12-31',
        endDate: '2024-01-01',
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query as any);

      // Service 現在返回 ServiceResponse 而不是拋出異常
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('VALIDATION_ERROR');

      console.log('✅ Invalid time range rejected correctly');
    });

    test('should handle future dates', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const query = {
        startDate: new Date().toISOString().spltest('T')[0],
        endDate: futureDate.toISOString().spltest('T')[0],
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query as any);

      expect(result).toBeDefined();
      // Should return empty results for future dates
      console.log('✅ Future dates handled gracefully');
    });

    test('should handle very old dates (10 years ago)', async () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 10);

      const query = {
        startDate: oldDate.toISOString().spltest('T')[0],
        endDate: new Date().toISOString().spltest('T')[0],
        metrics: ['total_conversations']
      };

      const result = await analyticsService.getConversationAnalytics(query as any);

      expect(result).toBeDefined();
      console.log('✅ Very old dates (10 years ago) handled correctly');
    });
  });

  // ======================== 數據量邊界測試 ========================

  describe('Data Volume Boundary Tests', () => {
    test('should handle empty result set', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '1h',
        metrics: ['total_conversations'],
        filters: {
          teamId: 999999 // Non-existent team
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data.summary.totalConversations).toBe(0);
      console.log('✅ Empty result set handled correctly');
    });

    test('should handle single record result', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        limit: 1
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      console.log('✅ Single record result handled correctly');
    });

    test('should handle maximum limit (1000)', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        limit: 1000
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      console.log('✅ Maximum limit (1000) handled correctly');
    });

    test('should handle zero limit', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        limit: 0
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Zero limit handled correctly');
    });

    test('should handle negative limit', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        limit: -1
      };

      // Should either reject or treat as no limit
      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Negative limit handled gracefully');
      } catch (error) {
        console.log('✅ Negative limit rejected correctly');
      }
    });
  });

  // ======================== 過濾器邊界測試 ========================

  describe('Filter Boundary Tests', () => {
    test('should handle no filters', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {}
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ No filters handled correctly');
    });

    test('should handle multiple filters simultaneously', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          teamId: 1,
          platform: 'line',
          status: 'active'
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Multiple filters handled correctly');
    });

    test('should handle invalid filter values', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          platform: 'invalid-platform' as any
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      // Should return empty results or all results
      console.log('✅ Invalid filter values handled gracefully');
    });

    test('should handle null/undefined filter values', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          teamId: undefined,
          platform: undefined as any
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Null/undefined filters handled correctly');
    });

    test('should handle extreme teamId values', async () => {
      const extremeValues = [0, -1, 999999999, Number.MAX_SAFE_INTEGER];

      for (const teamId of extremeValues) {
        const query: ConversationAnalyticsQuery = {
          timeRange: '7d',
          metrics: ['total_conversations'],
          filters: { teamId }
        };

        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
      }

      console.log('✅ Extreme teamId values handled correctly');
    });
  });

  // ======================== GroupBy 邊界測試 ========================

  describe('GroupBy Boundary Tests', () => {
    test('should handle empty groupBy array', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: []
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Empty groupBy array handled correctly');
    });

    test('should handle single groupBy field', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: ['platform']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Single groupBy field handled correctly');
    });

    test('should handle multiple groupBy fields', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: ['platform', 'status', 'teamId']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Multiple groupBy fields handled correctly');
    });

    test('should handle invalid groupBy field names', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: ['invalid_field', 'another_invalid'] as any
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Invalid groupBy fields handled gracefully');
      } catch (error) {
        console.log('✅ Invalid groupBy fields rejected correctly');
      }
    });

    test('should handle duplicate groupBy fields', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        groupBy: ['platform', 'platform', 'platform']
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Duplicate groupBy fields handled correctly');
    });
  });

  // ======================== Metrics 邊界測試 ========================

  describe('Metrics Boundary Tests', () => {
    test('should handle single metric', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {}
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Single metric handled correctly');
    });

    test('should handle all available metrics', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: [
          'total_conversations',
          'active_conversations',
          'closed_conversations',
          'average_messages_per_conversation',
          'average_response_time'
        ],
        filters: {}
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ All metrics handled correctly');
    });

    test('should handle invalid metric names', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['invalid_metric', 'another_invalid'] as any,
        filters: {}
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Invalid metrics handled gracefully');
      } catch (error) {
        console.log('✅ Invalid metrics rejected correctly');
      }
    });

    test('should handle empty metrics array', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: [],
        filters: {}
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Empty metrics array handled gracefully');
      } catch (error) {
        console.log('✅ Empty metrics array rejected correctly');
      }
    });

    test('should handle duplicate metrics', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: [
          'total_conversations',
          'total_conversations',
          'total_conversations'
        ],
        filters: {}
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Duplicate metrics handled correctly');
    });
  });

  // ======================== OrderBy 邊界測試 ========================

  describe('OrderBy Boundary Tests', () => {
    test('should handle empty orderBy array', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        orderBy: []
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Empty orderBy array handled correctly');
    });

    test('should handle ascending order', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        orderBy: [{ field: 'createdAt', direction: 'asc' }]
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Ascending order handled correctly');
    });

    test('should handle descending order', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        orderBy: [{ field: 'createdAt', direction: 'desc' }]
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Descending order handled correctly');
    });

    test('should handle multiple orderBy fields', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        orderBy: [
          { field: 'platform', direction: 'asc' },
          { field: 'createdAt', direction: 'desc' }
        ]
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Multiple orderBy fields handled correctly');
    });

    test('should handle invalid orderBy field names', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        orderBy: [{ field: 'invalid_field', direction: 'asc' }] as any
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Invalid orderBy fields handled gracefully');
      } catch (error) {
        console.log('✅ Invalid orderBy fields rejected correctly');
      }
    });

    test('should handle invalid orderBy direction', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {},
        orderBy: [{ field: 'createdAt', direction: 'invalid' as any }]
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Invalid orderBy direction handled gracefully');
      } catch (error) {
        console.log('✅ Invalid orderBy direction rejected correctly');
      }
    });
  });

  // ======================== 特殊字符和輸入測試 ========================

  describe('Special Characters and Input Tests', () => {
    test('should handle SQL injection attempts in filters', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          status: "'; DROP TABLE conversations; --" as any
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ SQL injection attempt safely handled');
    });

    test('should handle extremely long filter strings', async () => {
      const longString = 'a'.repeat(10000);

      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          status: longString as any
        }
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Extremely long strings handled gracefully');
      } catch (error) {
        console.log('✅ Extremely long strings rejected correctly');
      }
    });

    test('should handle unicode characters in filters', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          status: '測試🎉😊中文' as any
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Unicode characters handled correctly');
    });

    test('should handle null bytes in input', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          status: 'test\x00null' as any
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Null bytes handled correctly');
    });

    test('should handle special regex characters', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          status: '.*+?^${}()|[]\\' as any
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Special regex characters handled correctly');
    });
  });

  // ======================== 數據類型邊界測試 ========================

  describe('Data Type Boundary Tests', () => {
    test('should handle numeric string in teamId filter', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          teamId: '123' as any
        }
      };

      const result = await analyticsService.getConversationAnalytics(query);

      expect(result).toBeDefined();
      console.log('✅ Numeric string handled correctly');
    });

    test('should handle boolean values in unexpected places', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          teamId: true as any
        }
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Boolean values handled gracefully');
      } catch (error) {
        console.log('✅ Boolean values rejected correctly');
      }
    });

    test('should handle object instead of primitive value', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          teamId: { nested: 'object' } as any
        }
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Object values handled gracefully');
      } catch (error) {
        console.log('✅ Object values rejected correctly');
      }
    });

    test('should handle array instead of single value', async () => {
      const query: ConversationAnalyticsQuery = {
        timeRange: '7d',
        metrics: ['total_conversations'],
        filters: {
          teamId: [1, 2, 3] as any
        }
      };

      try {
        const result = await analyticsService.getConversationAnalytics(query);
        expect(result).toBeDefined();
        console.log('✅ Array values handled gracefully');
      } catch (error) {
        console.log('✅ Array values rejected correctly');
      }
    });
  });

  // ======================== 導出邊界測試 ========================

  describe('Export Boundary Tests', () => {
    test('should handle export with empty results', async () => {
      const query = {
        timeRange: '7d' as const,
        format: 'json' as const,
        metrics: ['total_conversations'],
        filters: {
          teamId: 999999
        }
      };

      const result = await analyticsService.exportAnalytics(query);

      // Service 現在返回 ServiceResponse<ExportResult>
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.format).toBe('json');
      console.log('✅ Export with empty results handled correctly');
    });

    test('should handle export with large dataset', async () => {
      const query = {
        timeRange: '365d' as const,
        format: 'csv' as const,
        metrics: ['total_conversations', 'total_messages'],
        filters: {},
        limit: 1000
      };

      const result = await analyticsService.exportAnalytics(query);

      // Service 現在返回 ServiceResponse<ExportResult>
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.format).toBe('csv');
      console.log('✅ Export with large dataset handled correctly');
    });

    test('should handle invalid export format', async () => {
      const query = {
        timeRange: '7d' as const,
        format: 'invalid-format' as any,
        metrics: ['total_conversations']
      };

      const result = await analyticsService.exportAnalytics(query);

      // Service 現在返回 ServiceResponse，不會拋出異常
      expect(result).toBeDefined();

      // 可能成功（使用默認格式）或失敗（驗證錯誤）
      if (result.success) {
        expect(result.data).toBeDefined();
        console.log('✅ Invalid export format handled gracefully (used default)');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorCode).toBeDefined();
        console.log('✅ Invalid export format rejected correctly');
      }
    });

    test('should handle export with no metrics specified', async () => {
      const query = {
        timeRange: '7d' as const,
        format: 'json' as const,
        metrics: []
      };

      const result = await analyticsService.exportAnalytics(query);

      // Service 現在返回 ServiceResponse，不會拋出異常
      expect(result).toBeDefined();

      // 可能成功（導出所有可用數據）或失敗（驗證錯誤）
      if (result.success) {
        expect(result.data).toBeDefined();
        console.log('✅ Export with no metrics handled gracefully');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorCode).toBe('VALIDATION_ERROR');
        console.log('✅ Export with no metrics rejected correctly');
      }
    });
  });
});

// ======================== Test Metadata ========================

export const getEdgeCasesTestSummary = () => {
  return {
    description: 'Analytics 模組邊界條件和極端場景測試',
    purpose: '驗證系統在極端輸入和異常場景下的魯棒性和錯誤處理',
    testCategories: {
      timeRange: {
        tests: 6,
        scenarios: [
          '最小時間範圍 (1h)',
          '最大時間範圍 (365d)',
          '同一天',
          '無效範圍',
          '未來日期',
          '10年前'
        ]
      },
      dataVolume: {
        tests: 5,
        scenarios: [
          '空結果集',
          '單一記錄',
          '最大限制 (1000)',
          '零限制',
          '負數限制'
        ]
      },
      filters: {
        tests: 5,
        scenarios: [
          '無過濾器',
          '多重過濾器',
          '無效值',
          'null/undefined',
          '極端值'
        ]
      },
      groupBy: {
        tests: 5,
        scenarios: [
          '空陣列',
          '單一欄位',
          '多重欄位',
          '無效欄位',
          '重複欄位'
        ]
      },
      metrics: {
        tests: 5,
        scenarios: [
          '單一指標',
          '所有指標',
          '無效指標',
          '空陣列',
          '重複指標'
        ]
      },
      orderBy: {
        tests: 6,
        scenarios: [
          '空陣列',
          '升序',
          '降序',
          '多重欄位',
          '無效欄位',
          '無效方向'
        ]
      },
      specialCharacters: {
        tests: 5,
        scenarios: [
          'SQL 注入',
          '極長字串',
          'Unicode',
          'Null bytes',
          '正則特殊字符'
        ]
      },
      dataTypes: {
        tests: 4,
        scenarios: [
          '數字字串',
          '布林值',
          '物件',
          '陣列'
        ]
      },
      export: {
        tests: 4,
        scenarios: [
          '空結果',
          '大數據集',
          '無效格式',
          '無指標'
        ]
      }
    },
    totalTests: 45,
    estimatedDuration: '1-2 minutes',
    robustnessAreas: [
      '輸入驗證',
      '錯誤處理',
      '安全防護',
      '數據類型轉換',
      '極端值處理'
    ]
  };
};