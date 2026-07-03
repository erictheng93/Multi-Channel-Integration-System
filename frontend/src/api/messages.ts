// 訊息相關 API
import { callApiContract } from './contract-client'
import { messageContracts } from '@shared/api-contracts'
import type { ApiResponse } from '@/types'
import type {
  BulkCreateMessagesRequest,
  BulkDeleteMessagesRequest,
  BulkOperationResult,
  MessageDetail,
} from '@shared/api-contracts'

export type {
  BulkCreateMessageRequest,
  BulkCreateMessagesRequest,
  BulkDeleteMessagesRequest,
  BulkOperationResult,
  MessageDetail,
} from '@shared/api-contracts'

export const messagesApi = {
  // 獲取訊息詳情
  getMessageDetails: async (messageId: string): Promise<ApiResponse<MessageDetail>> => {
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
