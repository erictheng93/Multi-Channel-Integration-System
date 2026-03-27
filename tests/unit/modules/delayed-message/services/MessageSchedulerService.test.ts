// MessageSchedulerService Unit Tests
// Time-management & scheduling logic — StorageService and ValidationService are mocked

import { describe, it, expect, beforeEach, vi, type MockedObject } from 'vitest';
import { MessageSchedulerService } from '@modules/delayed-message/services/MessageSchedulerService';
import { StorageService } from '@modules/delayed-message/infrastructure/StorageService';
import { ValidationService } from '@modules/delayed-message/infrastructure/ValidationService';
import type { DelayedMessageRequest, DelayedMessageEntity, RecallInfo } from '@modules/delayed-message/types';

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@modules/delayed-message/infrastructure/StorageService');
vi.mock('@modules/delayed-message/infrastructure/ValidationService');
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z'),
  nowMs: vi.fn(() => 1743033600000)
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<DelayedMessageRequest> = {}): DelayedMessageRequest {
  return {
    conversationId: 'conv-123',
    content: 'Hello, scheduled message',
    delaySeconds: 30,
    senderId: 'agent-456',
    recipientPlatformId: 'U1234567890',
    platform: 'line',
    messageType: 'text',
    ...overrides
  };
}

function makeEntity(overrides: Partial<DelayedMessageEntity> = {}): DelayedMessageEntity {
  return {
    id: 'msg-001',
    conversationId: 'conv-123',
    agentId: 'agent-456',
    content: 'Hello, scheduled message',
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

function makeRecallInfo(overrides: Partial<RecallInfo> = {}): RecallInfo {
  return {
    recallable: true,
    expiresAt: '2026-03-27T00:00:30.000Z',
    conversationId: 'conv-123',
    senderId: 'agent-456',
    platform: 'line',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageSchedulerService', () => {
  let scheduler: MessageSchedulerService;
  let mockStorage: MockedObject<StorageService>;
  let mockValidation: MockedObject<ValidationService>;
  let mockEnv: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = { DB: {}, SESSIONS: {} } as any;

    // Create the service — constructors are mocked so real deps are not called
    scheduler = new MessageSchedulerService(mockEnv as any);

    // Grab the mocked instances injected by the constructor
    mockStorage = vi.mocked(StorageService).mock.instances[0] as MockedObject<StorageService>;
    mockValidation = vi.mocked(ValidationService).mock.instances[0] as MockedObject<ValidationService>;
  });

  // -------------------------------------------------------------------------
  // scheduleMessage
  // -------------------------------------------------------------------------
  describe('scheduleMessage', () => {
    it('validates → saves → returns success with scheduledSendTime', async () => {
      mockValidation.validateDelayedMessageRequest.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.saveMessage.mockResolvedValue(true);
      mockStorage.markAsRecallable.mockResolvedValue(true);

      const result = await scheduler.scheduleMessage(makeRequest());

      expect(result.success).toBe(true);
      expect(result.messageId).toBeTypeOf('string');
      expect(result.scheduledSendTime).toBeTypeOf('string');
      expect(result.recallDeadline).toBeTypeOf('string');
      expect(mockStorage.saveMessage).toHaveBeenCalledOnce();
      expect(mockStorage.markAsRecallable).toHaveBeenCalledOnce();
    });

    it('returns error when validation fails', async () => {
      mockValidation.validateDelayedMessageRequest.mockReturnValue({
        isValid: false,
        errors: ['Delay seconds must be between 1 and 120']
      });

      const result = await scheduler.scheduleMessage(makeRequest({ delaySeconds: 999 }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(mockStorage.saveMessage).not.toHaveBeenCalled();
    });

    it('returns error when storage save fails', async () => {
      mockValidation.validateDelayedMessageRequest.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.saveMessage.mockResolvedValue(false);

      const result = await scheduler.scheduleMessage(makeRequest());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save message');
    });

    it('returns error when storage save throws', async () => {
      mockValidation.validateDelayedMessageRequest.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.saveMessage.mockRejectedValue(new Error('DB connection lost'));

      const result = await scheduler.scheduleMessage(makeRequest());

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB connection lost');
    });

    it('passes messageType from request into the entity', async () => {
      mockValidation.validateDelayedMessageRequest.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.saveMessage.mockResolvedValue(true);
      mockStorage.markAsRecallable.mockResolvedValue(true);

      await scheduler.scheduleMessage(makeRequest({ messageType: 'image', mediaUrl: 'https://example.com/img.png' }));

      const savedEntity: DelayedMessageEntity = mockStorage.saveMessage.mock.calls[0]![0] as DelayedMessageEntity;
      expect(savedEntity.messageType).toBe('image');
    });
  });

  // -------------------------------------------------------------------------
  // cancelScheduledMessage
  // -------------------------------------------------------------------------
  describe('cancelScheduledMessage', () => {
    it('cancels when permissions are valid', async () => {
      mockStorage.checkRecallable.mockResolvedValue(makeRecallInfo());
      mockValidation.validateRecallPermission.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.markAsCancelled.mockResolvedValue(true);
      mockStorage.updateMessageStatus.mockResolvedValue(true);
      mockStorage.logOperation.mockResolvedValue(true);

      const result = await scheduler.cancelScheduledMessage('msg-001', 'agent-456');

      expect(result.success).toBe(true);
      expect(mockStorage.markAsCancelled).toHaveBeenCalledOnce();
    });

    it('returns error when wrong user tries to cancel', async () => {
      mockStorage.checkRecallable.mockResolvedValue(makeRecallInfo());
      mockValidation.validateRecallPermission.mockReturnValue({
        isValid: false,
        errors: ['Permission denied: message belongs to another agent']
      });

      const result = await scheduler.cancelScheduledMessage('msg-001', 'other-agent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
      expect(mockStorage.markAsCancelled).not.toHaveBeenCalled();
    });

    it('returns error when recall deadline has passed', async () => {
      mockStorage.checkRecallable.mockResolvedValue(makeRecallInfo({ recallable: false, expiresAt: '2020-01-01T00:00:00.000Z' }));
      mockValidation.validateRecallPermission.mockReturnValue({
        isValid: false,
        errors: ['Recall deadline has passed']
      });

      const result = await scheduler.cancelScheduledMessage('msg-001', 'agent-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recall deadline');
    });

    it('returns error when storage throws during cancel', async () => {
      mockStorage.checkRecallable.mockRejectedValue(new Error('KV unavailable'));

      const result = await scheduler.cancelScheduledMessage('msg-001', 'agent-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('KV unavailable');
    });
  });

  // -------------------------------------------------------------------------
  // rescheduleMessage
  // -------------------------------------------------------------------------
  describe('rescheduleMessage', () => {
    it('updates schedule time when all conditions are met', async () => {
      mockValidation.validateDelaySeconds.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.getMessageById.mockResolvedValue(makeEntity());
      mockStorage.updateMessageStatus.mockResolvedValue(true);
      mockStorage.markAsRecallable.mockResolvedValue(true);

      const result = await scheduler.rescheduleMessage('msg-001', 60, 'agent-456');

      expect(result.success).toBe(true);
      expect(result.newScheduledTime).toBeTypeOf('string');
      expect(mockStorage.updateMessageStatus).toHaveBeenCalledOnce();
      expect(mockStorage.markAsRecallable).toHaveBeenCalledOnce();
    });

    it('returns error when new delay validation fails', async () => {
      mockValidation.validateDelaySeconds.mockReturnValue({
        isValid: false,
        errors: ['Delay must be between 1 and 120 seconds']
      });

      const result = await scheduler.rescheduleMessage('msg-001', 9999, 'agent-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Delay');
      expect(mockStorage.getMessageById).not.toHaveBeenCalled();
    });

    it('returns error when message not found', async () => {
      mockValidation.validateDelaySeconds.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.getMessageById.mockResolvedValue(null);

      const result = await scheduler.rescheduleMessage('msg-nonexistent', 60, 'agent-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message not found');
    });

    it('returns error when message is not pending', async () => {
      mockValidation.validateDelaySeconds.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.getMessageById.mockResolvedValue(makeEntity({ status: 'sent' }));

      const result = await scheduler.rescheduleMessage('msg-001', 60, 'agent-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message cannot be rescheduled');
    });

    it('returns error when a different user tries to reschedule', async () => {
      mockValidation.validateDelaySeconds.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.getMessageById.mockResolvedValue(makeEntity({ agentId: 'agent-456' }));

      const result = await scheduler.rescheduleMessage('msg-001', 60, 'other-agent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  // -------------------------------------------------------------------------
  // scheduleBatch
  // -------------------------------------------------------------------------
  describe('scheduleBatch', () => {
    it('returns results array matching input length', async () => {
      mockValidation.validateDelayedMessageRequest.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.saveMessage.mockResolvedValue(true);
      mockStorage.markAsRecallable.mockResolvedValue(true);

      const requests = [makeRequest(), makeRequest({ content: 'Second message' })];
      const results = await scheduler.scheduleBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(true);
    });

    it('handles mixed success and failure in batch', async () => {
      mockValidation.validateDelayedMessageRequest
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: false, errors: ['Content is required'] });
      mockStorage.saveMessage.mockResolvedValue(true);
      mockStorage.markAsRecallable.mockResolvedValue(true);

      const requests = [makeRequest(), makeRequest({ content: '' })];
      const results = await scheduler.scheduleBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(false);
      expect(results[1]!.error).toBeDefined();
    });

    it('includes the original request in each result', async () => {
      mockValidation.validateDelayedMessageRequest.mockReturnValue({ isValid: true, errors: [] });
      mockStorage.saveMessage.mockResolvedValue(true);
      mockStorage.markAsRecallable.mockResolvedValue(true);

      const req = makeRequest({ content: 'Batch test' });
      const results = await scheduler.scheduleBatch([req]);

      expect(results[0]!.request).toBe(req);
    });
  });
});
