// 資料庫健康檢查器
import { HealthLevel, type HealthChecker, type HealthCheckResult, type HealthCheckConfig } from '../types/health-check';
import type { D1Database } from '@cloudflare/workers-types';
import { nowISO, nowMs } from '@/utils/timestamp'

export class DatabaseHealthChecker implements HealthChecker {
  name = 'database';
  level = HealthLevel.INFRASTRUCTURE;
  description = 'Database connectivity and performance check';

  constructor(private db: D1Database) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = nowMs();

    try {
      // 執行簡單的查詢測試連線
      const testQuery = `SELECT 1 as test`;
      const result = await this.db.prepare(testQuery).first();

      const responseTime = Date.now() - startTime;

      if (!result || (result as { test?: number }).test !== 1) {
        return {
          status: 'critical',
          message: 'Database query returned unexpected result',
          timestamp: nowISO(),
          responseTime
        };
      }

      // 檢查響應時間
      if (responseTime > 1000) {
        return {
          status: 'warning',
          message: `Database response time is slow: ${responseTime}ms`,
          timestamp: nowISO(),
          responseTime,
          details: {
            queryType: 'simple_select',
            expectedMaxTime: 1000
          }
        };
      }

      return {
        status: 'healthy',
        message: 'Database is accessible and responsive',
        timestamp: nowISO(),
        responseTime,
        details: {
          queryType: 'simple_select',
          connectionPool: 'active'
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: nowISO(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  getConfig(): HealthCheckConfig {
    return {
      enabled: true,
      interval: 30, // 每30秒檢查一次
      timeout: 5000, // 5秒超時
      retries: 3,
      alertThresholds: {
        warning: 1000, // 1秒
        critical: 3000 // 3秒
      },
      notifications: {
        webhook: process.env.HEALTH_WEBHOOK_URL
      }
    };
  }
}
