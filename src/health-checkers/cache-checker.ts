// KV快取健康檢查器
import { HealthLevel, type HealthChecker, type HealthCheckResult, type HealthCheckConfig } from '../types/health-check';

export class CacheHealthChecker implements HealthChecker {
  name = 'cache';
  level = HealthLevel.INFRASTRUCTURE;
  description = 'KV Cache connectivity and performance check';

  constructor(private kv: any) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const testKey = `health_check_${Date.now()}`;
    const testValue = 'health_check_value';

    try {
      // 測試寫入操作
      await this.kv.put(testKey, testValue, { expirationTtl: 60 });

      // 測試讀取操作
      const retrievedValue = await this.kv.get(testKey);

      // 測試刪除操作
      await this.kv.delete(testKey);

      const responseTime = Date.now() - startTime;

      if (retrievedValue !== testValue) {
        return {
          status: 'critical',
          message: 'Cache read/write test failed',
          timestamp: new Date().toISOString(),
          responseTime,
          details: {
            expected: testValue,
            received: retrievedValue
          }
        };
      }

      // 檢查響應時間
      if (responseTime > 500) {
        return {
          status: 'warning',
          message: `Cache response time is slow: ${responseTime}ms`,
          timestamp: new Date().toISOString(),
          responseTime,
          details: {
            operations: ['put', 'get', 'delete'],
            expectedMaxTime: 500
          }
        };
      }

      return {
        status: 'healthy',
        message: 'Cache is accessible and responsive',
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          operations: ['put', 'get', 'delete'],
          testKey: testKey
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Cache operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          testKey: testKey
        }
      };
    }
  }

  getConfig(): HealthCheckConfig {
    return {
      enabled: true,
      interval: 60, // 每60秒檢查一次
      timeout: 3000, // 3秒超時
      retries: 2,
      alertThresholds: {
        warning: 500, // 0.5秒
        critical: 2000 // 2秒
      },
      notifications: {
        webhook: process.env.HEALTH_WEBHOOK_URL
      }
    };
  }
}