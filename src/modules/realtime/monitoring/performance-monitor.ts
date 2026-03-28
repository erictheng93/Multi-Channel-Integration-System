// Real-time 性能監控系統

import type { Bindings } from '@/types';
import type {
  EventType,
  EventPriority
} from '../types';
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('PerformanceMonitor')

// 性能指標定義
export interface PerformanceMetrics {
  // 連接指標
  connection: {
    totalConnections: number;
    averageConnectionDuration: number;
    connectionEstablishmentTime: number;
    connectionFailureRate: number;
    connectionsPerSecond: number;
  };

  // 事件處理指標
  events: {
    totalEventsProcessed: number;
    averageEventProcessingTime: number;
    eventProcessingRate: number;
    eventFailureRate: number;
    eventsByType: Record<EventType, number>;
    eventsByPriority: Record<EventPriority, number>;
  };

  // SSE 指標
  sse: {
    totalDataTransferred: number;
    averageResponseTime: number;
    heartbeatSuccessRate: number;
    sseErrorRate: number;
    activeStreams: number;
  };

  // 隊列指標
  queue: {
    queueDepth: number;
    averageQueueWaitTime: number;
    throughputPerSecond: number;
    queueErrorRate: number;
    retryRate: number;
  };

  // 資源使用指標
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    kvOperations: number;
    databaseOperations: number;
  };

  // 時間戳
  timestamp: string;
  collectionPeriod: number; // 收集期間（秒）
}

// 性能警報定義
export interface PerformanceAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: string;
  resolved?: boolean;
  resolvedAt?: string;
}

// 性能監控器
export class RealtimePerformanceMonitor {
  private static instance: RealtimePerformanceMonitor;
  private env?: Bindings;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private readonly maxMetricsHistory = 1000;
  private readonly maxAlertsHistory = 500;

  // 性能閾值配置
  private thresholds = {
    connectionFailureRate: 0.05, // 5%
    eventProcessingTime: 1000, // 1秒
    eventFailureRate: 0.02, // 2%
    sseErrorRate: 0.03, // 3%
    queueDepth: 1000, // 1000個事件
    averageQueueWaitTime: 5000, // 5秒
    heartbeatSuccessRate: 0.95 // 95%
  };

  static getInstance(): RealtimePerformanceMonitor {
    if (!RealtimePerformanceMonitor.instance) {
      RealtimePerformanceMonitor.instance = new RealtimePerformanceMonitor();
    }
    return RealtimePerformanceMonitor.instance;
  }

  // 初始化監控器
  initialize(env: Bindings, config?: {
    collectionInterval?: number;
    thresholds?: Partial<RealtimePerformanceMonitor['thresholds']>;
  }): void {
    this.env = env;

    if (config?.thresholds) {
      this.thresholds = { ...this.thresholds, ...config.thresholds };
    }

    log.info('Performance monitor initialized');
  }

  // 開始監控
  startMonitoring(intervalSeconds: number = 30): void {
    if (this.isMonitoring) {
      log.warn('Monitoring already running');
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        this.checkThresholds();
        this.cleanupOldData();
      } catch (error) {
        log.error('Monitoring collection error', {}, error instanceof Error ? error : String(error));
      }
    }, intervalSeconds * 1000);

    log.info('Monitoring started', { intervalSeconds });
  }

  // 停止監控
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;

    log.info('Monitoring stopped');
  }

  // 收集性能指標
  private async collectMetrics(): Promise<void> {
    const startTime = nowMs();

    try {
      // =================== WebSocket-based Connection Statistics ===================
      // Phase 4 Complete: All connection statistics now come from WebSocket architecture
      // See: src/handlers/websocket-health.ts -> /api/websocket/metrics
      //
      // SSE has been fully deprecated and removed. Connection stats are retrieved from:
      // 1. WebSocket handler metrics endpoint
      // 2. Durable Objects connection tracking
      // 3. Real-time connection state management
      let connectionStats: any = {
        totalConnections: 0,
        activeConnections: 0,
        connectionsByUser: {} as Record<number, number>,
        connectionsByRole: {} as Record<string, number>
      };

      try {
        // Attempt to fetch WebSocket metrics from the WebSocket health endpoint
        if (this.env && (this.env as any).WORKER_URL) {
          const wsMetricsUrl = `${(this.env as any).WORKER_URL}/api/websocket/metrics`;
          const response = await fetch(wsMetricsUrl, {
            headers: {
              'Authorization': `Bearer ${(this.env as any).ADMIN_TOKEN || ''}`
            }
          });

          if (response.ok) {
            const wsData = await response.json() as any;
            connectionStats = {
              totalConnections: wsData.connections?.totalConnections || 0,
              activeConnections: wsData.connections?.activeConnections || 0,
              connectionsByUser: wsData.connections?.connectionsByUser || {},
              connectionsByRole: wsData.connections?.connectionsByRole || {}
            };
          } else {
            log.warn('Failed to fetch WebSocket metrics', { status: response.status });
          }
        }
      } catch (error) {
        // WebSocket metrics unavailable (test environment or initialization) - use defaults
        log.warn('WebSocket metrics unavailable, using defaults', { error: error instanceof Error ? error.message : String(error) });
      }

      // 收集事件統計
      const { eventStats } = await import('../handlers/event-handler');
      const eventStatsData = eventStats.getStats();

      // 收集隊列統計（如果可用）
      let queueStats: any = {};
      try {
        const { RealtimeManager } = await import('../services/realtime-manager');
        const manager = RealtimeManager.getInstance();
        const comprehensiveStats = await manager.getComprehensiveStats();
        queueStats = comprehensiveStats.queue || {};
      } catch (error) {
        // 隊列統計可能不可用
      }

      // 計算連接指標 (基於 WebSocket 統計)
      const connectionMetrics = {
        totalConnections: connectionStats.totalConnections || 0,
        averageConnectionDuration: this.calculateAverageConnectionDuration(connectionStats),
        connectionEstablishmentTime: 0, // 需要額外追蹤
        connectionFailureRate: 0, // 需要額外追蹤
        connectionsPerSecond: this.calculateConnectionsPerSecond()
      };

      // 計算事件指標
      const eventMetrics = {
        totalEventsProcessed: eventStatsData.totalEvents,
        averageEventProcessingTime: eventStatsData.averageProcessingTime,
        eventProcessingRate: this.calculateEventProcessingRate(eventStatsData),
        eventFailureRate: eventStatsData.errorRate,
        eventsByType: eventStatsData.eventsByType,
        eventsByPriority: eventStatsData.eventsByPriority
      };

      // 計算 WebSocket 連接指標 (替代舊的 SSE 指標)
      const websocketMetrics = {
        totalDataTransferred: 0, // 需要從 WebSocket metrics 獲取
        averageResponseTime: 0, // 需要額外追蹤
        heartbeatSuccessRate: this.calculateHeartbeatSuccessRate(),
        sseErrorRate: 0, // 需要額外追蹤 (renamed from errorRate for interface compatibility)
        activeStreams: connectionStats.activeConnections || 0 // renamed from activeConnections for interface compatibility
      };

      // 計算隊列指標
      const queueMetrics = {
        queueDepth: queueStats.queueDepth || 0,
        averageQueueWaitTime: queueStats.averageProcessingTime || 0,
        throughputPerSecond: queueStats.throughputPerSecond || 0,
        queueErrorRate: queueStats.errorRate || 0,
        retryRate: queueStats.retryRate || 0
      };

      // 計算資源指標
      const resourceMetrics = {
        memoryUsage: 0, // Worker 環境中難以獲取
        cpuUsage: 0, // Worker 環境中難以獲取
        kvOperations: 0, // 需要額外追蹤
        databaseOperations: 0 // 需要額外追蹤
      };

      const metrics: PerformanceMetrics = {
        connection: connectionMetrics,
        events: eventMetrics,
        sse: websocketMetrics, // Renamed from sseMetrics but kept property name for backward compatibility
        queue: queueMetrics,
        resources: resourceMetrics,
        timestamp: nowISO(),
        collectionPeriod: 30 // 預設收集期間
      };

      this.metrics.push(metrics);

      log.debug('Metrics collected', {
        connections: connectionMetrics.totalConnections,
        events: eventMetrics.totalEventsProcessed,
        processingTime: eventMetrics.averageEventProcessingTime,
        collectionTime: Date.now() - startTime
      });

    } catch (error) {
      log.error('Metrics collection failed', {}, error instanceof Error ? error : String(error));
    }
  }

  // 檢查閾值並生成警報
  private checkThresholds(): void {
    if (this.metrics.length === 0) return;

    const latestMetrics = this.metrics[this.metrics.length - 1];
    const newAlerts: PerformanceAlert[] = [];

    // 檢查連接失敗率
    if (latestMetrics.connection.connectionFailureRate > this.thresholds.connectionFailureRate) {
      newAlerts.push(this.createAlert(
        'error',
        'connection_failure_rate',
        this.thresholds.connectionFailureRate,
        latestMetrics.connection.connectionFailureRate,
        `連接失敗率過高: ${(latestMetrics.connection.connectionFailureRate * 100).toFixed(2)}%`
      ));
    }

    // 檢查事件處理時間
    if (latestMetrics.events.averageEventProcessingTime > this.thresholds.eventProcessingTime) {
      newAlerts.push(this.createAlert(
        'warning',
        'event_processing_time',
        this.thresholds.eventProcessingTime,
        latestMetrics.events.averageEventProcessingTime,
        `事件處理時間過長: ${latestMetrics.events.averageEventProcessingTime.toFixed(2)}ms`
      ));
    }

    // 檢查事件失敗率
    if (latestMetrics.events.eventFailureRate > this.thresholds.eventFailureRate) {
      newAlerts.push(this.createAlert(
        'error',
        'event_failure_rate',
        this.thresholds.eventFailureRate,
        latestMetrics.events.eventFailureRate,
        `事件失敗率過高: ${(latestMetrics.events.eventFailureRate * 100).toFixed(2)}%`
      ));
    }

    // 檢查隊列深度
    if (latestMetrics.queue.queueDepth > this.thresholds.queueDepth) {
      newAlerts.push(this.createAlert(
        'warning',
        'queue_depth',
        this.thresholds.queueDepth,
        latestMetrics.queue.queueDepth,
        `隊列深度過高: ${latestMetrics.queue.queueDepth}`
      ));
    }

    // 檢查心跳成功率
    if (latestMetrics.sse.heartbeatSuccessRate < this.thresholds.heartbeatSuccessRate) {
      newAlerts.push(this.createAlert(
        'warning',
        'heartbeat_success_rate',
        this.thresholds.heartbeatSuccessRate,
        latestMetrics.sse.heartbeatSuccessRate,
        `心跳成功率過低: ${(latestMetrics.sse.heartbeatSuccessRate * 100).toFixed(2)}%`
      ));
    }

    // 添加新警報
    this.alerts.push(...newAlerts);

    if (newAlerts.length > 0) {
      log.warn('Performance alerts detected', {
        alertCount: newAlerts.length,
        alerts: newAlerts.map(a => ({ level: a.level, metric: a.metric, message: a.message }))
      });
    }
  }

  // 創建警報
  private createAlert(
    level: PerformanceAlert['level'],
    metric: string,
    threshold: number,
    currentValue: number,
    message: string
  ): PerformanceAlert {
    return {
      id: `alert-${nowMs()}-${Math.random().toString(36).substring(2)}`,
      level,
      metric,
      threshold,
      currentValue,
      message,
      timestamp: nowISO()
    };
  }

  // 清理舊數據
  private cleanupOldData(): void {
    // 清理舊指標
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // 清理舊警報
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }
  }

  // 獲取最新指標
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  // 獲取指標歷史
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit && limit > 0) {
      return this.metrics.slice(-limit);
    }
    return [...this.metrics];
  }

  // 獲取活躍警報
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  // 獲取所有警報
  getAllAlerts(limit?: number): PerformanceAlert[] {
    const alerts = [...this.alerts];
    if (limit && limit > 0) {
      return alerts.slice(-limit);
    }
    return alerts;
  }

  // 解決警報
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = nowISO();
      log.info('Alert resolved', { alertId });
      return true;
    }
    return false;
  }

  // 獲取性能摘要
  getPerformanceSummary(): {
    overview: {
      isHealthy: boolean;
      activeAlerts: number;
      totalConnections: number;
      eventsPerSecond: number;
    };
    trends: {
      connectionTrend: 'up' | 'down' | 'stable';
      performanceTrend: 'improving' | 'degrading' | 'stable';
    };
    recommendations: string[];
  } {
    const latestMetrics = this.getLatestMetrics();
    const activeAlerts = this.getActiveAlerts();
    const metricsHistory = this.getMetricsHistory(10);

    const overview = {
      isHealthy: activeAlerts.filter(a => a.level === 'error' || a.level === 'critical').length === 0,
      activeAlerts: activeAlerts.length,
      totalConnections: latestMetrics?.connection.totalConnections || 0,
      eventsPerSecond: latestMetrics?.events.eventProcessingRate || 0
    };

    // 計算趨勢
    const connectionTrend = this.calculateTrend(
      metricsHistory.map(m => m.connection.totalConnections)
    );
    const rawPerformanceTrend = this.calculateTrend(
      metricsHistory.map(m => m.events.averageEventProcessingTime),
      true // 反向趨勢（處理時間越低越好）
    );
    const performanceTrend: 'improving' | 'degrading' | 'stable' =
      rawPerformanceTrend === 'up' ? 'improving' :
      rawPerformanceTrend === 'down' ? 'degrading' : 'stable';

    const trends = { connectionTrend, performanceTrend };

    // 生成建議
    const recommendations = this.generateRecommendations(latestMetrics, activeAlerts);

    return { overview, trends, recommendations };
  }

  // 計算趨勢
  private calculateTrend(values: number[], reverse = false): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-3);
    const earlier = values.slice(-6, -3);

    if (recent.length === 0 || earlier.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    const change = recentAvg - earlierAvg;
    const threshold = earlierAvg * 0.1; // 10% 閾值

    if (Math.abs(change) < threshold) return 'stable';

    const trend = change > 0 ? 'up' : 'down';
    return reverse ? (trend === 'up' ? 'down' : 'up') : trend;
  }

  // 生成建議
  private generateRecommendations(
    metrics: PerformanceMetrics | null,
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];

    if (!metrics) return recommendations;

    // 基於警報的建議
    if (alerts.some(a => a.metric === 'event_processing_time')) {
      recommendations.push('考慮優化事件處理邏輯或增加處理能力');
    }

    if (alerts.some(a => a.metric === 'queue_depth')) {
      recommendations.push('檢查隊列處理器的性能，可能需要增加並行處理');
    }

    if (alerts.some(a => a.metric === 'connection_failure_rate')) {
      recommendations.push('檢查網路連接穩定性和認證邏輯');
    }

    // 基於指標的建議
    if (metrics.connection.totalConnections > 100) {
      recommendations.push('連接數較高，建議監控資源使用情況');
    }

    if (metrics.events.eventFailureRate > 0.01) {
      recommendations.push('事件失敗率偏高，建議檢查錯誤日誌');
    }

    return recommendations;
  }

  // 工具方法
  private calculateAverageConnectionDuration(_stats: any): number {
    // 這裡需要額外的連接持續時間追蹤
    // WebSocket 架構下可以從 Durable Objects 獲取連接持續時間
    return 0;
  }

  private calculateConnectionsPerSecond(): number {
    // 這裡需要額外的連接速率追蹤
    return 0;
  }

  private calculateEventProcessingRate(eventStats: any): number {
    // 基於總事件數計算處理速率
    return eventStats.totalEvents / 60; // 假設過去一分鐘
  }

  private calculateHeartbeatSuccessRate(): number {
    // 這裡需要額外的心跳成功率追蹤
    return 0.98; // 預設值
  }
}
