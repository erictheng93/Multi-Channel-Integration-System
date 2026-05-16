// Real-time 模組核心類型定義
// 統一的即時通訊類型系統
import type { Context } from 'hono';
import type { Bindings, JWTPayload } from '@/types';

export interface RealtimeEvent {
  id: string;
  type: 'message' | 'typing' | 'agent_joined' | 'agent_left' | 'assignment_changed' | 'status_changed' | 'notification' | 'conversation_updated' | 'typing_started' | 'typing_stopped' | 'connection' | 'heartbeat' | 'connection_status' | 'connection_closed' | 'new_message' | 'system_announcement' | 'user_online' | 'user_offline';
  timestamp: string;
  source: 'system' | 'user' | 'api' | 'webhook' | 'queue' | 'manual';
  data: Record<string, unknown>;
  conversationId?: number;
  userId?: number;
  userName?: string;
}

export interface TypingStatus {
  userId: number;
  userName: string;
  conversationId: number;
  startTime: number;
  expiresAt: number;
}

export interface QueueMessage {
  event: RealtimeEvent;
  targets: {
    conversationId?: number;
    userIds?: number[];
    broadcast?: boolean;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryCount: number;
  maxRetries: number;
}

export interface RealtimeConfig {
  version: 'v1' | 'v2' | 'auto';
  enableEventDriven: boolean;
  enableQueueProcessing: boolean;
  heartbeatInterval: number;
  connectionTimeout: number;
  maxRetries: number;
  eventStorageTtl: number;
}

export interface ConversationStatus {
  id: number;
  status: string;
  priority?: string;
  customer: {
    name: string;
    platform: string;
    avatarUrl?: string;
  };
  assignment: {
    teamId?: number;
    teamName?: string;
    userId?: number;
    userName?: string;
  };
  activity: {
    unreadCount: number;
    lastMessage?: string;
    lastMessageAt?: string;
    typingUsers: TypingStatus[];
    onlineAgents?: number;
  };
  timestamps: {
    createdAt: string;
    updatedAt: string;
    lastMessageAt?: string;
  };
}

// Event-driven handler type (WebSocket only)
export interface EventDrivenHandler {
  sendTypingStatus: (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => Promise<Response>;
  broadcastToConversation: (c: Context<{ Bindings: Bindings }>) => Promise<Response>;
  getConversationStatus: (c: Context<{ Bindings: Bindings }>) => Promise<Response>;
  updateOnlineStatus: (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => Promise<Response>;
}

// Queue handler interface
export interface QueueHandler {
  processEvent(batch: MessageBatch<QueueMessage>, env: unknown): Promise<void>;
  handleSingleEvent(queueMessage: QueueMessage, env: unknown): Promise<void>;
  storeEventForRetrieval(event: RealtimeEvent, targets: QueueMessage['targets'], env: unknown): Promise<void>;
  getRecentEventsForConnection(conversationId: number | null, userId: number, env: unknown): Promise<RealtimeEvent[]>;
  createAndQueueEvent(eventType: RealtimeEvent['type'], eventData: RealtimeEvent['data'], targets: QueueMessage['targets'], priority?: QueueMessage['priority'], env?: unknown, source?: string): Promise<string>;
}

// 服務配置類型
export interface RealtimeServiceConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  eventStorageTtl: number;
}
