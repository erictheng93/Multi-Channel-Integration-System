// 統一健康檢查處理程序
import type { Context } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { healthCheckService } from '@/services/health-check-service';
import { DatabaseHealthChecker } from '@/health-checkers/database-checker';
import { CacheHealthChecker } from '@/health-checkers/cache-checker';

import { successResponse, internalErrorResponse } from '@/utils/api-response';
import { getConfigurationStatus } from '@/middleware/configuration-guard';
import { nowISO } from '@/utils/timestamp'

let initialized = false;

/**
 * 初始化健康檢查器
 */
function initializeHealthCheckers(db: any, cache: any) {
  if (initialized) return;

  // 註冊基礎設施檢查器
  healthCheckService.registerChecker(new DatabaseHealthChecker(db));
  healthCheckService.registerChecker(new CacheHealthChecker(cache));

  initialized = true;
}

/**
 * 獲取系統整體健康狀態
 */
export async function getSystemHealth(c: Context<{ Bindings: Bindings }>) {
  try {
    initializeHealthCheckers(c.env.DB, c.env.CACHE);

    const health = await healthCheckService.getSystemHealth();

    // 根據健康狀態設置HTTP狀態碼
    const httpStatus = health.overall.status === 'healthy' ? 200 :
                      health.overall.status === 'warning' ? 200 :
                      health.overall.status === 'critical' ? 503 : 500;

    if (health.overall.status === 'healthy') {
      return successResponse(c, health, health.overall.message);
    } else {
      return c.json({
        success: false,
        data: health,
        message: health.overall.message,
        timestamp: nowISO()
      }, httpStatus);
    }

  } catch (error) {
    console.error('System health check failed:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 獲取基礎設施健康狀態
 */
export async function getInfrastructureHealth(c: Context<{ Bindings: Bindings }>) {
  try {
    initializeHealthCheckers(c.env.DB, c.env.CACHE);

    const health = await healthCheckService.getHealthByLevel('infrastructure' as any);

    const overallStatus = health.every(h => h.status.status === 'healthy') ? 'healthy' :
                         health.some(h => h.status.status === 'critical') ? 'critical' : 'warning';

    return successResponse(c, {
      overall: overallStatus,
      components: health
    }, `Infrastructure status: ${overallStatus}`);

  } catch (error) {
    console.error('Infrastructure health check failed:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 獲取服務層健康狀態
 */
export async function getServicesHealth(c: Context<{ Bindings: Bindings }>) {
  try {
    initializeHealthCheckers(c.env.DB, c.env.CACHE);

    const health = await healthCheckService.getHealthByLevel('service' as any);

    const overallStatus = health.every(h => h.status.status === 'healthy') ? 'healthy' :
                         health.some(h => h.status.status === 'critical') ? 'critical' : 'warning';

    if (overallStatus === 'healthy') {
      return successResponse(c, {
        overall: overallStatus,
        services: health,
        metadata: {
          timestamp: nowISO(),
          servicesChecked: health.length
        }
      }, `Services status: ${overallStatus}`);
    } else {
      return c.json({
        success: false,
        data: {
          overall: overallStatus,
          services: health,
          metadata: {
            timestamp: nowISO(),
            servicesChecked: health.length
          }
        },
        message: `Services status: ${overallStatus}`,
        timestamp: nowISO()
      }, overallStatus === 'critical' ? 503 : 200);
    }

  } catch (error) {
    console.error('Services health check failed:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 執行特定組件的健康檢查
 */
export async function runComponentCheck(c: Context<{ Bindings: Bindings }>) {
  try {
    const { component } = c.req.param();

    if (!component) {
      return c.json({
        success: false,
        error: 'Component parameter is required',
        message: 'Please specify a component to check',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    initializeHealthCheckers(c.env.DB, c.env.CACHE);

    const result = await healthCheckService.runCheck(component);

    const httpStatus = result.status === 'healthy' ? 200 :
                      result.status === 'warning' ? 200 :
                      result.status === 'critical' ? 503 : 500;

    if (result.status === 'healthy') {
      return successResponse(c, {
        component,
        check: result,
        metadata: {
          timestamp: result.timestamp,
          responseTime: result.responseTime
        }
      }, result.message);
    } else {
      return c.json({
        success: false,
        data: {
          component,
          check: result,
          metadata: {
            timestamp: result.timestamp,
            responseTime: result.responseTime
          }
        },
        message: result.message,
        timestamp: nowISO()
      }, httpStatus);
    }

  } catch (error) {
    console.error('Component health check failed:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 獲取健康檢查統計
 */
export async function getHealthStats(c: Context<{ Bindings: Bindings }>) {
  try {
    initializeHealthCheckers(c.env.DB, c.env.CACHE);

    const health = await healthCheckService.getSystemHealth();

    // 計算統計數據
    const totalComponents = health.components.length;
    const healthyCount = health.components.filter(c => c.status.status === 'healthy').length;
    const warningCount = health.components.filter(c => c.status.status === 'warning').length;
    const criticalCount = health.components.filter(c => c.status.status === 'critical').length;
    const unknownCount = health.components.filter(c => c.status.status === 'unknown').length;

    const stats = {
      overview: {
        overallStatus: health.overall.status,
        totalComponents,
        uptime: calculateUptime(health),
        lastCheck: health.overall.timestamp
      },
      distribution: {
        healthy: {
          count: healthyCount,
          percentage: Math.round((healthyCount / totalComponents) * 100)
        },
        warning: {
          count: warningCount,
          percentage: Math.round((warningCount / totalComponents) * 100)
        },
        critical: {
          count: criticalCount,
          percentage: Math.round((criticalCount / totalComponents) * 100)
        },
        unknown: {
          count: unknownCount,
          percentage: Math.round((unknownCount / totalComponents) * 100)
        }
      },
      performance: health.performance,
      trends: {
        // 這裡可以添加歷史趨勢數據
        avgResponseTime: health.performance.apiResponseTime,
        reliability: Math.round((healthyCount / totalComponents) * 100)
      }
    };

    return successResponse(c, {
      ...stats,
      metadata: {
        timestamp: nowISO(),
        dataPoints: totalComponents
      }
    }, 'Health statistics retrieved successfully');

  } catch (error) {
    console.error('Health stats retrieval failed:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 簡單的運行時間計算
 */
function calculateUptime(health: any): string {
  // 簡化的運行時間計算
  // 在實際環境中，這應該基於實際的啟動時間
  const healthyRatio = health.components.filter((c: any) => c.status.status === 'healthy').length / health.components.length;
  return `${Math.round(healthyRatio * 100)}%`;
}

/**
 * 檢查系統配置狀態
 *
 * 此端點用於檢查關鍵環境變量是否已配置
 * 特別是 FRONTEND_URL 和 BACKEND_URL (CORS 所需)
 *
 * @public 此端點不需要身份驗證，方便部署後檢查配置
 */
export async function getConfigCheck(c: Context<{ Bindings: Bindings }>) {
  try {
    const configStatus = getConfigurationStatus(c.env);

    // 根據配置狀態設置 HTTP 狀態碼
    const httpStatus = (configStatus as any).success ? 200 : 503;

    // 添加 CORS headers 以便從前端檢查
    const origin = c.req.header('Origin');
    if (origin) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    return c.json(configStatus, httpStatus);

  } catch (error) {
    console.error('Configuration check failed:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 創建健康檢查方法集合
 */
export function createHealthCheckHandlerMethods(db: any, cache: any) {
  // 初始化檢查器
  initializeHealthCheckers(db, cache);

  return {
    getSystemHealth,
    getInfrastructureHealth,
    getServicesHealth,
    runComponentCheck,
    getHealthStats
  };
}
