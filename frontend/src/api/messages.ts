// 訊息相關 API
import { apiClient } from './base'
import type { ApiResponse } from '@/types'

export interface DelayedMessageRequest {
  conversationId: string
  content: string
  delaySeconds: number
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file'
  mediaUrl?: string
  senderId: string
  recipientPlatformId: string
  platform: 'line' | 'facebook'
}

export interface DelayedMessageResponse {
  messageId: string
  scheduledSendTime: string
  recallDeadline: string
}

export interface RecallMessageRequest {
  messageId: string
  userId: string
}

export interface RecallMessageResponse {
  success: boolean
  messageId: string
}

export interface PendingMessage {
  id: string
  conversation_id: string
  customer_name: string
  content: string
  platform: string
  scheduled_send_time: string
  recall_deadline: string
  status: string
  can_recall: boolean
  message_type: string
  created_at: string
}

export interface PendingMessagesResponse {
  items: PendingMessage[]
  total: number
  page: number
  pageSize: number
}

// ==================== 批量操作類型 ====================

export interface BulkCreateMessageRequest {
  conversationId: string
  content: string
  messageType?: 'text' | 'image' | 'file'
  attachmentIds?: string[]
}

export interface BulkCreateMessagesRequest {
  messages: BulkCreateMessageRequest[]
}

export interface BulkDeleteMessagesRequest {
  messageIds: string[]
  hardDelete?: boolean
}

export interface BulkOperationResult {
  success: boolean
  results: Array<{
    id?: string
    success: boolean
    error?: string
  }>
  errors: Array<{
    index: number
    error: string
  }>
  message: string
}

export const messagesApi = {
  // 發送延遲訊息
  sendDelayedMessage: async (request: DelayedMessageRequest): Promise<ApiResponse<DelayedMessageResponse>> => {
    return apiClient.post('/messages/delayed', request)
  },

  // 撤回延遲訊息
  recallMessage: async (request: RecallMessageRequest): Promise<ApiResponse<RecallMessageResponse>> => {
    return apiClient.post('/messages/recall', request)
  },

  // 獲取待發送訊息列表
  getPendingMessages: async (page = 1, pageSize = 20): Promise<ApiResponse<PendingMessagesResponse>> => {
    return apiClient.get(`/messages/pending?page=${page}&pageSize=${pageSize}`)
  },

  // 檢查訊息是否可撤回
  canRecallMessage: async (messageId: string, userId: string): Promise<ApiResponse<{ canRecall: boolean }>> => {
    return apiClient.get(`/messages/${messageId}/can-recall?userId=${userId}`)
  },

  // 獲取訊息詳情
  getMessageDetails: async (messageId: string): Promise<ApiResponse<PendingMessage>> => {
    return apiClient.get(`/messages/${messageId}`)
  },

  // ==================== 批量操作 ====================

  /**
   * 批量創建訊息 (最多 100 筆)
   */
  bulkCreate: async (request: BulkCreateMessagesRequest): Promise<ApiResponse<BulkOperationResult>> => {
    if (request.messages.length > 100) {
      return {
        success: false,
        error: 'Bulk operation limited to 100 messages at a time'
      }
    }
    return apiClient.post('/messages/bulk-create', request)
  },

  /**
   * 批量刪除訊息 (最多 100 筆)
   */
  bulkDelete: async (request: BulkDeleteMessagesRequest): Promise<ApiResponse<BulkOperationResult>> => {
    if (request.messageIds.length > 100) {
      return {
        success: false,
        error: 'Bulk operation limited to 100 messages at a time'
      }
    }
    return apiClient.post('/messages/bulk-delete', request)
  },

  /**
   * 批量刪除訊息的便捷方法
   */
  bulkDeleteByIds: async (messageIds: string[], hardDelete = false): Promise<ApiResponse<BulkOperationResult>> => {
    return messagesApi.bulkDelete({ messageIds, hardDelete })
  }
}

export default messagesApi