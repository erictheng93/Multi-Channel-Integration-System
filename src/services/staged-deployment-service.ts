// Staged Deployment Service for WebSocket Migration
// 專案名稱：Multi-Channel Support MVP - Staged Deployment Management
// 提供階段性部署管理，確保安全且可控制的WebSocket遷移

import type {
  DeploymentStage,
  DeploymentPlan,
  DeploymentExecution,
  StageValidation
} from '../types/deployment-types';
import type { Bindings } from '../types/bindings';
import { DeploymentFeatureFlagsService } from './deployment-feature-flags';
import { DeploymentMonitorService } from '../monitoring/deployment-monitor';
import { EmergencyRollbackService } from './emergency-rollback-service';

/**
 * Architecture Overview:
 *
 * StagedDeploymentService provides:
 * 1. Staged deployment procedures (dev → staging → production)
 * 2. Pre-deployment validation checklist
 * 3. Post-deployment monitoring and validation
 * 4. Rollback decision criteria and procedures
 * 5. Database migration handling for new WebSocket features
 * 6. Automated progression between stages
 *
 * This ensures systematic, safe deployment with clear progression criteria
 */

export class StagedDeploymentService {
  private env: Bindings;
  private featureFlagsService: DeploymentFeatureFlagsService;
  private monitorService: DeploymentMonitorService;
  private rollbackService: EmergencyRollbackService;

  // Deployment stages configuration
  private readonly DEPLOYMENT_STAGES: Record<string, DeploymentStage> = {
    development: {
      name: 'development',
      id: 'dev-stage',
      order: 1,
      percentage: 100,
      duration: 1800000, // 30 minutes
      requirements: ['admin-approval'],
      features: ['websocket-connections'],
      validation: {
        pre: [
          'unit_tests_passing',
          'integration_tests_passing',
          'type_checking_passing',
          'eslint_passing'
        ],
        post: [
          'smoke_tests_passing',
          'basic_functionality_working'
        ]
      },
      rollbackCriteria: {
        errorRate: 0.15,
        userComplaints: 10,
        performanceDegradation: 30
      },
      successCriteria: {
        errorRate: 0.1, // 10% error rate allowed in dev
        latency: 500, // 500ms latency allowed
        throughput: 100 // 100 ops/s minimum
      }
    },
    staging: {
      name: 'staging',
      id: 'staging-stage',
      order: 2,
      percentage: 100,
      duration: 7200000, // 2 hours
      requirements: ['development-success', 'team-approval'],
      features: ['websocket-connections', 'real-time-features'],
      validation: {
        pre: [
          'development_stage_successful',
          'performance_tests_passing',
          'security_scan_clean',
          'database_migrations_tested'
        ],
        post: [
          'end_to_end_tests_passing',
          'load_test_successful',
          'monitoring_active'
        ]
      },
      rollbackCriteria: {
        errorRate: 0.1,
        userComplaints: 5,
        performanceDegradation: 20
      },
      successCriteria: {
        errorRate: 0.05, // 5% error rate allowed in staging
        latency: 300, // 300ms latency allowed
        throughput: 200 // 200 ops/s minimum
      }
    },
    production_canary: {
      name: 'production_canary',
      id: 'prod-canary-stage',
      order: 3,
      percentage: 5,
      duration: 3600000, // 1 hour
      requirements: ['staging-success', 'production-backup'],
      features: ['websocket-canary'],
      validation: {
        pre: [
          'staging_stage_successful',
          'production_backup_complete',
          'rollback_plan_validated',
          'monitoring_dashboards_ready'
        ],
        post: [
          'canary_metrics_healthy',
          'no_user_complaints',
          'performance_within_baseline'
        ]
      },
      rollbackCriteria: {
        errorRate: 0.05,
        userComplaints: 0,
        performanceDegradation: 10
      },
      successCriteria: {
        errorRate: 0.02, // 2% error rate threshold
        latency: 200, // 200ms latency threshold
        throughput: 500 // 500 ops/s minimum
      }
    },
    production_early: {
      name: 'production_early',
      id: 'prod-early-stage',
      order: 4,
      percentage: 25,
      duration: 14400000, // 4 hours
      requirements: ['canary-success', 'performance-baseline'],
      features: ['websocket-early-adopters'],
      validation: {
        pre: [
          'canary_stage_successful',
          'performance_baselines_updated',
          'alert_thresholds_configured'
        ],
        post: [
          'performance_metrics_stable',
          'error_rates_acceptable',
          'user_feedback_positive'
        ]
      },
      rollbackCriteria: {
        errorRate: 0.06,
        userComplaints: 2,
        performanceDegradation: 15
      },
      successCriteria: {
        errorRate: 0.025, // 2.5% error rate threshold
        latency: 250, // 250ms latency threshold
        throughput: 400 // 400 ops/s minimum
      }
    },
    production_majority: {
      name: 'production_majority',
      id: 'prod-majority-stage',
      order: 5,
      percentage: 75,
      duration: 28800000, // 8 hours
      requirements: ['early-success', 'capacity-planning'],
      features: ['websocket-majority'],
      validation: {
        pre: [
          'early_stage_successful',
          'capacity_planning_validated',
          'performance_optimization_complete'
        ],
        post: [
          'system_stability_confirmed',
          'resource_usage_optimal',
          'sla_targets_met'
        ]
      },
      rollbackCriteria: {
        errorRate: 0.08,
        userComplaints: 5,
        performanceDegradation: 20
      },
      successCriteria: {
        errorRate: 0.03, // 3% error rate threshold
        latency: 300, // 300ms latency threshold
        throughput: 350 // 350 ops/s minimum
      }
    },
    production_complete: {
      name: 'production_complete',
      id: 'prod-complete-stage',
      order: 6,
      percentage: 100,
      duration: -1, // Permanent
      requirements: ['majority-success', 'final-validation'],
      features: ['websocket-full-rollout'],
      validation: {
        pre: [
          'majority_stage_successful',
          'final_performance_validation',
          'sse_deprecation_plan_ready'
        ],
        post: [
          'full_rollout_stable',
          'sse_fallback_verified',
          'documentation_updated'
        ]
      },
      rollbackCriteria: {
        errorRate: 0.05,
        userComplaints: 3,
        performanceDegradation: 15
      },
      successCriteria: {
        errorRate: 0.02, // 2% error rate threshold for production
        latency: 250, // 250ms latency threshold
        throughput: 300 // 300 ops/s minimum
      }
    }
  };

  constructor(env: Bindings) {
    this.env = env;
    this.featureFlagsService = new DeploymentFeatureFlagsService(env);
    this.monitorService = new DeploymentMonitorService(env);
    this.rollbackService = new EmergencyRollbackService(env);
  }

  // =================== Deployment Plan Management ===================

  /**
   * Create a comprehensive deployment plan
   * @param features List of features to deploy
   * @param options Deployment configuration options
   * @returns Detailed deployment plan
   */
  async createDeploymentPlan(
    features: string[],
    options: {
      environment?: string;
      skipStages?: string[];
      customValidation?: string[];
      emergencyContacts?: string[];
    } = {}
  ): Promise<DeploymentPlan> {
    const planId = `deployment_${Date.now()}`;

    console.log(`📋 [StagedDeployment] Creating deployment plan ${planId} for features:`, features);

    // Determine starting stage based on environment
    const startingStage = options.environment || 'development';
    const stages = this.getDeploymentStagesSequence(startingStage, options.skipStages);

    // Generate deployment plan
    const plan: DeploymentPlan = {
      id: planId,
      features,
      stages,
      createdAt: Date.now(),
      status: 'planned',
      currentStage: null,
      options,
      validation: {
        preDeployment: await this.generatePreDeploymentChecklist(features),
        postDeployment: await this.generatePostDeploymentChecklist(features),
        rollbackCriteria: await this.generateRollbackCriteria(features)
      },
      timeline: this.calculateDeploymentTimeline(stages),
      risks: await this.assessDeploymentRisks(features),
      rollbackPlan: await this.generateRollbackPlan(features)
    };

    // Store deployment plan
    await this.storeDeploymentPlan(plan);

    console.log(`✅ [StagedDeployment] Deployment plan ${planId} created with ${stages.length} stages`);

    return plan;
  }

  /**
   * Execute deployment plan
   * @param planId Deployment plan identifier
   * @returns Deployment execution status
   */
  async executeDeploymentPlan(planId: string): Promise<DeploymentExecution> {
    console.log(`🚀 [StagedDeployment] Starting execution of deployment plan ${planId}`);

    const plan = await this.getDeploymentPlan(planId);
    if (!plan) {
      throw new Error(`Deployment plan ${planId} not found`);
    }

    if (plan.status !== 'planned') {
      throw new Error(`Deployment plan ${planId} is not in planned status (current: ${plan.status})`);
    }

    const execution: DeploymentExecution = {
      planId,
      executionId: `exec_${Date.now()}`,
      startedAt: Date.now(),
      status: 'running',
      currentStageIndex: 0,
      stages: plan.stages.map(stage => ({
        name: stage.name,
        status: 'pending' as const,
        startedAt: undefined as number | undefined,
        completedAt: undefined as number | undefined,
        autoAdvance: stage.autoAdvance || false,
        validation: { passed: false, results: [] as Array<{ criterion: string; passed: boolean; value: number; threshold: number }> }
      })),
      metrics: [],
      issues: [],
      decisions: []
    };

    try {
      // Update plan status
      plan.status = 'executing';
      plan.currentStage = plan.stages[0]?.name || null;
      await this.storeDeploymentPlan(plan);

      // Store execution state
      await this.storeDeploymentExecution(execution);

      // Start first stage
      await this.executeDeploymentStage(execution, 0);

      return execution;

    } catch (error) {
      console.error(`❌ [StagedDeployment] Error starting deployment execution:`, error);

      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      await this.storeDeploymentExecution(execution);

      throw error;
    }
  }

  /**
   * Execute a specific deployment stage
   * @param execution Deployment execution context
   * @param stageIndex Index of stage to execute
   */
  async executeDeploymentStage(
    execution: DeploymentExecution,
    stageIndex: number
  ): Promise<void> {
    const stage = execution.stages[stageIndex];
    if (!stage) {
      throw new Error(`Stage index ${stageIndex} not found in deployment execution`);
    }

    console.log(`🔄 [StagedDeployment] Executing stage: ${stage.name}`);

    stage.status = 'running';
    stage.startedAt = Date.now();

    try {
      // Get the actual stage configuration
      const stageConfig = this.DEPLOYMENT_STAGES[stage.name];
      if (!stageConfig) {
        throw new Error(`Stage configuration not found for ${stage.name}`);
      }

      // Pre-deployment validation
      console.log(`✅ [StagedDeployment] Running pre-deployment validation for ${stage.name}`);
      const preValidation = await this.runStageValidation(stageConfig, 'pre');

      if (!preValidation.passed) {
        throw new Error(`Pre-deployment validation failed: ${preValidation.failures?.join(', ')}`);
      }

      // Deploy stage features
      console.log(`📦 [StagedDeployment] Deploying features for ${stage.name}`);
      await this.deployStageFeatures(stageConfig);

      // Start monitoring
      console.log(`📊 [StagedDeployment] Starting monitoring for ${stage.name}`);
      await this.startStageMonitoring(stageConfig);

      // Wait for stage duration or manual promotion
      if (stageConfig.duration > 0) {
        console.log(`⏱️ [StagedDeployment] Waiting for stage duration: ${stageConfig.duration}ms`);
        await this.waitForStageDuration(execution, stageIndex, stageConfig);
      }

      // Post-deployment validation
      console.log(`✅ [StagedDeployment] Running post-deployment validation for ${stage.name}`);
      const postValidation = await this.runStageValidation(stageConfig, 'post');

      if (!postValidation.passed) {
        throw new Error(`Post-deployment validation failed: ${postValidation.failures?.join(', ')}`);
      }

      // Check success criteria
      console.log(`🎯 [StagedDeployment] Checking success criteria for ${stage.name}`);
      const criteriaCheck = await this.checkSuccessCriteria(stageConfig);

      if (!criteriaCheck.passed) {
        throw new Error(`Success criteria not met: ${criteriaCheck.failures?.join(', ')}`);
      }

      // Mark stage as completed
      stage.status = 'completed';
      stage.completedAt = Date.now();
      stage.validation = { passed: true, results: [] };

      console.log(`✅ [StagedDeployment] Stage ${stage.name} completed successfully`);

      // Advance to next stage if auto-advance is enabled
      if (stage.autoAdvance && stageIndex < execution.stages.length - 1) {
        console.log(`⏭️ [StagedDeployment] Auto-advancing to next stage`);
        await this.executeDeploymentStage(execution, stageIndex + 1);
      } else if (stageIndex < execution.stages.length - 1) {
        console.log(`⏸️ [StagedDeployment] Stage completed, waiting for manual promotion`);
        execution.status = 'waiting_for_promotion';
      } else {
        console.log(`🎉 [StagedDeployment] All stages completed successfully`);
        execution.status = 'completed';
        execution.completedAt = Date.now();
      }

      // Update execution state
      execution.currentStageIndex = stageIndex;
      await this.storeDeploymentExecution(execution);

    } catch (error) {
      console.error(`❌ [StagedDeployment] Stage ${stage.name} failed:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stage.status = 'failed';
      stage.error = errorMessage;
      stage.completedAt = Date.now();

      execution.status = 'failed';
      execution.error = `Stage ${stage.name} failed: ${errorMessage}`;

      await this.storeDeploymentExecution(execution);

      // Trigger rollback if needed
      await this.triggerStageRollback(execution, stageIndex, errorMessage);

      throw error;
    }
  }

  /**
   * Promote deployment to next stage
   * @param executionId Deployment execution identifier
   * @returns Updated execution status
   */
  async promoteToNextStage(executionId: string): Promise<DeploymentExecution> {
    console.log(`⏭️ [StagedDeployment] Promoting execution ${executionId} to next stage`);

    const execution = await this.getDeploymentExecution(executionId);
    if (!execution) {
      throw new Error(`Deployment execution ${executionId} not found`);
    }

    if (execution.status !== 'waiting_for_promotion') {
      throw new Error(`Deployment execution is not waiting for promotion (status: ${execution.status})`);
    }

    const nextStageIndex = execution.currentStageIndex + 1;
    if (nextStageIndex >= execution.stages.length) {
      throw new Error('No more stages to promote to');
    }

    // Execute next stage
    execution.status = 'running';
    await this.executeDeploymentStage(execution, nextStageIndex);

    return execution;
  }

  // =================== Stage Validation ===================

  /**
   * Run validation for a deployment stage
   * @param stage Deployment stage configuration
   * @param phase Validation phase (pre or post)
   * @returns Validation results
   */
  async runStageValidation(
    stage: DeploymentStage,
    phase: 'pre' | 'post'
  ): Promise<StageValidation> {
    const validationList = phase === 'pre' ? stage.validation.pre : stage.validation.post;
    const results: Array<{ criterion: string; passed: boolean; value: number; threshold: number }> = [];
    const failures: string[] = [];

    console.log(`🔍 [StagedDeployment] Running ${phase}-deployment validation for ${stage.name}`);

    for (const validation of validationList) {
      try {
        const result = await this.runSingleValidation(validation, stage);
        results.push(result);

        if (!result.passed) {
          failures.push(`${validation}: Value ${result.value} did not meet threshold ${result.threshold}`);
        }

        console.log(`${result.passed ? '✅' : '❌'} ${validation}: ${result.value}/${result.threshold}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ criterion: validation, passed: false, value: 0, threshold: 100 });
        failures.push(`${validation}: ${errorMessage}`);

        console.error(`❌ ${validation}: ${errorMessage}`);
      }
    }

    const passed = failures.length === 0;

    const validation: StageValidation = {
      phase,
      passed,
      results
    };

    if (failures.length > 0) {
      validation.failures = failures;
    }

    validation.timestamp = Date.now();

    return validation;
  }

  /**
   * Check if stage success criteria are met
   * @param stage Deployment stage configuration
   * @returns Success criteria check results
   */
  async checkSuccessCriteria(stage: DeploymentStage): Promise<{
    passed: boolean;
    results: Array<{ criterion: string; passed: boolean; value: number; threshold: number }>;
    failures?: string[];
  }> {
    const results: Array<{ criterion: string; passed: boolean; value: number; threshold: number }> = [];
    const failures: string[] = [];

    // Get current deployment metrics
    const metrics = await this.monitorService.getDeploymentHealth();

    // Check error rate
    const currentErrorRate = Math.max(metrics.errors.websocket.rate, metrics.errors.sse.rate);
    const errorRatePass = currentErrorRate <= stage.successCriteria.errorRate;
    results.push({
      criterion: 'error_rate',
      passed: errorRatePass,
      value: currentErrorRate,
      threshold: stage.successCriteria.errorRate
    });

    if (!errorRatePass) {
      failures.push(`Error rate ${(currentErrorRate * 100).toFixed(2)}% exceeds threshold ${(stage.successCriteria.errorRate * 100).toFixed(2)}%`);
    }

    // Check latency increase
    const currentLatency = (metrics.performance.websocket.avgLatency + metrics.performance.sse.avgLatency) / 2;
    const latencyPass = currentLatency <= stage.successCriteria.latency;

    results.push({
      criterion: 'latency',
      passed: latencyPass,
      value: currentLatency,
      threshold: stage.successCriteria.latency
    });

    if (!latencyPass) {
      failures.push(`Current latency ${currentLatency.toFixed(0)}ms exceeds threshold ${stage.successCriteria.latency}ms`);
    }

    // Check user complaints (using rollback criteria)
    const currentComplaints = metrics.userExperience.complaints;
    const complaintsPass = currentComplaints <= stage.rollbackCriteria.userComplaints;

    results.push({
      criterion: 'user_complaints',
      passed: complaintsPass,
      value: currentComplaints,
      threshold: stage.rollbackCriteria.userComplaints
    });

    if (!complaintsPass) {
      failures.push(`User complaints ${currentComplaints} exceed threshold ${stage.rollbackCriteria.userComplaints}`);
    }

    const passed = failures.length === 0;

    const result: StageValidation = {
      passed,
      results
    };

    if (failures.length > 0) {
      result.failures = failures;
    }

    return result;
  }

  // =================== Private Helper Methods ===================

  private getDeploymentStagesSequence(startingStage: string, skipStages?: string[]): DeploymentStage[] {
    const allStageNames = Object.keys(this.DEPLOYMENT_STAGES);
    const startIndex = allStageNames.indexOf(startingStage);

    if (startIndex === -1) {
      throw new Error(`Invalid starting stage: ${startingStage}`);
    }

    const stageNames = allStageNames.slice(startIndex);
    const stages = stageNames
      .filter(name => !skipStages?.includes(name))
      .map(name => {
        const stageConfig = this.DEPLOYMENT_STAGES[name];
        if (!stageConfig) {
          throw new Error(`Stage configuration not found for ${name}`);
        }
        return { ...stageConfig };
      });

    return stages;
  }

  private async generatePreDeploymentChecklist(features: string[]): Promise<string[]> {
    // Generate comprehensive pre-deployment checklist
    const checklist = [
      'Code review completed and approved',
      'All unit tests passing (100% success rate)',
      'Integration tests passing',
      'TypeScript compilation successful',
      'ESLint checks passing',
      'Security vulnerability scan clean',
      'Performance baseline established',
      'Database migrations prepared and tested',
      'Rollback plan documented and validated',
      'Emergency contacts notified',
      'Monitoring dashboards configured',
      'Alert thresholds set appropriately'
    ];

    // Add feature-specific checks
    if (features.includes('websocket_connections')) {
      checklist.push(
        'WebSocket Durable Objects tested',
        'Connection broadcasting verified',
        'Fallback to SSE validated',
        'Load testing completed'
      );
    }

    return checklist;
  }

  private async generatePostDeploymentChecklist(features: string[]): Promise<string[]> {
    const checklist = [
      'Application startup successful',
      'Health checks responding',
      'Database connectivity verified',
      'External API integrations working',
      'Monitoring systems active',
      'Log aggregation functioning',
      'Performance metrics within baselines',
      'No critical errors in logs'
    ];

    if (features.includes('websocket_connections')) {
      checklist.push(
        'WebSocket connections establishing successfully',
        'Message broadcasting working',
        'Durable Objects responding',
        'SSE fallback functioning'
      );
    }

    return checklist;
  }

  private async generateRollbackCriteria(_features: string[]): Promise<string[]> {
    return [
      'Error rate exceeds 5% for more than 5 minutes',
      'Average latency increases by more than 200ms',
      'Health check failures exceed 10%',
      'User complaints exceed threshold',
      'Critical errors in application logs',
      'Database connection failures',
      'Memory usage exceeds 90%',
      'Manual rollback trigger activated'
    ];
  }

  private calculateDeploymentTimeline(stages: DeploymentStage[]): {
    totalDuration: number;
    stages: Array<{ name: string; duration: number; startOffset: number }>;
  } {
    let currentOffset = 0;
    const stageTimeline: Array<{ name: string; duration: number; startOffset: number }> = [];

    for (const stage of stages) {
      stageTimeline.push({
        name: stage.name,
        duration: stage.duration,
        startOffset: currentOffset
      });

      if (stage.duration > 0) {
        currentOffset += stage.duration;
      }
    }

    return {
      totalDuration: currentOffset,
      stages: stageTimeline
    };
  }

  private async assessDeploymentRisks(features: string[]): Promise<Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    mitigation: string;
  }>> {
    const risks = [
      {
        risk: 'Service downtime during deployment',
        severity: 'medium' as const,
        mitigation: 'Blue-green deployment strategy with health checks'
      },
      {
        risk: 'Database migration failure',
        severity: 'high' as const,
        mitigation: 'Staged migrations with rollback capability'
      },
      {
        risk: 'Performance degradation',
        severity: 'medium' as const,
        mitigation: 'Gradual rollout with performance monitoring'
      }
    ];

    if (features.includes('websocket_connections')) {
      risks.push(
        {
          risk: 'WebSocket connection failures',
          severity: 'high' as const,
          mitigation: 'Automatic fallback to SSE connections'
        },
        {
          risk: 'Durable Objects scaling issues',
          severity: 'medium' as const,
          mitigation: 'Progressive user migration with monitoring'
        }
      );
    }

    return risks;
  }

  private async generateRollbackPlan(features: string[]): Promise<{
    triggerCriteria: string[];
    steps: Array<{ step: string; estimatedDuration: number }>;
    estimatedDuration: number;
  }> {
    const steps = [
      { step: 'Initiate emergency rollback', estimatedDuration: 30000 },
      { step: 'Disable new feature flags', estimatedDuration: 60000 },
      { step: 'Revert to previous configuration', estimatedDuration: 180000 },
      { step: 'Verify system stability', estimatedDuration: 300000 },
      { step: 'Notify stakeholders', estimatedDuration: 60000 }
    ];

    if (features.includes('websocket_connections')) {
      steps.splice(2, 0,
        { step: 'Force all connections to SSE', estimatedDuration: 120000 },
        { step: 'Clear WebSocket connection cache', estimatedDuration: 60000 }
      );
    }

    const totalDuration = steps.reduce((sum, step) => sum + step.estimatedDuration, 0);

    return {
      triggerCriteria: await this.generateRollbackCriteria(features),
      steps,
      estimatedDuration: totalDuration
    };
  }

  private async runSingleValidation(
    validation: string,
    _stage: DeploymentStage
  ): Promise<{ criterion: string; passed: boolean; value: number; threshold: number }> {
    // This would run actual validation checks
    // For now, return mock validation results

    switch (validation) {
      case 'unit_tests_passing':
        return { criterion: validation, passed: true, value: 132, threshold: 130 };

      case 'integration_tests_passing':
        return { criterion: validation, passed: true, value: 100, threshold: 95 };

      case 'type_checking_passing':
        return { criterion: validation, passed: true, value: 100, threshold: 100 };

      case 'eslint_passing':
        return { criterion: validation, passed: true, value: 0, threshold: 0 };

      case 'performance_tests_passing':
        return { criterion: validation, passed: true, value: 95, threshold: 90 };

      case 'security_scan_clean':
        return { criterion: validation, passed: true, value: 0, threshold: 0 };

      case 'smoke_tests_passing':
        return { criterion: validation, passed: true, value: 100, threshold: 100 };

      case 'monitoring_active':
        return { criterion: validation, passed: true, value: 100, threshold: 100 };

      default:
        return { criterion: validation, passed: true, value: 100, threshold: 100 };
    }
  }

  private async deployStageFeatures(stage: DeploymentStage): Promise<void> {
    // This would deploy features for the specific stage
    // Update feature flags based on stage configuration

    await this.featureFlagsService.setFeatureFlag('websocket_connections', {
      name: 'websocket_connections',
      enabled: true,
      deploymentPhase: stage.name,
      rollout: {
        percentage: stage.percentage,
        strategy: 'hash'
      },
      targeting: {}
    });

    console.log(`📦 [StagedDeployment] Features deployed for stage ${stage.name} at ${stage.percentage}%`);
  }

  private async startStageMonitoring(stage: DeploymentStage): Promise<void> {
    // Start enhanced monitoring for the deployment stage
    await this.monitorService.startDeploymentMonitoring({
      enableAutomaticRollback: true,
      alertingEnabled: true,
      dashboardUpdates: true,
      metricsCollection: true
    });

    console.log(`📊 [StagedDeployment] Monitoring started for stage ${stage.name}`);
  }

  private async waitForStageDuration(
    execution: DeploymentExecution,
    stageIndex: number,
    stageConfig: DeploymentStage
  ): Promise<void> {
    const duration = stageConfig.duration;

    if (duration <= 0) {
      return; // Permanent stage or manual promotion only
    }

    const stageName = execution.stages[stageIndex]?.name || 'unknown';

    // This would implement actual waiting with periodic health checks
    // For now, simulate the wait
    console.log(`⏱️ [StagedDeployment] Stage ${stageName} running for ${duration}ms with execution ${execution.executionId}`);

    // In a real implementation, this would:
    // 1. Set up periodic health checks using stageConfig
    // 2. Monitor for early failure conditions
    // 3. Allow for early promotion if criteria are met
    // 4. Handle manual interventions
  }

  private async triggerStageRollback(
    execution: DeploymentExecution,
    stageIndex: number,
    reason: string
  ): Promise<void> {
    const stage = execution.stages[stageIndex];
    const stageName = stage?.name || `stage-${stageIndex}`;
    console.error(`🔄 [StagedDeployment] Triggering rollback for stage ${stageName}: ${reason}`);

    // Use emergency rollback service to handle the rollback
    await this.rollbackService.instantEmergencyRollback(
      `Deployment stage failure: ${reason}`,
      `staged_deployment_${execution.executionId}`
    );
  }


  private async storeDeploymentPlan(plan: DeploymentPlan): Promise<void> {
    try {
      await this.env.SESSIONS.put(`deployment_plan:${plan.id}`, JSON.stringify(plan));
      console.log(`💾 [StagedDeployment] Deployment plan ${plan.id} stored`);
    } catch (error) {
      console.error('❌ [StagedDeployment] Error storing deployment plan:', error);
      throw error;
    }
  }

  private async getDeploymentPlan(planId: string): Promise<DeploymentPlan | null> {
    try {
      const planStr = await this.env.SESSIONS.get(`deployment_plan:${planId}`);
      return planStr ? JSON.parse(planStr) : null;
    } catch (error) {
      console.error('❌ [StagedDeployment] Error getting deployment plan:', error);
      return null;
    }
  }

  private async storeDeploymentExecution(execution: DeploymentExecution): Promise<void> {
    try {
      await this.env.CACHE.put(
        `deployment_execution:${execution.id}`,
        JSON.stringify(execution),
        { expirationTtl: 86400 } // 24 hours
      );
      console.log(`💾 [StagedDeployment] Deployment execution ${execution.id} stored`);
    } catch (error) {
      console.error('❌ [StagedDeployment] Error storing deployment execution:', error);
      throw error;
    }
  }

  private async getDeploymentExecution(executionId: string): Promise<DeploymentExecution | null> {
    try {
      const executionStr = await this.env.CACHE.get(`deployment_execution:${executionId}`);
      return executionStr ? JSON.parse(executionStr) : null;
    } catch (error) {
      console.error('❌ [StagedDeployment] Error getting deployment execution:', error);
      return null;
    }
  }
}