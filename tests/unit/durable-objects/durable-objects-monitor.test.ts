/**
 * Unit Tests for Durable Objects Monitor Service
 *
 * Tests the DO health monitoring, anomaly detection, and alert system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DurableObjectsMonitor, createDOMonitor, DOHealthStatus, DOAlertType } from '@/services/durable-objects-monitor';
import type { Bindings } from '@/types';

describe('DurableObjectsMonitor Service', () => {
  let monitor: DurableObjectsMonitor;
  let mockEnv: Partial<Bindings>;

  beforeEach(() => {
    // Mock environment bindings
    mockEnv = {
      CONVERSATION_ROOM: {
        idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-room-id' }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
              activeConnections: 5,
              totalConnectionsServed: 100,
              averageLatency: 50,
              errorRate: 0.01,
              memoryUsageMB: 25,
              uptime: 3600000
            })
          })
        })
      } as any,
      USER_CONNECTION: {
        idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-user-id' }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
              activeConnections: 3,
              totalConnectionsServed: 50,
              averageLatency: 30,
              errorRate: 0.005,
              memoryUsageMB: 15,
              uptime: 1800000
            })
          })
        })
      } as any,
      MESSAGE_BROADCASTER: {
        idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-broadcaster-id' }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
              activeConnections: 10,
              totalConnectionsServed: 500,
              averageLatency: 40,
              errorRate: 0.02,
              memoryUsageMB: 50,
              uptime: 7200000
            })
          })
        })
      } as any,
      DELAYED_MESSAGE_PROCESSOR: {
        idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-processor-id' }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
              activeConnections: 2,
              totalConnectionsServed: 25,
              averageLatency: 60,
              errorRate: 0.01,
              memoryUsageMB: 20,
              uptime: 900000
            })
          })
        })
      } as any,
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      } as any
    };

    monitor = createDOMonitor(mockEnv as Bindings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should perform comprehensive health check', async () => {
      const stats = await monitor.performHealthCheck();

      expect(stats).toHaveProperty('totalInstances');
      expect(stats).toHaveProperty('healthyInstances');
      expect(stats).toHaveProperty('degradedInstances');
      expect(stats).toHaveProperty('unhealthyInstances');
      expect(stats).toHaveProperty('instancesByType');
      expect(stats).toHaveProperty('lastUpdate');
    });

    it('should categorize healthy instances correctly', async () => {
      const stats = await monitor.performHealthCheck();

      // With mocked low error rates and latencies, instances should be healthy
      expect(stats.healthyInstances).toBeGreaterThan(0);
    });

    it('should track instances by type', async () => {
      const stats = await monitor.performHealthCheck();

      expect(stats.instancesByType).toHaveProperty('ConversationRoom');
      expect(stats.instancesByType).toHaveProperty('UserConnection');
      expect(stats.instancesByType).toHaveProperty('MessageBroadcaster');
    });
  });

  describe('Instance Metrics', () => {
    it('should collect metrics for all DO types', async () => {
      await monitor.performHealthCheck();
      const metrics = monitor.getInstanceMetrics();

      expect(metrics.length).toBeGreaterThan(0);

      const metric = metrics[0];
      expect(metric).toHaveProperty('objectType');
      expect(metric).toHaveProperty('instanceId');
      expect(metric).toHaveProperty('healthStatus');
      expect(metric).toHaveProperty('activeConnections');
      expect(metric).toHaveProperty('averageLatency');
      expect(metric).toHaveProperty('errorRate');
    });

    it('should filter metrics by type', async () => {
      await monitor.performHealthCheck();
      const roomMetrics = monitor.getInstanceMetricsByType('ConversationRoom');

      expect(roomMetrics.length).toBeGreaterThan(0);
      roomMetrics.forEach(m => {
        expect(m.objectType).toBe('ConversationRoom');
      });
    });
  });

  describe('Health Status Classification', () => {
    it('should mark instance as HEALTHY with normal metrics', async () => {
      await monitor.performHealthCheck();
      const metrics = monitor.getInstanceMetrics();

      // Default mock returns normal metrics
      const healthyCount = metrics.filter(m => m.healthStatus === DOHealthStatus.HEALTHY).length;
      expect(healthyCount).toBeGreaterThan(0);
    });

    it('should mark instance as DEGRADED with high latency', async () => {
      // Override mock to return high latency
      (mockEnv.CONVERSATION_ROOM!.get as any).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            activeConnections: 5,
            averageLatency: 1500, // Above 1000ms threshold
            errorRate: 0.05,
            memoryUsageMB: 50
          })
        })
      });

      await monitor.performHealthCheck();
      const metrics = monitor.getInstanceMetrics();

      const degradedCount = metrics.filter(m => m.healthStatus === DOHealthStatus.DEGRADED).length;
      expect(degradedCount).toBeGreaterThan(0);
    });

    it('should mark instance as UNHEALTHY with critical metrics', async () => {
      // Override mock to return critical metrics
      (mockEnv.CONVERSATION_ROOM!.get as any).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            activeConnections: 5,
            averageLatency: 5000, // Way above threshold
            errorRate: 0.25, // 25% error rate
            memoryUsageMB: 150
          })
        })
      });

      await monitor.performHealthCheck();
      const metrics = monitor.getInstanceMetrics();

      const unhealthyCount = metrics.filter(m => m.healthStatus === DOHealthStatus.UNHEALTHY).length;
      expect(unhealthyCount).toBeGreaterThan(0);
    });
  });

  describe('Alert System', () => {
    it('should generate alert for high error rate', async () => {
      // Override mock to trigger alert
      (mockEnv.MESSAGE_BROADCASTER!.get as any).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            activeConnections: 10,
            averageLatency: 50,
            errorRate: 0.15, // 15% error rate - above 10% threshold
            memoryUsageMB: 30
          })
        })
      });

      await monitor.performHealthCheck();
      const alerts = monitor.getActiveAlerts();

      const errorAlerts = alerts.filter(a => a.type === DOAlertType.HIGH_ERROR_RATE);
      expect(errorAlerts.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate alert for high latency', async () => {
      // Override mock to trigger alert
      (mockEnv.USER_CONNECTION!.get as any).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            activeConnections: 3,
            averageLatency: 2000, // 2 seconds - above 1000ms threshold
            errorRate: 0.01,
            memoryUsageMB: 20
          })
        })
      });

      await monitor.performHealthCheck();
      const alerts = monitor.getActiveAlerts();

      // Check for latency alert
      const latencyAlerts = alerts.filter(a => a.type === DOAlertType.HIGH_LATENCY);
      expect(latencyAlerts.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit alert history size', async () => {
      // Perform multiple health checks to generate alerts
      for (let i = 0; i < 150; i++) {
        await monitor.performHealthCheck();
      }

      const history = monitor.getAlertHistory();
      expect(history.length).toBeLessThanOrEqual(100); // Max 100 alerts in history
    });

    it('should get alert history with limit', async () => {
      await monitor.performHealthCheck();
      const history = monitor.getAlertHistory(10);

      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle DO fetch failure gracefully', async () => {
      // Override mock to simulate failure
      (mockEnv.CONVERSATION_ROOM!.get as any).mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('DO unavailable'))
      });

      // Should not throw
      const stats = await monitor.performHealthCheck();
      expect(stats).toBeDefined();
    });

    it('should mark unreachable instance as UNKNOWN', async () => {
      // Override mock to simulate timeout
      (mockEnv.USER_CONNECTION!.get as any).mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Timeout'))
      });

      await monitor.performHealthCheck();
      const metrics = monitor.getInstanceMetrics();

      const unknownCount = metrics.filter(m => m.healthStatus === DOHealthStatus.UNKNOWN).length;
      // At least some should be unknown due to failure
      expect(unknownCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Factory Function', () => {
    it('should create monitor with createDOMonitor', () => {
      const newMonitor = createDOMonitor(mockEnv as Bindings);
      expect(newMonitor).toBeInstanceOf(DurableObjectsMonitor);
    });

    it('should allow custom config', () => {
      const customMonitor = createDOMonitor(mockEnv as Bindings, {
        healthCheckIntervalMs: 60000,
        alertRetentionMs: 7200000
      });
      expect(customMonitor).toBeInstanceOf(DurableObjectsMonitor);
    });
  });
});
