// Real-time Dashboard Service - 實時儀表板服務
// Provides dashboard data access and widget update broadcasting
// Real-time push is handled by WebSocket via Durable Objects

import { DashboardService } from '@modules/analytics/services/dashboard-service';
import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '@/types';
import type {
  DashboardWidget,
  WidgetData,
  DashboardConfig
} from '../types/dashboard-types';
import { AnalyticsError } from '@modules/analytics/types/analytics-types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('RealtimeDashboard');

/**
 * 實時儀表板服務類
 * Provides dashboard data retrieval and broadcasting capabilities.
 * Real-time push is handled by WebSocket via Durable Objects.
 */
export class RealtimeDashboardService {
  private dashboardService: DashboardService;

  constructor(
    db: D1Database,
    kv: Bindings['KV'],
    _options: Record<string, any> = {}
  ) {
    this.dashboardService = new DashboardService(db, kv);
  }

  /**
   * Get dashboard data for a user
   */
  async getDashboardData(userId: string, dashboardId: string): Promise<any> {
    await this.validateUserAccess(userId, dashboardId);
    return await this.dashboardService.getDashboardData(userId, dashboardId);
  }

  /**
   * Get widget data
   */
  async getWidgetData(userId: string, dashboardId: string, widgetId: string): Promise<WidgetData | null> {
    const config = await this.dashboardService.getDashboardConfig(userId, dashboardId);
    const widget = config.widgets.find((w: DashboardWidget) => w.id === widgetId);
    if (!widget) return null;
    return await this.dashboardService.getWidgetData(widget);
  }

  /**
   * Broadcast widget update (placeholder for WebSocket integration)
   */
  async broadcastWidgetUpdate(dashboardId: string, widgetId: string, _data: WidgetData): Promise<void> {
    // In the WebSocket architecture, broadcasting is handled by Durable Objects.
    // This method is kept as a service-level abstraction for triggering updates.
    log.info(`Widget update: ${dashboardId}/${widgetId}`);
  }

  /**
   * Broadcast config change (placeholder for WebSocket integration)
   */
  async broadcastConfigChange(dashboardId: string, _config: DashboardConfig): Promise<void> {
    log.info(`Config change: ${dashboardId}`);
  }

  /**
   * Update subscription (no-op, kept for API compatibility)
   */
  async updateSubscription(connectionId: string, _updates: any): Promise<void> {
    // Subscriptions are managed by WebSocket Durable Objects
    log.info(`Subscription update requested for ${connectionId}`);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    totalConnections: number;
    connectionsByDashboard: Record<string, number>;
    connectionsByUser: Record<string, number>;
  } {
    // Real-time connections are now managed by WebSocket Durable Objects
    return {
      totalConnections: 0,
      connectionsByDashboard: {},
      connectionsByUser: {}
    };
  }

  /**
   * Cleanup expired connections (no-op, connections managed by Durable Objects)
   */
  cleanupExpiredConnections(): void {
    // Connections are managed by WebSocket Durable Objects
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No resources to clean up - connections managed by Durable Objects
  }

  // Private helpers

  private async validateUserAccess(userId: string, dashboardId: string): Promise<void> {
    try {
      const config = await this.dashboardService.getDashboardConfig(userId, dashboardId);

      const hasAccess = config.permissions.owner === userId ||
                       config.permissions.viewers.includes(userId) ||
                       config.permissions.editors.includes(userId);

      if (!hasAccess) {
        throw new AnalyticsError('Insufficient permissions to access dashboard', 'INSUFFICIENT_PERMISSIONS');
      }
    } catch (error) {
      throw new AnalyticsError('Failed to validate user access', 'USER_ACCESS_VALIDATION_ERROR', 500, error);
    }
  }
}

export default RealtimeDashboardService;
