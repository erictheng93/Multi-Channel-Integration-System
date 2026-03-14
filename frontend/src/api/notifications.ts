// frontend/src/api/notifications.ts
// 通知系統 API 客戶端

import { apiClient } from './base'
import type { ApiResponse, PaginatedResponse } from '@/types'

// ==================== 類型定義 ====================

export type NotificationType =
  | 'new_message'
  | 'conversation_assigned'
  | 'conversation_transferred'
  | 'mention'
  | 'system'
  | 'priority_changed'
  | 'customer_responded'
  | 'task_reminder'
  | 'agent_removed_from_team'  // Agent 被移出團隊通知
  | 'customer_followed' //  新客戶加入通知
  | 'new_conversation' //  新對話創建通知

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Notification {
  id: string
  userId: number
  type: NotificationType
  title: string
  content: string
  data?: Record<string, unknown>
  priority: NotificationPriority
  isRead: boolean
  readAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt?: string
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<NotificationType, { total: number; unread: number }>
  byPriority: Record<NotificationPriority, { total: number; unread: number }>
  timeRange: {
    today: number
    thisWeek: number
    thisMonth: number
  }
}

export interface NotificationSettings {
  userId: number
  emailEnabled: boolean
  pushEnabled: boolean
  soundEnabled: boolean
  mentionEnabled: boolean
  assignmentEnabled: boolean
  messageEnabled: boolean
  systemEnabled: boolean
}

// ==================== 請求參數類型 ====================

export interface NotificationListParams {
  page?: number
  pageSize?: number
  type?: NotificationType
  priority?: NotificationPriority
  isRead?: boolean
  dateFrom?: string
  dateTo?: string
}

export interface CreateNotificationRequest {
  userId?: number
  type: NotificationType
  title: string
  content: string
  data?: Record<string, unknown>
  priority?: NotificationPriority
  channels?: string[]
  expiresAt?: string
}

export interface BulkCreateNotificationRequest {
  notifications: CreateNotificationRequest[]
  batchId?: string
}

// ==================== API 客戶端 ====================

export const notificationApi = {
  // 獲取通知列表
  list: async (params: NotificationListParams = {}): Promise<ApiResponse<PaginatedResponse<Notification>>> => {
    const queryParams = new URLSearchParams()
    
    if (params.page !== undefined) {queryParams.append('page', params.page.toString())}
    if (params.pageSize !== undefined) {queryParams.append('pageSize', params.pageSize.toString())}
    if (params.type) {queryParams.append('type', params.type)}
    if (params.priority) {queryParams.append('priority', params.priority)}
    if (params.isRead !== undefined) {queryParams.append('isRead', params.isRead.toString())}
    if (params.dateFrom) {queryParams.append('dateFrom', params.dateFrom)}
    if (params.dateTo) {queryParams.append('dateTo', params.dateTo)}
    
    const queryString = queryParams.toString()
    return apiClient.get(`/notifications${queryString ? `?${queryString}` : ''}`)
  },

  // 獲取單個通知
  getById: async (id: string): Promise<ApiResponse<Notification>> => {
    if (!id?.trim()) {
      return { success: false, error: '通知 ID 不能為空' }
    }
    return apiClient.get(`/notifications/${id}`)
  },

  // 創建通知
  create: async (request: CreateNotificationRequest): Promise<ApiResponse<{ id: string }>> => {
    if (!request.title?.trim()) {
      return { success: false, error: '標題不能為空' }
    }
    if (!request.content?.trim()) {
      return { success: false, error: '內容不能為空' }
    }
    if (!request.type) {
      return { success: false, error: '通知類型不能為空' }
    }
    return apiClient.post('/notifications', request)
  },

  // 批量創建通知 (僅管理員)
  createBulk: async (request: BulkCreateNotificationRequest): Promise<ApiResponse<{
    successful: number
    failed: number
    successfulIds: string[]
    failures: Array<{ index: number; error: string }>
  }>> => {
    if (!request.notifications || request.notifications.length === 0) {
      return { success: false, error: '至少需要一個通知' }
    }
    return apiClient.post('/notifications/bulk', request)
  },

  // 標記通知為已讀
  markAsRead: async (id: string): Promise<ApiResponse<void>> => {
    if (!id?.trim()) {
      return { success: false, error: '通知 ID 不能為空' }
    }
    return apiClient.put(`/notifications/${id}/read`)
  },

  // 批量標記為已讀
  markAllAsRead: async (type?: NotificationType): Promise<ApiResponse<{ updated: number }>> => {
    return apiClient.put('/notifications/mark-all-read', type ? { type } : {})
  },

  // 刪除通知
  delete: async (id: string): Promise<ApiResponse<void>> => {
    if (!id?.trim()) {
      return { success: false, error: '通知 ID 不能為空' }
    }
    return apiClient.delete(`/notifications/${id}`)
  },

  // 獲取通知統計
  getStats: async (): Promise<ApiResponse<NotificationStats>> => {
    return apiClient.get('/notifications/stats')
  },

  // 獲取未讀數量
  getUnreadCount: async (type?: NotificationType): Promise<ApiResponse<{ count: number; type: string }>> => {
    const queryParams = type ? `?type=${type}` : ''
    return apiClient.get(`/notifications/unread-count${queryParams}`)
  },

  // 獲取最近通知
  getRecent: async (limit = 10): Promise<ApiResponse<{
    notifications: Notification[]
    count: number
    limit: number
  }>> => {
    return apiClient.get(`/notifications/recent?limit=${limit}`)
  },

  // 清理過期通知 (僅管理員)
  cleanup: async (): Promise<ApiResponse<{ deleted: number }>> => {
    return apiClient.delete('/notifications/cleanup')
  },

  // 獲取通道統計 (僅管理員)
  getChannelStats: async (): Promise<ApiResponse<Record<string, {
    enabled: boolean
    type: string
    stats?: unknown
  }>>> => {
    return apiClient.get('/notifications/channels/stats')
  },

  // 測試通道
  testChannel: async (channelType: string, message?: string): Promise<ApiResponse<{
    success: boolean
    messageId?: string
    errorMessage?: string
  }>> => {
    return apiClient.post(`/notifications/channels/${channelType}/test`, { message })
  },

  // ==================== 便利方法 ====================

  // 創建新訊息通知
  notifyNewMessage: async (params: {
    userId: number
    conversationId: number
    senderName: string
    content: string
    channels?: string[]
  }): Promise<ApiResponse<{ id: string }>> => {
    return apiClient.post('/notifications/new-message', params)
  },

  // 創建對話指派通知
  notifyConversationAssigned: async (params: {
    userId: number
    conversationId: number
    customerName: string
    assignedBy: string
  }): Promise<ApiResponse<{ id: string }>> => {
    return apiClient.post('/notifications/conversation-assigned', params)
  },

  // 創建系統通知 (僅管理員)
  notifySystem: async (params: {
    userIds: number[]
    title: string
    content: string
    data?: Record<string, unknown>
  }): Promise<ApiResponse<{ ids: string[]; count: number }>> => {
    return apiClient.post('/notifications/system', params)
  },

  // ==================== 設定管理 ====================

  // 獲取通知設定
  getSettings: async (): Promise<ApiResponse<NotificationSettings>> => {
    return apiClient.get('/notifications/settings')
  },

  // 更新通知設定
  updateSettings: async (settings: Partial<Omit<NotificationSettings, 'userId'>>): Promise<ApiResponse<void>> => {
    return apiClient.put('/notifications/settings', settings)
  }
}
