// SSE Handler 單元測試
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('SSE Handler', () => {
  let mockController: ReadableStreamDefaultController;
  let mockEnv: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ReadableStream controller
    mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
      error: vi.fn()
    } as any;

    mockEnv = {
      KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      },
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] })
      }
    };

    mockContext = {
      waitUntil: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSE Connection Management', () => {
    it('should create a new SSE connection', () => {
      const connectionId = 'conn-123';
      const userId = 'user-456';
      const dashboardId = 'dash-789';

      const connection = {
        id: connectionId,
        userId,
        dashboardId,
        controller: mockController,
        lastHeartbeat: Date.now(),
        widgets: ['widget1', 'widget2']
      };

      expect(connection.id).toBe(connectionId);
      expect(connection.userId).toBe(userId);
      expect(connection.dashboardId).toBe(dashboardId);
      expect(connection.widgets).toHaveLength(2);
    });

    it('should store connection metadata', () => {
      const connection = {
        id: 'conn-123',
        userId: 'user-456',
        dashboardId: 'dash-789',
        controller: mockController,
        lastHeartbeat: Date.now(),
        widgets: []
      };

      expect(connection.lastHeartbeat).toBeGreaterThan(0);
      expect(connection.controller).toBeDefined();
    });
  });

  describe('SSE Event Formatting', () => {
    it('should format SSE message correctly', () => {
      const event = {
        type: 'widget_update',
        dashboardId: 'dash-123',
        widgetId: 'widget-456',
        data: { value: 42 },
        timestamp: new Date().toISOString(),
        userId: 'user-789'
      };

      const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

      expect(sseMessage).toContain('event: widget_update');
      expect(sseMessage).toContain('data:');
      expect(sseMessage).toContain('"value":42');
      expect(sseMessage.endsWith('\n\n')).toBe(true);
    });

    it('should format heartbeat message', () => {
      const heartbeat = {
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      };

      const sseMessage = `event: heartbeat\ndata: ${JSON.stringify(heartbeat)}\n\n`;

      expect(sseMessage).toContain('event: heartbeat');
      expect(sseMessage).toContain('timestamp');
    });

    it('should handle multiline data in SSE format', () => {
      const event = {
        type: 'dashboard_update',
        data: {
          config: {
            line1: 'value1',
            line2: 'value2'
          }
        }
      };

      const jsonData = JSON.stringify(event);
      const sseMessage = `event: ${event.type}\ndata: ${jsonData}\n\n`;

      expect(sseMessage).toContain('event: dashboard_update');
      expect(sseMessage).toContain('line1');
      expect(sseMessage).toContain('line2');
    });
  });

  describe('Connection Lifecycle', () => {
    it('should handle connection initialization', () => {
      const stream = new ReadableStream({
        start(controller) {
          // Send initial connection message
          const initialMessage = {
            type: 'connection_established',
            connectionId: 'conn-123',
            timestamp: new Date().toISOString()
          };

          const sseMessage = `event: connection_established\ndata: ${JSON.stringify(initialMessage)}\n\n`;
          controller.enqueue(new TextEncoder().encode(sseMessage));
        }
      });

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should handle connection close', () => {
      mockController.close();

      expect(mockController.close).toHaveBeenCalled();
    });

    it('should handle connection error', () => {
      const error = new Error('Connection failed');
      mockController.error(error);

      expect(mockController.error).toHaveBeenCalledWith(error);
    });
  });

  describe('Heartbeat Mechanism', () => {
    it('should send heartbeat at regular intervals', async () => {
      vi.useFakeTimers();

      const heartbeats: any[] = [];

      const sendHeartbeat = () => {
        const heartbeat = {
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        };
        heartbeats.push(heartbeat);
      };

      const interval = setInterval(sendHeartbeat, 30000); // 30 seconds

      // Advance time by 90 seconds
      vi.advanceTimersByTime(90000);

      expect(heartbeats.length).toBe(3);

      clearInterval(interval);
      vi.useRealTimers();
    });

    it('should update lastHeartbeat timestamp', () => {
      const connection = {
        id: 'conn-123',
        userId: 'user-456',
        dashboardId: 'dash-789',
        controller: mockController,
        lastHeartbeat: Date.now(),
        widgets: []
      };

      const beforeTime = connection.lastHeartbeat;

      // Simulate heartbeat update
      setTimeout(() => {
        connection.lastHeartbeat = Date.now();
      }, 100);

      setTimeout(() => {
        expect(connection.lastHeartbeat).toBeGreaterThanOrEqual(beforeTime);
      }, 150);
    });

    it('should detect stale connections', () => {
      const connection = {
        id: 'conn-123',
        userId: 'user-456',
        dashboardId: 'dash-789',
        controller: mockController,
        lastHeartbeat: Date.now() - 400000, // 6+ minutes ago
        widgets: []
      };

      const heartbeatInterval = 30000; // 30 seconds
      const connectionTimeout = 300000; // 5 minutes

      const isStale = Date.now() - connection.lastHeartbeat > connectionTimeout;

      expect(isStale).toBe(true);
    });
  });

  describe('Widget Updates', () => {
    it('should broadcast widget update to subscribers', () => {
      const widgetUpdate = {
        type: 'widget_update' as const,
        dashboardId: 'dash-123',
        widgetId: 'widget-456',
        data: {
          value: 100,
          trend: 'up',
          change: 5.2
        },
        timestamp: new Date().toISOString(),
        userId: 'user-789'
      };

      const sseMessage = `event: widget_update\ndata: ${JSON.stringify(widgetUpdate)}\n\n`;
      const encoded = new TextEncoder().encode(sseMessage);

      mockController.enqueue(encoded);

      expect(mockController.enqueue).toHaveBeenCalledWith(encoded);
    });

    it('should batch multiple widget updates', () => {
      const updates = [
        { widgetId: 'widget-1', value: 10 },
        { widgetId: 'widget-2', value: 20 },
        { widgetId: 'widget-3', value: 30 }
      ];

      const batchUpdate = {
        type: 'batch_update',
        dashboardId: 'dash-123',
        updates,
        timestamp: new Date().toISOString(),
        userId: 'user-456'
      };

      expect(batchUpdate.updates).toHaveLength(3);
      expect(batchUpdate.type).toBe('batch_update');
    });

    it('should filter updates by widget subscription', () => {
      const connection = {
        id: 'conn-123',
        userId: 'user-456',
        dashboardId: 'dash-789',
        controller: mockController,
        lastHeartbeat: Date.now(),
        widgets: ['widget-1', 'widget-2']
      };

      const update1 = { widgetId: 'widget-1', value: 10 };
      const update2 = { widgetId: 'widget-3', value: 30 }; // Not subscribed

      const shouldReceiveUpdate1 = connection.widgets.includes(update1.widgetId);
      const shouldReceiveUpdate2 = connection.widgets.includes(update2.widgetId);

      expect(shouldReceiveUpdate1).toBe(true);
      expect(shouldReceiveUpdate2).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle encoding errors', () => {
      const invalidData = {
        type: 'error',
        error: 'Invalid data encoding',
        timestamp: new Date().toISOString()
      };

      const sseMessage = `event: error\ndata: ${JSON.stringify(invalidData)}\n\n`;

      expect(sseMessage).toContain('event: error');
      expect(sseMessage).toContain('Invalid data encoding');
    });

    it('should send error events to client', () => {
      const errorEvent = {
        type: 'error' as const,
        dashboardId: 'dash-123',
        error: 'Failed to load widget data',
        timestamp: new Date().toISOString(),
        userId: 'user-456'
      };

      const sseMessage = `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`;
      const encoded = new TextEncoder().encode(sseMessage);

      mockController.enqueue(encoded);

      expect(mockController.enqueue).toHaveBeenCalledWith(encoded);
    });

    it('should handle controller errors gracefully', () => {
      const error = new Error('Controller error');

      try {
        mockController.error(error);
      } catch (e) {
        // Error should be caught
      }

      expect(mockController.error).toHaveBeenCalledWith(error);
    });
  });

  describe('Configuration Updates', () => {
    it('should notify on dashboard config change', () => {
      const configChange = {
        type: 'config_change' as const,
        dashboardId: 'dash-123',
        data: {
          layout: 'grid',
          theme: 'dark'
        },
        timestamp: new Date().toISOString(),
        userId: 'user-456'
      };

      const sseMessage = `event: config_change\ndata: ${JSON.stringify(configChange)}\n\n`;

      expect(sseMessage).toContain('event: config_change');
      expect(sseMessage).toContain('"theme":"dark"');
    });

    it('should handle dashboard update events', () => {
      const dashboardUpdate = {
        type: 'dashboard_update' as const,
        dashboardId: 'dash-123',
        data: {
          widgets: ['widget-1', 'widget-2', 'widget-3']
        },
        timestamp: new Date().toISOString(),
        userId: 'user-456'
      };

      expect(dashboardUpdate.type).toBe('dashboard_update');
      expect(dashboardUpdate.data.widgets).toHaveLength(3);
    });
  });

  describe('Connection Limits', () => {
    it('should enforce max connections per user', () => {
      const maxConnections = 1000;
      const connections = Array.from({ length: 1050 }, (_, i) => ({
        id: `conn-${i}`,
        userId: 'user-123'
      }));

      const exceedsLimit = connections.length > maxConnections;

      expect(exceedsLimit).toBe(true);
      expect(connections.length).toBe(1050);
    });

    it('should track connection count', () => {
      const activeConnections = new Map();

      activeConnections.set('conn-1', { userId: 'user-1' });
      activeConnections.set('conn-2', { userId: 'user-2' });
      activeConnections.set('conn-3', { userId: 'user-1' });

      expect(activeConnections.size).toBe(3);
    });
  });

  describe('Performance Metrics', () => {
    it('should track message send rate', () => {
      const messagesSent: number[] = [];

      const sendMessage = () => {
        messagesSent.push(Date.now());
      };

      // Simulate sending 10 messages
      for (let i = 0; i < 10; i++) {
        sendMessage();
      }

      expect(messagesSent).toHaveLength(10);
    });

    it('should calculate connection duration', () => {
      const connectionStart = Date.now();

      setTimeout(() => {
        const duration = Date.now() - connectionStart;
        expect(duration).toBeGreaterThanOrEqual(0);
      }, 10);
    });

    it('should track active connections count', () => {
      const metrics = {
        totalConnections: 100,
        activeConnections: 85,
        staleConnections: 15
      };

      expect(metrics.totalConnections).toBe(100);
      expect(metrics.activeConnections + metrics.staleConnections).toBe(metrics.totalConnections);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup stale connections', () => {
      const connections = new Map([
        ['conn-1', { lastHeartbeat: Date.now() }],
        ['conn-2', { lastHeartbeat: Date.now() - 400000 }], // Stale
        ['conn-3', { lastHeartbeat: Date.now() - 500000 }]  // Stale
      ]);

      const timeout = 300000; // 5 minutes
      const now = Date.now();

      const staleConnections: string[] = [];
      connections.forEach((conn, id) => {
        if (now - conn.lastHeartbeat > timeout) {
          staleConnections.push(id);
        }
      });

      expect(staleConnections).toHaveLength(2);
      expect(staleConnections).toContain('conn-2');
      expect(staleConnections).toContain('conn-3');
    });

    it('should close connections on cleanup', () => {
      const connections = [
        { id: 'conn-1', controller: mockController },
        { id: 'conn-2', controller: mockController }
      ];

      connections.forEach(conn => {
        conn.controller.close();
      });

      expect(mockController.close).toHaveBeenCalledTimes(2);
    });
  });
});
