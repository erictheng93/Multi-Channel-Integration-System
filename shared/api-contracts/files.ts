import { defineApiContract } from './core'

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

export interface GenerateSignedUrlResponse {
  presignedUrl: string
  signedUrl?: string
  fileId: string
  publicUrl: string
  expiresAt: string
}

export interface PresignedUrlStatus {
  configured: boolean
  maxFileSize: number
  allowedMimeTypes: string[]
}

export interface FileSearchFilters {
  platform?: string
  type?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export function buildFileListQuery(page = 1, pageSize = 20, platform?: string): string {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString()
  })

  if (platform) {
    params.append('platform', platform)
  }

  return params.toString()
}

export function buildFileSearchQuery(query: string, filters?: FileSearchFilters): string {
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

  return params.toString()
}

export const fileContracts = {
  uploadFile: defineApiContract<Record<string, never>, globalThis.FormData, FileUploadResponse>({
    method: 'POST',
    transport: 'upload',
    path: () => '/files/upload'
  }),

  uploadMultipleFiles: defineApiContract<Record<string, never>, globalThis.FormData, FileUploadResponse[]>({
    method: 'POST',
    transport: 'upload',
    path: () => '/files/upload-multiple'
  }),

  list: defineApiContract<{ page?: number; pageSize?: number; platform?: string }, void, FileListResponse>({
    method: 'GET',
    path: ({ page, pageSize, platform }) => `/files?${buildFileListQuery(page, pageSize, platform)}`
  }),

  getDetails: defineApiContract<{ fileId: string }, void, MediaFileInfo>({
    method: 'GET',
    path: ({ fileId }) => `/files/${fileId}`
  }),

  getDownloadUrl: defineApiContract<{ fileId: string; expiresIn: number }, void, { url: string; expiresAt: string }>({
    method: 'GET',
    path: ({ fileId, expiresIn }) => `/files/${fileId}/download-url?expiresIn=${expiresIn}`
  }),

  delete: defineApiContract<{ fileId: string }, void, { success: boolean }>({
    method: 'DELETE',
    path: ({ fileId }) => `/files/${fileId}`
  }),

  deleteMultiple: defineApiContract<Record<string, never>, { fileIds: string[] }, { successful: string[]; failed: string[] }>({
    method: 'POST',
    path: () => '/files/delete-multiple'
  }),

  stats: defineApiContract<{ period: string }, void, FileStatsResponse>({
    method: 'GET',
    path: ({ period }) => `/files/stats?period=${period}`
  }),

  byConversation: defineApiContract<{ conversationId: string; page: number; pageSize: number }, void, FileListResponse>({
    method: 'GET',
    path: ({ conversationId, page, pageSize }) =>
      `/conversations/${conversationId}/files?page=${page}&pageSize=${pageSize}`
  }),

  byMessage: defineApiContract<{ messageId: string }, void, MediaFileInfo[]>({
    method: 'GET',
    path: ({ messageId }) => `/messages/${messageId}/files`
  }),

  generateSignedUrl: defineApiContract<
    Record<string, never>,
    { filename: string; mimeType: string; size: number },
    GenerateSignedUrlResponse
  >({
    method: 'POST',
    path: () => '/files/presigned-url'
  }),

  confirmUpload: defineApiContract<{ fileId: string }, { size: number }, MediaFileInfo>({
    method: 'POST',
    path: ({ fileId }) => `/files/${fileId}/confirm`
  }),

  search: defineApiContract<{ query: string; filters?: FileSearchFilters }, void, FileListResponse>({
    method: 'GET',
    path: ({ query, filters }) => `/files/search?${buildFileSearchQuery(query, filters)}`
  }),

  presignedUrlStatus: defineApiContract<Record<string, never>, void, PresignedUrlStatus>({
    method: 'GET',
    path: () => '/files/presigned-url/status'
  })
} as const
