// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/conversations.ts
// Created by: API Service Developer

import { apiClient } from './base'
import type { 
  Conversation, 
  ConversationFilters, 
  Message, 
  ApiResponse,
  PaginatedResponse,
  Platform 
} from '@/types'

interface ConversationListParams {
  page?: number;
  pageSize?: number;
  status?: 'open' | 'assigned' | 'closed';
  platform?: Platform;
  assignedTo?: string;
  search?: string;
}

interface SendMessageRequest {
  content: string;
  messageType?: 'text' | 'image' | 'file';
  platform?: Platform;
}

interface ConversationStats {
  total: number;
  open: number;
  assigned: number;
  closed: number;
  unreadCount: number;
}

export const conversationApi = {
  // 獲取對話列表（向後兼容）
  getConversations: async (filters?: ConversationFilters): Promise<ApiResponse<Conversation[]>> => {
    const queryParams = new URLSearchParams();
    if (filters?.status) {queryParams.append('status', filters.status);}
    if (filters?.platform) {queryParams.append('platform', filters.platform);}
    if (filters?.assignedTo) {queryParams.append('assignedTo', filters.assignedTo);}
    
    const queryString = queryParams.toString();
    return apiClient.get(`/api/conversations${queryString ? `?${queryString}` : ''}`);
  },

  // 獲取對話列表（分頁版本，強類型）
  list: async (params: ConversationListParams = {}): Promise<ApiResponse<PaginatedResponse<Conversation>>> => {
    const queryParams = new URLSearchParams();
    if (params.page !== undefined) {queryParams.append('page', params.page.toString());}
    if (params.pageSize !== undefined) {queryParams.append('pageSize', params.pageSize.toString());}
    if (params.status) {queryParams.append('status', params.status);}
    if (params.platform) {queryParams.append('platform', params.platform);}
    if (params.assignedTo) {queryParams.append('assignedTo', params.assignedTo);}
    if (params.search) {queryParams.append('search', params.search);}
    
    const queryString = queryParams.toString();
    return apiClient.get(`/api/conversations${queryString ? `?${queryString}` : ''}`);
  },

  // 獲取對話統計
  getStats: async (): Promise<ApiResponse<ConversationStats>> => {
    return apiClient.get('/api/conversations/stats');
  },

  // 獲取單一對話
  getConversation: async (id: string): Promise<ApiResponse<Conversation>> => {
    if (!id?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.get(`/api/conversations/${id}`);
  },

  // 獲取對話訊息
  getMessages: async (conversationId: string, params?: {
    page?: number;
    pageSize?: number;
    since?: string;
  }): Promise<ApiResponse<Message[]>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) {queryParams.append('page', params.page.toString());}
    if (params?.pageSize !== undefined) {queryParams.append('pageSize', params.pageSize.toString());}
    if (params?.since) {queryParams.append('since', params.since);}
    
    const queryString = queryParams.toString();
    return apiClient.get(`/api/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`);
  },

  // 發送訊息
  sendMessage: async (conversationId: string, request: SendMessageRequest): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    if (!request.content?.trim()) {
      return { success: false, error: '訊息內容不能為空' };
    }
    
    return apiClient.post(`/api/conversations/${conversationId}/messages`, {
      content: request.content.trim(),
      messageType: request.messageType || 'text',
      platform: request.platform
    });
  },

  // 指派對話
  assignConversation: async (conversationId: string, agentId: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim() || !agentId?.trim()) {
      return { success: false, error: '對話 ID 和客服 ID 不能為空' };
    }
    return apiClient.put(`/api/conversations/${conversationId}/assign`, { agentId });
  },

  // 關閉對話
  closeConversation: async (conversationId: string, reason?: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/api/conversations/${conversationId}/close`, reason ? { reason } : undefined);
  },

  // 重新開啟對話
  reopenConversation: async (conversationId: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/api/conversations/${conversationId}/reopen`);
  },

  // 標記對話為已讀
  markAsRead: async (conversationId: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/api/conversations/${conversationId}/read`);
  },

  // 設置對話標籤
  setTags: async (conversationId: string, tags: string[]): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/api/conversations/${conversationId}/tags`, { tags });
  },

  // 搜索對話
  search: async (query: string, filters?: Partial<ConversationListParams>): Promise<ApiResponse<Conversation[]>> => {
    if (!query?.trim()) {
      return { success: false, error: '搜索關鍵字不能為空' };
    }
    
    const params = { ...filters, search: query.trim() };
    return conversationApi.list(params).then(response => {
      if (response.success && response.data) {
        return { success: true, data: response.data.items };
      }
      return { success: false, error: response.error || '搜索失敗' };
    });
  },

  // 別名方法，保持向後兼容
  get: async (conversationId: string): Promise<ApiResponse<Conversation>> => {
    return conversationApi.getConversation(conversationId);
  },

  assign: async (conversationId: string, agentId: string): Promise<ApiResponse<void>> => {
    return conversationApi.assignConversation(conversationId, agentId);
  },

  close: async (conversationId: string): Promise<ApiResponse<void>> => {
    return conversationApi.closeConversation(conversationId);
  }
}