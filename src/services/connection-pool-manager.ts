/**
 * Connection Pool Manager
 * 專案名稱：Multi-Channel Support MVP - Performance Optimizations
 *
 * Advanced connection pooling and management for WebSocket connections
 * Optimizes resource usage, implements smart cleanup, and prevents memory leaks
 */

import type {
  WebSocketConnection,
  ConnectionMetrics
} from '../types/websocket-types';

// =================== Configuration ===================

interface ConnectionPoolConfig {
  maxPoolSize: number;
  maxConnectionsPerUser: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  heartbeatIntervalMs: number;
  cleanupIntervalMs: number;
  enableConnectionReuse: boolean;
  enableSmartThrottling: boolean;
  enableAutomaticScaling: boolean;
  healthCheckIntervalMs: number;
  maxRetryAttempts: number;
  retryBackoffMs: number;
}

const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxPoolSize: 10000,
  maxConnectionsPerUser: 10,
  connectionTimeoutMs: 30000,
  idleTimeoutMs: 300000,      // 5 minutes
  heartbeatIntervalMs: 30000,  // 30 seconds
  cleanupIntervalMs: 60000,    // 1 minute
  enableConnectionReuse: true,
  enableSmartThrottling: true,
  enableAutomaticScaling: true,
  healthCheckIntervalMs: 10000, // 10 seconds
  maxRetryAttempts: 3,
  retryBackoffMs: 1000
};

// =================== Connection Pool Manager ===================

export class ConnectionPoolManager {
  private config: ConnectionPoolConfig;
  private connectionPool: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private poolStats: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    failedConnections: number;
    connectionsPerSecond: number;
    lastCleanup: number;
    poolUtilization: number;
  };

  private cleanupInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.poolStats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      failedConnections: 0,
      connectionsPerSecond: 0,
      lastCleanup: Date.now(),
      poolUtilization: 0
    };

    this.startBackgroundTasks();
  }

  // =================== Connection Management ===================

  async addConnection(connection: WebSocketConnection): Promise<boolean> {
    const { userId, connectionId } = connection;

    // Check pool capacity
    if (!this.canAcceptConnection(userId)) {
      console.warn(`🚫 [ConnectionPool] Cannot accept connection: pool limits exceeded for user ${userId}`);
      return false;
    }

    // Apply throttling if enabled
    if (this.config.enableSmartThrottling && this.shouldThrottleConnection(userId)) {
      console.warn(`⏱️ [ConnectionPool] Throttling connection for user ${userId}`);
      await this.sleep(this.calculateThrottleDelay(userId));
    }

    // Add connection to pool
    this.connectionPool.set(connectionId, connection);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Initialize metrics
    this.connectionMetrics.set(connectionId, {
      connectionId,
      totalConnections: 1,
      activeConnections: 1,
      connectionsByType: { websocket: 1 },
      connectionsByRole: { [connection.role]: 1 },
      averageLatency: 0,
      messagesThroughput: { inbound: 0, outbound: 0 },
      errorRate: 0,
      lastUpdated: Date.now(),
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      errors: 0,
      state: 'connected',
      healthScore: 100
    });

    // Set up connection monitoring
    this.setupConnectionMonitoring(connection);

    // Update stats
    this.updatePoolStats();

    console.log(`✅ [ConnectionPool] Connection added: ${connectionId} for user ${userId} (${this.poolStats.activeConnections} active)`);
    return true;
  }

  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connectionPool.get(connectionId);
    if (!connection) return;

    const { userId } = connection;

    // Remove from pool
    this.connectionPool.delete(connectionId);

    // Update user connections
    const userConns = this.userConnections.get(userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // Clean up metrics
    this.connectionMetrics.delete(connectionId);

    // Update stats
    this.updatePoolStats();

    console.log(`🔌 [ConnectionPool] Connection removed: ${connectionId} (${this.poolStats.activeConnections} remaining)`);
  }

  getConnection(connectionId: string): WebSocketConnection | null {
    return this.connectionPool.get(connectionId) || null;
  }

  getUserConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return [];

    return Array.from(connectionIds)
      .map(id => this.connectionPool.get(id))
      .filter(conn => conn !== undefined) as WebSocketConnection[];
  }

  getActiveConnections(): WebSocketConnection[] {
    return Array.from(this.connectionPool.values())
      .filter(conn => this.isConnectionActive(conn));
  }

  // =================== Connection Optimization ===================

  private canAcceptConnection(userId: string): boolean {
    // Check global pool limit
    if (this.connectionPool.size >= this.config.maxPoolSize) {
      return false;
    }

    // Check per-user limit
    const userConnections = this.userConnections.get(userId);
    if (userConnections && userConnections.size >= this.config.maxConnectionsPerUser) {
      return false;
    }

    // Check pool utilization for automatic scaling
    if (this.config.enableAutomaticScaling) {
      const utilizationThreshold = 0.9; // 90%
      if (this.poolStats.poolUtilization > utilizationThreshold) {
        return this.shouldAllowConnectionUnderHighLoad(userId);
      }
    }

    return true;
  }

  private shouldThrottleConnection(userId: string): boolean {
    if (!this.config.enableSmartThrottling) return false;

    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return false;

    // Check connection rate
    const recentConnections = Array.from(userConnections)
      .map(id => this.connectionMetrics.get(id))
      .filter(metrics => metrics && metrics.connectedAt && Date.now() - metrics.connectedAt < 60000); // Last minute

    return recentConnections.length > 5; // More than 5 connections per minute
  }

  private calculateThrottleDelay(userId: string): number {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    const connectionCount = userConnections.size;
    const baseDelay = 1000; // 1 second
    const exponentialFactor = Math.pow(2, Math.min(connectionCount - 1, 5));

    return Math.min(baseDelay * exponentialFactor, 30000); // Max 30 seconds
  }

  private shouldAllowConnectionUnderHighLoad(userId: string): boolean {
    // Allow admin users even under high load
    const userConnections = this.getUserConnections(userId);
    if (userConnections.length > 0 && userConnections[0]) {
      const role = userConnections[0].role;
      if (role === 'admin') {
        return true;
      }
    }

    // Apply probability-based admission control for regular users
    const admissionProbability = Math.max(0.1, 1 - this.poolStats.poolUtilization);
    return Math.random() < admissionProbability;
  }

  // =================== Connection Monitoring ===================

  private setupConnectionMonitoring(connection: WebSocketConnection): void {
    const { connectionId, websocket } = connection;

    // Set up heartbeat
    this.setupHeartbeat(connection);

    // Monitor WebSocket events
    websocket.addEventListener('message', (event) => {
      this.updateConnectionActivity(connectionId, 'message_received', event.data);
    });

    websocket.addEventListener('close', (event) => {
      this.handleConnectionClose(connectionId, event.code, event.reason);
    });

    websocket.addEventListener('error', (event) => {
      this.handleConnectionError(connectionId, event);
    });
  }

  private setupHeartbeat(connection: WebSocketConnection): void {
    const { connectionId, websocket } = connection;

    const heartbeatInterval = setInterval(() => {
      if (websocket.readyState === WebSocket.OPEN) {
        const pingMessage = {
          type: 'ping',
          timestamp: Date.now(),
          connectionId
        };

        try {
          websocket.send(JSON.stringify(pingMessage));
          this.updateConnectionActivity(connectionId, 'heartbeat_sent');
        } catch (error) {
          console.error(`❌ [ConnectionPool] Heartbeat failed for ${connectionId}:`, error);
          this.markConnectionAsUnhealthy(connectionId);
        }
      } else {
        clearInterval(heartbeatInterval);
      }
    }, this.config.heartbeatIntervalMs);

    // Store interval for cleanup
    connection.metadata = {
      ...connection.metadata,
      heartbeatInterval
    };
  }

  private updateConnectionActivity(
    connectionId: string,
    activityType: string,
    data?: any
  ): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (!metrics) return;

    metrics.lastActivity = Date.now();

    switch (activityType) {
      case 'message_sent':
        if (metrics.messagesSent !== undefined) metrics.messagesSent++;
        if (data && metrics.bytesTransferred !== undefined) {
          metrics.bytesTransferred += this.calculateMessageSize(data);
        }
        break;
      case 'message_received':
        if (metrics.messagesReceived !== undefined) metrics.messagesReceived++;
        if (data && metrics.bytesTransferred !== undefined) {
          metrics.bytesTransferred += this.calculateMessageSize(data);
        }
        break;
      case 'heartbeat_sent':
        // Update health score
        this.updateHealthScore(connectionId, 1);
        break;
      case 'error':
        if (metrics.errors !== undefined) metrics.errors++;
        this.updateHealthScore(connectionId, -10);
        break;
    }

    // Update connection state
    this.updateConnectionState(connectionId);
  }

  private calculateMessageSize(data: any): number {
    if (typeof data === 'string') {
      return new Blob([data]).size;
    } else if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    return 0;
  }

  private updateHealthScore(connectionId: string, delta: number): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (!metrics) return;

    if (metrics.healthScore !== undefined) {
      metrics.healthScore = Math.max(0, Math.min(100, metrics.healthScore + delta));
    }

    // Mark as unhealthy if score is too low
    if (metrics.healthScore !== undefined && metrics.healthScore < 20) {
      this.markConnectionAsUnhealthy(connectionId);
    }
  }

  private updateConnectionState(connectionId: string): void {
    const connection = this.connectionPool.get(connectionId);
    const metrics = this.connectionMetrics.get(connectionId);

    if (!connection || !metrics) return;

    const now = Date.now();
    const inactiveTime = metrics.lastActivity ? now - metrics.lastActivity : 0;

    if (connection.websocket.readyState === WebSocket.CLOSED) {
      if (metrics.state !== undefined) metrics.state = 'disconnected';
    } else if (inactiveTime > this.config.idleTimeoutMs) {
      if (metrics.state !== undefined) metrics.state = 'idle';
    } else if (metrics.healthScore !== undefined && metrics.healthScore < 50) {
      if (metrics.state !== undefined) metrics.state = 'unhealthy';
    } else {
      if (metrics.state !== undefined) metrics.state = 'active';
    }
  }

  private markConnectionAsUnhealthy(connectionId: string): void {
    const connection = this.connectionPool.get(connectionId);
    if (!connection) return;

    console.warn(`⚠️ [ConnectionPool] Connection marked as unhealthy: ${connectionId}`);

    // Attempt to recover the connection
    this.attemptConnectionRecovery(connectionId);
  }

  private async attemptConnectionRecovery(connectionId: string): Promise<void> {
    const connection = this.connectionPool.get(connectionId);
    const metrics = this.connectionMetrics.get(connectionId);

    if (!connection || !metrics) return;

    console.log(`🔄 [ConnectionPool] Attempting recovery for connection: ${connectionId}`);

    // Try to ping the connection
    try {
      if (connection.websocket.readyState === WebSocket.OPEN) {
        const pingMessage = {
          type: 'ping',
          timestamp: Date.now(),
          recovery: true
        };

        connection.websocket.send(JSON.stringify(pingMessage));

        // Give it a chance to respond
        await this.sleep(5000);

        // Check if connection improved
        if (metrics.healthScore !== undefined && metrics.healthScore > 50) {
          console.log(`✅ [ConnectionPool] Connection recovered: ${connectionId}`);
          return;
        }
      }
    } catch (error) {
      console.error(`❌ [ConnectionPool] Recovery failed for ${connectionId}:`, error);
    }

    // Recovery failed, remove connection
    console.log(`🚫 [ConnectionPool] Removing unrecoverable connection: ${connectionId}`);
    await this.removeConnection(connectionId);
  }

  private handleConnectionClose(connectionId: string, code: number, reason: string): void {
    console.log(`🔌 [ConnectionPool] Connection closed: ${connectionId} (${code}: ${reason})`);
    this.removeConnection(connectionId);
  }

  private handleConnectionError(connectionId: string, error: Event): void {
    console.error(`❌ [ConnectionPool] Connection error: ${connectionId}`, error);
    this.updateConnectionActivity(connectionId, 'error');
  }

  // =================== Background Tasks ===================

  private startBackgroundTasks(): void {
    // Connection cleanup task
    this.cleanupInterval = setInterval(() => {
      this.performConnectionCleanup();
    }, this.config.cleanupIntervalMs);

    // Health check task
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);

    // Metrics update task
    this.metricsInterval = setInterval(() => {
      this.updatePoolStats();
    }, 5000); // Every 5 seconds
  }

  private async performConnectionCleanup(): Promise<void> {
    const now = Date.now();
    const staleConnections: string[] = [];

    console.log(`🧹 [ConnectionPool] Starting cleanup (${this.connectionPool.size} connections)`);

    for (const [connectionId, connection] of this.connectionPool) {
      const metrics = this.connectionMetrics.get(connectionId);
      if (!metrics) continue;

      const inactiveTime = metrics.lastActivity ? now - metrics.lastActivity : 0;

      // Check for idle connections
      if (inactiveTime > this.config.idleTimeoutMs) {
        staleConnections.push(connectionId);
        continue;
      }

      // Check for unhealthy connections
      if (metrics.state === 'unhealthy' && metrics.healthScore !== undefined && metrics.healthScore < 20) {
        staleConnections.push(connectionId);
        continue;
      }

      // Check for closed connections
      if (connection.websocket.readyState === WebSocket.CLOSED) {
        staleConnections.push(connectionId);
        continue;
      }
    }

    // Remove stale connections
    for (const connectionId of staleConnections) {
      await this.removeConnection(connectionId);
    }

    this.poolStats.lastCleanup = now;

    if (staleConnections.length > 0) {
      console.log(`🧹 [ConnectionPool] Cleanup complete: removed ${staleConnections.length} stale connections`);
    }
  }

  private performHealthCheck(): void {
    let healthyConnections = 0;
    let unhealthyConnections = 0;

    for (const [connectionId, metrics] of this.connectionMetrics) {
      this.updateConnectionState(connectionId);

      if (metrics.state === 'active' && metrics.healthScore !== undefined && metrics.healthScore > 70) {
        healthyConnections++;
      } else if (metrics.state === 'unhealthy' || (metrics.healthScore !== undefined && metrics.healthScore < 30)) {
        unhealthyConnections++;
      }
    }

    const healthRatio = healthyConnections / Math.max(1, this.connectionPool.size);

    if (healthRatio < 0.8) {
      console.warn(`⚠️ [ConnectionPool] Pool health degraded: ${(healthRatio * 100).toFixed(1)}% healthy connections`);
    }

    console.log(`💚 [ConnectionPool] Health check: ${healthyConnections} healthy, ${unhealthyConnections} unhealthy`);
  }

  private updatePoolStats(): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - (this.poolStats.lastCleanup || now);

    this.poolStats.totalConnections = this.connectionPool.size;
    this.poolStats.activeConnections = Array.from(this.connectionMetrics.values())
      .filter(m => m.state === 'active').length;
    this.poolStats.idleConnections = Array.from(this.connectionMetrics.values())
      .filter(m => m.state === 'idle').length;
    this.poolStats.poolUtilization = this.poolStats.totalConnections / this.config.maxPoolSize;

    // Calculate connections per second (rough estimate)
    if (timeSinceLastUpdate > 0) {
      const recentConnections = Array.from(this.connectionMetrics.values())
        .filter(m => m.connectedAt && now - m.connectedAt < 60000).length; // Last minute
      this.poolStats.connectionsPerSecond = recentConnections / 60;
    }
  }

  // =================== Utility Methods ===================

  private isConnectionActive(connection: WebSocketConnection): boolean {
    const metrics = this.connectionMetrics.get(connection.connectionId);
    return metrics?.state === 'active' && connection.websocket.readyState === WebSocket.OPEN;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =================== Public API ===================

  getPoolStats() {
    return { ...this.poolStats };
  }

  getConnectionMetrics(connectionId: string): ConnectionMetrics | null {
    return this.connectionMetrics.get(connectionId) || null;
  }

  getAllMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size || 0;
  }

  async forceCleanup(): Promise<void> {
    await this.performConnectionCleanup();
  }

  shutdown(): void {
    console.log('🛑 [ConnectionPool] Shutting down connection pool manager');

    // Clear intervals
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Close all connections
    for (const [connectionId, connection] of this.connectionPool) {
      try {
        connection.websocket.close(1001, 'Server shutdown');
      } catch (error) {
        console.error(`❌ [ConnectionPool] Error closing connection ${connectionId}:`, error);
      }
    }

    // Clear maps
    this.connectionPool.clear();
    this.userConnections.clear();
    this.connectionMetrics.clear();
  }
}

// =================== Singleton Instance ===================

let globalConnectionPoolManager: ConnectionPoolManager | null = null;

export function getConnectionPoolManager(config?: Partial<ConnectionPoolConfig>): ConnectionPoolManager {
  if (!globalConnectionPoolManager) {
    globalConnectionPoolManager = new ConnectionPoolManager(config);
  }
  return globalConnectionPoolManager;
}