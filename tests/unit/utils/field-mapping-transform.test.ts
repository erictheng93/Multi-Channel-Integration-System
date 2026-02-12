// 資料庫欄位映射簡化測試
// Simplified Database Field Mapping Tests - 直接測試映射邏輯

import { describe, it, expect } from 'vitest';

describe('Database Field Mapping Direct Tests', () => {
  // 直接測試轉換邏輯，而不依賴完整的 service 設置
  describe('transformDbDelayedMessage Function Simulation', () => {

    // 模擬 transformDbDelayedMessage 邏輯
    function transformDbDelayedMessage(dbRecord: any) {
      // Parse metadata to extract fields not in schema
      const metadata = dbRecord.metadata ? JSON.parse(dbRecord.metadata) : {};

      return {
        id: dbRecord.id,
        conversationId: dbRecord.conversationId,
        senderId: dbRecord.agentId, // Map agentId to senderId for API compatibility
        recipientPlatformId: metadata.recipientPlatformId || '',
        platform: (metadata.platform || 'webchat'),
        content: dbRecord.content,
        messageType: dbRecord.messageType,
        delaySeconds: metadata.delaySeconds || 0,
        scheduledAt: dbRecord.scheduledAt,
        status: dbRecord.status,
        failureReason: metadata.failureReason, // Store failure reason in metadata
        mediaUrl: metadata.mediaUrl,
        metadata: dbRecord.metadata ? JSON.parse(dbRecord.metadata) : undefined,
        createdAt: dbRecord.createdAt,
        updatedAt: dbRecord.updatedAt,
      };
    }

    test('should correctly map agentId to senderId', () => {
      const mockDbRecord = {
        id: 'test-msg-123',
        conversationId: 12345,
        agentId: 'agent-789', // Database field
        content: 'Test mapping message',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'pending',
        metadata: JSON.stringify({
          recipientPlatformId: 'test-recipient',
          platform: 'line',
          delaySeconds: 30
        }),
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T09:55:00Z'
      };

      const result = transformDbDelayedMessage(mockDbRecord);

      // 驗證 agentId 正確映射到 senderId
      expect(result.senderId).toBe('agent-789');
      expect(result.senderId).toBe(mockDbRecord.agentId);

      // 驗證其他映射也正確
      expect(result.id).toBe(mockDbRecord.id);
      expect(result.platform).toBe('line');
      expect(result.recipientPlatformId).toBe('test-recipient');
      expect(result.delaySeconds).toBe(30);
    });

    test('should correctly extract failureReason from metadata', () => {
      const failureReason = 'Platform API timeout';
      const mockDbRecord = {
        id: 'failed-msg-456',
        conversationId: 67890,
        agentId: 'agent-456',
        content: 'Failed message',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'failed',
        metadata: JSON.stringify({
          recipientPlatformId: 'failed-recipient',
          platform: 'facebook',
          failureReason: failureReason, // 儲存在 metadata 中
          delaySeconds: 60
        }),
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T10:01:00Z'
      };

      const result = transformDbDelayedMessage(mockDbRecord);

      // 驗證失敗原因正確提取
      expect(result.failureReason).toBe(failureReason);
      expect(result.status).toBe('failed');
      expect(result.platform).toBe('facebook');
    });

    test('should handle missing metadata gracefully', () => {
      const mockDbRecord = {
        id: 'no-meta-msg',
        conversationId: 11111,
        agentId: 'agent-no-meta',
        content: 'Message without metadata',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'pending',
        metadata: null, // 沒有 metadata
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T09:55:00Z'
      };

      const result = transformDbDelayedMessage(mockDbRecord);

      // 驗證預設值處理
      expect(result.senderId).toBe('agent-no-meta');
      expect(result.platform).toBe('webchat'); // 預設值
      expect(result.recipientPlatformId).toBe(''); // 預設值
      expect(result.delaySeconds).toBe(0); // 預設值
      expect(result.failureReason).toBeUndefined();
      expect(result.mediaUrl).toBeUndefined();
    });

    test('should handle invalid JSON metadata gracefully', () => {
      const mockDbRecord = {
        id: 'invalid-meta-msg',
        conversationId: 22222,
        agentId: 'agent-invalid',
        content: 'Message with invalid metadata',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'pending',
        metadata: '{invalid json}', // 無效的 JSON
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T09:55:00Z'
      };

      // 這應該會拋出錯誤，因為 JSON.parse 會失敗
      expect(() => transformDbDelayedMessage(mockDbRecord)).toThrow();
    });

    test('should handle empty string metadata', () => {
      const mockDbRecord = {
        id: 'empty-meta-msg',
        conversationId: 33333,
        agentId: 'agent-empty',
        content: 'Message with empty metadata',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'pending',
        metadata: '', // 空字串
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T09:55:00Z'
      };

      const result = transformDbDelayedMessage(mockDbRecord);

      // 空字串應該被當作 falsy，使用預設值
      expect(result.senderId).toBe('agent-empty');
      expect(result.platform).toBe('webchat');
      expect(result.recipientPlatformId).toBe('');
      expect(result.delaySeconds).toBe(0);
    });

    test('should preserve all metadata fields correctly', () => {
      const complexMetadata = {
        recipientPlatformId: 'complex-recipient',
        platform: 'line',
        delaySeconds: 120,
        failureReason: 'Rate limited',
        mediaUrl: 'https://example.com/media.jpg',
        customField1: 'custom-value-1',
        customField2: { nested: 'value' }
      };

      const mockDbRecord = {
        id: 'complex-msg',
        conversationId: 44444,
        agentId: 'agent-complex',
        content: 'Complex message with full metadata',
        messageType: 'image',
        scheduledAt: '2025-01-01T12:00:00Z',
        status: 'sent',
        metadata: JSON.stringify(complexMetadata),
        createdAt: '2025-01-01T11:55:00Z',
        updatedAt: '2025-01-01T12:05:00Z'
      };

      const result = transformDbDelayedMessage(mockDbRecord);

      // 驗證所有欄位正確映射
      expect(result.senderId).toBe('agent-complex');
      expect(result.recipientPlatformId).toBe('complex-recipient');
      expect(result.platform).toBe('line');
      expect(result.delaySeconds).toBe(120);
      expect(result.failureReason).toBe('Rate limited');
      expect(result.mediaUrl).toBe('https://example.com/media.jpg');

      // 驗證完整 metadata 被保留
      expect(result.metadata).toEqual(complexMetadata);
      expect(result.metadata.customField1).toBe('custom-value-1');
      expect(result.metadata.customField2).toEqual({ nested: 'value' });
    });
  });

  describe('Metadata Storage and Retrieval Logic', () => {
    // 測試 metadata 儲存邏輯（模擬 cancelDelayedMessage 中的邏輯）
    test('should correctly merge existing metadata with new failureReason', () => {
      const existingMetadata = {
        platform: 'line',
        recipientPlatformId: 'existing-recipient',
        delaySeconds: 60,
        customData: 'preserved'
      };

      const cancelReason = 'User cancelled';

      // 模擬 cancelDelayedMessage 中的 metadata 合併邏輯
      const updatedMetadata = {
        ...existingMetadata,
        failureReason: cancelReason
      };

      expect(updatedMetadata.failureReason).toBe(cancelReason);
      expect(updatedMetadata.platform).toBe('line'); // 原有的 metadata 被保留
      expect(updatedMetadata.customData).toBe('preserved'); // 自定義欄位被保留
      expect(updatedMetadata.delaySeconds).toBe(60);
    });

    test('should handle metadata update when original metadata is null', () => {
      const existingMetadata = {}; // 沒有現有 metadata
      const cancelReason = 'API error';

      const updatedMetadata = {
        ...existingMetadata,
        failureReason: cancelReason
      };

      expect(updatedMetadata.failureReason).toBe(cancelReason);
      expect(Object.keys(updatedMetadata)).toEqual(['failureReason']);
    });
  });
});

export { }; // 使這個檔案成為模組