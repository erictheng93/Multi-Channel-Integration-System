import { defineApiContract } from './core'

export type NotificationType =
  | 'new_message'
  | 'conversation_assigned'
  | 'conversation_transferred'
  | 'mention'
  | 'system'
  // 'priority_changed' removed 2026-08-04. Its trigger
  // (triggerPriorityChangedNotification) had zero call sites anywhere in the
  // codebase and production held zero rows of this type, so nothing produced it
  // and nothing consumed it. This is a breaking change to the `byType` shape of
  // GET /api/notifications/stats: the key is gone rather than reporting zero.
  | 'customer_responded'
  | 'task_reminder'
  | 'agent_removed_from_team'
  | 'customer_followed'
  | 'new_conversation'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Notification {
  id: string
  userId: string | number
  type: NotificationType
  title: string
  content: string
  data?: Record<string, unknown>
  priority: NotificationPriority
  isRead: boolean
  readAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt?: string
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<NotificationType, { total: number; unread: number }>
  byPriority: Record<NotificationPriority, { total: number; unread: number }>
  timeRange: {
    today: number
    thisWeek: number
    thisMonth: number
  }
}

export interface NotificationSettings {
  userId: string | number
  emailEnabled: boolean
  pushEnabled: boolean
  soundEnabled: boolean
  mentionEnabled: boolean
  assignmentEnabled: boolean
  messageEnabled: boolean
  systemEnabled: boolean
}

export interface NotificationListParams {
  page?: number
  pageSize?: number
  type?: NotificationType
  priority?: NotificationPriority
  isRead?: boolean
  dateFrom?: string
  dateTo?: string
}

export interface CreateNotificationRequest {
  userId?: number
  type: NotificationType
  title: string
  content: string
  data?: Record<string, unknown>
  priority?: NotificationPriority
  channels?: string[]
  expiresAt?: string
}

export interface BulkCreateNotificationRequest {
  notifications: CreateNotificationRequest[]
  batchId?: string
}

export interface BulkCreateNotificationResponse {
  successful: number
  failed: number
  successfulIds: string[]
  failures: Array<{ index: number; error: string }>
}

export interface NotificationChannelStats {
  enabled: boolean
  type: string
  stats?: unknown
}

export interface TestNotificationChannelResponse {
  success: boolean
  messageId?: string
  errorMessage?: string
}

export interface NewMessageNotificationParams {
  userId: number
  conversationId: number
  senderName: string
  content: string
  channels?: string[]
}

export interface ConversationAssignedNotificationParams {
  userId: number
  conversationId: number
  customerName: string
  assignedBy: string
}

export interface SystemNotificationParams {
  userIds: number[]
  title: string
  content: string
  data?: Record<string, unknown>
}

export interface SystemNotificationResponse {
  ids: string[]
  count: number
  broadcastedToAll?: boolean
}

export function buildNotificationQuery(params: NotificationListParams = {}): string {
  const queryParams = new URLSearchParams()

  if (params.page !== undefined) {
    queryParams.append('page', params.page.toString())
  }
  if (params.pageSize !== undefined) {
    queryParams.append('pageSize', params.pageSize.toString())
  }
  if (params.type) {
    queryParams.append('type', params.type)
  }
  if (params.priority) {
    queryParams.append('priority', params.priority)
  }
  if (params.isRead !== undefined) {
    queryParams.append('isRead', params.isRead.toString())
  }
  if (params.dateFrom) {
    queryParams.append('dateFrom', params.dateFrom)
  }
  if (params.dateTo) {
    queryParams.append('dateTo', params.dateTo)
  }

  const query = queryParams.toString()
  return query ? `?${query}` : ''
}

export const notificationContracts = {
  list: defineApiContract<NotificationListParams, void, unknown>({
    method: 'GET',
    path: params => `/notifications${buildNotificationQuery(params)}`
  }),

  getById: defineApiContract<{ id: string }, void, Notification>({
    method: 'GET',
    path: ({ id }) => `/notifications/${id}`
  }),

  create: defineApiContract<Record<string, never>, CreateNotificationRequest, { id: string }>({
    method: 'POST',
    path: () => '/notifications'
  }),

  createBulk: defineApiContract<Record<string, never>, BulkCreateNotificationRequest, BulkCreateNotificationResponse>({
    method: 'POST',
    path: () => '/notifications/bulk'
  }),

  markAsRead: defineApiContract<{ id: string }, void, void>({
    method: 'PUT',
    path: ({ id }) => `/notifications/${id}/read`
  }),

  markAllAsRead: defineApiContract<Record<string, never>, { type?: NotificationType }, { updated: number }>({
    method: 'PUT',
    path: () => '/notifications/mark-all-read'
  }),

  delete: defineApiContract<{ id: string }, void, void>({
    method: 'DELETE',
    path: ({ id }) => `/notifications/${id}`
  }),

  stats: defineApiContract<Record<string, never>, void, NotificationStats>({
    method: 'GET',
    path: () => '/notifications/stats'
  }),

  unreadCount: defineApiContract<{ type?: NotificationType }, void, { count: number; type: string }>({
    method: 'GET',
    path: ({ type }) => `/notifications/unread-count${type ? `?type=${type}` : ''}`
  }),

  recent: defineApiContract<{ limit: number }, void, { notifications: Notification[]; count: number; limit: number }>({
    method: 'GET',
    path: ({ limit }) => `/notifications/recent?limit=${limit}`
  }),

  cleanup: defineApiContract<Record<string, never>, void, { deleted: number }>({
    method: 'DELETE',
    path: () => '/notifications/cleanup'
  }),

  channelStats: defineApiContract<Record<string, never>, void, Record<string, NotificationChannelStats>>({
    method: 'GET',
    path: () => '/notifications/channels/stats'
  }),

  testChannel: defineApiContract<{ channelType: string }, { message?: string }, TestNotificationChannelResponse>({
    method: 'POST',
    path: ({ channelType }) => `/notifications/channels/${channelType}/test`
  }),

  newMessage: defineApiContract<Record<string, never>, NewMessageNotificationParams, { id: string }>({
    method: 'POST',
    path: () => '/notifications/new-message'
  }),

  conversationAssigned: defineApiContract<Record<string, never>, ConversationAssignedNotificationParams, { id: string }>({
    method: 'POST',
    path: () => '/notifications/conversation-assigned'
  }),

  system: defineApiContract<Record<string, never>, SystemNotificationParams, SystemNotificationResponse>({
    method: 'POST',
    path: () => '/notifications/system'
  }),

  settings: defineApiContract<Record<string, never>, void, NotificationSettings>({
    method: 'GET',
    path: () => '/notifications/settings'
  }),

  updateSettings: defineApiContract<
    Record<string, never>,
    Partial<Omit<NotificationSettings, 'userId'>>,
    void
  >({
    method: 'PUT',
    path: () => '/notifications/settings'
  })
} as const
