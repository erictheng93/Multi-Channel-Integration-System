import { defineApiContract } from './core'

export interface MessageSenderInfo {
  id: string | number | null
  name?: string | null
  role?: string | null
  platform?: string | null
}

export interface MessageDetail {
  id: string
  conversationId: string
  senderType: string
  senderInfo: MessageSenderInfo | null
  content: string
  messageType: string
  platformMessageId?: string | null
  isRecalled: boolean
  recallDeadline?: string | null
  recalledAt?: string | null
  isSent: boolean
  sentAt?: string | null
  deliveryStatus?: string | null
  replyToMessageId?: string | null
  threadId?: string | null
  sessionId?: string | null
  sessionSequence?: number | null
  metadata?: Record<string, unknown> | null
  createdAt?: string | null
  conversationInfo?: {
    status?: string | null
    priority?: string | null
  }
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
  getMessageDetails: defineApiContract<{ messageId: string }, void, MessageDetail>({
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
