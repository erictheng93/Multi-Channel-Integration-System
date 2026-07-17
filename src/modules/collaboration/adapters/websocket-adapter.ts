// WebSocket Collaboration Adapter
// 將 WebSocket + Durable Objects 適配到統一的協作接口

import type {
  CollaborationAdapter,
  CollaborationProtocol,
  Viewer,
  ConversationRoomState,
  JoinConversationRequest,
  LeaveConversationRequest,
  SendTypingRequest,
  UpdatePresenceRequest,
  BroadcastEventRequest,
  CollaborationStats,
  TypingInfo,
  ConversationId
} from '../types';

import type { Bindings } from '@/types';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CollabWSAdapter');

interface RoomParticipant {
  userId: string;
  username?: string;
  displayName?: string;
  role?: Viewer['role'];
  joinedAt?: string;
  isTyping?: boolean;
  lastActivity?: string;
}

interface RoomMetricsState {
  typingUsers?: TypingInfo[];
  connectionCount?: number;
  lastActivity?: string;
  messageHistory?: unknown[];
  isActive?: boolean;
}

/**
 * WebSocket 協作適配器
 * 封裝 Durable Objects 基礎設施,提供統一的協作接口
 */
export class WebSocketCollaborationAdapter implements CollaborationAdapter {
  readonly protocol: CollaborationProtocol = 'websocket';

  private env?: Bindings;

  /**
   * 初始化適配器
   */
  async initialize(env: Bindings): Promise<void> {
    this.env = env;

    // 驗證 Durable Objects bindings 是否存在
    if (!env.CONVERSATION_ROOM) {
      throw new Error('CONVERSATION_ROOM Durable Object binding not found');
    }
    if (!env.USER_CONNECTION) {
      throw new Error('USER_CONNECTION Durable Object binding not found');
    }
  }

  /**
   * 獲取對話的查看者列表
   */
  async getConversationViewers(conversationId: ConversationId): Promise<Viewer[]> {
    const env = this.getEnv();

    try {
      // 獲取 ConversationRoom Durable Object
      const roomId = env.CONVERSATION_ROOM.idFromName(`conv-${conversationId}`);
      const room = env.CONVERSATION_ROOM.get(roomId);

      // 調用 DO 的 participants 端點
      const response = await room.fetch(new Request('http://internal/participants'));

      if (!response.ok) {
        throw new Error(`Failed to get participants: ${response.statusText}`);
      }

      const participants = await response.json() as RoomParticipant[];

      // 轉換為統一的 Viewer 格式
      const viewers: Viewer[] = [];
      for (const p of participants) {
        const numericUserId = Number(p.userId);
        if (!Number.isFinite(numericUserId)) {
          continue;
        }

        viewers.push({
          userId: numericUserId,
          username: p.username || `User ${p.userId}`,
          displayName: p.displayName || p.username || `User ${p.userId}`,
          role: p.role || 'agent',
          joinedAt: p.joinedAt || nowISO(),
          protocol: 'websocket',
          isTyping: p.isTyping || false,
          lastActivity: p.lastActivity || nowISO()
        });
      }

      return viewers;
    } catch (error) {
      log.error('[WebSocketAdapter] Error getting viewers:', {}, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * 獲取對話房間完整狀態
   */
  async getConversationState(conversationId: ConversationId): Promise<ConversationRoomState> {
    const env = this.getEnv();

    try {
      const roomId = env.CONVERSATION_ROOM.idFromName(`conv-${conversationId}`);
      const room = env.CONVERSATION_ROOM.get(roomId);

      // 調用 DO 的 state 端點
      const response = await room.fetch(new Request('http://internal/metrics'));

      if (!response.ok) {
        const viewers = await this.getConversationViewers(conversationId);
        return {
          conversationId,
          viewers,
          typing: [],
          totalConnections: viewers.length,
          protocol: 'websocket',
          lastActivity: nowISO()
        };
      }

      const state = await response.json() as RoomMetricsState;

      const viewers = await this.getConversationViewers(conversationId);
      const typing: TypingInfo[] = state.typingUsers?.map((u: TypingInfo) => ({
        userId: u.userId,
        username: u.username,
        displayName: u.displayName,
        conversationId,
        startedAt: u.startedAt,
        expiresAt: u.expiresAt
      })) || [];

      return {
        conversationId,
        viewers,
        typing,
        totalConnections: state.connectionCount || viewers.length,
        protocol: 'websocket',
        lastActivity: state.lastActivity || nowISO(),
        metadata: {
          messageHistory: state.messageHistory?.length || 0,
          isActive: state.isActive
        }
      };
    } catch (error) {
      log.error('[WebSocketAdapter] Error getting state:', {}, error instanceof Error ? error : new Error(String(error)));
      const viewers = await this.getConversationViewers(conversationId);
      return {
        conversationId,
        viewers,
        typing: [],
        totalConnections: viewers.length,
        protocol: 'websocket',
        lastActivity: nowISO()
      };
    }
  }

  /**
   * 用戶加入對話
   */
  async joinConversation(request: JoinConversationRequest): Promise<void> {
    const env = this.getEnv();

    try {
      const roomId = env.CONVERSATION_ROOM.idFromName(`conv-${request.conversationId}`);
      const room = env.CONVERSATION_ROOM.get(roomId);

      // 調用 DO 的 connect 端點
      await room.fetch(new Request('http://internal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: request.userId,
          metadata: request.metadata
        })
      }));
    } catch (error) {
      log.error('[WebSocketAdapter] Error joining conversation:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 用戶離開對話
   */
  async leaveConversation(request: LeaveConversationRequest): Promise<void> {
    const env = this.getEnv();

    try {
      const roomId = env.CONVERSATION_ROOM.idFromName(`conv-${request.conversationId}`);
      const room = env.CONVERSATION_ROOM.get(roomId);

      // 調用 DO 的 disconnect 端點
      await room.fetch(new Request('http://internal/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: request.userId
        })
      }));
    } catch (error) {
      log.error('[WebSocketAdapter] Error leaving conversation:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 發送輸入狀態
   */
  async sendTyping(request: SendTypingRequest): Promise<void> {
    const env = this.getEnv();

    try {
      const roomId = env.CONVERSATION_ROOM.idFromName(`conv-${request.conversationId}`);
      const room = env.CONVERSATION_ROOM.get(roomId);

      // 調用 DO 的 broadcast 端點發送 typing 事件
      await room.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: request.status === 'start' ? 'typing_start' : 'typing_stop',
          data: {
            userId: request.userId
          }
        })
      }));
    } catch (error) {
      log.error('[WebSocketAdapter] Error sending typing:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 更新用戶在線狀態
   */
  async updatePresence(request: UpdatePresenceRequest): Promise<void> {
    const env = this.getEnv();

    try {
      // 使用 USER_CONNECTION Durable Object 管理用戶狀態
      const userId = env.USER_CONNECTION.idFromName(`user-${request.userId}`);
      const userConn = env.USER_CONNECTION.get(userId);

      await userConn.fetch(new Request('http://internal/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: request.status,
          currentConversation: request.currentConversation,
          metadata: request.metadata
        })
      }));

      // 如果有當前對話,廣播 presence 更新
      if (request.currentConversation) {
        const roomId = env.CONVERSATION_ROOM.idFromName(`conv-${request.currentConversation}`);
        const room = env.CONVERSATION_ROOM.get(roomId);

        await room.fetch(new Request('http://internal/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'presence_update',
            data: {
              userId: request.userId,
              status: request.status
            }
          })
        }));
      }
    } catch (error) {
      log.error('[WebSocketAdapter] Error updating presence:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 廣播事件到對話
   */
  async broadcastEvent(request: BroadcastEventRequest): Promise<void> {
    const env = this.getEnv();

    try {
      const roomId = env.CONVERSATION_ROOM.idFromName(`conv-${request.conversationId}`);
      const room = env.CONVERSATION_ROOM.get(roomId);

      await room.fetch(new Request('http://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: request.event.type,
          data: request.event.data,
          excludeUsers: request.excludeUsers
        })
      }));
    } catch (error) {
      log.error('[WebSocketAdapter] Error broadcasting event:', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 獲取適配器統計信息
   */
  async getStats(): Promise<CollaborationStats> {
    this.getEnv(); // Validate initialization

    // WebSocket 統計需要從多個 DO 聚合
    // 這裡返回基本統計,實際應該實現更完整的統計收集
    return {
      totalViewers: 0,
      totalTyping: 0,
      totalRooms: 0,
      connectionsByProtocol: {
        websocket: 0,
        http: 0
      },
      topActiveConversations: []
    };
  }

  /**
   * 清理過期連接和狀態
   */
  async cleanup(): Promise<number> {
    // WebSocket DO 有自己的清理機制
    // 這裡返回 0,實際清理由 DO 內部處理
    return 0;
  }

  // =================== 私有輔助方法 ===================

  /**
   * 獲取已初始化的環境（用於類型安全訪問）
   */
  private getEnv(): Bindings & { CONVERSATION_ROOM: DurableObjectNamespace; USER_CONNECTION: DurableObjectNamespace } {
    if (!this.env) {
      throw new Error('WebSocketCollaborationAdapter not initialized');
    }
    if (!this.env.CONVERSATION_ROOM) {
      throw new Error('CONVERSATION_ROOM Durable Object binding not found');
    }
    if (!this.env.USER_CONNECTION) {
      throw new Error('USER_CONNECTION Durable Object binding not found');
    }
    return this.env as Bindings & { CONVERSATION_ROOM: DurableObjectNamespace; USER_CONNECTION: DurableObjectNamespace };
  }
}
