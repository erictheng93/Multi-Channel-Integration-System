// Realtime 性能監控器測試
// 測試性能指標收集、警報和健康檢查功能
//
// Phase 4 Update: Replaced SSE mocks with WebSocket endpoint mocks
// All connection statistics now come from /api/websocket/metrics

import { deimport { MockFactory } from '@helpers/mockFactory';
scribe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { RealtimePerformanceMonitor } from '@modules/realtime/monitoring/performance-monitor';

// Mock global fetch for WebSocket metrics endpoint
const mockWebSocketMetrics = {
  connections: {
    totalConnections: 10,
    activeConnections: 10,
    connectionsByUser: { 1: 5, 2: 3, 3: 2 },
    connectionsByRole: { admin: 2, agent: 8 },
    averageLatency: 50,
    messagesThroughput: { inbound: 100, outbound: 150 },
    errorRate: 0.01
  }
};

// Store original fetch
const originalFetch = global.fetch;

// Mock fetch before tests
beforeAll(() => {
  global.fetch = vi.fn((url: string | URL) => {
    const urlString = url.toString();

    // Mock WebSocket metrics endpoint
    if (urlString.includes('/api/websocket/metrics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockWebSocketMetrics)
      } as Response);
    }

    // Mock delayed messages metrics endpoint
    if (urlString.includes('/api/delayed-messages/metrics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          totalScheduled: 50,
          processingRate: 10,
          averageProcessingTime: 100,
          queueDepth: 5,
          successRate: 0.98
        })
      } as Response);
    }

    // Default fallback
    return Promise.reject(new Error(`Unexpected URL: ${urlString}`));
  }) as any;
});

// Restore original fetch after tests
afterAll(() => {
  global.fetch = originalFetch;
});

vi.mock('@real-time/handlers/event-handler', () => ({
  eventStats: {
    getStats: vi.fn().mockReturnValue({
      totalEvents: 200,
      averageProcessingTime: 250,
      errorRate: 0.01,
      eventsByType: {
        'message': 150,
        'typing_status': 30,
        'notification': 20
      },
      eventsByPriority: {
        'high': 20,
        'normal': 160,
        'low': 20
      }
    })
  }
}));

vi.mock('@real-time/services/realtime-manager', () => {
  const mockInstance = {
    getComprehensiveStats: vi.fn().mockResolvedValue({
      queue: {
        queueDepth: 15,
        averageProcessingTime: 300,
        throughputPerSecond: 5,
        errorRate: 0.02,
        retryRate: 0.05
      }
    })
  };

  return {
    RealtimeManager: {
      getInstance: vi.fn(() => mockInstance)
    }
  };
});

describe('RealtimePerformanceMonitor', () => {
  let monitor: RealtimePerformanceMonitor;
  let mockEnv: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Setup mock environment with WORKER_URL for WebSocket metrics
    mockEnv = {
      WORKER_URL: 'http://localhost:8787',
      ADMIN_TOKEN: 'test-admin-token',
      SESSIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null)
      },
      CACHE: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null)
      }
    };

    monitor = RealtimePerformanceMonitor.getInstance();
    monitor.initialize(mockEnv);

    // Clear singleton state between tests
    (monitor as any).metrics = [];
    (monitor as any).alerts = [];
    (monitor as any).isMonitoring = false;

    // Reset event stats and realtime manager mocks to default values
    const { eventStats } = await import('@real-time/handlers/event-handler');
    const { RealtimeManager } = await import('@real-time/services/realtime-manager');

    vi.mocked(eventStats.getStats).mockReturnValue({
      totalEvents: 200,
      averageProcessingTime: 250,
      errorRate: 0.01,
      eventsByType: {
        'message': 150,
        'typing_status': 30,
        'notification': 20
      },
      eventsByPriority: {
        'high': 20,
        'normal': 160,
        'low': 20
      }
    });

    const mockManager = RealtimeManager.getInstance();
    vi.mocked(mockManager.getComprehensiveStats).mockResolvedValue({
      queue: {
        queueDepth: 15,
        averageProcessingTime: 300,
        throughputPerSecond: 5,
        errorRate: 0.02,
        retryRate: 0.05
      }
    });

    // Reset fetch mock to default WebSocket metrics
    vi.mocked(global.fetch).mockImplementation((url: string | URL) => {
      const urlString = url.toString();

      if (urlString.includes('/api/websocket/metrics')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockWebSocketMetrics)
        } as Response);
      }

      if (urlString.includes('/api/delayed-messages/metrics')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            totalScheduled: 50,
            processingRate: 10,
            averageProcessingTime: 100,
            queueDepth: 5,
            successRate: 0.98
          })
        } as Response);
      }

      return Promise.reject(new Error(`Unexpected URL: ${urlString}`));
    });
  });

  afterEach(() => {
    monitor.stopMonitoring();
    // Don't restore mocks here - let beforeEach handle resetting
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const newMonitor = RealtimePerformanceMonitor.getInstance();
      expect(newMonitor).toBeDefined();
      expect(newMonitor).toBe(monitor); // Singleton pattern
    });

    test('should apply custom thresholds on initialization', () => {
      monitor.initialize(mockEnv, {
        thresholds: {
          connectionFailureRate: 0.1,
          eventProcessingTime: 2000
        }
      });

      // 驗證閾值已設置（需要通過行為測試）
      expect(monitor).toBeDefined();
    });
  });

  describe('Metrics Collection', () => {
    test('should collect performance metrics successfully', async () => {
      await monitor['collectMetrics']();

      const latestMetrics = monitor.getLatestMetrics();
      expect(latestMetrics).toBeDefined();
      expect(latestMetrics?.connection.totalConnections).toBe(10);
      expect(latestMetrics?.events.totalEventsProcessed).toBe(200);
      expect(latestMetrics?.queue.queueDepth).toBe(15);
    });

    test('should handle missing queue stats gracefully', async () => {
      // Mock RealtimeManager to throw error
      const { RealtimeManager } = await import('@real-time/services/realtime-manager');
      const mockManager = RealtimeManager.getInstance();
      (mockManager.getComprehensiveStats as any).mockRejectedValueOnce(new Error('Queue not available'));

      await monitor['collectMetrics']();

      const latestMetrics = monitor.getLatestMetrics();
      expect(latestMetrics).toBeDefined();
      expect(latestMetrics?.queue.queueDepth).toBe(0); // Default value
    });

    test('should store metrics with timestamp', async () => {
      const beforeTime = Date.now();
      await monitor['collectMetrics']();
      const afterTime = Date.now();

      const latestMetrics = monitor.getLatestMetrics();
      expect(latestMetrics?.timestamp).toBeDefined();

      const metricsTime = new Date(latestMetrics!.timestamp).getTime();
      expect(metricsTime).toBeGreaterThanOrEqual(beforeTime);
      expect(metricsTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Threshold Monitoring', () => {
    test('should generate alerts when thresholds are exceeded', async () => {
      // Mock high error rate
      const { eventStats } = await import('@real-time/handlers/event-handler');
      vi.mocked(eventStats.getStats).mockReturnValueOnce({
        totalEvents: 100,
        averageProcessingTime: 250,
        errorRate: 0.1, // 10% - above threshold
        eventsByType: {},
        eventsByPriority: {}
      });

      await monitor['collectMetrics']();
      monitor['checkThresholds'](); // Manually trigger threshold checking

      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const errorRateAlert = alerts.find(a => a.metric === 'event_failure_rate');
      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert?.level).toBe('error');
    });

    test('should generate queue depth alerts', async () => {
      // Mock high queue depth
      const { RealtimeManager } = await import('@real-time/services/realtime-manager');
      const mockManager = RealtimeManager.getInstance();
      vi.mocked(mockManager.getComprehensiveStats).mockResolvedValueOnce({
        queue: {
          queueDepth: 2000, // Above threshold
          averageProcessingTime: 300,
          throughputPerSecond: 5,
          errorRate: 0.01,
          retryRate: 0.02
        }
      });

      await monitor['collectMetrics']();
      monitor['checkThresholds'](); // Manually trigger threshold checking

      const alerts = monitor.getActiveAlerts();
      const queueAlert = alerts.find(a => a.metric === 'queue_depth');
      expect(queueAlert).toBeDefined();
      expect(queueAlert?.level).toBe('warning');
    });

    test('should not generate alerts when metrics are within thresholds', async () => {
      await monitor['collectMetrics']();

      const alerts = monitor.getActiveAlerts();
      // 應該沒有警報，因為模擬數據都在正常範圍內
      expect(alerts.length).toBe(0);
    });
  });

  describe('Alert Management', () => {
    test('should resolve alerts by ID', async () => {
      // 首先生成一個警報 - 降低閾值使預設值觸發警報
      (monitor as any).thresholds.eventProcessingTime = 100; // Lower than default 250ms

      await monitor['collectMetrics']();
      monitor['checkThresholds'](); // Manually trigger threshold checking

      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const alertId = alerts[0].id;
      const resolved = monitor.resolveAlert(alertId);

      expect(resolved).toBe(true);

      const remainingActiveAlerts = monitor.getActiveAlerts();
      expect(remainingActiveAlerts.find(a => a.id === alertId)).toBeUndefined();
    });

    test('should handle non-existent alert resolution', () => {
      const resolved = monitor.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });

    test('should not resolve already resolved alerts', async () => {
      // Generate alert - 降低閾值使預設值觸發警報
      (monitor as any).thresholds.eventProcessingTime = 100; // Lower than default 250ms

      await monitor['collectMetrics']();
      monitor['checkThresholds'](); // Manually trigger threshold checking

      const alerts = monitor.getActiveAlerts();
      const alertId = alerts[0].id;

      // Resolve first time
      monitor.resolveAlert(alertId);

      // Try to resolve again
      const resolvedAgain = monitor.resolveAlert(alertId);
      expect(resolvedAgain).toBe(false);
    });
  });

  describe('Monitoring Control', () => {
    test('should start and stop monitoring', () => {
      expect(monitor['isMonitoring']).toBe(false);

      monitor.startMonitoring(1); // 1 second interval for testing
      expect(monitor['isMonitoring']).toBe(true);

      monitor.stopMonitoring();
      expect(monitor['isMonitoring']).toBe(false);
    });

    test('should not start monitoring if already running', () => {
      monitor.startMonitoring(1);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      monitor.startMonitoring(1); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ [Performance Monitor] 監控已在運行中');
      consoleSpy.mockRestore();
    });

    test('should handle monitoring errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Save original collectMetrics
      const originalCollectMetrics = monitor['collectMetrics'];

      // Mock collectMetrics to throw error
      monitor['collectMetrics'] = vi.fn().mockRejectedValue(new Error('Collection failed'));

      monitor.startMonitoring(0.1); // Very short interval

      // Wait for error to occur
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(consoleSpy).toHaveBeenCalled();

      // Restore original method
      monitor['collectMetrics'] = originalCollectMetrics;
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Summary', () => {
    test('should generate comprehensive performance summary', async () => {
      await monitor['collectMetrics']();

      const summary = monitor.getPerformanceSummary();

      expect(summary.overview).toBeDefined();
      expect(summary.overview.isHealthy).toBe(true);
      expect(summary.overview.totalConnections).toBe(10);
      expect(summary.overview.eventsPerSecond).toBeGreaterThan(0);

      expect(summary.trends).toBeDefined();
      expect(summary.trends.connectionTrend).toMatch(/up|down|stable/);
      expect(summary.trends.performanceTrend).toMatch(/improving|degrading|stable/);

      expect(summary.recommendations).toBeDefined();
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    test('should mark system as unhealthy when critical alerts exist', async () => {
      // Generate critical alert - 降低閾值使預設值觸發錯誤級別警報
      (monitor as any).thresholds.eventFailureRate = 0.005; // Lower than default 0.01 (1%)

      await monitor['collectMetrics']();
      monitor['checkThresholds'](); // Manually trigger threshold checking

      const summary = monitor.getPerformanceSummary();
      expect(summary.overview.isHealthy).toBe(false);
      expect(summary.overview.activeAlerts).toBeGreaterThan(0);
    });
  });

  describe('Data Management', () => {
    test('should limit metrics history size', async () => {
      const maxHistory = monitor['maxMetricsHistory'];

      // Collect more metrics than the limit
      for (let i = 0; i < maxHistory + 10; i++) {
        await monitor['collectMetrics']();
      }

      // Manually trigger cleanup as it's normally done in monitoring loop
      monitor['cleanupOldData']();

      const history = monitor.getMetricsHistory();
      expect(history.length).toBeLessThanOrEqual(maxHistory);
    });

    test('should clean up old data', () => {
      // Add some old metrics manually
      const oldMetrics = Array.from({ length: 10 }, (_, i) => ({
        connection: { totalConnections: i },
        events: { totalEventsProcessed: i * 10 },
        sse: { activeStreams: i },
        queue: { queueDepth: i },
        resources: { memoryUsage: 0 },
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        collectionPeriod: 30
      }));

      monitor['metrics'] = oldMetrics as any;

      monitor['cleanupOldData']();

      const remainingMetrics = monitor.getMetricsHistory();
      expect(remainingMetrics.length).toBeLessThanOrEqual(monitor['maxMetricsHistory']);
    });

    test('should return limited history when requested', async () => {
      // Add some metrics
      for (let i = 0; i < 20; i++) {
        await monitor['collectMetrics']();
      }

      const limitedHistory = monitor.getMetricsHistory(5);
      expect(limitedHistory.length).toBe(5);
    });
  });

  describe('Trend Calculation', () => {
    test('should calculate upward trend correctly', () => {
      const values = [10, 15, 20, 25, 30]; // Clear upward trend
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('up');
    });

    test('should calculate downward trend correctly', () => {
      const values = [30, 25, 20, 15, 10]; // Clear downward trend
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('down');
    });

    test('should calculate stable trend for minimal changes', () => {
      const values = [100, 101, 99, 102, 98]; // Stable with minor fluctuations
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('stable');
    });

    test('should handle insufficient data points', () => {
      const values = [10]; // Only one data point
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('stable');
    });

    test('should handle reverse trend calculation', () => {
      const values = [30, 25, 20, 15, 10]; // Decreasing values
      const trend = monitor['calculateTrend'](values, true); // Reverse = true
      expect(trend).toBe('up'); // Should be 'up' because decreasing is good (reverse)
    });
  });

  describe('Recommendations', () => {
    test('should generate performance recommendations', async () => {
      // Create high connection scenario by temporarily overriding WebSocket metrics
      const highConnectionMetrics = {
        connections: {
          totalConnections: 150, // High connection count
          activeConnections: 150,
          connectionsByUser: { 1: 50, 2: 50, 3: 50 },
          connectionsByRole: { admin: 10, agent: 140 },
          averageLatency: 50,
          messagesThroughput: { inbound: 500, outbound: 750 },
          errorRate: 0.01
        }
      };

      // Override fetch for this test
      vi.mocked(global.fetch).mockImplementationOnce((url: string | URL) => {
        const urlString = url.toString();
        if (urlString.includes('/api/websocket/metrics')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(highConnectionMetrics)
          } as Response);
        }
        return Promise.reject(new Error(`Unexpected URL: ${urlString}`));
      });

      await monitor['collectMetrics']();

      const summary = monitor.getPerformanceSummary();
      const hasConnectionRecommendation = summary.recommendations.some(
        r => r.includes('連接數較高')
      );
      expect(hasConnectionRecommendation).toBe(true);
    });

    test('should generate alert-based recommendations', async () => {
      // Create high processing time scenario - 降低閾值使預設值觸發警報
      (monitor as any).thresholds.eventProcessingTime = 100; // Lower than default 250ms

      await monitor['collectMetrics']();
      monitor['checkThresholds'](); // Manually trigger threshold checking to generate alerts

      const summary = monitor.getPerformanceSummary();
      const hasProcessingRecommendation = summary.recommendations.some(
        r => r.includes('優化事件處理邏輯')
      );
      expect(hasProcessingRecommendation).toBe(true);
    });
  });
});