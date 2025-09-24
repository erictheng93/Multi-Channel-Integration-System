// Feature Flag Configuration Management
// Handles basic flag storage, retrieval, and validation

import type { FeatureFlagConfig } from '../../types/deployment-types';
import type { Bindings } from '../../types/bindings';
import { logger } from '../../utils/logger';

export class FeatureFlagConfigService {
  private env: Bindings;
  private readonly FLAG_CACHE_TTL = 300; // 5 minutes cache for flags

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Retrieve a feature flag configuration from storage with caching
   */
  async getFeatureFlag(flagName: string): Promise<FeatureFlagConfig | null> {
    try {
      const cacheKey = `flag_cache:${flagName}`;
      const cached = await this.env.CACHE.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to persistent storage
      const flagStr = await this.env.SESSIONS.get(`flag_config:${flagName}`);
      if (flagStr) {
        const flag = JSON.parse(flagStr);

        // Cache for next time
        await this.env.CACHE.put(cacheKey, JSON.stringify(flag), {
          expirationTtl: this.FLAG_CACHE_TTL
        });

        return flag;
      }

      return null;
    } catch (error) {
      logger.error(`Error getting feature flag ${flagName}`, 'FeatureFlagConfig', {
        flagName
      }, error instanceof Error ? error : String(error));
      return null;
    }
  }

  /**
   * Set a feature flag configuration with validation and caching
   */
  async setFeatureFlag(flagName: string, config: FeatureFlagConfig): Promise<void> {
    try {
      // Validate configuration
      this.validateFeatureFlagConfig(config);

      // Store in persistent storage
      await this.env.SESSIONS.put(`flag_config:${flagName}`, JSON.stringify(config));

      // Update cache
      const cacheKey = `flag_cache:${flagName}`;
      await this.env.CACHE.put(cacheKey, JSON.stringify(config), {
        expirationTtl: this.FLAG_CACHE_TTL
      });

      // Log the update
      await this.logFlagUpdate(flagName, config);

      logger.info(`Feature flag ${flagName} updated`, 'FeatureFlagConfig', {
        flagName,
        enabled: config.enabled,
        phase: config.deploymentPhase
      });
    } catch (error) {
      logger.error(`Error setting feature flag ${flagName}`, 'FeatureFlagConfig', {
        flagName
      }, error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /**
   * Delete a feature flag configuration
   */
  async deleteFeatureFlag(flagName: string): Promise<void> {
    try {
      // Remove from persistent storage
      await this.env.SESSIONS.delete(`flag_config:${flagName}`);

      // Remove from cache
      const cacheKey = `flag_cache:${flagName}`;
      await this.env.CACHE.delete(cacheKey);

      logger.info(`Feature flag ${flagName} deleted`, 'FeatureFlagConfig', {
        flagName
      });
    } catch (error) {
      logger.error(`Error deleting feature flag ${flagName}`, 'FeatureFlagConfig', {
        flagName
      }, error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /**
   * List all feature flags
   */
  async listFeatureFlags(): Promise<string[]> {
    try {
      const list = await this.env.SESSIONS.list({ prefix: 'flag_config:' });
      return list.keys.map(key => key.name.replace('flag_config:', ''));
    } catch (error) {
      logger.error('Error listing feature flags', 'FeatureFlagConfig', {}, error instanceof Error ? error : String(error));
      return [];
    }
  }

  /**
   * Validate feature flag configuration
   */
  private validateFeatureFlagConfig(config: FeatureFlagConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid feature flag configuration: must be an object');
    }

    if (typeof config.enabled !== 'boolean') {
      throw new Error('Invalid feature flag configuration: enabled must be a boolean');
    }

    if (config.deploymentPhase && typeof config.deploymentPhase !== 'string') {
      throw new Error('Invalid feature flag configuration: deploymentPhase must be a string');
    }

    if (config.rolloutPercentage !== undefined) {
      if (typeof config.rolloutPercentage !== 'number' ||
          config.rolloutPercentage < 0 ||
          config.rolloutPercentage > 100) {
        throw new Error('Invalid feature flag configuration: rolloutPercentage must be between 0 and 100');
      }
    }

    if (config.targeting && typeof config.targeting !== 'object') {
      throw new Error('Invalid feature flag configuration: targeting must be an object');
    }
  }

  /**
   * Log feature flag update for audit trail
   */
  private async logFlagUpdate(flagName: string, config: FeatureFlagConfig): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        flagName,
        action: 'update',
        config: {
          enabled: config.enabled,
          deploymentPhase: config.deploymentPhase,
          rolloutPercentage: config.rolloutPercentage
        }
      };

      await this.env.SESSIONS.put(
        `flag_audit:${flagName}:${Date.now()}`,
        JSON.stringify(logEntry)
      );
    } catch (error) {
      logger.warn(`Failed to log flag update for ${flagName}`, 'FeatureFlagConfig', {
        flagName
      });
      // Don't throw - logging failure shouldn't break flag updates
    }
  }
}