// WebSocket Monitoring Dashboard Handler
// 實時連接池監控與性能分析儀表板

import { Hono } from 'hono';
import type { Bindings } from '../types';
import type { JWTPayload } from '../types';

const dashboardApp = new Hono<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>();

/**
 * 實時指標數據結構
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
 * 連接歷史數據
 */
interface ConnectionHistory {
  timestamp: string;
  connections: number;
  protocol: 'websocket' | 'sse';
  errors: number;
}

/**
 * 性能趨勢數據
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
 * 獲取實時監控指標
 */
dashboardApp.get('/metrics', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const metrics = await collectRealtimeMetrics(c.env);

    return c.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Dashboard] Failed to collect metrics:', error);
    return c.json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/websocket/dashboard/connections
 * 獲取當前連接詳情
 */
dashboardApp.get('/connections', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const connections = await getActiveConnections(c.env);

    return c.json({
      success: true,
      data: connections,
      count: connections.length
    });
  } catch (error) {
    console.error('❌ [Dashboard] Failed to get connections:', error);
    return c.json({
      error: 'Failed to get connections',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/websocket/dashboard/history
 * 獲取連接歷史趨勢 (24小時)
 */
dashboardApp.get('/history', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const period = c.req.query('period') || '24h';
    const history = await getConnectionHistory(c.env, period);

    return c.json({
      success: true,
      data: history,
      period
    });
  } catch (error) {
    console.error('❌ [Dashboard] Failed to get history:', error);
    return c.json({
      error: 'Failed to get history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/websocket/dashboard/trends
 * 獲取性能趨勢分析
 */
dashboardApp.get('/trends', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const period = c.req.query('period') || '24h';
    const trends = await analyzePerformanceTrends(c.env, period);

    return c.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('❌ [Dashboard] Failed to analyze trends:', error);
    return c.json({
      error: 'Failed to analyze trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/websocket/dashboard/durable-objects
 * 獲取 Durable Objects 健康狀態
 */
dashboardApp.get('/durable-objects', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    if (payload.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const doHealth = await getDurableObjectsHealth(c.env);

    return c.json({
      success: true,
      data: doHealth
    });
  } catch (error) {
    console.error('❌ [Dashboard] Failed to get DO health:', error);
    return c.json({
      error: 'Failed to get Durable Objects health',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/websocket/dashboard/alerts
 * 獲取當前警報
 */
dashboardApp.get('/alerts', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const alerts = await getActiveAlerts(c.env);

    return c.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('❌ [Dashboard] Failed to get alerts:', error);
    return c.json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 數據收集與分析函數 ===================

/**
 * 收集實時監控指標
 */
async function collectRealtimeMetrics(env: Bindings): Promise<RealtimeMetrics> {
  try {
    // 從 KV 讀取最新統計數據
    const statsKey = 'websocket:realtime_stats';
    const statsData = await env.SESSIONS.get(statsKey);

    if (statsData) {
      const cachedStats = JSON.parse(statsData) as RealtimeMetrics;

      // 如果數據在 10 秒內,直接返回
      if (Date.now() - new Date(cachedStats.timestamp).getTime() < 10000) {
        return cachedStats;
      }
    }

    // 收集新數據
    const metrics: RealtimeMetrics = {
      timestamp: new Date().toISOString(),
      activeConnections: await collectConnectionMetrics(env),
      messagesThroughput: await collectThroughputMetrics(env),
      durableObjectsHealth: await collectDOHealthMetrics(env),
      latencyMetrics: await collectLatencyMetrics(env),
      resourceUsage: await collectResourceMetrics(env)
    };

    // 緩存到 KV (60 秒過期，KV 最小TTL要求)
    await env.SESSIONS.put(statsKey, JSON.stringify(metrics), { expirationTtl: 60 });

    return metrics;
  } catch (error) {
    console.error('❌ [Dashboard] Error collecting metrics:', error);
    throw error;
  }
}

/**
 * 收集連接數據
 */
async function collectConnectionMetrics(env: Bindings) {
  const byConversation: Record<number, number> = {};
  const byUser: Record<number, number> = {};
  let websocketCount = 0;
  let sseCount = 0;

  try {
    // 從 KV 讀取連接追蹤數據
    const connectionKeys = await env.SESSIONS.list({ prefix: 'ws_conn:' });

    for (const key of connectionKeys.keys) {
      const connData = await env.SESSIONS.get(key.name);
      if (connData) {
        const conn = JSON.parse(connData);

        // 按對話統計
        byConversation[conn.conversationId] = (byConversation[conn.conversationId] || 0) + 1;

        // 按用戶統計
        byUser[conn.userId] = (byUser[conn.userId] || 0) + 1;

        // 按協議統計
        if (conn.protocol === 'websocket') websocketCount++;
        else sseCount++;
      }
    }
  } catch (error) {
    console.error('❌ [Dashboard] Error collecting connection metrics:', error);
  }

  return {
    total: websocketCount + sseCount,
    byConversation,
    byUser,
    byProtocol: { websocket: websocketCount, sse: sseCount }
  };
}

/**
 * 收集吞吐量數據
 */
async function collectThroughputMetrics(env: Bindings) {
  try {
    const throughputKey = 'websocket:throughput';
    const data = await env.SESSIONS.get(throughputKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [Dashboard] Error collecting throughput:', error);
  }

  return { perSecond: 0, perMinute: 0, total: 0 };
}

/**
 * 收集 Durable Objects 健康指標
 */
async function collectDOHealthMetrics(env: Bindings) {
  try {
    const healthKey = 'websocket:do_health';
    const data = await env.SESSIONS.get(healthKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [Dashboard] Error collecting DO health:', error);
  }

  return {
    instances: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    errorRate: 0
  };
}

/**
 * 收集延遲指標
 */
async function collectLatencyMetrics(env: Bindings) {
  try {
    const latencyKey = 'websocket:latency';
    const data = await env.SESSIONS.get(latencyKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [Dashboard] Error collecting latency:', error);
  }

  return { p50: 0, p95: 0, p99: 0, max: 0 };
}

/**
 * 收集資源使用數據
 */
async function collectResourceMetrics(env: Bindings) {
  try {
    const resourceKey = 'websocket:resource_usage';
    const data = await env.SESSIONS.get(resourceKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [Dashboard] Error collecting resource usage:', error);
  }

  return {
    kvOperations: 0,
    durableObjectCalls: 0,
    queueDepth: 0
  };
}

/**
 * 獲取活躍連接列表
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
    console.error('❌ [Dashboard] Error getting active connections:', error);
  }

  return connections;
}

/**
 * 獲取連接歷史
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
    console.error('❌ [Dashboard] Error getting connection history:', error);
  }

  return history;
}

/**
 * 分析性能趨勢
 */
async function analyzePerformanceTrends(env: Bindings, period: string): Promise<PerformanceTrend> {
  try {
    const trendKey = `websocket:trends:${period}`;
    const data = await env.SESSIONS.get(trendKey);

    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [Dashboard] Error analyzing trends:', error);
  }

  return {
    period,
    dataPoints: [],
    summary: {
      peak: { timestamp: new Date().toISOString(), connections: 0 },
      average: { connections: 0, throughput: 0 },
      incidents: 0
    }
  };
}

/**
 * 獲取 Durable Objects 健康狀態
 */
async function getDurableObjectsHealth(env: Bindings) {
  const health: any = {
    timestamp: new Date().toISOString(),
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
      if (env[binding]) {
        health.bindings.push({
          name: binding,
          status: 'available',
          instances: 'N/A' // Cloudflare 不提供實例計數 API
        });
      } else {
        health.bindings.push({
          name: binding,
          status: 'unavailable'
        });
      }
    }
  } catch (error) {
    console.error('❌ [Dashboard] Error checking DO health:', error);
  }

  return health;
}

/**
 * 獲取當前警報
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
    console.error('❌ [Dashboard] Error getting alerts:', error);
  }

  return alerts;
}

export default dashboardApp;
