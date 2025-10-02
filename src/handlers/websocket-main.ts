// WebSocket Connection Handler
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 處理 WebSocket 連接生命週期和遷移邏輯

import { Hono } from 'hono';
import type { Bindings } from '../types';
import type {
  MigrationConfig,
  ConnectionMetrics
} from '../types/websocket-types';
import { websocketAuth } from '../middleware/websocket-auth';
import { DistributedLockService } from '../services/distributed-lock-service';

// P1 Optimizations
import { getCircuitBreaker } from '../services/websocket-circuit-breaker';
import { createMessagePersistenceService } from '../services/message-persistence-service';

/**
 * Architecture Overview:
 *
 * WebSocket Handler manages:
 * 1. WebSocket connection lifecycle (upgrade, maintenance, cleanup)
 * 2. Progressive migration from SSE to WebSocket
 * 3. Connection fallback and health monitoring
 * 4. Integration with Durable Objects system
 * 5. Connection routing and load balancing
 *
 * This handler serves as the entry point for all WebSocket connections
 * and coordinates with the Durable Objects infrastructure
 */

const websocketHandler = new Hono<{ Bindings: Bindings }>();

// =================== Configuration ===================

interface WebSocketConfig {
  maxConnectionsPerUser: number;
  maxGlobalConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  upgradeTimeout: number;
  fallbackToSSE: boolean;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  maxConnectionsPerUser: 10,
  maxGlobalConnections: 10000,
  heartbeatInterval: 30000, // 30 seconds
  connectionTimeout: 300000, // 5 minutes
  upgradeTimeout: 10000, // 10 seconds
  fallbackToSSE: true
};

// =================== WebSocket Upgrade Handler ===================

websocketHandler.get('/connect', websocketAuth, async (c) => {
  try {
    const user = c.get('user');
    const url = new URL(c.req.url);

    // Extract connection parameters
    const conversationId = url.searchParams.get('conversationId');

    console.log(`🔌 [WebSocket] Connection request from user ${user.id} for conversation ${conversationId}`);

    // Check if WebSocket is enabled via feature flags
    const migrationConfig = await getMigrationConfig(c.env);
    if (!migrationConfig.enableWebSocket) {
      console.log(`❌ [WebSocket] WebSocket disabled, redirecting to SSE`);
      return c.redirect('/api/conversations/stream');
    }

    // Validate WebSocket upgrade request
    if (c.req.header('Upgrade') !== 'websocket') {
      return c.json({
        error: 'WebSocket upgrade required',
        fallback: migrationConfig.enableSSE ? '/api/conversations/stream' : null
      }, 400);
    }

    // Check connection limits
    const canConnect = await checkConnectionLimits(String(user.id), c.env);
    if (!canConnect) {
      console.log(`❌ [WebSocket] Connection limit reached for user ${user.id}`);
      return c.json({
        error: 'Connection limit reached',
        retryAfter: 60
      }, 429);
    }

    // 🔧 修復：直接將 WebSocket 升級請求轉發到 Durable Object
    // 而不是在主處理器中創建 WebSocket 對

    if (conversationId) {
      // 路由到 ConversationRoom Durable Object
      console.log(`🔀 [WebSocket] Routing to ConversationRoom: ${conversationId}`);

      if (!c.env.CONVERSATION_ROOM) {
        throw new Error('CONVERSATION_ROOM binding not available');
      }

      const roomId = c.env.CONVERSATION_ROOM.idFromName(conversationId);
      const roomStub = c.env.CONVERSATION_ROOM.get(roomId);

      // 🔧 構建包含必要參數的請求 URL
      const forwardUrl = new URL(c.req.url);
      forwardUrl.protocol = 'https:';
      forwardUrl.host = 'conversation-room';

      // 確保 ConversationRoom 需要的參數都存在
      forwardUrl.searchParams.set('userId', String(user.id));
      forwardUrl.searchParams.set('role', user.role as string);
      // token 已存在於原始 URL 中

      // 轉發完整的 WebSocket 升級請求到 ConversationRoom
      return roomStub.fetch(new Request(forwardUrl.toString(), {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: c.req.raw.body
      }));
    } else {
      // 如果沒有指定 conversationId，路由到 UserConnection
      console.log(`🔀 [WebSocket] Routing to UserConnection: ${user.id}`);

      if (!c.env.USER_CONNECTION) {
        throw new Error('USER_CONNECTION binding not available');
      }

      const userConnectionId = c.env.USER_CONNECTION.idFromName(String(user.id));
      const userConnectionStub = c.env.USER_CONNECTION.get(userConnectionId);

      // 🔧 構建包含必要參數的請求 URL
      const forwardUrl = new URL(c.req.url);
      forwardUrl.protocol = 'https:';
      forwardUrl.host = 'user-connection';

      // 確保 UserConnection 需要的參數都存在
      forwardUrl.searchParams.set('userId', String(user.id));
      forwardUrl.searchParams.set('role', user.role as string);
      // token 已存在於原始 URL 中

      // 轉發完整的 WebSocket 升級請求到 UserConnection
      return userConnectionStub.fetch(new Request(forwardUrl.toString(), {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: c.req.raw.body
      }));
    }

  } catch (error) {
    console.error('❌ [WebSocket] Connection error:', error);

    // Check if fallback to SSE is available
    const migrationConfig = await getMigrationConfig(c.env);
    if (migrationConfig.enableSSE) {
      return c.json({
        error: 'WebSocket connection failed',
        fallback: '/api/conversations/stream',
        reason: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }

    return c.json({
      error: 'Connection failed',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== Connection Routing ===================
// 🔧 注意：舊的複雜路由邏輯已被移除
// 現在直接將 WebSocket 升級請求轉發到相應的 Durable Object
// 這樣可以避免主處理器與 Durable Objects 之間的架構衝突

// =================== Connection Management ===================

websocketHandler.post('/disconnect', websocketAuth, async (c) => {
  try {
    const user = c.get('user');
    const { connectionId, reason } = await c.req.json();

    console.log(`🔌 [WebSocket] Disconnect request for connection ${connectionId} by user ${user.id}${reason ? ` (reason: ${reason})` : ''}`);

    // Clean up connection from all Durable Objects
    await cleanupConnection(connectionId, String(user.id), c.env);

    return c.json({
      success: true,
      connectionId,
      disconnectedAt: Date.now()
    });

  } catch (error) {
    console.error('❌ [WebSocket] Disconnect error:', error);
    return c.json({
      error: 'Disconnect failed',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

async function cleanupConnection(connectionId: string, userId: string, env: Bindings): Promise<void> {
  const lockService = new DistributedLockService(env);

  // Cleanup from UserConnection
  const userLockId = await lockService.acquireLock(`user_cleanup:${userId}`, {
    ttl: 5000,
    timeout: 2000
  });

  try {
    if (!env.USER_CONNECTION) {
      console.warn('USER_CONNECTION binding not available, skipping user cleanup');
      return;
    }

    const userConnectionId = env.USER_CONNECTION.idFromName(userId);
    const userConnectionStub = env.USER_CONNECTION.get(userConnectionId);
    await userConnectionStub.fetch(new Request('https://user-connection/disconnect', {
      method: 'POST',
      body: JSON.stringify({ connectionId }),
      headers: { 'Content-Type': 'application/json' }
    }));
  } finally {
    await lockService.releaseLock(userLockId);
  }

  // Unregister from MessageBroadcaster
  if (!env.MESSAGE_BROADCASTER) {
    console.warn('MESSAGE_BROADCASTER binding not available, skipping broadcaster cleanup');
    return;
  }

  const broadcasterId = env.MESSAGE_BROADCASTER.idFromName('global');
  const broadcasterStub = env.MESSAGE_BROADCASTER.get(broadcasterId);
  await broadcasterStub.fetch(new Request('https://message-broadcaster/unregister-connection', {
    method: 'POST',
    body: JSON.stringify({
      type: 'user',
      id: userId
    }),
    headers: { 'Content-Type': 'application/json' }
  }));

  console.log(`🧹 [WebSocket] Connection cleanup completed for ${connectionId}`);
}

// =================== Connection Health and Monitoring ===================

websocketHandler.get('/health', async (c) => {
  try {
    const metrics = await getConnectionMetrics(c.env);
    const migrationConfig = await getMigrationConfig(c.env);

    const health = {
      status: 'healthy',
      websocketEnabled: migrationConfig.enableWebSocket,
      sseEnabled: migrationConfig.enableSSE,
      totalConnections: metrics.totalConnections,
      activeConnections: metrics.activeConnections,
      connectionsByType: metrics.connectionsByType,
      averageLatency: metrics.averageLatency,
      errorRate: metrics.errorRate,
      timestamp: Date.now()
    };

    // Determine health status
    if (metrics.errorRate > 0.1) { // 10% error rate
      health.status = 'degraded';
    }
    if (metrics.errorRate > 0.25) { // 25% error rate
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 :
                      health.status === 'degraded' ? 207 : 503;

    return c.json(health, statusCode);

  } catch (error) {
    console.error('❌ [WebSocket] Health check error:', error);
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

websocketHandler.get('/metrics', async (c) => {
  try {
    const metrics = await getDetailedMetrics(c.env);
    return c.json(metrics);
  } catch (error) {
    console.error('❌ [WebSocket] Metrics error:', error);
    return c.json({
      error: 'Failed to get metrics',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

async function getConnectionMetrics(env: Bindings): Promise<ConnectionMetrics> {
  try {
    // Get metrics from MessageBroadcaster
    if (!env.MESSAGE_BROADCASTER) {
      console.warn('MESSAGE_BROADCASTER binding not available for metrics');
    } else {
      const broadcasterId = env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = env.MESSAGE_BROADCASTER.get(broadcasterId);
      const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/metrics'));
      if (response.ok) {
        const data = await response.json() as any;
        return {
          totalConnections: (data.userConnections || 0) + (data.conversationRooms || 0),
          activeConnections: data.activeConnections || 0,
          connectionsByType: {
            websocket: data.activeConnections || 0,
            sse: 0 // Would need to integrate with SSE metrics
          },
          connectionsByRole: {}, // Would be populated from UserConnection metrics
          averageLatency: data.averageLatency || 0,
          messagesThroughput: {
            inbound: data.eventsPerSecond || 0,
            outbound: data.eventsPerSecond || 0
          },
          errorRate: (data.failedDeliveries || 0) / Math.max(1, data.totalEvents || 1),
          lastUpdated: Date.now()
        };
      }
    }

    // Fallback metrics
    return {
      totalConnections: 0,
      activeConnections: 0,
      connectionsByType: { websocket: 0, sse: 0 },
      connectionsByRole: {},
      averageLatency: 0,
      messagesThroughput: { inbound: 0, outbound: 0 },
      errorRate: 0,
      lastUpdated: Date.now()
    };

  } catch (error) {
    console.error('❌ [WebSocket] Error getting connection metrics:', error);
    throw error;
  }
}

async function getDetailedMetrics(env: Bindings): Promise<any> {
  const lockService = new DistributedLockService(env);

  try {
    // Get metrics from all systems
    const [connectionMetrics, lockMetrics] = await Promise.allSettled([
      getConnectionMetrics(env),
      lockService.getLockMetrics()
    ]);

    return {
      connections: connectionMetrics.status === 'fulfilled' ? connectionMetrics.value : null,
      locks: lockMetrics.status === 'fulfilled' ? lockMetrics.value : null,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('❌ [WebSocket] Error getting detailed metrics:', error);
    throw error;
  }
}

// =================== Migration and Feature Flags ===================

websocketHandler.get('/migration-status', async (c) => {
  try {
    const config = await getMigrationConfig(c.env);
    return c.json(config);
  } catch (error) {
    console.error('❌ [WebSocket] Migration status error:', error);
    return c.json({
      error: 'Failed to get migration status',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

websocketHandler.post('/migration-config', websocketAuth, async (c) => {
  try {
    const user = c.get('user');

    // Only admins can modify migration config
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const newConfig = await c.req.json() as Partial<MigrationConfig>;
    await updateMigrationConfig(newConfig, c.env);

    console.log(`⚙️ [WebSocket] Migration config updated by ${user.id}:`, newConfig);

    return c.json({
      success: true,
      config: await getMigrationConfig(c.env),
      updatedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [WebSocket] Migration config update error:', error);
    return c.json({
      error: 'Failed to update migration config',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

async function getMigrationConfig(env: Bindings): Promise<MigrationConfig> {
  try {
    // Get config from KV storage
    const configStr = await env.SESSIONS.get('websocket_migration_config');
    if (configStr) {
      return JSON.parse(configStr);
    }

    // Default configuration
    const defaultConfig: MigrationConfig = {
      enableWebSocket: true,
      enableSSE: true,
      migrationStrategy: 'gradual',
      rolloutPercentage: 50, // Start with 50% rollout
      featureFlags: {
        websocketConnections: true,
        durableObjectMessaging: true,
        distributedLocking: true,
        batchMessageProcessing: true,
        realTimeTypingIndicators: true
      }
    };

    // Store default config
    await env.SESSIONS.put('websocket_migration_config', JSON.stringify(defaultConfig));
    return defaultConfig;

  } catch (error) {
    console.error('❌ [WebSocket] Error getting migration config:', error);
    // Return safe defaults on error
    return {
      enableWebSocket: false,
      enableSSE: true,
      migrationStrategy: 'gradual',
      rolloutPercentage: 0,
      featureFlags: {
        websocketConnections: false,
        durableObjectMessaging: false,
        distributedLocking: false,
        batchMessageProcessing: false,
        realTimeTypingIndicators: false
      }
    };
  }
}

async function updateMigrationConfig(newConfig: Partial<MigrationConfig>, env: Bindings): Promise<void> {
  const currentConfig = await getMigrationConfig(env);
  const updatedConfig = { ...currentConfig, ...newConfig };

  // Validate configuration
  if (updatedConfig.rolloutPercentage < 0 || updatedConfig.rolloutPercentage > 100) {
    throw new Error('Rollout percentage must be between 0 and 100');
  }

  await env.SESSIONS.put('websocket_migration_config', JSON.stringify(updatedConfig));
  console.log(`⚙️ [WebSocket] Migration config updated:`, updatedConfig);
}

// =================== Helper Functions ===================

async function checkConnectionLimits(userId: string, env: Bindings): Promise<boolean> {
  try {
    // Check user-specific connection limit
    if (!env.USER_CONNECTION) {
      console.warn('USER_CONNECTION binding not available for connection limit check');
      return true; // Allow connection if binding unavailable
    }

    const userConnectionId = env.USER_CONNECTION.idFromName(userId);
    const userConnectionStub = env.USER_CONNECTION.get(userConnectionId);
    const response = await userConnectionStub.fetch(new Request('https://user-connection/status'));
    if (response.ok) {
      const status = await response.json() as any;
      if ((status.connectionCount || 0) >= DEFAULT_CONFIG.maxConnectionsPerUser) {
        return false;
      }
    }

    // Check global connection limit
    const metrics = await getConnectionMetrics(env);
    if (metrics.activeConnections >= DEFAULT_CONFIG.maxGlobalConnections) {
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ [WebSocket] Error checking connection limits:', error);
    return false; // Fail closed
  }
}


// =================== Connection Testing ===================

websocketHandler.get('/test-connection', async (c) => {
  const url = new URL(c.req.url);
  const userId = url.searchParams.get('userId');
  const conversationId = url.searchParams.get('conversationId');

  if (!userId) {
    return c.json({ error: 'userId parameter required' }, 400);
  }

  try {
    // Test UserConnection
    let userConnectionStatus = null;
    if (!c.env.USER_CONNECTION) {
      userConnectionStatus = { error: 'USER_CONNECTION binding not available' };
    } else {
      const userConnectionId = c.env.USER_CONNECTION.idFromName(userId);
      const userConnectionStub = c.env.USER_CONNECTION.get(userConnectionId);
      const response = await userConnectionStub.fetch(new Request('https://user-connection/status'));
      if (response.ok) {
        userConnectionStatus = await response.json();
      }
    }

    // Test ConversationRoom if conversationId provided
    let conversationRoomStatus = null;
    if (conversationId) {
      if (!c.env.CONVERSATION_ROOM) {
        conversationRoomStatus = { error: 'CONVERSATION_ROOM binding not available' };
      } else {
        const roomId = c.env.CONVERSATION_ROOM.idFromName(conversationId);
        const roomStub = c.env.CONVERSATION_ROOM.get(roomId);
        const response = await roomStub.fetch(new Request('https://conversation-room/participants'));
        if (response.ok) {
          conversationRoomStatus = await response.json();
        }
      }
    }

    // Test MessageBroadcaster
    let broadcasterStatus = null;
    if (!c.env.MESSAGE_BROADCASTER) {
      broadcasterStatus = { error: 'MESSAGE_BROADCASTER binding not available' };
    } else {
      const broadcasterId = c.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = c.env.MESSAGE_BROADCASTER.get(broadcasterId);
      const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/status'));
      if (response.ok) {
        broadcasterStatus = await response.json();
      }
    }

    return c.json({
      success: true,
      userConnection: userConnectionStatus,
      conversationRoom: conversationRoomStatus,
      messageBroadcaster: broadcasterStatus,
      migrationConfig: await getMigrationConfig(c.env),
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [WebSocket] Connection test error:', error);
    return c.json({
      error: 'Connection test failed',
      reason: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

export default websocketHandler;