// 撤回功能整合測試
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageRecallService } from '../../src/services/message-recall-service';
import { DatabaseService } from '../../src/services/database';
import type { Bindings } from '../../src/types';
import { webcrypto } from 'node:crypto';

// 設置全局 crypto
if (!global.crypto) {
  global.crypto = {
    ...webcrypto,
    randomUUID: () => 'mock-uuid-12345'
  } as any;
}

// 整合測試：測試撤回功能與各系統組件的整合
describe('Message Recall Integration Tests', () => {
  let recallService: MessageRecallService;
  let mockBindings: Bindings;
  let mockDbService: DatabaseService;

  beforeEach(() => {
    // 建立更真實的 mock 環境
    mockBindings = {
      DB: {
        prepare: vi.fn().mockImplementation((sql: string) => {
          const statement = {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] })
          };
          // 確保 bind 方法返回 statement 本身
          statement.bind = vi.fn().mockReturnValue(statement);
          return statement;
        })
      } as any,
      SESSIONS: {} as any, // KV 接口對象
      AGENT_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined),
        messages: [] as any[] // 模擬佇列
      } as any,
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
      FB_PAGE_ACCESS_TOKEN: 'test-fb-token'
    } as any;

    // 使用獨立的 Map 來避免循環引用
    const kvStorage = new Map<string, { value: string; options?: any; timestamp: number }>();
    
    // 實現 KV 操作
    mockBindings.SESSIONS.put = vi.fn().mockImplementation(async (key: string, value: string, options?: any) => {
      kvStorage.set(key, { value, options, timestamp: Date.now() });
    });
    
    mockBindings.SESSIONS.get = vi.fn().mockImplementation(async (key: string) => {
      const item = kvStorage.get(key);
      if (!item) return null;
      
      // 檢查 TTL
      if (item.options?.expirationTtl) {
        const expireTime = item.timestamp + (item.options.expirationTtl * 1000);
        if (Date.now() > expireTime) {
          kvStorage.delete(key);
          return null;
        }
      }
      
      return item.value;
    });

    mockBindings.SESSIONS.delete = vi.fn().mockImplementation(async (key: string) => {
      kvStorage.delete(key);
    });

    recallService = new MessageRecallService(mockBindings);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Recall Flow', () => {
    it('should complete full recall workflow', async () => {
      const request = {
        conversationId: 1,
        content: 'Integration test message',
        delaySeconds: 60,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request);
      expect(sendResult.success).toBe(true);
      expect(sendResult.messageId).toBeDefined();

      const messageId = sendResult.messageId!;

      // 2. 驗證 KV 中存在撤回標記
      const recallableKey = `recallable:${messageId}`;
      const kvData = await mockBindings.SESSIONS.get(recallableKey);
      expect(kvData).toBeTruthy();

      const recallInfo = JSON.parse(kvData);
      expect(recallInfo.recallable).toBe(true);
      expect(recallInfo.senderId).toBe(123);

      // 3. 驗證可以撤回
      const canRecall = await recallService.canRecallMessage(messageId, 123);
      expect(canRecall).toBe(true);

      // 4. 執行撤回
      const recallResult = await recallService.recallMessage(messageId, 123);
      expect(recallResult.success).toBe(true);

      // 5. 驗證撤回後狀態
      const cancelledKey = `cancelled:${messageId}`;
      const cancelledData = await mockBindings.SESSIONS.get(cancelledKey);
      expect(cancelledData).toBeTruthy();

      const cancelInfo = JSON.parse(cancelledData);
      expect(cancelInfo.cancelled).toBe(true);
      expect(cancelInfo.cancelledBy).toBe(123);

      // 6. 驗證無法再次撤回
      const canRecallAfter = await recallService.canRecallMessage(messageId, 123);
      expect(canRecallAfter).toBe(false);
    });

    it('should handle queue processing after recall', async () => {
      const request = {
        conversationId: 1,
        content: 'Queue test message',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request);
      const messageId = sendResult.messageId!;

      // 2. 撤回訊息
      await recallService.recallMessage(messageId, 123);

      // 3. 模擬佇列處理
      const processResult = await recallService.processQueueMessage(messageId);

      // 4. 驗證被跳過
      expect(processResult.success).toBe(true);
      expect(processResult.skipped).toBe(true);
    });

    it('should handle concurrent recall attempts', async () => {
      const request = {
        conversationId: 1,
        content: 'Concurrent test message',
        delaySeconds: 60,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request);
      const messageId = sendResult.messageId!;

      // 2. 同時發起多個撤回請求
      const recallPromises = Array(5).fill(null).map(() =>
        recallService.recallMessage(messageId, 123)
      );

      const results = await Promise.all(recallPromises);

      // 3. 所有請求都應該成功（KV 快速標記機制）
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // 4. 驗證只有一個取消標記
      const cancelledKey = `cancelled:${messageId}`;
      const cancelledData = await mockBindings.SESSIONS.get(cancelledKey);
      expect(cancelledData).toBeTruthy();
    });
  });

  describe('Database Integration', () => {
    it('should maintain data consistency across D1 and KV', async () => {
      const request = {
        conversationId: 1,
        content: 'Consistency test message',
        delaySeconds: 45,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      // Mock D1 查詢結果
      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'test-message-id',
                conversation_id: 1,
                sender_id: 123,
                content: 'Consistency test message',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                status: 'pending'
              })
            })
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] })
          })
        };
      });

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request);
      const messageId = sendResult.messageId!;

      // 2. 撤回訊息
      await recallService.recallMessage(messageId, 123);

      // 3. 處理佇列訊息
      await recallService.processQueueMessage(messageId);

      // 4. 驗證 D1 更新調用
      const dbCalls = mockBindings.DB.prepare.mock.calls;
      
      // 應該有插入 pending_messages 的調用
      expect(dbCalls.some(call => 
        call[0].includes('INSERT INTO pending_messages')
      )).toBe(true);

      // 應該有更新狀態的調用
      expect(dbCalls.some(call => 
        call[0].includes('UPDATE pending_messages')
      )).toBe(true);

      // 應該有插入日誌的調用
      expect(dbCalls.some(call => 
        call[0].includes('INSERT INTO message_recall_logs')
      )).toBe(true);
    });

    it('should handle database transaction failures', async () => {
      // Mock 資料庫失敗
      mockBindings.DB.prepare = vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('Transaction failed'))
        })
      }));

      const request = {
        conversationId: 1,
        content: 'Transaction test message',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await recallService.sendDelayedMessage(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
    });
  });

  describe('KV Storage Integration', () => {
    it('should handle KV TTL expiration correctly', async () => {
      const messageId = 'ttl-test-message';
      const userId = 123;

      // 1. 手動設置一個即將過期的 KV 項目
      const shortTtl = 1; // 1 秒
      await mockBindings.SESSIONS.put(
        `recallable:${messageId}`,
        JSON.stringify({
          recallable: true,
          expiresAt: new Date(Date.now() + 500).toISOString(), // 0.5 秒後過期
          senderId: userId
        }),
        { expirationTtl: shortTtl }
      );

      // 2. 立即檢查應該存在
      let canRecall = await recallService.canRecallMessage(messageId, userId);
      expect(canRecall).toBe(true);

      // 3. 等待過期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 4. 檢查應該已過期
      canRecall = await recallService.canRecallMessage(messageId, userId);
      expect(canRecall).toBe(false);
    });

    it('should cleanup KV markers after processing', async () => {
      const request = {
        conversationId: 1,
        content: 'Cleanup test message',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      // Mock 成功的平台發送
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      // Mock D1 查詢
      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'cleanup-test-id',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Cleanup test message',
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

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request);
      const messageId = sendResult.messageId!;

      // 2. 驗證 KV 標記存在
      const recallableKey = `recallable:${messageId}`;
      let kvData = await mockBindings.SESSIONS.get(recallableKey);
      expect(kvData).toBeTruthy();

      // 3. 處理佇列訊息（模擬發送成功）
      await recallService.processQueueMessage(messageId);

      // 4. 驗證 KV 標記被清理
      kvData = await mockBindings.SESSIONS.get(recallableKey);
      expect(kvData).toBeNull();

      // 5. 驗證取消標記也被清理
      const cancelledKey = `cancelled:${messageId}`;
      const cancelledData = await mockBindings.SESSIONS.get(cancelledKey);
      expect(cancelledData).toBeNull();
    });
  });

  describe('Queue System Integration', () => {
    it('should handle queue message ordering', async () => {
      const requests = [
        {
          conversationId: 1,
          content: 'First message',
          delaySeconds: 30,
          senderId: 123,
          recipientPlatformId: 'line_user_123',
          platform: 'line' as const
        },
        {
          conversationId: 1,
          content: 'Second message',
          delaySeconds: 60,
          senderId: 123,
          recipientPlatformId: 'line_user_123',
          platform: 'line' as const
        }
      ];

      // 1. 發送多個延遲訊息
      const sendResults = await Promise.all(
        requests.map(req => recallService.sendDelayedMessage(req))
      );

      // 2. 驗證都成功
      sendResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // 3. 驗證佇列調用順序
      expect(mockBindings.AGENT_QUEUE.send).toHaveBeenCalledTimes(2);
      
      const queueCalls = mockBindings.AGENT_QUEUE.send.mock.calls;
      expect(queueCalls[0][1].delaySeconds).toBe(30);
      expect(queueCalls[1][1].delaySeconds).toBe(60);
    });

    it('should handle queue processing failures gracefully', async () => {
      const request = {
        conversationId: 1,
        content: 'Queue failure test',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      // Mock 佇列失敗
      mockBindings.AGENT_QUEUE.send = vi.fn().mockRejectedValue(
        new Error('Queue service unavailable')
      );

      // 發送應該仍然成功（佇列是可選的）
      const result = await recallService.sendDelayedMessage(request);
      expect(result.success).toBe(true);

      // 但 KV 和 D1 應該仍然被更新
      expect(mockBindings.SESSIONS.put).toHaveBeenCalled();
      expect(mockBindings.DB.prepare).toHaveBeenCalled();
    });
  });

  describe('Platform Integration', () => {
    it('should handle LINE API integration', async () => {
      // Mock LINE API 成功回應
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      // Mock D1 查詢
      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'line-test-id',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'LINE test message',
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

      const result = await recallService.processQueueMessage('line-test-id');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-line-token',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('LINE test message')
        })
      );
    });

    it('should handle Facebook API integration', async () => {
      // Mock Facebook API 成功回應
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      // Mock D1 查詢
      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'fb-test-id',
                platform: 'facebook',
                recipient_platform_id: 'fb_user_123',
                content: 'Facebook test message',
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

      const result = await recallService.processQueueMessage('fb-test-id');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('Facebook test message')
        })
      );
    });

    it('should handle platform API rate limiting', async () => {
      // Mock 429 Too Many Requests
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'rate-limit-test',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Rate limit test',
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

      const result = await recallService.processQueueMessage('rate-limit-test');

      expect(result.success).toBe(false);
      // 應該記錄失敗狀態
      expect(mockBindings.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pending_messages')
      );
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from partial failures', async () => {
      const request = {
        conversationId: 1,
        content: 'Recovery test message',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      // Mock D1 成功但 KV 失敗
      let kvCallCount = 0;
      mockBindings.SESSIONS.put = vi.fn().mockImplementation(async () => {
        kvCallCount++;
        if (kvCallCount === 1) {
          throw new Error('KV service temporarily unavailable');
        }
        return Promise.resolve();
      });

      // 第一次調用應該失敗
      const firstResult = await recallService.sendDelayedMessage(request);
      expect(firstResult.success).toBe(false);

      // 第二次調用應該成功
      const secondResult = await recallService.sendDelayedMessage(request);
      expect(secondResult.success).toBe(true);
    });

    it('should handle network interruptions gracefully', async () => {
      // Mock 網路中斷
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'network-test',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Network test',
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

      const result = await recallService.processQueueMessage('network-test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });
  });
});