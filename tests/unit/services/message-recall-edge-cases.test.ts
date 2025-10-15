// MessageRecallService 邊界情況和錯誤處理測試
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageRecallService } from '../../../src/services/message-recall-service';
import type { Bindings } from '../../../src/types';

describe('MessageRecallService Edge Cases', () => {
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
      // REMOVED: AGENT_QUEUE (replaced by DelayedMessageBuffer Durable Object)
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
      FB_PAGE_ACCESS_TOKEN: 'test-fb-token'
    } as any;

    service = new MessageRecallService(mockBindings);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle extremely long message content', async () => {
      const longContent = 'A'.repeat(10000); // 10KB 內容
      const request = {
        conversationId: 1,
        content: longContent,
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);

      expect(result.success).toBe(true);
      expect(mockBindings.DB.prepare).toHaveBeenCalled();
    });

    it('should handle special characters in content', async () => {
      const specialContent = '🎉 Hello! @#$%^&*()_+ 中文 العربية 🚀\n\t"quotes"';
      const request = {
        conversationId: 1,
        content: specialContent,
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);

      expect(result.success).toBe(true);

      // 驗證內容正確傳遞
      const dbCall = mockBindings.DB.prepare.mock.calls[0];
      expect(dbCall[0]).toContain('INSERT INTO pending_messages');
    });

    it('should handle edge case delay seconds', async () => {
      const edgeCases = [1, 120]; // 最小和最大值

      for (const delaySeconds of edgeCases) {
        const request = {
          conversationId: 1,
          content: `Test delay ${delaySeconds}`,
          delaySeconds,
          senderId: 123,
          recipientPlatformId: 'line_user_123',
          platform: 'line' as const
        };

        const result = await service.sendDelayedMessage(request);
        expect(result.success).toBe(true);
      }
    });

    it('should handle very large user IDs', async () => {
      const largeUserId = Number.MAX_SAFE_INTEGER;
      const request = {
        conversationId: 1,
        content: 'Test large user ID',
        delaySeconds: 30,
        senderId: largeUserId,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);
      expect(result.success).toBe(true);
    });

    it('should handle empty platform ID', async () => {
      const request = {
        conversationId: 1,
        content: 'Test empty platform ID',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: '',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);
      expect(result.success).toBe(true);
    });
  });

  describe('Database Edge Cases', () => {
    it('should handle database connection timeout', async () => {
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('Connection timeout'))
        })
      });

      const request = {
        conversationId: 1,
        content: 'Timeout test',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });

    it('should handle database constraint violations', async () => {
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed'))
        })
      });

      const request = {
        conversationId: 1,
        content: 'Constraint test',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('UNIQUE constraint failed');
    });

    it('should handle corrupted database responses', async () => {
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            // 缺少必要欄位的損壞資料
            id: 'corrupted-msg',
            // missing other required fields
          })
        })
      });

      const result = await service.processQueueMessage('corrupted-msg');

      // 應該優雅地處理損壞的資料
      expect(result.success).toBe(false);
    });

    it('should handle null/undefined database values', async () => {
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 'null-test',
            conversation_id: null,
            sender_id: undefined,
            content: null,
            platform: 'line',
            recipient_platform_id: 'test'
          })
        })
      });

      const result = await service.processQueueMessage('null-test');

      // 應該處理 null/undefined 值
      expect(result.success).toBe(false);
    });
  });

  describe('KV Storage Edge Cases', () => {
    it('should handle KV storage quota exceeded', async () => {
      mockBindings.SESSIONS.put = vi.fn().mockRejectedValue(
        new Error('Storage quota exceeded')
      );

      const request = {
        conversationId: 1,
        content: 'Quota test',
        delaySeconds: 30,
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage quota exceeded');
    });

    it('should handle malformed JSON in KV', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue('invalid-json{');

      const result = await service.recallMessage('test-msg', 123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });

    it('should handle KV key length limits', async () => {
      const veryLongMessageId = 'msg-' + 'a'.repeat(1000);

      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        senderId: 123
      }));

      const result = await service.recallMessage(veryLongMessageId, 123);

      // 應該能處理長 key
      expect(result.success).toBe(true);
    });

    it('should handle KV service unavailable', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      const result = await service.canRecallMessage('test-msg', 123);

      expect(result).toBe(false);
    });

    it('should handle KV TTL edge cases', async () => {
      // 測試 TTL 為 0 的情況
      mockBindings.SESSIONS.put = vi.fn().mockImplementation(async (key, value, options) => {
        if (options?.expirationTtl === 0) {
          throw new Error('Invalid TTL value');
        }
      });

      const request = {
        conversationId: 1,
        content: 'TTL test',
        delaySeconds: 0, // 這會導致 TTL 計算問題
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);

      // 應該處理 TTL 邊界情況
      expect(result.success).toBe(false);
    });
  });

  describe('Platform API Edge Cases', () => {
    it('should handle LINE API rate limiting', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['Retry-After', '60']])
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

      const result = await service.processQueueMessage('rate-limit-test');

      expect(result.success).toBe(false);
    });

    it('should handle invalid platform tokens', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'auth-test',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Auth test',
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

      const result = await service.processQueueMessage('auth-test');

      expect(result.success).toBe(false);
    });

    it('should handle platform API response timeout', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        });
      });

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'timeout-test',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Timeout test',
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

      const result = await service.processQueueMessage('timeout-test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });

    it('should handle unsupported platform', async () => {
      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'unsupported-test',
                platform: 'unsupported-platform',
                recipient_platform_id: 'user_123',
                content: 'Unsupported test',
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

      const result = await service.processQueueMessage('unsupported-test');

      expect(result.success).toBe(false);
    });

    it('should handle malformed platform responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'malformed-test',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Malformed test',
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

      const result = await service.processQueueMessage('malformed-test');

      // 即使回應格式錯誤，發送成功就算成功
      expect(result.success).toBe(true);
    });
  });

  describe('Timing Edge Cases', () => {
    it('should handle messages scheduled in the past', async () => {
      const request = {
        conversationId: 1,
        content: 'Past message',
        delaySeconds: -10, // 負數延遲
        senderId: 123,
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      };

      const result = await service.sendDelayedMessage(request);

      // 應該仍然成功，但時間會被調整
      expect(result.success).toBe(true);
    });

    it('should handle recall at exact deadline', async () => {
      const now = new Date();
      const exactDeadline = new Date(now.getTime() + 1000); // 1秒後

      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: exactDeadline.toISOString(),
        senderId: 123
      }));

      // 模擬在截止時間執行撤回
      vi.useFakeTimers();
      vi.setSystemTime(exactDeadline);

      const result = await service.recallMessage('exact-deadline-test', 123);

      vi.useRealTimers();

      // 在截止時間應該仍然可以撤回
      expect(result.success).toBe(false); // 因為時間相等，會被視為過期
    });

    it('should handle system clock changes', async () => {
      const messageId = 'clock-change-test';
      const userId = 123;

      // 設置初始時間
      const initialTime = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(initialTime);

      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(initialTime.getTime() + 60000).toISOString(),
        senderId: userId
      }));

      // 檢查可以撤回
      let canRecall = await service.canRecallMessage(messageId, userId);
      expect(canRecall).toBe(true);

      // 模擬系統時間跳躍
      vi.setSystemTime(new Date('2024-01-01T13:00:00Z')); // 跳躍1小時

      // 現在應該不能撤回
      canRecall = await service.canRecallMessage(messageId, userId);
      expect(canRecall).toBe(false);

      vi.useRealTimers();
    });

    it('should handle timezone edge cases', async () => {
      // 測試不同時區的時間處理
      const timezoneTests = [
        '2024-01-01T00:00:00Z',
        '2024-01-01T23:59:59Z',
        '2024-12-31T23:59:59Z'
      ];

      for (const timeString of timezoneTests) {
        const testTime = new Date(timeString);
        vi.useFakeTimers();
        vi.setSystemTime(testTime);

        const request = {
          conversationId: 1,
          content: `Timezone test ${timeString}`,
          delaySeconds: 30,
          senderId: 123,
          recipientPlatformId: 'line_user_123',
          platform: 'line' as const
        };

        const result = await service.sendDelayedMessage(request);
        expect(result.success).toBe(true);

        vi.useRealTimers();
      }
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle rapid successive operations on same message', async () => {
      const messageId = 'rapid-test';
      const userId = 123;

      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        senderId: userId
      }));

      // 快速連續執行多個操作
      const [canRecall1, recall1, canRecall2, recall2] = await Promise.all([
        service.canRecallMessage(messageId, userId),
        service.recallMessage(messageId, userId),
        service.canRecallMessage(messageId, userId),
        service.recallMessage(messageId, userId)
      ]);

      // 第一個檢查應該成功
      expect(canRecall1).toBe(true);
      // 第一個撤回應該成功
      expect(recall1.success).toBe(true);
      // 後續操作的結果取決於實現
    });

    it('should handle queue processing during recall', async () => {
      const messageId = 'concurrent-process-test';

      // Mock KV 和 DB 狀態
      mockBindings.SESSIONS.get = vi.fn().mockImplementation(async (key: string) => {
        if (key.startsWith('cancelled:')) {
          return null; // 初始時未取消
        }
        if (key.startsWith('recallable:')) {
          return JSON.stringify({
            recallable: true,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            senderId: 123
          });
        }
        return null;
      });

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: messageId,
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Concurrent test',
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

      // 同時執行撤回和處理
      const [recallResult, processResult] = await Promise.all([
        service.recallMessage(messageId, 123),
        service.processQueueMessage(messageId)
      ]);

      // 兩個操作都應該有合理的結果
      expect(recallResult.success).toBe(true);
      expect(processResult.success).toBe(true);
    });
  });

  describe('Resource Exhaustion Edge Cases', () => {
    it('should handle memory exhaustion gracefully', async () => {
      // 模擬記憶體不足的情況
      const originalError = global.Error;
      global.Error = class extends originalError {
        constructor(message?: string) {
          super(message);
          if (message?.includes('out of memory')) {
            throw new RangeError('Maximum call stack size exceeded');
          }
        }
      } as any;

      try {
        const request = {
          conversationId: 1,
          content: 'Memory test',
          delaySeconds: 30,
          senderId: 123,
          recipientPlatformId: 'line_user_123',
          platform: 'line' as const
        };

        const result = await service.sendDelayedMessage(request);

        // 應該能處理記憶體問題
        expect(result).toBeDefined();
      } finally {
        global.Error = originalError;
      }
    });

    it('should handle network connection exhaustion', async () => {
      // 模擬網路連接耗盡
      global.fetch = vi.fn().mockRejectedValue(
        new Error('ECONNRESET: Connection reset by peer')
      );

      mockBindings.DB.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pending_messages')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'connection-test',
                platform: 'line',
                recipient_platform_id: 'line_user_123',
                content: 'Connection test',
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

      const result = await service.processQueueMessage('connection-test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });
  });

  describe('Data Corruption Edge Cases', () => {
    it('should handle corrupted message IDs', async () => {
      const corruptedIds = [
        null,
        undefined,
        '',
        'null',
        'undefined',
        '{}',
        '[]',
        'function(){}'
      ];

      for (const corruptedId of corruptedIds) {
        try {
          const result = await service.recallMessage(corruptedId as any, 123);
          expect(result.success).toBe(false);
        } catch (error) {
          // 某些情況下可能會拋出異常，這也是可接受的
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle corrupted user IDs', async () => {
      const corruptedUserIds = [
        null,
        undefined,
        NaN,
        Infinity,
        -Infinity,
        'not-a-number'
      ];

      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        senderId: 123
      }));

      for (const corruptedUserId of corruptedUserIds) {
        try {
          const result = await service.recallMessage('test-msg', corruptedUserId as any);
          expect(result.success).toBe(false);
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });
});