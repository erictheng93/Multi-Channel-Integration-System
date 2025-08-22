// 檔案上傳管理 Composable
import { ref, computed } from 'vue'
import { filesApi } from '@/api/files'
import { useError } from './useError'
import type { MediaFileInfo, FileStatsResponse } from '@/api/files'

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
  const validateFile = (file: File, options: UploadOptions = defaultOptions): string | null => {
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
    file: File,
    options: UploadOptions = {},
    onProgress?: (progress: number) => void
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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('generateThumbnail', String(mergedOptions.generateThumbnail))
      formData.append('compress', String(mergedOptions.compress))

      // 模擬進度更新
      if (onProgress) {
        const progressInterval = setInterval(() => {
          uploadProgress.value += Math.random() * 10
          if (uploadProgress.value >= 90) {
            clearInterval(progressInterval)
          }
          onProgress(Math.min(uploadProgress.value, 90))
        }, 200)
      }

      const response = await filesApi.uploadFile(formData)

      if (onProgress) {
        onProgress(100)
      }

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
    fileList: File[],
    options: UploadOptions = {},
    onProgress?: (progress: number) => void
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

  const isImageFile = (file: File | MediaFileInfo): boolean => {
    const mimeType = 'type' in file ? file.type : file.mimeType
    return mimeType.startsWith('image/')
  }

  const isVideoFile = (file: File | MediaFileInfo): boolean => {
    const mimeType = 'type' in file ? file.type : file.mimeType
    return mimeType.startsWith('video/')
  }

  const isAudioFile = (file: File | MediaFileInfo): boolean => {
    const mimeType = 'type' in file ? file.type : file.mimeType
    return mimeType.startsWith('audio/')
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

    // 方法
    uploadSingleFile,
    uploadMultipleFiles,
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