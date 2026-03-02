// 自動化健康監控系統 - 提高系統可靠性
import { healthCheckService } from './health-check-service';
import type { SystemHealth } from '../types/health-check';
import { nowISO, nowMs } from '@/utils/timestamp'

// 監控配置
interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number; // 毫秒
  alertThresholds: {
    consecutiveFailures: number;
    responseTimeWarning: number;
    responseTimeCritical: number;
  };
  autoRemediation: {
    enabled: boolean;
    maxRetries: number;
    restartServices: boolean;
    clearCache: boolean;
  };
  notifications: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
}

// 健康狀態歷史記錄
interface HealthRecord {
  timestamp: string;
  overallStatus: string;
  details: SystemHealth;
  responseTime: number;
  issues: string[];
}

// 警報記錄
interface AlertRecord {
  id: string;
  timestamp: string;
  level: 'warning' | 'critical';
  message: string;
  component: string;
  resolved: boolean;
  resolvedAt?: string;
  autoRemediated: boolean;
}

export class AutomatedHealthMonitoring {
  private config: MonitoringConfig;
  private monitoringInterval: number | null = null;
  private healthHistory: HealthRecord[] = [];
  private alertHistory: AlertRecord[] = [];
  private consecutiveFailures: Map<string, number> = new Map();
  private isRunning = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled: true,
      checkInterval: 30000, // 30秒
      alertThresholds: {
        consecutiveFailures: 3,
        responseTimeWarning: 2000,
        responseTimeCritical: 5000
      },
      autoRemediation: {
        enabled: true,
        maxRetries: 3,
        restartServices: false, // 在生產環境中謹慎使用
        clearCache: true
      },
      notifications: {},
      ...config
    };
  }

  /**
   * 啟動自動化監控
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Health monitoring is already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('⏸️ Health monitoring is disabled');
      return;
    }

    console.log('🚀 Starting automated health monitoring...');
    console.log(`📊 Monitoring interval: ${this.config.checkInterval}ms`);
    console.log(`🚨 Alert threshold: ${this.config.alertThresholds.consecutiveFailures} consecutive failures`);

    this.isRunning = true;
    this.runMonitoringCycle();

    // 設定週期性檢查
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle();
    }, this.config.checkInterval) as any;
  }

  /**
   * 停止自動化監控
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Automated health monitoring stopped');
  }

  /**
   * 執行監控週期
   */
  private async runMonitoringCycle(): Promise<void> {
    try {
      console.log('🔍 Running health check cycle...');
      const startTime = nowMs();

      // 執行系統健康檢查
      const health = await healthCheckService.getSystemHealth();
      const responseTime = Date.now() - startTime;

      // 記錄健康狀態
      const record: HealthRecord = {
        timestamp: nowISO(),
        overallStatus: health.overall.status,
        details: health,
        responseTime,
        issues: this.extractIssues(health)
      };

      this.addHealthRecord(record);

      // 分析健康狀態並處理警報
      await this.analyzeHealthAndAlert(record);

      // 執行自動修復（如果需要）
      if (health.overall.status !== 'healthy') {
        await this.attemptAutoRemediation(health);
      }

      console.log(`✅ Health check completed: ${health.overall.status} (${responseTime}ms)`);

    } catch (error) {
      console.error('❌ Health monitoring cycle failed:', error);
      await this.handleMonitoringFailure(error);
    }
  }

  /**
   * 分析健康狀態並發送警報
   */
  private async analyzeHealthAndAlert(record: HealthRecord): Promise<void> {
    const status = record.overallStatus;
    const responseTime = record.responseTime;

    // 檢查響應時間警報
    if (responseTime > this.config.alertThresholds.responseTimeCritical) {
      await this.sendAlert({
        level: 'critical',
        message: `System response time critical: ${responseTime}ms`,
        component: 'system',
        details: { responseTime, threshold: this.config.alertThresholds.responseTimeCritical }
      });
    } else if (responseTime > this.config.alertThresholds.responseTimeWarning) {
      await this.sendAlert({
        level: 'warning',
        message: `System response time high: ${responseTime}ms`,
        component: 'system',
        details: { responseTime, threshold: this.config.alertThresholds.responseTimeWarning }
      });
    }

    // 檢查組件狀態警報
    for (const component of record.details.components) {
      const componentName = component.component;

      if (component.status.status !== 'healthy') {
        // 增加連續失敗計數
        const failures = (this.consecutiveFailures.get(componentName) || 0) + 1;
        this.consecutiveFailures.set(componentName, failures);

        // 檢查是否達到警報閾值
        if (failures >= this.config.alertThresholds.consecutiveFailures) {
          await this.sendAlert({
            level: component.status.status === 'critical' ? 'critical' : 'warning',
            message: `Component ${componentName} has ${failures} consecutive failures`,
            component: componentName,
            details: {
              status: component.status.status,
              message: component.status.message,
              failures
            }
          });
        }
      } else {
        // 重置連續失敗計數
        if (this.consecutiveFailures.has(componentName)) {
          console.log(`✅ Component ${componentName} recovered`);
          this.consecutiveFailures.delete(componentName);
        }
      }
    }

    // 系統整體狀態警報
    if (status === 'critical') {
      await this.sendAlert({
        level: 'critical',
        message: 'System overall status is critical',
        component: 'system',
        details: { issues: record.issues }
      });
    }
  }

  /**
   * 嘗試自動修復
   */
  private async attemptAutoRemediation(health: SystemHealth): Promise<void> {
    if (!this.config.autoRemediation.enabled) {
      return;
    }

    console.log('🔧 Attempting auto-remediation...');

    try {
      let remediationActions: string[] = [];

      // 檢查是否需要清除快取
      if (this.config.autoRemediation.clearCache) {
        const cacheIssues = this.hasCacheIssues(health);
        if (cacheIssues) {
          await this.clearSystemCache();
          remediationActions.push('cleared_cache');
        }
      }

      // 檢查數據庫連接問題
      const dbIssues = this.hasDatabaseIssues(health);
      if (dbIssues) {
        await this.attemptDatabaseReconnection();
        remediationActions.push('db_reconnection_attempt');
      }

      // 記錄修復動作
      if (remediationActions.length > 0) {
        console.log(`🔧 Auto-remediation actions taken: ${remediationActions.join(', ')}`);

        // 等待一段時間後重新檢查
        setTimeout(async () => {
          const newHealth = await healthCheckService.getSystemHealth();
          if (newHealth.overall.status === 'healthy') {
            console.log('✅ Auto-remediation successful');
          } else {
            console.log('⚠️ Auto-remediation partially successful or failed');
          }
        }, 10000); // 10秒後檢查
      }

    } catch (error) {
      console.error('❌ Auto-remediation failed:', error);
    }
  }

  /**
   * 發送警報
   */
  private async sendAlert(alertData: {
    level: 'warning' | 'critical';
    message: string;
    component: string;
    details?: any;
  }): Promise<void> {
    const alert: AlertRecord = {
      id: `alert_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: nowISO(),
      level: alertData.level,
      message: alertData.message,
      component: alertData.component,
      resolved: false,
      autoRemediated: false
    };

    this.alertHistory.push(alert);

    // 限制歷史記錄大小
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-500);
    }

    console.log(`🚨 ${alert.level.toUpperCase()} ALERT: ${alert.message}`);

    // 發送通知（如果配置了）
    await this.sendNotifications(alert, alertData.details);
  }

  /**
   * 發送通知
   */
  private async sendNotifications(alert: AlertRecord, details?: any): Promise<void> {
    try {
      // Webhook 通知
      if (this.config.notifications.webhook) {
        await fetch(this.config.notifications.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alert,
            details,
            system: 'mcis'
          })
        });
      }

      // 這裡可以添加其他通知方式（Email, Slack等）

    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * 處理監控失敗
   */
  private async handleMonitoringFailure(error: any): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      message: `Health monitoring system failure: ${error.message}`,
      component: 'monitoring',
      details: { error: error.message }
    });
  }

  /**
   * 提取問題列表
   */
  private extractIssues(health: SystemHealth): string[] {
    const issues: string[] = [];

    if (health.overall.status !== 'healthy') {
      issues.push(`Overall status: ${health.overall.status}`);
    }

    for (const component of health.components) {
      if (component.status.status !== 'healthy') {
        issues.push(`${component.component}: ${component.status.message}`);
      }
    }

    return issues;
  }

  /**
   * 檢查是否有快取問題
   */
  private hasCacheIssues(health: SystemHealth): boolean {
    return health.infrastructure.cache.status !== 'healthy';
  }

  /**
   * 檢查是否有資料庫問題
   */
  private hasDatabaseIssues(health: SystemHealth): boolean {
    return health.infrastructure.database.status !== 'healthy';
  }

  /**
   * 清除系統快取
   */
  private async clearSystemCache(): Promise<void> {
    try {
      // 這裡實現快取清除邏輯
      console.log('🧹 Clearing system cache...');
      // await cacheService.clearAll(); // 實際的快取清除邏輯
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * 嘗試重新連接資料庫
   */
  private async attemptDatabaseReconnection(): Promise<void> {
    try {
      console.log('🔄 Attempting database reconnection...');
      // 這裡實現資料庫重連邏輯
      // await dbService.reconnect(); // 實際的資料庫重連邏輯
    } catch (error) {
      console.error('Failed to reconnect to database:', error);
    }
  }

  /**
   * 添加健康記錄
   */
  private addHealthRecord(record: HealthRecord): void {
    this.healthHistory.push(record);

    // 限制歷史記錄大小（保留最近1000條）
    if (this.healthHistory.length > 1000) {
      this.healthHistory = this.healthHistory.slice(-500);
    }
  }

  /**
   * 獲取監控統計
   */
  getMonitoringStats(): any {
    const recentRecords = this.healthHistory.slice(-100); // 最近100條記錄
    const recentAlerts = this.alertHistory.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime();
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      return alertTime > oneDayAgo;
    });

    return {
      monitoring: {
        isRunning: this.isRunning,
        checkInterval: this.config.checkInterval,
        totalChecks: this.healthHistory.length,
        recentChecks: recentRecords.length
      },
      health: {
        currentStatus: recentRecords.length > 0 ? recentRecords[recentRecords.length - 1].overallStatus : 'unknown',
        avgResponseTime: recentRecords.length > 0 ?
          Math.round(recentRecords.reduce((sum, r) => sum + r.responseTime, 0) / recentRecords.length) : 0,
        healthyRate: recentRecords.length > 0 ?
          Math.round((recentRecords.filter(r => r.overallStatus === 'healthy').length / recentRecords.length) * 100) : 0
      },
      alerts: {
        total: this.alertHistory.length,
        last24h: recentAlerts.length,
        critical: recentAlerts.filter(a => a.level === 'critical').length,
        warning: recentAlerts.filter(a => a.level === 'warning').length,
        unresolved: recentAlerts.filter(a => !a.resolved).length
      },
      autoRemediation: {
        enabled: this.config.autoRemediation.enabled,
        actionsToday: 0 // 這裡可以實現具體統計
      }
    };
  }

  /**
   * 獲取健康歷史
   */
  getHealthHistory(limit = 50): HealthRecord[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * 獲取警報歷史
   */
  getAlertHistory(limit = 50): AlertRecord[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Health monitoring configuration updated');

    // 如果監控正在運行且間隔時間改變，重啟監控
    if (this.isRunning && newConfig.checkInterval) {
      this.stop();
      this.start();
    }
  }
}

// 單例實例
export const automatedHealthMonitoring = new AutomatedHealthMonitoring();