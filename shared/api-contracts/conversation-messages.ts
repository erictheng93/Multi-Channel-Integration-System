import { defineApiContract } from './core'
import type { Platform } from '../types/core'
import type { Message } from '../types/entities'

export interface SendConversationMessageRequest {
  content: string
  messageType?: 'text' | 'image' | 'file'
  platform?: Platform
  senderId?: string
  replyToId?: string
  metadata?: Record<string, unknown>
  attachmentIds?: string[]
}

export interface ConversationMessageListParams {
  page?: number
  pageSize?: number
  since?: string
  before?: string
  messageType?: 'text' | 'image' | 'file'
}

export interface ConversationMessageUploadResponse {
  url: string
  filename: string
  attachmentId: string
  mimeType?: string
  size?: number
}

export interface ConversationMessageRecallRequest {
  messageId: string
  reason?: string
}

export interface PaginatedConversationMessages {
  items: Message[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore?: boolean
}

export function buildConversationMessageQuery(params?: ConversationMessageListParams): string {
  const queryParams = new URLSearchParams()

  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString())
  }
  if (params?.pageSize !== undefined) {
    queryParams.append('pageSize', params.pageSize.toString())
  }
  if (params?.since) {
    queryParams.append('since', params.since)
  }
  if (params?.before) {
    queryParams.append('before', params.before)
  }
  if (params?.messageType) {
    queryParams.append('messageType', params.messageType)
  }

  const query = queryParams.toString()
  return query ? `?${query}` : ''
}

export function buildMessageSearchQuery(query: string, messageType?: string): string {
  const queryParams = new URLSearchParams()
  queryParams.append('q', query.trim())
  if (messageType) {
    queryParams.append('messageType', messageType)
  }
  return queryParams.toString()
}

export const conversationMessageContracts = {
  list: defineApiContract<
    { conversationId: string; params?: ConversationMessageListParams },
    void,
    Message[]
  >({
    method: 'GET',
    path: ({ conversationId, params }) =>
      `/conversations/${conversationId}/messages${buildConversationMessageQuery(params)}`
  }),

  listPaginated: defineApiContract<
    { conversationId: string; params?: ConversationMessageListParams },
    void,
    PaginatedConversationMessages
  >({
    method: 'GET',
    path: ({ conversationId, params }) =>
      `/conversations/${conversationId}/messages${buildConversationMessageQuery(params)}`
  }),

  send: defineApiContract<{ conversationId: string }, SendConversationMessageRequest, Message>({
    method: 'POST',
    path: ({ conversationId }) => `/conversations/${conversationId}/messages`
  }),

  uploadAttachment: defineApiContract<
    { conversationId: string },
    globalThis.FormData,
    ConversationMessageUploadResponse
  >({
    method: 'POST',
    transport: 'upload',
    path: ({ conversationId }) => `/conversations/${conversationId}/attachments`
  }),

  markAllAsRead: defineApiContract<{ conversationId: string }, void, void>({
    method: 'PUT',
    path: ({ conversationId }) => `/conversations/${conversationId}/messages/read`
  }),

  markMessageAsRead: defineApiContract<{ conversationId: string; messageId: string }, void, void>({
    method: 'PUT',
    path: ({ conversationId, messageId }) => `/conversations/${conversationId}/messages/${messageId}/read`
  }),

  recall: defineApiContract<
    { conversationId: string; messageId: string },
    { reason?: string },
    void
  >({
    method: 'DELETE',
    hasRequestBody: true,
    path: ({ conversationId, messageId }) => `/conversations/${conversationId}/messages/${messageId}`
  }),

  get: defineApiContract<{ conversationId: string; messageId: string }, void, Message>({
    method: 'GET',
    path: ({ conversationId, messageId }) => `/conversations/${conversationId}/messages/${messageId}`
  }),

  edit: defineApiContract<{ conversationId: string; messageId: string }, { content: string }, Message>({
    method: 'PUT',
    path: ({ conversationId, messageId }) => `/conversations/${conversationId}/messages/${messageId}`
  }),

  search: defineApiContract<
    { conversationId: string; query: string; messageType?: string },
    void,
    Message[]
  >({
    method: 'GET',
    path: ({ conversationId, query, messageType }) =>
      `/conversations/${conversationId}/messages/search?${buildMessageSearchQuery(query, messageType)}`
  })
} as const
