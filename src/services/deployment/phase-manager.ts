// Deployment Phase Management
// Handles progression through deployment phases with safety checks

import type { DeploymentPhase, FeatureFlagConfig } from '../../types/deployment-types';
import type { Bindings } from '../../types/bindings';
import { logger } from '../../utils/logger';

export class DeploymentPhaseManager {
  private env: Bindings;

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
      requirements: ['system_health']
    },
    beta: {
      name: 'beta',
      rolloutPercentage: 25,
      userTargeting: { includeRoles: ['admin', 'team'], includeTeams: [] },
      duration: 7200000, // 2 hours
      requirements: ['system_health', 'error_rate']
    },
    limited_production: {
      name: 'limited_production',
      rolloutPercentage: 50,
      userTargeting: { includeRoles: ['admin', 'team', 'agent'] },
      duration: 14400000, // 4 hours
      requirements: ['system_health', 'error_rate', 'performance']
    },
    production: {
      name: 'production',
      rolloutPercentage: 75,
      userTargeting: {},
      duration: 21600000, // 6 hours
      requirements: ['system_health', 'error_rate', 'performance']
    },
    full_rollout: {
      name: 'full_rollout',
      rolloutPercentage: 100,
      userTargeting: {},
      duration: 0,
      requirements: ['system_health', 'error_rate', 'performance']
    }
  };

  private readonly PHASE_ORDER = [
    'disabled',
    'internal',
    'beta',
    'limited_production',
    'production',
    'full_rollout'
  ];

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Advance a feature flag to the next deployment phase
   */
  async advanceDeploymentPhase(
    flagName: string,
    force: boolean = false
  ): Promise<{ success: boolean; newPhase?: string; message: string }> {
    try {
      const flagStr = await this.env.SESSIONS.get(`flag_config:${flagName}`);
      if (!flagStr) {
        return {
          success: false,
          message: `Feature flag ${flagName} not found`
        };
      }

      const flag: FeatureFlagConfig = JSON.parse(flagStr);
      const currentPhase = flag.deploymentPhase || 'disabled';
      const currentIndex = this.PHASE_ORDER.indexOf(currentPhase);

      if (currentIndex === -1) {
        return {
          success: false,
          message: `Invalid current phase: ${currentPhase}`
        };
      }

      if (currentIndex >= this.PHASE_ORDER.length - 1) {
        return {
          success: false,
          message: 'Already at final deployment phase'
        };
      }

      const nextPhase = this.PHASE_ORDER[currentIndex + 1];
      if (!nextPhase) {
        return {
          success: false,
          message: 'No next phase available'
        };
      }

      // Check if enough time has passed (unless forced)
      if (!force) {
        const canAdvance = await this.checkPhaseAdvancement(flagName, currentPhase);
        if (!canAdvance.allowed) {
          return {
            success: false,
            message: canAdvance.reason
          };
        }
      }

      // Check phase requirements
      const requirementCheck = await this.checkPhaseRequirements(flagName, nextPhase);
      if (!requirementCheck.passed) {
        return {
          success: false,
          message: `Phase requirements not met: ${requirementCheck.failures.join(', ')}`
        };
      }

      // Update flag configuration
      const phaseConfig = this.DEPLOYMENT_PHASES[nextPhase];
      if (!phaseConfig) {
        return {
          success: false,
          message: `Invalid phase configuration for ${nextPhase}`
        };
      }
      const updatedFlag: FeatureFlagConfig = {
        ...flag,
        deploymentPhase: nextPhase,
        rolloutPercentage: phaseConfig.rolloutPercentage,
        targeting: phaseConfig.userTargeting
      };

      await this.env.SESSIONS.put(`flag_config:${flagName}`, JSON.stringify(updatedFlag));

      // Log phase advancement
      await this.logPhaseChange(flagName, currentPhase, nextPhase, force);

      logger.info(`Feature flag ${flagName} advanced to ${nextPhase}`, 'PhaseManager', {
        flagName,
        fromPhase: currentPhase,
        toPhase: nextPhase,
        forced: force
      });

      return {
        success: true,
        newPhase: nextPhase,
        message: `Successfully advanced to ${nextPhase} phase`
      };

    } catch (error) {
      logger.error(`Error advancing deployment phase for ${flagName}`, 'PhaseManager', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to advance deployment phase'
      };
    }
  }

  /**
   * Rollback a feature flag to a previous deployment phase
   */
  async rollbackDeploymentPhase(
    flagName: string,
    targetPhase: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const flagStr = await this.env.SESSIONS.get(`flag_config:${flagName}`);
      if (!flagStr) {
        return {
          success: false,
          message: `Feature flag ${flagName} not found`
        };
      }

      const flag: FeatureFlagConfig = JSON.parse(flagStr);
      const currentPhase = flag.deploymentPhase || 'disabled';

      // Validate target phase
      if (!this.DEPLOYMENT_PHASES[targetPhase]) {
        return {
          success: false,
          message: `Invalid target phase: ${targetPhase}`
        };
      }

      const currentIndex = this.PHASE_ORDER.indexOf(currentPhase);
      const targetIndex = this.PHASE_ORDER.indexOf(targetPhase);

      if (targetIndex >= currentIndex) {
        return {
          success: false,
          message: 'Can only rollback to previous phases'
        };
      }

      // Update flag configuration
      const phaseConfig = this.DEPLOYMENT_PHASES[targetPhase];
      const updatedFlag: FeatureFlagConfig = {
        ...flag,
        deploymentPhase: targetPhase,
        rolloutPercentage: phaseConfig.rolloutPercentage,
        targeting: phaseConfig.userTargeting
      };

      await this.env.SESSIONS.put(`flag_config:${flagName}`, JSON.stringify(updatedFlag));

      // Log rollback
      await this.logPhaseChange(flagName, currentPhase, targetPhase, false, reason);

      logger.warn(`Feature flag ${flagName} rolled back to ${targetPhase}`, 'PhaseManager', {
        flagName,
        fromPhase: currentPhase,
        toPhase: targetPhase,
        reason
      });

      return {
        success: true,
        message: `Successfully rolled back to ${targetPhase} phase`
      };

    } catch (error) {
      logger.error(`Error rolling back deployment phase for ${flagName}`, 'PhaseManager', {
        flagName,
        targetPhase,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to rollback deployment phase'
      };
    }
  }

  /**
   * Get current deployment phase information
   */
  getPhaseInfo(phaseName: string): DeploymentPhase | null {
    return this.DEPLOYMENT_PHASES[phaseName] || null;
  }

  /**
   * Get all available deployment phases
   */
  getAllPhases(): DeploymentPhase[] {
    return this.PHASE_ORDER.map(name => this.DEPLOYMENT_PHASES[name]).filter((phase): phase is DeploymentPhase => phase !== undefined);
  }

  /**
   * Get next phase in sequence
   */
  getNextPhase(currentPhase: string): string | null {
    const currentIndex = this.PHASE_ORDER.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex >= this.PHASE_ORDER.length - 1) {
      return null;
    }
    return this.PHASE_ORDER[currentIndex + 1] || null;
  }

  /**
   * Check if phase can be advanced based on time requirements
   */
  private async checkPhaseAdvancement(
    flagName: string,
    currentPhase: string
  ): Promise<{ allowed: boolean; reason: string }> {
    try {
      const phaseConfig = this.DEPLOYMENT_PHASES[currentPhase];
      if (!phaseConfig || !phaseConfig.duration || phaseConfig.duration === 0) {
        return { allowed: true, reason: 'No time restrictions' };
      }

      const flagStr = await this.env.SESSIONS.get(`flag_config:${flagName}`);
      if (!flagStr) {
        return { allowed: false, reason: 'Flag not found' };
      }

      const _flag: FeatureFlagConfig = JSON.parse(flagStr);
      console.log('Phase advancement check for flag:', _flag.name);
      // For now, assume phase started recently - we could store this in metadata
      const elapsedTime = 0;

      if (elapsedTime < phaseConfig.duration) {
        const remainingTime = Math.ceil((phaseConfig.duration - elapsedTime) / 60000); // minutes
        return {
          allowed: false,
          reason: `Must wait ${remainingTime} more minutes before advancing from ${currentPhase}`
        };
      }

      return { allowed: true, reason: 'Time requirements met' };

    } catch (error) {
      logger.error(`Error checking phase advancement for ${flagName}`, 'PhaseManager', {
        flagName,
        currentPhase,
        error: error instanceof Error ? error.message : String(error)
      });

      return { allowed: false, reason: 'Error checking advancement criteria' };
    }
  }

  /**
   * Check if phase requirements are met
   */
  private async checkPhaseRequirements(
    flagName: string,
    phase: string
  ): Promise<{ passed: boolean; failures: string[] }> {
    const phaseConfig = this.DEPLOYMENT_PHASES[phase];
    const failures: string[] = [];

    if (!phaseConfig || !phaseConfig.requirements || phaseConfig.requirements.length === 0) {
      return { passed: true, failures: [] };
    }

    try {
      for (const requirement of phaseConfig.requirements) {
        const passed = await this.checkRequirement(requirement);
        if (!passed) {
          failures.push(requirement);
        }
      }

      return { passed: failures.length === 0, failures };

    } catch (error) {
      logger.error(`Error checking phase requirements for ${flagName}`, 'PhaseManager', {
        flagName,
        phase,
        error: error instanceof Error ? error.message : String(error)
      });

      return { passed: false, failures: ['Requirements check failed'] };
    }
  }

  /**
   * Check individual requirement
   */
  private async checkRequirement(requirement: string): Promise<boolean> {
    try {
      const status = await this.env.CACHE.get(`requirement_status:${requirement}`);
      return status === 'pass';
    } catch (error) {
      logger.warn(`Error checking requirement ${requirement}`, 'PhaseManager', {
        requirement,
        error: error instanceof Error ? error.message : String(error)
      });
      return false; // Fail safe
    }
  }

  /**
   * Log phase changes for audit trail
   */
  private async logPhaseChange(
    flagName: string,
    fromPhase: string,
    toPhase: string,
    forced: boolean,
    reason?: string
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        flagName,
        action: reason ? 'rollback' : 'advance',
        fromPhase,
        toPhase,
        forced,
        reason
      };

      await this.env.SESSIONS.put(
        `phase_log:${flagName}:${Date.now()}`,
        JSON.stringify(logEntry)
      );
    } catch (error) {
      logger.warn(`Failed to log phase change for ${flagName}`, 'PhaseManager', {
        flagName,
        fromPhase,
        toPhase,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - logging failure shouldn't break phase changes
    }
  }
}