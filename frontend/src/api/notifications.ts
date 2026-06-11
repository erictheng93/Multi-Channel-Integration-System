// frontend/src/api/notifications.ts
// 通知系統 API 客戶端

import {
  notificationContracts,
  type BulkCreateNotificationRequest,
  type CreateNotificationRequest,
  type Notification,
  type NotificationListParams,
  type NotificationSettings,
  type NotificationStats,
  type NotificationType
} from '@shared/api-contracts'
import { callApiContract } from './contract-client'
import type { ApiResponse, PaginatedResponse } from '@/types'

export type {
  BulkCreateNotificationRequest,
  CreateNotificationRequest,
  Notification,
  NotificationListParams,
  NotificationPriority,
  NotificationSettings,
  NotificationStats,
  NotificationType
} from '@shared/api-contracts'

// ==================== API 客戶端 ====================

export const notificationApi = {
  // 獲取通知列表
  list: async (params: NotificationListParams = {}): Promise<ApiResponse<PaginatedResponse<Notification>>> => {
    return callApiContract(notificationContracts.list, params) as Promise<ApiResponse<PaginatedResponse<Notification>>>
  },

  // 獲取單個通知
  getById: async (id: string): Promise<ApiResponse<Notification>> => {
    if (!id?.trim()) {
      return { success: false, error: '通知 ID 不能為空' }
    }
    return callApiContract(notificationContracts.getById, { id })
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
    return callApiContract(notificationContracts.create, {}, request)
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
    return callApiContract(notificationContracts.createBulk, {}, request)
  },

  // 標記通知為已讀
  markAsRead: async (id: string): Promise<ApiResponse<void>> => {
    if (!id?.trim()) {
      return { success: false, error: '通知 ID 不能為空' }
    }
    return callApiContract(notificationContracts.markAsRead, { id })
  },

  // 批量標記為已讀
  markAllAsRead: async (type?: NotificationType): Promise<ApiResponse<{ updated: number }>> => {
    return callApiContract(notificationContracts.markAllAsRead, {}, type ? { type } : {})
  },

  // 刪除通知
  delete: async (id: string): Promise<ApiResponse<void>> => {
    if (!id?.trim()) {
      return { success: false, error: '通知 ID 不能為空' }
    }
    return callApiContract(notificationContracts.delete, { id })
  },

  // 獲取通知統計
  getStats: async (): Promise<ApiResponse<NotificationStats>> => {
    return callApiContract(notificationContracts.stats, {})
  },

  // 獲取未讀數量
  getUnreadCount: async (type?: NotificationType): Promise<ApiResponse<{ count: number; type: string }>> => {
    return callApiContract(notificationContracts.unreadCount, { type })
  },

  // 獲取最近通知
  getRecent: async (limit = 10): Promise<ApiResponse<{
    notifications: Notification[]
    count: number
    limit: number
  }>> => {
    return callApiContract(notificationContracts.recent, { limit })
  },

  // 清理過期通知 (僅管理員)
  cleanup: async (): Promise<ApiResponse<{ deleted: number }>> => {
    return callApiContract(notificationContracts.cleanup, {})
  },

  // 獲取通道統計 (僅管理員)
  getChannelStats: async (): Promise<ApiResponse<Record<string, {
    enabled: boolean
    type: string
    stats?: unknown
  }>>> => {
    return callApiContract(notificationContracts.channelStats, {})
  },

  // 測試通道
  testChannel: async (channelType: string, message?: string): Promise<ApiResponse<{
    success: boolean
    messageId?: string
    errorMessage?: string
  }>> => {
    return callApiContract(notificationContracts.testChannel, { channelType }, { message })
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
    return callApiContract(notificationContracts.newMessage, {}, params)
  },

  // 創建對話指派通知
  notifyConversationAssigned: async (params: {
    userId: number
    conversationId: number
    customerName: string
    assignedBy: string
  }): Promise<ApiResponse<{ id: string }>> => {
    return callApiContract(notificationContracts.conversationAssigned, {}, params)
  },

  // 創建系統通知 (僅管理員)
  notifySystem: async (params: {
    userIds: number[]
    title: string
    content: string
    data?: Record<string, unknown>
  }): Promise<ApiResponse<{ ids: string[]; count: number }>> => {
    return callApiContract(notificationContracts.system, {}, params)
  },

  // ==================== 設定管理 ====================

  // 獲取通知設定
  getSettings: async (): Promise<ApiResponse<NotificationSettings>> => {
    return callApiContract(notificationContracts.settings, {})
  },

  // 更新通知設定
  updateSettings: async (settings: Partial<Omit<NotificationSettings, 'userId'>>): Promise<ApiResponse<void>> => {
    return callApiContract(notificationContracts.updateSettings, {}, settings)
  }
}
