// 檔案相關 API
import {
  fileContracts,
  type FileListResponse,
  type FileStatsResponse,
  type FileUploadResponse,
  type MediaFileInfo
} from '@shared/api-contracts'
import { callApiContract } from './contract-client'
import type { ApiResponse } from '@/types'

export type {
  FileListResponse,
  FileMetadata,
  FileStatsResponse,
  FileUploadResponse,
  MediaFileInfo
} from '@shared/api-contracts'

export const filesApi = {
  // 上傳檔案
  uploadFile: async (formData: globalThis.FormData): Promise<ApiResponse<FileUploadResponse>> => {
    return callApiContract(fileContracts.uploadFile, {}, formData)
  },

  // 上傳多個檔案
  uploadMultipleFiles: async (formData: globalThis.FormData): Promise<ApiResponse<FileUploadResponse[]>> => {
    return callApiContract(fileContracts.uploadMultipleFiles, {}, formData)
  },

  // 獲取檔案列表
  getFiles: async (page = 1, pageSize = 20, platform?: string): Promise<ApiResponse<FileListResponse>> => {
    return callApiContract(fileContracts.list, { page, pageSize, platform })
  },

  // 獲取檔案詳情
  getFileDetails: async (fileId: string): Promise<ApiResponse<MediaFileInfo>> => {
    return callApiContract(fileContracts.getDetails, { fileId })
  },

  // 獲取檔案下載URL
  getDownloadUrl: async (fileId: string, expiresIn = 3600): Promise<ApiResponse<{ url: string; expiresAt: string }>> => {
    return callApiContract(fileContracts.getDownloadUrl, { fileId, expiresIn })
  },

  // 刪除檔案
  deleteFile: async (fileId: string): Promise<ApiResponse<{ success: boolean }>> => {
    return callApiContract(fileContracts.delete, { fileId })
  },

  // 批量刪除檔案
  deleteMultipleFiles: async (fileIds: string[]): Promise<ApiResponse<{ successful: string[]; failed: string[] }>> => {
    return callApiContract(fileContracts.deleteMultiple, {}, { fileIds })
  },

  // 獲取檔案統計
  getFileStats: async (period = '30d'): Promise<ApiResponse<FileStatsResponse>> => {
    return callApiContract(fileContracts.stats, { period })
  },

  // 根據對話ID獲取檔案
  getFilesByConversation: async (conversationId: string, page = 1, pageSize = 20): Promise<ApiResponse<FileListResponse>> => {
    return callApiContract(fileContracts.byConversation, { conversationId, page, pageSize })
  },

  // 根據訊息ID獲取檔案
  getFilesByMessage: async (messageId: string): Promise<ApiResponse<MediaFileInfo[]>> => {
    return callApiContract(fileContracts.byMessage, { messageId })
  },

  // 生成簽名URL（用於直接上傳到R2）
  generateSignedUrl: async (filename: string, contentType: string, size?: number): Promise<ApiResponse<{
    presignedUrl: string;
    signedUrl?: string; // Alias for presignedUrl
    fileId: string;
    publicUrl: string;
    expiresAt: string
    }>> => {
    // 如果沒有提供 size，使用估計值（1MB），後端會在確認時驗證實際大小
    const estimatedSize = size || 1024 * 1024
    return callApiContract(fileContracts.generateSignedUrl, {}, {
      filename,
      mimeType: contentType,
      size: estimatedSize
    })
  },

  // 確認檔案上傳完成（用於直接上傳到R2後的確認）
  confirmUpload: async (fileId: string, size: number): Promise<ApiResponse<MediaFileInfo>> => {
    return callApiContract(fileContracts.confirmUpload, { fileId }, { size })
  },

  // 搜索檔案
  searchFiles: async (query: string, filters?: {
    platform?: string
    type?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    pageSize?: number
  }): Promise<ApiResponse<FileListResponse>> => {
    return callApiContract(fileContracts.search, { query, filters })
  },

  // 檢查 Presigned URL 服務狀態
  getPresignedUrlStatus: async (): Promise<ApiResponse<{
    configured: boolean
    maxFileSize: number
    allowedMimeTypes: string[]
  }>> => {
    return callApiContract(fileContracts.presignedUrlStatus, {})
  }
}

export default filesApi
