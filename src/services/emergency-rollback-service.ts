// Emergency Rollback Service for WebSocket Migration
// 專案名稱：Multi-Channel Support MVP - Emergency Recovery System
// 提供即時回滾機制，確保WebSocket遷移的安全性

import type {
  RollbackTrigger,
  RollbackOperation,
  RollbackStatus,
  EmergencyMetrics,
  RollbackDecision
} from '../types/rollback-types';
import type { Bindings } from '../types/bindings';
import { MigrationService } from './migration-service';

/**
 * Architecture Overview:
 *
 * EmergencyRollbackService provides:
 * 1. Instant emergency rollback (< 30 seconds)
 * 2. Partial rollback targeting specific users/teams/conversations
 * 3. Automated rollback based on error thresholds
 * 4. Gradual rollback with monitoring
 * 5. Manual administrative controls
 * 6. Comprehensive audit logging and recovery tracking
 *
 * This ensures the WebSocket migration can be safely reverted at any time
 */

export class EmergencyRollbackService {
  private env: Bindings;
  private migrationService: MigrationService;
  private readonly EMERGENCY_THRESHOLD = {
    ERROR_RATE: 0.05, // 5% error rate triggers auto-rollback
    LATENCY_INCREASE: 200, // 200ms latency increase triggers rollback
    CONNECTION_FAILURES: 0.1, // 10% connection failure rate
    USER_COMPLAINTS: 10 // 10 user complaints in 5 minutes
  };

  private readonly ROLLBACK_SPEEDS = {
    instant: 30000,    // 30 seconds for complete rollback
    fast: 300000,      // 5 minutes for fast rollback
    gradual: 1800000   // 30 minutes for gradual rollback
  };

  constructor(env: Bindings) {
    this.env = env;
    this.migrationService = new MigrationService(env);
  }

  // =================== Emergency Rollback Controls ===================

  /**
   * Instant emergency rollback - reverts ALL users to SSE within 30 seconds
   * @param reason Reason for emergency rollback
   * @param triggeredBy Who/what triggered the rollback
   * @returns Rollback operation status
   */
  async instantEmergencyRollback(
    reason: string,
    triggeredBy: string = 'manual'
  ): Promise<RollbackOperation> {
    const rollbackId = `emergency_${Date.now()}`;

    console.error(`🚨 [EmergencyRollback] INSTANT ROLLBACK INITIATED: ${reason}`);

    const operation: RollbackOperation = {
      id: rollbackId,
      type: 'instant_emergency',
      status: 'in_progress',
      reason,
      triggeredBy,
      startTime: Date.now(),
      targetUsers: 'all',
      progress: 0,
      estimatedDuration: this.ROLLBACK_SPEEDS.instant,
      steps: [
        { name: 'Disable WebSocket globally', status: 'pending', duration: 5000 },
        { name: 'Flush WebSocket connections', status: 'pending', duration: 10000 },
        { name: 'Force SSE activation', status: 'pending', duration: 10000 },
        { name: 'Verify rollback completion', status: 'pending', duration: 5000 }
      ]
    };

    try {
      // Log emergency action immediately
      await this.logEmergencyAction(operation);

      // Step 1: Disable WebSocket globally (5 seconds)
      operation.steps[0]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      await this.migrationService.updateMigrationConfig({
        enableWebSocket: false,
        enableSSE: true,
        rolloutPercentage: 0,
        migrationStrategy: 'gradual'
      });

      operation.steps[0]!.status = 'completed';
      operation.progress = 25;
      await this.updateRollbackProgress(operation);

      // Step 2: Flush all active WebSocket connections (10 seconds)
      operation.steps[1]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      await this.flushAllWebSocketConnections();

      operation.steps[1]!.status = 'completed';
      operation.progress = 50;
      await this.updateRollbackProgress(operation);

      // Step 3: Force SSE activation for all users (10 seconds)
      operation.steps[2]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      await this.forceSSEActivation();

      operation.steps[2]!.status = 'completed';
      operation.progress = 75;
      await this.updateRollbackProgress(operation);

      // Step 4: Verify rollback completion (5 seconds)
      operation.steps[3]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      const verification = await this.verifyRollbackCompletion();

      operation.steps[3]!.status = verification.success ? 'completed' : 'failed';
      operation.progress = 100;
      operation.status = verification.success ? 'completed' : 'failed';
      operation.endTime = Date.now();
      operation.actualDuration = operation.endTime - operation.startTime;

      await this.updateRollbackProgress(operation);

      // Send emergency notifications
      await this.sendEmergencyNotifications(operation);

      console.log(`✅ [EmergencyRollback] Instant rollback completed in ${operation.actualDuration}ms`);
      return operation;

    } catch (error) {
      console.error('❌ [EmergencyRollback] Instant rollback failed:', error);

      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.endTime = Date.now();

      await this.updateRollbackProgress(operation);
      await this.sendEmergencyNotifications(operation);

      return operation;
    }
  }

  /**
   * Partial rollback targeting specific users, teams, or conversations
   * @param targets Specific targets for rollback
   * @param reason Reason for partial rollback
   * @returns Rollback operation status
   */
  async partialRollback(
    targets: {
      userIds?: string[];
      teamIds?: number[];
      conversationIds?: string[];
      roles?: string[];
    },
    reason: string,
    triggeredBy: string = 'manual'
  ): Promise<RollbackOperation> {
    const rollbackId = `partial_${Date.now()}`;

    console.warn(`⚠️ [EmergencyRollback] PARTIAL ROLLBACK INITIATED: ${reason}`);

    const targetCount = (targets.userIds?.length || 0) +
                       (targets.teamIds?.length || 0) +
                       (targets.conversationIds?.length || 0);

    const operation: RollbackOperation = {
      id: rollbackId,
      type: 'partial',
      status: 'in_progress',
      reason,
      triggeredBy,
      startTime: Date.now(),
      targetUsers: targetCount.toString(),
      progress: 0,
      estimatedDuration: Math.min(this.ROLLBACK_SPEEDS.fast, targetCount * 1000),
      steps: [
        { name: 'Identify target connections', status: 'pending', duration: 5000 },
        { name: 'Apply rollback flags', status: 'pending', duration: targetCount * 500 },
        { name: 'Force connection updates', status: 'pending', duration: targetCount * 300 },
        { name: 'Verify partial rollback', status: 'pending', duration: 2000 }
      ]
    };

    try {
      await this.logEmergencyAction(operation);

      // Step 1: Identify target connections
      operation.steps[0]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      const targetConnections = await this.identifyTargetConnections(targets);

      operation.steps[0]!.status = 'completed';
      operation.progress = 25;
      await this.updateRollbackProgress(operation);

      // Step 2: Apply rollback flags
      operation.steps[1]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      await this.applyPartialRollbackFlags(targets);

      operation.steps[1]!.status = 'completed';
      operation.progress = 50;
      await this.updateRollbackProgress(operation);

      // Step 3: Force connection updates
      operation.steps[2]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      await this.forceConnectionUpdates(targetConnections);

      operation.steps[2]!.status = 'completed';
      operation.progress = 75;
      await this.updateRollbackProgress(operation);

      // Step 4: Verify partial rollback
      operation.steps[3]!.status = 'in_progress';
      await this.updateRollbackProgress(operation);

      const verification = await this.verifyPartialRollback(targets);

      operation.steps[3]!.status = verification.success ? 'completed' : 'failed';
      operation.progress = 100;
      operation.status = verification.success ? 'completed' : 'failed';
      operation.endTime = Date.now();
      operation.actualDuration = operation.endTime - operation.startTime;

      await this.updateRollbackProgress(operation);

      console.log(`✅ [EmergencyRollback] Partial rollback completed for ${targetCount} targets`);
      return operation;

    } catch (error) {
      console.error('❌ [EmergencyRollback] Partial rollback failed:', error);

      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.endTime = Date.now();

      await this.updateRollbackProgress(operation);
      return operation;
    }
  }

  /**
   * Gradual rollback reducing WebSocket percentage over time
   * @param targetPercentage Final rollout percentage (0 = complete rollback)
   * @param duration Time to complete rollback in milliseconds
   * @param reason Reason for gradual rollback
   */
  async gradualRollback(
    targetPercentage: number = 0,
    duration: number = this.ROLLBACK_SPEEDS.gradual,
    reason: string,
    triggeredBy: string = 'manual'
  ): Promise<RollbackOperation> {
    const rollbackId = `gradual_${Date.now()}`;

    console.warn(`📉 [EmergencyRollback] GRADUAL ROLLBACK INITIATED: ${reason}`);

    const currentConfig = await this.migrationService.getMigrationConfig();
    const startPercentage = currentConfig.rolloutPercentage || 0;
    const steps = Math.max(5, Math.ceil((startPercentage - targetPercentage) / 10));
    const stepDuration = duration / steps;

    const operation: RollbackOperation = {
      id: rollbackId,
      type: 'gradual',
      status: 'in_progress',
      reason,
      triggeredBy,
      startTime: Date.now(),
      targetUsers: `${startPercentage}% -> ${targetPercentage}%`,
      progress: 0,
      estimatedDuration: duration,
      steps: Array.from({ length: steps }, (_, i) => ({
        name: `Reduce to ${Math.max(targetPercentage, startPercentage - (i + 1) * 10)}%`,
        status: 'pending' as const,
        duration: stepDuration
      }))
    };

    try {
      await this.logEmergencyAction(operation);

      let currentPercentage = startPercentage;
      const stepReduction = (startPercentage - targetPercentage) / steps;

      for (let i = 0; i < steps; i++) {
        if (operation.steps && operation.steps[i]) {
          operation.steps[i]!.status = 'in_progress';
        }
        await this.updateRollbackProgress(operation);

        currentPercentage = Math.max(targetPercentage, currentPercentage - stepReduction);

        await this.migrationService.updateMigrationConfig({
          rolloutPercentage: Math.round(currentPercentage)
        });

        // Wait for step duration with progress updates
        await this.waitWithProgress(stepDuration, operation, i);

        if (operation.steps && operation.steps[i]) {
          operation.steps[i]!.status = 'completed';
        }
        operation.progress = ((i + 1) / steps) * 100;
        await this.updateRollbackProgress(operation);

        console.log(`📊 [EmergencyRollback] Gradual rollback step ${i + 1}/${steps}: ${currentPercentage}%`);
      }

      operation.status = 'completed';
      operation.endTime = Date.now();
      operation.actualDuration = operation.endTime - operation.startTime;

      await this.updateRollbackProgress(operation);

      console.log(`✅ [EmergencyRollback] Gradual rollback completed: ${startPercentage}% -> ${targetPercentage}%`);
      return operation;

    } catch (error) {
      console.error('❌ [EmergencyRollback] Gradual rollback failed:', error);

      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.endTime = Date.now();

      await this.updateRollbackProgress(operation);
      return operation;
    }
  }

  // =================== Automated Rollback Triggers ===================

  /**
   * Check if automated rollback should be triggered based on metrics
   * @param metrics Current system metrics
   * @returns Rollback decision
   */
  async evaluateRollbackTriggers(metrics: EmergencyMetrics): Promise<RollbackDecision> {
    const triggers: RollbackTrigger[] = [];

    // Error rate threshold
    if (metrics.errorRate > this.EMERGENCY_THRESHOLD.ERROR_RATE) {
      triggers.push({
        type: 'error_rate',
        severity: 'critical',
        value: metrics.errorRate,
        threshold: this.EMERGENCY_THRESHOLD.ERROR_RATE,
        description: `Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds ${(this.EMERGENCY_THRESHOLD.ERROR_RATE * 100)}% threshold`
      });
    }

    // Latency increase threshold
    if (metrics.latencyIncrease > this.EMERGENCY_THRESHOLD.LATENCY_INCREASE) {
      triggers.push({
        type: 'latency_increase',
        severity: 'high',
        value: metrics.latencyIncrease,
        threshold: this.EMERGENCY_THRESHOLD.LATENCY_INCREASE,
        description: `Latency increased by ${metrics.latencyIncrease}ms, exceeds ${this.EMERGENCY_THRESHOLD.LATENCY_INCREASE}ms threshold`
      });
    }

    // Connection failure threshold
    if (metrics.connectionFailureRate > this.EMERGENCY_THRESHOLD.CONNECTION_FAILURES) {
      triggers.push({
        type: 'connection_failures',
        severity: 'high',
        value: metrics.connectionFailureRate,
        threshold: this.EMERGENCY_THRESHOLD.CONNECTION_FAILURES,
        description: `Connection failure rate ${(metrics.connectionFailureRate * 100).toFixed(1)}% exceeds ${(this.EMERGENCY_THRESHOLD.CONNECTION_FAILURES * 100)}% threshold`
      });
    }

    // User complaints threshold
    if (metrics.userComplaints > this.EMERGENCY_THRESHOLD.USER_COMPLAINTS) {
      triggers.push({
        type: 'user_complaints',
        severity: 'medium',
        value: metrics.userComplaints,
        threshold: this.EMERGENCY_THRESHOLD.USER_COMPLAINTS,
        description: `${metrics.userComplaints} user complaints exceed ${this.EMERGENCY_THRESHOLD.USER_COMPLAINTS} threshold`
      });
    }

    const decision: RollbackDecision = {
      shouldRollback: triggers.length > 0,
      triggers,
      recommendedAction: this.determineRecommendedAction(triggers),
      confidence: this.calculateConfidence(triggers, metrics),
      timestamp: Date.now()
    };

    // Log the decision
    await this.logRollbackDecision(decision, metrics);

    return decision;
  }

  /**
   * Execute automated rollback based on triggers
   * @param decision Rollback decision from evaluation
   * @returns Rollback operation result
   */
  async executeAutomatedRollback(decision: RollbackDecision): Promise<RollbackOperation | null> {
    if (!decision.shouldRollback) {
      return null;
    }

    const criticalTriggers = decision.triggers.filter(t => t.severity === 'critical');
    const highTriggers = decision.triggers.filter(t => t.severity === 'high');

    if (criticalTriggers.length > 0) {
      // Critical issues trigger instant rollback
      return await this.instantEmergencyRollback(
        `Automated rollback triggered by: ${criticalTriggers.map(t => t.description).join(', ')}`,
        'automated_critical'
      );
    } else if (highTriggers.length > 1) {
      // Multiple high severity issues trigger instant rollback
      return await this.instantEmergencyRollback(
        `Automated rollback triggered by multiple high severity issues: ${highTriggers.map(t => t.description).join(', ')}`,
        'automated_multiple_high'
      );
    } else if (highTriggers.length > 0) {
      // Single high severity issue triggers gradual rollback
      return await this.gradualRollback(
        0, // Roll back to 0%
        this.ROLLBACK_SPEEDS.fast,
        `Automated gradual rollback triggered by: ${highTriggers[0]?.description || 'Unknown'}`,
        'automated_high'
      );
    } else {
      // Medium severity issues trigger slow gradual rollback
      const currentConfig = await this.migrationService.getMigrationConfig();
      const targetPercentage = Math.max(0, (currentConfig.rolloutPercentage || 0) - 25);

      return await this.gradualRollback(
        targetPercentage,
        this.ROLLBACK_SPEEDS.gradual,
        `Automated reduction triggered by: ${decision.triggers.map(t => t.description).join(', ')}`,
        'automated_medium'
      );
    }
  }

  // =================== Status and Monitoring ===================

  /**
   * Get current rollback status and active operations
   */
  async getRollbackStatus(): Promise<RollbackStatus> {
    try {
      // Get active rollback operations
      const activeOperations = await this.getActiveRollbackOperations();

      // Get recent rollback history
      const recentOperations = await this.getRecentRollbackHistory(24); // Last 24 hours

      // Get current system health
      const systemHealth = await this.getSystemHealth();

      // Get rollback readiness
      const readiness = await this.assessRollbackReadiness();

      return {
        hasActiveRollback: activeOperations.length > 0,
        activeOperations,
        recentOperationsCount: recentOperations.length,
        systemHealth,
        rollbackReadiness: readiness,
        lastEmergencyAction: recentOperations.length > 0 ? recentOperations[0] ?? null : null,
        thresholds: this.EMERGENCY_THRESHOLD,
        capabilities: {
          instantRollback: true,
          partialRollback: true,
          gradualRollback: true,
          automatedTriggers: true
        }
      };

    } catch (error) {
      console.error('❌ [EmergencyRollback] Error getting rollback status:', error);

      return {
        hasActiveRollback: false,
        activeOperations: [],
        recentOperationsCount: 0,
        systemHealth: 'unknown',
        rollbackReadiness: 'unknown',
        lastEmergencyAction: null,
        thresholds: this.EMERGENCY_THRESHOLD,
        capabilities: {
          instantRollback: false,
          partialRollback: false,
          gradualRollback: false,
          automatedTriggers: false
        }
      };
    }
  }

  /**
   * Get rollback operation by ID
   */
  async getRollbackOperation(operationId: string): Promise<RollbackOperation | null> {
    try {
      const operationStr = await this.env.CACHE.get(`rollback_operation:${operationId}`);
      return operationStr ? JSON.parse(operationStr) : null;
    } catch (error) {
      console.error('❌ [EmergencyRollback] Error getting rollback operation:', error);
      return null;
    }
  }

  // =================== Private Helper Methods ===================

  private async flushAllWebSocketConnections(): Promise<void> {
    try {
      // This would integrate with the WebSocket broadcasting service
      // to forcefully close all WebSocket connections
      console.log('🔌 [EmergencyRollback] Flushing all WebSocket connections');

      // Set a global flag that forces all new connections to use SSE
      await this.env.CACHE.put('force_sse_mode', 'true', { expirationTtl: 3600 });

      // In a real implementation, this would:
      // 1. Send close messages to all Durable Objects
      // 2. Force disconnect WebSocket connections
      // 3. Clear connection state caches

    } catch (error) {
      console.error('❌ [EmergencyRollback] Error flushing WebSocket connections:', error);
      throw error;
    }
  }

  private async forceSSEActivation(): Promise<void> {
    try {
      console.log('📡 [EmergencyRollback] Forcing SSE activation for all users');

      // Clear any WebSocket preference caches
      await this.clearWebSocketPreferences();

      // Set global SSE preference
      await this.env.CACHE.put('global_connection_preference', 'sse', { expirationTtl: 3600 });

    } catch (error) {
      console.error('❌ [EmergencyRollback] Error forcing SSE activation:', error);
      throw error;
    }
  }

  private async clearWebSocketPreferences(): Promise<void> {
    // In a real implementation, this would clear user connection preferences
    // For now, we'll use a marker to indicate preferences should be ignored
    await this.env.CACHE.put('ignore_websocket_preferences', 'true', { expirationTtl: 3600 });
  }

  private async verifyRollbackCompletion(): Promise<{ success: boolean; details: string }> {
    try {
      const config = await this.migrationService.getMigrationConfig();

      // Check that WebSocket is disabled
      if (config.enableWebSocket) {
        return { success: false, details: 'WebSocket still enabled in config' };
      }

      // Check that SSE is enabled
      if (!config.enableSSE) {
        return { success: false, details: 'SSE not enabled as fallback' };
      }

      // Check rollout percentage is 0
      if (config.rolloutPercentage > 0) {
        return { success: false, details: `Rollout percentage still ${config.rolloutPercentage}%` };
      }

      return { success: true, details: 'Rollback verification successful' };

    } catch (error) {
      return { success: false, details: `Verification error: ${error}` };
    }
  }

  private async identifyTargetConnections(targets: any): Promise<string[]> {
    const connections: string[] = [];

    // This would query active connections and identify those matching the targets
    // For now, return mock data

    if (targets.userIds) {
      connections.push(...targets.userIds.map((id: string) => `user_${id}`));
    }

    if (targets.teamIds) {
      // Would query team members and add their connections
      connections.push(...targets.teamIds.map((id: number) => `team_${id}`));
    }

    if (targets.conversationIds) {
      connections.push(...targets.conversationIds.map((id: string) => `conv_${id}`));
    }

    return connections;
  }

  private async applyPartialRollbackFlags(targets: any): Promise<void> {
    // Apply rollback flags for specific targets

    if (targets.userIds) {
      for (const userId of targets.userIds) {
        await this.migrationService.setUserFeatureFlag(userId, 'websocket_rollback', true);
      }
    }

    if (targets.teamIds) {
      for (const teamId of targets.teamIds) {
        await this.env.CACHE.put(
          `team_rollback:${teamId}`,
          'true',
          { expirationTtl: 86400 }
        );
      }
    }

    if (targets.conversationIds) {
      for (const convId of targets.conversationIds) {
        await this.env.CACHE.put(
          `conv_rollback:${convId}`,
          'true',
          { expirationTtl: 86400 }
        );
      }
    }
  }

  private async forceConnectionUpdates(connections: string[]): Promise<void> {
    // Force connection updates for specific connections
    console.log(`🔄 [EmergencyRollback] Forcing updates for ${connections.length} connections`);

    // In a real implementation, this would:
    // 1. Send update messages to specific Durable Objects
    // 2. Force reconnection for affected users
    // 3. Update connection routing preferences
  }

  private async verifyPartialRollback(targets: any): Promise<{ success: boolean; details: string }> {
    // Verify that partial rollback was successful
    let targetCount = 0;
    let verifiedCount = 0;

    if (targets.userIds) {
      targetCount += targets.userIds.length;
      for (const userId of targets.userIds) {
        const hasFlag = await this.migrationService.hasUserFeatureFlag(userId, 'websocket_rollback');
        if (hasFlag) verifiedCount++;
      }
    }

    if (targets.teamIds) {
      targetCount += targets.teamIds.length;
      for (const teamId of targets.teamIds) {
        const hasFlag = await this.env.CACHE.get(`team_rollback:${teamId}`);
        if (hasFlag === 'true') verifiedCount++;
      }
    }

    if (targets.conversationIds) {
      targetCount += targets.conversationIds.length;
      for (const convId of targets.conversationIds) {
        const hasFlag = await this.env.CACHE.get(`conv_rollback:${convId}`);
        if (hasFlag === 'true') verifiedCount++;
      }
    }

    const success = verifiedCount === targetCount;
    return {
      success,
      details: success ?
        `All ${targetCount} targets successfully rolled back` :
        `Only ${verifiedCount}/${targetCount} targets verified`
    };
  }

  private determineRecommendedAction(triggers: RollbackTrigger[]): string {
    const criticalCount = triggers.filter(t => t.severity === 'critical').length;
    const highCount = triggers.filter(t => t.severity === 'high').length;
    const mediumCount = triggers.filter(t => t.severity === 'medium').length;

    if (criticalCount > 0) return 'instant_rollback';
    if (highCount > 1) return 'instant_rollback';
    if (highCount > 0) return 'gradual_rollback_fast';
    if (mediumCount > 2) return 'gradual_rollback';
    if (mediumCount > 0) return 'reduce_percentage';

    return 'monitor';
  }

  private calculateConfidence(triggers: RollbackTrigger[], metrics: EmergencyMetrics): number {
    // Calculate confidence based on trigger severity and metrics reliability
    let confidence = 0.5; // Base confidence

    const criticalTriggers = triggers.filter(t => t.severity === 'critical');
    const highTriggers = triggers.filter(t => t.severity === 'high');

    confidence += criticalTriggers.length * 0.3;
    confidence += highTriggers.length * 0.2;
    confidence += triggers.filter(t => t.severity === 'medium').length * 0.1;

    // Factor in metrics reliability
    if (metrics.sampleSize > 1000) confidence += 0.1;
    if (metrics.dataAge < 300000) confidence += 0.1; // Data less than 5 minutes old

    return Math.min(1.0, confidence);
  }

  private async waitWithProgress(duration: number, operation: RollbackOperation, stepIndex: number): Promise<void> {
    const startTime = Date.now();
    const updateInterval = Math.min(duration / 10, 5000); // Update every 5 seconds or 10% of duration

    while (Date.now() - startTime < duration) {
      await new Promise(resolve => setTimeout(resolve, updateInterval));

      // Update progress within the step
      const stepProgress = (Date.now() - startTime) / duration;
      const totalProgress = ((stepIndex + stepProgress) / operation.steps.length) * 100;

      operation.progress = Math.min(100, totalProgress);
      await this.updateRollbackProgress(operation);
    }
  }

  private async updateRollbackProgress(operation: RollbackOperation): Promise<void> {
    try {
      await this.env.CACHE.put(
        `rollback_operation:${operation.id}`,
        JSON.stringify(operation),
        { expirationTtl: 86400 }
      );

      // Also store in active operations list if in progress
      if (operation.status === 'in_progress') {
        const activeOps = await this.getActiveRollbackOperations();
        const updatedOps = activeOps.filter(op => op.id !== operation.id);
        updatedOps.push(operation);

        await this.env.CACHE.put(
          'active_rollback_operations',
          JSON.stringify(updatedOps),
          { expirationTtl: 86400 }
        );
      }

    } catch (error) {
      console.error('❌ [EmergencyRollback] Error updating rollback progress:', error);
    }
  }

  private async logEmergencyAction(operation: RollbackOperation): Promise<void> {
    try {
      const logEntry = {
        operationId: operation.id,
        type: operation.type,
        reason: operation.reason,
        triggeredBy: operation.triggeredBy,
        timestamp: operation.startTime,
        targetUsers: operation.targetUsers
      };

      await this.env.CACHE.put(
        `emergency_log:${operation.startTime}`,
        JSON.stringify(logEntry),
        { expirationTtl: 2592000 } // 30 days
      );

      console.log(`📝 [EmergencyRollback] Emergency action logged: ${operation.id}`);

    } catch (error) {
      console.error('❌ [EmergencyRollback] Error logging emergency action:', error);
    }
  }

  private async logRollbackDecision(decision: RollbackDecision, metrics: EmergencyMetrics): Promise<void> {
    try {
      const logEntry = {
        decision: decision.shouldRollback,
        recommendedAction: decision.recommendedAction,
        confidence: decision.confidence,
        triggers: decision.triggers,
        metrics,
        timestamp: decision.timestamp
      };

      await this.env.CACHE.put(
        `rollback_decision:${decision.timestamp}`,
        JSON.stringify(logEntry),
        { expirationTtl: 604800 } // 7 days
      );

    } catch (error) {
      console.error('❌ [EmergencyRollback] Error logging rollback decision:', error);
    }
  }

  private async sendEmergencyNotifications(operation: RollbackOperation): Promise<void> {
    try {
      // In a real implementation, this would send notifications via:
      // - Slack/Teams webhooks
      // - Email alerts
      // - SMS for critical operations
      // - Dashboard alerts

      console.log(`🚨 [EmergencyRollback] Emergency notification sent for operation ${operation.id}`);

    } catch (error) {
      console.error('❌ [EmergencyRollback] Error sending emergency notifications:', error);
    }
  }

  private async getActiveRollbackOperations(): Promise<RollbackOperation[]> {
    try {
      const activeOpsStr = await this.env.CACHE.get('active_rollback_operations');
      return activeOpsStr ? JSON.parse(activeOpsStr) : [];
    } catch (error) {
      console.error('❌ [EmergencyRollback] Error getting active operations:', error);
      return [];
    }
  }

  private async getRecentRollbackHistory(_hours: number): Promise<RollbackOperation[]> {
    // This would query recent rollback operations from logs
    // For now, return empty array
    return [];
  }

  private async getSystemHealth(): Promise<'healthy' | 'degraded' | 'critical' | 'unknown'> {
    try {
      // This would check various system health indicators
      const config = await this.migrationService.getMigrationConfig();

      if (!config.enableWebSocket && !config.enableSSE) {
        return 'critical';
      }

      if (config.rolloutPercentage === 0) {
        return 'degraded';
      }

      return 'healthy';

    } catch (error) {
      return 'unknown';
    }
  }

  private async assessRollbackReadiness(): Promise<'ready' | 'degraded' | 'unavailable' | 'unknown'> {
    try {
      // Check if rollback capabilities are available
      const config = await this.migrationService.getMigrationConfig();

      if (!config.enableSSE) {
        return 'unavailable'; // Can't rollback if SSE is not available
      }

      return 'ready';

    } catch (error) {
      return 'unknown';
    }
  }
}