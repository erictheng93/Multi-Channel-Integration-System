import { filesApi } from '@/api/files'
import { applyAuthenticatedXhrHeaders } from '@/api/authenticatedFetch'
import { getApiUrl } from '@/config/runtime'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('uploadTransport')

export interface PresignedServiceStatus {
  configured: boolean
  maxFileSize: number
  allowedMimeTypes: string[]
  checkedAt: number
}

interface PresignedUploadResult {
  success: boolean
  fileId?: string
  url?: string
  error?: string
}

interface XhrUploadResponse {
  success: boolean
  data?: {
    fileId: string
    url: string
    filename: string
    mimeType: string
    size: number
  }
  error?: string
}

let presignedServiceStatus: PresignedServiceStatus | null = null
let statusCheckPromise: Promise<PresignedServiceStatus | null> | null = null
const STATUS_CACHE_TTL = 5 * 60 * 1000

export function uploadFileWithXhr(
  formData: globalThis.FormData,
  onProgress?: (_progress: number) => void
): Promise<XhrUploadResponse> {
  return new Promise((resolve) => {
    const xhr = new globalThis.XMLHttpRequest()
    const url = getApiUrl('/api/files/upload')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        onProgress(Math.min(percentComplete, 95))
      }
    }

    xhr.onload = () => {
      onProgress?.(100)

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve({
            success: true,
            data: response.data || response
          })
        } catch {
          resolve({
            success: false,
            error: '解析伺服器響應失敗'
          })
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText)
          resolve({
            success: false,
            error: errorResponse.error || errorResponse.message || `上傳失敗 (${xhr.status})`
          })
        } catch {
          resolve({
            success: false,
            error: `上傳失敗 (${xhr.status})`
          })
        }
      }
    }

    xhr.onerror = () => {
      resolve({
        success: false,
        error: '網路錯誤，請檢查網路連線'
      })
    }

    xhr.ontimeout = () => {
      resolve({
        success: false,
        error: '上傳超時，請稍後重試'
      })
    }

    xhr.open('POST', url, true)
    xhr.timeout = 120000

    applyAuthenticatedXhrHeaders(xhr, 'POST')

    xhr.send(formData)
  })
}

function uploadToR2Direct(
  presignedUrl: string,
  file: globalThis.File,
  onProgress?: (_progress: number) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new globalThis.XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        onProgress(percentComplete)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        frontendLogger.debug('[uploadToR2Direct] Upload successful')
        resolve(true)
      } else {
        console.error('[uploadToR2Direct] Upload failed:', xhr.status, xhr.responseText)
        resolve(false)
      }
    }

    xhr.onerror = () => {
      console.error('[uploadToR2Direct] Network error')
      resolve(false)
    }

    xhr.ontimeout = () => {
      console.error('[uploadToR2Direct] Upload timeout')
      resolve(false)
    }

    xhr.open('PUT', presignedUrl, true)
    xhr.timeout = 300000
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}

export async function uploadWithPresignedUrl(
  file: globalThis.File,
  onProgress?: (_progress: number) => void
): Promise<PresignedUploadResult> {
  try {
    onProgress?.(5)
    frontendLogger.debug('[Presigned] Step 1: Requesting presigned URL...')

    const presignedResponse = await filesApi.generateSignedUrl(file.name, file.type, file.size)

    if (!presignedResponse.success || !presignedResponse.data) {
      return {
        success: false,
        error: presignedResponse.error || '無法獲取上傳 URL'
      }
    }

    const { presignedUrl, fileId, publicUrl } = presignedResponse.data

    onProgress?.(10)
    frontendLogger.debug('[Presigned] Step 2: Uploading directly to R2...')

    const uploadSuccess = await uploadToR2Direct(presignedUrl, file, (progress) => {
      const mappedProgress = 10 + Math.round(progress * 0.8)
      onProgress?.(mappedProgress)
    })

    if (!uploadSuccess) {
      return {
        success: false,
        error: '上傳到儲存空間失敗'
      }
    }

    onProgress?.(95)
    frontendLogger.debug('[Presigned] Step 3: Confirming upload...')

    const confirmResponse = await filesApi.confirmUpload(fileId, file.size)

    if (!confirmResponse.success) {
      return {
        success: false,
        error: confirmResponse.error || '確認上傳失敗'
      }
    }

    onProgress?.(100)
    frontendLogger.debug('[Presigned] Upload completed successfully!')

    return {
      success: true,
      fileId,
      url: publicUrl
    }
  } catch (error) {
    console.error('[Presigned] Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '上傳過程中發生錯誤'
    }
  }
}

export async function checkPresignedUrlServiceStatus(): Promise<PresignedServiceStatus | null> {
  if (presignedServiceStatus && (Date.now() - presignedServiceStatus.checkedAt < STATUS_CACHE_TTL)) {
    frontendLogger.debug('[PresignedStatus] Using cached status:', presignedServiceStatus.configured)
    return presignedServiceStatus
  }

  if (statusCheckPromise) {
    frontendLogger.debug('[PresignedStatus] Waiting for pending status check...')
    return statusCheckPromise
  }

  statusCheckPromise = (async () => {
    try {
      frontendLogger.debug('[PresignedStatus] Fetching service status...')
      const response = await filesApi.getPresignedUrlStatus()

      if (response.success && response.data) {
        presignedServiceStatus = {
          ...response.data,
          checkedAt: Date.now()
        }
        frontendLogger.debug('[PresignedStatus] Service configured:', presignedServiceStatus.configured)
        return presignedServiceStatus
      }
      return null
    } catch (err) {
      console.error('[PresignedStatus] Failed to check service status:', err)
      return null
    } finally {
      statusCheckPromise = null
    }
  })()

  return statusCheckPromise
}

export function clearPresignedStatusCache(): void {
  presignedServiceStatus = null
  statusCheckPromise = null
  frontendLogger.debug('[PresignedStatus] Cache cleared')
}
