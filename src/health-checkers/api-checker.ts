// API服務健康檢查器
import { HealthLevel, type HealthChecker, type HealthCheckResult, type HealthCheckConfig } from '../types/health-check';
import { nowISO, nowMs } from '@/utils/timestamp'

export class APIHealthChecker implements HealthChecker {
  name = 'api-services';
  level = HealthLevel.SERVICE;
  description = 'API endpoints and service health check';

  constructor(private baseUrl: string = '') {}

  async check(): Promise<HealthCheckResult> {
    const startTime = nowMs();
    try {
      // 檢查核心API端點
      const endpoints = [
        '/api/system/health',
        '/api/auth/validate',
        '/api/conversations/health',
        '/api/notifications/health',
        '/api/reports/health'
      ];

      // 並行檢查所有端點
      const endpointChecks = endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          return {
            endpoint,
            status: response.ok ? 'healthy' : 'warning',
            statusCode: response.status,
            responseTime: Date.now() - startTime
          };
        } catch (error) {
          return {
            endpoint,
            status: 'critical',
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - startTime
          };
        }
      });

      const results = await Promise.all(endpointChecks);
      const totalResponseTime = Date.now() - startTime;

      // 分析結果
      const criticalCount = results.filter(r => r.status === 'critical').length;
      const warningCount = results.filter(r => r.status === 'warning').length;
      const healthyCount = results.filter(r => r.status === 'healthy').length;

      let overallStatus: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (criticalCount > 0) {
        overallStatus = 'critical';
        message = `${criticalCount} API endpoint(s) are critical, ${warningCount} warning, ${healthyCount} healthy`;
      } else if (warningCount > 0) {
        overallStatus = 'warning';
        message = `${warningCount} API endpoint(s) have warnings, ${healthyCount} healthy`;
      } else {
        overallStatus = 'healthy';
        message = `All ${healthyCount} API endpoints are healthy`;
      }

      return {
        status: overallStatus,
        message,
        timestamp: nowISO(),
        responseTime: totalResponseTime,
        details: {
          endpoints: results,
          summary: {
            total: results.length,
            healthy: healthyCount,
            warning: warningCount,
            critical: criticalCount
          }
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      interval: 120, // 每2分鐘檢查一次
      timeout: 10000, // 10秒超時
      retries: 2,
      alertThresholds: {
        warning: 2000, // 2秒
        critical: 5000 // 5秒
      },
      notifications: {
        webhook: process.env.HEALTH_WEBHOOK_URL
      }
    };
  }
}