// SSE Collaboration Adapter
// 將現有的 SSE 基礎設施適配到統一的協作接口

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
  CollaborationEvent,
  TypingInfo
} from '../types';

import { enhancedSSEManager } from '@modules/realtime/handlers/sse-handler';
import { AgentStatusService } from '@modules/agents/services/agent-status';
import type { Bindings } from '@/types';

/**
 * SSE 協作適配器
 * 封裝現有 SSE 基礎設施,提供統一的協作接口
 */
export class SSECollaborationAdapter implements CollaborationAdapter {
  readonly protocol: CollaborationProtocol = 'sse';

  private agentStatusService?: AgentStatusService;
  private env?: Bindings;
  private typingState = new Map<string, TypingInfo>(); // conversationId:userId -> TypingInfo
  private cleanupInterval?: ReturnType<typeof setInterval>;

  /**
   * 初始化適配器
   */
  async initialize(env: Bindings): Promise<void> {
    this.env = env;
    this.agentStatusService = new AgentStatusService(env.SESSIONS);
    enhancedSSEManager.setEnv(env);

    // 啟動定期清理過期的 typing 狀態
    this.startCleanupTask();
  }

  /**
   * 獲取對話的查看者列表
   */
  async getConversationViewers(conversationId: number): Promise<Viewer[]> {
    const stats = enhancedSSEManager.getDetailedStats();
    const connectionIds = this.getConversationConnectionIds(conversationId, stats);

    const viewers: Viewer[] = [];

    for (const connectionId of connectionIds) {
      const connection = this.getConnectionDetails(connectionId);
      if (connection) {
        const typingKey = `${conversationId}:${connection.userId}`;
        const isTyping = this.typingState.has(typingKey);

        viewers.push({
          userId: connection.userId,
          username: connection.metadata?.displayName || `User ${connection.userId}`,
          displayName: connection.metadata?.displayName || `User ${connection.userId}`,
          role: connection.metadata?.userRole || 'agent',
          joinedAt: connection.metadata?.connectedAt || new Date().toISOString(),
          protocol: 'sse',
          isTyping,
          lastActivity: new Date(connection.lastActivity).toISOString()
        });
      }
    }

    return viewers;
  }

  /**
   * 獲取對話房間完整狀態
   */
  async getConversationState(conversationId: number): Promise<ConversationRoomState> {
    const viewers = await this.getConversationViewers(conversationId);
    const typing = this.getConversationTyping(conversationId);
    const stats = enhancedSSEManager.getDetailedStats();

    return {
      conversationId,
      viewers,
      typing,
      totalConnections: viewers.length,
      protocol: 'sse',
      lastActivity: new Date().toISOString(),
      metadata: {
        connectionsByConversation: stats.connectionsByConversation?.[conversationId] || 0
      }
    };
  }

  /**
   * 用戶加入對話
   */
  async joinConversation(request: JoinConversationRequest): Promise<void> {
    // SSE 的加入是透過建立 SSE 連接實現的
    // 這裡主要是發送加入事件
    const event: CollaborationEvent = {
      type: 'user_joined',
      conversationId: request.conversationId,
      userId: request.userId,
      data: {
        username: request.metadata?.username,
        displayName: request.metadata?.displayName,
        role: request.metadata?.role
      },
      timestamp: new Date().toISOString(),
      metadata: request.metadata
    };

    await this.broadcastEvent({
      conversationId: request.conversationId,
      event,
      excludeUsers: [request.userId] // 不發送給自己
    });
  }

  /**
   * 用戶離開對話
   */
  async leaveConversation(request: LeaveConversationRequest): Promise<void> {
    // 清理該用戶的 typing 狀態
    const typingKey = `${request.conversationId}:${request.userId}`;
    this.typingState.delete(typingKey);

    // 發送離開事件
    const event: CollaborationEvent = {
      type: 'user_left',
      conversationId: request.conversationId,
      userId: request.userId,
      data: {},
      timestamp: new Date().toISOString()
    };

    await this.broadcastEvent({
      conversationId: request.conversationId,
      event,
      excludeUsers: [request.userId]
    });
  }

  /**
   * 發送輸入狀態
   */
  async sendTyping(request: SendTypingRequest): Promise<void> {
    const typingKey = `${request.conversationId}:${request.userId}`;

    if (request.status === 'start') {
      // 記錄 typing 狀態
      const typingInfo: TypingInfo = {
        userId: request.userId,
        username: `User ${request.userId}`, // 實際應從請求或資料庫獲取
        displayName: `User ${request.userId}`,
        conversationId: request.conversationId,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5000).toISOString() // 5秒過期
      };

      this.typingState.set(typingKey, typingInfo);

      // 廣播 typing_start 事件
      const event: CollaborationEvent = {
        type: 'typing_start',
        conversationId: request.conversationId,
        userId: request.userId,
        data: {
          username: typingInfo.username,
          displayName: typingInfo.displayName
        },
        timestamp: new Date().toISOString()
      };

      await this.broadcastEvent({
        conversationId: request.conversationId,
        event,
        excludeUsers: [request.userId]
      });
    } else {
      // 清除 typing 狀態
      this.typingState.delete(typingKey);

      // 廣播 typing_stop 事件
      const event: CollaborationEvent = {
        type: 'typing_stop',
        conversationId: request.conversationId,
        userId: request.userId,
        data: {},
        timestamp: new Date().toISOString()
      };

      await this.broadcastEvent({
        conversationId: request.conversationId,
        event,
        excludeUsers: [request.userId]
      });
    }
  }

  /**
   * 更新用戶在線狀態
   */
  async updatePresence(request: UpdatePresenceRequest): Promise<void> {
    if (!this.agentStatusService) {
      throw new Error('Agent status service not initialized');
    }

    // 使用現有的 AgentStatusService 更新狀態
    const agentId = String(request.userId);

    switch (request.status) {
      case 'online':
        await this.agentStatusService.setOnline(agentId);
        break;
      case 'away':
        await this.agentStatusService.setAway(agentId);
        break;
      case 'busy':
        await this.agentStatusService.setBusy(agentId);
        break;
      case 'offline':
        await this.agentStatusService.setOffline(agentId);
        break;
    }

    // 如果有當前對話,發送 presence 更新事件
    if (request.currentConversation) {
      const event: CollaborationEvent = {
        type: 'presence_update',
        conversationId: request.currentConversation,
        userId: request.userId,
        data: {
          status: request.status,
          metadata: request.metadata
        },
        timestamp: new Date().toISOString()
      };

      await this.broadcastEvent({
        conversationId: request.currentConversation,
        event
      });
    }
  }

  /**
   * 廣播事件到對話
   */
  async broadcastEvent(request: BroadcastEventRequest): Promise<void> {
    // 使用 'data' 類型包裝自定義事件，符合 SSEEvent 類型定義
    const sseEvent = {
      type: 'data' as const,
      data: {
        eventType: request.event.type,
        ...request.event.data,
        userId: request.event.userId,
        conversationId: request.event.conversationId
      },
      timestamp: request.event.timestamp,
      connectionId: undefined
    };

    // 使用 enhancedSSEManager 發送到對話的所有連接
    enhancedSSEManager.sendToConversation(
      request.conversationId,
      sseEvent,
      request.excludeUsers
    );
  }

  /**
   * 獲取適配器統計信息
   */
  async getStats(): Promise<CollaborationStats> {
    const stats = enhancedSSEManager.getDetailedStats();
    const connectionsByConversation = stats.connectionsByConversation || {};

    // 計算每個協議的連接數
    const connectionsByProtocol: Record<CollaborationProtocol, number> = {
      sse: stats.totalConnections,
      websocket: 0,
      http: 0
    };

    // 找出最活躍的對話
    const topActiveConversations = Object.entries(connectionsByConversation)
      .map(([conversationId, viewerCount]) => ({
        conversationId: parseInt(conversationId),
        viewerCount: viewerCount as number
      }))
      .sort((a, b) => b.viewerCount - a.viewerCount)
      .slice(0, 10);

    return {
      totalViewers: stats.totalConnections,
      totalTyping: this.typingState.size,
      totalRooms: Object.keys(connectionsByConversation).length,
      connectionsByProtocol,
      topActiveConversations
    };
  }

  /**
   * 清理過期連接和狀態
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;

    // 清理過期的 SSE 連接
    cleanedCount += enhancedSSEManager.cleanupStaleConnections();

    // 清理過期的 typing 狀態
    const now = Date.now();
    for (const [key, typingInfo] of this.typingState.entries()) {
      if (new Date(typingInfo.expiresAt).getTime() < now) {
        this.typingState.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // =================== 私有輔助方法 ===================

  /**
   * 獲取對話的連接 ID 列表
   */
  private getConversationConnectionIds(
    conversationId: number,
    stats: any
  ): string[] {
    const connectionsMap = stats.connectionsByConversation || {};
    return connectionsMap[conversationId] || [];
  }

  /**
   * 獲取連接詳情
   */
  private getConnectionDetails(connectionId: string): any {
    // 這裡需要訪問 enhancedSSEManager 的內部狀態
    // 由於 enhancedSSEManager 沒有 public 方法獲取單個連接
    // 我們需要從 stats 中獲取
    const stats = enhancedSSEManager.getDetailedStats();

    // 暫時返回一個模擬對象,實際應該擴展 enhancedSSEManager API
    return {
      userId: parseInt(connectionId.split('-')[1] || '0'),
      lastActivity: Date.now(),
      metadata: {
        displayName: `User ${connectionId.split('-')[1]}`,
        userRole: 'agent',
        connectedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 獲取對話的所有正在輸入的用戶
   */
  private getConversationTyping(conversationId: number): TypingInfo[] {
    const typing: TypingInfo[] = [];
    const now = Date.now();

    for (const [key, typingInfo] of this.typingState.entries()) {
      if (typingInfo.conversationId === conversationId) {
        // 檢查是否過期
        if (new Date(typingInfo.expiresAt).getTime() > now) {
          typing.push(typingInfo);
        }
      }
    }

    return typing;
  }

  /**
   * 啟動定期清理任務
   */
  private startCleanupTask(): void {
    // 每 60 秒清理一次過期狀態
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => {
        console.error('[SSECollaborationAdapter] Cleanup error:', err);
      });
    }, 60000);
  }

  /**
   * 停止清理任務
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
