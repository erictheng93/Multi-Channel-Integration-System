// 訊息相關 API
import { callApiContract } from './contract-client'
import { messageContracts } from '@shared/api-contracts'
import type { ApiResponse } from '@/types'
import type {
  BulkCreateMessagesRequest,
  BulkDeleteMessagesRequest,
  BulkOperationResult,
  DelayedMessageRequest,
  DelayedMessageResponse,
  PendingMessage,
  PendingMessagesResponse,
  RecallMessageRequest,
  RecallMessageResponse
} from '@shared/api-contracts'

export type {
  BulkCreateMessageRequest,
  BulkCreateMessagesRequest,
  BulkDeleteMessagesRequest,
  BulkOperationResult,
  DelayedMessageRequest,
  DelayedMessageResponse,
  PendingMessage,
  PendingMessagesResponse,
  RecallMessageRequest,
  RecallMessageResponse
} from '@shared/api-contracts'

export const messagesApi = {
  // 發送延遲訊息
  sendDelayedMessage: async (request: DelayedMessageRequest): Promise<ApiResponse<DelayedMessageResponse>> => {
    return callApiContract(messageContracts.sendDelayedMessage, {}, request)
  },

  // 撤回延遲訊息
  recallMessage: async (request: RecallMessageRequest): Promise<ApiResponse<RecallMessageResponse>> => {
    return callApiContract(messageContracts.recallMessage, {}, request)
  },

  // 獲取待發送訊息列表
  getPendingMessages: async (page = 1, pageSize = 20): Promise<ApiResponse<PendingMessagesResponse>> => {
    return callApiContract(messageContracts.getPendingMessages, { page, pageSize })
  },

  // 檢查訊息是否可撤回
  canRecallMessage: async (messageId: string, userId: string): Promise<ApiResponse<{ canRecall: boolean }>> => {
    return callApiContract(messageContracts.canRecallMessage, { messageId, userId })
  },

  // 獲取訊息詳情
  getMessageDetails: async (messageId: string): Promise<ApiResponse<PendingMessage>> => {
    return callApiContract(messageContracts.getMessageDetails, { messageId })
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
    return callApiContract(messageContracts.bulkCreate, {}, request)
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
    return callApiContract(messageContracts.bulkDelete, {}, request)
  },

  /**
   * 批量刪除訊息的便捷方法
   */
  bulkDeleteByIds: async (messageIds: string[], hardDelete = false): Promise<ApiResponse<BulkOperationResult>> => {
    return messagesApi.bulkDelete({ messageIds, hardDelete })
  }
}

export default messagesApi
