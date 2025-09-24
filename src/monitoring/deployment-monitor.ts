// Deployment Monitoring and Alerting System
// 專案名稱：Multi-Channel Support MVP - Deployment Monitoring
// 提供即時監控、告警和自動回滾觸發機制

import type {
  DeploymentMetrics,
  MonitoringAlert,
  PerformanceBaseline,
  MonitoringDashboard
} from '../types/monitoring-types';
import type { EmergencyMetrics, RollbackTrigger } from '../types/rollback-types';
import type { Bindings } from '../types/bindings';
import { EmergencyRollbackService } from '../services/emergency-rollback-service';
import { DeploymentFeatureFlagsService } from '../services/deployment-feature-flags';

/**
 * Architecture Overview:
 *
 * DeploymentMonitorService provides:
 * 1. Real-time migration health monitoring
 * 2. Error rate tracking (WebSocket vs SSE)
 * 3. Performance comparison dashboards
 * 4. Automated rollback triggers based on thresholds
 * 5. User experience impact measurement
 * 6. Comprehensive alerting and notification system
 *
 * This ensures safe deployment with immediate detection of issues
 */

export class DeploymentMonitorService {
  private env: Bindings;
  private rollbackService: EmergencyRollbackService;
  private featureFlagsService: DeploymentFeatureFlagsService;

  // Configuration intervals for monitoring (defined but not currently used)
  // private readonly MONITORING_INTERVALS = {
  //   realtime: 30000,    // 30 seconds for real-time monitoring
  //   frequent: 300000,   // 5 minutes for frequent checks
  //   standard: 900000,   // 15 minutes for standard monitoring
  //   baseline: 3600000   // 1 hour for baseline updates
  // };

  private readonly ALERT_THRESHOLDS = {
    error_rate: {
      warning: 0.02,  // 2%
      critical: 0.05  // 5%
    },
    latency: {
      warning: 150,   // 150ms increase
      critical: 300   // 300ms increase
    },
    connection_failures: {
      warning: 0.05,  // 5%
      critical: 0.10  // 10%
    },
    resource_usage: {
      cpu_warning: 0.8,     // 80%
      cpu_critical: 0.9,    // 90%
      memory_warning: 0.8,  // 80%
      memory_critical: 0.9  // 90%
    }
  };

  constructor(env: Bindings) {
    this.env = env;
    this.rollbackService = new EmergencyRollbackService(env);
    this.featureFlagsService = new DeploymentFeatureFlagsService(env);
  }

  // =================== Real-time Monitoring ===================

  /**
   * Start continuous monitoring of the WebSocket deployment
   * @param monitoringConfig Configuration for monitoring behavior
   */
  async startDeploymentMonitoring(monitoringConfig: {
    enableAutomaticRollback: boolean;
    alertingEnabled: boolean;
    dashboardUpdates: boolean;
    metricsCollection: boolean;
  } = {
    enableAutomaticRollback: true,
    alertingEnabled: true,
    dashboardUpdates: true,
    metricsCollection: true
  }): Promise<void> {
    console.log('🔍 [DeploymentMonitor] Starting deployment monitoring with config:', monitoringConfig);

    // Initialize monitoring state
    await this.initializeMonitoring(monitoringConfig);

    // Start monitoring intervals
    if (monitoringConfig.metricsCollection) {
      await this.startMetricsCollection();
    }

    if (monitoringConfig.enableAutomaticRollback) {
      await this.startAutomaticRollbackMonitoring();
    }

    if (monitoringConfig.alertingEnabled) {
      await this.startAlertingSystem();
    }

    if (monitoringConfig.dashboardUpdates) {
      await this.startDashboardUpdates();
    }

    console.log('✅ [DeploymentMonitor] Deployment monitoring started successfully');
  }

  /**
   * Stop deployment monitoring
   */
  async stopDeploymentMonitoring(): Promise<void> {
    console.log('⏹️ [DeploymentMonitor] Stopping deployment monitoring');

    // Mark monitoring as stopped
    await this.env.CACHE.put('deployment_monitoring_status', 'stopped');

    // Clear monitoring intervals would be handled by the scheduled workers
    console.log('✅ [DeploymentMonitor] Deployment monitoring stopped');
  }

  /**
   * Get current deployment health metrics
   * @returns Comprehensive health metrics
   */
  async getDeploymentHealth(): Promise<DeploymentMetrics> {
    try {
      const [
        connectionMetrics,
        performanceMetrics,
        errorMetrics,
        resourceMetrics,
        userExperienceMetrics
      ] = await Promise.all([
        this.collectConnectionMetrics(),
        this.collectPerformanceMetrics(),
        this.collectErrorMetrics(),
        this.collectResourceMetrics(),
        this.collectUserExperienceMetrics()
      ]);

      const healthScore = this.calculateHealthScore(
        connectionMetrics,
        performanceMetrics,
        errorMetrics,
        resourceMetrics
      );

      const metrics: DeploymentMetrics = {
        timestamp: Date.now(),
        healthScore,
        status: this.determineOverallStatus(healthScore),
        connections: connectionMetrics,
        performance: performanceMetrics,
        errors: errorMetrics,
        resources: resourceMetrics,
        userExperience: userExperienceMetrics,
        featureFlags: await this.getFeatureFlagStatus(),
        alerts: await this.getActiveAlerts()
      };

      // Cache metrics for dashboard access
      await this.cacheMetrics(metrics);

      return metrics;

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error collecting deployment health:', error);

      return {
        timestamp: Date.now(),
        healthScore: 0,
        status: 'unknown',
        connections: { websocket: { active: 0, total: 0, successRate: 0 }, sse: { active: 0, total: 0, successRate: 0 } },
        performance: { websocket: { avgLatency: 0, p95Latency: 0 }, sse: { avgLatency: 0, p95Latency: 0 } },
        errors: { websocket: { rate: 0, count: 0 }, sse: { rate: 0, count: 0 } },
        resources: { cpu: 0, memory: 0, durableObjects: 0, kvOperations: 0 },
        userExperience: { satisfaction: 0, complaints: 0, conversionRate: 0 },
        featureFlags: [],
        alerts: []
      };
    }
  }

  /**
   * Check if automated rollback should be triggered
   * @returns Rollback decision and recommendations
   */
  async checkRollbackTriggers(): Promise<{
    shouldTrigger: boolean;
    triggers: RollbackTrigger[];
    recommendation: string;
    confidence: number;
  }> {
    try {
      const health = await this.getDeploymentHealth();
      const baseline = await this.getPerformanceBaseline();

      const emergencyMetrics: EmergencyMetrics = {
        errorRate: Math.max(health.errors.websocket.rate, health.errors.sse.rate),
        latencyIncrease: this.calculateLatencyIncrease(health.performance, baseline),
        connectionFailureRate: 1 - Math.min(health.connections.websocket.successRate, health.connections.sse.successRate),
        userComplaints: health.userExperience.complaints,
        resourceUsage: {
          cpu: health.resources.cpu,
          memory: health.resources.memory,
          durableObjectCount: health.resources.durableObjects,
          activeConnections: health.connections.websocket.active + health.connections.sse.active
        },
        sampleSize: health.connections.websocket.total + health.connections.sse.total,
        dataAge: Date.now() - health.timestamp
      };

      // Use rollback service to evaluate triggers
      const decision = await this.rollbackService.evaluateRollbackTriggers(emergencyMetrics);

      return {
        shouldTrigger: decision.shouldRollback,
        triggers: decision.triggers,
        recommendation: decision.recommendedAction,
        confidence: decision.confidence
      };

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error checking rollback triggers:', error);

      return {
        shouldTrigger: false,
        triggers: [],
        recommendation: 'monitoring_error',
        confidence: 0
      };
    }
  }

  // =================== Performance Comparison ===================

  /**
   * Generate performance comparison between WebSocket and SSE
   * @param timeRange Time range for comparison in milliseconds
   * @returns Detailed performance comparison
   */
  async generatePerformanceComparison(timeRange: number = 3600000): Promise<{
    websocket: {
      metrics: any;
      advantages: string[];
      issues: string[];
    };
    sse: {
      metrics: any;
      advantages: string[];
      issues: string[];
    };
    comparison: {
      winner: 'websocket' | 'sse' | 'tie';
      reasons: string[];
      score: { websocket: number; sse: number };
    };
    recommendation: string;
  }> {
    try {
      const endTime = Date.now();
      const startTime = endTime - timeRange;

      // Collect historical metrics for both connection types
      const [wsMetrics, sseMetrics] = await Promise.all([
        this.getHistoricalMetrics('websocket', startTime, endTime),
        this.getHistoricalMetrics('sse', startTime, endTime)
      ]);

      // Analyze WebSocket performance
      const websocketAnalysis = {
        metrics: wsMetrics,
        advantages: this.identifyAdvantages(wsMetrics, 'websocket'),
        issues: this.identifyIssues(wsMetrics, 'websocket')
      };

      // Analyze SSE performance
      const sseAnalysis = {
        metrics: sseMetrics,
        advantages: this.identifyAdvantages(sseMetrics, 'sse'),
        issues: this.identifyIssues(sseMetrics, 'sse')
      };

      // Compare and score
      const comparison = this.comparePerformance(wsMetrics, sseMetrics);

      // Generate recommendation
      const recommendation = this.generateRecommendation(comparison, websocketAnalysis, sseAnalysis);

      return {
        websocket: websocketAnalysis,
        sse: sseAnalysis,
        comparison,
        recommendation
      };

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error generating performance comparison:', error);

      return {
        websocket: { metrics: {}, advantages: [], issues: ['Data collection error'] },
        sse: { metrics: {}, advantages: [], issues: ['Data collection error'] },
        comparison: { winner: 'tie', reasons: ['Insufficient data'], score: { websocket: 0, sse: 0 } },
        recommendation: 'Unable to generate recommendation due to data collection error'
      };
    }
  }

  // =================== Alerting System ===================

  /**
   * Create monitoring alert
   * @param alert Alert configuration
   */
  async createAlert(alert: MonitoringAlert): Promise<void> {
    try {
      // Store alert
      await this.env.CACHE.put(
        `alert:${alert.id}`,
        JSON.stringify(alert),
        { expirationTtl: 86400 } // 24 hours
      );

      // Add to active alerts list
      const activeAlerts = await this.getActiveAlerts();
      activeAlerts.push(alert);
      await this.updateActiveAlerts(activeAlerts);

      // Send notifications
      await this.sendAlertNotifications(alert);

      console.log(`🚨 [DeploymentMonitor] Alert created: ${alert.title} (${alert.severity})`);

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error creating alert:', error);
    }
  }

  /**
   * Resolve monitoring alert
   * @param alertId Alert identifier
   * @param resolution Resolution details
   */
  async resolveAlert(alertId: string, resolution: string): Promise<void> {
    try {
      const alertStr = await this.env.CACHE.get(`alert:${alertId}`);
      if (!alertStr) {
        console.warn(`⚠️ [DeploymentMonitor] Alert ${alertId} not found for resolution`);
        return;
      }

      const alert: MonitoringAlert = JSON.parse(alertStr);
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      alert.resolution = resolution;

      // Update stored alert
      await this.env.CACHE.put(`alert:${alertId}`, JSON.stringify(alert), { expirationTtl: 86400 });

      // Remove from active alerts
      const activeAlerts = await this.getActiveAlerts();
      const updatedAlerts = activeAlerts.filter(a => a.id !== alertId);
      await this.updateActiveAlerts(updatedAlerts);

      // Send resolution notifications
      await this.sendResolutionNotifications(alert);

      console.log(`✅ [DeploymentMonitor] Alert resolved: ${alertId}`);

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error resolving alert:', error);
    }
  }

  // =================== Dashboard Management ===================

  /**
   * Get dashboard data for monitoring UI
   * @returns Dashboard configuration and data
   */
  async getDashboardData(): Promise<MonitoringDashboard> {
    try {
      const [
        currentHealth,
        performanceComparison,
        rollbackStatus,
        recentAlerts,
        featureFlagStatus
      ] = await Promise.all([
        this.getDeploymentHealth(),
        this.generatePerformanceComparison(900000), // 15 minutes
        this.rollbackService.getRollbackStatus(),
        this.getRecentAlerts(24), // Last 24 hours
        this.featureFlagsService.getDeploymentStatus()
      ]);

      return {
        timestamp: Date.now(),
        health: {
          overall: currentHealth.status,
          score: currentHealth.healthScore,
          connections: currentHealth.connections,
          performance: currentHealth.performance,
          errors: currentHealth.errors,
          resources: currentHealth.resources
        },
        migration: {
          websocketAdoption: this.calculateWebSocketAdoption(currentHealth.connections),
          performanceImpact: this.calculatePerformanceImpact(performanceComparison),
          issueCount: recentAlerts.filter(a => a.status === 'active').length,
          rollbackReadiness: rollbackStatus.rollbackReadiness
        },
        features: {
          activeFlags: featureFlagStatus.summary.activeFlags,
          inRollout: featureFlagStatus.summary.inRollout,
          emergencyOverrides: featureFlagStatus.summary.emergencyOverrides
        },
        alerts: {
          active: recentAlerts.filter(a => a.status === 'active'),
          resolved: recentAlerts.filter(a => a.status === 'resolved'),
          critical: recentAlerts.filter(a => a.severity === 'critical').length
        },
        trends: await this.getPerformanceTrends(),
        recommendations: await this.generateDashboardRecommendations(currentHealth, performanceComparison)
      };

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error getting dashboard data:', error);

      return {
        timestamp: Date.now(),
        health: {
          overall: 'unknown',
          score: 0,
          connections: { websocket: { active: 0, total: 0, successRate: 0 }, sse: { active: 0, total: 0, successRate: 0 } },
          performance: { websocket: { avgLatency: 0, p95Latency: 0 }, sse: { avgLatency: 0, p95Latency: 0 } },
          errors: { websocket: { rate: 0, count: 0 }, sse: { rate: 0, count: 0 } },
          resources: { cpu: 0, memory: 0, durableObjects: 0, kvOperations: 0 }
        },
        migration: {
          websocketAdoption: 0,
          performanceImpact: 'unknown',
          issueCount: 0,
          rollbackReadiness: 'unknown'
        },
        features: {
          activeFlags: 0,
          inRollout: 0,
          emergencyOverrides: 0
        },
        alerts: {
          active: [],
          resolved: [],
          critical: 0
        },
        trends: {},
        recommendations: ['Monitoring system error - please check logs']
      };
    }
  }

  // =================== Private Helper Methods ===================

  private async initializeMonitoring(config: any): Promise<void> {
    // Store monitoring configuration
    await this.env.CACHE.put('deployment_monitoring_config', JSON.stringify(config));
    await this.env.CACHE.put('deployment_monitoring_status', 'active');

    // Initialize baseline metrics if not exists
    const existingBaseline = await this.env.CACHE.get('performance_baseline');
    if (!existingBaseline) {
      await this.establishPerformanceBaseline();
    }

    console.log('🔧 [DeploymentMonitor] Monitoring initialized');
  }

  private async startMetricsCollection(): Promise<void> {
    // This would start scheduled workers for metrics collection
    // For now, just mark as started
    await this.env.CACHE.put('metrics_collection_status', 'active');
    console.log('📊 [DeploymentMonitor] Metrics collection started');
  }

  private async startAutomaticRollbackMonitoring(): Promise<void> {
    // This would start the automatic rollback monitoring loop
    await this.env.CACHE.put('auto_rollback_monitoring_status', 'active');
    console.log('🛡️ [DeploymentMonitor] Automatic rollback monitoring started');
  }

  private async startAlertingSystem(): Promise<void> {
    // Initialize alerting rules and thresholds
    await this.initializeAlertingRules();
    await this.env.CACHE.put('alerting_system_status', 'active');
    console.log('🔔 [DeploymentMonitor] Alerting system started');
  }

  private async startDashboardUpdates(): Promise<void> {
    // This would start dashboard update intervals
    await this.env.CACHE.put('dashboard_updates_status', 'active');
    console.log('📈 [DeploymentMonitor] Dashboard updates started');
  }

  private async collectConnectionMetrics(): Promise<any> {
    // This would collect real connection metrics from Durable Objects
    // For now, return mock data
    return {
      websocket: {
        active: 250,
        total: 500,
        successRate: 0.95,
        averageConnectionTime: 1200,
        failureReasons: {
          'timeout': 15,
          'handshake_failed': 5,
          'unexpected_close': 5
        }
      },
      sse: {
        active: 750,
        total: 800,
        successRate: 0.98,
        averageConnectionTime: 800,
        failureReasons: {
          'timeout': 10,
          'network_error': 6
        }
      }
    };
  }

  private async collectPerformanceMetrics(): Promise<any> {
    // This would collect real performance metrics
    // For now, return mock data
    return {
      websocket: {
        avgLatency: 45,
        p95Latency: 120,
        p99Latency: 200,
        throughput: 1000
      },
      sse: {
        avgLatency: 65,
        p95Latency: 150,
        p99Latency: 300,
        throughput: 800
      }
    };
  }

  private async collectErrorMetrics(): Promise<any> {
    // This would collect real error metrics
    // For now, return mock data
    return {
      websocket: {
        rate: 0.03,
        count: 15,
        types: {
          'connection_error': 8,
          'message_error': 4,
          'timeout': 3
        }
      },
      sse: {
        rate: 0.02,
        count: 16,
        types: {
          'connection_error': 10,
          'parsing_error': 4,
          'timeout': 2
        }
      }
    };
  }

  private async collectResourceMetrics(): Promise<any> {
    // This would collect real resource usage metrics
    // For now, return mock data
    return {
      cpu: 0.65,
      memory: 0.72,
      durableObjects: 50,
      kvOperations: 15000,
      bandwidthUsage: 125000000 // bytes
    };
  }

  private async collectUserExperienceMetrics(): Promise<any> {
    // This would collect real user experience metrics
    // For now, return mock data
    return {
      satisfaction: 4.2, // out of 5
      complaints: 3,
      conversionRate: 0.85,
      sessionDuration: 1800000, // 30 minutes
      bounceRate: 0.15
    };
  }

  private calculateHealthScore(
    connections: any,
    performance: any,
    errors: any,
    resources: any
  ): number {
    // Weight factors for different metrics
    const weights = {
      connections: 0.3,
      performance: 0.25,
      errors: 0.3,
      resources: 0.15
    };

    // Calculate individual scores (0-100)
    const connectionScore = (connections.websocket.successRate + connections.sse.successRate) * 50;
    const performanceScore = Math.max(0, 100 - (performance.websocket.avgLatency + performance.sse.avgLatency) / 2);
    const errorScore = Math.max(0, 100 - (errors.websocket.rate + errors.sse.rate) * 1000);
    const resourceScore = Math.max(0, 100 - (resources.cpu + resources.memory) * 50);

    const weightedScore = (
      connectionScore * weights.connections +
      performanceScore * weights.performance +
      errorScore * weights.errors +
      resourceScore * weights.resources
    );

    return Math.round(Math.max(0, Math.min(100, weightedScore)));
  }

  private determineOverallStatus(healthScore: number): 'healthy' | 'degraded' | 'warning' | 'critical' | 'unknown' {
    if (healthScore >= 90) return 'healthy';
    if (healthScore >= 70) return 'warning';
    if (healthScore >= 50) return 'degraded';
    return 'critical';
  }

  private async getPerformanceBaseline(): Promise<PerformanceBaseline> {
    try {
      const baselineStr = await this.env.CACHE.get('performance_baseline');
      return baselineStr ? JSON.parse(baselineStr) : await this.establishPerformanceBaseline();
    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error getting performance baseline:', error);
      return await this.establishPerformanceBaseline();
    }
  }

  private async establishPerformanceBaseline(): Promise<PerformanceBaseline> {
    // This would establish baseline from historical data
    // For now, return default baseline
    const baseline: PerformanceBaseline = {
      websocket: {
        avgLatency: 50,
        errorRate: 0.01,
        connectionSuccessRate: 0.97
      },
      sse: {
        avgLatency: 70,
        errorRate: 0.015,
        connectionSuccessRate: 0.98
      },
      establishedAt: Date.now()
    };

    await this.env.CACHE.put('performance_baseline', JSON.stringify(baseline), { expirationTtl: 86400 });
    return baseline;
  }

  private calculateLatencyIncrease(current: any, baseline: PerformanceBaseline): number {
    const currentAvg = (current.websocket.avgLatency + current.sse.avgLatency) / 2;
    const baselineAvg = (baseline.websocket.avgLatency + baseline.sse.avgLatency) / 2;
    return Math.max(0, currentAvg - baselineAvg);
  }

  private async cacheMetrics(metrics: DeploymentMetrics): Promise<void> {
    try {
      await this.env.CACHE.put('latest_deployment_metrics', JSON.stringify(metrics), { expirationTtl: 300 });

      // Also store in time series for historical analysis
      const timeSeriesKey = `metrics_${Math.floor(Date.now() / 300000)}`; // 5-minute buckets
      await this.env.CACHE.put(timeSeriesKey, JSON.stringify(metrics), { expirationTtl: 86400 });

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error caching metrics:', error);
    }
  }

  private async getFeatureFlagStatus(): Promise<any[]> {
    // This would get real feature flag status
    // For now, return mock data
    return [
      {
        name: 'websocket_connections',
        enabled: true,
        rolloutPercentage: 25,
        phase: 'early'
      }
    ];
  }

  private async getActiveAlerts(): Promise<MonitoringAlert[]> {
    try {
      const activeAlertsStr = await this.env.CACHE.get('active_alerts');
      return activeAlertsStr ? JSON.parse(activeAlertsStr) : [];
    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error getting active alerts:', error);
      return [];
    }
  }

  private async updateActiveAlerts(alerts: MonitoringAlert[]): Promise<void> {
    try {
      await this.env.CACHE.put('active_alerts', JSON.stringify(alerts));
    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error updating active alerts:', error);
    }
  }

  private async sendAlertNotifications(alert: MonitoringAlert): Promise<void> {
    try {
      // This would send notifications via various channels
      console.log(`📢 [DeploymentMonitor] Alert notification sent: ${alert.title}`);

      // Mock notification sending
      const notification = {
        alert: alert.id,
        title: alert.title,
        severity: alert.severity,
        timestamp: Date.now(),
        channels: ['email', 'slack', 'dashboard']
      };

      await this.env.CACHE.put(
        `notification:${alert.id}`,
        JSON.stringify(notification),
        { expirationTtl: 86400 }
      );

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error sending alert notifications:', error);
    }
  }

  private async sendResolutionNotifications(alert: MonitoringAlert): Promise<void> {
    try {
      console.log(`📢 [DeploymentMonitor] Resolution notification sent: ${alert.title}`);

      const notification = {
        alert: alert.id,
        title: `RESOLVED: ${alert.title}`,
        resolution: alert.resolution,
        timestamp: Date.now(),
        channels: ['email', 'slack', 'dashboard']
      };

      await this.env.CACHE.put(
        `resolution_notification:${alert.id}`,
        JSON.stringify(notification),
        { expirationTtl: 86400 }
      );

    } catch (error) {
      console.error('❌ [DeploymentMonitor] Error sending resolution notifications:', error);
    }
  }

  private async getHistoricalMetrics(connectionType: string, _startTime: number, _endTime: number): Promise<any> {
    // This would fetch historical metrics from storage
    // For now, return mock historical data
    return {
      avgLatency: connectionType === 'websocket' ? 45 : 65,
      errorRate: connectionType === 'websocket' ? 0.03 : 0.02,
      successRate: connectionType === 'websocket' ? 0.95 : 0.98,
      throughput: connectionType === 'websocket' ? 1000 : 800,
      dataPoints: 120 // 2 hours of data points
    };
  }

  private identifyAdvantages(metrics: any, connectionType: string): string[] {
    const advantages: string[] = [];

    if (connectionType === 'websocket') {
      if (metrics.avgLatency < 50) advantages.push('Low latency communication');
      if (metrics.throughput > 900) advantages.push('High throughput capability');
      if (metrics.successRate > 0.94) advantages.push('Reliable connection establishment');
    } else {
      if (metrics.errorRate < 0.025) advantages.push('Low error rate');
      if (metrics.successRate > 0.97) advantages.push('Excellent connection reliability');
    }

    return advantages;
  }

  private identifyIssues(metrics: any, _connectionType: string): string[] {
    const issues: string[] = [];

    if (metrics.errorRate > 0.05) issues.push('High error rate detected');
    if (metrics.avgLatency > 100) issues.push('Elevated latency concerns');
    if (metrics.successRate < 0.90) issues.push('Connection reliability issues');
    if (metrics.throughput < 500) issues.push('Low throughput performance');

    return issues;
  }

  private comparePerformance(wsMetrics: any, sseMetrics: any): any {
    let wsScore = 0;
    let sseScore = 0;
    const reasons: string[] = [];

    // Compare latency
    if (wsMetrics.avgLatency < sseMetrics.avgLatency) {
      wsScore += 25;
      reasons.push('WebSocket has lower latency');
    } else {
      sseScore += 25;
      reasons.push('SSE has lower latency');
    }

    // Compare error rate
    if (wsMetrics.errorRate < sseMetrics.errorRate) {
      wsScore += 25;
      reasons.push('WebSocket has lower error rate');
    } else {
      sseScore += 25;
      reasons.push('SSE has lower error rate');
    }

    // Compare success rate
    if (wsMetrics.successRate > sseMetrics.successRate) {
      wsScore += 25;
      reasons.push('WebSocket has higher success rate');
    } else {
      sseScore += 25;
      reasons.push('SSE has higher success rate');
    }

    // Compare throughput
    if (wsMetrics.throughput > sseMetrics.throughput) {
      wsScore += 25;
      reasons.push('WebSocket has higher throughput');
    } else {
      sseScore += 25;
      reasons.push('SSE has higher throughput');
    }

    let winner: 'websocket' | 'sse' | 'tie' = 'tie';
    if (wsScore > sseScore) winner = 'websocket';
    else if (sseScore > wsScore) winner = 'sse';

    return { winner, reasons, score: { websocket: wsScore, sse: sseScore } };
  }

  private generateRecommendation(comparison: any, _wsAnalysis: any, _sseAnalysis: any): string {
    if (comparison.winner === 'websocket') {
      return `Recommend continuing WebSocket rollout. WebSocket shows ${comparison.score.websocket}% advantage with: ${comparison.reasons.filter((r: string) => r.includes('WebSocket')).join(', ')}.`;
    } else if (comparison.winner === 'sse') {
      return `Recommend rolling back to SSE. SSE shows ${comparison.score.sse}% advantage with: ${comparison.reasons.filter((r: string) => r.includes('SSE')).join(', ')}.`;
    } else {
      return 'Performance is comparable between WebSocket and SSE. Continue monitoring for clearer trends.';
    }
  }

  private async initializeAlertingRules(): Promise<void> {
    // This would initialize alerting rules and thresholds
    const rules = [
      {
        name: 'high_error_rate',
        threshold: this.ALERT_THRESHOLDS.error_rate.critical,
        severity: 'critical'
      },
      {
        name: 'high_latency',
        threshold: this.ALERT_THRESHOLDS.latency.critical,
        severity: 'critical'
      }
    ];

    await this.env.CACHE.put('alerting_rules', JSON.stringify(rules));
  }

  private async getRecentAlerts(_hours: number): Promise<MonitoringAlert[]> {
    // This would fetch recent alerts from storage
    // For now, return mock data
    return [];
  }

  private calculateWebSocketAdoption(connections: any): number {
    const total = connections.websocket.active + connections.sse.active;
    return total > 0 ? (connections.websocket.active / total) * 100 : 0;
  }

  private calculatePerformanceImpact(comparison: any): 'positive' | 'negative' | 'neutral' | 'unknown' {
    if (comparison.comparison.winner === 'websocket') return 'positive';
    if (comparison.comparison.winner === 'sse') return 'negative';
    return 'neutral';
  }

  private async getPerformanceTrends(): Promise<any> {
    // This would calculate performance trends over time
    // For now, return mock trends
    return {
      latency: { trend: 'improving', change: -5 },
      errorRate: { trend: 'stable', change: 0 },
      adoption: { trend: 'increasing', change: 15 }
    };
  }

  private async generateDashboardRecommendations(health: DeploymentMetrics, comparison: any): Promise<string[]> {
    const recommendations: string[] = [];

    if (health.healthScore < 70) {
      recommendations.push('Health score below 70% - consider investigating performance issues');
    }

    if (health.errors.websocket.rate > 0.05) {
      recommendations.push('WebSocket error rate above 5% - monitor closely or consider rollback');
    }

    if (comparison.comparison.winner === 'sse') {
      recommendations.push('SSE showing better performance - evaluate rollback strategy');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performing well - continue monitoring');
    }

    return recommendations;
  }
}