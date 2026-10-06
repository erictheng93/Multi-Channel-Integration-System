import { apiClient } from './base'
import { filesApi } from './files'
import { createBroadcastPreview } from '@/utils/broadcast-image-preview'

export type BroadcastStatus = 'draft' | 'sending' | 'completed' | 'partial_failed' | 'failed'
export type BroadcastRecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped'
export type BroadcastRecipientErrorReason =
  | 'platform_not_supported_phase1'
  | 'no_channel_credentials'
  | 'line_api_failed'
  | 'quota_insufficient'

export interface BroadcastAudiencePreview {
  total: number
  byPlatform: Record<string, number> & {
    line: number
    facebook: number
  }
  sendable: number
  skipped: Array<{
    reason: BroadcastRecipientErrorReason
    count: number
  }>
}

export interface BroadcastAttachmentInput {
  attachmentId: string
  previewAttachmentId: string
}

export interface BroadcastAttachmentView {
  position: number
  attachmentId: string
  fileUrl: string
  previewUrl: string
}

export interface BroadcastRecord {
  id: string
  title: string
  contentType: 'text' | 'mixed'
  content: string
  tagIds: number[]
  matchMode: 'any' | 'all'
  status: BroadcastStatus
  totalRecipients: number
  sentCount: number
  failedCount: number
  skippedCount: number
  createdBy: string
  sentAt: string | null
  createdAt: string | null
  updatedAt: string | null
  deletedAt: string | null
  attachments?: BroadcastAttachmentView[]
}

export interface BroadcastSendStats {
  broadcastId: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  skippedCount: number
  status: BroadcastStatus
}

export interface BroadcastRecipientDetail {
  id: number
  broadcastId: string
  customerId: number | null
  platform: string
  platformUserId: string
  resolvedTeamId: number | null
  status: BroadcastRecipientStatus
  errorReason: BroadcastRecipientErrorReason | null
  sentAt: string | null
  createdAt: string | null
  customerDisplayName: string | null
  customerAvatarUrl: string | null
}

export interface BroadcastListResult {
  items: BroadcastRecord[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface BroadcastRecipientListResult {
  items: BroadcastRecipientDetail[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CreateBroadcastRequest {
  title: string
  content: string
  tagIds: number[]
  attachments: BroadcastAttachmentInput[]
}

export interface BroadcastPreviewRequest {
  tagIds: number[]
}

async function unwrap<T>(promise: ReturnType<typeof apiClient.get<T>>): Promise<T> {
  const response = await promise
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Broadcast API request failed')
  }
  return response.data
}

export const previewBroadcastAudience = (data: BroadcastPreviewRequest) =>
  unwrap<BroadcastAudiencePreview>(apiClient.post('/broadcasts/preview', data))

export const createBroadcast = (data: CreateBroadcastRequest) =>
  unwrap<BroadcastRecord>(apiClient.post('/broadcasts', data))

export const sendBroadcast = (id: string) =>
  unwrap<BroadcastSendStats>(apiClient.post(`/broadcasts/${id}/send`))

export const listBroadcasts = (params?: { page?: number; pageSize?: number }) => {
  const search = new URLSearchParams()
  if (params?.page) {search.set('page', String(params.page))}
  if (params?.pageSize) {search.set('pageSize', String(params.pageSize))}
  const query = search.toString()
  return unwrap<BroadcastListResult>(apiClient.get(`/broadcasts${query ? `?${query}` : ''}`))
}

export const getBroadcast = (id: string) => unwrap<BroadcastRecord>(apiClient.get(`/broadcasts/${id}`))

export const listBroadcastRecipients = (
  id: string,
  params?: { page?: number; pageSize?: number; status?: BroadcastRecipientStatus }
) => {
  const search = new URLSearchParams()
  if (params?.page) {search.set('page', String(params.page))}
  if (params?.pageSize) {search.set('pageSize', String(params.pageSize))}
  if (params?.status) {search.set('status', params.status)}
  const query = search.toString()
  return unwrap<BroadcastRecipientListResult>(
    apiClient.get(`/broadcasts/${id}/recipients${query ? `?${query}` : ''}`)
  )
}

async function uploadOne(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await filesApi.uploadFile(formData)
  if (!response.success || !response.data) {
    throw new Error(response.error || '圖片上傳失敗')
  }
  return response.data.fileId
}

export async function uploadBroadcastImage(file: File): Promise<BroadcastAttachmentInput> {
  const preview = await createBroadcastPreview(file)
  const [attachmentId, previewAttachmentId] = await Promise.all([uploadOne(file), uploadOne(preview)])
  return { attachmentId, previewAttachmentId }
}
