// Broadcast Config
// Manages KV-based migration config and health status for WebSocket broadcasting
// Extracted from websocket-broadcast-service.ts (Phase 3 refactor)

import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('BroadcastConfig')

import type { MigrationConfig } from '@/types/websocket-types';
import { nowMs } from '@/utils/timestamp'

/**
 * Health status for the broadcasting service
 */
export interface BroadcastHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  websocketEnabled: boolean;
  durableObjectsAvailable: boolean;
  lastError?: string;
  timestamp: number;
}

/**
 * BroadcastConfig
 *
 * Reads migration/feature-flag configuration from KV storage
 * and provides health check functionality for the broadcasting layer.
 *
 * Caches the config in memory after first read to avoid repeated KV lookups.
 */
export class BroadcastConfig {
  private env: Bindings;
  private migrationConfig: MigrationConfig | null = null;

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Get migration configuration (cached after first read)
   */
  async getMigrationConfig(): Promise<MigrationConfig> {
    if (this.migrationConfig) {
      return this.migrationConfig;
    }

    try {
      const configStr = await this.env.SESSIONS.get('websocket_migration_config');
      if (configStr) {
        this.migrationConfig = JSON.parse(configStr);
        return this.migrationConfig!;
      }
    } catch (error) {
      log.error('Config error', {}, error as Error);
    }

    // Default: 100% WebSocket rollout with all features enabled
    this.migrationConfig = {
      enableWebSocket: true,
      migrationStrategy: 'immediate',
      rolloutPercentage: 100,
      featureFlags: {
        websocketConnections: true,
        durableObjectMessaging: true,
        distributedLocking: true,
        batchMessageProcessing: true,
        realTimeTypingIndicators: true
      }
    };

    return this.migrationConfig;
  }

  /**
   * Get broadcasting service health status
   */
  async getHealthStatus(): Promise<BroadcastHealthStatus> {
    try {
      const config = await this.getMigrationConfig();

      // Check Durable Objects availability
      let durableObjectsAvailable = false;
      try {
        if (!this.env.MESSAGE_BROADCASTER) {
          throw new Error('MESSAGE_BROADCASTER binding not available');
        }

        const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('health-check');
        const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

        if (broadcasterStub) {
          const response = await broadcasterStub.fetch(new Request('https://message-broadcaster/ping', {
            method: 'GET'
          }));
          durableObjectsAvailable = response.ok;
        }
      } catch (error) {
        log.error('Durable Objects health check failed', {}, error as Error);
      }

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!config.enableWebSocket) {
        status = 'unhealthy';
      } else if (!durableObjectsAvailable && config.enableWebSocket) {
        status = 'degraded';
      }

      return {
        status,
        websocketEnabled: config.enableWebSocket,
        durableObjectsAvailable,
        timestamp: nowMs()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        websocketEnabled: false,
        durableObjectsAvailable: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        timestamp: nowMs()
      };
    }
  }
}
