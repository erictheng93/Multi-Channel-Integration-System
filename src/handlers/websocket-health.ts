// WebSocket Health Check Handler
// 提供完整的 WebSocket + Durable Objects 健康檢查端點

import { Hono } from 'hono';
import type { Bindings } from '../types';
import type { MigrationConfig } from '../types/websocket-types';

const healthApp = new Hono<{ Bindings: Bindings }>();

// 🔥 CORS Middleware - Add CORS headers to ALL responses
healthApp.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  // Check if origin matches Cloudflare Pages preview domains
  const isPagesPreview = origin.endsWith('.multi-channel-platform-frontend.pages.dev');

  await next();

  // Add CORS headers to response
  if ((allowedOrigins.includes(origin) || isPagesPreview) && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
});

// 🔥 CORS Preflight Handler - Handle OPTIONS requests
healthApp.options('*', (c) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  // Check if origin matches Cloudflare Pages preview domains
  const isPagesPreview = origin.endsWith('.multi-channel-platform-frontend.pages.dev');

  const response = new Response(null, { status: 204 });

  // Add CORS headers if origin is allowed
  if ((allowedOrigins.includes(origin) || isPagesPreview) && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Prevent Cloudflare edge caching of OPTIONS responses
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});

/**
 * 完整的健康檢查響應
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  components: {
    durableObjects: ComponentHealth;
    websocket: ComponentHealth;
    sse: ComponentHealth;
    kv: ComponentHealth;
    database: ComponentHealth;
  };
  configuration: {
    websocketEnabled: boolean;
    sseEnabled: boolean;
    rolloutPercentage: number;
  };
  metrics?: {
    totalConnections?: number;
    durableObjectInstances?: number;
    uptime?: number;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck?: string;
}

/**
 * GET /api/websocket/health
 * 完整的健康檢查端點
 */
healthApp.get('/health', async (c) => {
  const startTime = Date.now();

  try {
    const components: HealthCheckResponse['components'] = {
      durableObjects: await checkDurableObjects(c.env),
      websocket: await checkWebSocketAvailability(c.env),
      sse: await checkSSEAvailability(c.env),
      kv: await checkKVStorage(c.env),
      database: await checkDatabase(c.env)
    };

    // 檢查遷移配置
    const migrationConfig = await getMigrationConfig(c.env);

    // 計算總體健康狀態
    const componentStatuses = Object.values(components).map(c => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (componentStatuses.some(s => s === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (componentStatuses.some(s => s === 'degraded')) {
      overallStatus = 'degraded';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
      components,
      configuration: {
        websocketEnabled: migrationConfig.enableWebSocket,
        sseEnabled: migrationConfig.enableSSE,
        rolloutPercentage: migrationConfig.rolloutPercentage
      },
      metrics: {
        uptime: Date.now() - startTime
      }
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return c.json(response, statusCode);
  } catch (error) {
    console.error('❌ [WebSocket Health] Health check failed:', error);

    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 503);
  }
});

/**
 * GET /api/websocket/migration-status
 * 快速遷移狀態檢查
 */
healthApp.get('/migration-status', async (c) => {
  try {
    const config = await getMigrationConfig(c.env);
    const durableObjectsHealth = await checkDurableObjects(c.env);

    return c.json({
      status: 'ok',
      websocketEnabled: config.enableWebSocket,
      sseEnabled: config.enableSSE,
      rolloutPercentage: config.rolloutPercentage,
      durableObjectsAvailable: durableObjectsHealth.status === 'healthy',
      featureFlags: config.featureFlags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/websocket/readiness
 * Kubernetes-style readiness probe
 */
healthApp.get('/readiness', async (c) => {
  try {
    const config = await getMigrationConfig(c.env);

    // Check if WebSocket is enabled and Durable Objects are available
    if (config.enableWebSocket) {
      const doHealth = await checkDurableObjects(c.env);
      if (doHealth.status === 'unhealthy') {
        return c.json({ ready: false, reason: 'Durable Objects unavailable' }, 503);
      }
    }

    // Check KV availability (required for sessions)
    const kvHealth = await checkKVStorage(c.env);
    if (kvHealth.status === 'unhealthy') {
      return c.json({ ready: false, reason: 'KV storage unavailable' }, 503);
    }

    return c.json({ ready: true }, 200);
  } catch (error) {
    return c.json({ ready: false, error: error instanceof Error ? error.message : 'Unknown error' }, 503);
  }
});

/**
 * GET /api/websocket/liveness
 * Kubernetes-style liveness probe
 */
healthApp.get('/liveness', async (c) => {
  // Simple liveness check - just verify the worker is responding
  return c.json({ alive: true, timestamp: new Date().toISOString() }, 200);
});

// =================== Helper Functions ===================

/**
 * 檢查 Durable Objects 可用性
 */
async function checkDurableObjects(env: Bindings): Promise<ComponentHealth> {
  try {
    // 檢查所有必需的 Durable Objects bindings
    const requiredBindings = [
      'CONVERSATION_ROOM',
      'USER_CONNECTION',
      'MESSAGE_BROADCASTER',
      'DELAYED_MESSAGE_PROCESSOR',
      'DELAYED_MESSAGE_BUFFER'
    ];

    const missingBindings = requiredBindings.filter(binding => !env[binding]);

    if (missingBindings.length > 0) {
      return {
        status: 'unhealthy',
        message: `Missing Durable Objects bindings: ${missingBindings.join(', ')}`,
        lastCheck: new Date().toISOString()
      };
    }

    // 嘗試獲取一個 Durable Object 實例 (輕量級測試)
    const testRoomId = env.CONVERSATION_ROOM.idFromName('health-check-test');
    const testRoom = env.CONVERSATION_ROOM.get(testRoomId);

    // 發送簡單的 HTTP 請求測試連接
    const response = await testRoom.fetch(new Request('http://internal/metrics'));

    if (response.ok || response.status === 404) {
      // 404 is acceptable (metrics endpoint might not exist in all implementations)
      return {
        status: 'healthy',
        message: 'All Durable Objects bindings available',
        lastCheck: new Date().toISOString()
      };
    }

    return {
      status: 'degraded',
      message: 'Durable Objects responding but with errors',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * 檢查 WebSocket 可用性
 */
async function checkWebSocketAvailability(env: Bindings): Promise<ComponentHealth> {
  try {
    const config = await getMigrationConfig(env);

    if (!config.enableWebSocket) {
      return {
        status: 'healthy',
        message: 'WebSocket disabled by configuration',
        lastCheck: new Date().toISOString()
      };
    }

    // WebSocket 依賴 Durable Objects
    const doHealth = await checkDurableObjects(env);

    if (doHealth.status === 'healthy') {
      return {
        status: 'healthy',
        message: 'WebSocket available',
        lastCheck: new Date().toISOString()
      };
    }

    return {
      status: 'unhealthy',
      message: 'WebSocket unavailable (Durable Objects issue)',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * 檢查 SSE 可用性
 */
async function checkSSEAvailability(env: Bindings): Promise<ComponentHealth> {
  try {
    const config = await getMigrationConfig(env);

    if (!config.enableSSE) {
      return {
        status: 'degraded',
        message: 'SSE disabled by configuration',
        lastCheck: new Date().toISOString()
      };
    }

    // SSE 主要依賴 KV
    const kvHealth = await checkKVStorage(env);

    return {
      status: kvHealth.status,
      message: kvHealth.status === 'healthy' ? 'SSE available' : 'SSE degraded (KV issue)',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * 檢查 KV 存儲可用性
 */
async function checkKVStorage(env: Bindings): Promise<ComponentHealth> {
  try {
    if (!env.SESSIONS) {
      return {
        status: 'unhealthy',
        message: 'SESSIONS KV namespace not available',
        lastCheck: new Date().toISOString()
      };
    }

    // 嘗試讀取測試鍵
    const testKey = 'health_check_test';
    await env.SESSIONS.get(testKey);

    return {
      status: 'healthy',
      message: 'KV storage operational',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * 檢查資料庫可用性
 */
async function checkDatabase(env: Bindings): Promise<ComponentHealth> {
  try {
    if (!env.DB) {
      return {
        status: 'unhealthy',
        message: 'Database binding not available',
        lastCheck: new Date().toISOString()
      };
    }

    // 執行簡單的查詢測試
    await env.DB.prepare('SELECT 1').first();

    return {
      status: 'healthy',
      message: 'Database operational',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * 獲取遷移配置
 */
async function getMigrationConfig(env: Bindings): Promise<MigrationConfig> {
  try {
    const configStr = await env.SESSIONS.get('websocket_migration_config');
    if (configStr) {
      return JSON.parse(configStr);
    }
  } catch (error) {
    console.error('❌ [WebSocket Health] Error loading migration config:', error);
  }

  // 預設配置
  return {
    enableWebSocket: true,
    enableSSE: true,
    migrationStrategy: 'gradual' as const,
    rolloutPercentage: 100,
    featureFlags: {
      websocketConnections: true,
      durableObjectMessaging: true,
      distributedLocking: true,
      batchMessageProcessing: true,
      realTimeTypingIndicators: true
    }
  };
}

export default healthApp;
