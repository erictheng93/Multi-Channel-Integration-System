// Emergency Controls for Feature Flags
// Handles emergency disable/enable and rapid rollback functionality

import type { FlagOverride } from '../../types/deployment-types';
import type { Bindings } from '../../types/bindings';
import { logger } from '../../utils/logger';

export class EmergencyControlsService {
  private env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Emergency disable a feature flag with immediate effect
   */
  async emergencyDisable(
    flagName: string,
    reason: string,
    duration?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const override: FlagOverride = {
        enabled: false,
        reason: `EMERGENCY DISABLE: ${reason}`,
        createdAt: Date.now(),
        createdBy: 'emergency_system',
        ...(duration && { expiresAt: Date.now() + duration })
      };

      // Store emergency override
      await this.env.SESSIONS.put(
        `emergency_override:${flagName}`,
        JSON.stringify(override)
      );

      // Clear cache to ensure immediate effect
      await this.env.CACHE.delete(`flag_cache:${flagName}`);

      // Log emergency action
      await this.logEmergencyAction(flagName, 'disable', reason);

      // Send alert notification
      await this.sendEmergencyAlert(flagName, 'disabled', reason);

      logger.error(`Emergency disable activated for flag ${flagName}`, 'EmergencyControls', {
        flagName,
        reason,
        duration
      });

      return {
        success: true,
        message: `Emergency disable activated for ${flagName}`
      };

    } catch (error) {
      logger.error(`Failed to emergency disable flag ${flagName}`, 'EmergencyControls', {
        flagName,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to activate emergency disable'
      };
    }
  }

  /**
   * Emergency enable a feature flag with immediate effect
   */
  async emergencyEnable(
    flagName: string,
    reason: string,
    duration?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const override: FlagOverride = {
        enabled: true,
        reason: `EMERGENCY ENABLE: ${reason}`,
        createdAt: Date.now(),
        createdBy: 'emergency_system',
        ...(duration && { expiresAt: Date.now() + duration })
      };

      // Store emergency override
      await this.env.SESSIONS.put(
        `emergency_override:${flagName}`,
        JSON.stringify(override)
      );

      // Clear cache to ensure immediate effect
      await this.env.CACHE.delete(`flag_cache:${flagName}`);

      // Log emergency action
      await this.logEmergencyAction(flagName, 'enable', reason);

      // Send alert notification
      await this.sendEmergencyAlert(flagName, 'enabled', reason);

      logger.warn(`Emergency enable activated for flag ${flagName}`, 'EmergencyControls', {
        flagName,
        reason,
        duration
      });

      return {
        success: true,
        message: `Emergency enable activated for ${flagName}`
      };

    } catch (error) {
      logger.error(`Failed to emergency enable flag ${flagName}`, 'EmergencyControls', {
        flagName,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to activate emergency enable'
      };
    }
  }

  /**
   * Clear emergency override and return to normal operation
   */
  async clearEmergencyOverride(
    flagName: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if emergency override exists
      const overrideStr = await this.env.SESSIONS.get(`emergency_override:${flagName}`);
      if (!overrideStr) {
        return {
          success: false,
          message: `No emergency override found for ${flagName}`
        };
      }

      // Remove emergency override
      await this.env.SESSIONS.delete(`emergency_override:${flagName}`);

      // Clear cache to ensure change takes effect
      await this.env.CACHE.delete(`flag_cache:${flagName}`);

      // Log clearance
      await this.logEmergencyAction(flagName, 'clear', 'Emergency override cleared');

      logger.info(`Emergency override cleared for flag ${flagName}`, 'EmergencyControls', {
        flagName
      });

      return {
        success: true,
        message: `Emergency override cleared for ${flagName}`
      };

    } catch (error) {
      logger.error(`Failed to clear emergency override for flag ${flagName}`, 'EmergencyControls', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to clear emergency override'
      };
    }
  }

  /**
   * Set user-specific override (for testing or support)
   */
  async setUserOverride(
    flagName: string,
    userId: string,
    enabled: boolean,
    reason: string,
    duration?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const override: FlagOverride = {
        enabled,
        reason,
        createdAt: Date.now(),
        createdBy: `user_${userId}`,
        ...(duration && { expiresAt: Date.now() + duration }),
        userIds: [userId]
      };

      // Store user override
      await this.env.SESSIONS.put(
        `user_override:${flagName}:${userId}`,
        JSON.stringify(override)
      );

      logger.info(`User override set for flag ${flagName}`, 'EmergencyControls', {
        flagName,
        userId,
        enabled,
        reason
      });

      return {
        success: true,
        message: `User override set for ${flagName}`
      };

    } catch (error) {
      logger.error(`Failed to set user override for flag ${flagName}`, 'EmergencyControls', {
        flagName,
        userId,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to set user override'
      };
    }
  }

  /**
   * Clear user-specific override
   */
  async clearUserOverride(
    flagName: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.env.SESSIONS.delete(`user_override:${flagName}:${userId}`);

      logger.info(`User override cleared for flag ${flagName}`, 'EmergencyControls', {
        flagName,
        userId
      });

      return {
        success: true,
        message: `User override cleared for ${flagName}`
      };

    } catch (error) {
      logger.error(`Failed to clear user override for flag ${flagName}`, 'EmergencyControls', {
        flagName,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to clear user override'
      };
    }
  }

  /**
   * Get all active emergency overrides
   */
  async getActiveEmergencyOverrides(): Promise<FlagOverride[]> {
    try {
      const list = await this.env.SESSIONS.list({ prefix: 'emergency_override:' });
      const overrides: FlagOverride[] = [];

      for (const key of list.keys) {
        try {
          const overrideStr = await this.env.SESSIONS.get(key.name);
          if (overrideStr) {
            const override = JSON.parse(overrideStr);

            // Check if override has expired
            if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
              await this.env.SESSIONS.delete(key.name);
              continue;
            }

            overrides.push(override);
          }
        } catch (error) {
          logger.warn(`Error parsing emergency override ${key.name}`, 'EmergencyControls', {
            key: key.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return overrides;

    } catch (error) {
      logger.error('Error getting active emergency overrides', 'EmergencyControls', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Perform emergency rollback to safe state
   */
  async emergencyRollbackAll(
    reason: string
  ): Promise<{ success: boolean; message: string; affectedFlags: string[] }> {
    try {
      const affectedFlags: string[] = [];

      // Get all feature flags
      const flagList = await this.env.SESSIONS.list({ prefix: 'flag_config:' });

      for (const key of flagList.keys) {
        try {
          const flagName = key.name.replace('flag_config:', '');
          const flagStr = await this.env.SESSIONS.get(key.name);

          if (flagStr) {
            const flag = JSON.parse(flagStr);

            // Only rollback flags that are in production phases
            if (['production', 'full_rollout'].includes(flag.deploymentPhase)) {
              await this.emergencyDisable(flagName, `Global rollback: ${reason}`);
              affectedFlags.push(flagName);
            }
          }
        } catch (error) {
          logger.warn(`Error processing flag during emergency rollback: ${key.name}`, 'EmergencyControls', {
            key: key.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Send global alert
      await this.sendGlobalRollbackAlert(reason, affectedFlags);

      logger.error(`Emergency rollback executed - ${affectedFlags.length} flags affected`, 'EmergencyControls', {
        reason,
        affectedFlags
      });

      return {
        success: true,
        message: `Emergency rollback completed - ${affectedFlags.length} flags disabled`,
        affectedFlags
      };

    } catch (error) {
      logger.error('Failed to execute emergency rollback', 'EmergencyControls', {
        reason,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: 'Failed to execute emergency rollback',
        affectedFlags: []
      };
    }
  }

  /**
   * Log emergency actions for audit trail
   */
  private async logEmergencyAction(
    flagName: string,
    action: string,
    reason: string
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        flagName,
        action: `emergency_${action}`,
        reason,
        severity: 'high'
      };

      await this.env.SESSIONS.put(
        `emergency_log:${flagName}:${Date.now()}`,
        JSON.stringify(logEntry)
      );
    } catch (error) {
      logger.warn(`Failed to log emergency action for ${flagName}`, 'EmergencyControls', {
        flagName,
        action,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - logging failure shouldn't break emergency actions
    }
  }

  /**
   * Send emergency alert notification
   */
  private async sendEmergencyAlert(
    flagName: string,
    action: string,
    reason: string
  ): Promise<void> {
    try {
      // In a real implementation, this would send to alerting systems
      // For now, we'll store the alert for monitoring systems to pick up
      const alert = {
        timestamp: new Date().toISOString(),
        type: 'emergency_flag_action',
        flagName,
        action,
        reason,
        severity: 'high'
      };

      await this.env.CACHE.put(
        `alert:emergency:${flagName}:${Date.now()}`,
        JSON.stringify(alert),
        { expirationTtl: 3600 } // 1 hour
      );

    } catch (error) {
      logger.warn(`Failed to send emergency alert for ${flagName}`, 'EmergencyControls', {
        flagName,
        action,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - alert failure shouldn't break emergency actions
    }
  }

  /**
   * Send global rollback alert
   */
  private async sendGlobalRollbackAlert(
    reason: string,
    affectedFlags: string[]
  ): Promise<void> {
    try {
      const alert = {
        timestamp: new Date().toISOString(),
        type: 'global_emergency_rollback',
        reason,
        affectedFlags,
        severity: 'critical'
      };

      await this.env.CACHE.put(
        `alert:global_rollback:${Date.now()}`,
        JSON.stringify(alert),
        { expirationTtl: 7200 } // 2 hours
      );

    } catch (error) {
      logger.warn('Failed to send global rollback alert', 'EmergencyControls', {
        reason,
        affectedFlags,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}