// Collaboration Module - Core Types
// 協作模組核心類型定義

import type { JWTPayload } from '@/types';

// =================== 基礎類型 ===================

/**
 * 協作協議類型
 */
export type CollaborationProtocol = 'sse' | 'websocket' | 'http';

/**
 * 用戶在線狀態
 */
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

/**
 * 輸入狀態
 */
export type TypingStatus = 'start' | 'stop';

/**
 * 協作事件類型
 */
export type CollaborationEventType =
  | 'user_joined'           // 用戶加入對話
  | 'user_left'             // 用戶離開對話
  | 'typing_start'          // 開始輸入
  | 'typing_stop'           // 停止輸入
  | 'presence_update'       // 在線狀態更新
  | 'message_sent'          // 發送訊息
  | 'conversation_update';  // 對話更新

// =================== 協作實體 ===================

/**
 * 查看者資訊
 */
export interface Viewer {
  userId: number;
  username: string;
  displayName: string;
  role: 'admin' | 'team' | 'agent';
  joinedAt: string;
  protocol: CollaborationProtocol;
  isTyping: boolean;
  lastActivity: string;
}

/**
 * 在線狀態
 */
export interface PresenceInfo {
  userId: number;
  status: PresenceStatus;
  currentConversation?: number;
  lastSeen: string;
  metadata?: Record<string, any>;
}

/**
 * 輸入指示器狀態
 */
export interface TypingInfo {
  userId: number;
  username: string;
  displayName: string;
  conversationId: number;
  startedAt: string;
  expiresAt: string; // 輸入狀態過期時間
}

/**
 * 對話房間狀態
 */
export interface ConversationRoomState {
  conversationId: number;
  viewers: Viewer[];
  typing: TypingInfo[];
  totalConnections: number;
  protocol: CollaborationProtocol;
  lastActivity: string;
  metadata?: Record<string, any>;
}

/**
 * 協作事件
 */
export interface CollaborationEvent {
  type: CollaborationEventType;
  conversationId: number;
  userId: number;
  data: Record<string, any>;
  timestamp: string;
  metadata?: Record<string, any>;
}

// =================== 請求/響應類型 ===================

/**
 * 加入對話請求
 */
export interface JoinConversationRequest {
  conversationId: number;
  userId: number;
  protocol?: CollaborationProtocol;
  metadata?: Record<string, any>;
}

/**
 * 離開對話請求
 */
export interface LeaveConversationRequest {
  conversationId: number;
  userId: number;
}

/**
 * 發送輸入狀態請求
 */
export interface SendTypingRequest {
  conversationId: number;
  userId: number;
  status: TypingStatus;
}

/**
 * 更新在線狀態請求
 */
export interface UpdatePresenceRequest {
  userId: number;
  status: PresenceStatus;
  currentConversation?: number;
  metadata?: Record<string, any>;
}

/**
 * 廣播事件請求
 */
export interface BroadcastEventRequest {
  conversationId: number;
  event: CollaborationEvent;
  excludeUsers?: number[];
}

/**
 * 協作統計
 */
export interface CollaborationStats {
  totalViewers: number;
  totalTyping: number;
  totalRooms: number;
  connectionsByProtocol: Record<CollaborationProtocol, number>;
  topActiveConversations: Array<{
    conversationId: number;
    viewerCount: number;
  }>;
}

// =================== 適配器接口 ===================

/**
 * 協作適配器抽象接口
 * 所有協議適配器必須實現此接口
 */
export interface CollaborationAdapter {
  /**
   * 協議名稱
   */
  readonly protocol: CollaborationProtocol;

  /**
   * 初始化適配器
   */
  initialize(env: any): Promise<void>;

  /**
   * 獲取對話的查看者列表
   */
  getConversationViewers(conversationId: number): Promise<Viewer[]>;

  /**
   * 獲取對話房間完整狀態
   */
  getConversationState(conversationId: number): Promise<ConversationRoomState>;

  /**
   * 用戶加入對話
   */
  joinConversation(request: JoinConversationRequest): Promise<void>;

  /**
   * 用戶離開對話
   */
  leaveConversation(request: LeaveConversationRequest): Promise<void>;

  /**
   * 發送輸入狀態
   */
  sendTyping(request: SendTypingRequest): Promise<void>;

  /**
   * 更新用戶在線狀態
   */
  updatePresence(request: UpdatePresenceRequest): Promise<void>;

  /**
   * 廣播事件到對話
   */
  broadcastEvent(request: BroadcastEventRequest): Promise<void>;

  /**
   * 獲取適配器統計信息
   */
  getStats(): Promise<CollaborationStats>;

  /**
   * 清理過期連接和狀態
   */
  cleanup(): Promise<number>;
}

// =================== 服務接口 ===================

/**
 * Presence 服務接口
 */
export interface IPresenceService {
  updatePresence(request: UpdatePresenceRequest): Promise<void>;
  getPresence(userId: number): Promise<PresenceInfo | null>;
  getBatchPresence(userIds: number[]): Promise<Map<number, PresenceInfo>>;
  setOnline(userId: number, conversationId?: number): Promise<void>;
  setOffline(userId: number): Promise<void>;
}

/**
 * Typing 服務接口
 */
export interface ITypingService {
  startTyping(conversationId: number, userId: number, username: string, displayName: string): Promise<void>;
  stopTyping(conversationId: number, userId: number): Promise<void>;
  getTypingUsers(conversationId: number): Promise<TypingInfo[]>;
  cleanupExpired(): Promise<number>;
}

/**
 * Room 服務接口
 */
export interface IRoomService {
  joinRoom(request: JoinConversationRequest): Promise<void>;
  leaveRoom(request: LeaveConversationRequest): Promise<void>;
  getRoomState(conversationId: number): Promise<ConversationRoomState>;
  getActiveRooms(): Promise<number[]>;
  getRoomViewers(conversationId: number): Promise<Viewer[]>;
}

// =================== 配置類型 ===================

/**
 * 協作模組配置
 */
export interface CollaborationConfig {
  /**
   * 預設使用的協議
   */
  defaultProtocol: CollaborationProtocol;

  /**
   * 是否啟用 WebSocket
   */
  enableWebSocket: boolean;

  /**
   * 輸入狀態過期時間 (秒)
   */
  typingExpirationSeconds: number;

  /**
   * 在線狀態過期時間 (秒)
   */
  presenceExpirationSeconds: number;

  /**
   * 清理任務執行間隔 (秒)
   */
  cleanupIntervalSeconds: number;

  /**
   * 每個對話最大查看者數
   */
  maxViewersPerConversation: number;

  /**
   * 是否記錄協作事件到資料庫
   */
  persistEvents: boolean;
}

/**
 * 預設配置
 */
export const defaultCollaborationConfig: CollaborationConfig = {
  defaultProtocol: 'sse',
  enableWebSocket: false,
  typingExpirationSeconds: 5,
  presenceExpirationSeconds: 300,
  cleanupIntervalSeconds: 60,
  maxViewersPerConversation: 50,
  persistEvents: false
};

// =================== 錯誤類型 ===================

/**
 * 協作模組錯誤基類
 */
export class CollaborationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CollaborationError';
  }
}

/**
 * 房間已滿錯誤
 */
export class RoomFullError extends CollaborationError {
  constructor(conversationId: number, maxViewers: number) {
    super(
      `Conversation ${conversationId} has reached maximum viewers (${maxViewers})`,
      'ROOM_FULL',
      403
    );
    this.name = 'RoomFullError';
  }
}

/**
 * 協議不支援錯誤
 */
export class ProtocolNotSupportedError extends CollaborationError {
  constructor(protocol: string) {
    super(
      `Protocol ${protocol} is not supported`,
      'PROTOCOL_NOT_SUPPORTED',
      400
    );
    this.name = 'ProtocolNotSupportedError';
  }
}

/**
 * 適配器未初始化錯誤
 */
export class AdapterNotInitializedError extends CollaborationError {
  constructor(protocol: CollaborationProtocol) {
    super(
      `Adapter for protocol ${protocol} is not initialized`,
      'ADAPTER_NOT_INITIALIZED',
      500
    );
    this.name = 'AdapterNotInitializedError';
  }
}
