/**
 * Performance Monitor
 * 專案名稱：Multi-Channel Support MVP - Production Monitoring
 *
 * Real-time performance monitoring and alerting for WebSocket + Durable Objects
 * Tracks system health, performance metrics, and triggers alerts
 */

import type { Bindings } from '../types';
import type {
  PerformanceMetrics,
  SystemHealth,
  MetricThreshold,
  AlertNotification,
  MonitoringAlert
} from '../types/monitoring-types';
import { nowMs } from '@/utils/timestamp'

// =================== Configuration ===================

interface PerformanceMonitorConfig {
  monitoringIntervalMs: number;
  metricsRetentionHours: number;
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
    slackChannel?: string;
  };
  thresholds: {
    latency: MetricThreshold;
    throughput: MetricThreshold;
    errorRate: MetricThreshold;
    memoryUsage: MetricThreshold;
    connectionCount: MetricThreshold;
  };
  sampling: {
    enabled: boolean;
    rate: number; // 0.0 to 1.0
  };
}

const DEFAULT_MONITOR_CONFIG: PerformanceMonitorConfig = {
  monitoringIntervalMs: 10000, // 10 seconds
  metricsRetentionHours: 24,
  alerting: {
    enabled: true
  },
  thresholds: {
    latency: { warning: 500, critical: 1000, unit: 'ms' },
    throughput: { warning: 50, critical: 25, unit: 'ops/s' },
    errorRate: { warning: 0.05, critical: 0.1, unit: 'ratio' },
    memoryUsage: { warning: 80, critical: 95, unit: 'percent' },
    connectionCount: { warning: 8000, critical: 9500, unit: 'count' }
  },
  sampling: {
    enabled: true,
    rate: 0.1 // 10% sampling
  }
};

// =================== Performance Monitor ===================

export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private env: Bindings;
  private isRunning: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Metrics storage
  private recentMetrics: PerformanceMetrics[] = [];
  private aggregatedMetrics: Map<string, number> = new Map();
  private activeAlerts: Map<string, AlertNotification> = new Map();

  // Performance tracking
  private lastMetricsCollection: number = 0;
  private systemStartTime: number = nowMs();

  constructor(env: Bindings, config: Partial<PerformanceMonitorConfig> = {}) {
    this.env = env;
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config };
  }

  // =================== Public API ===================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[PerformanceMonitor] Monitor already running');
      return;
    }

    console.log('[PerformanceMonitor] Starting performance monitoring');
    this.isRunning = true;
    this.lastMetricsCollection = nowMs();

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      await this.collectAndAnalyzeMetrics();
    }, this.config.monitoringIntervalMs);

    // Initial metrics collection
    await this.collectAndAnalyzeMetrics();

    console.log('[PerformanceMonitor] Performance monitoring started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[PerformanceMonitor] Stopping performance monitoring');
    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Send final metrics to storage
    await this.persistMetrics();

    console.log('[PerformanceMonitor] Performance monitoring stopped');
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const currentMetrics = await this.getCurrentMetrics();
    const health = this.calculateSystemHealth(currentMetrics);

    return {
      status: health.status,
      score: health.score,
      metrics: currentMetrics,
      alerts: this.convertAlertsToMonitoringAlerts(Array.from(this.activeAlerts.values())),
      uptime: Date.now() - this.systemStartTime,
      lastUpdated: nowMs()
    };
  }

  async getHistoricalMetrics(timeRangeHours: number = 1): Promise<PerformanceMetrics[]> {
    const cutoffTime = Date.now() - (timeRangeHours * 60 * 60 * 1000);
    return this.recentMetrics.filter(metric => metric.timestamp >= cutoffTime);
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = nowMs();
      console.log(`[PerformanceMonitor] Alert acknowledged: ${alertId}`);
    }
  }

  // =================== Metrics Collection ===================

  private async collectAndAnalyzeMetrics(): Promise<void> {
    try {
      const startTime = performance.now();

      // Collect metrics from all system components
      const metrics = await this.getCurrentMetrics();

      // Store metrics
      this.storeMetrics(metrics);

      // Analyze metrics and check thresholds
      await this.analyzeMetrics(metrics);

      // Clean up old metrics
      this.cleanupOldMetrics();

      const collectionTime = performance.now() - startTime;
      console.log(`[PerformanceMonitor] Metrics collected in ${collectionTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('[PerformanceMonitor] Error collecting metrics:', error);
    }
  }

  private async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const timestamp = nowMs();

    // Collect WebSocket metrics
    const websocketMetrics = await this.collectWebSocketMetrics();

    // Collect Durable Objects metrics
    const durableObjectMetrics = await this.collectDurableObjectMetrics();

    // Collect System metrics
    const systemMetrics = await this.collectSystemMetrics();

    // Collect Message processing metrics
    const messageMetrics = await this.collectMessageMetrics();

    // SSE has been fully deprecated and replaced with WebSocket architecture
    // All connection statistics are now tracked via WebSocket metrics
    return {
      timestamp,
      websocket: websocketMetrics,
      // sse: Removed - fully replaced by WebSocket architecture (Phase 4 Complete)
      system: systemMetrics,
      durableObjects: durableObjectMetrics,
      messaging: messageMetrics,
      aggregated: {
        overallLatency: this.calculateOverallLatency([websocketMetrics, durableObjectMetrics, messageMetrics]),
        totalThroughput: websocketMetrics.throughput + messageMetrics.throughput,
        overallErrorRate: this.calculateOverallErrorRate([websocketMetrics, durableObjectMetrics, messageMetrics]),
        systemLoad: systemMetrics.cpuUsage + systemMetrics.memoryUsage
      },
      comparison: {
        // These values can be populated from historical data or removed
        latencyImprovement: 0,
        throughputIncrease: 0,
        reliabilityGain: 0
      }
    };
  }

  private async collectWebSocketMetrics(): Promise<any> {
    try {
      // Get metrics from WebSocket handler
      const response = await fetch(`${this.getWorkerUrl()}/api/websocket/metrics`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as any; // Type assertion for API response

      return {
        activeConnections: data.connections?.activeConnections || 0,
        totalConnections: data.connections?.totalConnections || 0,
        connectionsPerSecond: data.connections?.connectionsByType?.websocket || 0,
        averageLatency: data.connections?.averageLatency || 0,
        throughput: data.connections?.messagesThroughput?.outbound || 0,
        errorRate: data.connections?.errorRate || 0,
        connectionsByRole: data.connections?.connectionsByRole || {},
        lastUpdated: nowMs()
      };
    } catch (error) {
      console.error('[PerformanceMonitor] WebSocket metrics collection failed:', error);
      return this.getDefaultWebSocketMetrics();
    }
  }

  private async collectDurableObjectMetrics(): Promise<any> {
    try {
      // Collect metrics from MessageBroadcaster
      const broadcasterResponse = await fetch(`${this.getWorkerUrl()}/api/message-broadcaster/metrics`, {
        headers: this.getAuthHeaders()
      });

      let broadcasterMetrics: any = {};
      if (broadcasterResponse.ok) {
        broadcasterMetrics = await broadcasterResponse.json();
      }

      // Sample metrics from a few ConversationRooms
      const roomMetrics = await this.sampleConversationRoomMetrics();

      return {
        messageBroadcaster: {
          eventsPerSecond: broadcasterMetrics.eventsPerSecond || 0,
          queueDepth: broadcasterMetrics.eventQueueDepth || 0,
          deliverySuccessRate: (broadcasterMetrics.successfulDeliveries || 0) / Math.max(1, broadcasterMetrics.totalEvents || 1),
          averageLatency: broadcasterMetrics.averageLatency || 0,
          activeConnections: broadcasterMetrics.activeConnections || 0
        },
        conversationRooms: {
          sampleSize: roomMetrics.length,
          averageParticipants: roomMetrics.reduce((sum, m) => sum + (m.participants || 0), 0) / Math.max(1, roomMetrics.length),
          averageMessagesPerRoom: roomMetrics.reduce((sum, m) => sum + (m.messageHistory || 0), 0) / Math.max(1, roomMetrics.length),
          totalRoomsActive: roomMetrics.filter(m => m.isActive).length
        },
        overallHealth: this.calculateDurableObjectHealth(roomMetrics),
        lastUpdated: nowMs()
      };
    } catch (error) {
      console.error('[PerformanceMonitor] Durable Objects metrics collection failed:', error);
      return this.getDefaultDurableObjectMetrics();
    }
  }

  private async sampleConversationRoomMetrics(): Promise<any[]> {
    const sampleRooms = ['room_1', 'room_2', 'room_3', 'room_4', 'room_5'];
    const metrics = [];

    for (const roomId of sampleRooms) {
      try {
        const response = await fetch(`${this.getWorkerUrl()}/api/conversation-rooms/${roomId}/metrics`, {
          headers: this.getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          metrics.push(data);
        }
      } catch (error) {
        // Ignore individual room errors
      }
    }

    return metrics;
  }

  private async collectSystemMetrics(): Promise<any> {
    try {
      // In a real Cloudflare Worker environment, these would come from
      // Worker Analytics API or custom tracking
      return {
        cpuUsage: Math.random() * 100, // Placeholder - would be real CPU usage
        memoryUsage: Math.random() * 100, // Placeholder - would be real memory usage
        requestsPerSecond: this.calculateRequestsPerSecond(),
        workerInvocations: this.getWorkerInvocations(),
        edgeLocations: this.getActiveEdgeLocations(),
        lastUpdated: nowMs()
      };
    } catch (error) {
      console.error('[PerformanceMonitor] System metrics collection failed:', error);
      return this.getDefaultSystemMetrics();
    }
  }

  private async collectMessageMetrics(): Promise<any> {
    try {
      // Collect metrics from message processing systems
      const delayedMessagesResponse = await fetch(`${this.getWorkerUrl()}/api/delayed-messages/metrics`, {
        headers: this.getAuthHeaders()
      });

      let delayedMetrics: any = {};
      if (delayedMessagesResponse.ok) {
        delayedMetrics = await delayedMessagesResponse.json();
      }

      return {
        totalMessages: delayedMetrics.totalScheduled || 0,
        messagesPerSecond: delayedMetrics.processingRate || 0,
        averageProcessingTime: delayedMetrics.averageProcessingTime || 0,
        queueDepth: delayedMetrics.queueDepth || 0,
        successRate: delayedMetrics.successRate || 1,
        throughput: delayedMetrics.processingRate || 0,
        errorRate: 1 - (delayedMetrics.successRate || 1),
        lastUpdated: nowMs()
      };
    } catch (error) {
      console.error('[PerformanceMonitor] Message metrics collection failed:', error);
      return this.getDefaultMessageMetrics();
    }
  }

  // =================== Metrics Analysis ===================

  private async analyzeMetrics(metrics: PerformanceMetrics): Promise<void> {
    // Check each threshold
    await this.checkLatencyThresholds(metrics);
    await this.checkThroughputThresholds(metrics);
    await this.checkErrorRateThresholds(metrics);
    await this.checkMemoryThresholds(metrics);
    await this.checkConnectionThresholds(metrics);

    // Check for anomalies
    await this.detectAnomalies(metrics);

    // Update aggregated metrics
    this.updateAggregatedMetrics(metrics);
  }

  private async checkLatencyThresholds(metrics: PerformanceMetrics): Promise<void> {
    const latency = metrics.aggregated.overallLatency;
    const threshold = this.config.thresholds.latency;

    if (latency >= threshold.critical) {
      await this.triggerAlert('latency_critical', {
        message: `Critical latency detected: ${latency}ms (threshold: ${threshold.critical}ms)`,
        severity: 'critical',
        metric: 'latency',
        value: latency,
        threshold: threshold.critical
      });
    } else if (latency >= threshold.warning) {
      await this.triggerAlert('latency_warning', {
        message: `High latency detected: ${latency}ms (threshold: ${threshold.warning}ms)`,
        severity: 'warning',
        metric: 'latency',
        value: latency,
        threshold: threshold.warning
      });
    } else {
      await this.resolveAlert('latency_critical');
      await this.resolveAlert('latency_warning');
    }
  }

  private async checkThroughputThresholds(metrics: PerformanceMetrics): Promise<void> {
    const throughput = metrics.aggregated.totalThroughput;
    const threshold = this.config.thresholds.throughput;

    if (throughput <= threshold.critical) {
      await this.triggerAlert('throughput_critical', {
        message: `Critical low throughput: ${throughput} ops/s (threshold: ${threshold.critical} ops/s)`,
        severity: 'critical',
        metric: 'throughput',
        value: throughput,
        threshold: threshold.critical
      });
    } else if (throughput <= threshold.warning) {
      await this.triggerAlert('throughput_warning', {
        message: `Low throughput detected: ${throughput} ops/s (threshold: ${threshold.warning} ops/s)`,
        severity: 'warning',
        metric: 'throughput',
        value: throughput,
        threshold: threshold.warning
      });
    } else {
      await this.resolveAlert('throughput_critical');
      await this.resolveAlert('throughput_warning');
    }
  }

  private async checkErrorRateThresholds(metrics: PerformanceMetrics): Promise<void> {
    const errorRate = metrics.aggregated.overallErrorRate;
    const threshold = this.config.thresholds.errorRate;

    if (errorRate >= threshold.critical) {
      await this.triggerAlert('error_rate_critical', {
        message: `Critical error rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${(threshold.critical * 100)}%)`,
        severity: 'critical',
        metric: 'errorRate',
        value: errorRate,
        threshold: threshold.critical
      });
    } else if (errorRate >= threshold.warning) {
      await this.triggerAlert('error_rate_warning', {
        message: `High error rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${(threshold.warning * 100)}%)`,
        severity: 'warning',
        metric: 'errorRate',
        value: errorRate,
        threshold: threshold.warning
      });
    } else {
      await this.resolveAlert('error_rate_critical');
      await this.resolveAlert('error_rate_warning');
    }
  }

  private async checkMemoryThresholds(metrics: PerformanceMetrics): Promise<void> {
    const memoryUsage = metrics.system.memoryUsage;
    const threshold = this.config.thresholds.memoryUsage;

    if (memoryUsage >= threshold.critical) {
      await this.triggerAlert('memory_critical', {
        message: `Critical memory usage: ${memoryUsage.toFixed(1)}% (threshold: ${threshold.critical}%)`,
        severity: 'critical',
        metric: 'memoryUsage',
        value: memoryUsage,
        threshold: threshold.critical
      });
    } else if (memoryUsage >= threshold.warning) {
      await this.triggerAlert('memory_warning', {
        message: `High memory usage: ${memoryUsage.toFixed(1)}% (threshold: ${threshold.warning}%)`,
        severity: 'warning',
        metric: 'memoryUsage',
        value: memoryUsage,
        threshold: threshold.warning
      });
    } else {
      await this.resolveAlert('memory_critical');
      await this.resolveAlert('memory_warning');
    }
  }

  private async checkConnectionThresholds(metrics: PerformanceMetrics): Promise<void> {
    const connectionCount = metrics.websocket.activeConnections;
    const threshold = this.config.thresholds.connectionCount;

    if (connectionCount >= threshold.critical) {
      await this.triggerAlert('connections_critical', {
        message: `Critical connection count: ${connectionCount} (threshold: ${threshold.critical})`,
        severity: 'critical',
        metric: 'connectionCount',
        value: connectionCount,
        threshold: threshold.critical
      });
    } else if (connectionCount >= threshold.warning) {
      await this.triggerAlert('connections_warning', {
        message: `High connection count: ${connectionCount} (threshold: ${threshold.warning})`,
        severity: 'warning',
        metric: 'connectionCount',
        value: connectionCount,
        threshold: threshold.warning
      });
    } else {
      await this.resolveAlert('connections_critical');
      await this.resolveAlert('connections_warning');
    }
  }

  private async detectAnomalies(metrics: PerformanceMetrics): Promise<void> {
    // Simple anomaly detection based on recent metrics
    if (this.recentMetrics.length < 10) return; // Need sufficient history

    const recentLatencies = this.recentMetrics.slice(-10).map(m => m.aggregated.overallLatency);
    const currentLatency = metrics.aggregated.overallLatency;

    const averageLatency = recentLatencies.reduce((sum, l) => sum + l, 0) / recentLatencies.length;
    const latencyDeviation = Math.abs(currentLatency - averageLatency);

    // If current latency is significantly higher than recent average
    if (latencyDeviation > averageLatency * 2 && currentLatency > 100) {
      await this.triggerAlert('latency_anomaly', {
        message: `Latency anomaly detected: ${currentLatency}ms vs recent average ${averageLatency.toFixed(1)}ms`,
        severity: 'warning',
        metric: 'latency',
        value: currentLatency,
        context: { averageLatency, deviation: latencyDeviation }
      });
    }
  }

  // =================== Alerting ===================

  private async triggerAlert(alertId: string, alertData: any): Promise<void> {
    // Check if alert is already active
    if (this.activeAlerts.has(alertId)) {
      // Update existing alert
      const existingAlert = this.activeAlerts.get(alertId)!;
      existingAlert.count = (existingAlert.count || 0) + 1;
      existingAlert.lastTriggered = nowMs();
      existingAlert.data = alertData;
      return;
    }

    // Create new alert
    const alert: AlertNotification = {
      id: alertId,
      title: alertData.message,
      description: alertData.message,
      message: alertData.message,
      severity: alertData.severity,
      alertStatus: 'active',
      category: 'performance',
      source: 'performance-monitor',
      metric: alertData.metric,
      value: alertData.value,
      threshold: alertData.threshold,
      triggeredAt: nowMs(),
      lastTriggered: nowMs(),
      count: 1,
      acknowledged: false,
      data: alertData,
      createdAt: nowMs(),
      // Required notification properties
      alert: {
        id: alertId,
        title: alertData.message || 'Performance Alert',
        description: alertData.message || 'Performance threshold exceeded',
        severity: alertData.severity,
        status: 'active',
        category: 'performance',
        source: 'performance-monitor',
        metric: alertData.metric,
        threshold: alertData.threshold,
        currentValue: alertData.value,
        createdAt: nowMs()
      },
      channels: (this.config.alerting as any).channels || ['default'],
      sentAt: nowMs(),
      status: 'pending'
    };

    this.activeAlerts.set(alertId, alert);

    // Send alert notification
    if (this.config.alerting.enabled) {
      await this.sendAlertNotification(alert);
    }

    console.warn(`[PerformanceMonitor] Alert triggered: ${alertId} - ${alertData.message}`);
  }

  private async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      this.activeAlerts.delete(alertId);

      if (this.config.alerting.enabled) {
        await this.sendAlertResolution(alert);
      }

      console.log(`[PerformanceMonitor] Alert resolved: ${alertId}`);
    }
  }

  private async sendAlertNotification(alert: AlertNotification): Promise<void> {
    try {
      const payload = {
        alert,
        timestamp: nowMs(),
        system: 'WebSocket Performance Monitor',
        environment: this.env.ENVIRONMENT || 'production'
      };

      // Send to webhook if configured
      if (this.config.alerting.webhookUrl) {
        await fetch(this.config.alerting.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      // Store alert in KV for persistence
      await this.env.SESSIONS.put(`alert:${alert.id}`, JSON.stringify(alert), {
        expirationTtl: 86400 // 24 hours
      });

    } catch (error) {
      console.error('[PerformanceMonitor] Failed to send alert notification:', error);
    }
  }

  private async sendAlertResolution(alert: AlertNotification): Promise<void> {
    try {
      const payload = {
        type: 'resolution',
        alert,
        resolvedAt: nowMs(),
        system: 'WebSocket Performance Monitor'
      };

      if (this.config.alerting.webhookUrl) {
        await fetch(this.config.alerting.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      // Remove from KV storage
      await this.env.SESSIONS.delete(`alert:${alert.id}`);

    } catch (error) {
      console.error('[PerformanceMonitor] Failed to send alert resolution:', error);
    }
  }

  // =================== Utility Methods ===================

  private storeMetrics(metrics: PerformanceMetrics): void {
    this.recentMetrics.push(metrics);

    // Limit memory usage by keeping only recent metrics
    const maxMetrics = Math.floor(this.config.metricsRetentionHours * 60 * 60 * 1000 / this.config.monitoringIntervalMs);
    if (this.recentMetrics.length > maxMetrics) {
      this.recentMetrics.shift();
    }
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);
    this.recentMetrics = this.recentMetrics.filter(metric => metric.timestamp >= cutoffTime);
  }

  private updateAggregatedMetrics(metrics: PerformanceMetrics): void {
    this.aggregatedMetrics.set('latency', metrics.aggregated.overallLatency);
    this.aggregatedMetrics.set('throughput', metrics.aggregated.totalThroughput);
    this.aggregatedMetrics.set('errorRate', metrics.aggregated.overallErrorRate);
    this.aggregatedMetrics.set('connections', metrics.websocket.activeConnections);
    this.aggregatedMetrics.set('memoryUsage', metrics.system.memoryUsage);
  }

  private calculateSystemHealth(metrics: PerformanceMetrics): { status: 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown'; score: number } {
    let score = 100;
    let status: 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown' = 'healthy';

    // Deduct points for each issue
    if (metrics.aggregated.overallLatency > this.config.thresholds.latency.warning) {
      score -= 20;
    }
    if (metrics.aggregated.totalThroughput < this.config.thresholds.throughput.warning) {
      score -= 15;
    }
    if (metrics.aggregated.overallErrorRate > this.config.thresholds.errorRate.warning) {
      score -= 25;
    }
    if (metrics.system.memoryUsage > this.config.thresholds.memoryUsage.warning) {
      score -= 15;
    }
    if (metrics.websocket.activeConnections > this.config.thresholds.connectionCount.warning) {
      score -= 10;
    }

    // Determine status
    if (score >= 80) status = 'healthy';
    else if (score >= 60) status = 'degraded';
    else if (score >= 40) status = 'warning';
    else status = 'critical';

    return { status, score };
  }

  private calculateOverallLatency(componentMetrics: any[]): number {
    const latencies = componentMetrics.map(m => m.averageLatency || 0).filter(l => l > 0);
    return latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
  }

  private calculateOverallErrorRate(componentMetrics: any[]): number {
    const errorRates = componentMetrics.map(m => m.errorRate || 0);
    return errorRates.reduce((sum, rate) => sum + rate, 0) / Math.max(1, errorRates.length);
  }

  private calculateDurableObjectHealth(roomMetrics: any[]): number {
    if (roomMetrics.length === 0) return 0;
    const activeRooms = roomMetrics.filter(m => m.isActive).length;
    return (activeRooms / roomMetrics.length) * 100;
  }

  private async persistMetrics(): Promise<void> {
    try {
      const recentMetrics = this.recentMetrics.slice(-10); // Keep last 10 metrics
      await this.env.SESSIONS.put('performance_metrics', JSON.stringify(recentMetrics), {
        expirationTtl: 86400 // 24 hours
      });
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to persist metrics:', error);
    }
  }

  // =================== Helper Methods ===================

  private convertAlertsToMonitoringAlerts(alertNotifications: AlertNotification[]): MonitoringAlert[] {
    return alertNotifications.map(alert => {
      const monitoringAlert: MonitoringAlert = {
        id: alert.id,
        title: alert.title || alert.message || 'Alert',
        description: alert.description || alert.message || 'Alert description',
        severity: alert.severity,
        status: alert.acknowledged ? 'acknowledged' : 'active',
        category: alert.category || 'performance',
        source: alert.source || 'performance-monitor',
        createdAt: alert.createdAt || alert.triggeredAt || nowMs()
      };

      // Add optional properties only if they exist
      if (alert.metric) monitoringAlert.metric = alert.metric;
      if (alert.threshold !== undefined) monitoringAlert.threshold = alert.threshold;
      if (alert.value !== undefined) monitoringAlert.currentValue = alert.value;
      if (alert.acknowledgedAt) monitoringAlert.acknowledgedAt = alert.acknowledgedAt;
      if (alert.resolvedAt) monitoringAlert.resolvedAt = alert.resolvedAt;
      if (alert.resolution) monitoringAlert.resolution = alert.resolution;
      if (alert.tags) monitoringAlert.tags = alert.tags;
      if (alert.actions) monitoringAlert.actions = alert.actions;

      return monitoringAlert;
    });
  }

  private getWorkerUrl(): string {
    return (this.env as any).WORKER_URL || 'https://localhost:8787';
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const adminToken = (this.env as any).ADMIN_TOKEN;
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return headers;
  }

  private calculateRequestsPerSecond(): number {
    const now = nowMs();
    const timeSpan = now - this.lastMetricsCollection;
    return (1000 / Math.max(timeSpan, 1)) * 10; // Rough estimate
  }

  private getWorkerInvocations(): number {
    // In real implementation, this would come from Cloudflare Analytics
    return Math.floor(Math.random() * 1000);
  }

  private getActiveEdgeLocations(): number {
    // In real implementation, this would come from Cloudflare Analytics
    return Math.floor(Math.random() * 20) + 5;
  }

  // =================== Default Metrics ===================

  private getDefaultWebSocketMetrics(): any {
    return {
      activeConnections: 0,
      totalConnections: 0,
      connectionsPerSecond: 0,
      averageLatency: 0,
      throughput: 0,
      errorRate: 0,
      connectionsByRole: {},
      lastUpdated: nowMs()
    };
  }

  private getDefaultDurableObjectMetrics(): any {
    return {
      messageBroadcaster: {
        eventsPerSecond: 0,
        queueDepth: 0,
        deliverySuccessRate: 1,
        averageLatency: 0,
        activeConnections: 0
      },
      conversationRooms: {
        sampleSize: 0,
        averageParticipants: 0,
        averageMessagesPerRoom: 0,
        totalRoomsActive: 0
      },
      overallHealth: 100,
      lastUpdated: nowMs()
    };
  }

  private getDefaultSystemMetrics(): any {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      requestsPerSecond: 0,
      workerInvocations: 0,
      edgeLocations: 0,
      lastUpdated: nowMs()
    };
  }

  private getDefaultMessageMetrics(): any {
    return {
      totalMessages: 0,
      messagesPerSecond: 0,
      averageProcessingTime: 0,
      queueDepth: 0,
      successRate: 1,
      throughput: 0,
      errorRate: 0,
      lastUpdated: nowMs()
    };
  }
}

// =================== Factory Function ===================

export function createPerformanceMonitor(
  env: Bindings,
  config?: Partial<PerformanceMonitorConfig>
): PerformanceMonitor {
  return new PerformanceMonitor(env, config);
}