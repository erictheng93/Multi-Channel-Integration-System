// Feature Flag Evaluation Engine
// Core evaluation logic and decision algorithms

import type {
  FeatureFlagConfig,
  UserTargeting,
  FlagOverride,
  ABTestConfig
} from '../../types/deployment-types';
import type { Bindings } from '../../types/bindings';
import { logger } from '../../utils/logger';

export interface EvaluationContext {
  userId: string;
  role?: string;
  teamId?: string;
  geography?: string;
  userAgent?: string;
  ipAddress?: string;
  experimentBucket?: string;
}

export interface EvaluationResult {
  enabled: boolean;
  reason: string;
  metadata?: Record<string, unknown>;
  variant?: string;
}

export class FlagEvaluatorService {
  private env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Comprehensive feature flag evaluation with all targeting rules
   */
  async evaluateFeatureFlag(
    flagName: string,
    flag: FeatureFlagConfig,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    try {
      // 1. Check emergency overrides first
      const emergencyOverride = await this.checkEmergencyOverride(flagName);
      if (emergencyOverride) {
        return {
          enabled: emergencyOverride.enabled,
          reason: `Emergency override: ${emergencyOverride.reason}`,
          metadata: { override: true, type: 'emergency' }
        };
      }

      // 2. Check user-specific overrides
      const userOverride = await this.checkUserOverride(flagName, context.userId);
      if (userOverride) {
        return {
          enabled: userOverride.enabled,
          reason: `User override: ${userOverride.reason}`,
          metadata: { override: true, type: 'user', userId: context.userId }
        };
      }

      // 3. Check if flag is globally disabled
      if (!flag.enabled) {
        return {
          enabled: false,
          reason: 'Feature flag is globally disabled',
          metadata: { globalEnabled: false }
        };
      }

      // 4. Evaluate deployment phase
      const phaseEvaluation = await this.evaluateDeploymentPhase(flag, context);
      if (!phaseEvaluation.enabled) {
        return phaseEvaluation;
      }

      // 5. Evaluate user targeting
      const targetingEvaluation = await this.evaluateTargeting(flag.targeting, context);
      if (!targetingEvaluation.enabled) {
        return targetingEvaluation;
      }

      // 6. Evaluate rollout percentage
      const rolloutEvaluation = await this.evaluateRollout(flag, context);
      if (!rolloutEvaluation.enabled) {
        return rolloutEvaluation;
      }

      // 7. Evaluate A/B test if configured
      if (flag.abTest) {
        const abTestResult = await this.evaluateABTest(flag.abTest, context);
        return {
          enabled: abTestResult.enabled,
          reason: abTestResult.reason,
          ...(abTestResult.variant ? { variant: abTestResult.variant } : {}),
          metadata: {
            ...abTestResult.metadata,
            abTest: true,
            testName: flag.abTest.testName || flag.abTest.name
          }
        };
      }

      // If all evaluations pass, enable the flag
      return {
        enabled: true,
        reason: 'All evaluation criteria passed',
        metadata: {
          deploymentPhase: flag.deploymentPhase,
          rolloutPercentage: flag.rolloutPercentage || flag.rollout?.percentage
        }
      };

    } catch (error) {
      logger.error(`Error evaluating feature flag ${flagName}`, 'FlagEvaluator', {
        flagName,
        userId: context.userId
      }, error instanceof Error ? error : String(error));

      // Default to disabled on evaluation errors
      return {
        enabled: false,
        reason: 'Evaluation error - defaulting to disabled',
        metadata: { error: true }
      };
    }
  }

  /**
   * Evaluate deployment phase requirements
   */
  private async evaluateDeploymentPhase(
    flag: FeatureFlagConfig,
    _context: EvaluationContext
  ): Promise<EvaluationResult> {
    if (!flag.deploymentPhase) {
      return { enabled: true, reason: 'No deployment phase specified' };
    }

    // Check if phase requirements are met
    const phaseRequirements = await this.checkPhaseRequirements(flag.deploymentPhase);
    if (!phaseRequirements.passed) {
      return {
        enabled: false,
        reason: `Deployment phase ${flag.deploymentPhase} requirements not met`,
        metadata: { failures: phaseRequirements.failures }
      };
    }

    return { enabled: true, reason: `Deployment phase ${flag.deploymentPhase} active` };
  }

  /**
   * Evaluate user targeting rules
   */
  private async evaluateTargeting(
    targeting: UserTargeting | undefined,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    if (!targeting) {
      return { enabled: true, reason: 'No targeting rules specified' };
    }

    // Check role targeting
    if (targeting.includeRoles && targeting.includeRoles.length > 0) {
      if (!context.role || !targeting.includeRoles.includes(context.role)) {
        return {
          enabled: false,
          reason: `User role ${context.role} not in included roles`,
          metadata: { requiredRoles: targeting.includeRoles }
        };
      }
    }

    if (targeting.excludeRoles && targeting.excludeRoles.length > 0) {
      if (context.role && targeting.excludeRoles.includes(context.role)) {
        return {
          enabled: false,
          reason: `User role ${context.role} is excluded`,
          metadata: { excludedRoles: targeting.excludeRoles }
        };
      }
    }

    // Check team targeting
    if (targeting.includeTeams && targeting.includeTeams.length > 0) {
      if (!context.teamId || !targeting.includeTeams.includes(Number(context.teamId))) {
        return {
          enabled: false,
          reason: `User team ${context.teamId} not in included teams`,
          metadata: { requiredTeams: targeting.includeTeams }
        };
      }
    }

    // Check geography targeting
    if (targeting.includeRegions && targeting.includeRegions.length > 0) {
      if (!context.geography || !targeting.includeRegions.includes(context.geography)) {
        return {
          enabled: false,
          reason: `User geography ${context.geography} not in included regions`,
          metadata: { requiredRegions: targeting.includeRegions }
        };
      }
    }

    return { enabled: true, reason: 'User targeting criteria met' };
  }

  /**
   * Evaluate rollout percentage using consistent hashing
   */
  private async evaluateRollout(
    flag: FeatureFlagConfig,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    if (!flag.rolloutPercentage || flag.rolloutPercentage >= 100) {
      return { enabled: true, reason: 'Full rollout or no rollout percentage specified' };
    }

    // Use consistent hashing to determine if user is in rollout
    const hash = this.hashUserId(context.userId, flag.name || 'default');
    const userPercentile = hash % 100;

    if (userPercentile < flag.rolloutPercentage) {
      return {
        enabled: true,
        reason: `User in rollout bucket (${userPercentile}% < ${flag.rolloutPercentage}%)`,
        metadata: { userPercentile, rolloutPercentage: flag.rolloutPercentage }
      };
    }

    return {
      enabled: false,
      reason: `User not in rollout bucket (${userPercentile}% >= ${flag.rolloutPercentage}%)`,
      metadata: { userPercentile, rolloutPercentage: flag.rolloutPercentage }
    };
  }

  /**
   * Evaluate A/B test assignment
   */
  private async evaluateABTest(
    abTest: ABTestConfig,
    context: EvaluationContext
  ): Promise<EvaluationResult & { variant?: string }> {
    if (!abTest.enabled) {
      return {
        enabled: false,
        reason: 'A/B test is disabled',
        metadata: { abTestEnabled: false }
      };
    }

    // Use consistent hashing for variant assignment
    const hash = this.hashUserId(context.userId, abTest.testName || abTest.name);
    const totalWeight = abTest.variants.reduce((sum, v) => sum + v.weight, 0);
    const userBucket = hash % totalWeight;

    let currentWeight = 0;
    for (const variant of abTest.variants) {
      currentWeight += variant.weight;
      if (userBucket < currentWeight) {
        return {
          enabled: variant.enabled,
          reason: `A/B test variant: ${variant.name}`,
          variant: variant.name,
          metadata: {
            testName: abTest.testName,
            variantWeight: variant.weight,
            totalWeight,
            userBucket
          }
        };
      }
    }

    // Fallback to control
    return {
      enabled: false,
      reason: 'A/B test fallback to control',
      variant: 'control',
      metadata: { fallback: true }
    };
  }

  /**
   * Check for emergency overrides
   */
  private async checkEmergencyOverride(flagName: string): Promise<FlagOverride | null> {
    try {
      const overrideStr = await this.env.SESSIONS.get(`emergency_override:${flagName}`);
      if (!overrideStr) return null;

      const override = JSON.parse(overrideStr);

      // Check if override has expired
      if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
        await this.env.SESSIONS.delete(`emergency_override:${flagName}`);
        return null;
      }

      return override;
    } catch (error) {
      logger.error(`Error checking emergency override for ${flagName}`, 'FlagEvaluator', {
        flagName
      }, error instanceof Error ? error : String(error));
      return null;
    }
  }

  /**
   * Check for user-specific overrides
   */
  private async checkUserOverride(flagName: string, userId: string): Promise<FlagOverride | null> {
    try {
      const overrideStr = await this.env.SESSIONS.get(`user_override:${flagName}:${userId}`);
      if (!overrideStr) return null;

      const override = JSON.parse(overrideStr);

      // Check if override has expired
      if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
        await this.env.SESSIONS.delete(`user_override:${flagName}:${userId}`);
        return null;
      }

      return override;
    } catch (error) {
      logger.error(`Error checking user override for ${flagName}`, 'FlagEvaluator', {
        flagName,
        userId
      }, error instanceof Error ? error : String(error));
      return null;
    }
  }

  /**
   * Check deployment phase requirements
   */
  private async checkPhaseRequirements(phase: string): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];

    try {
      // Check system health requirements
      const healthCheck = await this.checkRequirement('system_health');
      if (!healthCheck) {
        failures.push('System health check failed');
      }

      // Check error rate requirements
      const errorRateCheck = await this.checkRequirement('error_rate');
      if (!errorRateCheck) {
        failures.push('Error rate too high');
      }

      // Check performance requirements for production phases
      if (['production', 'full_rollout'].includes(phase)) {
        const performanceCheck = await this.checkRequirement('performance');
        if (!performanceCheck) {
          failures.push('Performance requirements not met');
        }
      }

      return { passed: failures.length === 0, failures };
    } catch (error) {
      logger.error(`Error checking phase requirements for ${phase}`, 'FlagEvaluator', {
        phase
      }, error instanceof Error ? error : String(error));
      return { passed: false, failures: ['Requirements check failed'] };
    }
  }

  /**
   * Check specific requirement
   */
  private async checkRequirement(requirement: string): Promise<boolean> {
    try {
      const status = await this.env.CACHE.get(`requirement_status:${requirement}`);
      return status === 'pass';
    } catch (error) {
      logger.warn(`Error checking requirement ${requirement}`, 'FlagEvaluator', {
        requirement
      });
      return false; // Fail safe
    }
  }

  /**
   * Consistent hash function for user bucketing
   */
  private hashUserId(userId: string, salt: string): number {
    const str = `${userId}:${salt}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}