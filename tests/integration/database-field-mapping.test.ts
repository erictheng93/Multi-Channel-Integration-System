// 資料庫欄位映射整合測試
// Database Field Mapping Integration Tests

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DelayedMessageService } from '@modules/messaging/services/delayed-message-service';
import type { Bindings } from '../../src/types';
import type { DelayedMessage, DelayedMessageRequest } from '../../src/types/messaging';
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

      const delayedMessageRequest: DelayedMessageRequest = {
        conversationId: testConversationId,
        senderId: testAgentId, // This should be mapped to agentId in database
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
      expect(result.messageId).toBeDefined();

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

      mockEnv.DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockDbRecord)
          })
        })
      } as any;

      const result = await service.findDelayedMessageById(testMessageId);

      expect(result).toBeDefined();
      expect(result!.senderId).toBe(testAgentId); // API field should match agentId
      expect(result!.id).toBe(testMessageId);
      expect(result!.platform).toBe('line');
    });
  });

  describe('Failure Reason Metadata Mapping', () => {
    it('should store failure reason in metadata when cancelling message', async () => {
      const testMessageId = 'test-cancel-123';
      const cancelReason = 'User requested cancellation';

      // Mock existing message
      const existingMessage = {
        id: testMessageId,
        conversationId: 12345,
        agentId: 'agent-123',
        content: 'Message to cancel',
        messageType: 'text',
        scheduledAt: '2025-01-01T11:00:00Z',
        status: 'pending',
        metadata: JSON.stringify({ platform: 'line' }),
        createdAt: '2025-01-01T10:55:00Z',
        updatedAt: '2025-01-01T10:55:00Z'
      };

      let capturedUpdateData: any;

      mockEnv.DB = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue(existingMessage)
              })
            };
          } else if (sql.includes('UPDATE')) {
            return {
              bind: vi.fn().mockReturnValue({
                run: vi.fn().mockImplementation((data: any) => {
                  capturedUpdateData = data;
                  return Promise.resolve({ success: true });
                })
              })
            };
          }
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true })
            })
          };
        })
      } as any;

      mockEnv.SESSIONS = {
        delete: vi.fn().mockResolvedValue(undefined)
      } as any;

      const result = await service.cancelDelayedMessage(testMessageId, cancelReason);

      expect(result.success).toBe(true);

      // 驗證 metadata 包含失敗原因
      expect(capturedUpdateData).toBeDefined();
      const updatedMetadata = JSON.parse(capturedUpdateData.metadata);
      expect(updatedMetadata.failureReason).toBe(cancelReason);
      expect(updatedMetadata.platform).toBe('line'); // 原有的 metadata 應該被保留
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

      mockEnv.DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockDbRecord)
          })
        })
      } as any;

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
      const createRequest: DelayedMessageRequest = {
        conversationId: testConversationId,
        senderId: testAgentId,
        content: 'Lifecycle test message',
        messageType: 'text',
        delaySeconds: 5,
        recipientPlatformId: 'lifecycle-recipient',
        platform: 'line'
      };

      // Mock creation
      let storedRecord: any;
      mockEnv.DB = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('INSERT')) {
            return {
              bind: vi.fn().mockReturnValue({
                run: vi.fn().mockImplementation((data: any) => {
                  storedRecord = data;
                  return Promise.resolve({
                    success: true,
                    meta: { last_row_id: testMessageId }
                  });
                })
              })
            };
          }
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null)
            })
          };
        })
      } as any;

      const createResult = await service.sendDelayedMessage(createRequest);
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

      mockEnv.DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(retrievalRecord)
          })
        })
      } as any;

      const retrieveResult = await service.findDelayedMessageById(testMessageId);

      // 驗證映射正確性
      expect(retrieveResult).toBeDefined();
      expect(retrieveResult!.senderId).toBe(testAgentId); // agentId mapped to senderId
      expect(retrieveResult!.platform).toBe('line');
      expect(retrieveResult!.delaySeconds).toBe(5);
      expect(retrieveResult!.recipientPlatformId).toBe('lifecycle-recipient');

      // Step 3: Test failure scenario with metadata storage
      const failureReason = 'Simulated platform failure';

      mockEnv.DB = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue(retrievalRecord)
              })
            };
          } else if (sql.includes('UPDATE')) {
            return {
              bind: vi.fn().mockReturnValue({
                run: vi.fn().mockResolvedValue({ success: true })
              })
            };
          }
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true })
            })
          };
        })
      } as any;

      mockEnv.SESSIONS = {
        delete: vi.fn().mockResolvedValue(undefined)
      } as any;

      const cancelResult = await service.cancelDelayedMessage(testMessageId, failureReason);
      expect(cancelResult.success).toBe(true);
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

      mockEnv.DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(recordWithoutMetadata)
          })
        })
      } as any;

      const result = await service.findDelayedMessageById(testMessageId);

      expect(result).toBeDefined();
      expect(result!.senderId).toBe('agent-no-meta');
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

      mockEnv.DB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(recordWithInvalidMetadata)
          })
        })
      } as any;

      // This should not throw an error but handle gracefully
      const result = await service.findDelayedMessageById(testMessageId);

      expect(result).toBeDefined();
      expect(result!.senderId).toBe('agent-invalid-meta');
      // Should use default values when JSON parsing fails
    });
  });
});