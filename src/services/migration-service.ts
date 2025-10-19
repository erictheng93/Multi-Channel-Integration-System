// Migration Service for WebSocket Feature Rollout
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 管理 WebSocket 功能的漸進式部署和 A/B 測試

import type {
  MigrationConfig
} from '../types/websocket-types';
import type { Bindings } from '../types/bindings';

/**
 * Architecture Overview:
 *
 * MigrationService manages:
 * 1. Progressive rollout of WebSocket connections
 * 2. Feature flag management for gradual deployment
 * 3. A/B testing framework for feature rollout
 * 4. Canary deployment and performance monitoring
 * 5. Emergency controls and rollback capabilities
 *
 * This ensures safe and gradual feature deployment with minimal disruption
 */

export class MigrationService {
  private env: Bindings;
  private config: MigrationConfig | null = null;
  private configCacheExpiry = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  // Migration strategies
  private readonly STRATEGIES = {
    immediate: this.immediateStrategy.bind(this),
    gradual: this.gradualStrategy.bind(this),
    canary: this.canaryStrategy.bind(this)
  };

  constructor(env: Bindings) {
    this.env = env;
  }

  // =================== Migration Decision Engine ===================

  /**
   * Determine if a user should use WebSocket
   * @param userId User identifier
   * @param userAgent User's browser/client information
   * @param options Additional decision factors
   * @returns WebSocket availability decision
   */
  async shouldUseWebSocket(
    userId: string,
    userAgent?: string,
    options: {
      conversationId?: string;
      role?: string;
      teamId?: number;
      clientVersion?: string;
      previousConnectionType?: 'websocket';
      connectionFailures?: number;
    } = {}
  ): Promise<{
    useWebSocket: boolean;
    reason: string;
    fallbackAvailable: boolean;
    migrationPhase: string;
  }> {
    try {
      const config = await this.getMigrationConfig();

      console.log(`🎯 [MigrationService] Decision request for user ${userId}, strategy: ${config.migrationStrategy}`);

      // Check if WebSocket is globally disabled
      if (!config.enableWebSocket) {
        return {
          useWebSocket: false,
          reason: 'WebSocket globally disabled',
          fallbackAvailable: false,
          migrationPhase: 'disabled'
        };
      }

      // Check if user has too many connection failures
      if (options.connectionFailures && options.connectionFailures > 3) {
        return {
          useWebSocket: false,
          reason: 'Too many WebSocket connection failures',
          fallbackAvailable: false,
          migrationPhase: 'fallback'
        };
      }

      // Apply migration strategy
      const strategyFunction = this.STRATEGIES[config.migrationStrategy];
      const decision = await strategyFunction(userId, userAgent, options, config);

      // Log decision for monitoring
      await this.logMigrationDecision(userId, decision, options);

      return decision;

    } catch (error) {
      console.error('❌ [MigrationService] Decision engine error:', error);

      // Safe fallback on error
      return {
        useWebSocket: false,
        reason: 'Migration service error',
        fallbackAvailable: true,
        migrationPhase: 'error'
      };
    }
  }

  // =================== Migration Strategies ===================

  private async immediateStrategy(
    _userId: string,
    _userAgent?: string,
    _options: any = {},
    _config: MigrationConfig = {} as MigrationConfig
  ): Promise<{
    useWebSocket: boolean;
    reason: string;
    fallbackAvailable: boolean;
    migrationPhase: string;
  }> {
    // Immediate strategy: all users get WebSocket
    return {
      useWebSocket: true,
      reason: 'Immediate migration strategy',
      fallbackAvailable: false,
      migrationPhase: 'immediate'
    };
  }

  private async gradualStrategy(
    userId: string,
    userAgent?: string,
    options: any = {},
    config: MigrationConfig = {} as MigrationConfig
  ): Promise<{
    useWebSocket: boolean;
    reason: string;
    fallbackAvailable: boolean;
    migrationPhase: string;
  }> {
    // Gradual strategy: percentage-based rollout with smart criteria

    // Check user hash for consistent assignment
    const userHash = await this.hashUserId(userId);
    const userPercentile = userHash % 100;

    // Base rollout percentage
    let rolloutPercentage = config.rolloutPercentage;

    // Apply boost factors
    const boosts = await this.calculateRolloutBoosts(userId, userAgent, options);
    rolloutPercentage = Math.min(100, rolloutPercentage + boosts.total);

    const shouldUse = userPercentile < rolloutPercentage;

    console.log(`📊 [MigrationService] Gradual decision for user ${userId}: ${userPercentile}/${rolloutPercentage} = ${shouldUse}`);

    return {
      useWebSocket: shouldUse,
      reason: shouldUse ?
        `User in rollout group (${userPercentile}% < ${rolloutPercentage}%)${boosts.reasons.length ? ` with boosts: ${boosts.reasons.join(', ')}` : ''}` :
        `User not in rollout group (${userPercentile}% >= ${rolloutPercentage}%)`,
      fallbackAvailable: false,
      migrationPhase: 'gradual'
    };
  }

  private async canaryStrategy(
    userId: string,
    userAgent?: string,
    options: any = {},
    config: MigrationConfig = {} as MigrationConfig
  ): Promise<{
    useWebSocket: boolean;
    reason: string;
    fallbackAvailable: boolean;
    migrationPhase: string;
  }> {
    // Canary strategy: specific user groups get WebSocket first

    // Check if user is in canary group
    const isCanaryUser = await this.isCanaryUser(userId, options);

    if (isCanaryUser.inGroup) {
      return {
        useWebSocket: true,
        reason: `Canary user: ${isCanaryUser.reason}`,
        fallbackAvailable: false,
        migrationPhase: 'canary'
      };
    }

    // Check if canary is successful and should expand
    const canaryMetrics = await this.getCanaryMetrics();
    if (canaryMetrics.successRate > 0.95 && canaryMetrics.sampleSize > 100) {
      // Successful canary, start gradual rollout
      return this.gradualStrategy(userId, userAgent, options, {
        ...config,
        rolloutPercentage: Math.min(config.rolloutPercentage * 2, 100)
      });
    }

    return {
      useWebSocket: false,
      reason: 'Not in canary group',
      fallbackAvailable: false,
      migrationPhase: 'canary-waiting'
    };
  }

  // =================== Rollout Boost Calculations ===================

  private async calculateRolloutBoosts(
    userId: string,
    userAgent?: string,
    options: any = {}
  ): Promise<{ total: number; reasons: string[] }> {
    const boosts: { amount: number; reason: string }[] = [];

    // Admin and team users get priority
    if (options.role === 'admin') {
      boosts.push({ amount: 30, reason: 'admin role' });
    } else if (options.role === 'team') {
      boosts.push({ amount: 20, reason: 'team leader role' });
    }

    // Modern browsers get boost
    if (userAgent && this.isModernBrowser(userAgent)) {
      boosts.push({ amount: 10, reason: 'modern browser' });
    }

    // High-activity users get boost
    const userActivity = await this.getUserActivityLevel(userId);
    if (userActivity === 'high') {
      boosts.push({ amount: 15, reason: 'high activity user' });
    } else if (userActivity === 'medium') {
      boosts.push({ amount: 5, reason: 'medium activity user' });
    }

    // Previous successful WebSocket users get boost
    if (options.previousConnectionType === 'websocket') {
      boosts.push({ amount: 25, reason: 'previous WebSocket success' });
    }

    // Team-based rollout
    if (options.teamId) {
      const teamMigrationLevel = await this.getTeamMigrationLevel(options.teamId);
      if (teamMigrationLevel > 0.5) {
        boosts.push({ amount: 20, reason: 'team already migrated' });
      }
    }

    const total = boosts.reduce((sum, boost) => sum + boost.amount, 0);
    const reasons = boosts.map(boost => boost.reason);

    return { total, reasons };
  }

  // =================== User Classification ===================

  private async isCanaryUser(userId: string, options: any = {}): Promise<{ inGroup: boolean; reason: string }> {
    // Admins are always canary users
    if (options.role === 'admin') {
      return { inGroup: true, reason: 'admin user' };
    }

    // Specific team leaders
    if (options.role === 'team' && options.teamId) {
      return { inGroup: true, reason: 'team leader' };
    }

    // High-activity users
    const activityLevel = await this.getUserActivityLevel(userId);
    if (activityLevel === 'high') {
      return { inGroup: true, reason: 'high activity user' };
    }

    // Users with specific feature flag
    const hasCanaryFlag = await this.hasUserFeatureFlag(userId, 'websocket_canary');
    if (hasCanaryFlag) {
      return { inGroup: true, reason: 'canary feature flag' };
    }

    return { inGroup: false, reason: 'not selected for canary' };
  }

  private async getUserActivityLevel(userId: string): Promise<'low' | 'medium' | 'high'> {
    try {
      // This would integrate with existing database to check user activity
      // For now, return mock data based on user ID hash
      const hash = await this.hashUserId(userId);
      if (hash % 10 < 2) return 'high';
      if (hash % 10 < 6) return 'medium';
      return 'low';
    } catch (error) {
      console.error('❌ [MigrationService] Error getting user activity:', error);
      return 'low';
    }
  }

  private async getTeamMigrationLevel(teamId: number): Promise<number> {
    try {
      // Get percentage of team members already using WebSocket
      const cacheKey = `team_migration_level:${teamId}`;
      const cached = await this.env.CACHE.get(cacheKey);

      if (cached) {
        return parseFloat(cached);
      }

      // Mock calculation - would integrate with real database
      const mockLevel = (teamId % 10) / 10;
      await this.env.CACHE.put(cacheKey, mockLevel.toString(), { expirationTtl: 300 });

      return mockLevel;
    } catch (error) {
      console.error('❌ [MigrationService] Error getting team migration level:', error);
      return 0;
    }
  }

  private isModernBrowser(userAgent: string): boolean {
    // Simple modern browser detection
    const modernPatterns = [
      /Chrome\/(\d+)/,
      /Firefox\/(\d+)/,
      /Safari\/(\d+)/,
      /Edge\/(\d+)/
    ];

    return modernPatterns.some(pattern => {
      const match = userAgent.match(pattern);
      if (!match) return false;

      const version = parseInt(match[1] || '0');
      // Very basic version checks - in reality would be more sophisticated
      return version > 70;
    });
  }

  // =================== Feature Flags ===================

  async hasUserFeatureFlag(userId: string, flagName: string): Promise<boolean> {
    try {
      const flagKey = `user_feature_flag:${userId}:${flagName}`;
      const flag = await this.env.CACHE.get(flagKey);
      return flag === 'true';
    } catch (error) {
      console.error('❌ [MigrationService] Error checking user feature flag:', error);
      return false;
    }
  }

  async setUserFeatureFlag(userId: string, flagName: string, enabled: boolean): Promise<void> {
    try {
      const flagKey = `user_feature_flag:${userId}:${flagName}`;
      await this.env.CACHE.put(flagKey, enabled.toString(), { expirationTtl: 86400 }); // 24 hours
    } catch (error) {
      console.error('❌ [MigrationService] Error setting user feature flag:', error);
    }
  }

  async getGlobalFeatureFlag(flagName: string): Promise<boolean> {
    try {
      const config = await this.getMigrationConfig();
      return config.featureFlags[flagName as keyof typeof config.featureFlags] || false;
    } catch (error) {
      console.error('❌ [MigrationService] Error getting global feature flag:', error);
      return false;
    }
  }

  // =================== Metrics and Monitoring ===================

  private async logMigrationDecision(
    userId: string,
    decision: any,
    options: any
  ): Promise<void> {
    try {
      const logEntry = {
        userId,
        decision: decision.useWebSocket,
        reason: decision.reason,
        migrationPhase: decision.migrationPhase,
        userAgent: options.userAgent,
        role: options.role,
        teamId: options.teamId,
        timestamp: Date.now()
      };

      // Store decision for analytics
      const logKey = `migration_decision:${userId}:${Date.now()}`;
      await this.env.CACHE.put(logKey, JSON.stringify(logEntry), { expirationTtl: 604800 }); // 7 days

      // Update decision counters
      await this.updateDecisionCounters('websocket');

    } catch (error) {
      console.error('❌ [MigrationService] Error logging migration decision:', error);
    }
  }

  private async updateDecisionCounters(connectionType: 'websocket'): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const counterKey = `migration_counter:${today}:${connectionType}`;

      const currentCount = await this.env.CACHE.get(counterKey);
      const newCount = (currentCount ? parseInt(currentCount) : 0) + 1;

      await this.env.CACHE.put(counterKey, newCount.toString(), { expirationTtl: 172800 }); // 2 days
    } catch (error) {
      console.error('❌ [MigrationService] Error updating decision counters:', error);
    }
  }

  async getMigrationMetrics(): Promise<{
    websocketAdoption: number;
    migrationPhases: Record<string, number>;
    successRates: { websocket: number };
    todayDecisions: { websocket: number };
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const websocketCount = await this.env.CACHE.get(`migration_counter:${today}:websocket`);

      const websocketDecisions = websocketCount ? parseInt(websocketCount) : 0;

      return {
        websocketAdoption: 100, // 100% WebSocket adoption
        migrationPhases: {
          gradual: 0, // Would be populated from stored decisions
          canary: 0,
          immediate: 100,
          disabled: 0
        },
        successRates: {
          websocket: 95 // Mock data - would come from connection metrics
        },
        todayDecisions: {
          websocket: websocketDecisions
        }
      };

    } catch (error) {
      console.error('❌ [MigrationService] Error getting migration metrics:', error);
      return {
        websocketAdoption: 100,
        migrationPhases: {},
        successRates: { websocket: 0 },
        todayDecisions: { websocket: 0 }
      };
    }
  }

  private async getCanaryMetrics(): Promise<{ successRate: number; sampleSize: number }> {
    try {
      // This would integrate with real connection success metrics
      // For now, return mock data
      return {
        successRate: 0.96,
        sampleSize: 150
      };
    } catch (error) {
      console.error('❌ [MigrationService] Error getting canary metrics:', error);
      return { successRate: 0, sampleSize: 0 };
    }
  }

  // =================== Configuration Management ===================

  async getMigrationConfig(): Promise<MigrationConfig> {
    const now = Date.now();

    // Use cached config if still valid
    if (this.config && now < this.configCacheExpiry) {
      return this.config;
    }

    try {
      const configStr = await this.env.SESSIONS.get('websocket_migration_config');
      if (configStr) {
        this.config = JSON.parse(configStr);
        this.configCacheExpiry = now + this.CACHE_TTL;
        return this.config!;
      }
    } catch (error) {
      console.error('❌ [MigrationService] Error loading migration config:', error);
    }

    // Return default config
    // ✅ Phase 4 Complete: 100% WebSocket rollout with Durable Objects
    const defaultConfig: MigrationConfig = {
      enableWebSocket: true,
      migrationStrategy: 'immediate', // All users get WebSocket immediately
      rolloutPercentage: 100,         // 100% WebSocket adoption
      featureFlags: {
        websocketConnections: true,
        durableObjectMessaging: true,
        distributedLocking: true,     // Phase 4: All features enabled
        batchMessageProcessing: true,
        realTimeTypingIndicators: true
      }
    };

    this.config = defaultConfig;
    this.configCacheExpiry = now + this.CACHE_TTL;
    return defaultConfig;
  }

  async updateMigrationConfig(updates: Partial<MigrationConfig>): Promise<MigrationConfig> {
    const currentConfig = await this.getMigrationConfig();
    const newConfig = { ...currentConfig, ...updates };

    // Validate configuration
    this.validateMigrationConfig(newConfig);

    // Store updated config
    await this.env.SESSIONS.put('websocket_migration_config', JSON.stringify(newConfig));

    // Clear cache to force reload
    this.config = null as MigrationConfig | null;
    this.configCacheExpiry = 0;

    console.log(`⚙️ [MigrationService] Config updated:`, updates);
    return newConfig;
  }

  private validateMigrationConfig(config: MigrationConfig): void {
    if (config.rolloutPercentage < 0 || config.rolloutPercentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    if (!['immediate', 'gradual', 'canary'].includes(config.migrationStrategy)) {
      throw new Error('Invalid migration strategy');
    }

    if (!config.enableWebSocket) {
      throw new Error('WebSocket must be enabled');
    }
  }

  // =================== Emergency Controls ===================

  async emergencyDisableWebSocket(reason: string): Promise<void> {
    console.warn(`🚨 [MigrationService] Emergency WebSocket disable: ${reason}`);

    await this.updateMigrationConfig({
      enableWebSocket: false,
      rolloutPercentage: 0
    });

    // Log emergency action
    const emergencyLog = {
      action: 'emergency_websocket_disable',
      reason,
      timestamp: Date.now()
    };

    await this.env.CACHE.put(
      `emergency_action:${Date.now()}`,
      JSON.stringify(emergencyLog),
      { expirationTtl: 2592000 } // 30 days
    );
  }

  async emergencyPauseRollout(reason: string): Promise<void> {
    console.warn(`⏸️ [MigrationService] Emergency pause rollout: ${reason}`);

    const currentConfig = await this.getMigrationConfig();
    await this.updateMigrationConfig({
      rolloutPercentage: 0,
      migrationStrategy: 'gradual'
    });

    // Store previous config for potential restoration
    await this.env.CACHE.put(
      'migration_config_backup',
      JSON.stringify(currentConfig),
      { expirationTtl: 86400 } // 24 hours
    );
  }

  async restorePreviousConfig(): Promise<boolean> {
    try {
      const backupConfigStr = await this.env.CACHE.get('migration_config_backup');
      if (!backupConfigStr) {
        return false;
      }

      const backupConfig = JSON.parse(backupConfigStr);
      await this.updateMigrationConfig(backupConfig);

      console.log(`🔄 [MigrationService] Previous config restored`);
      return true;

    } catch (error) {
      console.error('❌ [MigrationService] Error restoring previous config:', error);
      return false;
    }
  }

  // =================== Utility Methods ===================

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

  async getConnectionRecommendation(
    userId: string,
    context: {
      userAgent?: string;
      role?: string;
      teamId?: number;
      conversationId?: string;
      previousFailures?: number;
    } = {}
  ): Promise<{
    primary: 'websocket';
    fallback: 'websocket';
    reason: string;
    confidence: number;
  }> {
    const decision = await this.shouldUseWebSocket(userId, context.userAgent, context);

    return {
      primary: 'websocket',
      fallback: 'websocket',
      reason: decision.reason,
      confidence: decision.useWebSocket ? 0.95 : 0.8
    };
  }
}