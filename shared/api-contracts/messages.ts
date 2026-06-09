import { defineApiContract } from './core'

export interface DelayedMessageRequest {
  conversationId: string
  content: string
  delaySeconds: number
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file'
  mediaUrl?: string
  senderId: string
  recipientPlatformId: string
  platform: 'line' | 'facebook'
}

export interface DelayedMessageResponse {
  messageId: string
  scheduledSendTime: string
  recallDeadline: string
}

export interface RecallMessageRequest {
  messageId: string
  userId: string
}

export interface RecallMessageResponse {
  success: boolean
  messageId: string
}

export interface PendingMessage {
  id: string
  conversation_id: string
  customer_name: string
  content: string
  platform: string
  scheduled_send_time: string
  recall_deadline: string
  status: string
  can_recall: boolean
  message_type: string
  created_at: string
}

export interface PendingMessagesResponse {
  items: PendingMessage[]
  total: number
  page: number
  pageSize: number
}

export interface BulkCreateMessageRequest {
  conversationId: string
  content: string
  messageType?: 'text' | 'image' | 'file'
  attachmentIds?: string[]
}

export interface BulkCreateMessagesRequest {
  messages: BulkCreateMessageRequest[]
}

export interface BulkDeleteMessagesRequest {
  messageIds: string[]
  hardDelete?: boolean
}

export interface BulkOperationResult {
  success: boolean
  results: Array<{
    id?: string
    success: boolean
    error?: string
  }>
  errors: Array<{
    index: number
    error: string
  }>
  message: string
}

export const messageContracts = {
  sendDelayedMessage: defineApiContract<Record<string, never>, DelayedMessageRequest, DelayedMessageResponse>({
    method: 'POST',
    path: () => '/messages/delayed'
  }),

  recallMessage: defineApiContract<Record<string, never>, RecallMessageRequest, RecallMessageResponse>({
    method: 'POST',
    path: () => '/messages/recall'
  }),

  getPendingMessages: defineApiContract<{ page: number; pageSize: number }, void, PendingMessagesResponse>({
    method: 'GET',
    path: ({ page, pageSize }) => `/messages/pending?page=${page}&pageSize=${pageSize}`
  }),

  canRecallMessage: defineApiContract<{ messageId: string; userId: string }, void, { canRecall: boolean }>({
    method: 'GET',
    path: ({ messageId, userId }) => `/messages/${messageId}/can-recall?userId=${userId}`
  }),

  getMessageDetails: defineApiContract<{ messageId: string }, void, PendingMessage>({
    method: 'GET',
    path: ({ messageId }) => `/messages/${messageId}`
  }),

  bulkCreate: defineApiContract<Record<string, never>, BulkCreateMessagesRequest, BulkOperationResult>({
    method: 'POST',
    path: () => '/messages/bulk-create'
  }),

  bulkDelete: defineApiContract<Record<string, never>, BulkDeleteMessagesRequest, BulkOperationResult>({
    method: 'POST',
    path: () => '/messages/bulk-delete'
  })
} as const
