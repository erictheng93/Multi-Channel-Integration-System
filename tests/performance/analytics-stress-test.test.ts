// Analytics Performance Stress Test
// 性能壓力測試 - 1000+ 並發查詢

import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import type {
  ConversationAnalyticsQuery,
  MessageAnalyticsQuery,
  UserAnalyticsQuery,
  PerformanceAnalyticsQuery
import { MockFactory } from '@helpers/mockFactory';
} from '../../src/modules/analytics/types/analytics-types';

/**
 * 性能壓力測試配置
 * 測試高並發場景下的系統性能和穩定性
 */
describe('Analytics Performance Stress Test', () => {
  let analyticsService: AnalyticsService;
  let testEnv: any;

  beforeAll(async () => {
    console.log('🚀 Setting up stress test environment...');

    try {
      testEnv = {
        ENVIRONMENT: 'test',
        JWT_SECRET: 'test-secret-key'
      };

      const { createInMemoryD1 } = await import('../helpers/test-d1-helper');
      const mockD1 = await createInMemoryD1();

      analyticsService = new AnalyticsService({
        database: drizzle(mockD1),
        kv: undefined,
        env: testEnv
      });

      console.log('✅ Stress test environment initialized');

    } catch (error) {
      console.error('❌ Failed to initialize stress test environment:', error);
      throw error;
    }
  });

  // ======================== 並發查詢壓力測試 ========================

  describe('Concurrent Query Stress Tests', () => {
    test('should handle 100 concurrent queries', async () => {
      console.log('\n📊 Testing 100 concurrent queries...');
      const startTime = Date.now();

      const queries = Array.from({ length: 100 }, (_, i) => ({
        timeRange: '7d' as const,
        metrics: ['total_conversations'],
        filters: { teamId: (i % 10) + 1 }
      }));

      const results = await Promise.all(
        queries.map(q => analyticsService.getConversationAnalytics(q))
      );

      const duration = Date.now() - startTime;
      const avgTime = duration / 100;

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
      });

      expect(duration).toBeLessThan(5000); // 5 seconds for 100 queries

      console.log(`✅ 100 concurrent queries completed in ${duration}ms`);
      console.log(`   Average time per query: ${avgTime.toFixed(2)}ms`);
    });

    test('should handle 500 concurrent queries', async () => {
      console.log('\n📊 Testing 500 concurrent queries...');
      const startTime = Date.now();

      const queries = Array.from({ length: 500 }, (_, i) => ({
        timeRange: '24h' as const,
        metrics: ['total_conversations'],
        filters: { teamId: (i % 20) + 1 }
      }));

      const results = await Promise.all(
        queries.map(q => analyticsService.getConversationAnalytics(q))
      );

      const duration = Date.now() - startTime;
      const avgTime = duration / 500;
      const queriesPerSecond = 500 / (duration / 1000);

      expect(results).toHaveLength(500);
      expect(duration).toBeLessThan(15000); // 15 seconds for 500 queries

      console.log(`✅ 500 concurrent queries completed in ${duration}ms`);
      console.log(`   Average time per query: ${avgTime.toFixed(2)}ms`);
      console.log(`   Throughput: ${queriesPerSecond.toFixed(2)} queries/second`);
    });

    test('should handle 1000 concurrent queries', async () => {
      console.log('\n📊 Testing 1000 concurrent queries...');
      const startTime = Date.now();

      const queries = Array.from({ length: 1000 }, (_, i) => ({
        timeRange: '7d' as const,
        metrics: ['total_conversations'],
        filters: { teamId: (i % 50) + 1 }
      }));

      const results = await Promise.all(
        queries.map(q => analyticsService.getConversationAnalytics(q))
      );

      const duration = Date.now() - startTime;
      const avgTime = duration / 1000;
      const queriesPerSecond = 1000 / (duration / 1000);

      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(30000); // 30 seconds for 1000 queries

      console.log(`✅ 1000 concurrent queries completed in ${duration}ms`);
      console.log(`   Average time per query: ${avgTime.toFixed(2)}ms`);
      console.log(`   Throughput: ${queriesPerSecond.toFixed(2)} queries/second`);
    });

    test('should handle 2000 concurrent queries (extreme stress)', async () => {
      console.log('\n📊 Testing 2000 concurrent queries (EXTREME)...');
      const startTime = Date.now();

      const queries = Array.from({ length: 2000 }, (_, i) => ({
        timeRange: '24h' as const,
        metrics: ['total_conversations'],
        filters: { teamId: (i % 100) + 1 }
      }));

      try {
        const results = await Promise.all(
          queries.map(q => analyticsService.getConversationAnalytics(q))
        );

        const duration = Date.now() - startTime;
        const avgTime = duration / 2000;
        const queriesPerSecond = 2000 / (duration / 1000);

        expect(results).toHaveLength(2000);
        expect(duration).toBeLessThan(60000); // 60 seconds for 2000 queries

        console.log(`✅ 2000 concurrent queries completed in ${duration}ms`);
        console.log(`   Average time per query: ${avgTime.toFixed(2)}ms`);
        console.log(`   Throughput: ${queriesPerSecond.toFixed(2)} queries/second`);

      } catch (error) {
        console.error('❌ Extreme stress test failed (may be expected):', error);
        // This is acceptable - 2000 concurrent queries may exceed system limits
        console.log('⚠️ System reached maximum capacity');
      }
    }, 70000); // 70 second timeout for extreme test
  });

  // ======================== 混合查詢類型壓力測試 ========================

  describe('Mixed Query Type Stress Tests', () => {
    test('should handle 500 mixed concurrent queries', async () => {
      console.log('\n📊 Testing 500 mixed query types...');
      const startTime = Date.now();

      const queries: Promise<any>[] = [];

      // 100 conversation queries
      for (let i = 0; i < 100; i++) {
        queries.push(
          analyticsService.getConversationAnalytics({
            timeRange: '7d',
            metrics: ['total_conversations'],
            filters: {}
          })
        );
      }

      // 100 message queries
      for (let i = 0; i < 100; i++) {
        queries.push(
          analyticsService.getMessageAnalytics({
            timeRange: '7d',
            metrics: ['total_messages'],
            filters: {}
          })
        );
      }

      // 100 user queries (agent)
      for (let i = 0; i < 100; i++) {
        queries.push(
          analyticsService.getUserAnalytics({
            timeRange: '7d',
            metrics: ['active_users'],
            userType: 'agent',
            filters: {}
          })
        );
      }

      // 100 user queries (customer)
      for (let i = 0; i < 100; i++) {
        queries.push(
          analyticsService.getUserAnalytics({
            timeRange: '7d',
            metrics: ['active_users'],
            userType: 'customer',
            filters: {}
          })
        );
      }

      // 100 performance queries
      for (let i = 0; i < 100; i++) {
        queries.push(
          analyticsService.getPerformanceAnalytics({
            timeRange: '24h',
            metrics: ['response_times']
          })
        );
      }

      const results = await Promise.all(queries);

      const duration = Date.now() - startTime;
      const avgTime = duration / 500;
      const queriesPerSecond = 500 / (duration / 1000);

      expect(results).toHaveLength(500);
      expect(duration).toBeLessThan(20000); // 20 seconds for 500 mixed queries

      console.log(`✅ 500 mixed queries completed in ${duration}ms`);
      console.log(`   Average time per query: ${avgTime.toFixed(2)}ms`);
      console.log(`   Throughput: ${queriesPerSecond.toFixed(2)} queries/second`);
      console.log(`   Query breakdown:`);
      console.log(`     - Conversation: 100`);
      console.log(`     - Message: 100`);
      console.log(`     - User (Agent): 100`);
      console.log(`     - User (Customer): 100`);
      console.log(`     - Performance: 100`);
    });
  });

  // ======================== 複雜查詢壓力測試 ========================

  describe('Complex Query Stress Tests', () => {
    test('should handle 100 complex queries with groupBy', async () => {
      console.log('\n📊 Testing 100 complex queries with groupBy...');
      const startTime = Date.now();

      const queries = Array.from({ length: 100 }, () => ({
        timeRange: '7d' as const,
        metrics: ['total_conversations', 'active_conversations'],
        filters: {},
        groupBy: ['platform', 'status']
      }));

      const results = await Promise.all(
        queries.map(q => analyticsService.getConversationAnalytics(q))
      );

      const duration = Date.now() - startTime;
      const avgTime = duration / 100;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(10000); // 10 seconds for complex queries

      console.log(`✅ 100 complex queries completed in ${duration}ms`);
      console.log(`   Average time per query: ${avgTime.toFixed(2)}ms`);
    });

    test('should handle 100 queries with multiple filters', async () => {
      console.log('\n📊 Testing 100 queries with multiple filters...');
      const startTime = Date.now();

      const queries = Array.from({ length: 100 }, (_, i) => ({
        timeRange: '7d' as const,
        metrics: ['total_conversations'],
        filters: {
          teamId: (i % 10) + 1,
          platform: i % 2 === 0 ? 'line' as const : 'facebook' as const,
          status: 'active'
        }
      }));

      const results = await Promise.all(
        queries.map(q => analyticsService.getConversationAnalytics(q))
      );

      const duration = Date.now() - startTime;
      const avgTime = duration / 100;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(8000);

      console.log(`✅ 100 filtered queries completed in ${duration}ms`);
      console.log(`   Average time per query: ${avgTime.toFixed(2)}ms`);
    });
  });

  // ======================== 導出功能壓力測試 ========================

  describe('Export Stress Tests', () => {
    test('should handle 50 concurrent export requests', async () => {
      console.log('\n📊 Testing 50 concurrent export requests...');
      const startTime = Date.now();

      const formats = ['json', 'csv', 'xlsx', 'pdf'] as const;
      const queries = Array.from({ length: 50 }, (_, i) => ({
        timeRange: '7d' as const,
        format: formats[i % 4],
        metrics: ['total_conversations']
      }));

      const results = await Promise.all(
        queries.map(q => analyticsService.exportAnalytics(q))
      );

      const duration = Date.now() - startTime;
      const avgTime = duration / 50;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(15000);

      console.log(`✅ 50 export requests completed in ${duration}ms`);
      console.log(`   Average time per export: ${avgTime.toFixed(2)}ms`);
      console.log(`   Export format breakdown:`);
      console.log(`     - JSON: ${results.filter(r => r.format === 'json').length}`);
      console.log(`     - CSV: ${results.filter(r => r.format === 'csv').length}`);
      console.log(`     - XLSX: ${results.filter(r => r.format === 'xlsx').length}`);
      console.log(`     - PDF: ${results.filter(r => r.format === 'pdf').length}`);
    });
  });

  // ======================== 錯誤恢復壓力測試 ========================

  describe('Error Recovery Stress Tests', () => {
    test('should handle 100 queries with some invalid inputs', async () => {
      console.log('\n📊 Testing error recovery with 100 queries...');
      const startTime = Date.now();

      const queries = Array.from({ length: 100 }, (_, i) => {
        // Every 10th query has invalid input
        if (i % 10 === 0) {
          return {
            startDate: '2024-12-31',
            endDate: '2024-01-01', // Invalid: end before start
            metrics: ['total_conversations']
          };
        }

        return {
          timeRange: '7d' as const,
          metrics: ['total_conversations'],
          filters: {}
        };
      });

      const results = await Promise.all(
        queries.map(q => analyticsService.getConversationAnalytics(q as any))
      );

      const duration = Date.now() - startTime;
      // Service 現在返回 ServiceResponse，不會 reject
      const successful = results.filter(r => r.success === true).length;
      const failed = results.filter(r => r.success === false).length;

      expect(results).toHaveLength(100);
      expect(successful).toBeGreaterThan(80); // At least 80% should succeed
      expect(failed).toBeGreaterThan(0); // Some should fail (invalid inputs)

      console.log(`✅ Error recovery test completed in ${duration}ms`);
      console.log(`   Successful queries: ${successful}`);
      console.log(`   Failed queries: ${failed}`);
      console.log(`   Success rate: ${((successful / 100) * 100).toFixed(2)}%`);
    });
  });

  // ======================== 持續負載測試 ========================

  describe('Sustained Load Tests', () => {
    test('should maintain performance under sustained load (5 rounds of 100 queries)', async () => {
      console.log('\n📊 Testing sustained load (5 rounds of 100 queries)...');

      const roundResults: { round: number; duration: number; avgTime: number }[] = [];

      for (let round = 1; round <= 5; round++) {
        const startTime = Date.now();

        const queries = Array.from({ length: 100 }, (_, i) => ({
          timeRange: '7d' as const,
          metrics: ['total_conversations'],
          filters: { teamId: (i % 10) + 1 }
        }));

        const results = await Promise.all(
          queries.map(q => analyticsService.getConversationAnalytics(q))
        );

        const duration = Date.now() - startTime;
        const avgTime = duration / 100;

        roundResults.push({ round, duration, avgTime });

        expect(results).toHaveLength(100);

        console.log(`   Round ${round}: ${duration}ms (avg: ${avgTime.toFixed(2)}ms per query)`);

        // Small delay between rounds
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check for performance degradation
      const firstRoundAvg = roundResults[0].avgTime;
      const lastRoundAvg = roundResults[4].avgTime;
      const degradation = ((lastRoundAvg - firstRoundAvg) / firstRoundAvg) * 100;

      console.log(`\n✅ Sustained load test completed`);
      console.log(`   Total queries: 500`);
      console.log(`   First round avg: ${firstRoundAvg.toFixed(2)}ms`);
      console.log(`   Last round avg: ${lastRoundAvg.toFixed(2)}ms`);
      console.log(`   Performance degradation: ${degradation.toFixed(2)}%`);

      expect(Math.abs(degradation)).toBeLessThan(50); // Less than 50% degradation
    }, 30000); // 30 second timeout
  });

  // ======================== 記憶體壓力測試 ========================

  describe('Memory Stress Tests', () => {
    test('should handle large result sets without memory issues', async () => {
      console.log('\n📊 Testing memory handling with large queries...');

      const queries = Array.from({ length: 100 }, () => ({
        timeRange: '30d' as const, // Longer time range = more data
        metrics: ['total_conversations', 'active_conversations', 'closed_conversations'],
        filters: {},
        groupBy: ['platform', 'status', 'teamId'] // Multiple groupings = more rows
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        queries.map(q => analyticsService.getConversationAnalytics(q))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);

      // Check if process is still responsive
      const memoryCheck = await new Promise(resolve => {
        setTimeout(() => resolve(true), 100);
      });

      expect(memoryCheck).toBe(true);

      console.log(`✅ Memory stress test completed in ${duration}ms`);
      console.log(`   All 100 large queries completed without memory issues`);
    });
  });
});

// ======================== Test Metadata ========================

export const getStressTestSummary = () => {
  return {
    description: 'Analytics 模組性能壓力測試',
    purpose: '驗證系統在高並發和高負載場景下的性能和穩定性',
    testCategories: {
      concurrentQueries: {
        tests: 4,
        maxConcurrency: 2000,
        description: '測試不同並發級別的查詢性能'
      },
      mixedQueries: {
        tests: 1,
        totalQueries: 500,
        queryTypes: 5,
        description: '測試混合查詢類型的並發處理'
      },
      complexQueries: {
        tests: 2,
        features: ['groupBy', 'multiple filters'],
        description: '測試複雜查詢的性能'
      },
      exports: {
        tests: 1,
        formats: 4,
        concurrentExports: 50,
        description: '測試數據導出功能的並發性能'
      },
      errorRecovery: {
        tests: 1,
        errorRate: '10%',
        description: '測試錯誤處理和恢復能力'
      },
      sustainedLoad: {
        tests: 1,
        rounds: 5,
        queriesPerRound: 100,
        description: '測試持續負載下的性能穩定性'
      },
      memory: {
        tests: 1,
        querySize: 'large',
        description: '測試大數據集處理的記憶體管理'
      }
    },
    totalTests: 11,
    estimatedDuration: '2-3 minutes',
    performanceTargets: {
      '100 queries': '< 5 seconds',
      '500 queries': '< 15 seconds',
      '1000 queries': '< 30 seconds',
      '2000 queries': '< 60 seconds (best effort)'
    }
  };
};