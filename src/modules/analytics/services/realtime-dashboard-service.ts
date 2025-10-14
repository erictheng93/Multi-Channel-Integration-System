// Real-time Dashboard Service - 實時儀表板服務
// 提供 SSE 和 WebSocket 支持的實時數據推送功能

import { DashboardService } from '@modules/analytics/services/dashboard-service';
import { MetricsCollector } from '@modules/analytics/services/metrics-collector';
import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '@/types';
import type {
  DashboardWidget,
  WidgetData,
  TimeRange,
  DashboardConfig
} from '../types/dashboard-types';
import { AnalyticsError } from '@modules/analytics/types/analytics-types';
import { getSSECorsHeaders } from '@/config/cors';

/**
 * 實時更新事件類型
 */
interface RealtimeEvent {
  type: 'widget_update' | 'dashboard_update' | 'config_change' | 'error' | 'heartbeat';
  dashboardId: string;
  widgetId?: string;
  data?: any;
  timestamp: string;
  userId: string;
}

/**
 * SSE 連接信息
 */
interface SSEConnection {
  id: string;
  userId: string;
  dashboardId: string;
  controller: ReadableStreamDefaultController;
  lastHeartbeat: number;
  widgets: string[]; // 訂閱的小工具 ID 列表
}

/**
 * 訂閱配置
 */
interface SubscriptionConfig {
  userId: string;
  dashboardId: string;
  widgets: string[];
  updateInterval: number; // 更新間隔（毫秒）
  enableHeartbeat: boolean;
  heartbeatInterval: number;
}

/**
 * 實時儀表板服務配置
 */
interface RealtimeDashboardOptions {
  maxConnections?: number;
  defaultUpdateInterval?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  enableMetrics?: boolean;
  batchUpdates?: boolean;
  batchInterval?: number;
}

const DEFAULT_OPTIONS: RealtimeDashboardOptions = {
  maxConnections: 1000,
  defaultUpdateInterval: 5000, // 5秒
  heartbeatInterval: 30000, // 30秒
  connectionTimeout: 300000, // 5分鐘
  enableMetrics: true,
  batchUpdates: true,
  batchInterval: 1000 // 1秒
};

/**
 * 實時儀表板服務類
 */
export class RealtimeDashboardService {
  private dashboardService: DashboardService;
  private metricsCollector: MetricsCollector;
  private connections = new Map<string, SSEConnection>();
  private subscriptions = new Map<string, SubscriptionConfig>();
  private updateIntervals = new Map<string, NodeJS.Timeout>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private options: RealtimeDashboardOptions;
  private eventQueue: RealtimeEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(
    private db: D1Database,
    private kv: Bindings['KV'],
    options: RealtimeDashboardOptions = {}
  ) {
    this.dashboardService = new DashboardService(db, kv);
    this.metricsCollector = new MetricsCollector(db, kv);
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.startHeartbeatTimer();
    if (this.options.batchUpdates) {
      this.startBatchProcessor();
    }
  }

  /**
   * 創建 SSE 連接
   */
  async createSSEConnection(
    userId: string,
    dashboardId: string,
    widgets: string[] = []
  ): Promise<Response> {
    try {
      // 檢查連接數限制
      if (this.connections.size >= this.options.maxConnections!) {
        throw new AnalyticsError('Maximum connections reached', 'MAX_CONNECTIONS_EXCEEDED');
      }

      // 驗證用戶權限
      await this.validateUserAccess(userId, dashboardId);

      const connectionId = this.generateConnectionId();

      const stream = new ReadableStream({
        start: (controller) => {
          const connection: SSEConnection = {
            id: connectionId,
            userId,
            dashboardId,
            controller,
            lastHeartbeat: Date.now(),
            widgets
          };

          this.connections.set(connectionId, connection);

          // 發送初始連接確認
          this.sendSSEMessage(controller, {
            type: 'dashboard_update',
            dashboardId,
            data: { status: 'connected', connectionId },
            timestamp: new Date().toISOString(),
            userId
          });

          // 設置訂閱
          this.setupSubscription(connectionId, {
            userId,
            dashboardId,
            widgets,
            updateInterval: this.options.defaultUpdateInterval!,
            enableHeartbeat: true,
            heartbeatInterval: this.options.heartbeatInterval!
          });

          // 發送初始數據
          this.sendInitialData(connectionId);
        },

        cancel: () => {
          this.closeConnection(connectionId);
        }
      });

      // 使用統一的 SSE CORS 配置
      const sseCorsHeaders = getSSECorsHeaders(undefined); // Service level, origin from request context
      return new Response(stream, { headers: sseCorsHeaders });

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      throw new AnalyticsError('Failed to create real-time connection', 'REALTIME_CONNECTION_ERROR', 500, error);
    }
  }

  /**
   * 設置訂閱配置
   */
  private setupSubscription(connectionId: string, config: SubscriptionConfig): void {
    this.subscriptions.set(connectionId, config);

    // 設置定期更新
    const interval = setInterval(async () => {
      try {
        await this.updateConnection(connectionId);
      } catch (error) {
        console.error(`Failed to update connection ${connectionId}:`, error);
        this.closeConnection(connectionId);
      }
    }, config.updateInterval);

    this.updateIntervals.set(connectionId, interval);
  }

  /**
   * 發送初始數據
   */
  private async sendInitialData(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      const subscription = this.subscriptions.get(connectionId);

      if (!connection || !subscription) return;

      // 獲取儀表板數據
      const dashboardData = await this.dashboardService.getDashboardData(
        subscription.userId,
        subscription.dashboardId
      );

      // 如果只訂閱特定小工具，過濾數據
      let filteredData = dashboardData;
      if (subscription.widgets.length > 0) {
        filteredData = {};
        subscription.widgets.forEach(widgetId => {
          if (dashboardData[widgetId]) {
            filteredData[widgetId] = dashboardData[widgetId];
          }
        });
      }

      this.sendSSEMessage(connection.controller, {
        type: 'dashboard_update',
        dashboardId: subscription.dashboardId,
        data: filteredData,
        timestamp: new Date().toISOString(),
        userId: subscription.userId
      });

    } catch (error) {
      console.error('Failed to send initial data:', error);
    }
  }

  /**
   * 更新連接數據
   */
  private async updateConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    const subscription = this.subscriptions.get(connectionId);

    if (!connection || !subscription) return;

    // 檢查連接是否超時
    const now = Date.now();
    if (now - connection.lastHeartbeat > this.options.connectionTimeout!) {
      this.closeConnection(connectionId);
      return;
    }

    try {
      // 獲取更新的數據
      const dashboardData = await this.dashboardService.getDashboardData(
        subscription.userId,
        subscription.dashboardId
      );

      // 過濾小工具數據
      let filteredData = dashboardData;
      if (subscription.widgets.length > 0) {
        filteredData = {};
        subscription.widgets.forEach(widgetId => {
          if (dashboardData[widgetId]) {
            filteredData[widgetId] = dashboardData[widgetId];
          }
        });
      }

      const event: RealtimeEvent = {
        type: 'dashboard_update',
        dashboardId: subscription.dashboardId,
        data: filteredData,
        timestamp: new Date().toISOString(),
        userId: subscription.userId
      };

      if (this.options.batchUpdates) {
        this.queueEvent(event, connectionId);
      } else {
        this.sendSSEMessage(connection.controller, event);
      }

    } catch (error) {
      // 發送錯誤事件
      this.sendSSEMessage(connection.controller, {
        type: 'error',
        dashboardId: subscription.dashboardId,
        data: { message: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
        userId: subscription.userId
      });
    }
  }

  /**
   * 廣播小工具更新
   */
  async broadcastWidgetUpdate(dashboardId: string, widgetId: string, data: WidgetData): Promise<void> {
    const event: RealtimeEvent = {
      type: 'widget_update',
      dashboardId,
      widgetId,
      data,
      timestamp: new Date().toISOString(),
      userId: '' // 將在發送時填充
    };

    // 向所有相關連接廣播
    for (const [connectionId, connection] of this.connections.entries()) {
      const subscription = this.subscriptions.get(connectionId);

      if (subscription &&
          subscription.dashboardId === dashboardId &&
          (subscription.widgets.length === 0 || subscription.widgets.includes(widgetId))) {

        event.userId = subscription.userId;

        if (this.options.batchUpdates) {
          this.queueEvent(event, connectionId);
        } else {
          this.sendSSEMessage(connection.controller, event);
        }
      }
    }
  }

  /**
   * 廣播配置變更
   */
  async broadcastConfigChange(dashboardId: string, config: DashboardConfig): Promise<void> {
    const event: RealtimeEvent = {
      type: 'config_change',
      dashboardId,
      data: config,
      timestamp: new Date().toISOString(),
      userId: '' // 將在發送時填充
    };

    // 向所有相關連接廣播
    for (const [connectionId, connection] of this.connections.entries()) {
      const subscription = this.subscriptions.get(connectionId);

      if (subscription && subscription.dashboardId === dashboardId) {
        event.userId = subscription.userId;

        if (this.options.batchUpdates) {
          this.queueEvent(event, connectionId);
        } else {
          this.sendSSEMessage(connection.controller, event);
        }
      }
    }
  }

  /**
   * 更新訂閱配置
   */
  async updateSubscription(
    connectionId: string,
    updates: Partial<SubscriptionConfig>
  ): Promise<void> {
    const subscription = this.subscriptions.get(connectionId);
    if (!subscription) {
      throw new AnalyticsError(`Subscription not found: ${connectionId}`, 'SUBSCRIPTION_NOT_FOUND');
    }

    const updatedSubscription = { ...subscription, ...updates };
    this.subscriptions.set(connectionId, updatedSubscription);

    // 重設定時器
    if (updates.updateInterval) {
      const existingInterval = this.updateIntervals.get(connectionId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      const interval = setInterval(async () => {
        try {
          await this.updateConnection(connectionId);
        } catch (error) {
          console.error(`Failed to update connection ${connectionId}:`, error);
          this.closeConnection(connectionId);
        }
      }, updates.updateInterval);

      this.updateIntervals.set(connectionId, interval);
    }
  }

  /**
   * 關閉連接
   */
  closeConnection(connectionId: string): void {
    try {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.controller.close();
        this.connections.delete(connectionId);
      }

      this.subscriptions.delete(connectionId);

      const interval = this.updateIntervals.get(connectionId);
      if (interval) {
        clearInterval(interval);
        this.updateIntervals.delete(connectionId);
      }

      // 記錄指標
      if (this.options.enableMetrics) {
        this.recordConnectionMetric('disconnect', connectionId);
      }

    } catch (error) {
      console.error('Failed to close connection:', error);
    }
  }

  /**
   * 獲取連接狀態
   */
  getConnectionStatus(): {
    totalConnections: number;
    connectionsByDashboard: Record<string, number>;
    connectionsByUser: Record<string, number>;
  } {
    const connectionsByDashboard: Record<string, number> = {};
    const connectionsByUser: Record<string, number> = {};

    for (const subscription of this.subscriptions.values()) {
      connectionsByDashboard[subscription.dashboardId] = (connectionsByDashboard[subscription.dashboardId] || 0) + 1;
      connectionsByUser[subscription.userId] = (connectionsByUser[subscription.userId] || 0) + 1;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByDashboard,
      connectionsByUser
    };
  }

  /**
   * 清理過期連接
   */
  cleanupExpiredConnections(): void {
    const now = Date.now();
    const expiredConnections: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastHeartbeat > this.options.connectionTimeout!) {
        expiredConnections.push(connectionId);
      }
    }

    expiredConnections.forEach(connectionId => {
      this.closeConnection(connectionId);
    });

    console.log(`Cleaned up ${expiredConnections.length} expired connections`);
  }

  // 私有輔助方法

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

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendSSEMessage(controller: ReadableStreamDefaultController, event: RealtimeEvent): void {
    try {
      const message = `data: ${JSON.stringify(event)}\n\n`;
      controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      console.error('Failed to send SSE message:', error);
    }
  }

  private queueEvent(event: RealtimeEvent, connectionId: string): void {
    this.eventQueue.push({ ...event, connectionId } as any);
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.processBatchedEvents();
    }, this.options.batchInterval!);
  }

  private processBatchedEvents(): void {
    if (this.eventQueue.length === 0) return;

    // 按連接分組事件
    const eventsByConnection = new Map<string, RealtimeEvent[]>();

    for (const event of this.eventQueue) {
      const connectionId = (event as any).connectionId;
      if (!eventsByConnection.has(connectionId)) {
        eventsByConnection.set(connectionId, []);
      }
      eventsByConnection.get(connectionId)!.push(event);
    }

    // 發送批量事件
    for (const [connectionId, events] of eventsByConnection) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        try {
          for (const event of events) {
            this.sendSSEMessage(connection.controller, event);
          }
        } catch (error) {
          console.error(`Failed to send batched events to ${connectionId}:`, error);
          this.closeConnection(connectionId);
        }
      }
    }

    // 清空事件隊列
    this.eventQueue.length = 0;
  }

  private startHeartbeatTimer(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
      this.cleanupExpiredConnections();
    }, this.options.heartbeatInterval!);
  }

  private sendHeartbeats(): void {
    const heartbeatEvent: RealtimeEvent = {
      type: 'heartbeat',
      dashboardId: '',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      userId: ''
    };

    for (const [connectionId, connection] of this.connections.entries()) {
      const subscription = this.subscriptions.get(connectionId);
      if (subscription?.enableHeartbeat) {
        heartbeatEvent.dashboardId = subscription.dashboardId;
        heartbeatEvent.userId = subscription.userId;

        this.sendSSEMessage(connection.controller, heartbeatEvent);
        connection.lastHeartbeat = Date.now();
      }
    }
  }

  private recordConnectionMetric(type: 'connect' | 'disconnect', connectionId: string): void {
    // TODO: 實現指標記錄
    console.log(`Connection ${type}: ${connectionId}`);
  }

  /**
   * 清理資源
   */
  cleanup(): void {
    // 關閉所有連接
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }

    // 清理定時器
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }

    this.updateIntervals.clear();
    this.connections.clear();
    this.subscriptions.clear();
    this.eventQueue.length = 0;
  }
}

export default RealtimeDashboardService;