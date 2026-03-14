// Durable Objects Monitoring Service
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 監控所有 DO 實例的健康狀態、性能指標和告警

import type { Bindings } from '../types';
import { Logger, LogLevel, createLogger, type LogContext } from './logger-service';
import { nowMs } from '@/utils/timestamp'

/**
 * DO 實例健康狀態
 */
export enum DOHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * DO 實例指標
 */
export interface DOInstanceMetrics {
  // 基本信息
  objectType: 'ConversationRoom' | 'UserConnection' | 'MessageBroadcaster' | 'DelayedMessageProcessor';
  instanceId: string;
  healthStatus: DOHealthStatus;

  // 連接信息
  activeConnections: number;
  totalConnectionsServed: number;
  connectionLimit: number;

  // 性能指標
  averageLatency: number;
  requestsPerSecond: number;
  errorRate: number;

  // 資源使用
  memoryUsageMB: number;
  cpuUsagePercent: number;

  // 時間戳
  lastHealthCheck: number;
  uptime: number;
  lastActivity: number;

  // 告警狀態
  alerts: DOAlert[];
}

/**
 * DO 告警類型
 */
export enum DOAlertType {
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_LATENCY = 'high_latency',
  HIGH_MEMORY = 'high_memory',
  CONNECTION_LIMIT = 'connection_limit',
  INSTANCE_UNRESPONSIVE = 'instance_unresponsive',
  INSTANCE_CRASHED = 'instance_crashed'
}

/**
 * DO 告警
 */
export interface DOAlert {
  type: DOAlertType;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * 監控配置
 */
export interface MonitorConfig {
  // 健康檢查間隔（毫秒）
  healthCheckInterval: number;

  // 告警閾值
  thresholds: {
    errorRate: number; // 錯誤率閾值（0-1）
    latency: number; // 延遲閾值（毫秒）
    memoryUsage: number; // 內存使用閾值（MB）
    connectionUtilization: number; // 連接使用率閾值（0-1）
  };

  // 實例限制
  limits: {
    maxInstancesPerType: number;  // 每種類型最大實例數
    maxTotalInstances: number; // 總實例數上限
  };

  // 告警設置
  alerts: {
    enabled: boolean;
    cooldownPeriod: number; // 告警冷卻期（毫秒）
    maxAlertsPerHour: number;
  };
}

/**
 * 監控統計
 */
export interface MonitorStats {
  totalInstances: number;
  instancesByType: Record<string, number>;
  healthyInstances: number;
  degradedInstances: number;
  unhealthyInstances: number;
  totalAlerts: number;
  activeAlerts: number;
  lastUpdate: number;
}

/**
 * Durable Objects 監控服務
 *
 * 功能：
 * - 實時監控所有 DO 實例
 * - 健康檢查和性能追蹤
 * - 自動告警和通知
 * - 異常檢測和診斷
 */
export class DurableObjectsMonitor {
  private env: Bindings;
  private logger: Logger;
  private config: MonitorConfig;
  private instanceMetrics: Map<string, DOInstanceMetrics> = new Map();
  private alertHistory: DOAlert[] = [];
  private lastAlertTime: Map<string, number> = new Map();

  constructor(env: Bindings, config?: Partial<MonitorConfig>) {
    this.env = env;
    this.logger = createLogger({ service: 'DO-Monitor' }, {
      minLevel: LogLevel.INFO,
      serviceName: 'durable-objects-monitor'
    });

    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      thresholds: {
        errorRate: 0.1, // 10% error rate
        latency: 1000, // 1 second
        memoryUsage: 100, // 100 MB
        connectionUtilization: 0.8 // 80% connection utilization
      },
      limits: {
        maxInstancesPerType: 1000,
        maxTotalInstances: 3000
      },
      alerts: {
        enabled: true,
        cooldownPeriod: 300000, // 5 minutes
        maxAlertsPerHour: 10
      },
      ...config
    };
  }

  /**
   * 執行全面的健康檢查
   */
  async performHealthCheck(): Promise<MonitorStats> {
    const timer = nowMs();
    this.logger.info('Starting comprehensive health check');

    try {
      // 並行檢查所有 DO 類型
      const results = await Promise.allSettled([
        this.checkConversationRooms(),
        this.checkUserConnections(),
        this.checkMessageBroadcaster(),
        this.checkDelayedMessageProcessor()
      ]);

      // 收集結果
      let totalChecked = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          totalChecked += result.value;
        } else {
          const types = ['ConversationRoom', 'UserConnection', 'MessageBroadcaster', 'DelayedMessageProcessor'];
          this.logger.error(`Health check failed for ${types[index]}`, result.reason);
        }
      });

      // 生成統計
      const stats = this.generateStats();

      const duration = Date.now() - timer;
      this.logger.performance('health_check_complete', duration, {
        totalInstances: stats.totalInstances,
        healthyInstances: stats.healthyInstances,
        activeAlerts: stats.activeAlerts
      });

      return stats;

    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }

  /**
   * 檢查 ConversationRoom 實例
   */
  private async checkConversationRooms(): Promise<number> {
    // 獲取活躍的 ConversationRoom 列表
    // 注意：Cloudflare DO 沒有直接列出所有實例的 API
    // 我們需要從其他來源獲取活躍會話列表（如 D1 數據庫）

    // 這裡使用 MessageBroadcaster 獲取已註冊的會話
    try {
      if (!this.env.MESSAGE_BROADCASTER) {
        this.logger.warn('MESSAGE_BROADCASTER binding not available');
        return 0;
      }

      const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

      const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/registered-conversations'));

      if (!response.ok) {
        this.logger.warn('Failed to get registered conversations', {
          status: response.status
        });
        return 0;
      }

      const data = await response.json() as { conversations: string[] };
      const conversationIds = data.conversations || [];

      // 檢查每個 ConversationRoom
      let checkedCount = 0;
      for (const conversationId of conversationIds) {
        try {
          await this.checkConversationRoom(conversationId);
          checkedCount++;
        } catch (error) {
          this.logger.error(`Failed to check ConversationRoom ${conversationId}`, error);
        }
      }

      return checkedCount;

    } catch (error) {
      this.logger.error('Failed to check ConversationRooms', error);
      return 0;
    }
  }

  /**
   * 檢查單個 ConversationRoom
   */
  private async checkConversationRoom(conversationId: string): Promise<void> {
    if (!this.env.CONVERSATION_ROOM) {
      return;
    }

    const roomId = this.env.CONVERSATION_ROOM.idFromName(conversationId);
    const roomStub = this.env.CONVERSATION_ROOM.get(roomId);

    try {
      const response = await this.callWithTimeout(
        roomStub.fetch(new Request('https://conversation-room/health')),
        5000 // 5 second timeout
      );

      if (!response.ok) {
        this.recordUnhealthyInstance('ConversationRoom', conversationId, 'health_check_failed');
        return;
      }

      const health = await response.json() as any;
      this.updateInstanceMetrics('ConversationRoom', conversationId, health);

    } catch (error) {
      this.logger.error(`ConversationRoom health check failed: ${conversationId}`, error);
      this.recordUnhealthyInstance('ConversationRoom', conversationId, 'timeout_or_error');
    }
  }

  /**
   * 檢查 UserConnection 實例
   */
  private async checkUserConnections(): Promise<number> {
    // 類似 ConversationRoom，從 MessageBroadcaster 獲取活躍用戶列表
    try {
      if (!this.env.MESSAGE_BROADCASTER) {
        return 0;
      }

      const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

      const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/registered-users'));

      if (!response.ok) {
        return 0;
      }

      const data = await response.json() as { users: string[] };
      const userIds = data.users || [];

      let checkedCount = 0;
      for (const userId of userIds) {
        try {
          await this.checkUserConnection(userId);
          checkedCount++;
        } catch (error) {
          this.logger.error(`Failed to check UserConnection ${userId}`, error);
        }
      }

      return checkedCount;

    } catch (error) {
      this.logger.error('Failed to check UserConnections', error);
      return 0;
    }
  }

  /**
   * 檢查單個 UserConnection
   */
  private async checkUserConnection(userId: string): Promise<void> {
    if (!this.env.USER_CONNECTION) {
      return;
    }

    const userConnectionId = this.env.USER_CONNECTION.idFromName(userId);
    const userConnectionStub = this.env.USER_CONNECTION.get(userConnectionId);

    try {
      const response = await this.callWithTimeout(
        userConnectionStub.fetch(new Request('https://user-connection/health')),
        5000
      );

      if (!response.ok) {
        this.recordUnhealthyInstance('UserConnection', userId, 'health_check_failed');
        return;
      }

      const health = await response.json() as any;
      this.updateInstanceMetrics('UserConnection', userId, health);

    } catch (error) {
      this.logger.error(`UserConnection health check failed: ${userId}`, error);
      this.recordUnhealthyInstance('UserConnection', userId, 'timeout_or_error');
    }
  }

  /**
   * 檢查 MessageBroadcaster
   */
  private async checkMessageBroadcaster(): Promise<number> {
    if (!this.env.MESSAGE_BROADCASTER) {
      return 0;
    }

    try {
      const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

      const response = await this.callWithTimeout(
        broadcasterStub.fetch(new Request('https://message-broadcaster/health')),
        5000
      );

      if (!response.ok) {
        this.recordUnhealthyInstance('MessageBroadcaster', 'global', 'health_check_failed');
        return 0;
      }

      const health = await response.json() as any;
      this.updateInstanceMetrics('MessageBroadcaster', 'global', health);
      return 1;

    } catch (error) {
      this.logger.error('MessageBroadcaster health check failed', error);
      this.recordUnhealthyInstance('MessageBroadcaster', 'global', 'timeout_or_error');
      return 0;
    }
  }

  /**
   * 檢查 DelayedMessageProcessor
   */
  private async checkDelayedMessageProcessor(): Promise<number> {
    // DelayedMessageProcessor 通常是按需創建的
    // 這裡先返回 0，實際實現需要根據業務邏輯調整
    return 0;
  }

  /**
   * 更新實例指標
   */
  private updateInstanceMetrics(
    objectType: 'ConversationRoom' | 'UserConnection' | 'MessageBroadcaster' | 'DelayedMessageProcessor',
    instanceId: string,
    healthData: any
  ): void {
    const key = `${objectType}:${instanceId}`;

    const metrics: DOInstanceMetrics = {
      objectType,
      instanceId,
      healthStatus: this.determineHealthStatus(healthData),
      activeConnections: healthData.activeConnections || 0,
      totalConnectionsServed: healthData.totalConnectionsServed || 0,
      connectionLimit: healthData.connectionLimit || 100,
      averageLatency: healthData.averageLatency || 0,
      requestsPerSecond: healthData.requestsPerSecond || 0,
      errorRate: healthData.errorRate || 0,
      memoryUsageMB: healthData.memoryUsageMB || 0,
      cpuUsagePercent: healthData.cpuUsagePercent || 0,
      lastHealthCheck: nowMs(),
      uptime: healthData.uptime || 0,
      lastActivity: healthData.lastActivity || nowMs(),
      alerts: []
    };

    // 檢測告警條件
    this.detectAlerts(metrics);

    // 保存指標
    this.instanceMetrics.set(key, metrics);

    // 記錄日誌
    this.logger.debug('Instance metrics updated', {
      durableObjectType: objectType,
      durableObjectId: instanceId,
      healthStatus: metrics.healthStatus,
      activeConnections: metrics.activeConnections,
      errorRate: metrics.errorRate
    });
  }

  /**
   * 確定健康狀態
   */
  private determineHealthStatus(healthData: any): DOHealthStatus {
    const errorRate = healthData.errorRate || 0;
    const latency = healthData.averageLatency || 0;
    const memoryUsage = healthData.memoryUsageMB || 0;

    if (errorRate > this.config.thresholds.errorRate * 2 ||
        latency > this.config.thresholds.latency * 3) {
      return DOHealthStatus.UNHEALTHY;
    }

    if (errorRate > this.config.thresholds.errorRate ||
        latency > this.config.thresholds.latency ||
        memoryUsage > this.config.thresholds.memoryUsage) {
      return DOHealthStatus.DEGRADED;
    }

    return DOHealthStatus.HEALTHY;
  }

  /**
   * 檢測告警條件
   */
  private detectAlerts(metrics: DOInstanceMetrics): void {
    const alerts: DOAlert[] = [];

    // 高錯誤率告警
    if (metrics.errorRate > this.config.thresholds.errorRate) {
      alerts.push({
        type: DOAlertType.HIGH_ERROR_RATE,
        severity: metrics.errorRate > this.config.thresholds.errorRate * 2 ? 'critical' : 'warning',
        message: `High error rate detected: ${(metrics.errorRate * 100).toFixed(2)}%`,
        timestamp: nowMs(),
        metadata: { errorRate: metrics.errorRate, threshold: this.config.thresholds.errorRate }
      });
    }

    // 高延遲告警
    if (metrics.averageLatency > this.config.thresholds.latency) {
      alerts.push({
        type: DOAlertType.HIGH_LATENCY,
        severity: metrics.averageLatency > this.config.thresholds.latency * 2 ? 'critical' : 'warning',
        message: `High latency detected: ${metrics.averageLatency}ms`,
        timestamp: nowMs(),
        metadata: { latency: metrics.averageLatency, threshold: this.config.thresholds.latency }
      });
    }

    // 高內存使用告警
    if (metrics.memoryUsageMB > this.config.thresholds.memoryUsage) {
      alerts.push({
        type: DOAlertType.HIGH_MEMORY,
        severity: 'warning',
        message: `High memory usage: ${metrics.memoryUsageMB}MB`,
        timestamp: nowMs(),
        metadata: { memoryUsage: metrics.memoryUsageMB, threshold: this.config.thresholds.memoryUsage }
      });
    }

    // 連接限制告警
    const connectionUtilization = metrics.activeConnections / metrics.connectionLimit;
    if (connectionUtilization > this.config.thresholds.connectionUtilization) {
      alerts.push({
        type: DOAlertType.CONNECTION_LIMIT,
        severity: connectionUtilization > 0.95 ? 'critical' : 'warning',
        message: `High connection utilization: ${(connectionUtilization * 100).toFixed(1)}%`,
        timestamp: nowMs(),
        metadata: { utilization: connectionUtilization, activeConnections: metrics.activeConnections, limit: metrics.connectionLimit }
      });
    }

    // 更新指標中的告警
    metrics.alerts = alerts;

    // 觸發告警處理
    if (alerts.length > 0 && this.config.alerts.enabled) {
      this.handleAlerts(metrics, alerts);
    }
  }

  /**
   * 處理告警
   */
  private handleAlerts(metrics: DOInstanceMetrics, alerts: DOAlert[]): void {
    const key = `${metrics.objectType}:${metrics.instanceId}`;

    // 檢查冷卻期
    const lastAlertTime = this.lastAlertTime.get(key) || 0;
    const now = nowMs();

    if (now - lastAlertTime < this.config.alerts.cooldownPeriod) {
      return; // 在冷卻期內，不發送新告警
    }

    // 記錄告警
    for (const alert of alerts) {
      this.alertHistory.push(alert);

      const context: LogContext = {
        durableObjectType: metrics.objectType,
        durableObjectId: metrics.instanceId
      };

      if (alert.severity === 'critical') {
        this.logger.critical(alert.message, undefined, context, alert.metadata);
      } else {
        this.logger.warn(alert.message, context, alert.metadata);
      }
    }

    // 更新最後告警時間
    this.lastAlertTime.set(key, now);

    // 清理舊告警（保留最近1小時）
    const oneHourAgo = now - 3600000;
    this.alertHistory = this.alertHistory.filter(a => a.timestamp > oneHourAgo);
  }

  /**
   * 記錄不健康實例
   */
  private recordUnhealthyInstance(
    objectType: string,
    instanceId: string,
    reason: string
  ): void {
    this.logger.error('Unhealthy DO instance detected', undefined, {
      durableObjectType: objectType as any,
      durableObjectId: instanceId,
      reason
    });

    // 創建告警
    const alert: DOAlert = {
      type: DOAlertType.INSTANCE_UNRESPONSIVE,
      severity: 'critical',
      message: `DO instance unresponsive: ${objectType}/${instanceId}`,
      timestamp: nowMs(),
      metadata: { reason }
    };

    this.alertHistory.push(alert);
  }

  /**
   * 生成統計數據
   */
  private generateStats(): MonitorStats {
    const stats: MonitorStats = {
      totalInstances: this.instanceMetrics.size,
      instancesByType: {},
      healthyInstances: 0,
      degradedInstances: 0,
      unhealthyInstances: 0,
      totalAlerts: this.alertHistory.length,
      activeAlerts: 0,
      lastUpdate: nowMs()
    };

    // 統計各類型實例數量和健康狀態
    for (const metrics of this.instanceMetrics.values()) {
      // 按類型統計
      stats.instancesByType[metrics.objectType] = (stats.instancesByType[metrics.objectType] || 0) + 1;

      // 按健康狀態統計
      switch (metrics.healthStatus) {
        case DOHealthStatus.HEALTHY:
          stats.healthyInstances++;
          break;
        case DOHealthStatus.DEGRADED:
          stats.degradedInstances++;
          break;
        case DOHealthStatus.UNHEALTHY:
          stats.unhealthyInstances++;
          break;
      }

      // 活躍告警數量
      if (metrics.alerts.length > 0) {
        stats.activeAlerts += metrics.alerts.length;
      }
    }

    return stats;
  }

  /**
   * 獲取所有實例指標
   */
  getInstanceMetrics(): DOInstanceMetrics[] {
    return Array.from(this.instanceMetrics.values());
  }

  /**
   * 獲取特定類型的實例指標
   */
  getInstanceMetricsByType(objectType: string): DOInstanceMetrics[] {
    return this.getInstanceMetrics().filter(m => m.objectType === objectType);
  }

  /**
   * 獲取告警歷史
   */
  getAlertHistory(limit: number = 100): DOAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 獲取活躍告警
   */
  getActiveAlerts(): DOAlert[] {
    const activeMetrics = this.getInstanceMetrics().filter(m => m.alerts.length > 0);
    const alerts: DOAlert[] = [];

    for (const metrics of activeMetrics) {
      alerts.push(...metrics.alerts);
    }

    return alerts;
  }

  /**
   * 調用帶超時的請求
   */
  private async callWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 清理過期數據
   */
  cleanup(): void {
    const now = nowMs();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    // 清理過期的實例指標
    for (const [key, metrics] of this.instanceMetrics.entries()) {
      if (now - metrics.lastHealthCheck > staleThreshold) {
        this.instanceMetrics.delete(key);
        this.logger.debug('Removed stale instance metrics', {
          durableObjectType: metrics.objectType,
          durableObjectId: metrics.instanceId
        });
      }
    }

    // 清理舊告警
    const oneHourAgo = now - 3600000;
    const oldLength = this.alertHistory.length;
    this.alertHistory = this.alertHistory.filter(a => a.timestamp > oneHourAgo);

    if (this.alertHistory.length < oldLength) {
      this.logger.debug('Cleaned up old alerts', {
        removed: oldLength - this.alertHistory.length
      });
    }
  }
}

/**
 * 創建監控服務實例
 */
export function createDOMonitor(env: Bindings, config?: Partial<MonitorConfig>): DurableObjectsMonitor {
  return new DurableObjectsMonitor(env, config);
}
