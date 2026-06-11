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
import { nowMs } from '@/utils/timestamp';

const log = createContextLogger('RealtimeDashboard');

interface RealtimeDashboardOptions {
  env?: Pick<Bindings, 'MESSAGE_BROADCASTER'>;
}

interface AnalyticsRealtimeEvent {
  id: string;
  type: 'analytics_widget_updated' | 'analytics_dashboard_updated';
  source: 'analytics';
  timestamp: number;
  data: {
    dashboardId: string;
    widgetId?: string;
    widgetData?: WidgetData;
    config?: DashboardConfig;
  };
  priority: 'normal';
  deliveryOptions: {
    broadcast: true;
    targets: Array<{
      type: 'global';
      targets: string[];
      filters: {
        eventTypes: string[];
      };
    }>;
  };
}

export interface RealtimeBroadcastResult {
  success: boolean;
  eventId?: string;
  status?: number;
  skippedReason?: 'MESSAGE_BROADCASTER_UNAVAILABLE';
}

/**
 * 實時儀表板服務類
 * Provides dashboard data retrieval and broadcasting capabilities.
 * Real-time push is handled by WebSocket via Durable Objects.
 */
export class RealtimeDashboardService {
  private dashboardService: DashboardService;
  private env?: Pick<Bindings, 'MESSAGE_BROADCASTER'>;

  constructor(
    db: D1Database,
    kv: Bindings['KV'],
    options: RealtimeDashboardOptions = {}
  ) {
    this.dashboardService = new DashboardService(db, kv);
    this.env = options.env;
  }

  /**
   * Get dashboard data for a user
   */
  async getDashboardData(userId: string, dashboardId: string) {
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
   * Broadcast widget update event.
   */
  async broadcastWidgetUpdate(dashboardId: string, widgetId: string, widgetData: WidgetData): Promise<RealtimeBroadcastResult> {
    return this.publishGlobalEvent({
      id: this.generateEventId('analytics-widget'),
      type: 'analytics_widget_updated',
      source: 'analytics',
      timestamp: nowMs(),
      data: { dashboardId, widgetId, widgetData },
      priority: 'normal',
      deliveryOptions: {
        broadcast: true,
        targets: [{
          type: 'global',
          targets: ['analytics'],
          filters: { eventTypes: ['analytics_widget_updated'] }
        }]
      }
    });
  }

  /**
   * Broadcast config change event.
   */
  async broadcastConfigChange(dashboardId: string, config: DashboardConfig): Promise<RealtimeBroadcastResult> {
    return this.publishGlobalEvent({
      id: this.generateEventId('analytics-dashboard'),
      type: 'analytics_dashboard_updated',
      source: 'analytics',
      timestamp: nowMs(),
      data: { dashboardId, config },
      priority: 'normal',
      deliveryOptions: {
        broadcast: true,
        targets: [{
          type: 'global',
          targets: ['analytics'],
          filters: { eventTypes: ['analytics_dashboard_updated'] }
        }]
      }
    });
  }

  /**
   * Update subscription (no-op, kept for API compatibility)
   */
  async updateSubscription(connectionId: string, _updates: unknown): Promise<void> {
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

  private async publishGlobalEvent(event: AnalyticsRealtimeEvent): Promise<RealtimeBroadcastResult> {
    const broadcaster = this.env?.MESSAGE_BROADCASTER;
    if (!broadcaster) {
      log.warn('MESSAGE_BROADCASTER binding not available for analytics realtime event', {
        eventId: event.id,
        eventType: event.type
      });
      return {
        success: false,
        eventId: event.id,
        skippedReason: 'MESSAGE_BROADCASTER_UNAVAILABLE'
      };
    }

    const target = event.deliveryOptions.targets[0];
    const id = broadcaster.idFromName('global');
    const stub = broadcaster.get(id);
    const response = await stub.fetch(new Request('https://message-broadcaster/broadcast-global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, target })
    }));

    return {
      success: response.ok,
      eventId: event.id,
      status: response.status
    };
  }

  private generateEventId(prefix: string): string {
    const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${nowMs()}-${Math.random().toString(36).slice(2)}`;

    return `${prefix}-${randomId}`;
  }

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
