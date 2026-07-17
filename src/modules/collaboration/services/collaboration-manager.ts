// Collaboration Manager - 統一協作管理器
// 提供統一的協作功能入口,自動選擇適當的適配器

import type {
  CollaborationAdapter,
  CollaborationProtocol,
  CollaborationConfig,
  Viewer,
  ConversationRoomState,
  JoinConversationRequest,
  LeaveConversationRequest,
  SendTypingRequest,
  UpdatePresenceRequest,
  BroadcastEventRequest,
  CollaborationStats,
  CollaborationEvent,
  ConversationId
} from '../types';

import { WebSocketCollaborationAdapter } from '@modules/collaboration/adapters/websocket-adapter';
import { defaultCollaborationConfig, AdapterNotInitializedError } from '@modules/collaboration/types';
import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CollaborationManager');

interface DestroyableAdapter {
  destroy(): void;
}

function hasDestroy(adapter: CollaborationAdapter): adapter is CollaborationAdapter & DestroyableAdapter {
  return 'destroy' in adapter && typeof (adapter as { destroy?: unknown }).destroy === 'function';
}

/**
 * CollaborationManager
 * 統一的協作管理器,負責協調不同協議的適配器
 */
export class CollaborationManager {
  private static instance: CollaborationManager;

  private adapters = new Map<CollaborationProtocol, CollaborationAdapter>();
  private config: CollaborationConfig;
  private defaultAdapter?: CollaborationAdapter;
  private initialized = false;

  private constructor(config?: Partial<CollaborationConfig>) {
    this.config = {
      ...defaultCollaborationConfig,
      ...config
    };
  }

  /**
   * 獲取單例實例
   */
  static getInstance(config?: Partial<CollaborationConfig>): CollaborationManager {
    if (!CollaborationManager.instance) {
      CollaborationManager.instance = new CollaborationManager(config);
    }
    return CollaborationManager.instance;
  }

  /**
   * 初始化管理器
   */
  async initialize(env: Bindings, config?: Partial<CollaborationConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    log.info('[CollaborationManager] Initializing with config (WebSocket-only):', {
      defaultProtocol: this.config.defaultProtocol,
      enableWebSocket: this.config.enableWebSocket
    });

    try {
      const wsAdapter = new WebSocketCollaborationAdapter();
      await wsAdapter.initialize(env);
      this.adapters.set('websocket', wsAdapter);
      log.info('[CollaborationManager] WebSocket adapter initialized');
    } catch (error) {
      log.error('[CollaborationManager] Failed to initialize WebSocket adapter:', {}, error instanceof Error ? error : new Error(String(error)));
      throw new Error('WebSocket initialization failed.');
    }

    // 設置預設適配器（WebSocket only）
    this.defaultAdapter = this.adapters.get('websocket');

    if (!this.defaultAdapter) {
      throw new Error('WebSocket adapter initialization failed');
    }

    // Force WebSocket as default protocol
    this.config.defaultProtocol = 'websocket';

    this.initialized = true;
    log.info('[CollaborationManager] Initialization complete');
    log.info('[CollaborationManager] Default protocol:', { detail: this.config.defaultProtocol });
    log.info('Available protocols', { protocols: Array.from(this.adapters.keys()) });
  }

  /**
   * 獲取對話的查看者列表
   */
  async getConversationViewers(
    conversationId: ConversationId,
    protocol?: CollaborationProtocol
  ): Promise<Viewer[]> {
    const adapter = this.getAdapter(protocol);
    return await adapter.getConversationViewers(conversationId);
  }

  /**
   * 獲取對話房間完整狀態
   */
  async getConversationState(
    conversationId: ConversationId,
    protocol?: CollaborationProtocol
  ): Promise<ConversationRoomState> {
    const adapter = this.getAdapter(protocol);
    return await adapter.getConversationState(conversationId);
  }

  /**
   * 用戶加入對話
   */
  async joinConversation(
    request: JoinConversationRequest
  ): Promise<void> {
    const adapter = this.getAdapter(request.protocol);
    await adapter.joinConversation(request);
  }

  /**
   * 用戶離開對話
   */
  async leaveConversation(
    request: LeaveConversationRequest
  ): Promise<void> {
    const adapter = this.getAdapter();
    await adapter.leaveConversation(request);
  }

  /**
   * 發送輸入狀態
   */
  async sendTyping(request: SendTypingRequest): Promise<void> {
    const adapter = this.getAdapter();
    await adapter.sendTyping(request);
  }

  /**
   * 更新用戶在線狀態
   */
  async updatePresence(request: UpdatePresenceRequest): Promise<void> {
    const adapter = this.getAdapter();
    await adapter.updatePresence(request);
  }

  /**
   * 廣播事件到對話
   */
  async broadcastEvent(request: BroadcastEventRequest): Promise<void> {
    const adapter = this.getAdapter();
    await adapter.broadcastEvent(request);
  }

  /**
   * 廣播到對話 (簡化版)
   */
  async broadcastToConversation(
    conversationId: ConversationId,
    event: CollaborationEvent,
    excludeUsers?: number[]
  ): Promise<void> {
    await this.broadcastEvent({
      conversationId,
      event,
      excludeUsers
    });
  }

  /**
   * 獲取統計信息
   */
  async getStats(protocol?: CollaborationProtocol): Promise<CollaborationStats> {
    if (protocol) {
      const adapter = this.getAdapter(protocol);
      return await adapter.getStats();
    }

    // 聚合所有適配器的統計
    const allStats: CollaborationStats[] = [];

    for (const [_, adapter] of this.adapters) {
      const stats = await adapter.getStats();
      allStats.push(stats);
    }

    // 合併統計
    return this.mergeStats(allStats);
  }

  /**
   * 清理過期狀態
   */
  async cleanup(): Promise<number> {
    let totalCleaned = 0;

    for (const [protocol, adapter] of this.adapters) {
      try {
        const cleaned = await adapter.cleanup();
        totalCleaned += cleaned;
        log.info(`[CollaborationManager] Cleaned ${cleaned} items from ${protocol} adapter`);
      } catch (error) {
        log.error(`[CollaborationManager] Cleanup error for ${protocol}:`, {}, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return totalCleaned;
  }

  /**
   * 檢查管理器是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 獲取當前配置
   */
  getConfig(): CollaborationConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CollaborationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 獲取可用的協議列表
   */
  getAvailableProtocols(): CollaborationProtocol[] {
    return Array.from(this.adapters.keys());
  }

  // =================== 私有方法 ===================

  /**
   * 獲取適配器
   */
  private getAdapter(protocol?: CollaborationProtocol): CollaborationAdapter {
    if (!this.initialized) {
      throw new Error('CollaborationManager not initialized. Call initialize() first.');
    }

    if (protocol) {
      const adapter = this.adapters.get(protocol);
      if (!adapter) {
        throw new AdapterNotInitializedError(protocol);
      }
      return adapter;
    }

    if (!this.defaultAdapter) {
      throw new Error('No default adapter set');
    }

    return this.defaultAdapter;
  }

  /**
   * 合併多個適配器的統計
   */
  private mergeStats(statsList: CollaborationStats[]): CollaborationStats {
    const merged: CollaborationStats = {
      totalViewers: 0,
      totalTyping: 0,
      totalRooms: 0,
      connectionsByProtocol: {
        websocket: 0,
        http: 0
      },
      topActiveConversations: []
    };

    const conversationMap = new Map<ConversationId, number>();

    for (const stats of statsList) {
      merged.totalViewers += stats.totalViewers;
      merged.totalTyping += stats.totalTyping;
      merged.totalRooms += stats.totalRooms;

      // 合併協議連接數
      for (const [protocol, count] of Object.entries(stats.connectionsByProtocol)) {
        merged.connectionsByProtocol[protocol as CollaborationProtocol] += count;
      }

      // 合併活躍對話
      for (const conv of stats.topActiveConversations) {
        const current = conversationMap.get(conv.conversationId) || 0;
        conversationMap.set(conv.conversationId, current + conv.viewerCount);
      }
    }

    // 轉換為排序的陣列
    merged.topActiveConversations = Array.from(conversationMap.entries())
      .map(([conversationId, viewerCount]) => ({
        conversationId,
        viewerCount
      }))
      .sort((a, b) => b.viewerCount - a.viewerCount)
      .slice(0, 10);

    return merged;
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    for (const [_protocol, adapter] of this.adapters) {
      if (hasDestroy(adapter)) {
        adapter.destroy();
      }
    }

    this.adapters.clear();
    this.defaultAdapter = undefined;
    this.initialized = false;
  }
}

// 導出單例實例
export const collaboration = CollaborationManager.getInstance();
