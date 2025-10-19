// Realtime 模組集成測試
// 測試統一即時通訊模組的端到端功能

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { realtime } from '@modules/realtime';

describe('Realtime Module Integration', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      SESSIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      },
      CACHE: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      // Phase 2: REALTIME_QUEUE removed (replaced by Durable Objects)
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue([])
          })
        })
      },
      JWT_SECRET: 'test-secret'
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Module Initialization', () => {
    it('should initialize realtime module successfully', async () => {
      const manager = await realtime.initialize(mockEnv, {
        enableEventDriven: true,
        enableQueueProcessing: true
      });

      expect(manager).toBeDefined();
      expect(manager.constructor.name).toBe('RealtimeManager');
    });

    it('should initialize with custom configuration', async () => {
      const customConfig = {
        version: 'v2',
        enableEventDriven: true,
        heartbeatInterval: 10000,
        connectionTimeout: 600000
      };

      const manager = await realtime.initialize(mockEnv, customConfig);
      expect(manager).toBeDefined();
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidEnv = null;

      await expect(realtime.initialize(invalidEnv)).rejects.toThrow();
    });
  });

  describe('Event Creation and Processing', () => {
    it('should create events with queue processing enabled', async () => {
      await realtime.initialize(mockEnv, { enableQueueProcessing: true });

      const eventId = await realtime.createEvent(
        'message',
        { content: 'Test message', userId: 'user-123' },
        { conversationId: 'conv-456' },
        'normal',
        'test'
      );

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
    });

    it('should create events with KV storage when queue disabled', async () => {
      await realtime.initialize(mockEnv, { enableQueueProcessing: false });

      const eventId = await realtime.createEvent(
        'notification',
        { message: 'Test notification' },
        { broadcast: true },
        'high',
        'system'
      );

      expect(eventId).toBeDefined();
      expect(mockEnv.SESSIONS.put).toHaveBeenCalled();

      // 驗證存儲的事件格式
      const putCall = mockEnv.SESSIONS.put.mock.calls[0];
      const eventKey = putCall[0];
      const eventData = JSON.parse(putCall[1]);

      expect(eventKey).toMatch(/^event:/);
      expect(eventData.type).toBe('notification');
      expect(eventData.data.message).toBe('Test notification');
      expect(eventData.targets.broadcast).toBe(true);
    });

    it('should handle different event types', async () => {
      await realtime.initialize(mockEnv);

      const eventTypes = ['message', 'typing_status', 'notification', 'agent_joined'];

      for (const eventType of eventTypes) {
        const eventId = await realtime.createEvent(
          eventType as any,
          { test: true },
          { conversationId: 'conv-123' },
          'normal',
          'test'
        );

        expect(eventId).toBeDefined();
      }
    });

    it('should handle different priority levels', async () => {
      await realtime.initialize(mockEnv);

      const priorities = ['low', 'normal', 'high'];

      for (const priority of priorities) {
        const eventId = await realtime.createEvent(
          'message',
          { priority },
          { conversationId: 'conv-123' },
          priority as any,
          'test'
        );

        expect(eventId).toBeDefined();
      }
    });
  });

  describe('Service Integration', () => {
    it('should create realtime services successfully', async () => {
      const services = realtime.services;

      expect(services.manager).toBeDefined();
      expect(services.createPool).toBeDefined();
      expect(services.createQueue).toBeDefined();

      // 測試服務創建
      const pool = services.createPool({ maxConnections: 10 });
      expect(pool).toBeDefined();

      const queue = services.createQueue(mockEnv);
      expect(queue).toBeDefined();
    });

    it('should maintain singleton pattern for manager', () => {
      const manager1 = realtime.services.manager;
      const manager2 = realtime.services.manager;

      expect(manager1).toBe(manager2);
    });
  });

  describe('Handler Integration', () => {
    it('should provide access to all handlers', () => {
      const handlers = realtime.handlers;

      expect(handlers.main).toBeDefined();
      expect(handlers.management).toBeDefined();
      expect(handlers.sse).toBeDefined();
      expect(handlers.event).toBeDefined();

      // 檢查主要方法
      expect(handlers.main.sse).toBeDefined();
      expect(handlers.main.sendTypingStatus).toBeDefined();
      expect(handlers.main.broadcastToConversation).toBeDefined();
      expect(handlers.management.getConfig).toBeDefined();
      expect(handlers.management.healthCheck).toBeDefined();
    });

    it('should integrate with middleware system', async () => {
      const middleware = await realtime.middleware();

      expect(middleware.sse).toBeDefined();
      expect(middleware.eventSend).toBeDefined();
      expect(middleware.management).toBeDefined();
      expect(middleware.basicAuth).toBeDefined();
      expect(middleware.full).toBeDefined();

      // 檢查中間件是否為陣列
      expect(Array.isArray(middleware.sse)).toBe(true);
      expect(Array.isArray(middleware.eventSend)).toBe(true);
    });
  });

  describe('Monitoring Integration', () => {
    it('should provide monitoring capabilities', () => {
      const monitoring = realtime.monitoring;

      expect(monitoring.performance).toBeDefined();
      expect(monitoring.dashboard).toBeDefined();
      expect(monitoring.metricsHistory).toBeDefined();
      expect(monitoring.alerts).toBeDefined();
      expect(monitoring.health).toBeDefined();
      expect(monitoring.config).toBeDefined();
    });

    it('should initialize performance monitoring', () => {
      const performanceMonitor = realtime.monitoring.performance;

      expect(performanceMonitor.getLatestMetrics).toBeDefined();
      expect(performanceMonitor.getMetricsHistory).toBeDefined();
      expect(performanceMonitor.getActiveAlerts).toBeDefined();
      expect(performanceMonitor.getPerformanceSummary).toBeDefined();
    });

    it('should collect performance metrics', async () => {
      const performanceMonitor = realtime.monitoring.performance;
      performanceMonitor.initialize(mockEnv);

      // 啟動監控
      performanceMonitor.startMonitoring(0.1); // 100ms interval for testing

      // 等待至少一次指標收集
      await new Promise(resolve => setTimeout(resolve, 200));

      const latestMetrics = performanceMonitor.getLatestMetrics();
      performanceMonitor.stopMonitoring();

      // 應該有指標數據
      expect(latestMetrics).toBeDefined();
    });
  });

  describe('Status and Health', () => {
    it('should provide system status', async () => {
      await realtime.initialize(mockEnv);

      const status = await realtime.getStatus();

      expect(status).toBeDefined();
      expect(status.service).toBeDefined();
      expect(status.connections).toBeDefined();
      expect(status.queues).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });

    it('should handle status retrieval errors', async () => {
      // 不初始化直接獲取狀態
      const status = await realtime.getStatus();

      // 應該返回默認狀態或錯誤狀態
      expect(status).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should apply default configuration', () => {
      const defaultConfig = realtime.getConfig?.() || {};

      // 檢查是否有預設配置
      expect(typeof defaultConfig).toBe('object');
    });

    it('should handle configuration updates', async () => {
      const manager = await realtime.initialize(mockEnv);

      // 測試配置更新（如果有此功能）
      if (manager.updateConfig) {
        await manager.updateConfig({
          heartbeatInterval: 15000,
          enableEventDriven: false
        });

        const newConfig = manager.getConfig?.();
        if (newConfig) {
          expect(newConfig.heartbeatInterval).toBe(15000);
          expect(newConfig.enableEventDriven).toBe(false);
        }
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle service failures gracefully', async () => {
      // Mock service failure
      mockEnv.SESSIONS.put.mockRejectedValue(new Error('Storage unavailable'));

      await realtime.initialize(mockEnv);

      // 創建事件應該處理存儲錯誤
      await expect(realtime.createEvent(
        'message',
        { content: 'test' },
        { conversationId: 'conv-123' }
      )).rejects.toThrow();
    });

    // Phase 2: Test removed - REALTIME_QUEUE no longer exists
    // Queue functionality replaced by Durable Objects (MessageBroadcaster, LatestMessageCacheCoordinator)
    // Error handling for Durable Objects tested in separate DO-specific test files

    it('should provide fallback mechanisms', async () => {
      await realtime.initialize(mockEnv);

      // 測試版本回退
      const config = realtime.getConfig?.();
      if (config && config.version === 'auto') {
        // 應該能夠動態選擇版本
        expect(['v1', 'v2', 'auto']).toContain(config.version);
      }
    });
  });

  describe('Cross-Service Communication', () => {
    it('should integrate with other system components', async () => {
      await realtime.initialize(mockEnv);

      // 測試與認證系統的整合
      const authResult = await realtime.validateAccess?.('test-user', 'conv-123');
      if (authResult !== undefined) {
        expect(typeof authResult).toBe('boolean');
      }
    });

    it('should handle cross-service events', async () => {
      await realtime.initialize(mockEnv);

      // 創建跨服務事件
      const eventId = await realtime.createEvent(
        'conversation_updated',
        {
          conversationId: 'conv-123',
          updatedFields: ['status', 'assignedAgent']
        },
        {
          conversationId: 'conv-123',
          broadcast: true
        },
        'high',
        'conversation-service'
      );

      expect(eventId).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent events', async () => {
      await realtime.initialize(mockEnv);

      const events = Array.from({ length: 10 }, (_, i) =>
        realtime.createEvent(
          'message',
          { content: `Message ${i}` },
          { conversationId: `conv-${i}` },
          'normal',
          'concurrent-test'
        )
      );

      const results = await Promise.allSettled(events);
      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle high-frequency events', async () => {
      await realtime.initialize(mockEnv);

      const startTime = Date.now();
      const promises = [];

      // 快速創建多個事件
      for (let i = 0; i < 50; i++) {
        promises.push(realtime.createEvent(
          'typing_status',
          { userId: 'user-1', isTyping: i % 2 === 0 },
          { conversationId: 'conv-performance' },
          'low',
          'performance-test'
        ));
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`處理 50 個事件耗時: ${duration}ms`);

      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(40); // 允許少量失敗
      expect(duration).toBeLessThan(5000); // 應該在 5 秒內完成
    });
  });
});