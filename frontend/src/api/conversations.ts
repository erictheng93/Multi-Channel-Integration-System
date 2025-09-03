// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/conversations.ts
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

// API 返回的原始對話數據格式 (標準 camelCase 格式)
interface RawConversationData {
  id: string
  customerId: number
  customer_id?: number
  assignedTeamId: number | null
  assignedUserId: string | null
  status: 'active' | 'assigned' | 'closed'
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  customerName?: string
  platform: Platform
  platformUserId: string
  lastMessageContent?: string
  lastMessageAtActual?: string
  unreadCount?: number
}

// 數據轉換適配器
function adaptConversationData(rawData: RawConversationData): Conversation {
  // 狀態映射: API 的 'active' 對應前端的 'open'
  const statusMap: Record<string, 'open' | 'assigned' | 'closed'> = {
    'active': 'open',
    'assigned': 'assigned',
    'closed': 'closed'
  }

  const customerId = rawData.customerId || rawData.customer_id
  return {
    id: rawData.id,
    userId: customerId ? customerId.toString() : '',
    user: rawData.customerName ? {
      id: customerId ? customerId.toString() : '',
      name: rawData.customerName,
      platform: rawData.platform,
      platformUserId: rawData.platformUserId,
      createdAt: new Date(rawData.createdAt).getTime()
    } : undefined,
    customer: rawData.customerName ? {
      id: customerId ? customerId.toString() : '',
      name: rawData.customerName,
      platform: rawData.platform,
      platformUserId: rawData.platformUserId,
      createdAt: new Date(rawData.createdAt).getTime()
    } : undefined,
    assignedTo: rawData.assignedUserId || undefined,
    assignedAgentId: rawData.assignedUserId || undefined,
    status: statusMap[rawData.status] || 'open',
    platform: rawData.platform,
    lastMessageAt: new Date(rawData.lastMessageAt).getTime(),
    lastMessage: rawData.lastMessageContent ? {
      id: `last-${rawData.id}`,
      conversationId: rawData.id,
      senderId: customerId ? customerId.toString() : '',
      senderType: 'customer' as const,
      content: rawData.lastMessageContent,
      messageType: 'text' as const,
      platform: rawData.platform,
      timestamp: rawData.lastMessageAtActual ? new Date(rawData.lastMessageAtActual).getTime() : new Date(rawData.lastMessageAt).getTime(),
      createdAt: rawData.lastMessageAtActual ? new Date(rawData.lastMessageAtActual).getTime() : new Date(rawData.lastMessageAt).getTime()
    } : undefined,
    unreadCount: rawData.unreadCount || 0,
    createdAt: new Date(rawData.createdAt).getTime(),
    updatedAt: new Date(rawData.updatedAt).getTime()
  }
}

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
    const response = await apiClient.get<RawConversationData[]>(`/conversations${queryString ? `?${queryString}` : ''}`);
    
    // 轉換數據格式
    if (response.success && response.data && Array.isArray(response.data)) {
      const adaptedConversations = response.data.map(adaptConversationData);
      return {
        success: true,
        data: adaptedConversations
      };
    }
    
    return { success: false, error: response.error || '獲取對話列表失敗' };
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
    const response = await apiClient.get<RawConversationData[] | PaginatedResponse<RawConversationData>>(`/conversations${queryString ? `?${queryString}` : ''}`);
    
    // 轉換數據格式
    if (response.success && response.data) {
      if (Array.isArray(response.data)) {
        // Direct array format from backend
        const adaptedConversations = response.data.map(adaptConversationData);
        return {
          success: true,
          data: {
            items: adaptedConversations,
            page: params.page || 1,
            pageSize: params.pageSize || 20,
            total: adaptedConversations.length,
            totalPages: Math.ceil(adaptedConversations.length / (params.pageSize || 20))
          }
        };
      } else {
        // Paginated response format
        const paginatedData = response.data as PaginatedResponse<RawConversationData>;
        const adaptedConversations = (paginatedData.items || []).map(adaptConversationData);
        return {
          success: true,
          data: {
            items: adaptedConversations,
            page: paginatedData.page,
            pageSize: paginatedData.pageSize,
            total: paginatedData.total,
            totalPages: paginatedData.totalPages
          }
        };
      }
    }
    
    return { success: false, error: response.error || '獲取對話列表失敗' };
  },

  // 獲取對話統計
  getStats: async (): Promise<ApiResponse<ConversationStats>> => {
    return apiClient.get('/conversations/stats');
  },

  // 獲取單一對話
  getConversation: async (id: string): Promise<ApiResponse<Conversation>> => {
    if (!id?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    const response = await apiClient.get<RawConversationData>(`/conversations/${id}`);
    
    // 轉換數據格式
    if (response.success && response.data) {
      const adaptedConversation = adaptConversationData(response.data);
      return {
        success: true,
        data: adaptedConversation
      };
    }
    
    return { success: false, error: response.error || '獲取對話失敗' };
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
    return apiClient.get(`/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`);
  },

  // 發送訊息
  sendMessage: async (conversationId: string, request: SendMessageRequest): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    if (!request.content?.trim()) {
      return { success: false, error: '訊息內容不能為空' };
    }
    
    return apiClient.post(`/conversations/${conversationId}/messages`, {
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
    return apiClient.put(`/conversations/${conversationId}/assign`, { agentId });
  },

  // 關閉對話
  closeConversation: async (conversationId: string, reason?: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/conversations/${conversationId}/close`, reason ? { reason } : undefined);
  },

  // 重新開啟對話
  reopenConversation: async (conversationId: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/conversations/${conversationId}/reopen`);
  },

  // 標記對話為已讀
  markAsRead: async (conversationId: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/conversations/${conversationId}/read`);
  },

  // 設置對話標籤
  setTags: async (conversationId: string, tags: string[]): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.put(`/conversations/${conversationId}/tags`, { tags });
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