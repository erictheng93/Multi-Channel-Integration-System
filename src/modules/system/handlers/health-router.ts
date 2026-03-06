// 健康檢查路由器 - 統一健康檢查路由處理器
import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import type { SystemHealth, ComponentHealth } from '@/types/health-check';
import { jwtAuth } from '@/middleware/auth';
import { createHealthCheckHandlerMethods } from './health-main';
import { globalErrorHandler } from '@/core/error-handler';
import { nowISO } from '@/utils/timestamp'

/** Hono context type used across all health check routes */
type HealthRouteContext = Context<{ Bindings: Bindings }>;

/** Shape of the JSON body returned by health check handler responses */
interface HealthResponseBody {
  success: boolean;
  data: SystemHealth;
  message: string;
  timestamp: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// ======================== 公開健康檢查端點 ========================

// 基本健康檢查端點 (無需認證)
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'mcis',
    timestamp: nowISO(),
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// 系統整體健康狀態 (無需認證 - 用於負載平衡器檢查)
app.get('/status', async (c) => {
  const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getSystemHealth(c as HealthRouteContext);
});

// ======================== 詳細健康檢查端點 (需要認證) ========================

// 系統完整健康檢查
app.get('/system', jwtAuth, async (c) => {
  const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getSystemHealth(c as HealthRouteContext);
});

// 基礎設施健康檢查
app.get('/infrastructure', jwtAuth, async (c) => {
  const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getInfrastructureHealth(c as HealthRouteContext);
});

// 服務層健康檢查
app.get('/services', jwtAuth, async (c) => {
  const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getServicesHealth(c as HealthRouteContext);
});

// 健康檢查統計
app.get('/stats', jwtAuth, async (c) => {
  const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getHealthStats(c as HealthRouteContext);
});

// 特定組件健康檢查
app.get('/component/:component', jwtAuth, async (c) => {
  const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.runComponentCheck(c as HealthRouteContext);
});

// ======================== 監控和指標端點 ========================

// 系統指標
app.get('/metrics', jwtAuth, async (c) => {
  try {
    const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
    const healthResponse = await handlers.getSystemHealth(c as HealthRouteContext);

    // 解析回應以取得實際的健康資料
    let healthData: Partial<SystemHealth> = {};
    if ('json' in healthResponse && typeof healthResponse.json === 'function') {
      const responseData = await healthResponse.json() as HealthResponseBody;
      healthData = responseData.data;
    }

    // 轉換為 Prometheus 格式的指標 (簡化版)
    const metrics = `
# HELP system_health_status Overall system health status (1=healthy, 0.5=warning, 0=critical)
# TYPE system_health_status gauge
system_health_status{service="mcis"} ${healthData.overall?.status === 'healthy' ? 1 : healthData.overall?.status === 'warning' ? 0.5 : 0}

# HELP component_health_status Component health status
# TYPE component_health_status gauge
${healthData.components?.map((component: ComponentHealth) =>
  `component_health_status{component="${component.component}"} ${component.status.status === 'healthy' ? 1 : component.status.status === 'warning' ? 0.5 : 0}`
).join('\n') || ''}

# HELP api_response_time_ms API response time in milliseconds
# TYPE api_response_time_ms gauge
api_response_time_ms{service="mcis"} ${healthData.performance?.apiResponseTime || 0}

# HELP cache_hit_rate Cache hit rate percentage
# TYPE cache_hit_rate gauge
cache_hit_rate{service="mcis"} ${healthData.performance?.cacheHitRate || 0}
    `.trim();

    return c.text(metrics, 200, {
      'Content-Type': 'text/plain; charset=utf-8'
    });

  } catch (error) {
    console.error('Metrics generation failed:', error);
    return c.text('# Error generating metrics\n', 500, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
  }
});

// Readiness probe (用於 Kubernetes 等容器平台)
app.get('/ready', async (c) => {
  try {
    const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
    const healthResponse = await handlers.getSystemHealth(c as HealthRouteContext);

    // 解析回應以取得實際的健康資料
    let healthData: Partial<SystemHealth> = {};
    if ('json' in healthResponse && typeof healthResponse.json === 'function') {
      const responseData = await healthResponse.json() as HealthResponseBody;
      healthData = responseData.data;
    }

    // 如果系統準備就緒，返回 200
    if (healthData.overall?.status === 'healthy' || healthData.overall?.status === 'warning') {
      return c.json({
        status: 'ready',
        timestamp: nowISO()
      });
    } else {
      return c.json({
        status: 'not_ready',
        reason: healthData.overall?.message,
        timestamp: nowISO()
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }
  } catch (error) {
    return c.json({
      status: 'not_ready',
      reason: 'Health check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
});

// Liveness probe (用於 Kubernetes 等容器平台)
app.get('/live', (c) => {
  return c.json({
    status: 'alive',
    timestamp: nowISO(),
    uptime: process.uptime ? Math.floor(process.uptime()) : 0
  });
});

// ======================== 管理端點 ========================

// 手動觸發完整健康檢查
app.post('/check/all', jwtAuth, async (c) => {
  try {
    const handlers = createHealthCheckHandlerMethods(c.env.DB, c.env.CACHE);
    const health = await handlers.getSystemHealth(c as HealthRouteContext);

    return c.json({
      success: true,
      data: health,
      message: 'Full health check completed',
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default app;
