// RealtimeManager Unit Tests
// Tests for src/modules/realtime/services/realtime-manager.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealtimeManager, ServiceStatus } from '@modules/realtime/services/realtime-manager';
import type { Bindings } from '@/types';

// ======================== Mock EventQueueService ========================

vi.mock('@modules/realtime/services/event-queue-service', () => {
  const MockEventQueueService = vi.fn(function () {
    return {
    createAndRouteEvent: vi.fn().mockResolvedValue({
      success: true,
      eventId: 'mock-event-id',
      processedAt: new Date().toISOString(),
      targetReached: 1,
      totalTargets: 1,
      processingTime: 5
    }),
    getQueueStats: vi.fn().mockReturnValue({
      queueType: 'event_queue',
      batchQueue: { size: 0, maxSize: 10, processingInterval: 1000 },
      routingRules: 10,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      retryCount: 0,
      averageProcessingTime: 0,
      lastProcessedAt: new Date().toISOString()
    }),
    getProcessingStats: vi.fn().mockReturnValue({
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      retryCount: 0,
      averageProcessingTime: 0,
      lastProcessedAt: new Date().toISOString()
    }),
    cleanup: vi.fn().mockResolvedValue(undefined)
    };
  });

  return {
    EventQueueService: MockEventQueueService,
    ProcessingStrategy: {
      IMMEDIATE: 'immediate',
      BATCH: 'batch',
      DELAYED: 'delayed'
    }
  };
});

// ======================== Mock RealtimeConfigManager ========================

vi.mock('@modules/realtime/handlers/realtime-main', () => {
  const mockConfig = {
    version: 'auto' as const,
    enableEventDriven: true,
    enableQueueProcessing: true,
    heartbeatInterval: 8000,
    connectionTimeout: 300000,
    maxRetries: 3,
    eventStorageTtl: 300
  };

  const MockRealtimeConfigManager = {
    getInstance: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue(mockConfig),
      updateConfig: vi.fn(),
      selectVersion: vi.fn().mockReturnValue('v2')
    })
  };

  return {
    RealtimeConfigManager: MockRealtimeConfigManager,
    createRealtimeEvent: vi.fn().mockReturnValue({
      id: 'mock-rt-id',
      type: 'notification',
      timestamp: new Date().toISOString(),
      source: 'system',
      data: {}
    })
  };
});

// ======================== Mock eventStats ========================

vi.mock('@modules/realtime/handlers/event-handler', () => {
  return {
    eventStats: {
      getStats: vi.fn().mockReturnValue({
        totalEvents: 0,
        eventsByType: {},
        eventsByPriority: {},
        eventsBySource: {},
        averageProcessingTime: 0,
        successRate: 1,
        errorRate: 0,
        peakHour: 0,
        dailyVolume: []
      }),
      reset: vi.fn()
    },
    eventHandler: {
      sendTypingStatus: vi.fn(),
      broadcastToConversation: vi.fn(),
      updateOnlineStatus: vi.fn()
    }
  };
});

// ======================== Mock Bindings ========================

function createMockEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ 1: 1 })
      })
    },
    SESSIONS: {
      get: vi.fn().mockResolvedValue(null)
    },
    ...overrides
  } as unknown as Bindings;
}

// ======================== Tests ========================

describe('RealtimeManager', () => {
  let mockEnv: Bindings;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset singleton before each test
    (RealtimeManager as any).instance = undefined;
    mockEnv = createMockEnv();
  });

  afterEach(() => {
    // Shut down any running manager to clear intervals
    const instance = (RealtimeManager as any).instance;
    if (instance) {
      instance.shutdown().catch(() => {});
    }
    vi.useRealTimers();
  });

  // ======================== Singleton ========================

  describe('getInstance', () => {
    it('returns same instance on repeated calls', () => {
      const a = RealtimeManager.getInstance();
      const b = RealtimeManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a fresh instance after manual reset', () => {
      const first = RealtimeManager.getInstance();
      (RealtimeManager as any).instance = undefined;
      const second = RealtimeManager.getInstance();
      expect(first).not.toBe(second);
    });
  });

  // ======================== initialize ========================

  describe('initialize', () => {
    it('sets status to RUNNING after successful init', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      expect(manager.getStatus()).toBe(ServiceStatus.RUNNING);
    });

    it('creates an EventQueueService instance', async () => {
      const { EventQueueService } = await import('@modules/realtime/services/event-queue-service');
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      expect(EventQueueService).toHaveBeenCalledWith(mockEnv);
    });

    it('starts the health check interval', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      expect((manager as any).healthCheckInterval).toBeDefined();
    });

    it('updates config when config argument is provided', async () => {
      const { RealtimeConfigManager } = await import('@modules/realtime/handlers/realtime-main');
      const mockInstance = RealtimeConfigManager.getInstance();

      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv, { maxRetries: 5 });

      expect(mockInstance.updateConfig).toHaveBeenCalled();
    });

    it('sets status to ERROR and rethrows when initialization fails', async () => {
      const { EventQueueService } = await import('@modules/realtime/services/event-queue-service');
      (EventQueueService as any).mockImplementationOnce(function () {
        throw new Error('init failure');
      });

      const manager = RealtimeManager.getInstance();
      await expect(manager.initialize(mockEnv)).rejects.toThrow('init failure');
      expect(manager.getStatus()).toBe(ServiceStatus.ERROR);
    });
  });

  // ======================== createEvent ========================

  describe('createEvent', () => {
    it('throws when service is not initialized', async () => {
      const manager = RealtimeManager.getInstance();
      await expect(
        manager.createEvent('message', {}, { conversationId: 1 })
      ).rejects.toThrow('Service not initialized');
    });

    it('returns eventId, queueDelivered, and processingTime on success', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const result = await manager.createEvent(
        'message',
        { content: 'hello' },
        { conversationId: 1 },
        'high',
        'user'
      );

      expect(result.eventId).toBeTruthy();
      expect(result.queueDelivered).toBe(true);
      expect(typeof result.processingTime).toBe('number');
    });

    it('sets queueDelivered: false when queue service throws', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      // Override createAndRouteEvent on the already-created queueService instance
      const queueService = (manager as any).queueService;
      queueService.createAndRouteEvent.mockRejectedValueOnce(new Error('queue error'));

      const result = await manager.createEvent(
        'notification',
        {},
        { broadcast: true }
      );

      expect(result.queueDelivered).toBe(false);
    });

    it('uses default priority (normal) and source (system) when not specified', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      // Access the queueService instance through the manager's private field
      const queueService = (manager as any).queueService;

      await manager.createEvent('status_changed', {}, { conversationId: 7 });

      expect(queueService.createAndRouteEvent).toHaveBeenCalledWith(
        'status_changed',
        {},
        expect.objectContaining({ conversationId: 7 }),
        'normal',
        'system'
      );
    });
  });

  // ======================== createBatchEvents ========================

  describe('createBatchEvents', () => {
    it('returns correct success/failure counts across all events', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const result = await manager.createBatchEvents([
        { eventType: 'message', eventData: {}, targets: { conversationId: 1 } },
        { eventType: 'notification', eventData: {}, targets: { broadcast: true } },
        { eventType: 'status_changed', eventData: {}, targets: { conversationId: 3 } }
      ]);

      expect(result.totalEvents).toBe(3);
      expect(result.successCount + result.failureCount).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('records failure when createEvent throws (e.g. uninitialized service)', async () => {
      // Don't initialize — createEvent will throw "Service not initialized"
      const manager = RealtimeManager.getInstance();

      const result = await manager.createBatchEvents([
        { eventType: 'message', eventData: {}, targets: { conversationId: 1 } },
        { eventType: 'notification', eventData: {}, targets: {} }
      ]);

      expect(result.totalEvents).toBe(2);
      expect(result.failureCount).toBe(2);
      expect(result.successCount).toBe(0);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBeTruthy();
    });
  });

  // ======================== getServiceHealth ========================

  describe('getServiceHealth', () => {
    it('returns RUNNING status when initialized with healthy env', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const health = await manager.getServiceHealth();

      expect(health.status).toBe(ServiceStatus.RUNNING);
      expect(health.components.queueService).toBe('healthy');
    });

    it('reports queueService as down when not initialized', async () => {
      const manager = RealtimeManager.getInstance();
      // Do not initialize — queueService is undefined

      const health = await manager.getServiceHealth();

      expect(health.components.queueService).toBe('down');
    });

    it('includes uptime, lastCheck, and metrics fields', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const health = await manager.getServiceHealth();

      expect(typeof health.uptime).toBe('number');
      expect(health.lastCheck).toBeTruthy();
      expect(health.metrics).toBeDefined();
      expect(typeof health.metrics.eventsProcessed).toBe('number');
      expect(typeof health.metrics.errorRate).toBe('number');
    });

    it('marks database as down when DB.prepare throws', async () => {
      const failEnv = createMockEnv({
        DB: {
          prepare: vi.fn().mockReturnValue({
            first: vi.fn().mockRejectedValue(new Error('DB offline'))
          })
        } as any
      });

      const manager = RealtimeManager.getInstance();
      await manager.initialize(failEnv);

      const health = await manager.getServiceHealth();

      expect(health.components.database).toBe('down');
    });
  });

  // ======================== shutdown ========================

  describe('shutdown', () => {
    it('sets status to STOPPED', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      await manager.shutdown();

      expect(manager.getStatus()).toBe(ServiceStatus.STOPPED);
    });

    it('clears the health check interval', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      expect((manager as any).healthCheckInterval).toBeDefined();

      await manager.shutdown();

      expect((manager as any).healthCheckInterval).toBeUndefined();
    });
  });

  // ======================== health check interval ========================

  describe('health check interval', () => {
    it('fires health check callback when interval elapses', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const getHealthSpy = vi.spyOn(manager, 'getServiceHealth');

      // Advance time past the 60s health check interval
      await vi.advanceTimersByTimeAsync(60001);

      expect(getHealthSpy).toHaveBeenCalled();
    });
  });

  // ======================== getUptime ========================

  describe('getUptime', () => {
    it('returns a non-negative number', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      await vi.advanceTimersByTimeAsync(500);

      expect(manager.getUptime()).toBeGreaterThanOrEqual(0);
    });
  });

  // ======================== performMaintenance ========================

  describe('performMaintenance', () => {
    it('returns true for cleanup operation', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const result = await manager.performMaintenance('cleanup');

      expect(result).toBe(true);
    });

    it('returns true for reset_stats operation', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const result = await manager.performMaintenance('reset_stats');

      expect(result).toBe(true);
    });

    it('returns true for restart_health_check operation', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const result = await manager.performMaintenance('restart_health_check');

      expect(result).toBe(true);
    });

    it('returns false for unknown operation', async () => {
      const manager = RealtimeManager.getInstance();
      await manager.initialize(mockEnv);

      const result = await manager.performMaintenance('unknown_op' as any);

      expect(result).toBe(false);
    });
  });

  // ======================== ServiceStatus enum ========================

  describe('ServiceStatus enum', () => {
    it('exports expected status values', () => {
      expect(ServiceStatus.INITIALIZING).toBe('initializing');
      expect(ServiceStatus.RUNNING).toBe('running');
      expect(ServiceStatus.DEGRADED).toBe('degraded');
      expect(ServiceStatus.STOPPED).toBe('stopped');
      expect(ServiceStatus.ERROR).toBe('error');
    });
  });
});
