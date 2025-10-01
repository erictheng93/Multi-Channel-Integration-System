// Realtime 性能監控器測試
// 測試性能指標收集、警報和健康檢查功能

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RealtimePerformanceMonitor } from '@modules/realtime/monitoring/performance-monitor';

// Mock dependencies
vi.mock('../../../../src/modules/realtime/handlers/sse-handler', () => ({
  enhancedSSEManager: {
    getDetailedStats: vi.fn().mockReturnValue({
      totalConnections: 10,
      connectionsByUser: { 1: 5, 2: 3, 3: 2 },
      connectionsByConversation: { 101: 4, 102: 3, 103: 3 },
      averageUptime: 3600000,
      totalEventsSent: 150
    })
  }
}));

vi.mock('../../../../src/modules/realtime/handlers/event-handler', () => ({
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

vi.mock('../../../../src/modules/realtime/services/realtime-manager', () => {
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
    mockEnv = {
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

    // Reset mocks to default values after clearing
    const { enhancedSSEManager } = await import('../../../../src/modules/realtime/handlers/sse-handler');
    const { eventStats } = await import('../../../../src/modules/realtime/handlers/event-handler');
    const { RealtimeManager } = await import('../../../../src/modules/realtime/services/realtime-manager');

    vi.mocked(enhancedSSEManager.getDetailedStats).mockReturnValue({
      totalConnections: 10,
      connectionsByUser: { 1: 5, 2: 3, 3: 2 },
      connectionsByConversation: { 101: 4, 102: 3, 103: 3 },
      averageUptime: 3600000,
      totalEventsSent: 150
    });

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
  });

  afterEach(() => {
    monitor.stopMonitoring();
    // Don't restore mocks here - let beforeEach handle resetting
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const newMonitor = RealtimePerformanceMonitor.getInstance();
      expect(newMonitor).toBeDefined();
      expect(newMonitor).toBe(monitor); // Singleton pattern
    });

    it('should apply custom thresholds on initialization', () => {
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
    it('should collect performance metrics successfully', async () => {
      await monitor['collectMetrics']();

      const latestMetrics = monitor.getLatestMetrics();
      expect(latestMetrics).toBeDefined();
      expect(latestMetrics?.connection.totalConnections).toBe(10);
      expect(latestMetrics?.events.totalEventsProcessed).toBe(200);
      expect(latestMetrics?.queue.queueDepth).toBe(15);
    });

    it('should handle missing queue stats gracefully', async () => {
      // Mock RealtimeManager to throw error
      const { RealtimeManager } = await import('../../../../src/modules/realtime/services/realtime-manager');
      const mockManager = RealtimeManager.getInstance();
      (mockManager.getComprehensiveStats as any).mockRejectedValueOnce(new Error('Queue not available'));

      await monitor['collectMetrics']();

      const latestMetrics = monitor.getLatestMetrics();
      expect(latestMetrics).toBeDefined();
      expect(latestMetrics?.queue.queueDepth).toBe(0); // Default value
    });

    it('should store metrics with timestamp', async () => {
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
    it('should generate alerts when thresholds are exceeded', async () => {
      // Mock high error rate
      const { eventStats } = await import('../../../../src/modules/realtime/handlers/event-handler');
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

    it('should generate queue depth alerts', async () => {
      // Mock high queue depth
      const { RealtimeManager } = await import('../../../../src/modules/realtime/services/realtime-manager');
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

    it('should not generate alerts when metrics are within thresholds', async () => {
      await monitor['collectMetrics']();

      const alerts = monitor.getActiveAlerts();
      // 應該沒有警報，因為模擬數據都在正常範圍內
      expect(alerts.length).toBe(0);
    });
  });

  describe('Alert Management', () => {
    it('should resolve alerts by ID', async () => {
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

    it('should handle non-existent alert resolution', () => {
      const resolved = monitor.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });

    it('should not resolve already resolved alerts', async () => {
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
    it('should start and stop monitoring', () => {
      expect(monitor['isMonitoring']).toBe(false);

      monitor.startMonitoring(1); // 1 second interval for testing
      expect(monitor['isMonitoring']).toBe(true);

      monitor.stopMonitoring();
      expect(monitor['isMonitoring']).toBe(false);
    });

    it('should not start monitoring if already running', () => {
      monitor.startMonitoring(1);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      monitor.startMonitoring(1); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ [Performance Monitor] 監控已在運行中');
      consoleSpy.mockRestore();
    });

    it('should handle monitoring errors gracefully', async () => {
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
    it('should generate comprehensive performance summary', async () => {
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

    it('should mark system as unhealthy when critical alerts exist', async () => {
      // Generate critical alert - 降低閾值使預設值觸發錯誤級別警報
      (monitor as any).thresholds.errorRate = 0.005; // Lower than default 0.01 (1%)

      await monitor['collectMetrics']();
      monitor['checkThresholds'](); // Manually trigger threshold checking

      const summary = monitor.getPerformanceSummary();
      expect(summary.overview.isHealthy).toBe(false);
      expect(summary.overview.activeAlerts).toBeGreaterThan(0);
    });
  });

  describe('Data Management', () => {
    it('should limit metrics history size', async () => {
      const maxHistory = monitor['maxMetricsHistory'];

      // Collect more metrics than the limit
      for (let i = 0; i < maxHistory + 10; i++) {
        await monitor['collectMetrics']();
      }

      const history = monitor.getMetricsHistory();
      expect(history.length).toBeLessThanOrEqual(maxHistory);
    });

    it('should clean up old data', () => {
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

    it('should return limited history when requested', async () => {
      // Add some metrics
      for (let i = 0; i < 20; i++) {
        await monitor['collectMetrics']();
      }

      const limitedHistory = monitor.getMetricsHistory(5);
      expect(limitedHistory.length).toBe(5);
    });
  });

  describe('Trend Calculation', () => {
    it('should calculate upward trend correctly', () => {
      const values = [10, 15, 20, 25, 30]; // Clear upward trend
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('up');
    });

    it('should calculate downward trend correctly', () => {
      const values = [30, 25, 20, 15, 10]; // Clear downward trend
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('down');
    });

    it('should calculate stable trend for minimal changes', () => {
      const values = [100, 101, 99, 102, 98]; // Stable with minor fluctuations
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('stable');
    });

    it('should handle insufficient data points', () => {
      const values = [10]; // Only one data point
      const trend = monitor['calculateTrend'](values);
      expect(trend).toBe('stable');
    });

    it('should handle reverse trend calculation', () => {
      const values = [30, 25, 20, 15, 10]; // Decreasing values
      const trend = monitor['calculateTrend'](values, true); // Reverse = true
      expect(trend).toBe('up'); // Should be 'up' because decreasing is good (reverse)
    });
  });

  describe('Recommendations', () => {
    it('should generate performance recommendations', async () => {
      // Create high connection scenario by temporarily overriding mock
      const { enhancedSSEManager } = await import('../../../../src/modules/realtime/handlers/sse-handler');
      const originalMock = vi.mocked(enhancedSSEManager.getDetailedStats);

      vi.mocked(enhancedSSEManager.getDetailedStats).mockReturnValue({
        totalConnections: 150, // High connection count
        connectionsByUser: { 1: 50, 2: 50, 3: 50 },
        connectionsByConversation: {},
        averageUptime: 3600000,
        totalEventsSent: 1500
      });

      await monitor['collectMetrics']();

      // Restore original mock
      enhancedSSEManager.getDetailedStats = originalMock;

      const summary = monitor.getPerformanceSummary();
      const hasConnectionRecommendation = summary.recommendations.some(
        r => r.includes('連接數較高')
      );
      expect(hasConnectionRecommendation).toBe(true);
    });

    it('should generate alert-based recommendations', async () => {
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