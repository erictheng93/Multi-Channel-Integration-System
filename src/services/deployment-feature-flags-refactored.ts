// Refactored Deployment Feature Flags Service
// Main orchestrator using modular components

import type {
  FeatureFlagConfig,
  FlagMetrics,
  ABTestConfig
} from '../types/deployment-types';
import type { Bindings } from '../types/bindings';
import { logger } from '../utils/logger';
import { FeatureFlagConfigService } from './core/feature-flag-config';
import { FlagEvaluatorService, type EvaluationContext, type EvaluationResult } from './core/flag-evaluator';
import { DeploymentPhaseManager } from './deployment/phase-manager';
import { EmergencyControlsService } from './deployment/emergency-controls';
// import { MigrationService } from './migration-service'; // Unused import

/**
 * Refactored Feature Flags Service with modular architecture
 *
 * This service acts as a facade that orchestrates the following modules:
 * - FeatureFlagConfigService: Basic flag configuration management
 * - FlagEvaluatorService: Complex evaluation logic
 * - DeploymentPhaseManager: Phase progression and controls
 * - EmergencyControlsService: Emergency overrides and rapid rollback
 *
 * Benefits of this architecture:
 * - Single Responsibility: Each module has one clear purpose
 * - Testability: Each module can be tested in isolation
 * - Maintainability: Changes are localized to specific modules
 * - Reusability: Modules can be used independently if needed
 */
export class DeploymentFeatureFlagsService {
  private env: Bindings;
  private configService: FeatureFlagConfigService;
  private evaluatorService: FlagEvaluatorService;
  private phaseManager: DeploymentPhaseManager;
  private emergencyControls: EmergencyControlsService;

  private readonly METRICS_CACHE_TTL = 60; // 1 minute cache for metrics

  constructor(env: Bindings) {
    this.env = env;
    this.configService = new FeatureFlagConfigService(env);
    this.evaluatorService = new FlagEvaluatorService(env);
    this.phaseManager = new DeploymentPhaseManager(env);
    this.emergencyControls = new EmergencyControlsService(env);
  }

  // ========================================
  // Core Flag Management (delegates to configService)
  // ========================================

  async getFeatureFlag(flagName: string): Promise<FeatureFlagConfig | null> {
    return this.configService.getFeatureFlag(flagName);
  }

  async setFeatureFlag(flagName: string, config: FeatureFlagConfig): Promise<void> {
    return this.configService.setFeatureFlag(flagName, config);
  }

  async deleteFeatureFlag(flagName: string): Promise<void> {
    return this.configService.deleteFeatureFlag(flagName);
  }

  async listFeatureFlags(): Promise<string[]> {
    return this.configService.listFeatureFlags();
  }

  // ========================================
  // Flag Evaluation (delegates to evaluatorService)
  // ========================================

  async evaluateFeatureFlag(
    flagName: string,
    userId: string,
    context: Partial<EvaluationContext> = {}
  ): Promise<EvaluationResult> {
    try {
      const flag = await this.configService.getFeatureFlag(flagName);
      if (!flag) {
        return {
          enabled: false,
          reason: `Feature flag ${flagName} not found`,
          metadata: { flagExists: false }
        };
      }

      const evaluationContext: EvaluationContext = {
        userId,
        ...context
      };

      const result = await this.evaluatorService.evaluateFeatureFlag(
        flagName,
        flag,
        evaluationContext
      );

      // Record evaluation metrics
      await this.recordEvaluationMetric(flagName, result.enabled, context.role);

      return result;

    } catch (error) {
      logger.error(`Error evaluating feature flag ${flagName}`, 'DeploymentFeatureFlags', {
        flagName,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        enabled: false,
        reason: 'Evaluation error - defaulting to disabled',
        metadata: { error: true }
      };
    }
  }

  // ========================================
  // Deployment Phase Management (delegates to phaseManager)
  // ========================================

  async advanceDeploymentPhase(
    flagName: string,
    force: boolean = false
  ): Promise<{ success: boolean; newPhase?: string; message: string }> {
    return this.phaseManager.advanceDeploymentPhase(flagName, force);
  }

  async rollbackDeploymentPhase(
    flagName: string,
    targetPhase: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    return this.phaseManager.rollbackDeploymentPhase(flagName, targetPhase, reason);
  }

  getPhaseInfo(phaseName: string) {
    return this.phaseManager.getPhaseInfo(phaseName);
  }

  getAllPhases() {
    return this.phaseManager.getAllPhases();
  }

  getNextPhase(currentPhase: string) {
    return this.phaseManager.getNextPhase(currentPhase);
  }

  // ========================================
  // Emergency Controls (delegates to emergencyControls)
  // ========================================

  async emergencyDisable(flagName: string, reason: string, duration?: number) {
    return this.emergencyControls.emergencyDisable(flagName, reason, duration);
  }

  async emergencyEnable(flagName: string, reason: string, duration?: number) {
    return this.emergencyControls.emergencyEnable(flagName, reason, duration);
  }

  async clearEmergencyOverride(flagName: string) {
    return this.emergencyControls.clearEmergencyOverride(flagName);
  }

  async setUserOverride(
    flagName: string,
    userId: string,
    enabled: boolean,
    reason: string,
    duration?: number
  ) {
    return this.emergencyControls.setUserOverride(flagName, userId, enabled, reason, duration);
  }

  async clearUserOverride(flagName: string, userId: string) {
    return this.emergencyControls.clearUserOverride(flagName, userId);
  }

  async getActiveEmergencyOverrides() {
    return this.emergencyControls.getActiveEmergencyOverrides();
  }

  async emergencyRollbackAll(reason: string) {
    return this.emergencyControls.emergencyRollbackAll(reason);
  }

  // ========================================
  // A/B Testing (simplified - could be extracted to separate module)
  // ========================================

  async createABTest(flagName: string, testConfig: ABTestConfig): Promise<void> {
    try {
      const flag = await this.configService.getFeatureFlag(flagName);
      if (!flag) {
        throw new Error(`Feature flag ${flagName} not found`);
      }

      const updatedFlag: FeatureFlagConfig = {
        ...flag,
        abTest: testConfig
      };

      await this.configService.setFeatureFlag(flagName, updatedFlag);

      logger.info(`A/B test created for flag ${flagName}`, 'DeploymentFeatureFlags', {
        flagName,
        testName: testConfig.testName,
        variants: testConfig.variants.length
      });

    } catch (error) {
      logger.error(`Failed to create A/B test for flag ${flagName}`, 'DeploymentFeatureFlags', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getABTestResults(flagName: string): Promise<{
    testName?: string;
    variants: Array<{ name: string; enabled: boolean; userCount: number; conversionRate?: number }>;
  }> {
    try {
      const flag = await this.configService.getFeatureFlag(flagName);
      if (!flag || !flag.abTest) {
        return { variants: [] };
      }

      // Get cached results or calculate from metrics
      const cacheKey = `ab_results:${flagName}`;
      const cachedResults = await this.env.CACHE.get(cacheKey);

      if (cachedResults) {
        return JSON.parse(cachedResults);
      }

      // Calculate results from evaluation metrics
      const variants = await this.calculateABTestResults(flagName, flag.abTest);

      const results: {
        testName?: string;
        variants: Array<{ name: string; enabled: boolean; userCount: number; conversionRate?: number }>;
      } = {
        variants
      };

      if (flag.abTest.testName !== undefined) {
        results.testName = flag.abTest.testName;
      }

      // Cache results
      await this.env.CACHE.put(cacheKey, JSON.stringify(results), {
        expirationTtl: this.METRICS_CACHE_TTL
      });

      return results;

    } catch (error) {
      logger.error(`Failed to get A/B test results for ${flagName}`, 'DeploymentFeatureFlags', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      return { variants: [] };
    }
  }

  // ========================================
  // Metrics and Monitoring
  // ========================================

  async getFeatureFlagMetrics(flagName: string): Promise<FlagMetrics | null> {
    try {
      const cacheKey = `metrics:${flagName}`;
      const cached = await this.env.CACHE.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate metrics from stored data
      const metrics = await this.calculateFlagMetrics(flagName);

      // Cache metrics
      await this.env.CACHE.put(cacheKey, JSON.stringify(metrics), {
        expirationTtl: this.METRICS_CACHE_TTL
      });

      return metrics;

    } catch (error) {
      logger.error(`Failed to get metrics for flag ${flagName}`, 'DeploymentFeatureFlags', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  async getDeploymentStatus(): Promise<{
    totalFlags: number;
    flagsByPhase: Record<string, number>;
    activeOverrides: number;
    healthScore: number;
  }> {
    try {
      const flags = await this.configService.listFeatureFlags();
      const flagsByPhase: Record<string, number> = {};

      for (const flagName of flags) {
        const flag = await this.configService.getFeatureFlag(flagName);
        if (flag) {
          const phase = flag.deploymentPhase || 'disabled';
          flagsByPhase[phase] = (flagsByPhase[phase] || 0) + 1;
        }
      }

      const activeOverrides = await this.emergencyControls.getActiveEmergencyOverrides();
      const healthScore = await this.calculateSystemHealthScore();

      return {
        totalFlags: flags.length,
        flagsByPhase,
        activeOverrides: activeOverrides.length,
        healthScore
      };

    } catch (error) {
      logger.error('Failed to get deployment status', 'DeploymentFeatureFlags', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalFlags: 0,
        flagsByPhase: {},
        activeOverrides: 0,
        healthScore: 0
      };
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private async recordEvaluationMetric(
    flagName: string,
    enabled: boolean,
    role?: string
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const metricKey = `eval_metric:${flagName}:${Date.now()}`;

      const metric = {
        timestamp,
        flagName,
        enabled,
        role
      };

      await this.env.CACHE.put(metricKey, JSON.stringify(metric), {
        expirationTtl: 86400 // 24 hours
      });

    } catch (error) {
      logger.warn(`Failed to record evaluation metric for ${flagName}`, 'DeploymentFeatureFlags', {
        flagName,
        enabled,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - metric recording failure shouldn't break evaluation
    }
  }

  private async calculateFlagMetrics(flagName: string): Promise<FlagMetrics> {
    // This would calculate actual metrics from stored evaluation data
    // For now, return mock data
    return {
      flagName,
      evaluations: {
        total: 0,
        enabled: 0,
        disabled: 0,
        errors: 0
      },
      performance: {
        averageEvaluationTime: 0,
        cacheHitRate: 0,
        errorRate: 0
      },
      rollout: {
        currentPercentage: 0,
        targetPercentage: 0,
        affectedUsers: 0
      },
      lastUpdated: Date.now()
    };
  }

  private async calculateABTestResults(
    _flagName: string,
    abTest: ABTestConfig
  ): Promise<Array<{ name: string; enabled: boolean; userCount: number; conversionRate?: number }>> {
    // This would calculate actual A/B test results from stored data
    // For now, return mock data
    return abTest.variants.map(variant => ({
      name: variant.name,
      enabled: variant.enabled,
      userCount: 0,
      conversionRate: 0
    }));
  }

  private async calculateSystemHealthScore(): Promise<number> {
    try {
      // Simple health calculation based on error rates and override count
      const overrides = await this.emergencyControls.getActiveEmergencyOverrides();
      const overridePenalty = Math.min(overrides.length * 10, 50); // Max 50% penalty

      // Check system requirements
      const healthChecks = ['system_health', 'error_rate', 'performance'];
      let passedChecks = 0;

      for (const check of healthChecks) {
        const status = await this.env.CACHE.get(`requirement_status:${check}`);
        if (status === 'pass') {
          passedChecks++;
        }
      }

      const baseScore = (passedChecks / healthChecks.length) * 100;
      return Math.max(0, baseScore - overridePenalty);

    } catch (error) {
      logger.error('Failed to calculate system health score', 'DeploymentFeatureFlags', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
}