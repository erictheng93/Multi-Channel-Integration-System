import { ref } from 'vue'
import type { MessageInputAttachment, FileAttachmentEmitData, UploadResult } from '@/types/message-input'
import { useAuthStore } from '@/stores/auth'
import { getApiUrl } from '@/config/runtime'

/** Emit function signature expected by useMessageSending. */
export interface MessageSendingEmit {
  (_event: 'message-pending', _data: {
    tempId: string
    correlationId: string
    content: string
    attachments: MessageInputAttachment[]
    status: 'uploading' | 'sending'
    uploadProgress: number
  }): void
  (_event: 'upload-progress', _data: {
    tempId: string
    correlationId: string
    progress: number
    status: 'uploading' | 'sending'
  }): void
  (_event: 'message-confirmed', _data: {
    tempId: string
    correlationId: string
    realId: string
    file_attachments?: FileAttachmentEmitData[]
  }): void
  (_event: 'message-failed', _data: {
    tempId: string
    correlationId?: string
    error: string
    retryData?: {
      content: string
      attachments: MessageInputAttachment[]
    }
  }): void
  (_event: 'message-sent', _data: {
    content: string
    attachments: MessageInputAttachment[]
    file_attachments?: FileAttachmentEmitData[]
  }): void
}

export interface MessageSendingOptions {
  conversationId: () => string
  uploadAttachment: (
    _attachment: MessageInputAttachment,
    _onProgress: (_progress: number) => void,
  ) => Promise<UploadResult>
  emit: MessageSendingEmit
}

/**
 * Orchestrates the full message-sending flow:
 *   1. Generate tempId / correlationId
 *   2. Emit optimistic `message-pending`
 *   3. Upload attachments in parallel with progress
 *   4. POST to /api/customer-conversations/:id/messages
 *   5. Emit `message-confirmed` or `message-failed`
 */
export function useMessageSending(options: MessageSendingOptions) {
  const authStore = useAuthStore()

  const sending = ref(false)
  const uploadingFiles = ref(false)

  /**
   * Send a message (text, attachments, or both).
   * Returns the saved content and attachments so the caller can clear them after.
   */
  const executeSend = async (
    content: string,
    currentAttachments: MessageInputAttachment[],
  ): Promise<void> => {
    const hasAttachments = currentAttachments.length > 0

    // Nothing to send
    if (!content && !hasAttachments) {
      return
    }

    // Generate IDs
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Update state
    if (hasAttachments) {
      uploadingFiles.value = true
    }
    sending.value = true

    // Optimistic emit
    options.emit('message-pending', {
      tempId,
      correlationId,
      content,
      attachments: currentAttachments,
      status: hasAttachments ? 'uploading' : 'sending',
      uploadProgress: 0,
    })

    try {
      const attachmentIds: string[] = []
      const fileAttachmentsData: FileAttachmentEmitData[] = []

      // Parallel file upload
      if (hasAttachments) {
        const totalFiles = currentAttachments.length
        const fileProgresses = new Map<number, number>()

        const updateOverallProgress = () => {
          let totalProgress = 0
          fileProgresses.forEach(p => { totalProgress += p })
          const overallProgress = Math.round(totalProgress / totalFiles)
          options.emit('upload-progress', {
            tempId,
            correlationId,
            progress: Math.min(overallProgress, 99),
            status: 'uploading',
          })
        }

        const uploadPromises = currentAttachments.map((attachment, index) =>
          options.uploadAttachment(
            attachment,
            (fileProgress) => {
              fileProgresses.set(index, fileProgress)
              updateOverallProgress()
            },
          ).then(uploadResponse => {
            if (uploadResponse.success && uploadResponse.data) {
              return {
                success: true as const,
                attachmentId: uploadResponse.data.attachmentId,
                data: {
                  id: uploadResponse.data.attachmentId,
                  filename: uploadResponse.data.filename || attachment.file.name,
                  mimeType: attachment.file.type,
                  fileSize: attachment.file.size,
                  fileUrl: uploadResponse.data.url,
                },
              }
            } else {
              return {
                success: false as const,
                error: uploadResponse.error || 'File upload failed',
                filename: attachment.name,
              }
            }
          }).catch(err => ({
            success: false as const,
            error: err instanceof Error ? err.message : 'Upload failed',
            filename: attachment.name,
          })),
        )

        const uploadResults = await Promise.all(uploadPromises)

        // Check for failures
        const failedUploads = uploadResults.filter(r => !r.success)
        if (failedUploads.length > 0) {
          const failedNames = failedUploads.map(f => 'filename' in f ? f.filename : 'unknown').join(', ')
          console.error('Attachment upload errors:', failedUploads)

          options.emit('message-failed', {
            tempId,
            error: `檔案上傳失敗: ${failedNames}`,
            retryData: { content, attachments: currentAttachments },
          })
          throw new UploadFailedError(`檔案 ${failedNames} 上傳失敗`)
        }

        // Collect successful results
        for (const result of uploadResults) {
          if (result.success && 'attachmentId' in result) {
            attachmentIds.push(result.attachmentId)
            fileAttachmentsData.push(result.data)
          }
        }

        console.log(`🚀 [並行上傳] ${totalFiles} 個文件全部上傳完成`)

        options.emit('upload-progress', {
          tempId,
          correlationId,
          progress: 100,
          status: 'sending',
        })
      }

      // Send message via API
      const token = localStorage.getItem('token') || localStorage.getItem('authToken')
      const sendResponse = await fetch(
        getApiUrl(`/api/customer-conversations/${options.conversationId()}/messages`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            content,
            messageType: hasAttachments ? 'file' : 'text',
            platform: 'line',
            attachmentIds,
            senderId: authStore.currentAgent?.id,
            correlationId,
          }),
        },
      )
      const response = await sendResponse.json()
      const messageData = response.message

      if (response.success && messageData) {
        options.emit('message-confirmed', {
          tempId,
          correlationId,
          realId: messageData.id || tempId,
          file_attachments: fileAttachmentsData,
        })

        // Backward-compatible event
        options.emit('message-sent', {
          content,
          attachments: currentAttachments,
          file_attachments: fileAttachmentsData,
        })
      } else {
        const errorMsg = (response.error as { message?: string })?.message || '發送失敗'
        options.emit('message-failed', {
          tempId,
          correlationId,
          error: errorMsg,
          retryData: { content, attachments: currentAttachments },
        })
        throw new SendFailedError(errorMsg)
      }
    } catch (err) {
      // Re-throw known errors without wrapping
      if (err instanceof UploadFailedError || err instanceof SendFailedError) {
        throw err
      }

      console.error('Send message error:', err)

      let errorMsg = '發送失敗，請重試'
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMsg = '網路連接失敗，請檢查網路後重試'
      } else if (err instanceof Error) {
        errorMsg = `發送失敗：${err.message}`
      }

      options.emit('message-failed', {
        tempId,
        correlationId: `corr-error-${Date.now()}`,
        error: errorMsg,
        retryData: { content, attachments: currentAttachments },
      })
      throw new SendFailedError(errorMsg)
    } finally {
      sending.value = false
      if (hasAttachments) {
        uploadingFiles.value = false
      }
    }
  }

  return {
    sending,
    uploadingFiles,
    executeSend,
  }
}

/** Sentinel error for upload failures (already emitted to parent). */
class UploadFailedError extends Error {
  constructor(message: string) { super(message); this.name = 'UploadFailedError' }
}

/** Sentinel error for send failures (already emitted to parent). */
class SendFailedError extends Error {
  constructor(message: string) { super(message); this.name = 'SendFailedError' }
}
