// EventQueueService Unit Tests
// Tests for src/modules/realtime/services/event-queue-service.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventQueueService, ProcessingStrategy } from '@modules/realtime/services/event-queue-service';
import type { Bindings } from '@/types';
import type { EventTargets } from '@modules/realtime/types';

// ======================== Mock Helpers ========================

function makeFetchResponse(ok = true, body: unknown = { deliveredCount: 1 }): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  } as unknown as Response;
}

function makeDOStub(fetchResponse: () => Response = () => makeFetchResponse(true)) {
  const stub = {
    idFromName: vi.fn().mockReturnValue('mock-do-id'),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockImplementation(() => Promise.resolve(fetchResponse()))
    })
  };
  return stub;
}

function createMockEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    CONVERSATION_ROOM: makeDOStub(),
    MESSAGE_BROADCASTER: makeDOStub(),
    ...overrides
  } as unknown as Bindings;
}

// ======================== Tests ========================

describe('EventQueueService', () => {
  let service: EventQueueService;
  let mockEnv: Bindings;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEnv = createMockEnv();
    service = new EventQueueService(mockEnv);
  });

  afterEach(() => {
    // Clean up batch processor interval started by constructor
    service.cleanup().catch(() => {});
    vi.useRealTimers();
  });

  // ======================== Routing Rules ========================

  describe('getRoutingRules', () => {
    it('initialises routing rules for all defined event types', () => {
      const rules = service.getRoutingRules();
      const ruleKeys = Object.keys(rules);

      expect(ruleKeys.length).toBeGreaterThanOrEqual(10);
      expect(rules).toHaveProperty('message');
      expect(rules).toHaveProperty('typing_started');
      expect(rules).toHaveProperty('typing_stopped');
      expect(rules).toHaveProperty('agent_joined');
      expect(rules).toHaveProperty('agent_left');
      expect(rules).toHaveProperty('assignment_changed');
      expect(rules).toHaveProperty('status_changed');
      expect(rules).toHaveProperty('notification');
      expect(rules).toHaveProperty('conversation_updated');
      expect(rules).toHaveProperty('system_announcement');
    });

    it('maps message events to immediate processing strategy', () => {
      const rules = service.getRoutingRules();
      expect(rules.message.processingStrategy).toBe(ProcessingStrategy.IMMEDIATE);
    });

    it('maps typing_stopped to batch processing strategy', () => {
      const rules = service.getRoutingRules();
      expect(rules.typing_stopped.processingStrategy).toBe(ProcessingStrategy.BATCH);
    });

    it('maps conversation_updated to batch processing strategy', () => {
      const rules = service.getRoutingRules();
      expect(rules.conversation_updated.processingStrategy).toBe(ProcessingStrategy.BATCH);
    });

    it('maps system_announcement to immediate strategy with broadcast target', () => {
      const rules = service.getRoutingRules();
      expect(rules.system_announcement.processingStrategy).toBe(ProcessingStrategy.IMMEDIATE);
      expect(rules.system_announcement.targets.broadcast).toBe(true);
    });

    it('maps message to high priority', () => {
      const rules = service.getRoutingRules();
      expect(rules.message.priority).toBe('high');
    });

    it('maps system_announcement to urgent priority', () => {
      const rules = service.getRoutingRules();
      expect(rules.system_announcement.priority).toBe('urgent');
    });
  });

  // ======================== updateRoutingRule ========================

  describe('updateRoutingRule', () => {
    it('updates an existing rule with new values', () => {
      service.updateRoutingRule('message', { processingStrategy: 'batch' });
      const rules = service.getRoutingRules();
      expect(rules.message.processingStrategy).toBe('batch');
    });

    it('does not throw when rule for event type does not exist', () => {
      expect(() => {
        service.updateRoutingRule('heartbeat' as any, { processingStrategy: 'batch' });
      }).not.toThrow();
    });
  });

  // ======================== createAndRouteEvent – immediate strategy ========================

  describe('createAndRouteEvent with immediate strategy', () => {
    it('routes message event to ConversationRoom DO when conversationId provided', async () => {
      const conversationRoomStub = mockEnv.CONVERSATION_ROOM as any;

      const result = await service.createAndRouteEvent(
        'message',
        { content: 'hello' },
        { conversationId: 42 }
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBeTruthy();
      expect(result.targetReached).toBe(1);
      expect(conversationRoomStub.idFromName).toHaveBeenCalledWith('42');
    });

    it('routes system_announcement to MessageBroadcaster DO when no conversationId', async () => {
      const broadcasterStub = mockEnv.MESSAGE_BROADCASTER as any;

      const result = await service.createAndRouteEvent(
        'system_announcement',
        { message: 'maintenance' },
        { broadcast: true }
      );

      expect(result.success).toBe(true);
      expect(broadcasterStub.idFromName).toHaveBeenCalledWith('global');
    });

    it('returns success: false when DO fetch fails', async () => {
      mockEnv = createMockEnv({
        CONVERSATION_ROOM: {
          idFromName: vi.fn().mockReturnValue('mock-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(makeFetchResponse(false))
          })
        } as any
      });
      service = new EventQueueService(mockEnv);

      const result = await service.createAndRouteEvent(
        'message',
        { content: 'fail' },
        { conversationId: 99 }
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('returns success: false when CONVERSATION_ROOM binding is missing', async () => {
      mockEnv = createMockEnv({ CONVERSATION_ROOM: undefined as any });
      service = new EventQueueService(mockEnv);

      const result = await service.createAndRouteEvent(
        'message',
        { content: 'test' },
        { conversationId: 1 }
      );

      expect(result.success).toBe(false);
    });

    it('populates processedAt and processingTime in result', async () => {
      const result = await service.createAndRouteEvent(
        'agent_joined',
        {},
        { conversationId: 5 }
      );

      expect(result.processedAt).toBeTruthy();
      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('uses provided priority over default rule priority', async () => {
      const result = await service.createAndRouteEvent(
        'message',
        { content: 'urgent' },
        { conversationId: 1 },
        'urgent'
      );

      expect(result.success).toBe(true);
    });
  });

  // ======================== createAndRouteEvent – batch strategy ========================

  describe('createAndRouteEvent with batch strategy', () => {
    it('adds event to batch queue without immediately calling MessageBroadcaster', async () => {
      const broadcasterStub = mockEnv.MESSAGE_BROADCASTER as any;
      const fetchSpy = broadcasterStub.get().fetch;

      const result = await service.createAndRouteEvent(
        'typing_stopped',
        { isTyping: false },
        { conversationId: 10 }
      );

      // Returns success = true (queued) but MessageBroadcaster not called yet
      expect(result.success).toBe(true);
      expect(result.targetReached).toBe(1);
      // Batch flush hasn't happened yet (only 1 item < batchSize=10)
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('flushes batch when batchSize (10) is reached', async () => {
      const broadcasterStub = mockEnv.MESSAGE_BROADCASTER as any;
      const fetchSpy = broadcasterStub.get().fetch;

      // Enqueue 10 events to hit the batchSize limit
      const enqueuePromises = Array.from({ length: 10 }, (_, i) =>
        service.createAndRouteEvent(
          'conversation_updated',
          { id: i },
          { conversationId: i + 1 }
        )
      );
      await Promise.all(enqueuePromises);

      expect(fetchSpy).toHaveBeenCalled();
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
      const request = lastCall[0] as Request;
      expect(request.url).toContain('batch-events');
    });

    it('flushes batch queue when interval fires', async () => {
      const broadcasterStub = mockEnv.MESSAGE_BROADCASTER as any;
      const fetchSpy = broadcasterStub.get().fetch;

      // Enqueue fewer than batchSize so it won't auto-flush
      await service.createAndRouteEvent(
        'agent_left',
        {},
        { conversationId: 1 }
      );

      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance timer past the 1000ms batch interval
      await vi.advanceTimersByTimeAsync(1100);

      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  // ======================== getQueueStats ========================

  describe('getQueueStats', () => {
    it('returns queue type and batch queue stats', () => {
      const stats = service.getQueueStats();

      expect(stats.queueType).toBe('event_queue');
      expect(stats.batchQueue).toBeDefined();
      expect(stats.batchQueue.maxSize).toBe(10);
      expect(stats.batchQueue.processingInterval).toBe(1000);
      expect(typeof stats.batchQueue.size).toBe('number');
    });

    it('includes routing rules count', () => {
      const stats = service.getQueueStats();
      expect(stats.routingRules).toBeGreaterThanOrEqual(10);
    });
  });

  // ======================== cleanup ========================

  describe('cleanup', () => {
    it('stops the batch processor and flushes remaining items', async () => {
      // Add one item to batch
      await service.createAndRouteEvent(
        'agent_left',
        {},
        { conversationId: 2 }
      );

      const broadcasterStub = mockEnv.MESSAGE_BROADCASTER as any;
      const fetchSpy = broadcasterStub.get().fetch;

      await service.cleanup();

      // Cleanup should have flushed the remaining batch
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  // ======================== ProcessingStrategy enum ========================

  describe('ProcessingStrategy enum', () => {
    it('exports IMMEDIATE, BATCH, DELAYED values', () => {
      expect(ProcessingStrategy.IMMEDIATE).toBe('immediate');
      expect(ProcessingStrategy.BATCH).toBe('batch');
      expect(ProcessingStrategy.DELAYED).toBe('delayed');
    });
  });
});
