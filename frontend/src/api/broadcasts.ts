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

export interface LineQuotaChannel {
  channelKey: string
  label: string
  /** false = no monthly target limit; only `used` is meaningful */
  limited: boolean
  limit: number | null
  used: number | null
  remaining: number | null
  /** last successful fetch (kept across failures) */
  fetchedAt: string | null
  /** set when the latest attempt failed */
  error: string | null
}

export interface LineQuotaSnapshot {
  items: LineQuotaChannel[]
  updatedAt: string | null
  source: 'cron' | 'manual' | null
  /** manual refresh answered from the stored snapshot (server throttle) */
  throttled: boolean
}

async function unwrap<T>(promise: ReturnType<typeof apiClient.get<T>>): Promise<T> {
  const response = await promise
  if (!response.success || !response.data) {
    const data: unknown = response.data
    if (
      !response.success &&
      data &&
      typeof data === 'object' &&
      'errors' in data &&
      Array.isArray(data.errors)
    ) {
      const fields: Record<string, string> = {
        title: '標題',
        content: '訊息內容',
        tagIds: '目標標籤',
        attachments: '圖片',
        status: '狀態',
      }
      const errors = data.errors.flatMap((item: unknown) => {
        if (
          !item ||
          typeof item !== 'object' ||
          !('field' in item) ||
          !('message' in item) ||
          typeof item.field !== 'string' ||
          typeof item.message !== 'string'
        ) {
          return []
        }
        return [`${fields[item.field] || item.field}：${item.message}`]
      })
      if (errors.length) {
        throw new Error(errors.join('；'))
      }
    }
    const messages: Record<string, string> = {
      ATTACHMENT_NOT_FOUND: '圖片或預覽圖不存在，請重新上傳',
      ATTACHMENT_NOT_OWNED: '只能使用您自己上傳的圖片',
      ATTACHMENT_ALREADY_BOUND: '圖片已用於其他訊息，請重新上傳',
      ATTACHMENT_BAD_MIME: '圖片與預覽圖僅接受 JPEG / PNG 格式',
      ATTACHMENT_TOO_LARGE: '原圖不得超過 10MB，預覽圖不得超過 1MB',
      INVALID_BROADCAST_INPUT: '請求內容有誤，請檢查標題、文字與圖片',
      PHASE1_SINGLE_TAG_ONLY: '目前一次只能選擇一個目標標籤',
      TAG_NOT_FOUND: '目標標籤不存在，請重新選擇',
      EMPTY_AUDIENCE: '此標籤沒有可發送的客戶',
      BROADCAST_NOT_FOUND: '找不到此群發紀錄',
      INVALID_BROADCAST_STATUS: '此群發已開始發送，無法再次送出',
      LINE_RECIPIENT_LIMIT_EXCEEDED: '一次最多可發送給 5000 位 LINE 客戶',
      QUOTA_INSUFFICIENT: 'LINE 訊息額度不足，請確認額度後再試',
      FORBIDDEN: '您沒有群發訊息的權限',
      NOT_FOUND: '找不到此群發紀錄',
    }
    throw new Error(
      response.code
        ? messages[response.code] || '請求內容有誤，請檢查後再試'
        : response.status === 422
          ? '請求內容有誤，請檢查後再試'
          : response.error || '群發請求失敗，請稍後再試'
    )
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
  if (params?.page) {
    search.set('page', String(params.page))
  }
  if (params?.pageSize) {
    search.set('pageSize', String(params.pageSize))
  }
  const query = search.toString()
  return unwrap<BroadcastListResult>(apiClient.get(`/broadcasts${query ? `?${query}` : ''}`))
}

export const getLineQuota = () => unwrap<LineQuotaSnapshot>(apiClient.get('/broadcasts/line-quota'))

export const refreshLineQuota = () =>
  unwrap<LineQuotaSnapshot>(apiClient.post('/broadcasts/line-quota/refresh'))

export const getBroadcast = (id: string) =>
  unwrap<BroadcastRecord>(apiClient.get(`/broadcasts/${id}`))

export const listBroadcastRecipients = (
  id: string,
  params?: { page?: number; pageSize?: number; status?: BroadcastRecipientStatus }
) => {
  const search = new URLSearchParams()
  if (params?.page) {
    search.set('page', String(params.page))
  }
  if (params?.pageSize) {
    search.set('pageSize', String(params.pageSize))
  }
  if (params?.status) {
    search.set('status', params.status)
  }
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
  const results = await Promise.allSettled([uploadOne(file), uploadOne(preview)])
  const [original, thumbnail] = results
  if (original.status === 'fulfilled' && thumbnail.status === 'fulfilled') {
    return { attachmentId: original.value, previewAttachmentId: thumbnail.value }
  }
  // Wait for both uploads so a late success can be reclaimed after its partner fails.
  await deleteUploadedFiles(
    results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
  )
  const failure = results.find(result => result.status === 'rejected')
  throw failure?.status === 'rejected' ? failure.reason : new Error('圖片上傳失敗')
}

async function deleteUploadedFiles(ids: string[]): Promise<void> {
  await Promise.allSettled(ids.map(id => filesApi.deleteFile(id)))
}

export function cleanupBroadcastImage(attachment: BroadcastAttachmentInput): Promise<void> {
  return deleteUploadedFiles([attachment.attachmentId, attachment.previewAttachmentId])
}
