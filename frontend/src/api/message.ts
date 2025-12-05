// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/message.ts
// Created by: API Service Developer

import { apiClient } from './base'
import type { Message, ApiResponse, Platform, PaginatedResponse } from '@/types'

export interface SendMessageRequest {
  content: string;
  messageType?: 'text' | 'image' | 'file';
  platform?: Platform;
  senderId?: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  attachmentIds?: string[];
}

export interface MessageListParams {
  page?: number;
  pageSize?: number;
  since?: string;
  before?: string;
  messageType?: 'text' | 'image' | 'file';
}

export interface UploadAttachmentRequest {
  file: globalThis.File;
  messageType: 'image' | 'file';
}

export interface MessageRecallRequest {
  messageId: string;
  reason?: string;
}

export const messageApi = {
  // 獲取對話訊息列表
  list: async (conversationId: string, params?: MessageListParams): Promise<ApiResponse<Message[]>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) {queryParams.append('page', params.page.toString());}
    if (params?.pageSize !== undefined) {queryParams.append('pageSize', params.pageSize.toString());}
    if (params?.since) {queryParams.append('since', params.since);}
    if (params?.before) {queryParams.append('before', params.before);}
    if (params?.messageType) {queryParams.append('messageType', params.messageType);}
    
    const queryString = queryParams.toString();
    return apiClient.get(`/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`);
  },

  // 獲取分頁訊息列表
  listPaginated: async (conversationId: string, params?: MessageListParams): Promise<ApiResponse<PaginatedResponse<Message>>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) {queryParams.append('page', params.page.toString());}
    if (params?.pageSize !== undefined) {queryParams.append('pageSize', params.pageSize.toString());}
    if (params?.since) {queryParams.append('since', params.since);}
    if (params?.before) {queryParams.append('before', params.before);}
    if (params?.messageType) {queryParams.append('messageType', params.messageType);}
    
    return apiClient.get(`/conversations/${conversationId}/messages?${queryParams.toString()}`);
  },

  // 發送訊息
  // 🔧 FIX: 使用 /api/conversations/ 端點 (發送到 LINE + WebSocket 廣播)
  // 後端 message.ts 已加入 CustomerConversationDO 通知，實現即時同步
  send: async (conversationId: string, data: SendMessageRequest): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }

    // 🔧 FIX: 允許發送純附件訊息（沒有文字內容）
    const hasAttachments = data.attachmentIds && data.attachmentIds.length > 0;
    const hasContent = data.content?.trim();

    if (!hasContent && !hasAttachments) {
      return { success: false, error: '訊息內容或附件不能為空' };
    }

    const payload = {
      content: data.content?.trim() || '',  // 🔧 FIX: 允許空字串
      messageType: data.messageType || (hasAttachments ? 'file' : 'text'),
      platform: data.platform,
      senderId: data.senderId,
      replyToId: data.replyToId,
      metadata: data.metadata,
      attachmentIds: data.attachmentIds
    };

    // 使用 /api/conversations/ 端點：
    // 1. 發送訊息到 LINE (via Queue)
    // 2. 通知 CustomerConversationDO 進行 WebSocket 廣播
    return apiClient.post(`/conversations/${conversationId}/messages`, payload);
  },

  // 發送快速回覆
  sendQuickReply: async (conversationId: string, replyText: string, platform?: Platform): Promise<ApiResponse<Message>> => {
    return messageApi.send(conversationId, {
      content: replyText,
      messageType: 'text',
      platform,
      metadata: { isQuickReply: true }
    });
  },

  // 上傳附件
  uploadAttachment: async (conversationId: string, request: UploadAttachmentRequest): Promise<ApiResponse<{ url: string; filename: string; attachmentId: string }>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }

    if (!request.file) {
      return { success: false, error: '請選擇要上傳的檔案' };
    }

    const formData = new globalThis.FormData();
    formData.append('file', request.file);
    formData.append('messageType', request.messageType);

    // 修復：使用正確的對話附件端點 (POST /conversations/:id/attachments)
    return apiClient.uploadFile(`/conversations/${conversationId}/attachments`, formData);
  },

  // 標記訊息為已讀
  markAsRead: async (conversationId: string, messageId?: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    const endpoint = messageId 
      ? `/conversations/${conversationId}/messages/${messageId}/read`
      : `/conversations/${conversationId}/messages/read`;
      
    return apiClient.put(endpoint);
  },

  // 撤回訊息
  recallMessage: async (conversationId: string, request: MessageRecallRequest): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim() || !request.messageId?.trim()) {
      return { success: false, error: '對話 ID 和訊息 ID 不能為空' };
    }
    
    return apiClient.request('DELETE', `/conversations/${conversationId}/messages/${request.messageId}`, {
      reason: request.reason
    });
  },

  // 獲取單一訊息
  get: async (conversationId: string, messageId: string): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim() || !messageId?.trim()) {
      return { success: false, error: '對話 ID 和訊息 ID 不能為空' };
    }
    
    return apiClient.get(`/conversations/${conversationId}/messages/${messageId}`);
  },

  // 編輯訊息
  edit: async (conversationId: string, messageId: string, newContent: string): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim() || !messageId?.trim()) {
      return { success: false, error: '對話 ID 和訊息 ID 不能為空' };
    }
    
    if (!newContent?.trim()) {
      return { success: false, error: '新的訊息內容不能為空' };
    }
    
    return apiClient.put(`/conversations/${conversationId}/messages/${messageId}`, {
      content: newContent.trim()
    });
  },

  // 搜索訊息
  search: async (conversationId: string, query: string, messageType?: string): Promise<ApiResponse<Message[]>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    if (!query?.trim()) {
      return { success: false, error: '搜索關鍵字不能為空' };
    }
    
    const queryParams = new URLSearchParams();
    queryParams.append('q', query.trim());
    if (messageType) {queryParams.append('messageType', messageType);}
    
    return apiClient.get(`/conversations/${conversationId}/messages/search?${queryParams.toString()}`);
  }
}