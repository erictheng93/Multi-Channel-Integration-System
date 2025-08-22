// MessageRecallService 性能測試
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageRecallService } from '../../../src/services/message-recall-service';
import type { Bindings } from '../../../src/types';

describe('MessageRecallService Performance Tests', () => {
  let service: MessageRecallService;
  let mockBindings: Bindings;

  beforeEach(() => {
    mockBindings = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] })
          })
        })
      } as any,
      SESSIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined)
      } as any,
      MESSAGE_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      } as any,
      LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
      FB_PAGE_ACCESS_TOKEN: 'test-token'
    } as any;

    service = new MessageRecallService(mockBindings);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Batch Operations Performance', () => {
    it('should handle multiple delayed messages efficiently', async () => {
      const batchSize = 100;
      const requests = Array(batchSize).fill(null).map((_, index) => ({
        conversationId: Math.floor(index / 10) + 1, // 10 messages per conversation
        content: `Batch message ${index}`,
        delaySeconds: 30 + (index % 60), // Vary delay times
        senderId: 123,
        recipientPlatformId: `user_${index}`,
        platform: 'line' as const
      }));

      const startTime = performance.now();

      // 並行發送所有延遲訊息
      const results = await Promise.all(
        requests.map(req => service.sendDelayedMessage(req))
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 驗證所有操作都成功
      expect(results.every(r => r.success)).toBe(true);

      // 性能要求：100個訊息應該在2秒內完成
      expect(duration).toBeLessThan(2000);

      // 驗證 DB 調用次數
      expect(mockBindings.DB.prepare).toHaveBeenCalledTimes(batchSize);

      // 驗證 KV 調用次數
      expect(mockBindings.SESSIONS.put).toHaveBeenCalledTimes(batchSize);

      // 驗證 Queue 調用次數
      expect(mockBindings.MESSAGE_QUEUE.send).toHaveBeenCalledTimes(batchSize);

      console.log(`Batch send performance: ${batchSize} messages in ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent recall operations efficiently', async () => {
      const concurrentCount = 50;
      const messageIds = Array(concurrentCount).fill(null).map((_, i) => `msg-${i}`);
      const userId = 123;

      // Mock KV 中存在可撤回的訊息
      mockBindings.SESSIONS.get = vi.fn().mockImplementation(async (key: string) => {
        if (key.startsWith('recallable:')) {
          return JSON.stringify({
            recallable: true,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            senderId: userId,
            platform: 'line'
          });
        }
        return null;
      });

      const startTime = performance.now();

      // 並行撤回所有訊息
      const results = await Promise.all(
        messageIds.map(id => service.recallMessage(id, userId))
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 驗證所有撤回都成功
      expect(results.every(r => r.success)).toBe(true);

      // 性能要求：50個並行撤回應該在1秒內完成
      expect(duration).toBeLessThan(1000);

      // 驗證 KV 調用次數（每個訊息2次：get + put）
      expect(mockBindings.SESSIONS.get).toHaveBeenCalledTimes(concurrentCount);
      expect(mockBindings.SESSIONS.put).toHaveBeenCalledTimes(concurrentCount);

      console.log(`Concurrent recall performance: ${concurrentCount} recalls in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should not leak memory during large batch operations', async () => {
      const initialMemory = process.memoryUsage();
      const batchSize = 1000;

      // 執行大批量操作
      for (let batch = 0; batch < 10; batch++) {
        const requests = Array(batchSize / 10).fill(null).map((_, index) => ({
          conversationId: batch * 100 + index,
          content: `Memory test message ${batch}-${index}`,
          delaySeconds: 30,
          senderId: 123,
          recipientPlatformId: `user_${batch}_${index}`,
          platform: 'line' as const
        }));

        await Promise.all(requests.map(req => service.sendDelayedMessage(req)));

        // 強制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // 記憶體增長應該合理（小於50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Database Query Optimization', () => {
    it('should use efficient queries for pending messages', async () => {
      const userId = 123;
      const pageSize = 100;

      // Mock 大量資料
      const mockResults = Array(pageSize).fill(null).map((_, index) => ({
        id: `msg-${index}`,
        conversation_id: index % 10,
        content: `Message ${index}`,
        scheduled_send_time: new Date(Date.now() + index * 1000).toISOString(),
        can_recall: index % 2 === 0 ? 1 : 0,
        customer_name: `Customer ${index % 10}`
      }));

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT COUNT(*)')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ total: 1000 })
            })
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockResults })
          })
        };
      });

      const startTime = performance.now();

      const result = await service.getPendingMessages(userId, 1, pageSize);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 驗證結果
      expect(result.items).toHaveLength(pageSize);
      expect(result.total).toBe(1000);

      // 性能要求：查詢應該在100ms內完成
      expect(duration).toBeLessThan(100);

      // 驗證查詢優化：應該只有2個查詢（資料 + 計數）
      expect(mockBindings.DB.prepare).toHaveBeenCalledTimes(2);

      console.log(`Query performance: ${pageSize} records in ${duration.toFixed(2)}ms`);
    });

    it('should handle large result sets efficiently', async () => {
      const userId = 123;
      const largePageSize = 1000;

      // Mock 大量資料
      const mockResults = Array(largePageSize).fill(null).map((_, index) => ({
        id: `large-msg-${index}`,
        conversation_id: index % 100,
        content: `Large dataset message ${index}`,
        scheduled_send_time: new Date(Date.now() + index * 1000).toISOString(),
        can_recall: 1,
        customer_name: `Customer ${index % 100}`
      }));

      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockResults }),
          first: vi.fn().mockResolvedValue({ total: largePageSize })
        })
      });

      const startTime = performance.now();

      const result = await service.getPendingMessages(userId, 1, largePageSize);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 驗證結果
      expect(result.items).toHaveLength(largePageSize);

      // 性能要求：大量資料查詢應該在500ms內完成
      expect(duration).toBeLessThan(500);

      console.log(`Large query performance: ${largePageSize} records in ${duration.toFixed(2)}ms`);
    });
  });

  describe('KV Operations Performance', () => {
    it('should handle rapid KV operations efficiently', async () => {
      const operationCount = 1000;
      const operations: Promise<any>[] = [];

      const startTime = performance.now();

      // 混合 KV 操作
      for (let i = 0; i < operationCount; i++) {
        const key = `perf-test-${i}`;
        const value = JSON.stringify({ 
          id: i, 
          timestamp: Date.now(),
          data: `test-data-${i}` 
        });

        // 交替進行 put 和 get 操作
        if (i % 2 === 0) {
          operations.push(mockBindings.SESSIONS.put(key, value));
        } else {
          operations.push(mockBindings.SESSIONS.get(key));
        }
      }

      await Promise.all(operations);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 性能要求：1000個 KV 操作應該在1秒內完成
      expect(duration).toBeLessThan(1000);

      console.log(`KV operations performance: ${operationCount} operations in ${duration.toFixed(2)}ms`);
    });

    it('should optimize KV key patterns for performance', async () => {
      const messageCount = 100;
      const userId = 123;

      // 測試不同的 key 模式
      const keyPatterns = [
        (id: string) => `recallable:${id}`,
        (id: string) => `cancelled:${id}`,
        (id: string) => `user:${userId}:message:${id}`
      ];

      for (const keyPattern of keyPatterns) {
        const startTime = performance.now();

        const operations = Array(messageCount).fill(null).map((_, index) => {
          const key = keyPattern(`msg-${index}`);
          const value = JSON.stringify({ test: true, index });
          return mockBindings.SESSIONS.put(key, value);
        });

        await Promise.all(operations);

        const endTime = performance.now();
        const duration = endTime - startTime;

        // 所有 key 模式都應該有相似的性能
        expect(duration).toBeLessThan(500);

        console.log(`Key pattern performance: ${keyPattern('test')} - ${duration.toFixed(2)}ms`);
      }
    });
  });

  describe('Queue Processing Performance', () => {
    it('should process queue messages efficiently', async () => {
      const messageCount = 200;
      const messageIds = Array(messageCount).fill(null).map((_, i) => `queue-msg-${i}`);

      // Mock 平台 API 成功
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      // Mock D1 查詢
      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockImplementation(async () => ({
                id: 'test-id',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Test message',
                sender_id: 123
              }))
            })
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true })
          })
        };
      });

      const startTime = performance.now();

      // 並行處理所有佇列訊息
      const results = await Promise.all(
        messageIds.map(id => service.processQueueMessage(id))
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 驗證所有處理都成功
      expect(results.every(r => r.success)).toBe(true);

      // 性能要求：200個訊息處理應該在3秒內完成
      expect(duration).toBeLessThan(3000);

      console.log(`Queue processing performance: ${messageCount} messages in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high load scenarios', async () => {
      const highLoadCount = 500;
      const concurrentBatches = 10;
      const batchSize = highLoadCount / concurrentBatches;

      const startTime = performance.now();

      // 建立多個並行批次
      const batches = Array(concurrentBatches).fill(null).map((_, batchIndex) => {
        const batchRequests = Array(batchSize).fill(null).map((_, index) => ({
          conversationId: batchIndex * batchSize + index,
          content: `Stress test message ${batchIndex}-${index}`,
          delaySeconds: 30 + (index % 90),
          senderId: 123 + (batchIndex % 10),
          recipientPlatformId: `stress_user_${batchIndex}_${index}`,
          platform: 'line' as const
        }));

        return Promise.all(batchRequests.map(req => service.sendDelayedMessage(req)));
      });

      const results = await Promise.all(batches);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 驗證所有操作都成功
      const allResults = results.flat();
      expect(allResults.every(r => r.success)).toBe(true);
      expect(allResults).toHaveLength(highLoadCount);

      // 性能要求：高負載測試應該在5秒內完成
      expect(duration).toBeLessThan(5000);

      console.log(`Stress test performance: ${highLoadCount} operations in ${duration.toFixed(2)}ms`);
    });

    it('should maintain performance under memory pressure', async () => {
      // 建立記憶體壓力
      const largeObjects: any[] = [];
      for (let i = 0; i < 100; i++) {
        largeObjects.push(new Array(10000).fill(`memory-pressure-${i}`));
      }

      const operationCount = 100;
      const requests = Array(operationCount).fill(null).map((_, index) => ({
        conversationId: index,
        content: `Memory pressure test ${index}`,
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: `pressure_user_${index}`,
        platform: 'line' as const
      }));

      const startTime = performance.now();

      const results = await Promise.all(
        requests.map(req => service.sendDelayedMessage(req))
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 清理記憶體壓力
      largeObjects.length = 0;

      // 即使在記憶體壓力下，操作也應該成功
      expect(results.every(r => r.success)).toBe(true);

      // 性能可能會受影響，但不應該太嚴重
      expect(duration).toBeLessThan(2000);

      console.log(`Memory pressure performance: ${operationCount} operations in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Performance Monitoring', () => {
    it('should provide performance metrics', async () => {
      const testOperations = [
        { name: 'sendDelayedMessage', count: 50 },
        { name: 'recallMessage', count: 25 },
        { name: 'processQueueMessage', count: 30 }
      ];

      const metrics: { [key: string]: number[] } = {};

      // Mock 撤回訊息的 KV 資料
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        senderId: 123
      }));

      // Mock 佇列處理的 D1 資料
      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'test-id',
                platform: 'line',
                recipient_platform_id: 'test',
                content: 'test',
                sender_id: 123
              })
            })
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true })
          })
        };
      });

      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      for (const operation of testOperations) {
        metrics[operation.name] = [];

        for (let i = 0; i < operation.count; i++) {
          const startTime = performance.now();

          switch (operation.name) {
            case 'sendDelayedMessage':
              await service.sendDelayedMessage({
                conversationId: i,
                content: `Test ${i}`,
                delaySeconds: 30,
                senderId: 123,
                recipientPlatformId: `user_${i}`,
                platform: 'line'
              });
              break;
            case 'recallMessage':
              await service.recallMessage(`msg-${i}`, 123);
              break;
            case 'processQueueMessage':
              await service.processQueueMessage(`queue-msg-${i}`);
              break;
          }

          const endTime = performance.now();
          metrics[operation.name].push(endTime - startTime);
        }
      }

      // 分析性能指標
      for (const [operationName, durations] of Object.entries(metrics)) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const max = Math.max(...durations);
        const min = Math.min(...durations);

        console.log(`${operationName} performance:`);
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  Max: ${max.toFixed(2)}ms`);
        console.log(`  Min: ${min.toFixed(2)}ms`);

        // 性能要求
        expect(avg).toBeLessThan(100); // 平均響應時間小於100ms
        expect(max).toBeLessThan(500); // 最大響應時間小於500ms
      }
    });
  });
});