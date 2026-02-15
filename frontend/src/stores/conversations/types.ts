import type { Ref } from 'vue'
import type { Conversation, ConversationFilters, Message } from '@/types'

/** Internal extension of Conversation for LIFF pending tracking */
export interface LiffConversation extends Conversation {
  _liffMetadata?: {
    lineUserId?: string
    isPending?: boolean
    scannedAt?: number
  }
}

// Sync status type (backward compatible)
export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'polling' | 'error'

/** Transferred conversation state - tracks when a conversation is transferred while viewing */
export interface TransferredConversationState {
  conversationId: string
  toTeamName: string
  transferredAt: string
}

/** Stats shape computed from conversations */
export interface ConversationStats {
  total: number
  active: number
  assigned: number
  pending: number
  unreadCount: number
}

/**
 * Shared dependency shape passed to sub-module factory functions.
 * Each sub-module picks only the refs it needs from this interface.
 */
export interface ConversationStoreDeps {
  // Core state refs
  conversations: Ref<Conversation[]>
  currentConversation: Ref<Conversation | null>
  messages: Ref<Message[]>
  transferredConversation: Ref<TransferredConversationState | null>

  // Loading states
  loading: Ref<boolean>
  updating: Ref<boolean>
  refreshing: Ref<boolean>
  loadingMore: Ref<boolean>
  error: Ref<string | null>

  // Tracking
  stats: Ref<ConversationStats>
  lastUpdateTime: Ref<Date | null>
  updateCount: Ref<number>

  // Filters and pagination
  filters: Ref<ConversationFilters>
  activeFilters: Ref<ConversationFilters>
  pagination: Ref<{
    page: number
    pageSize: number
    total: number
    totalPages: number
  }>

  // Internal helpers (provided by main store)
  handleError: (_err: unknown, _defaultMessage: string) => void
  updateConversationInList: (_updatedConversation: Conversation) => void
  hasConversationChanged: (_existing: Conversation, _updated: Conversation) => boolean
  updateConversationsIncrementally: (_newConversations: Conversation[], _logChanges?: boolean) => void
  updateStatsFromConversations: () => void
  updateConversationStatus: (
    _conversationId: string,
    _updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'unreadCount' | 'assignedTeam'>>
  ) => boolean
  updateConversationFromWebSocketMessage: (
    _conversationId: string,
    _messageData: {
      content?: string
      messageType?: string
      timestamp?: string | number
      sender?: { id?: string; name?: string; role?: string }
      senderType?: 'customer' | 'agent'
      platform?: string
    },
    _options?: { incrementUnread?: boolean; moveToTop?: boolean }
  ) => boolean
  moveConversationToTop: (_conversationId: string) => void
  pollConversations: () => Promise<void>
}
