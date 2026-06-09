import { defineApiContract } from './core'

export interface DelayedMessage {
  id: string
  conversationId: string
  content: string
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file'
  platform: 'line' | 'facebook'
  scheduledAt: number
  canCancelUntil: number
  delaySeconds: number
}

export interface MessageStatus {
  exists: boolean
  status?: 'pending' | 'sent' | 'cancelled' | 'not_found'
  timeRemaining?: number
  canCancel?: boolean
  scheduledAt?: number
}

export interface SendDelayedMessageParams {
  conversationId: string
  content: string
  platform: 'line' | 'facebook'
  recipientPlatformId: string
  delaySeconds?: number
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file'
}

export interface CancelDelayedMessageParams {
  messageId: string
  conversationId: string
  reason?: string
}

export interface PendingDelayedMessage {
  id: string
  content: string
  scheduledAt: number
  timeRemaining: number
}

export interface PendingDelayedMessagesResponse {
  count: number
  messages: PendingDelayedMessage[]
}

export interface DelayedMessagesHealth {
  success: boolean
  status: string
  features: {
    instantCancel: boolean
    preciseScheduling: boolean
    durableObjects: boolean
  }
}

export const delayedMessagesV2Contracts = {
  send: defineApiContract<Record<string, never>, SendDelayedMessageParams, DelayedMessage>({
    method: 'POST',
    path: () => '/api/delayed-messages-v2/send'
  }),

  cancel: defineApiContract<
    { messageId: string },
    Pick<CancelDelayedMessageParams, 'conversationId' | 'reason'>,
    void
  >({
    method: 'DELETE',
    hasRequestBody: true,
    path: ({ messageId }) => `/api/delayed-messages-v2/cancel/${messageId}`
  }),

  status: defineApiContract<{ messageId: string; conversationId: string }, void, MessageStatus>({
    method: 'GET',
    path: ({ messageId, conversationId }) =>
      `/api/delayed-messages-v2/status/${messageId}?conversationId=${encodeURIComponent(conversationId)}`
  }),

  pending: defineApiContract<{ conversationId: string }, void, PendingDelayedMessagesResponse>({
    method: 'GET',
    path: ({ conversationId }) =>
      `/api/delayed-messages-v2/pending?conversationId=${encodeURIComponent(conversationId)}`
  }),

  health: defineApiContract<Record<string, never>, void, DelayedMessagesHealth>({
    method: 'GET',
    path: () => '/api/delayed-messages-v2/health'
  })
} as const
