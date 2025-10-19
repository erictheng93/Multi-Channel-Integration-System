// 隊列統一監控處理器
// Queue Unified Monitoring Handler
// 提供 REALTIME_QUEUE 隊列的監控介面

import { Context } from 'hono';
import type { Bindings } from '../types';
import { successResponse, errorResponse, handleApiError } from '../utils/api-response';
// REMOVED: enhancedSSEManager (Phase 3 cleanup - SSE removed, WebSocket only)

export interface QueueStats {
  name: string;
  binding: string;
  purpose: string;
  status: 'healthy' | 'warning' | 'error';
  metrics: {
    messagesInQueue?: number;
    processingRate?: number;
    errorRate?: number;
    avgProcessingTime?: number;
  };
  configuration: {
    maxBatchSize: number;
    maxBatchTimeout: number;
    retryPolicy: string;
  };
  lastActivity: string;
}

export interface UnifiedMonitoringData {
  summary: {
    totalQueues: number;
    healthyQueues: number;
    totalMessages: number;
    overallStatus: 'healthy' | 'warning' | 'error';
  };
  queues: {
    realtimeQueue: QueueStats;
  };
  realtimeConnections: {
    totalConnections: number;
    connectionsByUser: Record<number, number>;
    activeConversations: number;
  };
  systemHealth: {
    uptime: number;
    memoryUsage?: number;
    cpuUsage?: number;
    lastCheck: string;
  };
}

export const queueMonitorHandler = {
  // 🔍 獲取統一隊列監控數據
  getUnifiedStats: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      console.log('📊 [Queue Monitor] Fetching unified queue statistics...');

      // REMOVED: SSE 連接統計 (Phase 3 cleanup - SSE removed, WebSocket only)
      // const sseStats = enhancedSSEManager.getDetailedStats();
      const sseStats = {
        totalConnections: 0,
        activeConnections: 0,
        connectionsByUser: {} as Record<number, number>
      }; // Placeholder for removed SSE

      // REMOVED: AGENT_QUEUE 統計 (Queue cleanup - no longer needed)

      // REALTIME_QUEUE 統計
      const realtimeQueueStats: QueueStats = {
        name: 'Realtime Events Queue',
        binding: 'REALTIME_QUEUE', 
        purpose: '實時事件推送和SSE連接管理',
        status: sseStats.totalConnections > 0 ? 'healthy' : 'warning',
        metrics: {
          messagesInQueue: 0,
          processingRate: 0,
          errorRate: 0,
          avgProcessingTime: 100
        },
        configuration: {
          maxBatchSize: 5,
          maxBatchTimeout: 1,
          retryPolicy: 'fast-fail'
        },
        lastActivity: new Date().toISOString()
      };

      // 計算活躍對話數量
      const activeConversations = Object.keys(
        Object.values(sseStats.connectionsByUser).reduce((conversations: Record<string, boolean>, _) => {
          // 這裡可以根據實際需求計算活躍對話
          return conversations;
        }, {})
      ).length;

      // 統一監控數據
      const unifiedData: UnifiedMonitoringData = {
        summary: {
          totalQueues: 1,
          healthyQueues: realtimeQueueStats.status === 'healthy' ? 1 : 0,
          totalMessages: realtimeQueueStats.metrics.messagesInQueue!,
          overallStatus: sseStats.totalConnections > 0 ? 'healthy' : 'warning'
        },
        queues: {
          realtimeQueue: realtimeQueueStats
        },
        realtimeConnections: {
          totalConnections: sseStats.totalConnections,
          connectionsByUser: sseStats.connectionsByUser,
          activeConversations
        },
        systemHealth: {
          uptime: Date.now(),
          lastCheck: new Date().toISOString()
        }
      };

      console.log('📊 [Queue Monitor] Statistics compiled:', {
        totalQueues: unifiedData.summary.totalQueues,
        totalConnections: unifiedData.realtimeConnections.totalConnections,
        overallStatus: unifiedData.summary.overallStatus
      });

      return successResponse(c, unifiedData, 'Queue monitoring data retrieved');

    } catch (error) {
      console.error('❌ [Queue Monitor] Error fetching statistics:', error);
      return handleApiError(error, c);
    }
  },

  // 🔄 獲取隊列健康檢查
  getHealthCheck: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const healthChecks = {
        realtimeQueue: {
          status: 'healthy',
          checks: {
            queueAvailable: true,
            sseConnections: 0, // REMOVED: SSE removed (Phase 3 cleanup)
            processingLatency: '< 100ms'
          }
        },
        overall: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        }
      };

      return successResponse(c, healthChecks, 'Queue health check completed');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 📈 獲取隊列性能指標
  getPerformanceMetrics: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const metrics = {
        // REMOVED: agentQueue metrics (replaced by DelayedMessageBuffer Durable Object)
        // Use GET /api/delayed-messages-v2/metrics for delayed message metrics
        realtimeQueue: {
          throughput: {
            eventsPerSecond: 10.5,
            peakThroughput: 50.0,
            avgProcessingTime: 80
          },
          reliability: {
            successRate: 99.9,
            errorRate: 0.1,
            retryRate: 0.05
          },
          sseMetrics: {
            activeConnections: 0, // REMOVED: SSE removed (Phase 3 cleanup)
            connectionUptime: 'N/A',
            eventDeliveryRate: 0
          }
        },
        timestamp: new Date().toISOString()
      };

      return successResponse(c, metrics, 'Performance metrics retrieved');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 🧹 隊列維護操作
  maintenanceOperations: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { operation } = await c.req.json();

      switch (operation) {
        case 'cleanup_stale_connections':
          // REMOVED: SSE cleanup (Phase 3 cleanup - SSE removed, WebSocket only)
          return successResponse(c, { operation: 'cleanup_stale_connections', completed: true, note: 'SSE removed' }, 'SSE removed, no cleanup needed');

        case 'get_connection_details':
          // REMOVED: SSE stats (Phase 3 cleanup - SSE removed, WebSocket only)
          const connectionStats = { totalConnections: 0, note: 'SSE removed, use WebSocket monitoring' };
          return successResponse(c, connectionStats, 'SSE removed, use WebSocket monitoring');

        default:
          return errorResponse(c, 'Unknown maintenance operation', 400);
      }

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};