import { ref } from 'vue'
import { apiClient } from '@/api/base'

export interface DelayedMessageRequest {
  conversationId: number
  content: string
  delaySeconds: number
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file'
  mediaUrl?: string
}

export interface PendingMessage {
  id: string
  conversationId: number
  customerName: string
  content: string
  messageType: string
  platform: string
  delaySeconds: number
  scheduledSendTime: string
  recallDeadline: string
  status: 'pending' | 'sent' | 'cancelled' | 'failed'
  createdAt: string
  canRecall: boolean
}

export interface DelayedMessageResponse {
  success: boolean
  data?: {
    messageId: string
    canRecall: boolean
    recallDeadline: string
    delaySeconds: number
    scheduledSendTime: string
  }
  error?: string
}

export interface RecallResponse {
  success: boolean
  data?: {
    messageId: string
    recalled: boolean
    recalledAt: string
  }
  error?: string
}

export interface PendingMessagesResponse {
  success: boolean
  data?: {
    items: PendingMessage[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }
  error?: string
}

export function useDelayedMessage() {
  const isLoading = ref(false)
  const pendingMessages = ref<PendingMessage[]>([])
  const error = ref<string | null>(null)

  /**
   * 發送延遲訊息
   */
  const sendDelayedMessage = async (request: DelayedMessageRequest): Promise<DelayedMessageResponse> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiClient.post('/api/messages/delayed/send', request)
      
      if (response.success) {
        return {
          success: true,
          data: response.data as {
            messageId: string
            canRecall: boolean
            recallDeadline: string
            delaySeconds: number
            scheduledSendTime: string
          }
        }
      } else {
        error.value = response.error || 'Failed to send delayed message'
        return {
          success: false,
          error: error.value
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      error.value = errorMessage
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 撤回延遲訊息
   */
  const recallMessage = async (messageId: string): Promise<RecallResponse> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiClient.post('/api/messages/delayed/recall', { messageId })
      
      if (response.success) {
        // 從待發送列表中移除已撤回的訊息
        pendingMessages.value = pendingMessages.value.filter(msg => msg.id !== messageId)
        
        return {
          success: true,
          data: response.data as {
            messageId: string
            recalled: boolean
            recalledAt: string
          }
        }
      } else {
        error.value = response.error || 'Failed to recall message'
        return {
          success: false,
          error: error.value
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      error.value = errorMessage
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 獲取待發送訊息列表
   */
  const getPendingMessages = async (
    conversationId?: number,
    page: number = 1,
    pageSize: number = 20,
    status: string = 'pending'
  ): Promise<PendingMessagesResponse> => {
    isLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        status
      })

      if (conversationId) {
        params.append('conversationId', conversationId.toString())
      }

      const response = await apiClient.get(`/api/messages/delayed/list?${params}`)
      
      if (response.success) {
        const data = response.data as {
          items: PendingMessage[]
          pagination: {
            page: number
            pageSize: number
            total: number
            totalPages: number
          }
        }
        pendingMessages.value = data.items
        return {
          success: true,
          data
        }
      } else {
        error.value = response.error || 'Failed to load pending messages'
        return {
          success: false,
          error: error.value
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      error.value = errorMessage
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 清除錯誤狀態
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * 重置狀態
   */
  const reset = () => {
    isLoading.value = false
    pendingMessages.value = []
    error.value = null
  }

  return {
    // 狀態
    isLoading,
    pendingMessages,
    error,

    // 方法
    sendDelayedMessage,
    recallMessage,
    getPendingMessages,
    clearError,
    reset
  }
}