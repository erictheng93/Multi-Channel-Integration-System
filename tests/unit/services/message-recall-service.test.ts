// MessageRecallService 單元測試
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageRecallService } from '@backend/services/message-recall-service';
import type { Bindings } from '@backend/types';

// Mock Bindings
const createMockBindings = (): Bindings => ({
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
} as any);

describe('MessageRecallService', () => {
  let service: MessageRecallService;
  let mockBindings: Bindings;

  beforeEach(() => {
    mockBindings = createMockBindings();
    service = new MessageRecallService(mockBindings);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendDelayedMessage', () => {
    const validRequest = {
      conversationId: 1,
      content: 'Test message',
      delaySeconds: 30,
      messageType: 'text' as const,
      senderId: 123,
      recipientPlatformId: 'line_user_123',
      platform: 'line' as const
    };

    it('should successfully send delayed message', async () => {
      const result = await service.sendDelayedMessage(validRequest);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.scheduledSendTime).toBeDefined();
      expect(result.recallDeadline).toBeDefined();

      // 驗證 D1 儲存
      expect(mockBindings.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pending_messages')
      );

      // 驗證 KV 標記
      expect(mockBindings.SESSIONS.put).toHaveBeenCalledWith(
        expect.stringMatching(/^recallable:/),
        expect.stringContaining('recallable'),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );

      // REMOVED: AGENT_QUEUE 驗證 (現由 DelayedMessageBuffer Durable Object 處理)
      // 延遲訊息現在通過 Durable Objects + Alarm API 實現，不再使用 Queue
    });

    it('should handle database error gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(dbError)
        })
      });

      const result = await service.sendDelayedMessage(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should validate delay seconds range', async () => {
      const invalidRequest = { ...validRequest, delaySeconds: 150 };
      
      // 雖然服務本身不驗證範圍，但我們可以測試邊界情況
      const result = await service.sendDelayedMessage(invalidRequest);
      
      // 應該成功，因為服務層不做驗證（由 API 層驗證）
      expect(result.success).toBe(true);
    });

    // REMOVED: AGENT_QUEUE 測試已移除
    // 延遲訊息現在由 DelayedMessageBuffer Durable Object 處理
    // 不再依賴 Cloudflare Queue
  });

  describe('recallMessage', () => {
    const messageId = 'test-message-123';
    const userId = 456;

    beforeEach(() => {
      // Mock KV 中存在可撤回的訊息
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(), // 1分鐘後過期
        conversationId: 1,
        senderId: userId,
        platform: 'line'
      }));
    });

    it('should successfully recall message', async () => {
      const result = await service.recallMessage(messageId, userId);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);

      // 驗證 KV 標記為已取消
      expect(mockBindings.SESSIONS.put).toHaveBeenCalledWith(
        `cancelled:${messageId}`,
        expect.stringContaining('cancelled'),
        expect.objectContaining({ expirationTtl: 300 })
      );
    });

    it('should reject recall for non-existent message', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(null);

      const result = await service.recallMessage(messageId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message not found or already processed');
    });

    it('should reject recall for wrong user', async () => {
      const wrongUserId = 999;

      const result = await service.recallMessage(messageId, wrongUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should reject recall after deadline', async () => {
      // Mock 過期的訊息
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 1秒前過期
        senderId: userId,
        platform: 'line'
      }));

      const result = await service.recallMessage(messageId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Recall deadline has passed');
    });

    it('should handle KV error gracefully', async () => {
      const kvError = new Error('KV service unavailable');
      mockBindings.SESSIONS.get = vi.fn().mockRejectedValue(kvError);

      const result = await service.recallMessage(messageId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('KV service unavailable');
    });
  });

  describe('processQueueMessage', () => {
    const messageId = 'queue-message-123';

    beforeEach(() => {
      // Mock D1 中的待發送訊息
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: messageId,
            conversation_id: 1,
            sender_id: 123,
            content: 'Test message',
            message_type: 'text',
            recipient_platform_id: 'line_user_123',
            platform: 'line',
            status: 'pending'
          }),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });
    });

    it('should process message successfully', async () => {
      // Mock 未被取消的訊息
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(null);

      // Mock LINE API 成功
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      const result = await service.processQueueMessage(messageId);

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();

      // 驗證發送到 LINE
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-line-token'
          })
        })
      );
    });

    it('should skip cancelled message', async () => {
      // Mock 已取消的訊息
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        cancelled: true,
        cancelledAt: new Date().toISOString()
      }));

      const result = await service.processQueueMessage(messageId);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);

      // 不應該發送到平台
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle non-existent message', async () => {
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      });

      const result = await service.processQueueMessage(messageId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pending message not found');
    });

    it('should handle platform API failure', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(null);

      // Mock LINE API 失敗
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await service.processQueueMessage(messageId);

      expect(result.success).toBe(false);
    });

    it('should handle Facebook platform', async () => {
      // Mock Facebook 訊息
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: messageId,
            platform: 'facebook',
            recipient_platform_id: 'fb_user_123',
            content: 'Test message',
            sender_id: 123
          }),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });

      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      });

      const result = await service.processQueueMessage(messageId);

      expect(result.success).toBe(true);

      // 驗證發送到 Facebook
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('canRecallMessage', () => {
    const messageId = 'test-message-123';
    const userId = 456;

    it('should return true for recallable message', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        senderId: userId
      }));

      const result = await service.canRecallMessage(messageId, userId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent message', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(null);

      const result = await service.canRecallMessage(messageId, userId);

      expect(result).toBe(false);
    });

    it('should return false for wrong user', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        senderId: 999 // 不同用戶
      }));

      const result = await service.canRecallMessage(messageId, userId);

      expect(result).toBe(false);
    });

    it('should return false for expired message', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 已過期
        senderId: userId
      }));

      const result = await service.canRecallMessage(messageId, userId);

      expect(result).toBe(false);
    });
  });

  describe('getPendingMessages', () => {
    const userId = 123;

    beforeEach(() => {
      // Mock 查詢結果
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'msg-1',
                conversation_id: 1,
                content: 'Test message 1',
                scheduled_send_time: new Date(Date.now() + 30000).toISOString(),
                status: 'pending',
                can_recall: 1,
                customer_name: 'Test Customer'
              }
            ]
          }),
          first: vi.fn().mockResolvedValue({ total: 1 })
        })
      });
    });

    it('should return paginated pending messages', async () => {
      const result = await service.getPendingMessages(userId, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);

      // 驗證查詢參數
      expect(mockBindings.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pm.sender_id = ?')
      );
    });

    it('should handle pagination correctly', async () => {
      await service.getPendingMessages(userId, 2, 10);

      // 驗證 OFFSET 計算
      const calls = mockBindings.DB.prepare.mock.calls;
      const bindCall = calls.find(call => 
        call[0].includes('LIMIT ? OFFSET ?')
      );
      expect(bindCall).toBeDefined();
    });

    it('should handle empty results', async () => {
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({ total: 0 })
        })
      });

      const result = await service.getPendingMessages(userId);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed KV data', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue('invalid-json');

      const result = await service.recallMessage('test-id', 123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });

    it('should handle network timeout for platform APIs', async () => {
      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(null);
      mockBindings.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            platform: 'line',
            recipient_platform_id: 'test',
            content: 'test'
          }),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await service.processQueueMessage('test-id');

      expect(result.success).toBe(false);
    });

    it('should handle concurrent recall attempts', async () => {
      const messageId = 'concurrent-test';
      const userId = 123;

      mockBindings.SESSIONS.get = vi.fn().mockResolvedValue(JSON.stringify({
        recallable: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        senderId: userId
      }));

      // 同時發起多個撤回請求
      const promises = Array(5).fill(null).map(() => 
        service.recallMessage(messageId, userId)
      );

      const results = await Promise.all(promises);

      // 所有請求都應該成功（因為我們使用 KV 快速標記）
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});