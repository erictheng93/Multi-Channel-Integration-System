// Conversation Sharding System Types
// 專案名稱：Multi-Channel Support MVP - Sharding Implementation
// 定義分片系統的類型和配置

/**
 * Shard Configuration
 * Based on TechStack/pubsub proven capacity
 */
export const SHARD_CONFIG = {
  CONNECTIONS_PER_SHARD: 10_000, // Matches Pubsub proven capacity
  MAX_SHARDS_PER_CONVERSATION: 5, // Maximum 50,000 total connections
  SHARD_REBALANCE_THRESHOLD: 0.8, // 80% capacity triggers rebalance check
  SHARD_NAMING_PATTERN: '{conversationId}_shard-{index}',
  CAPACITY_CHECK_TIMEOUT: 2000, // 2 seconds for RPC timeout
  FAILOVER_RETRY_COUNT: 3, // Retry on shard failure
  CACHE_TTL: 60_000, // 1 minute cache TTL
} as const;

/**
 * Shard metadata stored in cache and DO storage
 */
export interface ShardMetadata {
  index: number;
  connectionCount: number;
  lastChecked: number;
  status: 'active' | 'full' | 'draining' | 'failed';
  shardId: string;
  conversationId: string;
  createdAt?: number;
  maxConnections: number;
  utilizationPercent?: number;
}

/**
 * Cached shard information for faster lookups
 */
export interface CachedShardInfo {
  shards: ShardMetadata[];
  timestamp: number;
}

/**
 * RPC response from shard capacity check
 */
export interface ShardCapacityResponse {
  hasCapacity: boolean;
  connectionCount: number;
  shardIndex: number;
  maxConnections: number;
  utilizationPercent: number;
  shardId: string;
}

/**
 * Shard initialization payload
 */
export interface ShardInitializationPayload {
  conversationId: string;
  shardIndex: number;
  createdAt: number;
  maxConnections: number;
}

/**
 * Shard initialization response
 */
export interface ShardInitializationResponse {
  success: boolean;
  shardId: string;
  error?: string;
}

/**
 * Shard selection result
 */
export interface ShardSelectionResult {
  stub: DurableObjectStub | null;
  shardIndex: number;
  shardId: string;
  isNewShard: boolean;
  capacityInfo: {
    currentConnections: number;
    maxConnections: number;
    utilizationPercent: number;
  };
}

/**
 * Cross-shard broadcast payload
 */
export interface CrossShardBroadcastPayload {
  conversationId: string;
  event: any; // DurableObjectEvent from websocket-types
  excludeShardIndex: number; // Don't re-broadcast to source shard
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: number;
}

/**
 * Cross-shard broadcast response
 */
export interface CrossShardBroadcastResponse {
  success: boolean;
  shardsNotified: number;
  failedShards: number[];
  totalDeliveries: number;
  latencyMs: number;
}

/**
 * Shard health status
 */
export interface ShardHealthStatus {
  shardId: string;
  shardIndex: number;
  conversationId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  connectionCount: number;
  maxConnections: number;
  utilizationPercent: number;
  lastHealthCheck: number;
  errorCount: number;
  averageLatency: number;
  uptime: number;
}

/**
 * Sharding statistics for monitoring
 */
export interface ShardingStatistics {
  conversationId: string;
  totalShards: number;
  activeShards: number;
  totalConnections: number;
  averageUtilization: number;
  shardDistribution: {
    shardIndex: number;
    connections: number;
    utilization: number;
  }[];
  lastUpdated: number;
}

/**
 * Shard error types
 */
export type ShardErrorType =
  | 'shard_full'
  | 'shard_unreachable'
  | 'shard_timeout'
  | 'capacity_check_failed'
  | 'initialization_failed'
  | 'broadcast_failed'
  | 'all_shards_full'
  | 'invalid_shard_index';

/**
 * Shard error information
 */
export interface ShardError {
  type: ShardErrorType;
  shardIndex?: number;
  shardId?: string;
  conversationId: string;
  message: string;
  timestamp: number;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Shard rebalancing configuration
 */
export interface ShardRebalanceConfig {
  enabled: boolean;
  triggerThreshold: number; // Utilization % to trigger rebalance
  minIdleTime: number; // Minimum idle time before considering rebalance
  consolidationStrategy: 'aggressive' | 'conservative' | 'none';
}

/**
 * Shard migration status (for future rebalancing)
 */
export interface ShardMigrationStatus {
  conversationId: string;
  sourceShardIndex: number;
  targetShardIndex: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  connectionsToMigrate: number;
  connectionsMigrated: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
}
