// MessageProcessorService Unit Tests
// Queue execution engine — StorageService and platform fetch calls are mocked

import { describe, it, expect, beforeEach, vi, type MockedObject } from 'vitest';
import { MessageProcessorService } from '@modules/delayed-message/services/MessageProcessorService';
import { StorageService } from '@modules/delayed-message/infrastructure/StorageService';
import type { DelayedMessageEntity } from '@modules/delayed-message/types';

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@modules/delayed-message/infrastructure/StorageService');
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z'),
  nowMs: vi.fn(() => 1743033600000)
}));

// Mock global fetch for platform API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<DelayedMessageEntity> = {}): DelayedMessageEntity {
  return {
    id: 'msg-001',
    conversationId: 'conv-123',
    agentId: 'agent-456',
    content: 'Hello from delayed message',
    messageType: 'text',
    scheduledAt: '2026-03-27T00:00:30.000Z',
    status: 'pending',
    metadata: {
      platform: 'line',
      recipientPlatformId: 'U1234567890',
      delaySeconds: 30
    },
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
    ...overrides
  };
}

function makeConversationInfo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-123',
    customerId: 'cust-789',
    platform: 'line',
    platformUserId: 'U1234567890',
    customerName: 'Test Customer',
    ...overrides
  };
}

function makeFetchOk() {
  return Promise.resolve({
    ok: true,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({})
  } as Response);
}

function makeFetchFail(status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve('API error')
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageProcessorService', () => {
  let processor: MessageProcessorService;
  let mockStorage: MockedObject<StorageService>;
  let mockEnv: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    mockEnv = {
      DB: {},
      SESSIONS: {},
      LINE_CHANNEL_ACCESS_TOKEN: 'line-token-test',
      FB_PAGE_ACCESS_TOKEN: 'fb-token-test'
    } as any;

    processor = new MessageProcessorService(mockEnv as any);
    mockStorage = vi.mocked(StorageService).mock.instances[0] as MockedObject<StorageService>;
  });

  // -------------------------------------------------------------------------
  // processQueueMessage
  // -------------------------------------------------------------------------
  describe('processQueueMessage', () => {
    it('normal flow: not cancelled → pending → sends → marks sent', async () => {
      mockStorage.isCancelled.mockResolvedValue(false);
      mockStorage.getMessageById.mockResolvedValue(makeEntity());
      mockFetch.mockResolvedValue(makeFetchOk());
      mockStorage.updateMessageStatus.mockResolvedValue(true);
      mockStorage.saveMessageRecord.mockResolvedValue(true);
      mockStorage.logOperation.mockResolvedValue(true);
      mockStorage.cleanup.mockResolvedValue(true);

      // Mock drizzle DB call used inside getConversationInfo
      const drizzleMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(makeConversationInfo())
      };
      vi.doMock('drizzle-orm/d1', () => ({ drizzle: () => drizzleMock }));
      vi.doMock('drizzle-orm', () => ({ eq: vi.fn() }));
      vi.doMock('../../../db/schema', () => ({
        conversations: {},
        customers: {}
      }));

      const result = await processor.processQueueMessage('msg-001');

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(mockStorage.updateMessageStatus).toHaveBeenCalledWith('msg-001', 'sent', expect.any(Date));
    });

    it('skips with success when message is cancelled in KV', async () => {
      mockStorage.isCancelled.mockResolvedValue(true);

      const result = await processor.processQueueMessage('msg-001');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockStorage.getMessageById).not.toHaveBeenCalled();
    });

    it('skips with success when message status is not pending', async () => {
      mockStorage.isCancelled.mockResolvedValue(false);
      mockStorage.getMessageById.mockResolvedValue(makeEntity({ status: 'sent' }));

      const result = await processor.processQueueMessage('msg-001');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('returns error when message is not found in DB', async () => {
      mockStorage.isCancelled.mockResolvedValue(false);
      mockStorage.getMessageById.mockResolvedValue(null);

      const result = await processor.processQueueMessage('msg-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('marks message as failed when platform API returns error', async () => {
      mockStorage.isCancelled.mockResolvedValue(false);
      mockStorage.getMessageById.mockResolvedValue(makeEntity());
      mockFetch.mockResolvedValue(makeFetchFail(400));
      mockStorage.updateMessageStatus.mockResolvedValue(true);
      mockStorage.logOperation.mockResolvedValue(true);
      mockStorage.cleanup.mockResolvedValue(true);

      // Stub conversation lookup to return valid info
      const drizzleMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(makeConversationInfo())
      };
      vi.doMock('drizzle-orm/d1', () => ({ drizzle: () => drizzleMock }));

      const result = await processor.processQueueMessage('msg-001');

      // Platform send failed → result.success should be false or status set to failed
      expect(mockStorage.updateMessageStatus).toHaveBeenCalledWith('msg-001', 'failed', expect.any(Date));
      // processQueueMessage itself returns success: false when sendSuccess is false
      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // retryFailedMessage
  // -------------------------------------------------------------------------
  describe('retryFailedMessage', () => {
    it('increments retryCount and retries processing', async () => {
      const failedEntity = makeEntity({ status: 'failed', metadata: { platform: 'line', retryCount: 0 } });
      mockStorage.getMessageById
        .mockResolvedValueOnce(failedEntity) // first call in retryFailedMessage
        .mockResolvedValueOnce({ ...failedEntity, status: 'pending', metadata: { ...failedEntity.metadata, retryCount: 1 } }); // second call in processQueueMessage

      mockStorage.updateMessageStatus.mockResolvedValue(true);
      mockStorage.isCancelled.mockResolvedValue(false);
      mockFetch.mockResolvedValue(makeFetchOk());
      mockStorage.saveMessageRecord.mockResolvedValue(true);
      mockStorage.logOperation.mockResolvedValue(true);
      mockStorage.cleanup.mockResolvedValue(true);

      const drizzleMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(makeConversationInfo())
      };
      vi.doMock('drizzle-orm/d1', () => ({ drizzle: () => drizzleMock }));

      const result = await processor.retryFailedMessage('msg-001', 3);

      // updateMessageStatus called to reset to 'pending' before retry
      expect(mockStorage.updateMessageStatus).toHaveBeenCalledWith('msg-001', 'pending', expect.any(Date));
      expect(result.success).toBe(true);
    });

    it('returns error when message not found', async () => {
      mockStorage.getMessageById.mockResolvedValue(null);

      const result = await processor.retryFailedMessage('msg-missing', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message not found');
    });

    it('returns error when message status is not failed', async () => {
      mockStorage.getMessageById.mockResolvedValue(makeEntity({ status: 'sent' }));

      const result = await processor.retryFailedMessage('msg-001', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message is not in failed status');
    });

    it('returns error when max retries are exceeded', async () => {
      const entity = makeEntity({ status: 'failed', metadata: { platform: 'line', retryCount: 3 } });
      mockStorage.getMessageById.mockResolvedValue(entity);

      const result = await processor.retryFailedMessage('msg-001', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Max retries exceeded');
    });
  });

  // -------------------------------------------------------------------------
  // processBatch
  // -------------------------------------------------------------------------
  describe('processBatch', () => {
    it('returns array of results matching input length', async () => {
      mockStorage.isCancelled.mockResolvedValue(true); // all cancelled → quick skip

      const results = await processor.processBatch(['msg-001', 'msg-002', 'msg-003']);

      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.messageId).toBeTypeOf('string');
        expect(r.result).toBeDefined();
      });
    });

    it('handles partial failures gracefully', async () => {
      mockStorage.isCancelled
        .mockResolvedValueOnce(true)   // msg-001 cancelled → skip
        .mockResolvedValueOnce(false); // msg-002 not cancelled

      mockStorage.getMessageById.mockResolvedValue(null); // msg-002 not found → error

      const results = await processor.processBatch(['msg-001', 'msg-002']);

      expect(results).toHaveLength(2);
      expect(results[0]!.result.success).toBe(true);   // skipped
      expect(results[0]!.result.skipped).toBe(true);
      expect(results[1]!.result.success).toBe(false);  // error
    });

    it('returns empty array for empty input', async () => {
      const results = await processor.processBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Platform routing
  // -------------------------------------------------------------------------
  describe('platform routing', () => {
    it('uses LINE API endpoint for line platform messages', async () => {
      mockStorage.isCancelled.mockResolvedValue(false);
      mockStorage.getMessageById.mockResolvedValue(makeEntity({ metadata: { platform: 'line', recipientPlatformId: 'U999' } }));
      mockFetch.mockResolvedValue(makeFetchOk());
      mockStorage.updateMessageStatus.mockResolvedValue(true);
      mockStorage.saveMessageRecord.mockResolvedValue(true);
      mockStorage.logOperation.mockResolvedValue(true);
      mockStorage.cleanup.mockResolvedValue(true);

      const drizzleMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(makeConversationInfo({ platform: 'line' }))
      };
      vi.doMock('drizzle-orm/d1', () => ({ drizzle: () => drizzleMock }));

      await processor.processQueueMessage('msg-001');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall?.[0]).toContain('api.line.me');
    });

    it('uses Facebook API endpoint for facebook platform messages', async () => {
      const fbEntity = makeEntity({
        metadata: { platform: 'facebook', recipientPlatformId: 'FB_USER_123' }
      });
      mockStorage.isCancelled.mockResolvedValue(false);
      mockStorage.getMessageById.mockResolvedValue(fbEntity);
      mockFetch.mockResolvedValue(makeFetchOk());
      mockStorage.updateMessageStatus.mockResolvedValue(true);
      mockStorage.saveMessageRecord.mockResolvedValue(true);
      mockStorage.logOperation.mockResolvedValue(true);
      mockStorage.cleanup.mockResolvedValue(true);

      const drizzleMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(makeConversationInfo({ platform: 'facebook' }))
      };
      vi.doMock('drizzle-orm/d1', () => ({ drizzle: () => drizzleMock }));

      await processor.processQueueMessage('msg-001');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall?.[0]).toContain('graph.facebook.com');
    });
  });
});
