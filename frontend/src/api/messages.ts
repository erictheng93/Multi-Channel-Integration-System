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
  }
}

export default messagesApi