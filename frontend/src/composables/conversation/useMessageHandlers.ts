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

// ===== 類型定義 =====

export interface MessagePendingData {
  tempId: string
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
  progress: number
  status: 'uploading' | 'sending'
}

export interface MessageConfirmedData {
  tempId: string
  realId: string
  file_attachments?: FileAttachmentData[]
}

export interface MessageFailedData {
  tempId: string
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
   * 🔧 FIX: 雙重 ID 標記機制 - 解決消息確認與 WebSocket 廣播的競態條件
   * pendingMessageIds: 追蹤正在發送的臨時訊息 ID (tempId)
   * sentMessageIds: 追蹤已確認的真實訊息 ID (realId)
   * 這樣即使 WebSocket 廣播先於 HTTP 響應到達，也能正確跳過重複消息
   */
  const pendingMessageIds = new Set<string>()  // 🔧 新增：臨時 ID 集合
  const sentMessageIds = new Set<string>()

  /**
   * 追蹤用戶活動時間（用於輪詢優化）
   */
  const lastUserActivity = ref(Date.now())

  // ===== 核心消息處理器 =====

  /**
   * 處理消息發送（向後兼容事件，主要用於日誌）
   */
  function handleMessageSent(data: MessageSentData) {
    console.log('📤 [MessageHandlers] handleMessageSent called (backward compatibility event)')
    trackUserActivity()

    if (!data.content?.trim() && (!data.file_attachments || data.file_attachments.length === 0)) {
      console.warn('❌ [MessageHandlers] Empty message content and no attachments, skipping')
      return
    }

    console.log('✅ [MessageHandlers] handleMessageSent completed - message already in UI via handleMessagePending')
  }

  /**
   * 處理消息開始發送（樂觀更新）
   */
  function handleMessagePending(data: MessagePendingData) {
    console.log('⚡ [MessageHandlers] Message pending - showing immediately:', data.tempId)
    trackUserActivity()

    // 🔧 FIX: 立即標記 tempId，防止 WebSocket 廣播重複
    pendingMessageIds.add(data.tempId)
    console.log(`📝 [MessageHandlers] Added to pendingMessageIds: ${data.tempId}`)

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

    console.log('✅ [MessageHandlers] Optimistic message added to UI')
  }

  /**
   * 處理上傳進度更新
   */
  function handleUploadProgress(data: UploadProgressData) {
    console.log(`⚡ [MessageHandlers] Upload progress: ${data.progress}% - ${data.status}`)

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
   */
  function handleMessageConfirmed(data: MessageConfirmedData) {
    console.log('✅ [MessageHandlers] Message confirmed:', data.tempId, '->', data.realId)

    // 🔧 FIX: 轉移標記從 tempId 到 realId
    pendingMessageIds.delete(data.tempId)
    sentMessageIds.add(data.realId)
    console.log(`📝 [MessageHandlers] Transferred: ${data.tempId} → ${data.realId}`)
    console.log(`📝 [MessageHandlers] pendingIds: ${pendingMessageIds.size}, sentIds: ${sentMessageIds.size}`)

    // 定時清理（5分鐘後移除）
    setTimeout(
      () => {
        sentMessageIds.delete(data.realId)
        console.log(`🧹 [MessageHandlers] Cleaned up sentMessageIds: ${data.realId}`)
      },
      5 * 60 * 1000
    )

    const messageList = state.httpMessages.messages.value
    const message = messageList.find(m => m.id === data.tempId)

    if (message) {
      // 更新訊息 ID 從 tempId 到 realId
      message.id = data.realId
      console.log(`📝 [MessageHandlers] Updated message ID: ${data.tempId} -> ${data.realId}`)

      // 更新訊息狀態為已發送
      message.status = 'sent' as const
      message.deliveryStatus = 'sent' as const

      // 如果有真實的檔案附件資料，更新它
      if (data.file_attachments && data.file_attachments.length > 0) {
        // eslint-disable-next-line camelcase
        message.file_attachments = data.file_attachments
      }

      // 清理臨時資料
      if (message.metadata && typeof message.metadata === 'object') {
        delete (message.metadata as Record<string, unknown>).uploadProgress
        delete (message.metadata as Record<string, unknown>).pendingAttachments
      }

      console.log('✅ [MessageHandlers] Message status updated to sent with realId')
    }
  }

  /**
   * 處理消息發送失敗
   */
  function handleMessageFailed(data: MessageFailedData) {
    console.error('❌ [MessageHandlers] Message failed:', data.tempId, '-', data.error)

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

      console.log('❌ [MessageHandlers] Failed message stored with retry data:', {
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
      console.log(`⚡ [MessageHandlers] Updated message ${messageId} status to: ${newStatus}`)
    }
  }

  /**
   * 重試失敗的消息（支持附件重新上傳）
   */
  async function retryFailedMessage(messageId: string) {
    const messageList = state.httpMessages.messages.value
    const failedMessage = messageList.find(m => m.id === messageId && m.status === 'failed')

    if (!failedMessage) {
      console.warn('⚠️ [MessageHandlers] Failed message not found:', messageId)
      return
    }

    console.log('🔄 [MessageHandlers] Retrying failed message:', messageId)

    // 從 metadata 獲取重試資料
    const meta = failedMessage.metadata as Record<string, unknown> | undefined
    const retryContent = (meta?.retryContent as string) || failedMessage.content
    const retryAttachments = (meta?.retryAttachments as RetryAttachment[]) || []
    const hasAttachments = retryAttachments.length > 0

    console.log('🔄 [MessageHandlers] Retry data:', {
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
        console.log('🔄 [MessageHandlers] Re-uploading attachments...')
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
              console.log(`✅ [MessageHandlers] Attachment uploaded: ${attachment.name}`)
            } else {
              throw new Error(result.error || '上傳失敗')
            }
          } catch (uploadError) {
            console.error('❌ [MessageHandlers] Attachment re-upload failed:', uploadError)
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
        console.log('✅ [MessageHandlers] Retry successful')
        showSuccess('訊息重試發送成功')
      } else {
        updateOptimisticMessageStatus(messageId, 'failed')
        if (meta) {
          meta.error = '重試發送失敗'
        }
        console.error('❌ [MessageHandlers] Retry send failed')
        showError('訊息重試發送失敗，請再試一次')
      }
    } catch (error) {
      updateOptimisticMessageStatus(messageId, 'failed')
      console.error('❌ [MessageHandlers] Exception during retry:', error)
      showError('重試時發生錯誤，請稍後再試')
    }
  }

  /**
   * 🔧 FIX: 檢查消息 ID 是否已發送（雙重檢查）
   * 檢查 tempId 和 realId 兩個集合，確保完整的競態條件保護
   */
  function isSentMessage(messageId: string): boolean {
    const inPending = pendingMessageIds.has(messageId)
    const inSent = sentMessageIds.has(messageId)

    if (inPending || inSent) {
      console.log(`📝 [MessageHandlers] Message ${messageId} found in:`, {
        pending: inPending,
        sent: inSent
      })
    }

    return inPending || inSent
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

    // Internal State (for testing)
    pendingMessageIds,  // 🔧 新增：暴露供測試
    sentMessageIds
  }
}

export type MessageHandlers = ReturnType<typeof useMessageHandlers>
