// WebSocket + Durable Objects Types
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 定義 WebSocket 連接和 Durable Objects 的類型

import type { RealtimeEvent } from './index';

// =================== WebSocket Connection Types ===================

export interface WebSocketConnection {
  websocket: WebSocket;
  userId: string;
  conversationId?: string;
  teamId?: number;
  role: 'admin' | 'agent';
  connectionId: string;
  lastActivity: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface WebSocketMessage {
  type: 'ping' | 'pong' | 'subscribe' | 'unsubscribe' | 'message' | 'event' | 'error';
  id?: string;
  conversationId?: string;
  data?: unknown;
  timestamp: number;
  error?: string;
}

export interface WebSocketSubscription {
  type: 'conversation' | 'user' | 'team' | 'global';
  target: string | number;
  filters?: {
    eventTypes?: string[];
    priority?: string[];
  };
}

// =================== Durable Object State Types ===================

export interface ConversationRoomState {
  conversationId: string;
  connections: Map<string, WebSocketConnection>;
  participants: Set<string>; // user IDs
  lastActivity: number;
  messageHistory: RealtimeEvent[];
  isActive: boolean;
  metadata: {
    customerInfo?: {
      platform: string;
      platformUserId: string;
      displayName?: string;
    };
    assignedTeam?: number;
    assignedAgent?: string;
    status: 'active' | 'pending' | 'closed';
  };
}

export interface UserConnectionState {
  userId: string;
  connections: Map<string, WebSocketConnection>;
  subscriptions: Set<string>; // conversation IDs
  preferences: {
    autoSubscribe: boolean;
    notificationSettings: Record<string, boolean>;
  };
  lastSeen: number;
  isOnline: boolean;
}

export interface MessageBroadcasterState {
  activeConnections: number;
  eventQueue: RealtimeEvent[];
  distributionStats: {
    totalEvents: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    lastProcessed: number;
  };
  targetFilters: Map<string, WebSocketSubscription[]>;
}

export interface DelayedMessageProcessorState {
  pendingMessages: Map<string, ScheduledMessage>;
  processingQueue: string[];
  lastProcessed: number;
  batchSize: number;
  stats: {
    totalProcessed: number;
    successfulSends: number;
    failedSends: number;
    cancelledMessages: number;
  };
}

// =================== Message Types ===================

export interface ScheduledMessage {
  id: string;
  conversationId: string;
  agentId: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'video';
  scheduledAt: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  metadata?: Record<string, unknown>;
}

export interface BroadcastTarget {
  type: 'conversation' | 'user' | 'team' | 'global';
  targets: (string | number)[];
  priority?: 'low' | 'normal' | 'high' | 'urgent' | undefined;
  filters?: {
    roles?: string[] | undefined;
    eventTypes?: string[] | undefined;
  } | undefined;
}

// =================== Distributed Lock Types ===================

export interface DistributedLock {
  lockId: string;
  resource: string;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface LockAcquisitionOptions {
  ttl?: number; // Time to live in milliseconds
  timeout?: number; // Acquisition timeout in milliseconds
  retryInterval?: number;
  maxRetries?: number;
}

// =================== Event System Types ===================

export type DurableObjectEventType =
  | 'connection_opened' | 'connection_closed' | 'message_sent' | 'message_delivered' | 'message_read'
  | 'user_joined' | 'user_left' | 'typing_start' | 'typing_stop' | 'message_recalled'
  | 'conversation_assigned' | 'conversation_unassigned' | 'conversation_transferred' | 'system_notification'
  | 'conversation_status_changed' | 'participant_joined' | 'participant_left'
  | 'delayed_message_countdown' | 'delayed_message_sent' | 'delayed_message_recalled'
  | 'delayed_message_failed' | 'user_online' | 'user_offline' | 'user_away'
  | 'agent_available' | 'agent_busy' | 'agent_offline' | 'message_recall_success'
  | 'message_recall_failed' | 'batch_message';

export interface DurableObjectEvent {
  id: string;
  type: DurableObjectEventType;
  source: 'websocket' | 'api' | 'queue' | 'system' | 'delayed_processor' | 'batch_optimizer';
  timestamp: number;
  userId?: string | undefined;
  conversationId?: string | undefined;
  data: unknown;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deliveryOptions?: {
    broadcast?: boolean | undefined;
    targets?: BroadcastTarget[] | undefined;
    persistent?: boolean | undefined;
    ttl?: number | undefined;
  } | undefined;
}

// =================== Migration and Feature Flag Types ===================

export interface MigrationConfig {
  enableWebSocket: boolean;
  migrationStrategy: 'gradual' | 'immediate' | 'canary';
  rolloutPercentage: number;
  featureFlags: {
    websocketConnections: boolean;
    durableObjectMessaging: boolean;
    distributedLocking: boolean;
    batchMessageProcessing: boolean;
    realTimeTypingIndicators: boolean;
  };
}

export interface ConnectionFallback {
  primary: 'websocket';
  fallback: 'websocket';
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
}

// =================== Performance and Monitoring Types ===================

export interface ConnectionMetrics {
  connectionId?: string;
  totalConnections: number;
  activeConnections: number;
  connectionsByType: Record<'websocket', number>;
  connectionsByRole: Record<string, number>;
  averageLatency: number;
  messagesThroughput: {
    inbound: number;
    outbound: number;
  };
  errorRate: number;
  lastUpdated: number;
  // Additional properties used by connection-pool-manager
  connectedAt?: number;
  lastActivity?: number;
  messagesSent?: number;
  messagesReceived?: number;
  bytesTransferred?: number;
  errors?: number;
  healthScore?: number;
  state?: ConnectionState;
}

export interface DurableObjectMetrics {
  objectType: 'ConversationRoom' | 'UserConnection' | 'MessageBroadcaster' | 'DelayedMessageProcessor';
  instanceId: string;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  requestsPerSecond: number;
  lastActivity: number;
  uptime: number;
}

// =================== Error Handling Types ===================

export interface WebSocketError {
  code: number;
  message: string;
  type: 'connection' | 'authentication' | 'permission' | 'rate_limit' | 'internal';
  timestamp: number;
  userId?: string;
  conversationId?: string;
  details?: Record<string, unknown>;
}

export interface DurableObjectError {
  objectType: string;
  instanceId: string;
  operation: string;
  error: Error;
  timestamp: number;
  context?: Record<string, unknown>;
}

// =================== API Response Types ===================

export interface WebSocketApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  requestId?: string;
}

export interface ConnectionInfo {
  connectionId: string;
  userId: string;
  conversationId?: string;
  status: 'connected' | 'disconnected' | 'reconnecting';
  connectedAt: number;
  lastActivity: number;
  subscriptions: WebSocketSubscription[];
  metrics: {
    messagesSent: number;
    messagesReceived: number;
    reconnectCount: number;
  };
}

// =================== Configuration Types ===================

export interface DurableObjectConfig {
  maxConnections: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  messageHistoryLimit: number;
  inactivityTimeout: number;
  retryPolicy: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  rateLimiting: {
    messagesPerMinute: number;
    connectionsPerMinute: number;
    burstSize: number;
  };
}

export interface WebSocketServerConfig {
  port?: number;
  maxConnections: number;
  pingInterval: number;
  pongTimeout: number;
  upgradeTimeout: number;
  compression: boolean;
  perMessageDeflate: {
    threshold: number;
    concurrencyLimit: number;
  };
}

// =================== Connection Pool Types (Required by connection-pool-manager.ts) ===================

export interface ConnectionPool {
  id: string;
  name: string;
  connections: Map<string, WebSocketConnection>;
  maxConnections: number;
  healthCheckInterval: number;
  retryPolicy: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  stats: {
    totalConnections: number;
    activeConnections: number;
    failedConnections: number;
    totalMessages: number;
    errorCount: number;
  };
}

export interface PoolConfiguration {
  maxConnections: number;
  healthCheckInterval: number;
  connectionTimeout: number;
  retryPolicy: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  rateLimiting: {
    messagesPerMinute: number;
    connectionsPerMinute: number;
    burstSize: number;
  };
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed' | 'idle' | 'unhealthy' | 'active';

// =================== Message Batching Types ===================

export interface MessageBatch {
  id: string;
  messages: DurableObjectEvent[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: number;
  targetUsers: string[];
  estimatedSize: number;
  compressionRatio?: number;
  // Additional properties used by message-batch-optimizer
  target?: BroadcastTarget;
  optimizedAt?: number;
}

export interface BatchingStrategy {
  name: string;
  maxBatchSize: number;
  maxDelayMs: number;
  shouldBatch(message: DurableObjectEvent): boolean;
  createBatch(messages: DurableObjectEvent[]): MessageBatch;
  optimize(batch: MessageBatch): MessageBatch;
}

export interface OptimizationMetrics {
  batchesProcessed: number;
  averageBatchSize: number;
  averageLatency: number;
  throughputPerSecond: number;
  compressionRatio: number;
  memoryUsageMB: number;
  errorRate: number;
  lastUpdated: number;
  // Additional properties used by message-batch-optimizer
  totalMessages?: number;
  batchedMessages?: number;
  deduplicationSavings?: number;
  processingLatency?: number;
  memoryUsage?: number;
  efficiency?: number;
  totalBatches?: number;
}