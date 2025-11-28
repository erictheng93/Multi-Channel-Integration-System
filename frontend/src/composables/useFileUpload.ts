// 檔案上傳管理 Composable
import { ref, computed } from 'vue'
import { filesApi } from '@/api/files'
import { useError } from './useError'
import type { MediaFileInfo, FileStatsResponse } from '@/api/files'

// ═══════════════════════════════════════════════════════════════════════════
// API URL Helper - 開發環境使用相對路徑 (通過 Vite Proxy)，生產環境使用絕對路徑
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 獲取 API URL
 * - 開發環境 (localhost): 使用相對路徑，通過 Vite Proxy 避免 CORS 問題
 * - 生產環境: 使用絕對路徑直接連接後端
 *
 * @param endpoint - API 端點 (例如 '/api/files/upload')
 * @returns 完整的 URL 或相對路徑
 */
function getApiUrl(endpoint: string): string {
  const isDev = import.meta.env.DEV

  if (isDev) {
    // 開發環境: 使用相對路徑，讓 Vite Proxy 處理
    console.log(`[API URL] Dev mode - using relative path: ${endpoint}`)
    return endpoint
  } else {
    // 生產環境: 使用絕對路徑
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com'
    const fullUrl = `${baseUrl}${endpoint}`
    console.log(`[API URL] Production mode - using absolute URL: ${fullUrl}`)
    return fullUrl
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Presigned URL Upload Types
// ═══════════════════════════════════════════════════════════════════════════

interface PresignedUploadResult {
  success: boolean
  fileId?: string
  url?: string
  error?: string
}

// XHR 上傳響應類型
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

/**
 * 使用 XMLHttpRequest 上傳檔案，支援真實進度追蹤
 * @param formData - 包含檔案的 FormData
 * @param onProgress - 進度回調 (0-100)
 * @returns Promise<XhrUploadResponse>
 */
function uploadFileWithXhr(
  formData: globalThis.FormData,
  onProgress?: (_progress: number) => void
): Promise<XhrUploadResponse> {
  return new Promise((resolve) => {
    const xhr = new globalThis.XMLHttpRequest()

    // 獲取 API URL - 開發環境使用相對路徑 (Vite Proxy)，生產環境使用絕對路徑
    const url = getApiUrl('/api/files/upload')

    // 獲取認證 token
    const token = localStorage.getItem('authToken')

    // 真實上傳進度追蹤
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        // 保留最後 5% 給伺服器處理時間
        onProgress(Math.min(percentComplete, 95))
      }
    }

    // 上傳完成
    xhr.onload = () => {
      if (onProgress) {
        onProgress(100)
      }

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

    // 網路錯誤
    xhr.onerror = () => {
      resolve({
        success: false,
        error: '網路錯誤，請檢查網路連線'
      })
    }

    // 上傳超時
    xhr.ontimeout = () => {
      resolve({
        success: false,
        error: '上傳超時，請稍後重試'
      })
    }

    // 配置請求
    xhr.open('POST', url, true)
    xhr.timeout = 120000 // 2 分鐘超時

    // 設置認證頭
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    // 發送請求 (不要設置 Content-Type，讓瀏覽器自動設置 multipart/form-data)
    xhr.send(formData)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 Presigned URL Direct Upload to R2
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 直接上傳檔案到 R2 (使用 Presigned URL)
 * @param presignedUrl - 從後端獲取的 presigned URL
 * @param file - 要上傳的檔案
 * @param onProgress - 進度回調 (0-100)
 * @returns Promise<boolean> - 上傳是否成功
 */
function uploadToR2Direct(
  presignedUrl: string,
  file: globalThis.File,
  onProgress?: (_progress: number) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new globalThis.XMLHttpRequest()

    // 進度追蹤
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        onProgress(percentComplete)
      }
    }

    // 上傳完成
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('[uploadToR2Direct] Upload successful')
        resolve(true)
      } else {
        console.error('[uploadToR2Direct] Upload failed:', xhr.status, xhr.responseText)
        resolve(false)
      }
    }

    // 錯誤處理
    xhr.onerror = () => {
      console.error('[uploadToR2Direct] Network error')
      resolve(false)
    }

    xhr.ontimeout = () => {
      console.error('[uploadToR2Direct] Upload timeout')
      resolve(false)
    }

    // 配置請求 - PUT 到 presigned URL
    xhr.open('PUT', presignedUrl, true)
    xhr.timeout = 300000 // 5 分鐘超時
    xhr.setRequestHeader('Content-Type', file.type)

    // 發送檔案二進制數據
    xhr.send(file)
  })
}

/**
 * 使用 Presigned URL 完整上傳流程
 * 1. 獲取 presigned URL
 * 2. 直接上傳到 R2
 * 3. 確認上傳完成
 */
async function uploadWithPresignedUrl(
  file: globalThis.File,
  _options?: { conversationId?: string; messageId?: string },
  onProgress?: (_progress: number) => void
): Promise<PresignedUploadResult> {
  try {
    // Step 1: 獲取 presigned URL (5%)
    onProgress?.(5)
    console.log('[Presigned] Step 1: Requesting presigned URL...')

    const presignedResponse = await filesApi.generateSignedUrl(file.name, file.type, file.size)

    if (!presignedResponse.success || !presignedResponse.data) {
      return {
        success: false,
        error: presignedResponse.error || '無法獲取上傳 URL'
      }
    }

    const { presignedUrl, fileId, publicUrl } = presignedResponse.data

    // Step 2: 直接上傳到 R2 (10% - 90%)
    onProgress?.(10)
    console.log('[Presigned] Step 2: Uploading directly to R2...')

    const uploadSuccess = await uploadToR2Direct(
      presignedUrl,
      file,
      (progress) => {
        // 將上傳進度映射到 10% - 90%
        const mappedProgress = 10 + Math.round(progress * 0.8)
        onProgress?.(mappedProgress)
      }
    )

    if (!uploadSuccess) {
      return {
        success: false,
        error: '上傳到儲存空間失敗'
      }
    }

    // Step 3: 確認上傳 (95%)
    onProgress?.(95)
    console.log('[Presigned] Step 3: Confirming upload...')

    const confirmResponse = await filesApi.confirmUpload(fileId, file.size)

    if (!confirmResponse.success) {
      return {
        success: false,
        error: confirmResponse.error || '確認上傳失敗'
      }
    }

    // 完成 (100%)
    onProgress?.(100)
    console.log('[Presigned] Upload completed successfully!')

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

export interface UploadOptions {
  generateThumbnail?: boolean
  compress?: boolean
  maxSize?: number
  allowedTypes?: string[]
}

export interface UploadResult {
  fileName: string
  success: boolean
  url?: string
  fileId?: string
  error?: string
}

export function useFileUpload() {
  const { error, handleError, clearError } = useError()

  const uploading = ref(false)
  const uploadProgress = ref(0)
  const files = ref<MediaFileInfo[]>([])
  const currentPage = ref(1)
  const pageSize = ref(20)
  const totalCount = ref(0)
  const fileStats = ref<FileStatsResponse | null>(null)

  const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

  // 默認上傳選項
  const defaultOptions: UploadOptions = {
    generateThumbnail: true,
    compress: false,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  }

  // 驗證檔案
  const validateFile = (file: globalThis.File, options: UploadOptions = defaultOptions): string | null => {
    // 檢查檔案類型
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return '不支援的檔案格式'
    }
    
    // 檢查檔案大小
    if (options.maxSize && file.size > options.maxSize) {
      return `檔案過大，最大限制 ${formatFileSize(options.maxSize)}`
    }
    
    // 檢查檔案名
    if (file.name.length > 255) {
      return '檔案名過長'
    }
    
    return null
  }

  // 單檔案上傳
  const uploadSingleFile = async (
    file: globalThis.File,
    options: UploadOptions = {},
    onProgress?: (_progress: number) => void
  ): Promise<UploadResult> => {
    const mergedOptions = { ...defaultOptions, ...options }
    
    // 驗證檔案
    const validationError = validateFile(file, mergedOptions)
    if (validationError) {
      return {
        fileName: file.name,
        success: false,
        error: validationError
      }
    }

    try {
      const formData = new globalThis.FormData()
      formData.append('file', file)
      formData.append('generateThumbnail', String(mergedOptions.generateThumbnail))
      formData.append('compress', String(mergedOptions.compress))

      // 使用 XHR 上傳，提供真實進度追蹤
      const response = await uploadFileWithXhr(formData, (progress) => {
        uploadProgress.value = progress
        if (onProgress) {
          onProgress(progress)
        }
      })

      if (response.success) {
        return {
          fileName: file.name,
          success: true,
          url: response.data?.url || '',
          fileId: response.data?.fileId || ''
        }
      } else {
        return {
          fileName: file.name,
          success: false,
          error: response.error || '上傳失敗'
        }
      }
    } catch (err) {
      return {
        fileName: file.name,
        success: false,
        error: err instanceof Error ? err.message : '上傳過程中發生錯誤'
      }
    }
  }

  // 多檔案上傳
  const uploadMultipleFiles = async (
    fileList: globalThis.File[],
    options: UploadOptions = {},
    onProgress?: (_progress: number) => void
  ): Promise<UploadResult[]> => {
    uploading.value = true
    uploadProgress.value = 0
    clearError()

    const results: UploadResult[] = []
    let completedCount = 0

    try {
      // 並行上傳檔案
      const uploadPromises = fileList.map(async (file) => {
        const result = await uploadSingleFile(file, options, (fileProgress) => {
          // 計算總體進度
          const totalProgress = Math.round(
            (completedCount + fileProgress / 100) / fileList.length * 100
          )
          uploadProgress.value = totalProgress
          if (onProgress) {
            onProgress(totalProgress)
          }
        })
        
        completedCount++
        return result
      })

      const uploadResults = await Promise.all(uploadPromises)
      results.push(...uploadResults)

      // 刷新檔案列表
      await loadFiles()

      return results
    } catch (err) {
      handleError(err)
      return results
    } finally {
      uploading.value = false
      uploadProgress.value = 100
    }
  }

  // 載入檔案列表
  const loadFiles = async (page = 1, platform?: string): Promise<void> => {
    clearError()

    try {
      const response = await filesApi.getFiles(page, pageSize.value, platform)

      if (response.success && response.data) {
        files.value = response.data.items || []
        totalCount.value = response.data.total || 0
        currentPage.value = page
      } else {
        handleError(new Error(response.error || '載入檔案列表失敗'))
      }
    } catch (err) {
      handleError(err)
    }
  }

  // 刷新檔案列表
  const refreshFiles = () => {
    return loadFiles(currentPage.value)
  }

  // 切換頁面
  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      return loadFiles(page)
    }
    return Promise.resolve()
  }

  // 刪除檔案
  const deleteFile = async (fileId: string): Promise<boolean> => {
    try {
      const response = await filesApi.deleteFile(fileId)

      if (response.success) {
        // 從列表中移除已刪除的檔案
        files.value = files.value.filter(file => file.id !== fileId)
        totalCount.value = Math.max(0, totalCount.value - 1)
        return true
      } else {
        handleError(new Error(response.error || '刪除失敗'))
        return false
      }
    } catch (err) {
      handleError(err)
      return false
    }
  }

  // 批量刪除檔案
  const deleteMultipleFiles = async (fileIds: string[]): Promise<{ successful: string[]; failed: string[] }> => {
    try {
      const response = await filesApi.deleteMultipleFiles(fileIds)

      if (response.success && response.data) {
        // 從列表中移除已刪除的檔案
        const data = response.data
        files.value = files.value.filter(file => !data.successful.includes(file.id))
        totalCount.value = Math.max(0, totalCount.value - data.successful.length)
        return data
      } else {
        handleError(new Error(response.error || '批量刪除失敗'))
        return { successful: [], failed: fileIds }
      }
    } catch (err) {
      handleError(err)
      return { successful: [], failed: fileIds }
    }
  }

  // 獲取檔案統計
  const loadFileStats = async (period = '30d'): Promise<void> => {
    try {
      const response = await filesApi.getFileStats(period)

      if (response.success) {
        fileStats.value = response.data || null
      } else {
        handleError(new Error(response.error || '載入統計失敗'))
      }
    } catch (err) {
      handleError(err)
    }
  }

  // 獲取下載URL
  const getDownloadUrl = async (fileId: string, expiresIn = 3600): Promise<string | null> => {
    try {
      const response = await filesApi.getDownloadUrl(fileId, expiresIn)
      return response.success ? (response.data?.url || null) : null
    } catch (err) {
      console.error('Get download URL failed:', err)
      return null
    }
  }

  // 搜索檔案
  const searchFiles = async (query: string, filters?: {
    platform?: string
    type?: string
    dateFrom?: string
    dateTo?: string
  }): Promise<void> => {
    clearError()

    try {
      const response = await filesApi.searchFiles(query, {
        ...filters,
        page: 1,
        pageSize: pageSize.value
      })

      if (response.success && response.data) {
        files.value = response.data.items || []
        totalCount.value = response.data.total || 0
        currentPage.value = 1
      } else {
        handleError(new Error(response.error || '搜索失敗'))
      }
    } catch (err) {
      handleError(err)
    }
  }

  // 工具方法
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {return '0 B'}
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100  } ${  sizes[i]}`
  }

  const isImageFile = (file: globalThis.File | MediaFileInfo): boolean => {
    const mimeType = 'type' in file ? file.type : file.mimeType
    return mimeType.startsWith('image/')
  }

  const isVideoFile = (file: globalThis.File | MediaFileInfo): boolean => {
    const mimeType = 'type' in file ? file.type : file.mimeType
    return mimeType.startsWith('video/')
  }

  const isAudioFile = (file: globalThis.File | MediaFileInfo): boolean => {
    const mimeType = 'type' in file ? file.type : file.mimeType
    return mimeType.startsWith('audio/')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 Presigned URL Upload Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 使用 Presigned URL 上傳單個檔案
   * 直接上傳到 R2，繞過 Worker
   */
  const uploadSingleFilePresigned = async (
    file: globalThis.File,
    options: UploadOptions = {},
    onProgress?: (_progress: number) => void
  ): Promise<UploadResult> => {
    const mergedOptions = { ...defaultOptions, ...options }

    // 驗證檔案
    const validationError = validateFile(file, mergedOptions)
    if (validationError) {
      return {
        fileName: file.name,
        success: false,
        error: validationError
      }
    }

    const result = await uploadWithPresignedUrl(file, undefined, (progress) => {
      uploadProgress.value = progress
      onProgress?.(progress)
    })

    return {
      fileName: file.name,
      success: result.success,
      url: result.url,
      fileId: result.fileId,
      error: result.error
    }
  }

  /**
   * 使用 Presigned URL 並行上傳多個檔案
   */
  const uploadMultipleFilesPresigned = async (
    fileList: globalThis.File[],
    options: UploadOptions = {},
    onProgress?: (_progress: number) => void
  ): Promise<UploadResult[]> => {
    uploading.value = true
    uploadProgress.value = 0
    clearError()

    const results: UploadResult[] = []
    let completedCount = 0

    try {
      // 並行上傳檔案
      const uploadPromises = fileList.map(async (file) => {
        const result = await uploadSingleFilePresigned(file, options, (fileProgress) => {
          // 計算總體進度
          const totalProgress = Math.round(
            (completedCount + fileProgress / 100) / fileList.length * 100
          )
          uploadProgress.value = totalProgress
          onProgress?.(totalProgress)
        })

        completedCount++
        return result
      })

      const uploadResults = await Promise.all(uploadPromises)
      results.push(...uploadResults)

      // 刷新檔案列表
      await loadFiles()

      return results
    } catch (err) {
      handleError(err)
      return results
    } finally {
      uploading.value = false
      uploadProgress.value = 100
    }
  }

  /**
   * 檢查 Presigned URL 服務狀態
   */
  const checkPresignedUrlServiceStatus = async (): Promise<{
    configured: boolean
    maxFileSize: number
    allowedMimeTypes: string[]
  } | null> => {
    try {
      // 獲取 API URL - 開發環境使用相對路徑 (Vite Proxy)，生產環境使用絕對路徑
      const url = getApiUrl('/api/files/presigned-url/status')
      const token = localStorage.getItem('authToken')

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        return data.data
      }
      return null
    } catch (err) {
      console.error('Failed to check presigned URL service status:', err)
      return null
    }
  }

  return {
    // 狀態
    uploading,
    uploadProgress,
    error,
    files,
    currentPage,
    totalPages,
    totalCount,
    fileStats,

    // 傳統上傳方法 (通過 Worker)
    uploadSingleFile,
    uploadMultipleFiles,

    // 🆕 Presigned URL 上傳方法 (直接到 R2)
    uploadSingleFilePresigned,
    uploadMultipleFilesPresigned,
    checkPresignedUrlServiceStatus,

    // 檔案管理方法
    loadFiles,
    refreshFiles,
    changePage,
    deleteFile,
    deleteMultipleFiles,
    loadFileStats,
    getDownloadUrl,
    searchFiles,
    validateFile,
    clearError,

    // 工具方法
    formatFileSize,
    isImageFile,
    isVideoFile,
    isAudioFile
  }
}