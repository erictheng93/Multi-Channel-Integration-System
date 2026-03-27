// EventService Unit Tests
// WebSocket broadcasting — WebSocketBroadcastService is mocked

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { EventService } from '@modules/delayed-message/infrastructure/EventService';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import type { DelayedMessageEntity, DelayedMessageEvent, ProcessResult } from '@modules/delayed-message/types';

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@/services/websocket-broadcast-service');
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-27T00:00:00.000Z'),
  nowMs: vi.fn(() => 1743033600000)
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<DelayedMessageEntity> = {}): DelayedMessageEntity {
  return {
    id: 'msg-001',
    conversationId: 'conv-123',
    agentId: 'agent-456',
    content: 'Hello world',
    messageType: 'text',
    scheduledAt: '2026-03-27T00:00:30.000Z',
    status: 'pending',
    metadata: { platform: 'line' },
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
    ...overrides
  };
}

function makeSchedulerInfo() {
  return {
    scheduledBy: { id: 'agent-456', name: 'Alice', role: 'agent' },
    delaySeconds: 30,
    scheduledSendTime: '2026-03-27T00:00:30.000Z',
    recallDeadline: '2026-03-27T00:00:30.000Z'
  };
}

function makeUser(overrides: Partial<{ id: string; name: string; role: string }> = {}) {
  return { id: 'agent-456', name: 'Alice', role: 'agent', ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventService', () => {
  let eventService: EventService;
  let mockBroadcast: MockInstance;
  let mockEnv: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {} as any;
    eventService = new EventService(mockEnv as any);

    // Grab the mocked instance created in the constructor
    const instance = vi.mocked(WebSocketBroadcastService).mock.instances[0]!;
    mockBroadcast = vi.spyOn(instance, 'broadcastDelayedMessageEvent').mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // broadcastMessageScheduled
  // -------------------------------------------------------------------------
  describe('broadcastMessageScheduled', () => {
    it('calls broadcastDelayedMessageEvent with delayed_message_countdown type', async () => {
      const result = await eventService.broadcastMessageScheduled(makeEntity(), makeSchedulerInfo());

      expect(result).toBe(true);
      expect(mockBroadcast).toHaveBeenCalledOnce();

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.type).toBe('delayed_message_countdown');
      expect(event.messageId).toBe('msg-001');
      expect(event.conversationId).toBe('conv-123');
    });

    it('includes scheduledBy info in event data', async () => {
      await eventService.broadcastMessageScheduled(makeEntity(), makeSchedulerInfo());

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.data.scheduledBy).toEqual({ id: 'agent-456', name: 'Alice', role: 'agent' });
    });

    it('uses normal priority', async () => {
      await eventService.broadcastMessageScheduled(makeEntity(), makeSchedulerInfo());

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.priority).toBe('normal');
    });

    it('returns false and does not throw when broadcast fails', async () => {
      mockBroadcast.mockRejectedValueOnce(new Error('WebSocket unavailable'));

      const result = await eventService.broadcastMessageScheduled(makeEntity(), makeSchedulerInfo());

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // broadcastMessageRecalled
  // -------------------------------------------------------------------------
  describe('broadcastMessageRecalled', () => {
    it('calls broadcastDelayedMessageEvent with delayed_message_recalled type', async () => {
      const result = await eventService.broadcastMessageRecalled(
        'msg-001', 'conv-123', makeUser(), 'original content'
      );

      expect(result).toBe(true);
      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.type).toBe('delayed_message_recalled');
    });

    it('uses high priority for recall events', async () => {
      await eventService.broadcastMessageRecalled('msg-001', 'conv-123', makeUser());

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.priority).toBe('high');
    });

    it('includes recalledBy information in event data', async () => {
      await eventService.broadcastMessageRecalled('msg-001', 'conv-123', makeUser(), 'original');

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.data.recalledBy).toEqual(makeUser());
    });
  });

  // -------------------------------------------------------------------------
  // broadcastMessageFailed
  // -------------------------------------------------------------------------
  describe('broadcastMessageFailed', () => {
    it('calls broadcastDelayedMessageEvent with delayed_message_failed type', async () => {
      const result = await eventService.broadcastMessageFailed(
        'msg-001', 'conv-123', 'agent-456', 'Line API timeout'
      );

      expect(result).toBe(true);
      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.type).toBe('delayed_message_failed');
    });

    it('includes error reason in event data', async () => {
      await eventService.broadcastMessageFailed(
        'msg-001', 'conv-123', 'agent-456', 'Rate limit exceeded'
      );

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.data.failureReason).toBe('Rate limit exceeded');
    });

    it('defaults to send operation when not specified', async () => {
      await eventService.broadcastMessageFailed('msg-001', 'conv-123', 'agent-456', 'Error');

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.data.operation).toBe('send');
    });

    it('uses high priority for failure events', async () => {
      await eventService.broadcastMessageFailed('msg-001', 'conv-123', 'agent-456', 'Error');

      const event: DelayedMessageEvent = mockBroadcast.mock.calls[0]![0];
      expect(event.priority).toBe('high');
    });

    it('returns false without throwing when broadcast fails', async () => {
      mockBroadcast.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await eventService.broadcastMessageFailed('msg-001', 'conv-123', 'agent-456', 'Error');

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // broadcastBatch
  // -------------------------------------------------------------------------
  describe('broadcastBatch', () => {
    it('returns boolean array matching input length', async () => {
      const events: DelayedMessageEvent[] = [
        {
          type: 'delayed_message_countdown',
          conversationId: 'conv-1',
          messageId: 'msg-1',
          agentId: 'agent-1',
          data: {},
          priority: 'normal'
        },
        {
          type: 'delayed_message_sent',
          conversationId: 'conv-2',
          messageId: 'msg-2',
          agentId: 'agent-2',
          data: {},
          priority: 'normal'
        }
      ];

      const results = await eventService.broadcastBatch(events);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
    });

    it('returns false for failed broadcasts in batch', async () => {
      mockBroadcast
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Broadcast failed'));

      const events: DelayedMessageEvent[] = [
        { type: 'delayed_message_countdown', conversationId: 'c1', messageId: 'm1', agentId: 'a1', data: {}, priority: 'normal' },
        { type: 'delayed_message_sent', conversationId: 'c2', messageId: 'm2', agentId: 'a2', data: {}, priority: 'normal' }
      ];

      const results = await eventService.broadcastBatch(events);

      expect(results[0]).toBe(true);
      expect(results[1]).toBe(false);
    });

    it('returns empty array for empty input', async () => {
      const results = await eventService.broadcastBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // createUserInfo
  // -------------------------------------------------------------------------
  describe('createUserInfo', () => {
    it('uses displayName and role when provided', () => {
      const info = eventService.createUserInfo({ id: 'u1', displayName: 'Bob', role: 'supervisor' });
      expect(info).toEqual({ id: 'u1', name: 'Bob', role: 'supervisor' });
    });

    it('falls back to generated name when displayName is missing', () => {
      const info = eventService.createUserInfo({ id: 'u42' });
      expect(info.name).toContain('u42');
    });

    it('defaults role to agent when not provided', () => {
      const info = eventService.createUserInfo({ id: 'u1' });
      expect(info.role).toBe('agent');
    });
  });
});
