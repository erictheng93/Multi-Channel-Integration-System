import type { Ref } from 'vue'
import type { MessageInputAttachment, UploadResult } from '@/types/message-input'
import { getApiUrl } from '@/config/runtime'

/**
 * XHR-based file upload with real-time progress tracking.
 *
 * This is intentionally separate from the global `useFileUpload.ts` composable
 * because it uses XHR `upload.onprogress` for per-byte progress updates,
 * whereas the global composable uses presigned URLs with a different strategy.
 */
export function useFileUploadProgress(conversationId: Ref<string>) {
  /**
   * Upload a single attachment via XHR with progress callback.
   * Endpoint: POST /api/conversations/:id/attachments
   */
  const uploadAttachmentWithProgress = async (
    attachment: MessageInputAttachment,
    onProgress: (_progress: number) => void,
  ): Promise<UploadResult> => {
    return new Promise((resolve) => {
      const xhr = new globalThis.XMLHttpRequest()

      const url = getApiUrl(`/api/conversations/${conversationId.value}/attachments`)
      const token = localStorage.getItem('token') || localStorage.getItem('authToken')

      // Real-time upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          onProgress(Math.min(percentComplete, 95)) // Reserve 5% for server processing
        }
      }

      xhr.onload = () => {
        onProgress(100)

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve({
              success: true,
              data: {
                attachmentId: response.data?.attachmentId || response.attachmentId,
                filename: response.data?.filename || attachment.name,
                url: response.data?.url || '',
              },
            })
          } catch {
            resolve({ success: false, error: '解析伺服器響應失敗' })
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            resolve({ success: false, error: errorResponse.error || `上傳失敗 (${xhr.status})` })
          } catch {
            resolve({ success: false, error: `上傳失敗 (${xhr.status})` })
          }
        }
      }

      xhr.onerror = () => {
        resolve({ success: false, error: '網路錯誤，請檢查網路連線' })
      }

      xhr.ontimeout = () => {
        resolve({ success: false, error: '上傳超時，請稍後重試' })
      }

      xhr.open('POST', url, true)
      xhr.timeout = 120000 // 2-minute timeout

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.setRequestHeader('X-Session-Id', token)
      }

      const formData = new globalThis.FormData()
      formData.append('file', attachment.file)
      formData.append('messageType', attachment.isImage ? 'image' : 'file')

      xhr.send(formData)
    })
  }

  return {
    uploadAttachmentWithProgress,
  }
}
