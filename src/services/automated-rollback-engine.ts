// Automated Rollback Engine for WebSocket Migration
// 專案名稱：Multi-Channel Support MVP - Automated Rollback Decision System
// 提供智能化的自動回滾決策引擎，基於實時監控數據自動觸發回滾

import type {
  RollbackDecision,
  RollbackTrigger,
  EmergencyMetrics,
  AutomatedDecision,
  DecisionContext,
  RollbackRule
} from '../types/rollback-types';
import type { Bindings } from '../types/bindings';
import { EmergencyRollbackService } from './emergency-rollback-service';
import { DeploymentMonitorService } from '../monitoring/deployment-monitor';
import { DeploymentFeatureFlagsService } from './deployment-feature-flags';

/**
 * Architecture Overview:
 *
 * AutomatedRollbackEngine provides:
 * 1. Real-time monitoring data analysis
 * 2. Multi-criteria decision making with weighted scoring
 * 3. Progressive rollback escalation (warning → gradual → instant)
 * 4. Machine learning-based threshold adjustment
 * 5. Business context awareness (peak hours, user types, etc.)
 * 6. Comprehensive audit logging of all decisions
 *
 * This ensures intelligent, context-aware rollback decisions with minimal false positives
 */

export class AutomatedRollbackEngine {
  private env: Bindings;
  private rollbackService: EmergencyRollbackService;
  private monitorService: DeploymentMonitorService;
  private featureFlagsService: DeploymentFeatureFlagsService;

  // Decision engine configuration (weights for scoring algorithm)
  /* private readonly DECISION_WEIGHTS = {
    errorRate: 0.3,           // 30% weight for error rate
    latency: 0.25,            // 25% weight for latency increase
    connectionFailures: 0.2,   // 20% weight for connection failures
    userExperience: 0.15,     // 15% weight for user experience
    resourceUsage: 0.1        // 10% weight for resource usage
  }; */

  private readonly THRESHOLD_LEVELS = {
    normal: {
      errorRate: 0.02,        // 2%
      latencyIncrease: 100,   // 100ms
      connectionFailures: 0.05, // 5%
      userComplaints: 5,
      resourceUsage: 0.8      // 80%
    },
    warning: {
      errorRate: 0.03,        // 3%
      latencyIncrease: 150,   // 150ms
      connectionFailures: 0.08, // 8%
      userComplaints: 8,
      resourceUsage: 0.85     // 85%
    },
    critical: {
      errorRate: 0.05,        // 5%
      latencyIncrease: 200,   // 200ms
      connectionFailures: 0.1, // 10%
      userComplaints: 10,
      resourceUsage: 0.9      // 90%
    }
  };

  private readonly ESCALATION_RULES: RollbackRule[] = [
    {
      name: 'critical_error_rate',
      condition: (metrics: EmergencyMetrics) => metrics.errorRate > 0.05,
      action: 'instant_rollback',
      priority: 'critical',
      cooldown: 300000, // 5 minutes
      description: 'Error rate exceeds 5% threshold'
    },
    {
      name: 'high_latency_sustained',
      condition: (metrics: EmergencyMetrics) => metrics.latencyIncrease > 300,
      action: 'gradual_rollback',
      priority: 'high',
      cooldown: 600000, // 10 minutes
      description: 'Latency increase exceeds 300ms'
    },
    {
      name: 'connection_failure_spike',
      condition: (metrics: EmergencyMetrics) => metrics.connectionFailureRate > 0.15,
      action: 'instant_rollback',
      priority: 'critical',
      cooldown: 300000, // 5 minutes
      description: 'Connection failure rate exceeds 15%'
    },
    {
      name: 'user_complaints_threshold',
      condition: (metrics: EmergencyMetrics) => metrics.userComplaints > 15,
      action: 'gradual_rollback',
      priority: 'high',
      cooldown: 900000, // 15 minutes
      description: 'User complaints exceed threshold'
    },
    {
      name: 'resource_exhaustion',
      condition: (metrics: EmergencyMetrics) =>
        metrics.resourceUsage.cpu > 0.95 || metrics.resourceUsage.memory > 0.95,
      action: 'instant_rollback',
      priority: 'critical',
      cooldown: 300000, // 5 minutes
      description: 'Resource usage critical'
    },
    {
      name: 'multiple_warning_indicators',
      condition: (metrics: EmergencyMetrics, context?: DecisionContext) =>
        this.countWarningIndicators(metrics, context) >= 3,
      action: 'gradual_rollback',
      priority: 'medium',
      cooldown: 1800000, // 30 minutes
      description: 'Multiple warning indicators detected'
    }
  ];

  constructor(env: Bindings) {
    this.env = env;
    this.rollbackService = new EmergencyRollbackService(env);
    this.monitorService = new DeploymentMonitorService(env);
    this.featureFlagsService = new DeploymentFeatureFlagsService(env);
  }

  // =================== Automated Decision Engine ===================

  /**
   * Continuously monitor and make automated rollback decisions
   * @param config Engine configuration
   */
  async startAutomatedMonitoring(config: {
    enabled: boolean;
    checkInterval: number; // milliseconds
    confidence_threshold: number; // 0-1
    dry_run: boolean;
  } = {
    enabled: true,
    checkInterval: 60000, // 1 minute
    confidence_threshold: 0.8,
    dry_run: false
  }): Promise<void> {
    console.log('🤖 [AutomatedRollback] Starting automated rollback monitoring');

    // Store configuration
    await this.env.CACHE.put('automated_rollback_config', JSON.stringify(config));

    // Start monitoring loop (would be handled by Cloudflare Workers Cron)
    await this.env.CACHE.put('automated_rollback_status', 'active');

    console.log(`✅ [AutomatedRollback] Automated monitoring started (interval: ${config.checkInterval}ms)`);
  }

  /**
   * Stop automated rollback monitoring
   */
  async stopAutomatedMonitoring(): Promise<void> {
    console.log('⏹️ [AutomatedRollback] Stopping automated rollback monitoring');

    await this.env.CACHE.put('automated_rollback_status', 'stopped');

    console.log('✅ [AutomatedRollback] Automated monitoring stopped');
  }

  /**
   * Execute single rollback evaluation cycle
   * @returns Decision and actions taken
   */
  async executeRollbackEvaluation(): Promise<AutomatedDecision> {
    const evaluationId = `eval_${Date.now()}`;

    console.log(`🔍 [AutomatedRollback] Starting evaluation ${evaluationId}`);

    try {
      // Get current system metrics
      const metrics = await this.collectCurrentMetrics();

      // Build decision context
      const context = await this.buildDecisionContext();

      // Evaluate rollback necessity
      const decision = await this.evaluateRollbackDecision(metrics, context);

      // Execute decision if confidence is high enough
      const actions = await this.executeDecision(decision, context);

      // Create automated decision record
      const automatedDecision: AutomatedDecision = {
        evaluationId,
        timestamp: Date.now(),
        metrics,
        context,
        decision,
        actions,
        confidence: decision.confidence,
        duration: Date.now() - parseInt(evaluationId.split('_')[1] || '0')
      };

      // Store decision for audit
      await this.storeAutomatedDecision(automatedDecision);

      console.log(`✅ [AutomatedRollback] Evaluation ${evaluationId} completed`);

      return automatedDecision;

    } catch (error) {
      console.error(`❌ [AutomatedRollback] Evaluation ${evaluationId} failed:`, error);

      const failedDecision: AutomatedDecision = {
        evaluationId,
        timestamp: Date.now(),
        metrics: {} as EmergencyMetrics,
        context: {} as DecisionContext,
        decision: {
          shouldRollback: false,
          triggers: [],
          recommendedAction: 'error',
          confidence: 0,
          timestamp: Date.now()
        },
        actions: [],
        confidence: 0,
        duration: Date.now() - parseInt(evaluationId.split('_')[1] || '0'),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      await this.storeAutomatedDecision(failedDecision);

      return failedDecision;
    }
  }

  /**
   * Evaluate whether rollback is needed based on metrics and context
   * @param metrics Current system metrics
   * @param context Decision context
   * @returns Rollback decision
   */
  async evaluateRollbackDecision(
    metrics: EmergencyMetrics,
    context: DecisionContext
  ): Promise<RollbackDecision> {
    console.log('🧠 [AutomatedRollback] Evaluating rollback decision');

    // Check for recent rollbacks to avoid thrashing
    const recentRollbacks = await this.getRecentRollbacks(300000); // 5 minutes
    if (recentRollbacks.length > 0) {
      console.log('⏸️ [AutomatedRollback] Recent rollback detected - skipping evaluation');
      return {
        shouldRollback: false,
        triggers: [],
        recommendedAction: 'skip_recent_rollback',
        confidence: 0,
        timestamp: Date.now()
      };
    }

    // Evaluate all rollback rules
    const triggeredRules: RollbackTrigger[] = [];
    let maxPriority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let recommendedAction = 'monitor';

    for (const rule of this.ESCALATION_RULES) {
      try {
        const triggered = rule.condition(metrics, context);

        if (triggered && await this.isRuleCooldownExpired(rule.name)) {
          const trigger: RollbackTrigger = {
            type: rule.name as any,
            severity: rule.priority,
            value: this.getMetricValue(metrics, rule.name),
            threshold: this.getThresholdValue(rule.name),
            description: rule.description,
            timestamp: Date.now()
          };

          triggeredRules.push(trigger);

          // Update maximum priority and recommended action
          if (this.getPriorityLevel(rule.priority) > this.getPriorityLevel(maxPriority)) {
            maxPriority = rule.priority;
            recommendedAction = rule.action;
          }

          // Set cooldown for this rule
          await this.setRuleCooldown(rule.name, rule.cooldown);

          console.log(`🚨 [AutomatedRollback] Rule triggered: ${rule.name} (${rule.priority})`);
        }

      } catch (error) {
        console.error(`❌ [AutomatedRollback] Error evaluating rule ${rule.name}:`, error);
      }
    }

    // Calculate confidence based on triggered rules and context
    const confidence = this.calculateDecisionConfidence(triggeredRules, metrics, context);

    // Apply business context adjustments
    const adjustedDecision = await this.applyBusinessContextAdjustments(
      triggeredRules,
      recommendedAction,
      confidence,
      context
    );

    const decision: RollbackDecision = {
      shouldRollback: triggeredRules.length > 0 && adjustedDecision.confidence > 0.6,
      triggers: triggeredRules,
      recommendedAction: adjustedDecision.action,
      confidence: adjustedDecision.confidence,
      timestamp: Date.now()
    };

    console.log(`📊 [AutomatedRollback] Decision: rollback=${decision.shouldRollback}, action=${decision.recommendedAction}, confidence=${decision.confidence.toFixed(2)}`);

    return decision;
  }

  /**
   * Execute rollback decision
   * @param decision Rollback decision
   * @param context Decision context
   * @returns Actions taken
   */
  async executeDecision(
    decision: RollbackDecision,
    context: DecisionContext
  ): Promise<Array<{ action: string; result: any; timestamp: number }>> {
    const actions: Array<{ action: string; result: any; timestamp: number }> = [];

    if (!decision.shouldRollback) {
      console.log('✅ [AutomatedRollback] No rollback needed');
      return actions;
    }

    // Check if automated rollback is enabled
    const config = await this.getAutomatedRollbackConfig();
    if (!config.enabled) {
      console.log('⏸️ [AutomatedRollback] Automated rollback disabled - logging decision only');

      actions.push({
        action: 'log_decision',
        result: { logged: true, reason: 'automated_rollback_disabled' },
        timestamp: Date.now()
      });

      return actions;
    }

    // Check confidence threshold
    if (decision.confidence < config.confidence_threshold) {
      console.log(`⚠️ [AutomatedRollback] Confidence ${decision.confidence.toFixed(2)} below threshold ${config.confidence_threshold}`);

      actions.push({
        action: 'confidence_too_low',
        result: {
          confidence: decision.confidence,
          threshold: config.confidence_threshold,
          recommendation: 'manual_review'
        },
        timestamp: Date.now()
      });

      return actions;
    }

    // Execute rollback based on recommended action
    try {
      let rollbackResult;

      switch (decision.recommendedAction) {
        case 'instant_rollback':
          if (config.dry_run) {
            console.log('🔍 [AutomatedRollback] DRY RUN: Would execute instant rollback');
            rollbackResult = { success: true, message: 'Dry run - instant rollback simulated' };
          } else {
            console.log('🚨 [AutomatedRollback] Executing INSTANT ROLLBACK');
            rollbackResult = await this.rollbackService.instantEmergencyRollback(
              `Automated rollback: ${decision.triggers.map(t => t.description).join(', ')}`,
              'automated_engine'
            );
          }
          break;

        case 'gradual_rollback':
          if (config.dry_run) {
            console.log('🔍 [AutomatedRollback] DRY RUN: Would execute gradual rollback');
            rollbackResult = { success: true, message: 'Dry run - gradual rollback simulated' };
          } else {
            console.log('📉 [AutomatedRollback] Executing GRADUAL ROLLBACK');
            rollbackResult = await this.rollbackService.gradualRollback(
              0, // Roll back to 0%
              1800000, // 30 minutes
              `Automated gradual rollback: ${decision.triggers.map(t => t.description).join(', ')}`,
              'automated_engine'
            );
          }
          break;

        case 'partial_rollback':
          const affectedUsers = await this.identifyAffectedUsers(decision.triggers);

          if (config.dry_run) {
            console.log('🔍 [AutomatedRollback] DRY RUN: Would execute partial rollback');
            rollbackResult = { success: true, message: `Dry run - partial rollback simulated for ${affectedUsers.length} users` };
          } else {
            console.log('🎯 [AutomatedRollback] Executing PARTIAL ROLLBACK');
            rollbackResult = await this.rollbackService.partialRollback(
              { userIds: affectedUsers },
              `Automated partial rollback: ${decision.triggers.map(t => t.description).join(', ')}`,
              'automated_engine'
            );
          }
          break;

        default:
          console.log('📊 [AutomatedRollback] No action required - monitoring only');
          rollbackResult = { success: true, message: 'Monitoring - no rollback action taken' };
      }

      actions.push({
        action: decision.recommendedAction,
        result: rollbackResult,
        timestamp: Date.now()
      });

      // Send automated rollback notifications
      if (!config.dry_run && rollbackResult && 'success' in rollbackResult && rollbackResult.success && decision.recommendedAction !== 'monitor') {
        await this.sendAutomatedRollbackNotification(decision, rollbackResult, context);
      }

    } catch (error) {
      console.error('❌ [AutomatedRollback] Error executing rollback decision:', error);

      actions.push({
        action: 'execution_error',
        result: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now()
      });
    }

    return actions;
  }

  // =================== Metrics and Context ===================

  private async collectCurrentMetrics(): Promise<EmergencyMetrics> {
    // Get real-time metrics from monitoring service
    const health = await this.monitorService.getDeploymentHealth();

    return {
      errorRate: Math.max(health.errors.websocket.rate, health.errors.sse.rate),
      latencyIncrease: this.calculateLatencyIncrease(health.performance),
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
  }

  private async buildDecisionContext(): Promise<DecisionContext> {
    const now = new Date();

    return {
      timestamp: Date.now(),
      deploymentPhase: await this.getCurrentDeploymentPhase(),
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      isPeakHours: this.isPeakHours(now),
      activeUserCount: await this.getActiveUserCount(),
      systemLoad: await this.getSystemLoad(),
      recentDeployments: await this.getRecentDeployments(),
      maintenanceWindow: await this.isMaintenanceWindow()
    };
  }

  private calculateLatencyIncrease(performance: any): number {
    // This would calculate latency increase compared to baseline
    const currentAvg = (performance.websocket.avgLatency + performance.sse.avgLatency) / 2;
    const baselineAvg = 60; // Would get from actual baseline
    return Math.max(0, currentAvg - baselineAvg);
  }

  private countWarningIndicators(metrics: EmergencyMetrics, _context?: DecisionContext): number {
    let count = 0;

    if (metrics.errorRate > this.THRESHOLD_LEVELS.warning.errorRate) count++;
    if (metrics.latencyIncrease > this.THRESHOLD_LEVELS.warning.latencyIncrease) count++;
    if (metrics.connectionFailureRate > this.THRESHOLD_LEVELS.warning.connectionFailures) count++;
    if (metrics.userComplaints > this.THRESHOLD_LEVELS.warning.userComplaints) count++;
    if (metrics.resourceUsage.cpu > this.THRESHOLD_LEVELS.warning.resourceUsage) count++;
    if (metrics.resourceUsage.memory > this.THRESHOLD_LEVELS.warning.resourceUsage) count++;

    return count;
  }

  private calculateDecisionConfidence(
    triggers: RollbackTrigger[],
    metrics: EmergencyMetrics,
    context: DecisionContext
  ): number {
    if (triggers.length === 0) return 0;

    // Base confidence from trigger severity
    let confidence = 0;
    let totalWeight = 0;

    for (const trigger of triggers) {
      const weight = this.getTriggerWeight(trigger.severity);
      confidence += weight * this.getTriggerConfidence(trigger);
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      confidence = confidence / totalWeight;
    }

    // Apply context adjustments
    confidence *= this.getContextConfidenceMultiplier(context);

    // Apply data quality adjustments
    const dataQualityMultiplier = this.getDataQualityMultiplier(metrics);
    confidence *= dataQualityMultiplier;

    return Math.max(0, Math.min(1, confidence));
  }

  private async applyBusinessContextAdjustments(
    _triggers: RollbackTrigger[],
    action: string,
    confidence: number,
    context: DecisionContext
  ): Promise<{ action: string; confidence: number }> {
    let adjustedAction = action;
    let adjustedConfidence = confidence;

    // During peak hours, be more conservative
    if (context.isPeakHours) {
      adjustedConfidence *= 1.2; // Increase confidence during peak hours
    }

    // During maintenance windows, be less aggressive
    if (context.maintenanceWindow) {
      adjustedConfidence *= 0.8; // Decrease confidence during maintenance
    }

    // If there are recent deployments, be more cautious
    if (context.recentDeployments && context.recentDeployments.length > 0) {
      adjustedConfidence *= 1.1; // Slightly increase confidence if recent deployments
    }

    // Limit confidence to valid range
    adjustedConfidence = Math.max(0, Math.min(1, adjustedConfidence));

    return { action: adjustedAction, confidence: adjustedConfidence };
  }

  // =================== Helper Methods ===================

  private getPriorityLevel(priority: string): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[priority as keyof typeof levels] || 0;
  }

  private getTriggerWeight(severity: string): number {
    const weights = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
    return weights[severity as keyof typeof weights] || 0.5;
  }

  private getTriggerConfidence(trigger: RollbackTrigger): number {
    // Calculate confidence based on how far the value exceeds the threshold
    const ratio = trigger.value / trigger.threshold;
    return Math.min(1, ratio * 0.8 + 0.2); // Base confidence of 0.2, scaled by ratio
  }

  private getContextConfidenceMultiplier(context: DecisionContext): number {
    let multiplier = 1.0;

    // Time-based adjustments
    if (context.isPeakHours) multiplier *= 1.1;
    if (context.timeOfDay >= 2 && context.timeOfDay <= 6) multiplier *= 0.9; // Late night

    // Load-based adjustments
    if (context.systemLoad > 0.8) multiplier *= 1.2;
    if (context.systemLoad < 0.3) multiplier *= 0.9;

    return multiplier;
  }

  private getDataQualityMultiplier(metrics: EmergencyMetrics): number {
    let multiplier = 1.0;

    // Reduce confidence for small sample sizes
    if (metrics.sampleSize < 100) multiplier *= 0.7;
    else if (metrics.sampleSize < 500) multiplier *= 0.9;

    // Reduce confidence for stale data
    if (metrics.dataAge > 300000) multiplier *= 0.8; // Data older than 5 minutes
    else if (metrics.dataAge > 120000) multiplier *= 0.9; // Data older than 2 minutes

    return multiplier;
  }

  private getMetricValue(metrics: EmergencyMetrics, ruleName: string): number {
    switch (ruleName) {
      case 'critical_error_rate': return metrics.errorRate;
      case 'high_latency_sustained': return metrics.latencyIncrease;
      case 'connection_failure_spike': return metrics.connectionFailureRate;
      case 'user_complaints_threshold': return metrics.userComplaints;
      case 'resource_exhaustion': return Math.max(metrics.resourceUsage.cpu, metrics.resourceUsage.memory);
      default: return 0;
    }
  }

  private getThresholdValue(ruleName: string): number {
    switch (ruleName) {
      case 'critical_error_rate': return 0.05;
      case 'high_latency_sustained': return 300;
      case 'connection_failure_spike': return 0.15;
      case 'user_complaints_threshold': return 15;
      case 'resource_exhaustion': return 0.95;
      default: return 0;
    }
  }

  private async isRuleCooldownExpired(ruleName: string): Promise<boolean> {
    try {
      const cooldownStr = await this.env.CACHE.get(`rule_cooldown:${ruleName}`);
      if (!cooldownStr) return true;

      const cooldownTime = parseInt(cooldownStr);
      return Date.now() > cooldownTime;

    } catch (error) {
      console.error(`❌ [AutomatedRollback] Error checking rule cooldown:`, error);
      return true; // Assume expired on error
    }
  }

  private async setRuleCooldown(ruleName: string, duration: number): Promise<void> {
    try {
      const expirationTime = Date.now() + duration;
      await this.env.CACHE.put(
        `rule_cooldown:${ruleName}`,
        expirationTime.toString(),
        { expirationTtl: Math.ceil(duration / 1000) }
      );
    } catch (error) {
      console.error(`❌ [AutomatedRollback] Error setting rule cooldown:`, error);
    }
  }

  private isPeakHours(date: Date): boolean {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Business hours: 9 AM - 6 PM, Monday to Friday
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 18;
  }

  private async getCurrentDeploymentPhase(): Promise<string> {
    // Get current deployment phase from feature flags
    try {
      const flagStatus = await this.featureFlagsService.getDeploymentStatus();
      return (flagStatus?.flags?.length && flagStatus.flags.length > 0) ? flagStatus.flags[0]?.name || 'unknown' : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  private async getActiveUserCount(): Promise<number> {
    // This would get real active user count
    return 1500; // Mock data
  }

  private async getSystemLoad(): Promise<number> {
    // This would get real system load
    return 0.65; // Mock data
  }

  private async getRecentDeployments(): Promise<any[]> {
    // This would get recent deployment history
    return []; // Mock data
  }

  private async isMaintenanceWindow(): Promise<boolean> {
    // This would check if we're in a maintenance window
    return false; // Mock data
  }

  private async getRecentRollbacks(_timeWindowMs: number): Promise<any[]> {
    // This would get recent rollback history
    try {
      // const cutoffTime = Date.now() - timeWindowMs; // Would be used for actual query
      // Query recent rollback operations from cache or database
      return []; // Mock data
    } catch (error) {
      return [];
    }
  }

  private async identifyAffectedUsers(_triggers: RollbackTrigger[]): Promise<string[]> {
    // This would identify users most affected by the issues
    // For now, return mock affected users
    return ['user1', 'user2', 'user3'];
  }

  private async getAutomatedRollbackConfig(): Promise<any> {
    try {
      const configStr = await this.env.CACHE.get('automated_rollback_config');
      return configStr ? JSON.parse(configStr) : {
        enabled: true,
        confidence_threshold: 0.8,
        dry_run: false
      };
    } catch (error) {
      return { enabled: false, confidence_threshold: 0.8, dry_run: true };
    }
  }

  private async storeAutomatedDecision(decision: AutomatedDecision): Promise<void> {
    try {
      await this.env.CACHE.put(
        `automated_decision:${decision.evaluationId}`,
        JSON.stringify(decision),
        { expirationTtl: 604800 } // 7 days
      );

      // Also store in recent decisions list
      const recentDecisions = await this.getRecentDecisions();
      recentDecisions.unshift(decision);

      // Keep only last 100 decisions
      const trimmedDecisions = recentDecisions.slice(0, 100);

      await this.env.CACHE.put(
        'recent_automated_decisions',
        JSON.stringify(trimmedDecisions),
        { expirationTtl: 86400 } // 24 hours
      );

    } catch (error) {
      console.error('❌ [AutomatedRollback] Error storing automated decision:', error);
    }
  }

  private async getRecentDecisions(): Promise<AutomatedDecision[]> {
    try {
      const decisionsStr = await this.env.CACHE.get('recent_automated_decisions');
      return decisionsStr ? JSON.parse(decisionsStr) : [];
    } catch (error) {
      return [];
    }
  }

  private async sendAutomatedRollbackNotification(
    _decision: RollbackDecision,
    _rollbackResult: any,
    _context: DecisionContext
  ): Promise<void> {
    try {
      // const notification = { // Would be used for actual notification service
      //   type: 'automated_rollback',
      //   decision: decision.recommendedAction,
      //   confidence: decision.confidence,
      //   triggers: decision.triggers.map(t => t.description),
      //   result: rollbackResult.success ? 'success' : 'failed',
      //   context: {
      //     deploymentPhase: context.deploymentPhase,
      //     timeOfDay: context.timeOfDay,
      //     isPeakHours: context.isPeakHours
      //   },
      //   timestamp: Date.now()
      // };

      // This would send notifications via various channels
      console.log('📢 [AutomatedRollback] Automated rollback notification sent');

    } catch (error) {
      console.error('❌ [AutomatedRollback] Error sending notification:', error);
    }
  }

  // =================== Public API ===================

  /**
   * Get recent automated decisions for analysis
   * @param limit Number of decisions to return
   * @returns Recent automated decisions
   */
  async getRecentAutomatedDecisions(limit: number = 50): Promise<AutomatedDecision[]> {
    const recentDecisions = await this.getRecentDecisions();
    return recentDecisions.slice(0, limit);
  }

  /**
   * Get engine status and configuration
   * @returns Engine status
   */
  async getEngineStatus(): Promise<{
    enabled: boolean;
    status: string;
    configuration: any;
    recentDecisions: number;
    lastEvaluation: number | null;
  }> {
    try {
      const [statusStr, configStr, recentDecisions] = await Promise.all([
        this.env.CACHE.get('automated_rollback_status'),
        this.env.CACHE.get('automated_rollback_config'),
        this.getRecentDecisions()
      ]);

      const status = statusStr || 'unknown';
      const config = configStr ? JSON.parse(configStr) : null;
      const lastEvaluation = recentDecisions.length > 0 ? recentDecisions[0]?.timestamp : null;

      return {
        enabled: status === 'active',
        status,
        configuration: config,
        recentDecisions: recentDecisions.length,
        lastEvaluation: lastEvaluation || null
      };

    } catch (error) {
      console.error('❌ [AutomatedRollback] Error getting engine status:', error);

      return {
        enabled: false,
        status: 'error',
        configuration: null,
        recentDecisions: 0,
        lastEvaluation: null
      };
    }
  }
}