// Deployment Feature Flags Management System
// 專案名稱：Multi-Channel Support MVP - Deployment Control System
// 提供細粒度的功能開關控制，支援A/B測試和漸進式部署

import type {
  FeatureFlagConfig,
  DeploymentPhase,
  UserTargeting,
  ABTestConfig,
  FlagOverride,
  FlagMetrics
} from '../types/deployment-types';
import type { Bindings } from '../types/bindings';
// import { MigrationService } from './migration-service'; // Unused import

/**
 * Architecture Overview:
 *
 * DeploymentFeatureFlagsService provides:
 * 1. Progressive rollout controls (0% → 25% → 50% → 75% → 100%)
 * 2. A/B testing framework for WebSocket vs SSE comparison
 * 3. User targeting (admins → teams → agents → all users)
 * 4. Geographic rollout controls
 * 5. Emergency disable switches and instant rollback flags
 * 6. Performance monitoring and automated flag adjustments
 *
 * This enables safe, controlled deployment with rapid rollback capabilities
 */

export class DeploymentFeatureFlagsService {
  private env: Bindings;

  private readonly FLAG_CACHE_TTL = 300; // 5 minutes cache for flags
  private readonly METRICS_CACHE_TTL = 60; // 1 minute cache for metrics

  // Deployment phases with graduated rollout
  private readonly DEPLOYMENT_PHASES: Record<string, DeploymentPhase> = {
    disabled: {
      name: 'disabled',
      rolloutPercentage: 0,
      userTargeting: { includeRoles: [] },
      duration: 0,
      requirements: []
    },
    internal: {
      name: 'internal',
      rolloutPercentage: 5,
      userTargeting: { includeRoles: ['admin'], includeTeams: [] },
      duration: 3600000, // 1 hour
      requirements: ['all_tests_passing', 'monitoring_active']
    },
    canary: {
      name: 'canary',
      rolloutPercentage: 10,
      userTargeting: { includeRoles: ['admin', 'team'], includeTeams: [] },
      duration: 7200000, // 2 hours
      requirements: ['internal_success', 'no_critical_errors']
    },
    early: {
      name: 'early',
      rolloutPercentage: 25,
      userTargeting: { includeRoles: ['admin', 'team'], targetHighActivity: true },
      duration: 14400000, // 4 hours
      requirements: ['canary_success', 'error_rate_below_2_percent']
    },
    gradual: {
      name: 'gradual',
      rolloutPercentage: 50,
      userTargeting: { targetHighActivity: true },
      duration: 28800000, // 8 hours
      requirements: ['early_success', 'performance_acceptable']
    },
    majority: {
      name: 'majority',
      rolloutPercentage: 75,
      userTargeting: {},
      duration: 43200000, // 12 hours
      requirements: ['gradual_success', 'resource_usage_stable']
    },
    complete: {
      name: 'complete',
      rolloutPercentage: 100,
      userTargeting: {},
      duration: -1, // Permanent
      requirements: ['majority_success', 'all_metrics_green']
    }
  };

  constructor(env: Bindings) {
    this.env = env;
  }

  // =================== Feature Flag Management ===================

  /**
   * Get feature flag configuration for a specific flag
   * @param flagName Name of the feature flag
   * @returns Feature flag configuration
   */
  async getFeatureFlag(flagName: string): Promise<FeatureFlagConfig | null> {
    try {
      const cacheKey = `feature_flag:${flagName}`;
      const cached = await this.env.CACHE.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Load from persistent storage
      const flagStr = await this.env.SESSIONS.get(`flag_config:${flagName}`);
      if (flagStr) {
        const flag = JSON.parse(flagStr);

        // Cache for quick access
        await this.env.CACHE.put(cacheKey, JSON.stringify(flag), { expirationTtl: this.FLAG_CACHE_TTL });

        return flag;
      }

      return null;

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error getting feature flag ${flagName}:`, error);
      return null;
    }
  }

  /**
   * Set or update feature flag configuration
   * @param flagName Name of the feature flag
   * @param config Feature flag configuration
   */
  async setFeatureFlag(flagName: string, config: FeatureFlagConfig): Promise<void> {
    try {
      // Validate configuration
      this.validateFeatureFlagConfig(config);

      // Store in persistent storage
      await this.env.SESSIONS.put(`flag_config:${flagName}`, JSON.stringify(config));

      // Update cache
      const cacheKey = `feature_flag:${flagName}`;
      await this.env.CACHE.put(cacheKey, JSON.stringify(config), { expirationTtl: this.FLAG_CACHE_TTL });

      // Log flag update
      await this.logFlagUpdate(flagName, config);

      console.log(`⚙️ [FeatureFlags] Feature flag ${flagName} updated`);

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error setting feature flag ${flagName}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate if a feature flag is enabled for a specific user
   * @param flagName Name of the feature flag
   * @param userId User identifier
   * @param context Additional context for evaluation
   * @returns Flag evaluation result
   */
  async evaluateFeatureFlag(
    flagName: string,
    userId: string,
    context: {
      role?: string;
      teamId?: number;
      userAgent?: string;
      geography?: string;
      activityLevel?: 'low' | 'medium' | 'high';
      abTestGroup?: string;
    } = {}
  ): Promise<{
    enabled: boolean;
    reason: string;
    variant?: string;
    abTestGroup?: string;
    override?: boolean;
  }> {
    try {
      // Check for emergency override first
      const emergencyOverride = await this.checkEmergencyOverride(flagName);
      if (emergencyOverride) {
        return {
          enabled: emergencyOverride.enabled,
          reason: `Emergency override: ${emergencyOverride.reason}`,
          override: true
        };
      }

      // Check for user-specific override
      const userOverride = await this.checkUserOverride(flagName, userId);
      if (userOverride) {
        return {
          enabled: userOverride.enabled,
          reason: `User override: ${userOverride.reason}`,
          override: true
        };
      }

      // Get feature flag configuration
      const flag = await this.getFeatureFlag(flagName);
      if (!flag) {
        return {
          enabled: false,
          reason: `Feature flag ${flagName} not found`
        };
      }

      // Check if flag is globally disabled
      if (!flag.enabled) {
        return {
          enabled: false,
          reason: 'Feature flag globally disabled'
        };
      }

      // Check deployment phase requirements
      const phaseEvaluation = await this.evaluateDeploymentPhase(flag, userId, context);
      if (!phaseEvaluation.enabled) {
        return {
          enabled: false,
          reason: phaseEvaluation.reason
        };
      }

      // Check targeting rules
      const targetingEvaluation = await this.evaluateTargeting(flag.targeting, userId, context);
      if (!targetingEvaluation.enabled) {
        return {
          enabled: false,
          reason: targetingEvaluation.reason
        };
      }

      // Check A/B test assignment
      const abTestResult = await this.evaluateABTest(flag.abTest, userId, context);

      // Evaluate rollout percentage
      const rolloutEvaluation = await this.evaluateRollout(flag.rollout, userId, context);

      const finalEnabled = rolloutEvaluation.enabled &&
                          (abTestResult ? abTestResult.enabled : true);

      const result: {
        enabled: boolean;
        reason: string;
        variant?: string;
        abTestGroup?: string;
        override?: boolean;
      } = {
        enabled: finalEnabled,
        reason: finalEnabled ?
          `Feature enabled: ${rolloutEvaluation.reason}${abTestResult ? `, A/B test: ${abTestResult.reason}` : ''}` :
          `Feature disabled: ${rolloutEvaluation.reason}`
      };

      if (abTestResult?.variant !== undefined) {
        result.variant = abTestResult.variant;
      }
      if (abTestResult?.group !== undefined) {
        result.abTestGroup = abTestResult.group;
      }

      return result;

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error evaluating feature flag ${flagName}:`, error);

      // Safe fallback - return disabled on error
      return {
        enabled: false,
        reason: 'Evaluation error - safe fallback'
      };
    }
  }

  // =================== Progressive Rollout Management ===================

  /**
   * Advance feature flag to next deployment phase
   * @param flagName Name of the feature flag
   * @param force Skip phase requirements validation
   */
  async advanceDeploymentPhase(flagName: string, force: boolean = false): Promise<{
    success: boolean;
    currentPhase: string;
    nextPhase: string | null;
    reason: string;
  }> {
    try {
      const flag = await this.getFeatureFlag(flagName);
      if (!flag) {
        return {
          success: false,
          currentPhase: 'disabled',
          nextPhase: null,
          reason: `Feature flag ${flagName} not found`
        };
      }

      const currentPhase = flag.deploymentPhase || 'disabled';
      const nextPhase = this.getNextDeploymentPhase(currentPhase);

      if (!nextPhase) {
        return {
          success: false,
          currentPhase,
          nextPhase: null,
          reason: 'Already at final deployment phase'
        };
      }

      // Check if current phase requirements are met (unless forced)
      if (!force) {
        const requirementCheck = await this.checkPhaseRequirements(flagName, currentPhase);
        if (!requirementCheck.passed) {
          return {
            success: false,
            currentPhase,
            nextPhase,
            reason: `Phase requirements not met: ${requirementCheck.failures.join(', ')}`
          };
        }
      }

      // Update flag to next phase
      const nextPhaseConfig = this.DEPLOYMENT_PHASES[nextPhase];
      if (!nextPhaseConfig) {
        return {
          success: false,
          currentPhase,
          nextPhase,
          reason: `Invalid next phase: ${nextPhase}`
        };
      }
      const updatedFlag: FeatureFlagConfig = {
        ...flag,
        deploymentPhase: nextPhase,
        rollout: {
          ...flag.rollout,
          percentage: nextPhaseConfig.rolloutPercentage
        },
        targeting: {
          ...flag.targeting,
          ...nextPhaseConfig.userTargeting
        }
      };

      await this.setFeatureFlag(flagName, updatedFlag);

      // Log phase advancement
      await this.logPhaseAdvancement(flagName, currentPhase, nextPhase, force);

      console.log(`📈 [FeatureFlags] Advanced ${flagName} from ${currentPhase} to ${nextPhase}`);

      return {
        success: true,
        currentPhase: nextPhase,
        nextPhase: this.getNextDeploymentPhase(nextPhase),
        reason: force ? 'Forced advancement' : 'Requirements met'
      };

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error advancing deployment phase for ${flagName}:`, error);

      return {
        success: false,
        currentPhase: 'unknown',
        nextPhase: null,
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Rollback feature flag to previous deployment phase
   * @param flagName Name of the feature flag
   * @param targetPhase Specific phase to rollback to (optional)
   */
  async rollbackDeploymentPhase(
    flagName: string,
    targetPhase?: string
  ): Promise<{
    success: boolean;
    currentPhase: string;
    targetPhase: string;
    reason: string;
  }> {
    try {
      const flag = await this.getFeatureFlag(flagName);
      if (!flag) {
        return {
          success: false,
          currentPhase: 'disabled',
          targetPhase: targetPhase || 'disabled',
          reason: `Feature flag ${flagName} not found`
        };
      }

      const currentPhase = flag.deploymentPhase || 'disabled';
      const rollbackTarget = targetPhase || this.getPreviousDeploymentPhase(currentPhase) || 'disabled';

      // Update flag to rollback phase
      const rollbackPhaseConfig = this.DEPLOYMENT_PHASES[rollbackTarget];
      if (!rollbackPhaseConfig) {
        return {
          success: false,
          currentPhase,
          targetPhase: rollbackTarget,
          reason: `Invalid rollback target phase: ${rollbackTarget}`
        };
      }
      const updatedFlag: FeatureFlagConfig = {
        ...flag,
        deploymentPhase: rollbackTarget,
        rollout: {
          ...flag.rollout,
          percentage: rollbackPhaseConfig.rolloutPercentage
        },
        targeting: {
          ...flag.targeting,
          ...rollbackPhaseConfig.userTargeting
        }
      };

      await this.setFeatureFlag(flagName, updatedFlag);

      // Log phase rollback
      await this.logPhaseRollback(flagName, currentPhase, rollbackTarget);

      console.log(`📉 [FeatureFlags] Rolled back ${flagName} from ${currentPhase} to ${rollbackTarget}`);

      return {
        success: true,
        currentPhase: rollbackTarget,
        targetPhase: rollbackTarget,
        reason: 'Rollback successful'
      };

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error rolling back deployment phase for ${flagName}:`, error);

      return {
        success: false,
        currentPhase: 'unknown',
        targetPhase: targetPhase || 'disabled',
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // =================== A/B Testing Framework ===================

  /**
   * Create A/B test configuration for a feature flag
   * @param flagName Name of the feature flag
   * @param testConfig A/B test configuration
   */
  async createABTest(flagName: string, testConfig: ABTestConfig): Promise<void> {
    try {
      const flag = await this.getFeatureFlag(flagName);
      if (!flag) {
        throw new Error(`Feature flag ${flagName} not found`);
      }

      // Validate A/B test configuration
      this.validateABTestConfig(testConfig);

      // Update flag with A/B test configuration
      const updatedFlag: FeatureFlagConfig = {
        ...flag,
        abTest: testConfig
      };

      await this.setFeatureFlag(flagName, updatedFlag);

      // Initialize A/B test metrics
      await this.initializeABTestMetrics(flagName, testConfig);

      console.log(`🧪 [FeatureFlags] A/B test created for ${flagName}: ${testConfig.variants.map(v => v.name).join(' vs ')}`);

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error creating A/B test for ${flagName}:`, error);
      throw error;
    }
  }

  /**
   * Get A/B test results for a feature flag
   * @param flagName Name of the feature flag
   * @returns A/B test metrics and results
   */
  async getABTestResults(flagName: string): Promise<{
    testConfig: ABTestConfig | null;
    metrics: {
      totalParticipants: number;
      variantMetrics: Record<string, {
        participants: number;
        successRate: number;
        errorRate: number;
        averageLatency: number;
        conversionRate?: number;
      }>;
    };
    conclusions: {
      winningVariant?: string;
      confidenceLevel: number;
      recommendation: string;
    };
  } | null> {
    try {
      const flag = await this.getFeatureFlag(flagName);
      if (!flag?.abTest) {
        return null;
      }

      // Get A/B test metrics
      const metrics = await this.getABTestMetrics(flagName);

      // Calculate statistical significance
      const conclusions = await this.calculateABTestConclusions(flag.abTest, metrics);

      return {
        testConfig: flag.abTest,
        metrics,
        conclusions
      };

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error getting A/B test results for ${flagName}:`, error);
      return null;
    }
  }

  // =================== Emergency Controls ===================

  /**
   * Emergency disable feature flag for all users
   * @param flagName Name of the feature flag
   * @param reason Reason for emergency disable
   */
  async emergencyDisable(flagName: string, reason: string): Promise<void> {
    try {
      const emergencyOverride: FlagOverride = {
        enabled: false,
        reason,
        createdAt: Date.now(),
        createdBy: 'emergency_system',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      await this.env.CACHE.put(
        `emergency_override:${flagName}`,
        JSON.stringify(emergencyOverride),
        { expirationTtl: 86400 }
      );

      // Log emergency action
      await this.logEmergencyAction(flagName, 'disable', reason);

      console.error(`🚨 [FeatureFlags] Emergency disable activated for ${flagName}: ${reason}`);

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error in emergency disable for ${flagName}:`, error);
      throw error;
    }
  }

  /**
   * Emergency enable feature flag for all users
   * @param flagName Name of the feature flag
   * @param reason Reason for emergency enable
   */
  async emergencyEnable(flagName: string, reason: string): Promise<void> {
    try {
      const emergencyOverride: FlagOverride = {
        enabled: true,
        reason,
        createdAt: Date.now(),
        createdBy: 'emergency_system',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      await this.env.CACHE.put(
        `emergency_override:${flagName}`,
        JSON.stringify(emergencyOverride),
        { expirationTtl: 86400 }
      );

      // Log emergency action
      await this.logEmergencyAction(flagName, 'enable', reason);

      console.warn(`⚡ [FeatureFlags] Emergency enable activated for ${flagName}: ${reason}`);

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error in emergency enable for ${flagName}:`, error);
      throw error;
    }
  }

  /**
   * Clear emergency override for a feature flag
   * @param flagName Name of the feature flag
   */
  async clearEmergencyOverride(flagName: string): Promise<void> {
    try {
      await this.env.CACHE.delete(`emergency_override:${flagName}`);

      console.log(`🔄 [FeatureFlags] Emergency override cleared for ${flagName}`);

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error clearing emergency override for ${flagName}:`, error);
      throw error;
    }
  }

  // =================== Metrics and Monitoring ===================

  /**
   * Get comprehensive metrics for a feature flag
   * @param flagName Name of the feature flag
   * @returns Feature flag metrics
   */
  async getFeatureFlagMetrics(flagName: string): Promise<FlagMetrics | null> {
    try {
      const cacheKey = `flag_metrics:${flagName}`;
      const cached = await this.env.CACHE.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate metrics
      const metrics = await this.calculateFeatureFlagMetrics(flagName);

      // Cache for quick access
      await this.env.CACHE.put(cacheKey, JSON.stringify(metrics), { expirationTtl: this.METRICS_CACHE_TTL });

      return metrics;

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error getting metrics for ${flagName}:`, error);
      return null;
    }
  }

  /**
   * Get deployment status for all feature flags
   */
  async getDeploymentStatus(): Promise<{
    flags: Array<{
      name: string;
      enabled: boolean;
      phase: string;
      rolloutPercentage: number;
      health: 'healthy' | 'warning' | 'critical';
      lastUpdated: number;
    }>;
    summary: {
      totalFlags: number;
      activeFlags: number;
      inRollout: number;
      emergencyOverrides: number;
    };
  }> {
    try {
      // This would scan all feature flags - for now return mock data
      const flags = [
        {
          name: 'websocket_connections',
          enabled: true,
          phase: 'early',
          rolloutPercentage: 25,
          health: 'healthy' as const,
          lastUpdated: Date.now() - 3600000
        }
      ];

      const summary = {
        totalFlags: flags.length,
        activeFlags: flags.filter(f => f.enabled).length,
        inRollout: flags.filter(f => f.rolloutPercentage > 0 && f.rolloutPercentage < 100).length,
        emergencyOverrides: 0 // Would count emergency overrides
      };

      return { flags, summary };

    } catch (error) {
      console.error('❌ [FeatureFlags] Error getting deployment status:', error);

      return {
        flags: [],
        summary: {
          totalFlags: 0,
          activeFlags: 0,
          inRollout: 0,
          emergencyOverrides: 0
        }
      };
    }
  }

  // =================== Private Helper Methods ===================

  private validateFeatureFlagConfig(config: FeatureFlagConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Feature flag name is required');
    }

    if (config.rollout && (config.rollout.percentage < 0 || config.rollout.percentage > 100)) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    if (config.abTest) {
      this.validateABTestConfig(config.abTest);
    }
  }

  private validateABTestConfig(testConfig: ABTestConfig): void {
    if (!testConfig.variants || testConfig.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    const totalWeight = testConfig.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('A/B test variant weights must sum to 100');
    }
  }

  private async evaluateDeploymentPhase(
    flag: FeatureFlagConfig,
    userId: string,
    context: any
  ): Promise<{ enabled: boolean; reason: string }> {
    const phase = flag.deploymentPhase || 'disabled';
    const phaseConfig = this.DEPLOYMENT_PHASES[phase];

    if (!phaseConfig) {
      return { enabled: false, reason: `Unknown deployment phase: ${phase}` };
    }

    if (phase === 'disabled') {
      return { enabled: false, reason: 'Feature is in disabled phase' };
    }

    // Check if user meets phase targeting criteria
    const targetingResult = await this.evaluateTargeting(phaseConfig.userTargeting, userId, context);

    return targetingResult;
  }

  private async evaluateTargeting(
    targeting: UserTargeting,
    _userId: string,
    context: any
  ): Promise<{ enabled: boolean; reason: string }> {
    // Role-based targeting
    if (targeting.includeRoles && targeting.includeRoles.length > 0) {
      if (!context.role || !targeting.includeRoles.includes(context.role)) {
        return { enabled: false, reason: `Role ${context.role} not in target roles: ${targeting.includeRoles.join(', ')}` };
      }
    }

    // Team-based targeting
    if (targeting.includeTeams && targeting.includeTeams.length > 0) {
      if (!context.teamId || !targeting.includeTeams.includes(context.teamId)) {
        return { enabled: false, reason: `Team ${context.teamId} not in target teams` };
      }
    }

    // Activity level targeting
    if (targeting.targetHighActivity && context.activityLevel !== 'high') {
      return { enabled: false, reason: 'High activity users only' };
    }

    // Geographic targeting
    if (targeting.includeGeographies && targeting.includeGeographies.length > 0) {
      if (!context.geography || !targeting.includeGeographies.includes(context.geography)) {
        return { enabled: false, reason: `Geography ${context.geography} not targeted` };
      }
    }

    return { enabled: true, reason: 'Targeting criteria met' };
  }

  private async evaluateRollout(
    rollout: { percentage: number; strategy?: string },
    userId: string,
    _context: any
  ): Promise<{ enabled: boolean; reason: string }> {
    if (rollout.percentage === 0) {
      return { enabled: false, reason: 'Rollout percentage is 0%' };
    }

    if (rollout.percentage === 100) {
      return { enabled: true, reason: 'Full rollout (100%)' };
    }

    // Use consistent hash-based assignment
    const userHash = await this.hashUserId(userId);
    const userPercentile = userHash % 100;

    const enabled = userPercentile < rollout.percentage;

    return {
      enabled,
      reason: enabled ?
        `User in rollout group (${userPercentile}% < ${rollout.percentage}%)` :
        `User not in rollout group (${userPercentile}% >= ${rollout.percentage}%)`
    };
  }

  private async evaluateABTest(
    abTest: ABTestConfig | undefined,
    userId: string,
    _context: any
  ): Promise<{ enabled: boolean; reason: string; variant?: string; group?: string } | null> {
    if (!abTest) {
      return null;
    }

    // Assign user to variant based on hash
    const userHash = await this.hashUserId(userId);
    let cumulativeWeight = 0;
    const hashPercentile = userHash % 100;

    for (const variant of abTest.variants) {
      cumulativeWeight += variant.weight;

      if (hashPercentile < cumulativeWeight) {
        // Track A/B test participation
        await this.trackABTestParticipation(abTest.name, variant.name, userId);

        return {
          enabled: variant.enabled,
          reason: `A/B test variant: ${variant.name}`,
          variant: variant.name,
          group: abTest.name
        };
      }
    }

    // Fallback to control
    const controlVariant = abTest.variants[0];
    if (!controlVariant) {
      return {
        enabled: false,
        reason: 'A/B test has no variants',
        group: abTest.name
      };
    }
    return {
      enabled: controlVariant.enabled,
      reason: `A/B test fallback to control: ${controlVariant.name}`,
      variant: controlVariant.name,
      group: abTest.name
    };
  }

  private async checkEmergencyOverride(flagName: string): Promise<FlagOverride | null> {
    try {
      const overrideStr = await this.env.CACHE.get(`emergency_override:${flagName}`);
      if (!overrideStr) {
        return null;
      }

      const override = JSON.parse(overrideStr);

      // Check if override has expired
      if (override.expiresAt && Date.now() > override.expiresAt) {
        await this.env.CACHE.delete(`emergency_override:${flagName}`);
        return null;
      }

      return override;

    } catch (error) {
      console.error(`❌ [FeatureFlags] Error checking emergency override for ${flagName}:`, error);
      return null;
    }
  }

  private async checkUserOverride(flagName: string, userId: string): Promise<FlagOverride | null> {
    try {
      const overrideStr = await this.env.CACHE.get(`user_override:${flagName}:${userId}`);
      return overrideStr ? JSON.parse(overrideStr) : null;
    } catch (error) {
      console.error(`❌ [FeatureFlags] Error checking user override for ${flagName}:`, error);
      return null;
    }
  }

  private getNextDeploymentPhase(currentPhase: string): string | null {
    const phases = Object.keys(this.DEPLOYMENT_PHASES);
    const currentIndex = phases.indexOf(currentPhase);

    return currentIndex >= 0 && currentIndex < phases.length - 1 ? phases[currentIndex + 1] ?? null : null;
  }

  private getPreviousDeploymentPhase(currentPhase: string): string | null {
    const phases = Object.keys(this.DEPLOYMENT_PHASES);
    const currentIndex = phases.indexOf(currentPhase);

    return currentIndex > 0 ? phases[currentIndex - 1] ?? null : null;
  }

  private async checkPhaseRequirements(flagName: string, phase: string): Promise<{ passed: boolean; failures: string[] }> {
    const phaseConfig = this.DEPLOYMENT_PHASES[phase];
    if (!phaseConfig) {
      return { passed: false, failures: [`Unknown phase: ${phase}`] };
    }
    const failures: string[] = [];

    // This would check actual requirements - for now return mock data
    for (const requirement of phaseConfig.requirements) {
      const passed = await this.checkRequirement(flagName, requirement);
      if (!passed) {
        failures.push(requirement);
      }
    }

    return { passed: failures.length === 0, failures };
  }

  private async checkRequirement(_flagName: string, requirement: string): Promise<boolean> {
    // Mock requirement checking - would integrate with real monitoring
    switch (requirement) {
      case 'all_tests_passing':
        return true; // Would check CI/CD status
      case 'monitoring_active':
        return true; // Would check monitoring systems
      case 'no_critical_errors':
        return true; // Would check error rates
      case 'error_rate_below_2_percent':
        return true; // Would check metrics
      default:
        return true;
    }
  }

  private async hashUserId(userId: string): Promise<number> {
    // Simple hash function for consistent user assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async logFlagUpdate(flagName: string, config: FeatureFlagConfig): Promise<void> {
    try {
      const logEntry = {
        flagName,
        action: 'update',
        config,
        timestamp: Date.now()
      };

      await this.env.CACHE.put(
        `flag_log:${flagName}:${Date.now()}`,
        JSON.stringify(logEntry),
        { expirationTtl: 604800 } // 7 days
      );

    } catch (error) {
      console.error('❌ [FeatureFlags] Error logging flag update:', error);
    }
  }

  private async logPhaseAdvancement(flagName: string, fromPhase: string, toPhase: string, forced: boolean): Promise<void> {
    try {
      const logEntry = {
        flagName,
        action: 'phase_advancement',
        fromPhase,
        toPhase,
        forced,
        timestamp: Date.now()
      };

      await this.env.CACHE.put(
        `phase_log:${flagName}:${Date.now()}`,
        JSON.stringify(logEntry),
        { expirationTtl: 2592000 } // 30 days
      );

    } catch (error) {
      console.error('❌ [FeatureFlags] Error logging phase advancement:', error);
    }
  }

  private async logPhaseRollback(flagName: string, fromPhase: string, toPhase: string): Promise<void> {
    try {
      const logEntry = {
        flagName,
        action: 'phase_rollback',
        fromPhase,
        toPhase,
        timestamp: Date.now()
      };

      await this.env.CACHE.put(
        `phase_log:${flagName}:${Date.now()}`,
        JSON.stringify(logEntry),
        { expirationTtl: 2592000 } // 30 days
      );

    } catch (error) {
      console.error('❌ [FeatureFlags] Error logging phase rollback:', error);
    }
  }

  private async logEmergencyAction(flagName: string, action: string, reason: string): Promise<void> {
    try {
      const logEntry = {
        flagName,
        action: `emergency_${action}`,
        reason,
        timestamp: Date.now()
      };

      await this.env.CACHE.put(
        `emergency_log:${flagName}:${Date.now()}`,
        JSON.stringify(logEntry),
        { expirationTtl: 2592000 } // 30 days
      );

    } catch (error) {
      console.error('❌ [FeatureFlags] Error logging emergency action:', error);
    }
  }

  private async initializeABTestMetrics(flagName: string, testConfig: ABTestConfig): Promise<void> {
    // Initialize metrics tracking for A/B test variants
    for (const variant of testConfig.variants) {
      const metricsKey = `ab_metrics:${flagName}:${variant.name}`;
      const initialMetrics = {
        participants: 0,
        successes: 0,
        errors: 0,
        totalLatency: 0,
        conversions: 0
      };

      await this.env.CACHE.put(metricsKey, JSON.stringify(initialMetrics), { expirationTtl: 2592000 });
    }
  }

  private async trackABTestParticipation(testName: string, variantName: string, userId: string): Promise<void> {
    try {
      // Track that this user participated in this variant
      const participationKey = `ab_participation:${testName}:${variantName}:${userId}`;
      await this.env.CACHE.put(participationKey, Date.now().toString(), { expirationTtl: 2592000 });

      // Increment participant count
      const metricsKey = `ab_metrics:${testName}:${variantName}`;
      const metricsStr = await this.env.CACHE.get(metricsKey);

      if (metricsStr) {
        const metrics = JSON.parse(metricsStr);
        metrics.participants += 1;
        await this.env.CACHE.put(metricsKey, JSON.stringify(metrics), { expirationTtl: 2592000 });
      }

    } catch (error) {
      console.error('❌ [FeatureFlags] Error tracking A/B test participation:', error);
    }
  }

  private async getABTestMetrics(_flagName: string): Promise<any> {
    // This would return aggregated A/B test metrics
    // For now, return mock data
    return {
      totalParticipants: 1000,
      variantMetrics: {
        control: {
          participants: 500,
          successRate: 0.92,
          errorRate: 0.05,
          averageLatency: 150
        },
        treatment: {
          participants: 500,
          successRate: 0.95,
          errorRate: 0.03,
          averageLatency: 120
        }
      }
    };
  }

  private async calculateABTestConclusions(_testConfig: ABTestConfig, _metrics: any): Promise<any> {
    // This would calculate statistical significance and make recommendations
    // For now, return mock conclusions
    return {
      winningVariant: 'treatment',
      confidenceLevel: 0.95,
      recommendation: 'Deploy treatment variant - statistically significant improvement'
    };
  }

  private async calculateFeatureFlagMetrics(flagName: string): Promise<FlagMetrics> {
    // This would calculate comprehensive metrics for the feature flag
    // For now, return mock metrics
    return {
      flagName,
      evaluations: {
        total: 10000,
        enabled: 2500,
        disabled: 7500,
        errors: 10
      },
      performance: {
        averageEvaluationTime: 2.5,
        cacheHitRate: 0.95,
        errorRate: 0.001
      },
      rollout: {
        currentPercentage: 25,
        targetPercentage: 50,
        affectedUsers: 2500
      },
      lastUpdated: Date.now()
    };
  }
}