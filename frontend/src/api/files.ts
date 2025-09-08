// 檔案相關 API
import { apiClient } from './base'
import type { ApiResponse } from '@/types'

export interface FileUploadResponse {
  fileId: string
  filename: string
  url: string
  publicUrl?: string
  thumbnailUrl?: string
  size: number
  mimeType: string
  platform: string
}

export interface FileMetadata {
  filename: string
  originalFilename?: string
  mimeType: string
  size: number
  extension: string
  encoding?: string
  lastModified?: Date
}

export interface MediaFileInfo {
  id: string
  filename: string
  originalFilename?: string
  mimeType: string
  size: number
  extension: string
  url: string
  publicUrl?: string
  thumbnailUrl?: string
  downloadUrl?: string
  platform: 'line' | 'facebook' | 'system'
  messageId?: string
  conversationId?: string
  uploadedBy?: string
  metadata: FileMetadata
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  expiresAt?: string
}

export interface FileListResponse {
  items: MediaFileInfo[]
  total: number
  page: number
  pageSize: number
}

export interface FileStatsResponse {
  totalFiles: number
  totalSize: number
  averageFileSize: number
  filesByType: Record<string, number>
  filesByPlatform: Record<string, number>
  storageUsage: {
    used: number
    available: number
    percentage: number
  }
  recentActivity: {
    uploaded: number
    downloaded: number
    deleted: number
    period: string
  }
}

export const filesApi = {
  // 上傳檔案
  uploadFile: async (formData: globalThis.FormData): Promise<ApiResponse<FileUploadResponse>> => {
    return apiClient.uploadFile('/files/upload', formData)
  },

  // 上傳多個檔案
  uploadMultipleFiles: async (formData: globalThis.FormData): Promise<ApiResponse<FileUploadResponse[]>> => {
    return apiClient.uploadFile('/files/upload-multiple', formData)
  },

  // 獲取檔案列表
  getFiles: async (page = 1, pageSize = 20, platform?: string): Promise<ApiResponse<FileListResponse>> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    })
    
    if (platform) {
      params.append('platform', platform)
    }
    
    return apiClient.get(`/files?${params.toString()}`)
  },

  // 獲取檔案詳情
  getFileDetails: async (fileId: string): Promise<ApiResponse<MediaFileInfo>> => {
    return apiClient.get(`/files/${fileId}`)
  },

  // 獲取檔案下載URL
  getDownloadUrl: async (fileId: string, expiresIn = 3600): Promise<ApiResponse<{ url: string; expiresAt: string }>> => {
    return apiClient.get(`/files/${fileId}/download-url?expiresIn=${expiresIn}`)
  },

  // 刪除檔案
  deleteFile: async (fileId: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete(`/files/${fileId}`)
  },

  // 批量刪除檔案
  deleteMultipleFiles: async (fileIds: string[]): Promise<ApiResponse<{ successful: string[]; failed: string[] }>> => {
    return apiClient.post('/files/delete-multiple', { fileIds })
  },

  // 獲取檔案統計
  getFileStats: async (period = '30d'): Promise<ApiResponse<FileStatsResponse>> => {
    return apiClient.get(`/files/stats?period=${period}`)
  },

  // 根據對話ID獲取檔案
  getFilesByConversation: async (conversationId: string, page = 1, pageSize = 20): Promise<ApiResponse<FileListResponse>> => {
    return apiClient.get(`/conversations/${conversationId}/files?page=${page}&pageSize=${pageSize}`)
  },

  // 根據訊息ID獲取檔案
  getFilesByMessage: async (messageId: string): Promise<ApiResponse<MediaFileInfo[]>> => {
    return apiClient.get(`/messages/${messageId}/files`)
  },

  // 生成簽名URL（用於直接上傳到R2）
  generateSignedUrl: async (filename: string, contentType: string): Promise<ApiResponse<{ 
    signedUrl: string; 
    fileId: string; 
    expiresAt: string 
  }>> => {
    return apiClient.post('/files/signed-url', { filename, contentType })
  },

  // 確認檔案上傳完成（用於直接上傳到R2後的確認）
  confirmUpload: async (fileId: string, size: number): Promise<ApiResponse<MediaFileInfo>> => {
    return apiClient.post(`/files/${fileId}/confirm`, { size })
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
    const params = new URLSearchParams({
      q: query,
      page: (filters?.page || 1).toString(),
      pageSize: (filters?.pageSize || 20).toString()
    })
    
    if (filters?.platform) {
      params.append('platform', filters.platform)
    }
    if (filters?.type) {
      params.append('type', filters.type)
    }
    if (filters?.dateFrom) {
      params.append('dateFrom', filters.dateFrom)
    }
    if (filters?.dateTo) {
      params.append('dateTo', filters.dateTo)
    }
    
    return apiClient.get(`/files/search?${params.toString()}`)
  }
}

export default filesApi