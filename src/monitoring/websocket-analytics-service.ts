// WebSocket Analytics Service
// Phase 2: 長期優化 - 錯誤趨勢分析和性能監控
// 專案：Multi-Channel Support MVP - WebSocket 監控系統

import type { Bindings } from '../types';

// 錯誤統計數據結構
export interface WebSocketErrorStats {
  timestamp: number;
  errorCode: number;
  errorType: string;
  message: string;
  userId?: string;
  conversationId?: string;
  clientIP?: string;
  userAgent?: string;
  duration?: number;
  retryAttempt?: number;
}

// 連接質量統計
export interface ConnectionQualityMetrics {
  timestamp: number;
  userId: string;
  connectionId: string;
  latency: number;
  connectionTime: number;
  messagesPerSecond: number;
  errorRate: number;
  isStable: boolean;
  deviceType?: string;
}

// 趨勢分析數據
export interface TrendAnalysisData {
  timeRange: string;
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  errorDistribution: Record<string, number>;
  averageLatency: number;
  peakLatency: number;
  averageConnectionTime: number;
  userSatisfactionScore: number;
}

// 告警級別
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

// 告警配置
export interface AlertConfig {
  errorRateThreshold: number;
  latencyThreshold: number;
  connectionFailureThreshold: number;
  userSatisfactionThreshold: number;
  timeWindowMinutes: number;
}

export class WebSocketAnalyticsService {
  private env: Bindings;
  private readonly STATS_KEY_PREFIX = 'ws_stats:';
  private readonly TRENDS_KEY_PREFIX = 'ws_trends:';
  private readonly ALERTS_KEY_PREFIX = 'ws_alerts:';

  // 預設告警配置
  private readonly DEFAULT_ALERT_CONFIG: AlertConfig = {
    errorRateThreshold: 0.1, // 10% 錯誤率
    latencyThreshold: 2000, // 2 秒延遲
    connectionFailureThreshold: 5, // 5 次連續失敗
    userSatisfactionThreshold: 0.8, // 80% 滿意度
    timeWindowMinutes: 15 // 15 分鐘時間窗口
  };

  constructor(env: Bindings) {
    this.env = env;
  }

  // =================== 錯誤統計記錄 ===================

  async recordError(error: WebSocketErrorStats): Promise<void> {
    try {
      // 記錄到 KV 存儲，使用時間戳作為 key
      const errorKey = `${this.STATS_KEY_PREFIX}error:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`;

      await this.env.CACHE?.put(errorKey, JSON.stringify(error), {
        expirationTtl: 7 * 24 * 60 * 60 // 保存 7 天
      });

      // 更新每小時統計
      await this.updateHourlyStats(error);

      // 檢查是否需要觸發告警
      await this.checkAlertConditions(error);

      console.log(`📊 [Analytics] Error recorded: ${error.errorCode} - ${error.errorType}`);
    } catch (err) {
      console.error('❌ [Analytics] Failed to record error:', err);
    }
  }

  async recordConnectionQuality(metrics: ConnectionQualityMetrics): Promise<void> {
    try {
      const metricsKey = `${this.STATS_KEY_PREFIX}quality:${Date.now()}:${metrics.userId}`;

      await this.env.CACHE?.put(metricsKey, JSON.stringify(metrics), {
        expirationTtl: 24 * 60 * 60 // 保存 1 天
      });

      // 更新用戶連接質量統計
      await this.updateUserQualityStats(metrics);

      console.log(`📈 [Analytics] Connection quality recorded for user: ${metrics.userId}`);
    } catch (err) {
      console.error('❌ [Analytics] Failed to record connection quality:', err);
    }
  }

  // =================== 趨勢分析 ===================

  async generateTrendAnalysis(timeRangeHours: number = 24): Promise<TrendAnalysisData> {
    try {
      const endTime = Date.now();
      const startTime = endTime - (timeRangeHours * 60 * 60 * 1000);

      // 獲取時間範圍內的所有錯誤記錄
      const errors = await this.getErrorsInTimeRange(startTime, endTime);
      const qualityMetrics = await this.getQualityMetricsInTimeRange(startTime, endTime);

      // 計算統計指標
      const totalConnections = qualityMetrics.length;
      const successfulConnections = qualityMetrics.filter(m => m.isStable).length;
      const failedConnections = errors.length;

      // 錯誤分佈統計
      const errorDistribution: Record<string, number> = {};
      errors.forEach(error => {
        const errorKey = `${error.errorCode}:${error.errorType}`;
        errorDistribution[errorKey] = (errorDistribution[errorKey] || 0) + 1;
      });

      // 延遲統計
      const latencies = qualityMetrics.map(m => m.latency).filter(l => l > 0);
      const averageLatency = latencies.length > 0 ?
        latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
      const peakLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

      // 連接時間統計
      const connectionTimes = qualityMetrics.map(m => m.connectionTime).filter(t => t > 0);
      const averageConnectionTime = connectionTimes.length > 0 ?
        connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length : 0;

      // 用戶滿意度評分 (基於錯誤率和延遲)
      const errorRate = totalConnections > 0 ? failedConnections / totalConnections : 0;
      const latencyScore = averageLatency < 1000 ? 1 : Math.max(0, 1 - (averageLatency - 1000) / 2000);
      const userSatisfactionScore = Math.max(0, (1 - errorRate) * latencyScore);

      const trendData: TrendAnalysisData = {
        timeRange: `${timeRangeHours}h`,
        totalConnections,
        successfulConnections,
        failedConnections,
        errorDistribution,
        averageLatency,
        peakLatency,
        averageConnectionTime,
        userSatisfactionScore
      };

      // 保存趨勢分析結果
      const trendKey = `${this.TRENDS_KEY_PREFIX}${timeRangeHours}h:${Date.now()}`;
      await this.env.CACHE?.put(trendKey, JSON.stringify(trendData), {
        expirationTtl: 7 * 24 * 60 * 60 // 保存 7 天
      });

      return trendData;
    } catch (err) {
      console.error('❌ [Analytics] Failed to generate trend analysis:', err);
      throw err;
    }
  }

  // =================== 告警系統 ===================

  async checkAlertConditions(_error: WebSocketErrorStats): Promise<void> {
    try {
      const config = await this.getAlertConfig();
      const now = Date.now();
      const windowStart = now - (config.timeWindowMinutes * 60 * 1000);

      // 檢查錯誤率
      const recentErrors = await this.getErrorsInTimeRange(windowStart, now);
      const recentConnections = await this.getQualityMetricsInTimeRange(windowStart, now);

      const totalAttempts = recentErrors.length + recentConnections.length;
      const errorRate = totalAttempts > 0 ? recentErrors.length / totalAttempts : 0;

      if (errorRate > config.errorRateThreshold) {
        await this.triggerAlert(AlertLevel.WARNING, 'High Error Rate',
          `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(config.errorRateThreshold * 100)}%`);
      }

      // 檢查特定錯誤模式
      await this.checkErrorPatterns(recentErrors);

    } catch (err) {
      console.error('❌ [Analytics] Failed to check alert conditions:', err);
    }
  }

  private async checkErrorPatterns(errors: WebSocketErrorStats[]): Promise<void> {
    // 檢查連續 1006 錯誤 (如果修復失效)
    const recent1006Errors = errors.filter(e => e.errorCode === 1006).length;
    if (recent1006Errors > 3) {
      await this.triggerAlert(AlertLevel.CRITICAL, '1006 Errors Detected',
        `${recent1006Errors} 1006 errors detected - fix may have regressed!`);
    }

    // 檢查大量認證失敗
    const authErrors = errors.filter(e => e.errorCode >= 4401 && e.errorCode <= 4407).length;
    if (authErrors > 10) {
      await this.triggerAlert(AlertLevel.WARNING, 'High Authentication Failures',
        `${authErrors} authentication errors in recent window`);
    }

    // 檢查系統錯誤
    const systemErrors = errors.filter(e => e.errorCode === 4500).length;
    if (systemErrors > 5) {
      await this.triggerAlert(AlertLevel.CRITICAL, 'System Error Spike',
        `${systemErrors} system errors detected - investigate server issues`);
    }
  }

  async triggerAlert(level: AlertLevel, title: string, description: string): Promise<void> {
    try {
      // 🆕 Phase 2: 整合智能告警通知系統
      const { createAlertNotificationService } = await import('../services/alert-notification-service');
      const alertService = createAlertNotificationService(this.env);

      // 發送告警通知
      const alertRecord = await alertService.sendAlert(level, title, description, {
        source: 'websocket_analytics',
        system: 'multi_channel_support'
      });

      // 保存告警記錄到分析系統
      const alertKey = `${this.ALERTS_KEY_PREFIX}${alertRecord.id}`;
      await this.env.CACHE?.put(alertKey, JSON.stringify(alertRecord), {
        expirationTtl: 30 * 24 * 60 * 60 // 保存 30 天
      });

      console.log(`🚨 [Analytics] ALERT [${level.toUpperCase()}]: ${title} - ${description} (ID: ${alertRecord.id})`);

    } catch (err) {
      console.error('❌ [Analytics] Failed to trigger alert:', err);

      // 降級處理：如果告警服務失敗，至少記錄到控制台
      console.log(`🚨 [Analytics] FALLBACK ALERT [${level.toUpperCase()}]: ${title} - ${description}`);
    }
  }

  // =================== 數據檢索方法 ===================

  async getDashboardData(): Promise<{
    currentStats: any;
    recentTrends: TrendAnalysisData;
    activeAlerts: any[];
    topErrors: Array<{errorCode: number; count: number; percentage: number}>;
  }> {
    try {
      // 獲取當前統計
      const currentStats = await this.getCurrentStats();

      // 獲取最近 24 小時趨勢
      const recentTrends = await this.generateTrendAnalysis(24);

      // 獲取活躍告警
      const activeAlerts = await this.getActiveAlerts();

      // 獲取排行前 5 的錯誤
      const topErrors = await this.getTopErrors(5);

      return {
        currentStats,
        recentTrends,
        activeAlerts,
        topErrors
      };
    } catch (err) {
      console.error('❌ [Analytics] Failed to get dashboard data:', err);
      throw err;
    }
  }

  private async getCurrentStats(): Promise<any> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentErrors = await this.getErrorsInTimeRange(oneHourAgo, now);
    const recentConnections = await this.getQualityMetricsInTimeRange(oneHourAgo, now);

    return {
      timestamp: now,
      hourlyErrorCount: recentErrors.length,
      hourlyConnectionCount: recentConnections.length,
      averageLatency: recentConnections.length > 0 ?
        recentConnections.reduce((a, b) => a + b.latency, 0) / recentConnections.length : 0,
      successRate: recentConnections.length > 0 ?
        recentConnections.filter(c => c.isStable).length / recentConnections.length : 1
    };
  }

  private async getTopErrors(limit: number): Promise<Array<{errorCode: number; count: number; percentage: number}>> {
    try {
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      const errors = await this.getErrorsInTimeRange(twentyFourHoursAgo, Date.now());

      const errorCounts: Record<number, number> = {};
      errors.forEach(error => {
        errorCounts[error.errorCode] = (errorCounts[error.errorCode] || 0) + 1;
      });

      const totalErrors = errors.length;

      return Object.entries(errorCounts)
        .map(([code, count]) => ({
          errorCode: parseInt(code),
          count,
          percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (err) {
      console.error('❌ [Analytics] Failed to get top errors:', err);
      return [];
    }
  }

  // =================== 輔助方法 ===================

  private async getErrorsInTimeRange(startTime: number, endTime: number): Promise<WebSocketErrorStats[]> {
    // 在實際實現中，這裡需要從 KV 存儲中查詢數據
    // 目前返回模擬數據以確保功能正常
    const errors: WebSocketErrorStats[] = [];

    try {
      // 模擬實現 - 在實際環境中需要實現 KV 範圍查詢
      // 由於 Cloudflare KV 不支持範圍查詢，可能需要使用 D1 數據庫
      console.log(`🔍 [Analytics] Querying errors from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    } catch (err) {
      console.error('❌ [Analytics] Error querying time range:', err);
    }

    return errors;
  }

  private async getQualityMetricsInTimeRange(startTime: number, endTime: number): Promise<ConnectionQualityMetrics[]> {
    const metrics: ConnectionQualityMetrics[] = [];

    try {
      console.log(`🔍 [Analytics] Querying quality metrics from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    } catch (err) {
      console.error('❌ [Analytics] Error querying quality metrics:', err);
    }

    return metrics;
  }

  private async updateHourlyStats(error: WebSocketErrorStats): Promise<void> {
    // 更新每小時統計數據
    const hourKey = `${this.STATS_KEY_PREFIX}hourly:${Math.floor(Date.now() / (60 * 60 * 1000))}`;

    try {
      const existing = await this.env.CACHE?.get(hourKey);
      const stats = existing ? JSON.parse(existing) : { errorCount: 0, errors: [] };

      stats.errorCount++;
      stats.errors.push({
        code: error.errorCode,
        type: error.errorType,
        timestamp: error.timestamp
      });

      await this.env.CACHE?.put(hourKey, JSON.stringify(stats), {
        expirationTtl: 48 * 60 * 60 // 保存 48 小時
      });
    } catch (err) {
      console.error('❌ [Analytics] Failed to update hourly stats:', err);
    }
  }

  private async updateUserQualityStats(metrics: ConnectionQualityMetrics): Promise<void> {
    // 更新用戶連接質量統計
    const userKey = `${this.STATS_KEY_PREFIX}user:${metrics.userId}`;

    try {
      const existing = await this.env.CACHE?.get(userKey);
      const stats = existing ? JSON.parse(existing) : {
        totalConnections: 0,
        averageLatency: 0,
        lastUpdated: Date.now()
      };

      // 計算移動平均
      const newTotal = stats.totalConnections + 1;
      const newAverage = (stats.averageLatency * stats.totalConnections + metrics.latency) / newTotal;

      stats.totalConnections = newTotal;
      stats.averageLatency = newAverage;
      stats.lastUpdated = Date.now();
      stats.lastConnectionQuality = metrics.isStable ? 'good' : 'poor';

      await this.env.CACHE?.put(userKey, JSON.stringify(stats), {
        expirationTtl: 7 * 24 * 60 * 60 // 保存 7 天
      });
    } catch (err) {
      console.error('❌ [Analytics] Failed to update user quality stats:', err);
    }
  }

  private async getAlertConfig(): Promise<AlertConfig> {
    try {
      const configKey = 'ws_alert_config';
      const config = await this.env.CACHE?.get(configKey);
      return config ? JSON.parse(config) : this.DEFAULT_ALERT_CONFIG;
    } catch (err) {
      console.warn('⚠️ [Analytics] Failed to get alert config, using defaults');
      return this.DEFAULT_ALERT_CONFIG;
    }
  }

  private async getActiveAlerts(): Promise<any[]> {
    // 獲取活躍告警 - 簡化實現
    try {
      const alerts: any[] = [];
      console.log('🔍 [Analytics] Querying active alerts');
      return alerts;
    } catch (err) {
      console.error('❌ [Analytics] Failed to get active alerts:', err);
      return [];
    }
  }

  /*
  private async _sendEmergencyNotification(alert: any): Promise<void> {
    try {
      // 這裡可以整合外部通知系統 (Slack, Teams, Email 等)
      console.log(`🚨🚨 [Analytics] EMERGENCY NOTIFICATION: ${alert.title}`);
      console.log(`Description: ${alert.description}`);
      console.log(`Timestamp: ${new Date(alert.timestamp).toISOString()}`);

      // 未來可以整合：
      // - Slack Webhook
      // - Microsoft Teams
      // - Email 通知
      // - SMS 通知

    } catch (err) {
      console.error('❌ [Analytics] Failed to send emergency notification:', err);
    }
  }
  */
}

// 工廠函數
export function createAnalyticsService(env: Bindings): WebSocketAnalyticsService {
  return new WebSocketAnalyticsService(env);
}