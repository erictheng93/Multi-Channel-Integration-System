import { defineApiContract } from './core'
import type { Platform } from '../types/core'

export type ConversationStatusForApi = 'active' | 'assigned' | 'pending'

export interface RawConversationData {
  id: string
  customerId: number
  customer_id?: number
  assignedTeamId: number | null
  assignedUserId: string | null
  status: ConversationStatusForApi | 'in-progress' | 'waiting' | 'open'
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  customerName?: string
  platform?: Platform | ''
  platformUserId?: string
  customer?: {
    id: number | string
    name?: string
    displayName?: string
    platform?: Platform
    platformUserId?: string
    avatarUrl?: string
    email?: string
    phone?: string
    sourceTeamId?: number
    metadata?: string
    createdAt?: string
    updatedAt?: string
  }
  assignedTeam?: {
    id: number
    name: string
    description?: string
  }
  assignedAgent?: {
    id: string
    name: string
    displayName?: string
    email?: string
  }
  lastMessage?: {
    id: string
    content: string
    createdAt: string
    senderType: string
    messageType: string
  } | null
  lastMessageContent?: string
  lastMessageAtActual?: string
  unreadCount?: number
  // Manual unread override timestamp: when set, the backend floors
  // unreadCount at 1 until the conversation is next marked as read
  markedUnreadAt?: string | null
}

export interface ConversationListParams {
  page?: number
  pageSize?: number
  status?: ConversationStatusForApi | ''
  platform?: Platform
  teamId?: number
  search?: string
  tagIds?: number[]
  customerName?: string
  updatedAfter?: string
  updatedBefore?: string
}

export interface ConversationFilters {
  status?: string
  platform?: Platform | ''
  teamId?: number
}

export interface ConversationSendMessageRequest {
  content: string
  messageType?: 'text' | 'image' | 'file'
  platform?: Platform
}

export interface AssignConversationOptions {
  teamId: number
  reason?: string
}

export interface TransferConversationOptions {
  fromTeamId?: number
  toTeamId: number
  reason?: string
}

export interface ConversationStats {
  total: number
  active: number
  assigned: number
  pending: number
  unreadCount: number
}

export interface ConversationTag {
  id: number
  name: string
  color: string
  description: string | null
  assignedBy: string
  assignedAt: string
}

export interface ConversationBulkOperationRequest {
  operation: 'assign' | 'close' | 'reopen' | 'set_priority' | 'add_tags' | 'remove_tags'
  conversationIds: string[]
  data?: {
    teamId?: number
    priority?: string
    tagIds?: number[]
  }
}

export interface ConversationBulkOperationResponse {
  operation: string
  affectedCount: number
  conversationIds: string[]
}

export interface ConversationHealthResponse {
  status: string
  timestamp: string
  module: string
  version: string
}

export interface ConversationInfoResponse {
  success: true
  data: {
    module: string
    version: string
    endpoints: string[]
  }
  timestamp: string
}

export function buildConversationQuery(params: ConversationListParams | ConversationFilters = {}): string {
  const queryParams = new URLSearchParams()
  const listParams = params as ConversationListParams

  if (listParams.page !== undefined) {
    queryParams.append('page', listParams.page.toString())
  }
  if (listParams.pageSize !== undefined) {
    queryParams.append('pageSize', listParams.pageSize.toString())
  }
  if (listParams.status) {
    queryParams.append('status', listParams.status)
  }
  if (listParams.platform) {
    queryParams.append('platform', listParams.platform)
  }
  if (listParams.teamId) {
    queryParams.append('teamId', listParams.teamId.toString())
  }
  if (listParams.search) {
    queryParams.append('search', listParams.search)
  }
  if (listParams.tagIds && listParams.tagIds.length > 0) {
    queryParams.append('tagIds', listParams.tagIds.join(','))
  }
  if (listParams.customerName) {
    queryParams.append('customerName', listParams.customerName)
  }
  if (listParams.updatedAfter) {
    queryParams.append('updatedAfter', listParams.updatedAfter)
  }
  if (listParams.updatedBefore) {
    queryParams.append('updatedBefore', listParams.updatedBefore)
  }

  const query = queryParams.toString()
  return query ? `?${query}` : ''
}

export function buildConversationMessagesQuery(params?: { page?: number; pageSize?: number; since?: string }): string {
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
  const query = queryParams.toString()
  return query ? `?${query}` : ''
}

export const conversationContracts = {
  health: defineApiContract<
    Record<string, never>,
    void,
    ConversationHealthResponse,
    ConversationHealthResponse
  >({
    method: 'GET',
    path: () => '/conversations/health'
  }),

  info: defineApiContract<
    Record<string, never>,
    void,
    ConversationInfoResponse,
    ConversationInfoResponse
  >({
    method: 'GET',
    path: () => '/conversations/info'
  }),

  list: defineApiContract<ConversationListParams | ConversationFilters | undefined, void, RawConversationData[]>({
    method: 'GET',
    path: params => `/conversations${buildConversationQuery(params)}`
  }),

  listPaginated: defineApiContract<ConversationListParams, void, RawConversationData[] | unknown>({
    method: 'GET',
    path: params => `/conversations${buildConversationQuery(params)}`
  }),

  stats: defineApiContract<Record<string, never>, void, ConversationStats>({
    method: 'GET',
    path: () => '/conversations/stats'
  }),

  get: defineApiContract<{ id: string }, void, RawConversationData>({
    method: 'GET',
    path: ({ id }) => `/conversations/${id}`
  }),

  messages: defineApiContract<
    { conversationId: string; params?: { page?: number; pageSize?: number; since?: string } },
    void,
    unknown
  >({
    method: 'GET',
    path: ({ conversationId, params }) =>
      `/conversations/${conversationId}/messages${buildConversationMessagesQuery(params)}`
  }),

  sendMessage: defineApiContract<{ conversationId: string }, ConversationSendMessageRequest, unknown>({
    method: 'POST',
    path: ({ conversationId }) => `/conversations/${conversationId}/messages`
  }),

  assign: defineApiContract<{ conversationId: string }, AssignConversationOptions, RawConversationData>({
    method: 'POST',
    path: ({ conversationId }) => `/conversations/${conversationId}/assign`
  }),

  unassign: defineApiContract<{ conversationId: string }, { reason?: string }, RawConversationData>({
    method: 'POST',
    path: ({ conversationId }) => `/conversations/${conversationId}/unassign`
  }),

  transfer: defineApiContract<{ conversationId: string }, TransferConversationOptions, RawConversationData>({
    method: 'POST',
    path: ({ conversationId }) => `/conversations/${conversationId}/transfer`
  }),

  markAsRead: defineApiContract<{ conversationId: string }, void, void>({
    method: 'PUT',
    path: ({ conversationId }) => `/conversations/${conversationId}/read`
  }),

  markAsUnread: defineApiContract<{ conversationId: string }, void, { unreadCount: number }>({
    method: 'PUT',
    path: ({ conversationId }) => `/conversations/${conversationId}/unread`
  }),

  setTags: defineApiContract<{ conversationId: string }, { tags: string[] }, void>({
    method: 'PUT',
    path: ({ conversationId }) => `/conversations/${conversationId}/tags`
  }),

  bulk: defineApiContract<Record<string, never>, ConversationBulkOperationRequest, ConversationBulkOperationResponse>({
    method: 'POST',
    path: () => '/conversations/bulk'
  }),

  tags: defineApiContract<{ conversationId: string }, void, ConversationTag[]>({
    method: 'GET',
    path: ({ conversationId }) => `/conversations/${conversationId}/tags`
  }),

  addTags: defineApiContract<{ conversationId: string }, { tagIds: number[] }, void>({
    method: 'POST',
    path: ({ conversationId }) => `/conversations/${conversationId}/tags`
  }),

  removeTags: defineApiContract<{ conversationId: string }, { tagIds: number[] }, void>({
    method: 'DELETE',
    hasRequestBody: true,
    path: ({ conversationId }) => `/conversations/${conversationId}/tags`
  })
} as const
