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
import { CONVERSATION_STATUS, type ConversationStatus } from '@/constants/conversation-status'

// API 返回的原始對話數據格式 (標準 camelCase 格式)
interface RawConversationData {
  id: string
  customerId: number
  customer_id?: number
  assignedTeamId: number | null
  assignedUserId: string | null
  status: ConversationStatus | 'open' // Support legacy status values
  lastMessageAt: string
  createdAt: string
  updatedAt: string

  // 🔧 FIX: 旧格式（扁平字段，向后兼容）
  customerName?: string
  platform?: Platform  // 改为可选，因为新格式中 platform 在 customer 对象内
  platformUserId?: string  // 改为可选

  // 🔧 FIX: 新格式（嵌套 customer 对象）- 后端现在返回完整的 customer 对象
  customer?: {
    id: number | string
    name?: string
    displayName?: string
    platform?: Platform
    platformUserId?: string
    avatarUrl?: string
    email?: string
    phone?: string
    sourceTeamId?: number
    metadata?: string
    createdAt?: string
    updatedAt?: string
  }

  // 🔧 FIX: 新格式（嵌套 assignedTeam 对象）
  assignedTeam?: {
    id: number
    name: string
    description?: string
  }

  // 🔧 FIX: 新格式（嵌套 assignedAgent 对象）
  assignedAgent?: {
    id: string
    name: string
    displayName?: string
    email?: string
  }

  lastMessageContent?: string
  lastMessageAtActual?: string
  unreadCount?: number
}

// 指派對話選項
// Note: Individual assignment (userId) removed - only team-based assignment is supported now
export interface AssignConversationOptions {
  teamId: number;     // 團隊 ID (必填)
  reason?: string;    // 指派原因
}

// 數據轉換適配器
function adaptConversationData(rawData: RawConversationData): Conversation {
  // 狀態映射: Backend status → Frontend status
  // Backend uses: active, pending, in-progress, waiting, closed, resolved
  // Frontend uses: active, pending, in-progress, waiting, closed, resolved (same values)
  const statusMap: Record<string, ConversationStatus> = {
    'active': CONVERSATION_STATUS.ACTIVE,
    'pending': CONVERSATION_STATUS.PENDING,
    'in-progress': CONVERSATION_STATUS.IN_PROGRESS,
    'assigned': CONVERSATION_STATUS.ASSIGNED,
    'waiting': CONVERSATION_STATUS.WAITING,
    // Legacy mappings (backward compat)
    'open': CONVERSATION_STATUS.ACTIVE,
    'closed': CONVERSATION_STATUS.ACTIVE,
    'resolved': CONVERSATION_STATUS.ACTIVE
  }

  const customerId = rawData.customerId || rawData.customer_id

  // 🔧 FIX: 優先使用嵌套的 customer 對象，fallback 到扁平字段
  // 這樣可以同時支援新舊版本的 API 響應格式
  const customerName = rawData.customer?.name ||
                       rawData.customer?.displayName ||
                       rawData.customerName ||
                       '未知用戶'

  const customerPlatform = rawData.customer?.platform ||
                           rawData.platform ||
                           'line'

  const platformUserId = rawData.customer?.platformUserId ||
                         rawData.platformUserId ||
                         ''

  // 🆕 Extract customer createdAt (prefer nested customer.createdAt if available)
  const customerCreatedAt = rawData.customer?.createdAt
    ? new Date(rawData.customer.createdAt).getTime()
    : new Date(rawData.createdAt).getTime()

  return {
    id: rawData.id,
    userId: customerId ? customerId.toString() : '',
    user: {
      id: customerId ? customerId.toString() : '',
      name: customerName,
      platform: customerPlatform,
      platformUserId,
      avatarUrl: rawData.customer?.avatarUrl,
      createdAt: customerCreatedAt
    },
    customer: {
      id: customerId ? customerId.toString() : '',
      name: customerName,
      platform: customerPlatform,
      platformUserId,
      avatarUrl: rawData.customer?.avatarUrl,
      createdAt: customerCreatedAt
    },
    // 🔧 FIX: 处理嵌套的 assignedTeam 对象
    assignedTeam: rawData.assignedTeam ? {
      id: rawData.assignedTeam.id,
      name: rawData.assignedTeam.name,
      description: rawData.assignedTeam.description
    } : undefined,
    assignedTeamId: rawData.assignedTeamId || undefined,
    // Note: Individual agent assignment removed - only team assignment is supported now
    // assignedAgent, assignedTo, assignedAgentId fields are deprecated
    status: statusMap[rawData.status] || CONVERSATION_STATUS.PENDING,
    platform: customerPlatform,
    lastMessageAt: new Date(rawData.lastMessageAt).getTime(),
    lastMessage: rawData.lastMessageContent ? {
      id: `last-${rawData.id}`,
      conversationId: rawData.id,
      senderId: customerId ? customerId.toString() : '',
      senderType: 'customer' as const,
      content: rawData.lastMessageContent,
      messageType: 'text' as const,
      platform: customerPlatform,
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
  status?: 'active' | 'assigned' | 'pending';
  platform?: Platform;
  // Note: assignedTo removed - use teamId for team-based filtering
  teamId?: number;
  search?: string;
  tagIds?: number[];  // 標籤篩選
  customerName?: string;    // 客戶名稱搜尋
  updatedAfter?: string;    // 更新時間起始
  updatedBefore?: string;   // 更新時間結束
}

interface SendMessageRequest {
  content: string;
  messageType?: 'text' | 'image' | 'file';
  platform?: Platform;
}

interface ConversationStats {
  total: number;
  active: number;
  assigned: number;
  pending: number;
  unreadCount: number;
}

export const conversationApi = {
  // 獲取對話列表（向後兼容）
  // Note: assignedTo filter removed - use teamId for team-based filtering
  getConversations: async (filters?: ConversationFilters): Promise<ApiResponse<Conversation[]>> => {
    const queryParams = new URLSearchParams();
    if (filters?.status) {queryParams.append('status', filters.status);}
    if (filters?.platform) {queryParams.append('platform', filters.platform);}
    if (filters?.teamId) {queryParams.append('teamId', filters.teamId.toString());}
    
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
    // Note: assignedTo removed - use teamId for team-based filtering
    if (params.teamId) {queryParams.append('teamId', params.teamId.toString());}
    if (params.search) {queryParams.append('search', params.search);}
    if (params.tagIds && params.tagIds.length > 0) {queryParams.append('tagIds', params.tagIds.join(','));}
    if (params.customerName) {queryParams.append('customerName', params.customerName);}
    if (params.updatedAfter) {queryParams.append('updatedAfter', params.updatedAfter);}
    if (params.updatedBefore) {queryParams.append('updatedBefore', params.updatedBefore);}

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

  // 指派對話 (僅支援團隊指派)
  // Note: Individual assignment (userId) removed - only team-based assignment is supported now
  assignConversation: async (
    conversationId: string,
    options: AssignConversationOptions
  ): Promise<ApiResponse<Conversation>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }

    // 驗證：必須指定 teamId
    if (!options.teamId) {
      return { success: false, error: '請指定團隊' };
    }

    // 使用 POST 方法 (後端使用 POST)
    // Backend now returns complete conversation object with assignedTeam
    const response = await apiClient.post<RawConversationData>(`/conversations/${conversationId}/assign`, {
      teamId: options.teamId,
      reason: options.reason
    });

    // 🔧 FIX: 對返回的數據進行適配，確保 customer.name 等字段正確映射
    if (response.success && response.data) {
      const adaptedConversation = adaptConversationData(response.data);
      return {
        success: true,
        data: adaptedConversation
      };
    }

    return { success: false, error: response.error || '指派對話失敗' };
  },

  // 取消指派對話
  unassignConversation: async (
    conversationId: string,
    reason?: string
  ): Promise<ApiResponse<Conversation>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }

    // 使用 POST 方法調用取消指派 API
    const response = await apiClient.post<RawConversationData>(`/conversations/${conversationId}/unassign`, {
      reason: reason || undefined
    });

    // 🔧 FIX: 對返回的數據進行適配，確保 customer.name 等字段正確映射
    if (response.success && response.data) {
      const adaptedConversation = adaptConversationData(response.data);
      return {
        success: true,
        data: adaptedConversation
      };
    }

    return { success: false, error: response.error || '取消指派失敗' };
  },

  // 轉移對話（從團隊A到團隊B，會觸發三方通知）
  transferConversation: async (
    conversationId: string,
    options: {
      fromTeamId?: number;
      toTeamId: number;
      // Note: fromUserId and toUserId removed - only team-based transfer is supported
      reason?: string;
    }
  ): Promise<ApiResponse<Conversation>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }

    if (!options.toTeamId) {
      return { success: false, error: '請指定目標團隊' };
    }

    const response = await apiClient.post<RawConversationData>(`/conversations/${conversationId}/transfer`, options);

    // Transfer API 返回 { success: true, message: '...' }，不一定有 data
    // 對話數據會通過 WebSocket 實時更新，所以只需要檢查 success
    if (response.success) {
      // 如果有返回 data，則轉換格式
      if (response.data) {
        const adaptedConversation = adaptConversationData(response.data);
        return {
          success: true,
          data: adaptedConversation
        };
      }
      // 沒有 data 也算成功（WebSocket 會推送更新）
      return { success: true };
    }

    return { success: false, error: response.error || '轉移對話失敗' };
  },

  // Note: closeConversation and reopenConversation removed - closed status no longer exists

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

  /**
   * @deprecated Individual assignment is no longer supported. Use assignConversation with teamId instead.
   */
  assign: async (_conversationId: string, _agentId: string): Promise<ApiResponse<Conversation>> => {
    console.error('❌ [conversationApi.assign] Individual assignment is deprecated. Use assignConversation with teamId instead.')
    return { success: false, error: '個人指派功能已停用，請使用團隊指派' }
  },

  // ==================== 批量操作 ====================

  /**
   * 批量操作對話 (最多 100 筆)
   * 支援操作: assign, close, reopen, set_priority, add_tags, remove_tags
   * Note: Individual assignment (userId) removed - only team-based assignment is supported now
   */
  bulkOperation: async (
    operation: 'assign' | 'close' | 'reopen' | 'set_priority' | 'add_tags' | 'remove_tags',
    conversationIds: string[],
    data?: {
      teamId?: number;
      priority?: string;
      tagIds?: number[];
    }
  ): Promise<ApiResponse<{
    operation: string;
    affectedCount: number;
    conversationIds: string[];
  }>> => {
    if (conversationIds.length === 0) {
      return { success: false, error: '至少需要選擇一個對話' };
    }
    if (conversationIds.length > 100) {
      return { success: false, error: '批量操作限制最多 100 個對話' };
    }
    return apiClient.post('/conversations/bulk', {
      operation,
      conversationIds,
      data
    });
  },

  /**
   * 批量關閉對話
   */
  bulkClose: async (conversationIds: string[]): Promise<ApiResponse<{
    operation: string;
    affectedCount: number;
    conversationIds: string[];
  }>> => {
    return conversationApi.bulkOperation('close', conversationIds);
  },

  /**
   * 批量重新開啟對話
   */
  bulkReopen: async (conversationIds: string[]): Promise<ApiResponse<{
    operation: string;
    affectedCount: number;
    conversationIds: string[];
  }>> => {
    return conversationApi.bulkOperation('reopen', conversationIds);
  },

  /**
   * 批量指派對話
   * Note: Individual assignment (userId) removed - only team-based assignment is supported now
   */
  bulkAssign: async (
    conversationIds: string[],
    options: { teamId: number }
  ): Promise<ApiResponse<{
    operation: string;
    affectedCount: number;
    conversationIds: string[];
  }>> => {
    return conversationApi.bulkOperation('assign', conversationIds, options);
  },

  /**
   * 批量添加標籤到對話
   */
  bulkAddTags: async (
    conversationIds: string[],
    tagIds: number[]
  ): Promise<ApiResponse<{
    operation: string;
    affectedCount: number;
    conversationIds: string[];
  }>> => {
    return conversationApi.bulkOperation('add_tags', conversationIds, { tagIds });
  },

  /**
   * 批量從對話移除標籤
   */
  bulkRemoveTags: async (
    conversationIds: string[],
    tagIds: number[]
  ): Promise<ApiResponse<{
    operation: string;
    affectedCount: number;
    conversationIds: string[];
  }>> => {
    return conversationApi.bulkOperation('remove_tags', conversationIds, { tagIds });
  },

  // ==================== 單一對話標籤操作 ====================

  /**
   * 獲取對話的標籤列表
   */
  getConversationTags: async (conversationId: string): Promise<ApiResponse<{
    id: number;
    name: string;
    color: string;
    description: string | null;
    assignedBy: string;
    assignedAt: string;
  }[]>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    return apiClient.get(`/conversations/${conversationId}/tags`);
  },

  /**
   * 為對話添加標籤
   */
  addConversationTags: async (
    conversationId: string,
    tagIds: number[]
  ): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    if (!tagIds || tagIds.length === 0) {
      return { success: false, error: '標籤 ID 不能為空' };
    }
    return apiClient.post(`/conversations/${conversationId}/tags`, { tagIds });
  },

  /**
   * 從對話移除標籤
   */
  removeConversationTags: async (
    conversationId: string,
    tagIds: number[]
  ): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    if (!tagIds || tagIds.length === 0) {
      return { success: false, error: '標籤 ID 不能為空' };
    }
    // 使用 request 方法直接發送 DELETE 請求並帶上 body
    return apiClient.request('DELETE', `/conversations/${conversationId}/tags`, { tagIds });
  }
}