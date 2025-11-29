// Message Event Handlers Composable
// 訊息事件處理器 composable - 從 ConversationDetail.vue 提取

import { ref, type Ref, type ComputedRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import * as messageApi from '@/api/messages'
import { uploadSingleFile } from '@/api/upload'
import type { Message } from '@/types'

export interface MessageEventOptions {
  conversationId: ComputedRef<string> | Ref<string>
  httpMessages: {
    messages: Ref<Message[]>
    addOptimisticMessage?: (message: Message) => void
    updateMessage?: (id: string, updates: Partial<Message>) => void
  }
}

export interface FileAttachmentData {
  id: string
  name: string
  size: number
  type: string
  url: string
  file?: File
}

export interface MessageSendData {
  content: string
  attachments: unknown[]
  file_attachments?: FileAttachmentData[]
}

export interface MessagePendingData {
  tempId: string
  content: string
  timestamp: string
  status: 'pending'
  attachments?: FileAttachmentData[]
}

export interface MessageConfirmedData {
  tempId: string
  messageId: string
  status: 'sent'
  sentAt: string
  platformMessageId?: string
}

export interface MessageFailedData {
  tempId: string
  error: string
  status: 'failed'
}

export interface UploadProgressData {
  tempId: string
  progress: number
  status: 'sending' | 'uploading'
}

export function useMessageEventHandlers(options: MessageEventOptions) {
  const { conversationId, httpMessages } = options

  const authStore = useAuthStore()
  const { toast } = useToast()

  // State
  const sendingMessage = ref(false)

  // ==================== Helper Functions ====================

  const updateOptimisticMessageStatus = (
    messageId: string,
    newStatus: 'sending' | 'sent' | 'failed'
  ) => {
    const messageList = httpMessages.messages.value
    const message = messageList.find(m => m.id === messageId)
    if (message) {
      message.status = newStatus
      if (newStatus === 'sent') {
        message.deliveryStatus = 'sent'
      } else if (newStatus === 'failed') {
        message.deliveryStatus = 'failed'
      }
    }
  }

  // ==================== Event Handlers ====================

  /**
   * Handle message send request
   */
  const handleMessageSent = async (data: MessageSendData) => {
    if (sendingMessage.value) return

    sendingMessage.value = true
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const currentUser = authStore.user

    try {
      const hasFileAttachments = data.file_attachments && data.file_attachments.length > 0

      // Create optimistic message
      const optimisticMessage: Message = {
        id: tempId,
        conversationId: conversationId.value,
        content: data.content,
        senderType: 'agent',
        senderId: currentUser?.id?.toString() || '',
        senderName: currentUser?.displayName || currentUser?.username || 'Agent',
        createdAt: Date.now(),
        timestamp: Date.now(),
        mediaType: 'text',
        platform: 'line',
        status: 'sending',
        deliveryStatus: 'pending',
        metadata: {
          isOptimistic: true,
          tempId,
          retryContent: data.content,
          retryAttachments: data.file_attachments || []
        }
      }

      // Add optimistic message to list
      httpMessages.messages.value.push(optimisticMessage)

      // Handle file uploads if needed
      let uploadedAttachments: string[] = []
      if (hasFileAttachments && data.file_attachments) {
        const totalFiles = data.file_attachments.length
        let completedFiles = 0

        for (const attachment of data.file_attachments) {
          if (attachment.file) {
            const result = await uploadSingleFile(attachment.file, {}, (progress) => {
              const overallProgress = Math.round(
                ((completedFiles + progress / 100) / totalFiles) * 100
              )
              handleUploadProgress({
                tempId,
                progress: overallProgress,
                status: 'uploading'
              })
            })

            if (result.success && result.data?.url) {
              uploadedAttachments.push(result.data.url)
            }
            completedFiles++
          }
        }
      }

      // Send message to server
      const response = await messageApi.send(conversationId.value, {
        content: data.content,
        messageType: 'text',
        senderId: currentUser?.id?.toString() || '',
        attachmentUrls: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
      })

      if (response.success && response.data) {
        handleMessageConfirmed({
          tempId,
          messageId: response.data.id,
          status: 'sent',
          sentAt: new Date().toISOString(),
          platformMessageId: response.data.platformMessageId
        })
      } else {
        handleMessageFailed({
          tempId,
          error: response.error || 'Failed to send message',
          status: 'failed'
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      handleMessageFailed({
        tempId,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed'
      })
    } finally {
      sendingMessage.value = false
    }
  }

  /**
   * Handle pending message state
   */
  const handleMessagePending = (data: MessagePendingData) => {
    const messageList = httpMessages.messages.value
    const message = messageList.find(m => m.id === data.tempId)

    if (message) {
      message.status = 'pending'
      message.deliveryStatus = 'pending'
    }
  }

  /**
   * Handle upload progress
   */
  const handleUploadProgress = (data: UploadProgressData) => {
    const messageList = httpMessages.messages.value
    const message = messageList.find(m => m.id === data.tempId)

    if (message) {
      const deliveryStatus = data.status === 'sending' ? 'sending' : 'pending'
      message.deliveryStatus = deliveryStatus

      if (message.metadata && typeof message.metadata === 'object') {
        const meta = message.metadata as Record<string, unknown>
        meta.uploadProgress = data.progress
      }
    }
  }

  /**
   * Handle message confirmed by server
   */
  const handleMessageConfirmed = (data: MessageConfirmedData) => {
    const messageList = httpMessages.messages.value
    const message = messageList.find(m => m.id === data.tempId)

    if (message) {
      // Update message with server data
      message.id = data.messageId
      message.status = 'sent'
      message.deliveryStatus = 'sent'
      message.sentAt = data.sentAt
      message.platformMessageId = data.platformMessageId || undefined

      // Clean up optimistic metadata
      if (message.metadata && typeof message.metadata === 'object') {
        const meta = message.metadata as Record<string, unknown>
        delete meta.isOptimistic
        delete meta.tempId
        delete meta.retryContent
        delete meta.retryAttachments
        delete meta.uploadProgress
      }
    }
  }

  /**
   * Handle message send failure
   */
  const handleMessageFailed = (data: MessageFailedData) => {
    const messageList = httpMessages.messages.value
    const message = messageList.find(m => m.id === data.tempId)

    if (message) {
      message.status = 'failed'
      message.deliveryStatus = 'failed'

      if (message.metadata && typeof message.metadata === 'object') {
        const meta = message.metadata as Record<string, unknown>
        meta.error = data.error
        meta.failedAt = new Date().toISOString()
      }
    }

    toast.error(`發送失敗: ${data.error}`)
  }

  /**
   * Retry failed message
   */
  const retryFailedMessage = async (messageId: string) => {
    const messageList = httpMessages.messages.value
    const failedMessage = messageList.find(
      m => m.id === messageId && m.status === 'failed'
    )

    if (!failedMessage) {
      console.warn('Failed message not found:', messageId)
      return
    }

    // Get retry content from metadata
    const meta = failedMessage.metadata as Record<string, unknown> | undefined
    const retryContent = (meta?.retryContent as string) || failedMessage.content
    const retryAttachments = (meta?.retryAttachments as FileAttachmentData[]) || []

    // Remove failed message
    const index = messageList.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messageList.splice(index, 1)
    }

    // Resend
    await handleMessageSent({
      content: retryContent,
      attachments: [],
      file_attachments: retryAttachments
    })
  }

  /**
   * Refresh messages from server
   */
  const handleRefreshMessages = async (fetchMessages: () => Promise<void>) => {
    try {
      await fetchMessages()
      toast.success('訊息已刷新')
    } catch (error) {
      console.error('Failed to refresh messages:', error)
      toast.error('刷新訊息失敗')
    }
  }

  return {
    // State
    sendingMessage,

    // Event Handlers
    handleMessageSent,
    handleMessagePending,
    handleUploadProgress,
    handleMessageConfirmed,
    handleMessageFailed,
    retryFailedMessage,
    handleRefreshMessages,

    // Helpers
    updateOptimisticMessageStatus
  }
}
