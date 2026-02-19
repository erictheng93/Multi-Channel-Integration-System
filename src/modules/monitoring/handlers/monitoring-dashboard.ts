// 監控儀表板API處理器
import type { Context } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { automatedHealthMonitoring } from '@/services/automated-health-monitoring';
import { healthCheckService } from '@/services/health-check-service';
import { successResponse, internalErrorResponse } from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp'

/**
 * 獲取監控儀表板數據
 */
export async function getMonitoringDashboard(c: Context<{ Bindings: Bindings }>) {
  try {
    const stats = automatedHealthMonitoring.getMonitoringStats();
    const currentHealth = await healthCheckService.getSystemHealth();

    const dashboardData = {
      timestamp: nowISO(),
      system: {
        status: currentHealth.overall.status,
        message: currentHealth.overall.message,
        uptime: stats.health.healthyRate + '%',
        responseTime: stats.health.avgResponseTime + 'ms'
      },
      monitoring: stats.monitoring,
      health: stats.health,
      alerts: stats.alerts,
      components: currentHealth.components.map(comp => ({
        name: comp.component,
        status: comp.status.status,
        message: comp.status.message,
        lastCheck: comp.lastCheck,
        responseTime: comp.status.responseTime
      })),
      infrastructure: {
        database: {
          status: currentHealth.infrastructure.database.status,
          message: currentHealth.infrastructure.database.message
        },
        cache: {
          status: currentHealth.infrastructure.cache.status,
          message: currentHealth.infrastructure.cache.message
        },
        storage: {
          status: currentHealth.infrastructure.storage.status,
          message: currentHealth.infrastructure.storage.message
        },
        queue: {
          status: currentHealth.infrastructure.queue.status,
          message: currentHealth.infrastructure.queue.message
        }
      },
      performance: currentHealth.performance
    };

    return successResponse(c, dashboardData, 'Monitoring dashboard data retrieved');
  } catch (error) {
    console.error('Monitoring dashboard error:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 獲取健康歷史數據
 */
export async function getHealthHistory(c: Context<{ Bindings: Bindings }>) {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const history = automatedHealthMonitoring.getHealthHistory(limit);

    const processedHistory = history.map(record => ({
      timestamp: record.timestamp,
      status: record.overallStatus,
      responseTime: record.responseTime,
      issuesCount: record.issues.length,
      issues: record.issues
    }));

    return successResponse(c, {
      history: processedHistory,
      total: processedHistory.length
    }, 'Health history retrieved');
  } catch (error) {
    console.error('Health history error:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 獲取警報歷史
 */
export async function getAlertHistory(c: Context<{ Bindings: Bindings }>) {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const onlyUnresolved = c.req.query('unresolved') === 'true';

    let alerts = automatedHealthMonitoring.getAlertHistory(limit);

    if (onlyUnresolved) {
      alerts = alerts.filter(alert => !alert.resolved);
    }

    return successResponse(c, {
      alerts,
      total: alerts.length
    }, 'Alert history retrieved');
  } catch (error) {
    console.error('Alert history error:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 更新監控配置
 */
export async function updateMonitoringConfig(c: Context<{ Bindings: Bindings }>) {
  try {
    const config = await c.req.json();

    // 驗證配置
    if (config.checkInterval && (config.checkInterval < 10000 || config.checkInterval > 300000)) {
      return c.json({
        success: false,
        error: 'Check interval must be between 10 seconds and 5 minutes',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    automatedHealthMonitoring.updateConfig(config);

    return successResponse(c, { updated: true }, 'Monitoring configuration updated');
  } catch (error) {
    console.error('Update monitoring config error:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 手動觸發健康檢查
 */
export async function triggerHealthCheck(c: Context<{ Bindings: Bindings }>) {
  try {
    const health = await healthCheckService.runAllChecks();

    return successResponse(c, health, 'Manual health check completed');
  } catch (error) {
    console.error('Manual health check error:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 獲取系統指標（Prometheus格式）
 */
export async function getSystemMetrics(c: Context<{ Bindings: Bindings }>) {
  try {
    const stats = automatedHealthMonitoring.getMonitoringStats();
    const health = await healthCheckService.getSystemHealth();

    // 生成Prometheus格式的指標
    const metrics = `
# HELP system_health_status Overall system health status
# TYPE system_health_status gauge
system_health_status{system="multi_channel_support"} ${health.overall.status === 'healthy' ? 1 : 0}

# HELP system_response_time System response time in milliseconds
# TYPE system_response_time gauge
system_response_time{system="multi_channel_support"} ${stats.health.avgResponseTime}

# HELP system_uptime_percentage System uptime percentage
# TYPE system_uptime_percentage gauge
system_uptime_percentage{system="multi_channel_support"} ${stats.health.healthyRate}

# HELP monitoring_checks_total Total number of monitoring checks performed
# TYPE monitoring_checks_total counter
monitoring_checks_total{system="multi_channel_support"} ${stats.monitoring.totalChecks}

# HELP alerts_total Total number of alerts generated
# TYPE alerts_total counter
alerts_total{level="critical",system="multi_channel_support"} ${stats.alerts.critical}
alerts_total{level="warning",system="multi_channel_support"} ${stats.alerts.warning}

# HELP unresolved_alerts Current number of unresolved alerts
# TYPE unresolved_alerts gauge
unresolved_alerts{system="multi_channel_support"} ${stats.alerts.unresolved}

# HELP component_health Component health status
# TYPE component_health gauge
${health.components.map(comp =>
  `component_health{component="${comp.component}",system="multi_channel_support"} ${comp.status.status === 'healthy' ? 1 : 0}`
).join('\n')}
    `.trim();

    return c.text(metrics, 200, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
  } catch (error) {
    console.error('System metrics error:', error);
    return c.text('# Error generating metrics\n', 500, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
  }
}

/**
 * 健康檢查監控統計
 */
export async function getMonitoringStats(c: Context<{ Bindings: Bindings }>) {
  try {
    const stats = automatedHealthMonitoring.getMonitoringStats();

    return successResponse(c, stats, 'Monitoring statistics retrieved');
  } catch (error) {
    console.error('Monitoring stats error:', error);
    return internalErrorResponse(c, error instanceof Error ? error.message : 'Internal server error');
  }
}

/**
 * 創建監控儀表板處理器方法
 */
export function createMonitoringHandlerMethods() {
  return {
    getDashboard: getMonitoringDashboard,
    getHealthHistory,
    getAlertHistory,
    updateConfig: updateMonitoringConfig,
    triggerHealthCheck,
    getMetrics: getSystemMetrics,
    getStats: getMonitoringStats
  };
}
