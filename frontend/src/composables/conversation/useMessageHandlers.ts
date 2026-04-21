/**
 * useMessageHandlers - 消息處理邏輯 Composable
 *
 * 職責：
 * - 處理消息發送流程 (handleMessageSent, handleMessagePending)
 * - 處理樂觀更新 (optimistic updates)
 * - 處理上傳進度追蹤 (handleUploadProgress)
 * - 處理消息確認/失敗 (handleMessageConfirmed, handleMessageFailed)
 * - 處理消息重試邏輯 (retryFailedMessage)
 * - 追蹤已發送消息 ID（避免重複）
 *
 * 不負責：
 * - 消息列表狀態管理 (由 useConversationState 處理)
 * - WebSocket 廣播 (由 useWebSocketIntegration 處理)
 * - UI 滾動/導航 (由 useConversationActions 處理)
 */

import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFileUpload } from '@/composables/useFileUpload'
import { useToast } from '@/composables/useToast'
import type { Message, FileAttachmentData } from '@/types'
import type { ConversationState } from './useConversationState'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useMessageHandlers')

// ===== 類型定義 =====

export interface MessagePendingData {
  tempId: string
  correlationId?: string  //  Phase 2: 新增 Correlation ID 支援
  content: string
  attachments: Array<{
    name: string
    size: number
    blobUrl?: string
    isImage: boolean
    fileType: string
    typeColor: string
  }>
  status: 'uploading' | 'sending'
  uploadProgress?: number
}

export interface UploadProgressData {
  tempId: string
  correlationId?: string  //  Phase 2: 新增 Correlation ID 支援
  progress: number
  status: 'uploading' | 'sending'
}

export interface MessageConfirmedData {
  tempId: string
  realId: string
  correlationId?: string  //  Phase 2: 新增 Correlation ID 支援
  file_attachments?: FileAttachmentData[]
}

/**
 * Phase 2: 待處理訊息資訊（用於 Correlation ID 追蹤）
 */
export interface PendingMessageInfo {
  tempId: string
  correlationId: string
  content: string
  createdAt: number
}

export interface MessageFailedData {
  tempId: string
  correlationId?: string  //  Phase 2: 新增 Correlation ID 支援
  error: string
  retryData?: {
    content: string
    attachments: RetryAttachment[]
  }
}

export interface RetryAttachment {
  name: string
  size: number
  file: File
  blobUrl?: string
  isImage: boolean
  fileType: string
  typeColor: string
}

export interface MessageSentData {
  content: string
  attachments: unknown[]
  file_attachments?: FileAttachmentData[]
}

// ===== Composable =====

export function useMessageHandlers(
  conversationId: string,
  state: ConversationState
) {
  const authStore = useAuthStore()
  const { showSuccess, showError } = useToast()

  // ===== 狀態追蹤 =====

  /**
   * FIX: 雙重 ID 標記機制 - 解決消息確認與 WebSocket 廣播的競態條件
   * pendingMessageIds: 追蹤正在發送的臨時訊息 ID (tempId)
   * sentMessageIds: 追蹤已確認的真實訊息 ID (realId)
   * 這樣即使 WebSocket 廣播先於 HTTP 響應到達，也能正確跳過重複消息
   */
  const pendingMessageIds = new Set<string>()  //  新增：臨時 ID 集合
  const sentMessageIds = new Set<string>()

  /**
   * Phase 2: Correlation ID 追蹤機制
   * pendingByCorrelationId: 通過 correlationId 追蹤待處理訊息
   * correlationToRealId: correlationId 到 realId 的映射（用於 WebSocket 匹配）
   *
   * 這是業界標準做法（Slack, Discord, WhatsApp 等都使用類似機制）
   * 提供 100% 可靠的前後端訊息關聯
   */
  const pendingByCorrelationId = new Map<string, PendingMessageInfo>()
  const correlationToRealId = new Map<string, string>()

  /**
   * 追蹤用戶活動時間（用於輪詢優化）
   */
  const lastUserActivity = ref(Date.now())

  // ===== 核心消息處理器 =====

  /**
   * 處理消息發送（向後兼容事件，主要用於日誌）
   */
  function handleMessageSent(data: MessageSentData) {
    frontendLogger.debug('[MessageHandlers] handleMessageSent called (backward compatibility event)')
    trackUserActivity()

    if (!data.content?.trim() && (!data.file_attachments || data.file_attachments.length === 0)) {
      console.warn('[MessageHandlers] Empty message content and no attachments, skipping')
      return
    }

    frontendLogger.debug('[MessageHandlers] handleMessageSent completed - message already in UI via handleMessagePending')
  }

  /**
   * 處理消息開始發送（樂觀更新）
   *
   * Phase 2: 支援 Correlation ID 追蹤
   */
  function handleMessagePending(data: MessagePendingData) {
    frontendLogger.debug('[MessageHandlers] Message pending - showing immediately:', data.tempId)
    trackUserActivity()

    // Phase 2: 生成或使用傳入的 correlationId
    const correlationId = data.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // FIX: 立即標記 tempId，防止 WebSocket 廣播重複
    pendingMessageIds.add(data.tempId)
    frontendLogger.debug(`[MessageHandlers] Added to pendingMessageIds: ${data.tempId}`)

    // Phase 2: 記錄到 correlationId Map
    pendingByCorrelationId.set(correlationId, {
      tempId: data.tempId,
      correlationId,
      content: data.content,
      createdAt: Date.now()
    })
    frontendLogger.debug(`[MessageHandlers] Added to pendingByCorrelationId: ${correlationId}`)

    // 創建樂觀訊息，立即顯示給用戶
    const optimisticMessage: Message = {
      id: data.tempId,
      conversationId,
      senderId: authStore.currentAgent?.id || 'unknown',
      senderType: 'agent' as const,
      content: data.content,
      messageType: data.attachments.length > 0 ? ('file' as const) : ('text' as const),
      platform: state.conversation.value?.platform || 'line',
      timestamp: Date.now(),
      createdAt: Date.now(),
      status: 'pending' as const,
      deliveryStatus: 'pending' as const,
      senderName:
        authStore.currentAgent?.displayName || authStore.currentAgent?.name || '我',
      // 保存附件資訊（包含 blobUrl）供顯示
      metadata: {
        correlationId,  //  Phase 2: 儲存 correlationId
        uploadStatus: data.status, // 'uploading' | 'sending'
        uploadProgress: data.uploadProgress || 0,
        pendingAttachments: data.attachments.map(a => ({
          name: a.name,
          size: a.size,
          blobUrl: a.blobUrl,
          isImage: a.isImage,
          fileType: a.fileType,
          typeColor: a.typeColor
        }))
      } as Record<string, unknown>
    }

    // 立即添加到訊息列表
    state.addMessage(optimisticMessage)

    frontendLogger.debug('[MessageHandlers] Optimistic message added to UI with correlationId:', correlationId)
  }

  /**
   * 處理上傳進度更新
   */
  function handleUploadProgress(data: UploadProgressData) {
    frontendLogger.debug(`[MessageHandlers] Upload progress: ${data.progress}% - ${data.status}`)

    const messageList = state.httpMessages.messages.value
    const message = messageList.find(m => m.id === data.tempId)

    if (message) {
      // 根據狀態設置有效的 DeliveryStatus
      const deliveryStatus =
        data.status === 'sending' ? ('sending' as const) : ('pending' as const)
      message.status = deliveryStatus
      message.deliveryStatus = deliveryStatus

      // 在 metadata 中儲存實際上傳狀態
      if (message.metadata && typeof message.metadata === 'object') {
        const meta = message.metadata as Record<string, unknown>
        meta.uploadProgress = data.progress
        meta.uploadStatus = data.status // 'uploading' | 'sending'
      }
    }
  }

  /**
   * 處理消息發送成功確認
   *
   * Phase 1 Fix: 處理 WebSocket 與 HTTP 響應的競態條件
   * Phase 2: 支援 Correlation ID 追蹤
   *
   * 場景：當 WebSocket 廣播比 HTTP 響應先到達時：
   * 1. WebSocket 會添加一個帶有 realId 的訊息
   * 2. HTTP 響應到達時，樂觀訊息 (tempId) 仍然存在
   * 3. 如果直接更新 tempId → realId，會造成重複
   *
   * 解決方案：檢測 realId 是否已存在，若存在則刪除樂觀訊息
   */
  function handleMessageConfirmed(data: MessageConfirmedData) {
    frontendLogger.debug('[MessageHandlers] Message confirmed:', data.tempId, '->', data.realId)

    // FIX: 轉移標記從 tempId 到 realId
    pendingMessageIds.delete(data.tempId)
    sentMessageIds.add(data.realId)
    frontendLogger.debug(`[MessageHandlers] Transferred: ${data.tempId} → ${data.realId}`)
    frontendLogger.debug(`[MessageHandlers] pendingIds: ${pendingMessageIds.size}, sentIds: ${sentMessageIds.size}`)

    // Phase 2: 處理 Correlation ID 追蹤
    // 優先使用傳入的 correlationId，否則根據 tempId 查找
    let correlationId = data.correlationId
    if (!correlationId) {
      // 從 pendingByCorrelationId 中查找對應的 correlationId
      for (const [corrId, info] of pendingByCorrelationId.entries()) {
        if (info.tempId === data.tempId) {
          correlationId = corrId
          break
        }
      }
    }

    if (correlationId) {
      const confirmedCorrelationId = correlationId
      pendingByCorrelationId.delete(confirmedCorrelationId)
      correlationToRealId.set(confirmedCorrelationId, data.realId)
      frontendLogger.debug(`[MessageHandlers] Correlation: ${confirmedCorrelationId} → ${data.realId}`)

      // 定時清理 correlation 映射
      setTimeout(() => {
        correlationToRealId.delete(confirmedCorrelationId)
        frontendLogger.debug(`[MessageHandlers] Cleaned up correlationToRealId: ${confirmedCorrelationId}`)
      }, 5 * 60 * 1000)
    }

    // 定時清理（5分鐘後移除）
    setTimeout(
      () => {
        sentMessageIds.delete(data.realId)
        frontendLogger.debug(`[MessageHandlers] Cleaned up sentMessageIds: ${data.realId}`)
      },
      5 * 60 * 1000
    )

    const messageList = state.httpMessages.messages.value

    // Phase 1 Fix: 檢查 WebSocket 是否已經添加了 realId 訊息
    const existingRealMessage = messageList.find(m => m.id === data.realId)
    const pendingMessage = messageList.find(m => m.id === data.tempId)

    if (existingRealMessage && pendingMessage) {
      // 競態條件：WebSocket 已先添加 realId 訊息
      // 刪除樂觀訊息 (tempId)，保留 WebSocket 訊息 (realId)
      frontendLogger.debug(`[MessageHandlers] Race condition detected: WebSocket already added realId`)
      frontendLogger.debug(`[MessageHandlers] Removing duplicate pending message: ${data.tempId}`)

      const pendingIndex = messageList.indexOf(pendingMessage)
      if (pendingIndex !== -1) {
        messageList.splice(pendingIndex, 1)
        frontendLogger.debug(`[MessageHandlers] Removed pending message at index ${pendingIndex}`)
      }

      // 更新 WebSocket 訊息的附件資訊（如果有）
      if (data.file_attachments && data.file_attachments.length > 0) {
         
        existingRealMessage.file_attachments = data.file_attachments
        frontendLogger.debug(`[MessageHandlers] Updated file_attachments on existing message`)
      }

      // 確保狀態正確
      existingRealMessage.status = 'sent' as const
      existingRealMessage.deliveryStatus = 'sent' as const

      frontendLogger.debug('[MessageHandlers] Race condition resolved - duplicate removed')
    } else if (pendingMessage) {
      // 正常流程：HTTP 響應先於 WebSocket 到達
      // 更新樂觀訊息的 ID 從 tempId 到 realId
      pendingMessage.id = data.realId
      frontendLogger.debug(`[MessageHandlers] Updated message ID: ${data.tempId} -> ${data.realId}`)

      // 更新訊息狀態為已發送
      pendingMessage.status = 'sent' as const
      pendingMessage.deliveryStatus = 'sent' as const

      // 如果有真實的檔案附件資料，更新它
      if (data.file_attachments && data.file_attachments.length > 0) {
         
        pendingMessage.file_attachments = data.file_attachments
      }

      // 清理臨時資料
      if (pendingMessage.metadata && typeof pendingMessage.metadata === 'object') {
        delete (pendingMessage.metadata as Record<string, unknown>).uploadProgress
        delete (pendingMessage.metadata as Record<string, unknown>).pendingAttachments
      }

      frontendLogger.debug('[MessageHandlers] Message status updated to sent with realId')
    } else if (existingRealMessage) {
      // 邊界情況：只有 realId 訊息存在（tempId 可能已被其他機制處理）
      frontendLogger.debug(`[MessageHandlers] Only realId exists, ensuring status is correct`)
      existingRealMessage.status = 'sent' as const
      existingRealMessage.deliveryStatus = 'sent' as const

      if (data.file_attachments && data.file_attachments.length > 0) {
         
        existingRealMessage.file_attachments = data.file_attachments
      }
    } else {
      // 邊界情況：兩個訊息都不存在（可能已被清理）
      console.warn(`[MessageHandlers] Neither tempId nor realId found in message list`)
    }
  }

  /**
   * 處理消息發送失敗
   */
  function handleMessageFailed(data: MessageFailedData) {
    console.error('[MessageHandlers] Message failed:', data.tempId, '-', data.error)

    const messageList = state.httpMessages.messages.value
    const message = messageList.find(m => m.id === data.tempId)

    if (message) {
      message.status = 'failed' as const
      message.deliveryStatus = 'failed' as const

      // 儲存錯誤訊息和重試資料到 metadata
      if (message.metadata && typeof message.metadata === 'object') {
        const meta = message.metadata as Record<string, unknown>
        meta.error = data.error
        // 儲存重試資料（如果有）
        if (data.retryData) {
          meta.retryContent = data.retryData.content
          meta.retryAttachments = data.retryData.attachments
        }
      }

      frontendLogger.debug('[MessageHandlers] Failed message stored with retry data:', {
        tempId: data.tempId,
        hasRetryData: !!data.retryData,
        attachmentCount: data.retryData?.attachments?.length || 0
      })
    }
  }

  /**
   * 更新樂觀消息狀態
   */
  function updateOptimisticMessageStatus(
    messageId: string,
    newStatus: 'sending' | 'sent' | 'failed'
  ) {
    const messageList = state.httpMessages.messages.value
    const message = messageList.find(m => m.id === messageId)

    if (message) {
      message.status = newStatus
      message.deliveryStatus = newStatus
      frontendLogger.debug(`[MessageHandlers] Updated message ${messageId} status to: ${newStatus}`)
    }
  }

  /**
   * 重試失敗的消息（支持附件重新上傳）
   */
  async function retryFailedMessage(messageId: string) {
    const messageList = state.httpMessages.messages.value
    const failedMessage = messageList.find(m => m.id === messageId && m.status === 'failed')

    if (!failedMessage) {
      console.warn('[MessageHandlers] Failed message not found:', messageId)
      return
    }

    frontendLogger.debug('[MessageHandlers] Retrying failed message:', messageId)

    // 從 metadata 獲取重試資料
    const meta = failedMessage.metadata as Record<string, unknown> | undefined
    const retryContent = (meta?.retryContent as string) || failedMessage.content
    const retryAttachments = (meta?.retryAttachments as RetryAttachment[]) || []
    const hasAttachments = retryAttachments.length > 0

    frontendLogger.debug('[MessageHandlers] Retry data:', {
      content: retryContent,
      attachmentCount: retryAttachments.length
    })

    // Update status to sending/uploading
    if (hasAttachments) {
      failedMessage.status = 'pending' as const
      failedMessage.deliveryStatus = 'pending' as const
      if (meta) {
        meta.uploadStatus = 'uploading'
        meta.uploadProgress = 0
      }
    } else {
      updateOptimisticMessageStatus(messageId, 'sending')
    }

    try {
      const { uploadSingleFile } = useFileUpload()
      const attachmentIds: string[] = []

      // 如果有附件，重新上傳
      if (hasAttachments) {
        frontendLogger.debug('[MessageHandlers] Re-uploading attachments...')
        const totalFiles = retryAttachments.length
        let completedFiles = 0

        for (const attachment of retryAttachments) {
          try {
            // 使用原始檔案物件重新上傳
            const result = await uploadSingleFile(attachment.file, {}, progress => {
              if (meta) {
                const overallProgress = Math.round(
                  ((completedFiles + progress / 100) / totalFiles) * 100
                )
                meta.uploadProgress = overallProgress
              }
            })

            if (result.success && result.fileId) {
              attachmentIds.push(result.fileId)
              completedFiles++
              frontendLogger.debug(`[MessageHandlers] Attachment uploaded: ${attachment.name}`)
            } else {
              throw new Error(result.error || '上傳失敗')
            }
          } catch (uploadError) {
            console.error('[MessageHandlers] Attachment re-upload failed:', uploadError)
            updateOptimisticMessageStatus(messageId, 'failed')
            if (meta) {
              meta.error = `重試上傳失敗: ${attachment.name}`
            }
            showError(`檔案 ${attachment.name} 重試上傳失敗`)
            return
          }
        }

        // 上傳完成，更新狀態
        if (meta) {
          meta.uploadStatus = 'sending'
          meta.uploadProgress = 100
        }
      }

      // 發送訊息
      updateOptimisticMessageStatus(messageId, 'sending')

      // 使用 httpMessages（customer-conversations API）以支持 WebSocket 廣播
      let success: boolean
      if (attachmentIds.length > 0) {
        const response = await state.httpMessages.sendMessageWithAttachments(
          retryContent,
          attachmentIds,
          {
            messageType: 'file',
            platform: 'line'
          }
        )
        success = response.success
      } else {
        success = await state.httpMessages.sendMessage(retryContent)
      }

      if (success) {
        updateOptimisticMessageStatus(messageId, 'sent')
        // 清理重試資料
        if (meta) {
          delete meta.retryContent
          delete meta.retryAttachments
          delete meta.uploadStatus
          delete meta.uploadProgress
          delete meta.error
        }
        frontendLogger.debug('[MessageHandlers] Retry successful')
        showSuccess('訊息重試發送成功')
      } else {
        updateOptimisticMessageStatus(messageId, 'failed')
        if (meta) {
          meta.error = '重試發送失敗'
        }
        console.error('[MessageHandlers] Retry send failed')
        showError('訊息重試發送失敗，請再試一次')
      }
    } catch (error) {
      updateOptimisticMessageStatus(messageId, 'failed')
      console.error('[MessageHandlers] Exception during retry:', error)
      showError('重試時發生錯誤，請稍後再試')
    }
  }

  /**
   * Phase 2: 增強版 - 檢查消息是否已發送
   *
   * 檢查順序（優先級從高到低）：
   * 1. correlationId 直接匹配 - 最可靠（Phase 2 新增）
   * 2. correlationId 對應的 realId - 用於 WebSocket 匹配（Phase 2 新增）
   * 3. messageId 在 sentMessageIds 中
   * 4. messageId 在 pendingMessageIds 中（tempId）
   * 5. 根據 tempId 查找對應的 pending 訊息（向後兼容）
   *
   * @param messageId - 訊息 ID（可能是 tempId 或 realId）
   * @param correlationId - 可選的 Correlation ID（Phase 2/3 使用）
   */
  function isSentMessage(messageId: string, correlationId?: string): boolean {
    // Phase 2: 優先使用 correlationId 檢查（最可靠）
    if (correlationId) {
      // 檢查是否有正在發送的訊息使用此 correlationId
      if (pendingByCorrelationId.has(correlationId)) {
        frontendLogger.debug(`[MessageHandlers] Message found by correlationId (pending): ${correlationId}`)
        return true
      }

      // 檢查 correlationId 對應的 realId
      const mappedRealId = correlationToRealId.get(correlationId)
      if (mappedRealId && (mappedRealId === messageId || sentMessageIds.has(mappedRealId))) {
        frontendLogger.debug(`[MessageHandlers] Message found by correlationId (confirmed): ${correlationId} → ${mappedRealId}`)
        return true
      }
    }

    // 原有邏輯：檢查 messageId
    const inPending = pendingMessageIds.has(messageId)
    const inSent = sentMessageIds.has(messageId)

    if (inPending || inSent) {
      frontendLogger.debug(`[MessageHandlers] Message ${messageId} found in:`, {
        pending: inPending,
        sent: inSent
      })
      return true
    }

    // Phase 2: 額外檢查 - 根據 messageId 查找是否是某個 correlation 的 realId
    for (const [corrId, realId] of correlationToRealId.entries()) {
      if (realId === messageId) {
        frontendLogger.debug(`[MessageHandlers] Message ${messageId} found via correlation mapping: ${corrId}`)
        return true
      }
    }

    return false
  }

  /**
   * Phase 2: 根據 correlationId 查找 tempId
   * 用於 WebSocket 訊息匹配（Phase 3 後端支援後使用）
   */
  function getTempIdByCorrelationId(correlationId: string): string | undefined {
    const pending = pendingByCorrelationId.get(correlationId)
    return pending?.tempId
  }

  /**
   * Phase 2: 根據 correlationId 查找 realId
   * 用於 WebSocket 訊息匹配（Phase 3 後端支援後使用）
   */
  function getRealIdByCorrelationId(correlationId: string): string | undefined {
    return correlationToRealId.get(correlationId)
  }

  /**
   * 追蹤用戶活動
   */
  function trackUserActivity() {
    lastUserActivity.value = Date.now()
  }

  // ===== 返回接口 =====

  return {
    // Event Handlers
    handleMessageSent,
    handleMessagePending,
    handleUploadProgress,
    handleMessageConfirmed,
    handleMessageFailed,

    // Message Operations
    retryFailedMessage,
    updateOptimisticMessageStatus,

    // Utility
    isSentMessage,
    trackUserActivity,
    lastUserActivity,

    // Phase 2: Correlation ID 相關函數
    getTempIdByCorrelationId,
    getRealIdByCorrelationId,

    // Internal State (for testing)
    pendingMessageIds,
    sentMessageIds,
    // Phase 2: 暴露 correlation 追蹤供測試和調試
    pendingByCorrelationId,
    correlationToRealId
  }
}

export type MessageHandlers = ReturnType<typeof useMessageHandlers>
