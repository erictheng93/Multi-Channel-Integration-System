import { defineStore } from 'pinia'
import { ref, computed, watch, type WatchStopHandle } from 'vue'
import type { Conversation, ConversationFilters, Message, Platform, PaginatedResponse } from '@/types'
import { conversationApi } from '@/api/conversations'
import { messageApi } from '@/api/message'
import { useAuthStore } from './auth'
import { translateError } from '@/utils/error-handler'
import { conversationCache } from '@/services/cacheManager'
// CONVERSATION_STATUS used by sub-modules (realtimeHandler, assignmentActions), not directly here
import { useWebSocketStore, type SubscriptionId } from './websocket'

// Sub-module imports
import type { SyncStatus, TransferredConversationState, ReceivedConversationState } from './conversations/types'
import { hasConversationChanged, computeStatsFromConversations } from './conversations/helpers'
import { createRealtimeHandler } from './conversations/realtimeHandler'
import { createAssignmentActions } from './conversations/assignmentActions'
import { createBackgroundSync } from './conversations/backgroundSync'
import { createCacheStrategy } from './conversations/cacheStrategy'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('conversations')

export const useConversationsStore = defineStore('conversations', () => {
  // ═══════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════
  const conversations = ref<Conversation[]>([])
  const currentConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])

  // Transferred conversation state - tracks when a conversation is transferred AWAY while viewing
  const transferredConversation = ref<TransferredConversationState | null>(null)
  // Received conversation state - tracks when a conversation is transferred INTO the user's team while viewing
  const receivedConversation = ref<ReceivedConversationState | null>(null)

  // Enhanced loading states for smooth UX
  const loading = ref(false) // Initial load
  const refreshing = ref(false) // User refresh
  const updating = ref(false) // Background updates
  const loadingMore = ref(false) // Pagination

  const error = ref<string | null>(null)
  const messagesLoading = ref(false)
  const sendingMessage = ref(false)
  const optimisticMessages = ref<Message[]>([])

  // Performance tracking
  const lastUpdateTime = ref<Date | null>(null)
  const updateCount = ref(0)

  // WebSocket subscription
  const wsStore = useWebSocketStore()
  let conversationsSubscriptionId: SubscriptionId | null = null
  let stopReconnectionWatcher: WatchStopHandle | null = null

  const syncStatus = computed<SyncStatus>(() => {
    const globalState = wsStore.connectionState
    if (globalState === 'connected') { return 'connected' }
    if (globalState === 'connecting' || globalState === 'reconnecting') { return 'connecting' }
    if (globalState === 'error') { return 'error' }
    return 'disconnected'
  })

  // Filters and Pagination
  const filters = ref<ConversationFilters>({
    status: undefined,
    platform: undefined,
    teamId: undefined
  })

  // Active filters set by controller - used by all fetch paths (polling, refresh, silent refresh)
  const activeFilters = ref<ConversationFilters>({})
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })

  // Stats
  const stats = ref({
    total: 0,
    active: 0,
    assigned: 0,
    pending: 0,
    unreadCount: 0
  })

  // ═══════════════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════════════
  const allMessages = computed(() => {
    const allMsgs = [...messages.value, ...optimisticMessages.value]
    return allMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  })

  const unreadConversations = computed(() =>
    conversations.value.filter(c => c.unreadCount && c.unreadCount > 0)
  )

  const isLoading = computed(() => loading.value || refreshing.value || updating.value)
  const showSkeleton = computed(() => loading.value && conversations.value.length === 0)
  const showShimmer = computed(() => (refreshing.value || updating.value) && conversations.value.length > 0)
  const canLoadMore = computed(() =>
    pagination.value.page < pagination.value.totalPages && !loadingMore.value
  )

  // ═══════════════════════════════════════════════════════════════════
  // Utility functions (kept in main store - used by many sub-modules)
  // ═══════════════════════════════════════════════════════════════════
  const clearError = () => {
    error.value = null
  }

  const clearTransferredState = () => {
    transferredConversation.value = null
  }

  const clearReceivedState = () => {
    receivedConversation.value = null
  }

  const handleError = (err: unknown, defaultMessage: string) => {
    console.error(err)
    error.value = translateError(err, defaultMessage)
    setTimeout(clearError, 5000)
  }

  // Smart merge function to update only changed conversations
  const updateConversationsIncrementally = (newConversations: Conversation[], logChanges = false) => {
    const startTime = performance.now()
    const existingMap = new Map(conversations.value.map(c => [c.id, c]))

    let changedCount = 0
    let addedCount = 0

    const updatedList = newConversations.map(newConv => {
      const existing = existingMap.get(newConv.id)

      if (!existing) {
        addedCount++
        return newConv
      } else if (!hasConversationChanged(existing, newConv)) {
        return existing
      } else {
        changedCount++
        return newConv
      }
    })

    const removedCount = conversations.value.length - newConversations.length
    conversations.value = updatedList
    lastUpdateTime.value = new Date()
    updateCount.value++

    if (logChanges) {
      const duration = performance.now() - startTime
      frontendLogger.debug(`[ConversationsStore] Incremental update completed:`, {
        total: updatedList.length,
        changed: changedCount,
        added: addedCount,
        removed: removedCount,
        duration: `${duration.toFixed(2)}ms`,
        updateCount: updateCount.value
      })
    }
  }

  // Legacy method for backward compatibility
  const updateConversationInList = (updatedConversation: Conversation) => {
    const index = conversations.value.findIndex(c => c.id === updatedConversation.id)
    if (index !== -1) {
      conversations.value.splice(index, 1, updatedConversation)
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Real-Time Direct Update Methods (Phase B4)
  // ═══════════════════════════════════════════════════════════════════

  const moveConversationToTop = (conversationId: string) => {
    const index = conversations.value.findIndex(c => c.id === conversationId)
    if (index > 0) {
      const removed = conversations.value.splice(index, 1)
      if (removed.length > 0 && removed[0]) {
        conversations.value.unshift(removed[0])
        frontendLogger.debug(`[ConversationsStore] Moved conversation ${conversationId} to top`)
      }
    }
  }

  const updateStatsFromConversations = () => {
    stats.value = computeStatsFromConversations(conversations.value)
  }

  const updateConversationFromWebSocketMessage = (
    conversationId: string,
    messageData: {
      content?: string
      messageType?: string
      timestamp?: string | number
      sender?: { id?: string; name?: string; role?: string }
      senderType?: 'customer' | 'agent'
      platform?: string
    },
    options: { incrementUnread?: boolean; moveToTop?: boolean } = {}
  ) => {
    const { incrementUnread = true, moveToTop = true } = options
    const index = conversations.value.findIndex(c => c.id === conversationId)

    if (index === -1) {
      frontendLogger.debug(`[ConversationsStore] Conversation ${conversationId} not found in list, will fetch via polling`)
      pollConversations()
      return false
    }

    const conversation = conversations.value[index]
    if (!conversation) {
      frontendLogger.debug(`[ConversationsStore] Conversation object is undefined at index ${index}`)
      pollConversations()
      return false
    }

    const nowTimestamp = messageData.timestamp
      ? (typeof messageData.timestamp === 'number'
          ? messageData.timestamp
          : new Date(messageData.timestamp).getTime())
      : Date.now()

    const updatedConversation: Conversation = {
      ...conversation,
      lastMessageAt: nowTimestamp,
      updatedAt: nowTimestamp,
      firstResponseAt: messageData.senderType === 'agent'
        ? (conversation.firstResponseAt || nowTimestamp)
        : conversation.firstResponseAt,
      lastMessage: messageData.content ? {
        id: crypto.randomUUID(),
        conversationId,
        content: messageData.content,
        messageType: (messageData.messageType || 'text') as Message['messageType'],
        senderType: (messageData.senderType || (messageData.sender?.role === 'customer' ? 'customer' : 'agent')) as Message['senderType'],
        senderId: messageData.sender?.id || '',
        platform: (messageData.platform || conversation.platform || 'line') as Message['platform'],
        timestamp: nowTimestamp,
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
        deliveryStatus: 'delivered'
      } : conversation.lastMessage,
      unreadCount: incrementUnread && messageData.senderType === 'customer'
        ? (conversation.unreadCount || 0) + 1
        : conversation.unreadCount || 0
    }

    conversations.value.splice(index, 1, updatedConversation)
    conversationCache.setConversation(updatedConversation)

    if (moveToTop) {
      moveConversationToTop(conversationId)
    }

    updateStatsFromConversations()

    frontendLogger.debug(`[ConversationsStore] Real-time update applied to conversation ${conversationId}`, {
      lastMessage: messageData.content?.substring(0, 30),
      unreadCount: updatedConversation.unreadCount,
      movedToTop: moveToTop,
      firstResponseAt: updatedConversation.firstResponseAt,
      senderType: messageData.senderType
    })

    return true
  }

  const updateConversationStatus = (
    conversationId: string,
    updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'unreadCount' | 'assignedTeam'>>
  ) => {
    let listUpdated = false
    let currentUpdated = false

    const index = conversations.value.findIndex(c => c.id === conversationId)

    if (index !== -1) {
      const conversation = conversations.value[index]
      if (conversation) {
        const updatedConversation: Conversation = {
          ...conversation,
          ...updates,
          updatedAt: Date.now()
        }

        conversations.value.splice(index, 1, updatedConversation)
        conversationCache.setConversation(updatedConversation)
        updateStatsFromConversations()
        listUpdated = true

        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value = updatedConversation
          currentUpdated = true
        }

        frontendLogger.debug(`[ConversationsStore] Status update applied to conversation ${conversationId}`, {
          updates,
          listUpdated,
          currentUpdated
        })
      }
    }

    // FIX: Update currentConversation even if not in list
    if (!currentUpdated && currentConversation.value && currentConversation.value.id === conversationId) {
      frontendLogger.debug(`[ConversationsStore] Conversation not in list, but updating currentConversation:`, {
        conversationId,
        updates
      })

      currentConversation.value = {
        ...currentConversation.value,
        ...updates,
        updatedAt: Date.now()
      }
      currentUpdated = true

      frontendLogger.debug(`[ConversationsStore] Updated currentConversation (not in list) for ${conversationId}`)
    }

    if (!listUpdated && !currentUpdated) {
      frontendLogger.debug(`[ConversationsStore] Conversation ${conversationId} not found in list or currentConversation`)
    }

    return listUpdated || currentUpdated
  }

  // ═══════════════════════════════════════════════════════════════════
  // Sub-module: Realtime handler
  // ═══════════════════════════════════════════════════════════════════
  const { handleRealtimeUpdate, pollConversations } = createRealtimeHandler({
    conversations,
    currentConversation,
    transferredConversation,
    receivedConversation,
    stats,
    lastUpdateTime,
    activeFilters,
    error,
    updateConversationFromWebSocketMessage,
    updateConversationStatus,
    updateConversationsIncrementally,
    updateStatsFromConversations
  })

  // ═══════════════════════════════════════════════════════════════════
  // Sub-module: Assignment actions
  // ═══════════════════════════════════════════════════════════════════
  const {
    assignConversation,
    assignConversationToTeam,
    unassignConversation,
    transferConversationToTeam
  } = createAssignmentActions({
    conversations,
    currentConversation,
    error,
    handleError
  })

  // ═══════════════════════════════════════════════════════════════════
  // Sub-module: Cache strategy
  // ═══════════════════════════════════════════════════════════════════
  const {
    optimisticUpdateConversation,
    loadWithCache,
    preloadNextPage,
    preloadAdjacentConversationMessages
  } = createCacheStrategy({
    conversations,
    loading,
    updating,
    error,
    filters,
    pagination,
    handleError,
    updateConversationsIncrementally,
    getCurrentUserId: () => useAuthStore().currentAgent?.id
  })

  // ═══════════════════════════════════════════════════════════════════
  // Sub-module: Background sync
  // ═══════════════════════════════════════════════════════════════════
  const {
    startBackgroundSync,
    stopBackgroundSync,
    handleVisibilityChange,
    triggerReconnectionSync,
    startPendingCleanup,
    stopPendingCleanup
  } = createBackgroundSync({
    conversations,
    pollConversations,
    updateStatsFromConversations
  })

  // ═══════════════════════════════════════════════════════════════════
  // Fetch methods
  // ═══════════════════════════════════════════════════════════════════

  const fetchConversations = async (newFilters?: ConversationFilters, page = 1, append = false) => {
    if (newFilters) {
      filters.value = { ...newFilters }
      activeFilters.value = { ...newFilters }
    }

    loading.value = true
    error.value = null

    try {
      const cleanFilters: Record<string, unknown> = {}
      if (filters.value.status) { cleanFilters.status = filters.value.status }
      if (filters.value.platform) { cleanFilters.platform = filters.value.platform }
      if (filters.value.teamId) { cleanFilters.teamId = filters.value.teamId }
      if (filters.value.search) { cleanFilters.search = filters.value.search }
      if (filters.value.tagIds && filters.value.tagIds.length > 0) { cleanFilters.tagIds = filters.value.tagIds }
      if (filters.value.customerName) { cleanFilters.customerName = filters.value.customerName }
      if (filters.value.updatedAfter) { cleanFilters.updatedAfter = filters.value.updatedAfter }
      if (filters.value.updatedBefore) { cleanFilters.updatedBefore = filters.value.updatedBefore }

      const response = await conversationApi.list({
        page,
        pageSize: pagination.value.pageSize,
        ...cleanFilters
      })

      if (response.success && response.data) {
        let conversationList: Conversation[]
        let paginationData: Omit<PaginatedResponse<unknown>, 'items'>

        if (Array.isArray(response.data)) {
          conversationList = response.data as Conversation[]
          paginationData = {
            page: typeof page === 'string' ? parseInt(page) : page,
            pageSize: pagination.value.pageSize,
            total: conversationList.length,
            totalPages: Math.ceil(conversationList.length / pagination.value.pageSize)
          }
        } else {
          const data = response.data as PaginatedResponse<Conversation>
          conversationList = data.items || []
          paginationData = {
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            totalPages: data.totalPages
          }
        }

        if (append) {
          const existingIds = new Set(conversations.value.map(c => c.id))
          const newConversations = conversationList.filter(c => !existingIds.has(c.id))
          conversations.value = [...conversations.value, ...newConversations]

          if (newConversations.length > 0) {
            frontendLogger.debug(`[ConversationsStore] Loaded ${newConversations.length} more conversations`)
          }
        } else {
          updateConversationsIncrementally(conversationList, import.meta.env.DEV)
        }

        pagination.value = paginationData
      } else {
        handleError(response.error, '獲取對話列表失敗')
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入對話列表')
    } finally {
      loading.value = false
      refreshing.value = false
      updating.value = false
      loadingMore.value = false
    }
  }

  const refreshConversations = async () => {
    frontendLogger.debug('[ConversationsStore] User refresh triggered, activeFilters:', activeFilters.value)
    await fetchConversations(activeFilters.value, 1, false)
  }

  const loadMoreConversations = async () => {
    const nextPage = pagination.value.page + 1
    frontendLogger.debug(`[ConversationsStore] Loading page ${nextPage}`)
    await fetchConversations(undefined, nextPage, true)
  }

  const silentRefresh = async () => {
    frontendLogger.debug('[ConversationsStore] Silent background refresh, activeFilters:', activeFilters.value)
    await fetchConversations(activeFilters.value, 1, false)
  }

  const setActiveFilters = (newFilters: ConversationFilters) => {
    activeFilters.value = { ...newFilters }
    frontendLogger.debug('[ConversationsStore] Active filters updated:', activeFilters.value)
  }

  const fetchConversation = async (id: string) => {
    if (!id) { return }

    const existing = conversations.value.find(c => c.id === id)
    if (existing) {
      currentConversation.value = existing
    }

    loading.value = true
    error.value = null

    try {
      const response = await conversationApi.getConversation(id)
      if (response.success && response.data) {
        currentConversation.value = response.data
        updateConversationInList(response.data)
      } else {
        handleError(response.error, '無法載入對話詳情')
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入對話')
    } finally {
      loading.value = false
    }
  }

  const fetchMessages = async (conversationId: string, append = false) => {
    if (!conversationId) { return }

    messagesLoading.value = true
    error.value = null

    try {
      const response = await messageApi.list(conversationId)
      if (response.success && response.data) {
        if (append) {
          messages.value = [...messages.value, ...response.data]
        } else {
          messages.value = response.data
        }
        optimisticMessages.value = []
      } else {
        handleError(response.error, '無法載入訊息')
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入訊息')
    } finally {
      messagesLoading.value = false
    }
  }

  const sendMessage = async (conversationId: string, content: string, platform?: Platform) => {
    if (!conversationId) {
      error.value = '沒有選擇對話'
      return false
    }

    if (!content || !content.trim()) {
      return false
    }

    const authStore = useAuthStore()
    if (!authStore.currentAgent) { return false }

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: authStore.currentAgent.id,
      senderType: 'agent',
      content: content.trim(),
      timestamp: new Date(),
      createdAt: new Date(),
      platform: platform || 'line',
      messageType: 'text'
    }

    optimisticMessages.value.push(optimisticMessage)
    sendingMessage.value = true
    error.value = null

    try {
      const response = await messageApi.send(conversationId, {
        content: content.trim(),
        platform: platform || 'line',
        messageType: 'text'
      })

      if (response.success && response.data) {
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        messages.value.push(response.data)

        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value.lastMessage = response.data
          updateConversationInList(currentConversation.value)
        }

        return true
      } else {
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        handleError(response.error, '訊息發送失敗')
        return false
      }
    } catch (err) {
      optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
      handleError(err, '網路錯誤，訊息發送失敗')
      return false
    } finally {
      sendingMessage.value = false
    }
  }

  const markAsRead = async (conversationId: string) => {
    if (!conversationId) { return false }

    try {
      const response = await conversationApi.markAsRead(conversationId)
      if (response.success) {
        const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
        if (conversationIndex !== -1) {
          const current = conversations.value[conversationIndex]
          if (current) {
            const updatedConversation: Conversation = {
              ...current,
              id: current.id,
              userId: current.userId,
              customer: current.customer,
              unreadCount: 0
            }
            conversations.value[conversationIndex] = updatedConversation
          }
        }

        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value.unreadCount = 0
        }

        return true
      } else {
        handleError(response.error, '標記已讀失敗')
        return false
      }
    } catch (err) {
      handleError(err, '網路錯誤，標記已讀失敗')
      return false
    }
  }

  const loadMore = async () => {
    if (pagination.value.page >= pagination.value.totalPages) { return }
    await fetchConversations(filters.value, pagination.value.page + 1, true)
  }

  const refresh = async () => {
    await fetchConversations(filters.value)
  }

  const clearMessages = () => {
    messages.value = []
    optimisticMessages.value = []
  }

  const setConversations = (newConversations: Conversation[]) => {
    conversations.value = newConversations
  }

  // Test compatibility aliases
  const loadConversations = fetchConversations
  const loadMessages = fetchMessages
  const loadStats = async () => {
    try {
      const response = await conversationApi.getStats?.()
      if (response?.success && response.data) {
        stats.value = response.data
      } else {
        stats.value = computeStatsFromConversations(conversations.value)
      }
    } catch (err) {
      stats.value = computeStatsFromConversations(conversations.value)
      handleError(err, '統計資料載入失敗')
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Realtime initialization & cleanup
  // ═══════════════════════════════════════════════════════════════════

  const initializeRealtime = async () => {
    if (conversationsSubscriptionId) {
      frontendLogger.debug(`[ConversationsStore] Already subscribed to conversations (ID: ${conversationsSubscriptionId.substring(0, 8)}), skipping`)
      return
    }

    frontendLogger.debug('[ConversationsStore] Initializing real-time sync (Phase B3)...')

    updating.value = true

    if (!wsStore.isConnected) {
      frontendLogger.debug('[ConversationsStore] Connecting to global WebSocket...')
      await wsStore.connect()
    }

    conversationsSubscriptionId = wsStore.subscribe('conversations', (message) => {
      frontendLogger.debug('[ConversationsStore] Received message on conversations channel:', {
        type: message.type,
        conversationId: message.conversationId,
        action: (message.data as Record<string, unknown>)?.action
      })
      handleRealtimeUpdate(message)
    })

    if (!stopReconnectionWatcher) {
      stopReconnectionWatcher = watch(
        () => wsStore.connectionState,
        async (newState, oldState) => {
          if (oldState === 'reconnecting' && newState === 'connected') {
            frontendLogger.debug('[ConversationsStore] WebSocket reconnected; triggering reconciliation sync')
            await triggerReconnectionSync()
          }
        }
      )
      frontendLogger.debug('[ConversationsStore] Added WebSocket reconnection watcher')
    }

    // Start LIFF pending cleanup timer
    startPendingCleanup()

    // Start background sync
    startBackgroundSync()

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    frontendLogger.debug('[ConversationsStore] Added visibility change listener')

    updating.value = false

    frontendLogger.debug(`[ConversationsStore] Subscribed to conversations (ID: ${conversationsSubscriptionId?.substring(0, 8)})`)
  }

  const cleanup = () => {
    frontendLogger.debug('[ConversationsStore] Cleaning up real-time sync...')

    if (conversationsSubscriptionId) {
      wsStore.unsubscribe(conversationsSubscriptionId)
      conversationsSubscriptionId = null
      frontendLogger.debug('[ConversationsStore] Unsubscribed from conversations')
    }

    if (stopReconnectionWatcher) {
      stopReconnectionWatcher()
      stopReconnectionWatcher = null
      frontendLogger.debug('[ConversationsStore] Removed WebSocket reconnection watcher')
    }

    stopPendingCleanup()
    stopBackgroundSync()

    document.removeEventListener('visibilitychange', handleVisibilityChange)
    frontendLogger.debug('[ConversationsStore] Removed visibility change listener')

    error.value = null
    updating.value = false
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API (identical to original - 76 exports)
  // ═══════════════════════════════════════════════════════════════════
  return {
    // State
    conversations,
    currentConversation,
    messages,
    loading,
    loadingMore,
    error,
    messagesLoading,
    sendingMessage,
    optimisticMessages,
    filters,
    pagination,
    stats,
    syncStatus,
    transferredConversation,
    receivedConversation,

    // Computed
    allMessages,
    unreadConversations,
    isLoading,
    showSkeleton,
    showShimmer,
    canLoadMore,

    // Actions
    fetchConversations,
    fetchConversation,
    fetchMessages,
    sendMessage,
    assignConversation,
    assignConversationToTeam,
    transferConversationToTeam,
    unassignConversation,
    markAsRead,
    loadMore,
    loadMoreConversations,
    refresh,
    refreshConversations,
    silentRefresh,
    setActiveFilters,
    activeFilters,
    clearMessages,
    setConversations,
    clearError,
    clearTransferredState,
    clearReceivedState,

    // Optimistic updates and cache strategies
    optimisticUpdateConversation,
    loadWithCache,
    preloadNextPage,
    preloadAdjacentConversationMessages,

    // Test compatibility methods
    loadConversations,
    loadMessages,
    loadStats,

    // Utilities
    updateConversationInList,

    // Real-time sync (Phase B1)
    initializeRealtime,
    cleanup,

    // Background Sync
    triggerReconnectionSync,

    // Real-time direct updates (Phase B4)
    updateConversationFromWebSocketMessage,
    updateConversationStatus,
    moveConversationToTop,
    updateStatsFromConversations
  }
})
