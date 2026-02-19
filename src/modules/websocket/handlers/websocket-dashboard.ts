// WebSocket Monitoring Dashboard Handler
// Real-time connection pool monitoring and performance analysis dashboard

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import type { JWTPayload } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import { nowISO } from '@/utils/timestamp'

const dashboardApp = new Hono<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>();

/**
 * Real-time metrics data structure
 */
interface RealtimeMetrics {
  timestamp: string;
  activeConnections: {
    total: number;
    byConversation: Record<number, number>;
    byUser: Record<number, number>;
    byProtocol: {
      websocket: number;
      sse: number;
    };
  };
  messagesThroughput: {
    perSecond: number;
    perMinute: number;
    total: number;
  };
  durableObjectsHealth: {
    instances: number;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
  };
  latencyMetrics: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  resourceUsage: {
    kvOperations: number;
    durableObjectCalls: number;
    queueDepth: number;
  };
}

/**
 * Connection history data
 */
interface ConnectionHistory {
  timestamp: string;
  connections: number;
  protocol: 'websocket';
  errors: number;
}

/**
 * Performance trend data
 */
interface PerformanceTrend {
  period: string; // '1h', '6h', '24h', '7d'
  dataPoints: Array<{
    timestamp: string;
    connections: number;
    throughput: number;
    latency: number;
    errorRate: number;
  }>;
  summary: {
    peak: { timestamp: string; connections: number };
    average: { connections: number; throughput: number };
    incidents: number;
  };
}

/**
 * GET /api/websocket/dashboard/metrics
 * Get real-time monitoring metrics
 */
dashboardApp.get('/metrics', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const metrics = await collectRealtimeMetrics(c.env);

    return c.json({
      success: true,
      data: metrics,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/websocket/dashboard/connections
 * Get current connection details
 */
dashboardApp.get('/connections', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const connections = await getActiveConnections(c.env);

    return c.json({
      success: true,
      data: connections,
      count: connections.length
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/websocket/dashboard/history
 * Get connection history trends (24 hours)
 */
dashboardApp.get('/history', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const period = c.req.query('period') || '24h';
    const history = await getConnectionHistory(c.env, period);

    return c.json({
      success: true,
      data: history,
      period
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/websocket/dashboard/trends
 * Get performance trend analysis
 */
dashboardApp.get('/trends', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const period = c.req.query('period') || '24h';
    const trends = await analyzePerformanceTrends(c.env, period);

    return c.json({
      success: true,
      data: trends
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/websocket/dashboard/durable-objects
 * Get Durable Objects health status
 */
dashboardApp.get('/durable-objects', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    if (payload.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const doHealth = await getDurableObjectsHealth(c.env);

    return c.json({
      success: true,
      data: doHealth
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/websocket/dashboard/alerts
 * Get current alerts
 */
dashboardApp.get('/alerts', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    }

    const alerts = await getActiveAlerts(c.env);

    return c.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== Data Collection and Analysis Functions ===================

/**
 * Collect real-time monitoring metrics
 */
async function collectRealtimeMetrics(env: Bindings): Promise<RealtimeMetrics> {
  try {
    // Read latest statistics from KV
    const statsKey = 'websocket:realtime_stats';
    const statsData = await env.SESSIONS.get(statsKey);

    if (statsData) {
      const cachedStats = JSON.parse(statsData) as RealtimeMetrics;

      // If data is within 10 seconds, return directly
      if (Date.now() - new Date(cachedStats.timestamp).getTime() < 10000) {
        return cachedStats;
      }
    }

    // Collect new data
    const metrics: RealtimeMetrics = {
      timestamp: nowISO(),
      activeConnections: await collectConnectionMetrics(env),
      messagesThroughput: await collectThroughputMetrics(env),
      durableObjectsHealth: await collectDOHealthMetrics(env),
      latencyMetrics: await collectLatencyMetrics(env),
      resourceUsage: await collectResourceMetrics(env)
    };

    // Cache to KV (60 second expiration, KV minimum TTL requirement)
    await env.SESSIONS.put(statsKey, JSON.stringify(metrics), { expirationTtl: 60 });

    return metrics;
  } catch (error) {
    console.error('[Dashboard] Error collecting metrics:', error);
    throw error;
  }
}

/**
 * Collect connection data
 */
async function collectConnectionMetrics(env: Bindings) {
  const byConversation: Record<number, number> = {};
  const byUser: Record<number, number> = {};
  let websocketCount = 0;
  let sseCount = 0;

  try {
    // Read connection tracking data from KV
    const connectionKeys = await env.SESSIONS.list({ prefix: 'ws_conn:' });

    for (const key of connectionKeys.keys) {
      const connData = await env.SESSIONS.get(key.name);
      if (connData) {
        const conn = JSON.parse(connData);

        // Count by conversation
        byConversation[conn.conversationId] = (byConversation[conn.conversationId] || 0) + 1;

        // Count by user
        byUser[conn.userId] = (byUser[conn.userId] || 0) + 1;

        // Count by protocol
        if (conn.protocol === 'websocket') websocketCount++;
        else sseCount++;
      }
    }
  } catch (error) {
    console.error('[Dashboard] Error collecting connection metrics:', error);
  }

  return {
    total: websocketCount + sseCount,
    byConversation,
    byUser,
    byProtocol: { websocket: websocketCount, sse: sseCount }
  };
}

/**
 * Collect throughput data
 */
async function collectThroughputMetrics(env: Bindings) {
  try {
    const throughputKey = 'websocket:throughput';
    const data = await env.SESSIONS.get(throughputKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error collecting throughput:', error);
  }

  return { perSecond: 0, perMinute: 0, total: 0 };
}

/**
 * Collect Durable Objects health metrics
 */
async function collectDOHealthMetrics(env: Bindings) {
  try {
    const healthKey = 'websocket:do_health';
    const data = await env.SESSIONS.get(healthKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error collecting DO health:', error);
  }

  return {
    instances: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    errorRate: 0
  };
}

/**
 * Collect latency metrics
 */
async function collectLatencyMetrics(env: Bindings) {
  try {
    const latencyKey = 'websocket:latency';
    const data = await env.SESSIONS.get(latencyKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error collecting latency:', error);
  }

  return { p50: 0, p95: 0, p99: 0, max: 0 };
}

/**
 * Collect resource usage data
 */
async function collectResourceMetrics(env: Bindings) {
  try {
    const resourceKey = 'websocket:resource_usage';
    const data = await env.SESSIONS.get(resourceKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error collecting resource usage:', error);
  }

  return {
    kvOperations: 0,
    durableObjectCalls: 0,
    queueDepth: 0
  };
}

/**
 * Get active connections list
 */
async function getActiveConnections(env: Bindings) {
  const connections: any[] = [];

  try {
    const connectionKeys = await env.SESSIONS.list({ prefix: 'ws_conn:' });

    for (const key of connectionKeys.keys) {
      const connData = await env.SESSIONS.get(key.name);
      if (connData) {
        connections.push(JSON.parse(connData));
      }
    }
  } catch (error) {
    console.error('[Dashboard] Error getting active connections:', error);
  }

  return connections;
}

/**
 * Get connection history
 */
async function getConnectionHistory(env: Bindings, period: string): Promise<ConnectionHistory[]> {
  const history: ConnectionHistory[] = [];

  try {
    const historyKey = `websocket:history:${period}`;
    const data = await env.SESSIONS.get(historyKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error getting connection history:', error);
  }

  return history;
}

/**
 * Analyze performance trends
 */
async function analyzePerformanceTrends(env: Bindings, period: string): Promise<PerformanceTrend> {
  try {
    const trendKey = `websocket:trends:${period}`;
    const data = await env.SESSIONS.get(trendKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error analyzing trends:', error);
  }

  return {
    period,
    dataPoints: [],
    summary: {
      peak: { timestamp: nowISO(), connections: 0 },
      average: { connections: 0, throughput: 0 },
      incidents: 0
    }
  };
}

/**
 * Get Durable Objects health status
 */
async function getDurableObjectsHealth(env: Bindings) {
  const health: any = {
    timestamp: nowISO(),
    bindings: []
  };

  try {
    const bindings = [
      'CONVERSATION_ROOM',
      'USER_CONNECTION',
      'MESSAGE_BROADCASTER',
      'DELAYED_MESSAGE_SCHEDULER'
    ];

    for (const binding of bindings) {
      if ((env as unknown as Record<string, unknown>)[binding]) {
        health.bindings.push({
          name: binding,
          status: 'available',
          instances: 'N/A' // Cloudflare doesn't provide instance count API
        });
      } else {
        health.bindings.push({
          name: binding,
          status: 'unavailable'
        });
      }
    }
  } catch (error) {
    console.error('[Dashboard] Error checking DO health:', error);
  }

  return health;
}

/**
 * Get current alerts
 */
async function getActiveAlerts(env: Bindings) {
  const alerts: any[] = [];

  try {
    const alertKey = 'websocket:active_alerts';
    const data = await env.SESSIONS.get(alertKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error getting alerts:', error);
  }

  return alerts;
}

export default dashboardApp;
