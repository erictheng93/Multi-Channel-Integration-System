// Collaboration Module - Main Entry Point
// 協作模組統一入口

// 導出類型
export * from './types';

// 導出適配器
export * from './adapters';

// 導出服務
export * from './services';

// 導出處理器
export * from './handlers';

// 導出主要實例供快速訪問
import { collaboration, CollaborationManager } from '@modules/collaboration/services/collaboration-manager';
import collaborationMainHandler from '@modules/collaboration/handlers/collaboration-main';
import { defaultCollaborationConfig } from '@modules/collaboration/types';
import type {
  BroadcastEventRequest,
  CollaborationProtocol,
  JoinConversationRequest,
  LeaveConversationRequest,
  SendTypingRequest,
  UpdatePresenceRequest
} from '@modules/collaboration/types';
import type { Bindings } from '@/types';

/**
 * 協作模組便捷訪問對象
 */
export const Collaboration = {
  // 單例管理器
  manager: collaboration,

  // 類別導出
  Manager: CollaborationManager,

  // 處理器
  handler: collaborationMainHandler,

  // 預設配置
  defaultConfig: defaultCollaborationConfig,

  // 快速方法
  async initialize(env: Bindings, config = defaultCollaborationConfig) {
    return await collaboration.initialize(env, config);
  },

  async getConversationState(conversationId: number, protocol?: CollaborationProtocol) {
    return await collaboration.getConversationState(conversationId, protocol);
  },

  async getConversationViewers(conversationId: number, protocol?: CollaborationProtocol) {
    return await collaboration.getConversationViewers(conversationId, protocol);
  },

  async joinConversation(request: JoinConversationRequest) {
    return await collaboration.joinConversation(request);
  },

  async leaveConversation(request: LeaveConversationRequest) {
    return await collaboration.leaveConversation(request);
  },

  async sendTyping(request: SendTypingRequest) {
    return await collaboration.sendTyping(request);
  },

  async updatePresence(request: UpdatePresenceRequest) {
    return await collaboration.updatePresence(request);
  },

  async broadcastEvent(request: BroadcastEventRequest) {
    return await collaboration.broadcastEvent(request);
  },

  async getStats(protocol?: CollaborationProtocol) {
    return await collaboration.getStats(protocol);
  }
};

// 預設導出管理器實例
export default collaboration;

// 模組資訊
export const CollaborationModuleInfo = {
  name: 'Collaboration Module',
  version: '1.0.0',
  description: '統一的多客服協作模組，基於 WebSocket 實時通訊',
  features: [
    'WebSocket 實時協議',
    '統一的協作 API',
    '適配器模式架構',
    'Typing Indicator 管理',
    'Presence 狀態追蹤',
    '對話房間管理',
    '即時事件廣播',
    '完整的統計分析'
  ],
  protocols: {
    websocket: {
      name: 'WebSocket',
      status: 'production',
      priority: 'default'
    }
  }
};
