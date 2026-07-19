// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/message.ts
// Created by: API Service Developer

import {
  conversationMessageContracts,
  type ConversationMessageListParams,
  type MessageSearchParams,
  type ConversationMessageRecallRequest,
  type SendConversationMessageRequest
} from '@shared/api-contracts'
import { callApiContract } from './contract-client'
import type { Message, ApiResponse, Platform, PaginatedResponse } from '@/types'

export type SendMessageRequest = SendConversationMessageRequest & { platform?: Platform }

export type MessageListParams = ConversationMessageListParams
export type SearchMessageParams = MessageSearchParams

export interface UploadAttachmentRequest {
  file: globalThis.File;
  messageType: 'image' | 'file';
}

export type MessageRecallRequest = ConversationMessageRecallRequest

export const messageApi = {
  // 獲取對話訊息列表
  list: async (conversationId: string, params?: MessageListParams): Promise<ApiResponse<Message[]>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    return callApiContract(conversationMessageContracts.list, { conversationId, params }) as Promise<ApiResponse<Message[]>>;
  },

  // 獲取分頁訊息列表
  listPaginated: async (conversationId: string, params?: MessageListParams): Promise<ApiResponse<PaginatedResponse<Message>>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    return callApiContract(conversationMessageContracts.listPaginated, { conversationId, params }) as Promise<ApiResponse<PaginatedResponse<Message>>>;
  },

  // 發送訊息
  // FIX: 使用 /api/conversations/ 端點 (發送到 LINE + WebSocket 廣播)
  // 後端 message.ts 已加入 CustomerConversationDO 通知，實現即時同步
  send: async (conversationId: string, data: SendMessageRequest): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }

    // FIX: 允許發送純附件訊息（沒有文字內容）
    const hasAttachments = data.attachmentIds && data.attachmentIds.length > 0;
    const hasContent = data.content?.trim();

    if (!hasContent && !hasAttachments) {
      return { success: false, error: '訊息內容或附件不能為空' };
    }

    const payload = {
      content: data.content?.trim() || '',  //  FIX: 允許空字串
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
    return callApiContract(conversationMessageContracts.send, { conversationId }, payload) as Promise<ApiResponse<Message>>;
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
    return callApiContract(conversationMessageContracts.uploadAttachment, { conversationId }, formData);
  },

  // 標記訊息為已讀
  markAsRead: async (conversationId: string, messageId?: string): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    return messageId
      ? callApiContract(conversationMessageContracts.markMessageAsRead, { conversationId, messageId })
      : callApiContract(conversationMessageContracts.markAllAsRead, { conversationId });
  },

  // 撤回訊息
  recallMessage: async (conversationId: string, request: MessageRecallRequest): Promise<ApiResponse<void>> => {
    if (!conversationId?.trim() || !request.messageId?.trim()) {
      return { success: false, error: '對話 ID 和訊息 ID 不能為空' };
    }
    
    return callApiContract(
      conversationMessageContracts.recall,
      { conversationId, messageId: request.messageId },
      { reason: request.reason }
    );
  },

  // 獲取單一訊息
  get: async (conversationId: string, messageId: string): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim() || !messageId?.trim()) {
      return { success: false, error: '對話 ID 和訊息 ID 不能為空' };
    }
    
    return callApiContract(conversationMessageContracts.get, { conversationId, messageId }) as Promise<ApiResponse<Message>>;
  },

  // 編輯訊息
  edit: async (conversationId: string, messageId: string, newContent: string): Promise<ApiResponse<Message>> => {
    if (!conversationId?.trim() || !messageId?.trim()) {
      return { success: false, error: '對話 ID 和訊息 ID 不能為空' };
    }
    
    if (!newContent?.trim()) {
      return { success: false, error: '新的訊息內容不能為空' };
    }
    
    return callApiContract(conversationMessageContracts.edit, { conversationId, messageId }, {
      content: newContent.trim()
    }) as Promise<ApiResponse<Message>>;
  },

  // 搜索訊息
  search: async (
    conversationId: string,
    query: string,
    messageType?: string,
    params: Omit<SearchMessageParams, 'messageType'> = {}
  ): Promise<ApiResponse<Message[]>> => {
    if (!conversationId?.trim()) {
      return { success: false, error: '對話 ID 不能為空' };
    }
    
    if (!query?.trim()) {
      return { success: false, error: '搜索關鍵字不能為空' };
    }
    
    return callApiContract(
      conversationMessageContracts.search,
      { conversationId, query, params: { ...params, messageType } }
    ) as Promise<ApiResponse<Message[]>>;
  }
}
