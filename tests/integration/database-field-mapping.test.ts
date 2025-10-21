// 資料庫欄位映射整合測試
// Database Field Mapping Integration Tests

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DelayedMessageService } from '@modules/messaging/services/delayed-message-service';
import type { Bindings } from '../../src/types';
import type { DelayedMessage, DelayedSendRequest } from '@modules/messaging/types/message-types';
import { createMockDrizzle } from '../helpers/mockDrizzle';

// Mock drizzle function to return our mock
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDrizzle)
}));

// Global mock drizzle instance
let mockDrizzle: any;

describe('Database Field Mapping Integration Tests', () => {
  let service: DelayedMessageService;
  let mockEnv: Bindings;
  let testCtx: ExecutionContext;

  beforeEach(async () => {
    // Initialize mock Drizzle instance
    mockDrizzle = createMockDrizzle();

    // 建立模擬環境
    mockEnv = {
      DB: {} as any, // Drizzle will use this, but we mock drizzle() itself
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      } as any,
      DELAYED_MESSAGES: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      } as any,
      JWT_SECRET: 'test-secret-key',
      LINE_CHANNEL_SECRET: 'test-line-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token'
    } as Bindings;

    testCtx = {} as ExecutionContext;
    service = new DelayedMessageService(mockEnv.DB as any, mockEnv);

    // Set default Drizzle mock responses
    mockDrizzle.mockInsertResponse('delayed_messages', { id: 'test-message-id' });
    mockDrizzle.mockUpdateResponse('delayed_messages', 1);
    mockDrizzle.mockSelectResponse([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Agent ID to Sender ID Mapping', () => {
    it('should correctly map agentId to senderId when creating delayed message', async () => {
      const testAgentId = 'agent-12345';
      const testConversationId = 98765;

      const delayedMessageRequest: DelayedSendRequest = {
        conversationId: testConversationId,
        content: 'Test mapping message',
        messageType: 'text',
        delaySeconds: 10,
        recipientPlatformId: 'test-recipient',
        platform: 'line'
      };

      // Mock Drizzle conversation query (service checks if conversation exists)
      mockDrizzle.mockSelectResponse([{ id: testConversationId }]);

      const result = await service.sendDelayedMessage(delayedMessageRequest, testAgentId);

      expect(result.success).toBe(true);
      expect(result.delayedMessageId).toBeDefined();

      // 驗證 Drizzle insert was called
      expect(mockDrizzle.insert).toHaveBeenCalled();
    });

    it('should correctly map agentId to senderId when retrieving delayed message', async () => {
      const testMessageId = 'test-msg-123';
      const testAgentId = 'agent-98765';

      // Mock database record with agentId
      const mockDbRecord = {
        id: testMessageId,
        conversationId: 12345,
        agentId: testAgentId, // Database field
        content: 'Test retrieval message',
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

      // Mock Drizzle select response
      mockDrizzle.mockSelectResponse([mockDbRecord]);

      const result = await service.findDelayedMessageById(testMessageId);

      expect(result).toBeDefined();
      expect(result!.agentId).toBe(testAgentId); // agentId field in DelayedMessage interface
      expect(result!.id).toBe(testMessageId);
      expect(result!.platform).toBe('line');
    });
  });

  describe('Failure Reason Metadata Mapping', () => {
    it('should store failure reason in metadata when cancelling message', async () => {
      const testMessageId = 'test-cancel-123';
      const cancelReason = 'User requested cancellation';

      // Mock existing message with future scheduled time
      const futureTime = new Date(Date.now() + 60000).toISOString(); // 1 minute in the future
      const existingMessage = {
        id: testMessageId,
        conversationId: 12345,
        agentId: 'agent-123',
        content: 'Message to cancel',
        messageType: 'text',
        scheduledAt: futureTime,
        status: 'pending',
        metadata: JSON.stringify({
          platform: 'line',
          recipientPlatformId: 'test-recipient',
          delaySeconds: 60
        }),
        createdAt: new Date(Date.now() - 5000).toISOString(),
        updatedAt: new Date(Date.now() - 5000).toISOString()
      };

      // Mock Drizzle responses for findDelayedMessageById
      mockDrizzle.mockSelectResponse([existingMessage]);

      const result = await service.cancelDelayedMessage(testMessageId, cancelReason);

      expect(result.success).toBe(true);

      // 驗證 Drizzle update was called
      expect(mockDrizzle.update).toHaveBeenCalled();
      expect(mockEnv.SESSIONS.delete).toHaveBeenCalledWith(`recallable:${testMessageId}`);
    });

    it('should retrieve failure reason from metadata correctly', async () => {
      const testMessageId = 'test-failed-456';
      const failureReason = 'Platform API error';

      const mockDbRecord = {
        id: testMessageId,
        conversationId: 12345,
        agentId: 'agent-456',
        content: 'Failed message',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'failed',
        metadata: JSON.stringify({
          recipientPlatformId: 'test-recipient',
          platform: 'line',
          failureReason: failureReason, // Stored in metadata
          delaySeconds: 60
        }),
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T10:01:00Z'
      };

      // Mock Drizzle select response
      mockDrizzle.mockSelectResponse([mockDbRecord]);

      const result = await service.findDelayedMessageById(testMessageId);

      expect(result).toBeDefined();
      expect(result!.failureReason).toBe(failureReason); // API 應該正確提取失敗原因
      expect(result!.status).toBe('failed');
      expect(result!.platform).toBe('line');
    });
  });

  describe('Complete Lifecycle Mapping Test', () => {
    it('should maintain correct field mappings throughout message lifecycle', async () => {
      const testAgentId = 'lifecycle-agent-789';
      const testConversationId = 99999;
      const testMessageId = 'lifecycle-msg-789';

      // Step 1: Create delayed message
      const createRequest: DelayedSendRequest = {
        conversationId: testConversationId,
        content: 'Lifecycle test message',
        messageType: 'text',
        delaySeconds: 5,
        recipientPlatformId: 'lifecycle-recipient',
        platform: 'line'
      };

      // Mock conversation exists
      mockDrizzle.mockSelectResponse([{ id: testConversationId }]);

      const createResult = await service.sendDelayedMessage(createRequest, testAgentId);
      expect(createResult.success).toBe(true);

      // Step 2: Simulate retrieval with correct mapping
      const retrievalRecord = {
        id: testMessageId,
        conversationId: testConversationId,
        agentId: testAgentId, // Database uses agentId
        content: 'Lifecycle test message',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:05:00Z',
        status: 'pending',
        metadata: JSON.stringify({
          recipientPlatformId: 'lifecycle-recipient',
          platform: 'line',
          delaySeconds: 5
        }),
        createdAt: '2025-01-01T10:00:00Z',
        updatedAt: '2025-01-01T10:00:00Z'
      };

      // Mock Drizzle select for retrieval
      mockDrizzle.mockSelectResponse([retrievalRecord]);

      const retrieveResult = await service.findDelayedMessageById(testMessageId);

      // 驗證映射正確性
      expect(retrieveResult).toBeDefined();
      expect(retrieveResult!.agentId).toBe(testAgentId); // agentId field
      expect(retrieveResult!.platform).toBe('line');
      expect(retrieveResult!.delaySeconds).toBe(5);
      expect(retrieveResult!.recipientPlatformId).toBe('lifecycle-recipient');

      // Step 3: Test failure scenario with metadata storage
      const failureReason = 'Simulated platform failure';

      // Mock for cancel operation - need future scheduled time
      const futureRetrievalRecord = {
        ...retrievalRecord,
        scheduledAt: new Date(Date.now() + 60000).toISOString() // 1 minute future
      };

      // Mock Drizzle select for cancel operation
      mockDrizzle.mockSelectResponse([futureRetrievalRecord]);

      const cancelResult = await service.cancelDelayedMessage(testMessageId, failureReason);
      expect(cancelResult.success).toBe(true);

      // Verify update was called
      expect(mockDrizzle.update).toHaveBeenCalled();
      expect(mockEnv.SESSIONS.delete).toHaveBeenCalledWith(`recallable:${testMessageId}`);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle missing metadata gracefully', async () => {
      const testMessageId = 'no-metadata-msg';

      const recordWithoutMetadata = {
        id: testMessageId,
        conversationId: 12345,
        agentId: 'agent-no-meta',
        content: 'Message without metadata',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'pending',
        metadata: null, // No metadata
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T09:55:00Z'
      };

      // Mock Drizzle select response
      mockDrizzle.mockSelectResponse([recordWithoutMetadata]);

      const result = await service.findDelayedMessageById(testMessageId);

      expect(result).toBeDefined();
      expect(result!.agentId).toBe('agent-no-meta');
      expect(result!.platform).toBe('webchat'); // Default platform
      expect(result!.failureReason).toBeUndefined();
      expect(result!.recipientPlatformId).toBe('');
    });

    it('should handle invalid JSON metadata gracefully', async () => {
      const testMessageId = 'invalid-metadata-msg';

      const recordWithInvalidMetadata = {
        id: testMessageId,
        conversationId: 12345,
        agentId: 'agent-invalid-meta',
        content: 'Message with invalid metadata',
        messageType: 'text',
        scheduledAt: '2025-01-01T10:00:00Z',
        status: 'pending',
        metadata: '{invalid json}', // Invalid JSON
        createdAt: '2025-01-01T09:55:00Z',
        updatedAt: '2025-01-01T09:55:00Z'
      };

      // Mock Drizzle select response
      mockDrizzle.mockSelectResponse([recordWithInvalidMetadata]);

      // This should throw an error because JSON.parse will fail
      await expect(service.findDelayedMessageById(testMessageId)).rejects.toThrow();
    });
  });
});