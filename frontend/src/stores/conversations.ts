import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, ConversationFilters, Message, Platform, PaginatedResponse } from '@/types'
import { conversationApi } from '@/api/conversations'
import { messageApi } from '@/api/message'
import { useAuthStore } from './auth'
import { translateError } from '@/utils/error-handler'
import { normalizeTeamId } from '@/utils/type-normalization'
import { conversationCache, cacheManager } from '@/services/cacheManager'
import { CONVERSATION_STATUS, type ConversationStatus } from '@/constants/conversation-status'
import { useWebSocketStore, type SubscriptionId } from './websocket'
import type { WebSocketMessage } from '@/services/websocketClient'

// Interface removed as it's not used

// ✅ 方案 B 阶段 3: 使用全局 WebSocket Store
// 同步状态类型（向后兼容）
type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'polling' | 'error'

export const useConversationsStore = defineStore('conversations', () => {
  // State
  const conversations = ref<Conversation[]>([])
  const currentConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])

  // 🆕 Transferred conversation state - tracks when a conversation is transferred while viewing
  const transferredConversation = ref<{
    conversationId: string
    toTeamName: string
    transferredAt: string
  } | null>(null)
  
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

  // ✅ 方案 B 阶段 3: 全局 WebSocket 订阅
  const wsStore = useWebSocketStore()
  let conversationsSubscriptionId: SubscriptionId | null = null

  // 🆕 LIFF 預通知：Pending 對話清理配置
  const PENDING_CONVERSATION_TTL = 60000 // 60 秒後清理未完成的 pending 對話
  const PENDING_CLEANUP_INTERVAL = 30000 // 每 30 秒檢查一次
  let pendingConversationCleanupInterval: ReturnType<typeof setInterval> | null = null

  // 🆕 Background Sync 配置 (Optimistic UI + Background Sync 模式)
  const BACKGROUND_SYNC_INTERVAL = 30000 // 每 30 秒同步一次
  let backgroundSyncInterval: ReturnType<typeof setInterval> | null = null
  let isPageVisible = true // 追蹤頁面可見性

  const syncStatus = computed<SyncStatus>(() => {
    // 映射全局 WebSocket 状态到本地状态（向后兼容）
    const globalState = wsStore.connectionState
    if (globalState === 'connected') return 'connected'
    if (globalState === 'connecting' || globalState === 'reconnecting') return 'connecting'
    if (globalState === 'error') return 'error'
    return 'disconnected'
  })

  // Filters and Pagination
  // Note: Individual assignment (assignedTo) removed - only team-based filtering is supported now
  const filters = ref<ConversationFilters>({
    status: undefined,
    platform: undefined,
    teamId: undefined
  })
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })

  // Stats
  const stats = ref({
    total: 0,
    open: 0,
    assigned: 0,
    closed: 0,
    unreadCount: 0
  })

  // Computed
  const allMessages = computed(() => {
    // Combine real messages with optimistic messages
    const allMsgs = [...messages.value, ...optimisticMessages.value]
    return allMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  })

  const unreadConversations = computed(() =>
    conversations.value.filter(c => c.unreadCount && c.unreadCount > 0)
  )

  // Note: assignedToMeConversations removed - individual assignment is no longer supported
  // Use team-based filtering instead via assignedTeamId
  
  // Enhanced computed properties for loading states
  const isLoading = computed(() => loading.value || refreshing.value || updating.value)
  const showSkeleton = computed(() => loading.value && conversations.value.length === 0)
  const showShimmer = computed(() => (refreshing.value || updating.value) && conversations.value.length > 0)
  const canLoadMore = computed(() => 
    pagination.value.page < pagination.value.totalPages && !loadingMore.value
  )

  // Utility functions
  const clearError = () => {
    error.value = null
  }

  // 🆕 Clear transferred conversation state
  const clearTransferredState = () => {
    transferredConversation.value = null
  }

  const handleError = (err: unknown, defaultMessage: string) => {
    console.error(err)
    // 使用錯誤處理工具來翻譯錯誤訊息
    error.value = translateError(err, defaultMessage)
    setTimeout(clearError, 5000) // Auto clear error after 5 seconds
  }

  // Conversation comparison for change detection
  const hasConversationChanged = (existing: Conversation, updated: Conversation): boolean => {
    if (!existing || !updated) {return true}

    // Compare key fields that would affect UI rendering
    // Note: assignedAgentId/assignedAgent removed - only team assignment is supported now
    const keyFields = [
      'id', 'status', 'unreadCount', 'lastMessageAt', 'lastMessage', 'priority',
      'assignedTeamId', 'assignedTeam', 'customerName', 'platform'
    ] as const
    
    return keyFields.some(field => {
      const existingValue = existing[field as keyof Conversation]
      const updatedValue = updated[field as keyof Conversation]
      return JSON.stringify(existingValue) !== JSON.stringify(updatedValue)
    })
  }
  
  // Smart merge function to update only changed conversations
  const updateConversationsIncrementally = (newConversations: Conversation[], logChanges = false) => {
    const startTime = performance.now()
    const existingMap = new Map(conversations.value.map(c => [c.id, c]))
    
    let changedCount = 0
    let addedCount = 0
    let removedCount = 0
    
    // Create updated list with minimal changes
    const updatedList = newConversations.map(newConv => {
      const existing = existingMap.get(newConv.id)
      
      if (!existing) {
        addedCount++
        return newConv
      } else if (!hasConversationChanged(existing, newConv)) {
        // No change, keep existing object reference to avoid re-render
        return existing
      } else {
        changedCount++
        return newConv
      }
    })
    
    // Check for removed conversations
    removedCount = conversations.value.length - newConversations.length
    
    // Update conversations array
    conversations.value = updatedList
    
    // Update tracking
    lastUpdateTime.value = new Date()
    updateCount.value++
    
    if (logChanges) {
      const duration = performance.now() - startTime
      console.log(`📊 [ConversationsStore] Incremental update completed:`, {
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
      // Use splice to trigger reactivity properly without causing infinite loops
      conversations.value.splice(index, 1, updatedConversation)
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🚀 Real-Time Direct Update Methods (Phase B4)
  // 直接更新對話列表，無需 HTTP 輪詢
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 將對話移動到列表頂部
   * 用於新訊息到達時的排序
   */
  const moveConversationToTop = (conversationId: string) => {
    const index = conversations.value.findIndex(c => c.id === conversationId)
    if (index > 0) {
      // Remove from current position and add to front
      const removed = conversations.value.splice(index, 1)
      if (removed.length > 0 && removed[0]) {
        conversations.value.unshift(removed[0])
        console.log(`📍 [ConversationsStore] Moved conversation ${conversationId} to top`)
      }
    }
  }

  /**
   * 從 WebSocket 訊息事件直接更新對話
   * 避免不必要的 HTTP 請求
   */
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
      console.log(`⚠️ [ConversationsStore] Conversation ${conversationId} not found in list, will fetch via polling`)
      // 對話不在列表中，可能是新對話，觸發輪詢獲取
      pollConversations()
      return false
    }

    const conversation = conversations.value[index]
    if (!conversation) {
      console.log(`⚠️ [ConversationsStore] Conversation object is undefined at index ${index}`)
      pollConversations()
      return false
    }

    // 計算時間戳 (毫秒)
    const nowTimestamp = messageData.timestamp
      ? (typeof messageData.timestamp === 'number'
          ? messageData.timestamp
          : new Date(messageData.timestamp).getTime())
      : Date.now()

    // 構建更新後的對話物件
    const updatedConversation: Conversation = {
      ...conversation,
      lastMessageAt: nowTimestamp,
      updatedAt: nowTimestamp,
      // 更新 lastMessage（如果有內容）
      lastMessage: messageData.content ? {
        id: crypto.randomUUID(), // 臨時 ID
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
      // 增加未讀計數（僅當訊息來自客戶時）
      unreadCount: incrementUnread && messageData.senderType === 'customer'
        ? (conversation.unreadCount || 0) + 1
        : conversation.unreadCount || 0
    }

    // 使用 splice 觸發 Vue 響應式更新
    conversations.value.splice(index, 1, updatedConversation)

    // 更新快取
    conversationCache.setConversation(updatedConversation)

    // 移動到頂部
    if (moveToTop) {
      moveConversationToTop(conversationId)
    }

    // 更新統計
    updateStatsFromConversations()

    console.log(`✅ [ConversationsStore] Real-time update applied to conversation ${conversationId}`, {
      lastMessage: messageData.content?.substring(0, 30),
      unreadCount: updatedConversation.unreadCount,
      movedToTop: moveToTop
    })

    return true
  }

  /**
   * 從對話列表計算統計資訊
   */
  const updateStatsFromConversations = () => {
    stats.value = {
      total: conversations.value.length,
      open: conversations.value.filter(c =>
        c.status === CONVERSATION_STATUS.PENDING ||
        c.status === CONVERSATION_STATUS.ACTIVE
      ).length,
      assigned: conversations.value.filter(c =>
        c.status === CONVERSATION_STATUS.IN_PROGRESS
      ).length,
      closed: conversations.value.filter(c =>
        c.status === CONVERSATION_STATUS.CLOSED ||
        c.status === CONVERSATION_STATUS.RESOLVED
      ).length,
      unreadCount: conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
    }
  }

  /**
   * 更新對話狀態（指派、狀態變更等）
   * Note: Individual assignment (assignedAgentId/assignedAgent) removed - only team assignment is supported now
   */
  const updateConversationStatus = (
    conversationId: string,
    updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'unreadCount' | 'assignedTeam'>>
  ) => {
    let listUpdated = false
    let currentUpdated = false

    // 1. 嘗試更新列表中的對話
    const index = conversations.value.findIndex(c => c.id === conversationId)

    if (index !== -1) {
      const conversation = conversations.value[index]
      if (conversation) {
        const updatedConversation: Conversation = {
          ...conversation,
          ...updates,
          updatedAt: Date.now() // Unix timestamp in milliseconds
        }

        conversations.value.splice(index, 1, updatedConversation)
        conversationCache.setConversation(updatedConversation)
        updateStatsFromConversations()
        listUpdated = true

        // 如果這也是當前對話，同步更新
        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value = updatedConversation
          currentUpdated = true
        }

        console.log(`✅ [ConversationsStore] Status update applied to conversation ${conversationId}`, {
          updates,
          listUpdated,
          currentUpdated
        })
      }
    }

    // 2. 🆕 FIX: 即使對話不在列表中，也要嘗試更新 currentConversation
    // 這解決了轉移事件導致對話從列表移除後，詳情頁無法更新的問題
    if (!currentUpdated && currentConversation.value && currentConversation.value.id === conversationId) {
      console.log(`🔍 [ConversationsStore] Conversation not in list, but updating currentConversation:`, {
        conversationId,
        updates
      })

      currentConversation.value = {
        ...currentConversation.value,
        ...updates,
        updatedAt: Date.now()
      }
      currentUpdated = true

      console.log(`🔄 [ConversationsStore] Updated currentConversation (not in list) for ${conversationId}`)
    }

    if (!listUpdated && !currentUpdated) {
      console.log(`⚠️ [ConversationsStore] Conversation ${conversationId} not found in list or currentConversation`)
    }

    return listUpdated || currentUpdated
  }

  // ═══════════════════════════════════════════════════════════════════

  // 樂觀更新方法 - 立即更新UI，背景同步API
  const optimisticUpdateConversation = async (
    id: string, 
    updates: Partial<Conversation>,
    apiCall?: () => Promise<{ data?: Conversation }>
  ) => {
    console.log(`⚡ [ConversationsStore] Optimistic update for conversation ${id}:`, updates)
    
    // 1. 立即更新本地狀態
    const index = conversations.value.findIndex(c => c.id === id)
    if (index !== -1) {
      const originalConversation = { ...conversations.value[index] }
      conversations.value[index] = { ...originalConversation, ...updates } as Conversation
      
      // 2. 更新快取
      conversationCache.setConversation(conversations.value[index])
      
      // 3. 背景執行API調用
      if (apiCall) {
        try {
          const result = await apiCall()
          console.log(`✅ [ConversationsStore] API sync completed for ${id}`)
          
          // 4. 用API結果更新（如果有差異）
          if (result?.data && hasConversationChanged(conversations.value[index], result.data)) {
            conversations.value[index] = result.data
            conversationCache.setConversation(result.data)
          }
          
          return { success: true, data: conversations.value[index] }
        } catch (error) {
          console.error(`❌ [ConversationsStore] API sync failed for ${id}, rolling back:`, error)
          
          // 5. 錯誤時回滾到原始狀態
          conversations.value[index] = originalConversation as Conversation
          conversationCache.setConversation(originalConversation as Conversation)
          
          handleError(error, '更新對話失敗')
          return { success: false, error, rollback: true }
        }
      }
      
      return { success: true, data: conversations.value[index] }
    }
    
    console.warn(`⚠️ [ConversationsStore] Conversation ${id} not found for optimistic update`)
    return { success: false, error: 'Conversation not found', rollback: false }
  }

  // 智能快取載入 - 先從快取載入，再背景更新
  const loadWithCache = async (filters: ConversationFilters = {}, page = 1) => {
    console.log(`🧠 [ConversationsStore] Smart cache loading with filters:`, filters)
    
    // 1. 立即從快取載入
    const cached = conversationCache.getConversationList(filters)
    if (cached.data) {
      console.log(`⚡ [ConversationsStore] Cache hit, showing ${cached.data.length} cached conversations`)
      conversations.value = cached.data
      
      // 如果快取不需要更新，直接返回
      if (!cached.needsUpdate) {
        console.log(`✨ [ConversationsStore] Cache is fresh, no API call needed`)
        return { fromCache: true, fresh: true }
      }
    }
    
    // 2. 背景更新（即使有快取）
    const wasFromCache = !!cached.data
    if (wasFromCache) {
      updating.value = true // 使用背景更新狀態
    } else {
      loading.value = true  // 首次載入狀態
    }
    
    try {
      console.log(`🌐 [ConversationsStore] ${wasFromCache ? 'Background' : 'Initial'} API call`)
      
      // Note: Individual assignment filter (assignedTo) removed - only team-based filtering is supported now
      const cleanFilters: Record<string, unknown> = {}
      if (filters.status) {cleanFilters.status = filters.status}
      if (filters.platform) {cleanFilters.platform = filters.platform}
      if (filters.teamId) {cleanFilters.teamId = filters.teamId}

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

        // 3. 智能更新 - 只有真正變化時才更新UI
        if (wasFromCache) {
          updateConversationsIncrementally(conversationList, true)
        } else {
          conversations.value = conversationList
        }
        
        // 4. 更新快取
        conversationCache.setConversationList(conversationList, filters)
        pagination.value = paginationData
        
        console.log(`✅ [ConversationsStore] ${wasFromCache ? 'Background update' : 'Initial load'} completed`)
        return { fromCache: wasFromCache, fresh: true, count: conversationList.length }
      }
      
    } catch (err) {
      console.error(`❌ [ConversationsStore] Smart cache loading failed:`, err)
      if (!wasFromCache) {
        handleError(err, '載入對話失敗')
      }
      return { fromCache: wasFromCache, fresh: false, error: err }
    } finally {
      loading.value = false
      updating.value = false
    }
    
    // 默認返回值 - 應該不會到達這裡
    return { fromCache: false, fresh: false }
  }

  // 預載入下一頁
  const preloadNextPage = async () => {
    const nextPage = pagination.value.page + 1
    if (nextPage > pagination.value.totalPages) {return}

    console.log(`🔮 [ConversationsStore] Preloading page ${nextPage}`)

    try {
      await cacheManager.prefetch(`conversations:page:${nextPage}`, async () => {
        // Filter out empty values (handles both string '' and undefined/null)
        const cleanFilters = Object.fromEntries(
          Object.entries(filters.value).filter(([_key, v]) => v !== undefined && v !== null && v !== '')
        )
        const response = await conversationApi.list({
          page: nextPage,
          pageSize: pagination.value.pageSize,
          ...cleanFilters
        })

        return response.data
      })
    } catch (error) {
      console.warn(`⚠️ [ConversationsStore] Preload failed for page ${nextPage}:`, error)
    }
  }

  // 🚀 智能預加載相鄰對話的消息
  const preloadAdjacentConversationMessages = async (currentConversationId: string) => {
    console.log(`🔮 [ConversationsStore] Starting intelligent preload for adjacent conversations`)

    const currentIndex = conversations.value.findIndex(c => c.id === currentConversationId)
    if (currentIndex === -1) {
      console.warn(`⚠️ [ConversationsStore] Current conversation not found in list`)
      return
    }

    // 🎯 預加載策略：當前對話的上下各一個
    const adjacentConversations: string[] = []

    // 上一個對話
    if (currentIndex > 0) {
      const prevConv = conversations.value[currentIndex - 1]
      if (prevConv?.id) {
        adjacentConversations.push(prevConv.id)
      }
    }

    // 下一個對話
    if (currentIndex < conversations.value.length - 1) {
      const nextConv = conversations.value[currentIndex + 1]
      if (nextConv?.id) {
        adjacentConversations.push(nextConv.id)
      }
    }

    console.log(`🔮 [ConversationsStore] Preloading ${adjacentConversations.length} adjacent conversations`)

    // 🌐 使用 requestIdleCallback 在瀏覽器空閒時預加載
    // 避免影響當前對話的性能
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        adjacentConversations.forEach(async (convId) => {
          if (!convId) {return}
          try {
            await cacheManager.prefetch(`conversation:messages:${convId}`, async () => {
              const { messageApi } = await import('@/api/message')
              const response = await messageApi.listPaginated(convId, {
                page: 1,
                pageSize: 10 // 只預加載最新 10 條
              })
              return response.data
            })
            console.log(`✅ [ConversationsStore] Preloaded messages for conversation ${convId}`)
          } catch (error) {
            console.warn(`⚠️ [ConversationsStore] Failed to preload ${convId}:`, error)
          }
        })
      })
    } else {
      // 降級方案：使用 setTimeout
      setTimeout(() => {
        adjacentConversations.forEach(async (convId) => {
          if (!convId) {return}
          try {
            await cacheManager.prefetch(`conversation:messages:${convId}`, async () => {
              const { messageApi } = await import('@/api/message')
              const response = await messageApi.listPaginated(convId, {
                page: 1,
                pageSize: 10
              })
              return response.data
            })
          } catch (error) {
            console.warn(`⚠️ [ConversationsStore] Failed to preload ${convId}:`, error)
          }
        })
      }, 1000) // 1秒後執行
    }
  }

  // Enhanced fetch methods with better error handling
  const fetchConversations = async (newFilters?: ConversationFilters, page = 1, append = false) => {
    if (newFilters) {
      filters.value = { ...newFilters }
    }

    loading.value = true
    error.value = null

    try {
      // Clean undefined values for API call
      // Note: Individual assignment filter (assignedTo) removed - only team-based filtering is supported now
      const cleanFilters: Record<string, unknown> = {}
      if (filters.value.status) {cleanFilters.status = filters.value.status}
      if (filters.value.platform) {cleanFilters.platform = filters.value.platform}
      if (filters.value.teamId) {cleanFilters.teamId = filters.value.teamId}

      const response = await conversationApi.list({
        page,
        pageSize: pagination.value.pageSize,
        ...cleanFilters
      })

      if (response.success && response.data) {
        // Handle both response formats: array directly or paginated object
        let conversationList: Conversation[]
        let paginationData: Omit<PaginatedResponse<unknown>, 'items'>

        if (Array.isArray(response.data)) {
          // Direct array format from backend
          conversationList = response.data as Conversation[]
          paginationData = {
            page: typeof page === 'string' ? parseInt(page) : page,
            pageSize: pagination.value.pageSize,
            total: conversationList.length,
            totalPages: Math.ceil(conversationList.length / pagination.value.pageSize)
          }
        } else {
          // Paginated response format
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
          // For pagination: merge without duplicates
          const existingIds = new Set(conversations.value.map(c => c.id))
          const newConversations = conversationList.filter(c => !existingIds.has(c.id))
          conversations.value = [...conversations.value, ...newConversations]
          
          if (newConversations.length > 0) {
            console.log(`📄 [ConversationsStore] Loaded ${newConversations.length} more conversations`)
          }
        } else {
          // Use incremental update for better performance
          updateConversationsIncrementally(conversationList, import.meta.env.DEV)
        }

        pagination.value = paginationData
      } else {
        handleError(response.error, '獲取對話列表失敗')

        // 生產環境中不使用模擬數據
        if (import.meta.env.DEV && !import.meta.env.VITEST && !append && !response.error) {
          try {
            const { generateMockConversations } = await import('@/utils/mockData')
            let mockConversations = generateMockConversations(20)

            if (filters.value.status) {
              mockConversations = mockConversations.filter(c => c.status === filters.value.status)
            }
            if (filters.value.platform) {
              mockConversations = mockConversations.filter(c => c.platform === filters.value.platform)
            }

            conversations.value = mockConversations
            console.warn('🔧 [DEV] Using mock data due to API error')
          } catch (mockError) {
            console.error('Failed to load mock data:', mockError)
          }
        }
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入對話列表')

      // Only fallback to mock data in development if not in test environment
      if (import.meta.env.DEV && !append && !import.meta.env.VITEST) {
        try {
          const { generateMockConversations } = await import('@/utils/mockData')
          updateConversationsIncrementally(generateMockConversations(20))
        } catch (mockError) {
          console.error('Failed to load mock data:', mockError)
        }
      }
    } finally {
      // Reset all loading states
      loading.value = false
      refreshing.value = false
      updating.value = false
      loadingMore.value = false
    }
  }
  
  // New methods for different loading scenarios
  const refreshConversations = async () => {
    console.log('🔄 [ConversationsStore] User refresh triggered')
    await fetchConversations(undefined, 1, false)
  }
  
  const loadMoreConversations = async () => {
    const nextPage = pagination.value.page + 1
    console.log(`📄 [ConversationsStore] Loading page ${nextPage}`)
    await fetchConversations(undefined, nextPage, true)
  }
  
  const silentRefresh = async () => {
    console.log('🔕 [ConversationsStore] Silent background refresh')
    await fetchConversations(undefined, 1, false)
  }

  const fetchConversation = async (id: string) => {
    if (!id) {return}

    // Check if conversation already exists in the list
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
        // Update in conversations list if it exists
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
    if (!conversationId) {return}

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
        // Clear optimistic messages after successful fetch
        optimisticMessages.value = []
      } else {
        handleError(response.error, '無法載入訊息')

        // 開發環境模擬數據回退（生產環境中禁用）
        if (import.meta.env.DEV && !import.meta.env.VITEST && !append && !response.error) {
          try {
            const { generateMockMessages } = await import('@/utils/mockData')
            messages.value = generateMockMessages(conversationId, 15)
            console.warn('🔧 [DEV] Using mock messages due to API error')
          } catch (mockError) {
            console.error('Failed to load mock messages:', mockError)
          }
        }
      }
    } catch (err) {
      handleError(err, '網路錯誤，無法載入訊息')

      // Only fallback to mock data in development if not in test environment
      if (import.meta.env.DEV && !append && !import.meta.env.VITEST) {
        try {
          const { generateMockMessages } = await import('@/utils/mockData')
          messages.value = generateMockMessages(conversationId, 15)
        } catch (mockError) {
          console.error('Failed to load mock messages:', mockError)
        }
      }
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
    if (!authStore.currentAgent) {return false}

    // Create optimistic message
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

    // Add optimistic message
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
        // Remove optimistic message and add real message
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        messages.value.push(response.data)

        // Update conversation's last message
        if (currentConversation.value && currentConversation.value.id === conversationId) {
          currentConversation.value.lastMessage = response.data
          updateConversationInList(currentConversation.value)
        }

        return true
      } else {
        // Remove failed optimistic message
        optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
        handleError(response.error, '訊息發送失敗')
        return false
      }
    } catch (err) {
      // Remove failed optimistic message
      optimisticMessages.value = optimisticMessages.value.filter(m => m.id !== optimisticMessage.id)
      handleError(err, '網路錯誤，訊息發送失敗')
      return false
    } finally {
      sendingMessage.value = false
    }
  }

  /**
   * @deprecated Individual assignment is no longer supported. Use assignConversationToTeam instead.
   * This function is kept for backward compatibility but will throw an error.
   */
  const assignConversation = async (_conversationId: string, _agentId: string) => {
    console.error('❌ [ConversationsStore] Individual assignment (assignConversation) is deprecated. Use assignConversationToTeam instead.')
    handleError(new Error('Individual assignment is no longer supported'), '請使用團隊指派功能')
    return false
  }

  // 🆕 指派對話給團隊（僅管理員）
  const assignConversationToTeam = async (conversationId: string, teamId: number, teamName?: string) => {
    if (!conversationId || !teamId) {return false}

    console.log(`📝 [ConversationsStore] Assigning conversation ${conversationId} to team ${teamId} (${teamName || 'Unknown'})`)

    // Optimistic update - 完整更新所有團隊相關字段
    const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
    let originalConversation: Conversation | null = null

    if (conversationIndex !== -1) {
      const current = conversations.value[conversationIndex]
      if (current) {
        originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
        // 🔧 樂觀更新：立即更新UI顯示的所有字段（包括team對象）
        // Note: Individual assignment fields removed - only team assignment is supported now
        const updatedConversation: Conversation = {
          ...current,
          id: current.id,
          userId: current.userId,
          customer: current.customer,
          status: 'assigned' as const,
          assignedTeamId: teamId,
          assignedTeam: teamName ? {
            id: teamId,
            name: teamName,
            description: null
          } : undefined
        }
        conversations.value[conversationIndex] = updatedConversation
        console.log(`⚡ [ConversationsStore] Optimistic update applied to list (team: ${teamName})`)
      }
    }

    // 同時更新 currentConversation
    // Note: Individual assignment fields removed - only team assignment is supported now
    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = {
        ...currentConversation.value,
        status: 'assigned' as const,
        assignedTeamId: teamId,
        assignedTeam: teamName ? {
          id: teamId,
          name: teamName,
          description: null
        } : undefined
      }
      console.log(`⚡ [ConversationsStore] Optimistic update applied to currentConversation (team: ${teamName})`)
    }

    error.value = null

    try {
      const response = await conversationApi.assignConversation(conversationId, { teamId })
      if (response.success) {
        console.log(`✅ [ConversationsStore] Team assignment API call succeeded`)

        // 🔧 FIX: 直接使用 assign API 返回的完整对话对象
        // Backend now returns complete conversation object with assignedTeam
        if (response.data) {
          const updatedConv = response.data
          console.log(`📥 [ConversationsStore] Received updated conversation from assign API:`, {
            id: updatedConv.id,
            status: updatedConv.status,
            assignedTeamId: updatedConv.assignedTeamId,
            assignedTeam: updatedConv.assignedTeam
          })

          // 更新列表中的對話
          if (conversationIndex !== -1) {
            conversations.value[conversationIndex] = updatedConv
            console.log(`✨ [ConversationsStore] Updated conversation in list`)
          }

          // 更新當前對話
          if (currentConversation.value && currentConversation.value.id === conversationId) {
            currentConversation.value = updatedConv
            console.log(`✨ [ConversationsStore] Updated currentConversation`)
          }
        } else {
          // Fallback: 如果 assign API 没有返回 data,则获取完整的更新后数据
          console.warn(`⚠️ [ConversationsStore] Assign API didn't return data, fetching conversation`)
          const detailResponse = await conversationApi.getConversation(conversationId)
          if (detailResponse.success && detailResponse.data) {
            const updatedConv = detailResponse.data

            // 更新列表中的對話
            if (conversationIndex !== -1) {
              conversations.value[conversationIndex] = updatedConv
            }

            // 更新當前對話
            if (currentConversation.value && currentConversation.value.id === conversationId) {
              currentConversation.value = updatedConv
            }
          }
        }

        return true
      } else {
        console.error(`❌ [ConversationsStore] Team assignment API call failed:`, response.error)
        // Revert optimistic update
        if (originalConversation && conversationIndex !== -1) {
          conversations.value[conversationIndex] = originalConversation
        }
        if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
          currentConversation.value = originalConversation
        }
        handleError(response.error, '團隊指派失敗')
        return false
      }
    } catch (err) {
      console.error(`❌ [ConversationsStore] Team assignment failed with exception:`, err)
      // Revert optimistic update
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
        currentConversation.value = originalConversation
      }
      handleError(err, '網路錯誤，團隊指派失敗')
      return false
    }
  }

  // 🆕 取消指派對話（僅管理員）
  const unassignConversation = async (conversationId: string, reason?: string) => {
    if (!conversationId) {return false}

    console.log(`📝 [ConversationsStore] Unassigning conversation ${conversationId}`, reason ? `(reason: ${reason})` : '')

    // Optimistic update - 清除指派資訊，狀態改回 'pending'
    const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
    let originalConversation: Conversation | null = null

    if (conversationIndex !== -1) {
      const current = conversations.value[conversationIndex]
      if (current) {
        originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
        // 🔧 樂觀更新：立即清除指派資訊
        // Note: Individual assignment fields removed - only team assignment is supported now
        const updatedConversation: Conversation = {
          ...current,
          id: current.id,
          userId: current.userId,
          customer: current.customer,
          status: CONVERSATION_STATUS.PENDING,
          assignedTeamId: undefined,
          assignedTeam: undefined
        }
        conversations.value[conversationIndex] = updatedConversation
        console.log(`⚡ [ConversationsStore] Optimistic update applied to list (unassigned)`)
      }
    }

    // 同時更新 currentConversation
    // Note: Individual assignment fields removed - only team assignment is supported now
    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = {
        ...currentConversation.value,
        status: CONVERSATION_STATUS.PENDING,
        assignedTeamId: undefined,
        assignedTeam: undefined
      }
      console.log(`⚡ [ConversationsStore] Optimistic update applied to currentConversation (unassigned)`)
    }

    error.value = null

    try {
      const response = await conversationApi.unassignConversation(conversationId, reason)
      if (response.success) {
        console.log(`✅ [ConversationsStore] Unassign API call succeeded`)

        // 使用 API 返回的完整對話對象更新
        if (response.data) {
          const updatedConv = response.data
          // Note: Individual assignment (assignedUserId) removed - only team-based assignment is supported
          console.log(`📥 [ConversationsStore] Received updated conversation from unassign API:`, {
            id: updatedConv.id,
            status: updatedConv.status,
            assignedTeamId: updatedConv.assignedTeamId
          })

          // 更新列表中的對話
          if (conversationIndex !== -1) {
            conversations.value[conversationIndex] = updatedConv
            console.log(`✨ [ConversationsStore] Updated conversation in list`)
          }

          // 更新當前對話
          if (currentConversation.value && currentConversation.value.id === conversationId) {
            currentConversation.value = updatedConv
            console.log(`✨ [ConversationsStore] Updated currentConversation`)
          }
        } else {
          // Fallback: 如果 API 沒有返回 data，則獲取完整的更新後數據
          console.warn(`⚠️ [ConversationsStore] Unassign API didn't return data, fetching conversation`)
          const detailResponse = await conversationApi.getConversation(conversationId)
          if (detailResponse.success && detailResponse.data) {
            const updatedConv = detailResponse.data

            // 更新列表中的對話
            if (conversationIndex !== -1) {
              conversations.value[conversationIndex] = updatedConv
            }

            // 更新當前對話
            if (currentConversation.value && currentConversation.value.id === conversationId) {
              currentConversation.value = updatedConv
            }
          }
        }

        return true
      } else {
        console.error(`❌ [ConversationsStore] Unassign API call failed:`, response.error)
        // Revert optimistic update
        if (originalConversation && conversationIndex !== -1) {
          conversations.value[conversationIndex] = originalConversation
        }
        if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
          currentConversation.value = originalConversation
        }
        handleError(response.error, '取消指派失敗')
        return false
      }
    } catch (err) {
      console.error(`❌ [ConversationsStore] Unassign failed with exception:`, err)
      // Revert optimistic update
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
        currentConversation.value = originalConversation
      }
      handleError(err, '取消指派失敗')
      return false
    }
  }

  // 🆕 轉移對話到另一個團隊（會觸發三方通知：舊團隊移除、新團隊添加、觀看者更新）
  const transferConversationToTeam = async (
    conversationId: string,
    fromTeamId: number | undefined,
    toTeamId: number,
    toTeamName?: string,
    reason?: string
  ) => {
    if (!conversationId || !toTeamId) { return false }

    console.log(`📝 [ConversationsStore] Transferring conversation ${conversationId} from team ${fromTeamId} to team ${toTeamId} (${toTeamName || 'Unknown'})`)

    // Optimistic update - 更新團隊資訊
    const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
    let originalConversation: Conversation | null = null

    if (conversationIndex !== -1) {
      const current = conversations.value[conversationIndex]
      if (current) {
        originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
        const updatedConversation: Conversation = {
          ...current,
          assignedTeamId: toTeamId,
          assignedTeam: {
            id: toTeamId,
            name: toTeamName || `Team ${toTeamId}`,
            description: null
          }
        }
        conversations.value[conversationIndex] = updatedConversation
        console.log(`⚡ [ConversationsStore] Optimistic update applied (transfer)`)
      }
    }

    // 同時更新 currentConversation
    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = {
        ...currentConversation.value,
        assignedTeamId: toTeamId,
        assignedTeam: {
          id: toTeamId,
          name: toTeamName || `Team ${toTeamId}`,
          description: null
        }
      }
    }

    error.value = null

    try {
      const response = await conversationApi.transferConversation(conversationId, {
        fromTeamId,
        toTeamId,
        reason
      })

      if (response.success) {
        console.log(`✅ [ConversationsStore] Transfer API call succeeded`)

        // 使用 API 返回的完整對話對象更新
        if (response.data) {
          const updatedConv = response.data
          if (conversationIndex !== -1) {
            conversations.value[conversationIndex] = updatedConv
          }
          if (currentConversation.value && currentConversation.value.id === conversationId) {
            currentConversation.value = updatedConv
          }
        }

        return true
      } else {
        console.error(`❌ [ConversationsStore] Transfer API call failed:`, response.error)
        // Revert optimistic update
        if (originalConversation && conversationIndex !== -1) {
          conversations.value[conversationIndex] = originalConversation
        }
        if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
          currentConversation.value = originalConversation
        }
        handleError(response.error, '轉移對話失敗')
        return false
      }
    } catch (err) {
      console.error(`❌ [ConversationsStore] Transfer failed with exception:`, err)
      // Revert optimistic update
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
        currentConversation.value = originalConversation
      }
      handleError(err, '轉移對話失敗')
      return false
    }
  }

  const closeConversation = async (conversationId: string, reason?: string) => {
    if (!conversationId) {return false}

    // Optimistic update
    const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
    let originalConversation: Conversation | null = null

    if (conversationIndex !== -1) {
      const current = conversations.value[conversationIndex]
      if (current) {
        originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
        const updatedConversation: Conversation = {
          ...current,
          id: current.id,
          userId: current.userId,
          customer: current.customer,
          status: 'closed' as const
        }
        conversations.value[conversationIndex] = updatedConversation
      }
    }

    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = {
        ...currentConversation.value,
        status: 'closed' as const
      }
    }

    error.value = null

    try {
      const response = await conversationApi.closeConversation(conversationId, reason)
      if (response.success) {
        return true
      } else {
        // Revert optimistic update
        if (originalConversation && conversationIndex !== -1) {
          conversations.value[conversationIndex] = originalConversation
        }
        handleError(response.error, '對話結束失敗')
        return false
      }
    } catch (err) {
      // Revert optimistic update
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      handleError(err, '網路錯誤，對話結束失敗')
      return false
    }
  }

  // 🆕 重新打開對話 (撤銷關閉操作)
  const reopenConversation = async (conversationId: string) => {
    if (!conversationId) {return false}

    console.log(`📝 [ConversationsStore] Reopening conversation ${conversationId}`)

    // Optimistic update - 將狀態改回 'open'
    const conversationIndex = conversations.value.findIndex(c => c.id === conversationId)
    let originalConversation: Conversation | null = null

    if (conversationIndex !== -1) {
      const current = conversations.value[conversationIndex]
      if (current) {
        originalConversation = JSON.parse(JSON.stringify(current)) as Conversation
        const updatedConversation: Conversation = {
          ...current,
          id: current.id,
          userId: current.userId,
          customer: current.customer,
          status: CONVERSATION_STATUS.ACTIVE
        }
        conversations.value[conversationIndex] = updatedConversation
        console.log(`⚡ [ConversationsStore] Optimistic update applied to list (reopened)`)
      }
    }

    // 同時更新 currentConversation
    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = {
        ...currentConversation.value,
        status: CONVERSATION_STATUS.ACTIVE
      }
      console.log(`⚡ [ConversationsStore] Optimistic update applied to currentConversation (reopened)`)
    }

    error.value = null

    try {
      const response = await conversationApi.reopenConversation(conversationId)
      if (response.success) {
        console.log(`✅ [ConversationsStore] Reopen API call succeeded`)

        // 刷新對話以獲取最新狀態
        await fetchConversation(conversationId)
        return true
      } else {
        console.error(`❌ [ConversationsStore] Reopen API call failed:`, response.error)
        // Revert optimistic update
        if (originalConversation && conversationIndex !== -1) {
          conversations.value[conversationIndex] = originalConversation
        }
        if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
          currentConversation.value = originalConversation
        }
        handleError(response.error, '重新打開對話失敗')
        return false
      }
    } catch (err) {
      console.error(`❌ [ConversationsStore] Reopen failed with exception:`, err)
      // Revert optimistic update
      if (originalConversation && conversationIndex !== -1) {
        conversations.value[conversationIndex] = originalConversation
      }
      if (currentConversation.value && currentConversation.value.id === conversationId && originalConversation) {
        currentConversation.value = originalConversation
      }
      handleError(err, '網路錯誤，重新打開對話失敗')
      return false
    }
  }

  const markAsRead = async (conversationId: string) => {
    if (!conversationId) {return false}

    try {
      const response = await conversationApi.markAsRead(conversationId)
      if (response.success) {
        // Update unread count optimistically
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
    if (pagination.value.page >= pagination.value.totalPages) {return}
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

  // Add missing methods for tests
  const loadConversations = fetchConversations
  const loadMessages = fetchMessages
  const loadStats = async () => {
    try {
      // Try to load stats from API first
      const response = await conversationApi.getStats?.()
      if (response?.success && response.data) {
        stats.value = response.data
      } else {
        // Fallback to calculating from local conversations
        stats.value = {
          total: conversations.value.length,
          open: conversations.value.filter(c => c.status === CONVERSATION_STATUS.PENDING || c.status === CONVERSATION_STATUS.ACTIVE).length,
          assigned: conversations.value.filter(c => c.status === CONVERSATION_STATUS.IN_PROGRESS).length,
          closed: conversations.value.filter(c => c.status === CONVERSATION_STATUS.CLOSED || c.status === CONVERSATION_STATUS.RESOLVED).length,
          unreadCount: conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        }
      }
    } catch (err) {
      // Fallback to calculating from local conversations
      stats.value = {
        total: conversations.value.length,
        open: conversations.value.filter(c => c.status === CONVERSATION_STATUS.PENDING || c.status === CONVERSATION_STATUS.ACTIVE).length,
        assigned: conversations.value.filter(c => c.status === CONVERSATION_STATUS.IN_PROGRESS).length,
        closed: conversations.value.filter(c => c.status === CONVERSATION_STATUS.CLOSED || c.status === CONVERSATION_STATUS.RESOLVED).length,
        unreadCount: conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
      }
      handleError(err, '統計資料載入失敗')
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ 方案 B 阶段 2: WebSocket 实时同步完整实现
  // 直接在 Store 内部管理 WebSocket，无需外部服务
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ═══════════════════════════════════════════════════════════════════
  // 实时更新处理（阶段 3 - 使用全局 WebSocket Store）
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 處理實時更新事件（Phase B4 - 直接更新）
   * 從全局 WebSocket Store 接收事件並直接更新本地狀態
   * 避免不必要的 HTTP 輪詢
   */
  const handleRealtimeUpdate = (message: WebSocketMessage) => {
    console.log('📥 [ConversationsStore] Real-time update:', message.type, message)

    // 提取通用數據
    const data = message.data as Record<string, unknown> | undefined
    const conversationId = message.conversationId || (data?.conversationId as string)

    switch (message.type) {
      case 'new_message':
      case 'message_sent':
      case 'message_delivered': {
        // 🚀 Phase B4: 直接更新對話列表，無需 HTTP 輪詢
        if (conversationId) {
          const messageContent = data?.content as string
          const messageType = data?.messageType as string
          const timestamp = message.timestamp || data?.timestamp as string | number
          const sender = data?.sender as { id?: string; name?: string; role?: string } | undefined
          const senderType = data?.senderType as 'customer' | 'agent' | undefined
          const platform = data?.platform as string | undefined

          const updated = updateConversationFromWebSocketMessage(
            conversationId,
            {
              content: messageContent,
              messageType,
              timestamp,
              sender,
              senderType,
              platform
            },
            {
              // 只有客戶發送的訊息才增加未讀計數
              incrementUnread: senderType === 'customer',
              moveToTop: true
            }
          )

          if (updated) {
            lastUpdateTime.value = new Date()
            console.log(`✅ [ConversationsStore] Direct update for new_message in ${conversationId}`)
          }
        } else {
          // 沒有 conversationId，回退到輪詢
          console.log('⚠️ [ConversationsStore] No conversationId in message, falling back to polling')
          lastUpdateTime.value = new Date()
          pollConversations()
        }
        break
      }

      case 'conversation_updated':
      case 'conversation_status_changed':
      case 'conversation_assigned': {
        // 對話狀態更新（一般指派/更新）
        // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
        if (conversationId) {
          const status = data?.status as string | undefined
          const assignedTeamId = data?.assignedTeamId as number | undefined
          const assignedTeamName = data?.assignedTeamName as string | undefined

          const updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'assignedTeam'>> = {}
          if (status) updates.status = status as Conversation['status']
          if (assignedTeamId !== undefined) {
            updates.assignedTeamId = assignedTeamId
            if (assignedTeamId) {
              updates.assignedTeam = {
                id: assignedTeamId,
                name: assignedTeamName || `Team ${assignedTeamId}`,
                description: null
              }
            } else {
              updates.assignedTeam = undefined
            }
          }

          if (Object.keys(updates).length > 0) {
            updateConversationStatus(conversationId, updates)
            lastUpdateTime.value = new Date()
            console.log(`✅ [ConversationsStore] Direct status update for ${conversationId}`, { assignedTeamName })
          } else {
            pollConversations()
          }
        } else {
          pollConversations()
        }
        break
      }

      case 'conversation_unassigned': {
        // 🆕 對話取消指派 - 清除團隊指派
        // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
        if (conversationId) {
          const previousTeamId = data?.previousTeamId as number | undefined
          const previousTeamName = data?.previousTeamName as string | undefined

          console.log('🔓 [ConversationsStore] Conversation unassigned', {
            conversationId,
            previousTeamId,
            previousTeamName
          })

          // 更新對話狀態：清除團隊指派信息
          updateConversationStatus(conversationId, {
            status: 'active',
            assignedTeamId: undefined,
            assignedTeam: undefined
          })
          lastUpdateTime.value = new Date()
          console.log(`✅ [ConversationsStore] Cleared team assignment for ${conversationId}`)
        } else {
          pollConversations()
        }
        break
      }

      case 'conversation_transferred': {
        // 🆕 對話轉移 - 處理跨團隊轉移的三種動作
        const action = data?.action as 'removed' | 'assigned' | 'team_changed' | undefined

        console.log('📦 [ConversationsStore] Conversation transferred event', {
          conversationId,
          action,
          data
        })

        // 🔍 DEBUG: 詳細記錄完整的 data 對象
        console.log('🔍 [DEBUG] Full event data:', JSON.stringify(data, null, 2))

        if (action === 'removed') {
          // ❌ 從當前團隊移除：對話被轉移到其他團隊
          // 🔒 安全檢查：只有當用戶屬於原團隊時才處理移除事件
          // 這可以防止用戶收到不屬於自己團隊的移除事件
          // 🔧 FIX: Normalize at boundary - WebSocket JSON may send string IDs
          const fromTeamId = normalizeTeamId(data?.fromTeamId)
          const toTeamId = normalizeTeamId(data?.toTeamId)
          const authStore = useAuthStore()
          const userTeamIds = authStore.allowedTeamIds || []
          const isAdmin = authStore.currentAgent?.role === 'admin'

          // 🆕 FIX: 檢查用戶是否也屬於目標團隊
          // 如果用戶同時屬於原團隊和目標團隊，不應該移除對話
          // 因為對話會通過 'assigned' 事件更新團隊信息，仍然對用戶可見
          const userBelongsToTargetTeam = toTeamId !== undefined && userTeamIds.includes(toTeamId)

          if (userBelongsToTargetTeam && !isAdmin) {
            console.log(`🔒 [ConversationsStore] Ignoring removed event - user belongs to target team`, {
              conversationId,
              fromTeamId,
              toTeamId,
              userTeamIds
            })
            break // 忽略此事件，對話會通過 assigned 事件更新
          }

          // 檢查用戶是否屬於原團隊（管理員可以看到所有團隊的事件）
          const shouldProcessRemoval = isAdmin ||
            (fromTeamId !== undefined && userTeamIds.includes(fromTeamId))

          if (!shouldProcessRemoval) {
            console.log(`🔒 [ConversationsStore] Ignoring removed event - user not in source team`, {
              conversationId,
              fromTeamId,
              userTeamIds,
              isAdmin
            })
            break // 忽略此事件
          }

          // 從列表中移除該對話
          if (conversationId) {
            const index = conversations.value.findIndex(c => c.id === conversationId)
            if (index !== -1) {
              const removedConv = conversations.value[index]
              const previousTeamId = removedConv?.assignedTeamId
              conversations.value.splice(index, 1)
              conversationCache.invalidateConversation(conversationId)
              updateStatsFromConversations()
              lastUpdateTime.value = new Date()
              console.log(`🚫 [ConversationsStore] Conversation removed from list (transferred to another team)`, {
                conversationId,
                toTeamId: data?.toTeamId,
                toTeamName: data?.toTeamName,
                previousTeamId
              })
            }

            // 🆕 FIX: 如果是當前查看的對話，設置 transferred 狀態給詳情頁顯示
            // 這解決了 AC1: 轉出團隊客服詳情頁需要顯示 "已轉移" 訊息的需求
            if (currentConversation.value?.id === conversationId) {
              const toTeamName = (data?.toTeamName as string) || '其他團隊'
              transferredConversation.value = {
                conversationId,
                toTeamName,
                transferredAt: new Date().toISOString()
              }
              console.log(`🔄 [ConversationsStore] Also updated currentConversation for ${conversationId} - marked as transferred`, {
                toTeamName,
                transferredAt: transferredConversation.value.transferredAt
              })
            }
          }
        } else if (action === 'assigned') {
          // ✅ 新團隊接收：對話被轉移到當前團隊
          // 🔒 安全檢查：只有當用戶屬於目標團隊時才處理指派事件
          // 🔧 FIX: Normalize at boundary - WebSocket JSON may send string IDs
          const toTeamId = normalizeTeamId(data?.toTeamId)
          const authStore = useAuthStore()
          const userTeamIds = authStore.allowedTeamIds || []
          const isAdmin = authStore.currentAgent?.role === 'admin'

          // 檢查用戶是否屬於目標團隊（管理員可以看到所有團隊的事件）
          const shouldProcessAssignment = isAdmin ||
            (toTeamId !== undefined && userTeamIds.includes(toTeamId))

          if (!shouldProcessAssignment) {
            console.log(`🔒 [ConversationsStore] Ignoring assigned event - user not in target team`, {
              conversationId,
              toTeamId,
              userTeamIds,
              isAdmin
            })
            break // 忽略此事件
          }

          // 將對話添加到列表頂部
          const incomingConversation = data?.conversation as Record<string, unknown> | undefined
          if (conversationId && incomingConversation) {
            // 🆕 LIFF 預通知：檢查傳入數據是否有 LIFF metadata
            const liffMetadata = incomingConversation?._liffMetadata as {
              isPending?: boolean
              lineUserId?: string
              assignmentId?: string
              scannedAt?: number
            } | undefined

            // 🆕 LIFF Reconciliation：用 lineUserId 檢查是否有對應的 pending 對話
            const existingPendingIndex = liffMetadata?.lineUserId
              ? conversations.value.findIndex(c =>
                  (c as any)._liffMetadata?.lineUserId === liffMetadata.lineUserId
                )
              : -1

            // 🆕 如果收到的是真實對話（非 pending-），需要替換現有的 pending 對話
            if (existingPendingIndex !== -1 && !conversationId.startsWith('pending-')) {
              // Reconciliation: 移除 pending，準備添加真實對話
              const removedPending = conversations.value[existingPendingIndex]
              conversations.value.splice(existingPendingIndex, 1)
              console.log(`🔄 [ConversationsStore] Reconciled pending → real conversation`, {
                pendingId: (removedPending as any)?.id,
                realConversationId: conversationId,
                lineUserId: liffMetadata?.lineUserId?.substring(0, 10) + '...'
              })
            }

            // 檢查是否已存在（避免重複添加）
            const existingIndex = conversations.value.findIndex(c => c.id === conversationId)
            if (existingIndex === -1) {
              // 🆕 如果是 pending 對話，檢查是否已有相同 lineUserId 的 pending（避免重複掃碼）
              if (liffMetadata?.isPending && liffMetadata?.lineUserId) {
                const duplicatePendingIndex = conversations.value.findIndex(c =>
                  (c as any)._liffMetadata?.lineUserId === liffMetadata.lineUserId &&
                  (c as any)._liffMetadata?.isPending === true
                )
                if (duplicatePendingIndex !== -1) {
                  console.log(`🚫 [ConversationsStore] Ignoring duplicate pending conversation`, {
                    conversationId,
                    lineUserId: liffMetadata.lineUserId.substring(0, 10) + '...'
                  })
                  break // 忽略重複的 pending 對話
                }
              }

              // 從傳入數據提取信息
              const customerName = (incomingConversation.customerName as string) || '未知客戶'
              const platform = (incomingConversation.platform as string) || 'line'
              const status = (incomingConversation.status as string) || 'active'
              const customerId = String(incomingConversation.customerId || conversationId)

              // 構建完整的 Conversation 對象
              // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
              // 🔧 FIX: Use already-normalized toTeamId from boundary
              const newConversation: Conversation = {
                id: conversationId,
                userId: customerId,
                platform: platform as Platform,
                status: status as ConversationStatus,
                assignedTeamId: toTeamId,
                assignedTeam: toTeamId ? {
                  id: toTeamId,
                  name: (data?.toTeamName as string) || `Team ${toTeamId}`,
                  description: null
                } : undefined,
                customer: {
                  id: customerId,
                  name: customerName,
                  platform: platform as Platform,
                  platformUserId: customerId,
                  createdAt: Date.now()
                },
                lastMessage: incomingConversation.lastMessage as Conversation['lastMessage'],
                lastMessageAt: (incomingConversation.lastMessageAt as number) || Date.now(),
                unreadCount: (incomingConversation.unreadCount as number) || 0,
                createdAt: (incomingConversation.createdAt as number) || Date.now(),
                updatedAt: Date.now(),
                // 🆕 保留 LIFF metadata 用於 UI 顯示和 Reconciliation
                ...(liffMetadata && { _liffMetadata: liffMetadata } as any)
              }

              // 添加到列表頂部
              conversations.value.unshift(newConversation)
              conversationCache.setConversation(newConversation)
              updateStatsFromConversations()
              lastUpdateTime.value = new Date()

              // 🆕 Log 區分 pending 和真實對話
              if (liffMetadata?.isPending) {
                console.log(`⏳ [ConversationsStore] Pending conversation added (LIFF pre-notification)`, {
                  conversationId,
                  teamId: data?.toTeamId,
                  customerName,
                  lineUserId: liffMetadata.lineUserId?.substring(0, 10) + '...'
                })
              }

              // 🆕 FIX: 同步更新 currentConversation（如果用戶正在查看這個對話）
              // 這解決了對話被轉移後，詳情頁團隊標籤不更新的問題
              if (currentConversation.value && currentConversation.value.id === conversationId) {
                currentConversation.value = newConversation
                console.log(`🔄 [ConversationsStore] Also updated currentConversation from assigned event`, {
                  conversationId,
                  newTeamId: data?.toTeamId,
                  newTeamName: data?.toTeamName
                })
              }

              console.log(`✨ [ConversationsStore] Conversation added to list (transferred from another team)`, {
                conversationId,
                fromTeamId: data?.fromTeamId,
                fromTeamName: data?.fromTeamName,
                newTeamId: data?.toTeamId
              })
            } else {
              // 已存在，更新團隊資訊
              // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
              // 🔧 FIX: Use already-normalized toTeamId from boundary
              updateConversationStatus(conversationId, {
                assignedTeamId: toTeamId,
                assignedTeam: toTeamId ? {
                  id: toTeamId,
                  name: (data?.toTeamName as string) || `Team ${toTeamId}`,
                  description: null
                } : undefined
              })

              lastUpdateTime.value = new Date()
              console.log(`🔄 [ConversationsStore] Conversation already exists, updated team info`, {
                conversationId
              })
            }
          } else {
            // 沒有完整數據，回退到輪詢
            console.log('⚠️ [ConversationsStore] No conversation data in assigned event, polling')
            pollConversations()
          }
        } else if (action === 'team_changed') {
          // 🔄 團隊變更通知：對話房間內的用戶收到
          // 更新 Chat 視窗中的團隊標籤
          // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
          // 🔧 FIX: Normalize at boundary - WebSocket JSON may send string IDs
          if (conversationId) {
            const toTeamId = normalizeTeamId(data?.toTeamId)
            const toTeamName = (data?.toTeamName || data?.assignedTeamName) as string | undefined
            const newTeam = data?.newTeam as { id: unknown; name: string } | undefined
            const newTeamId = normalizeTeamId(newTeam?.id)
            const effectiveTeamId = toTeamId ?? newTeamId

            updateConversationStatus(conversationId, {
              assignedTeamId: effectiveTeamId,
              assignedTeam: effectiveTeamId ? {
                id: effectiveTeamId,
                name: toTeamName || newTeam?.name || `Team ${effectiveTeamId}`,
                description: null
              } : undefined
            })
            lastUpdateTime.value = new Date()
            console.log(`🏷️ [ConversationsStore] Conversation team changed in chat window`, {
              conversationId,
              newTeamId: effectiveTeamId,
              newTeamName: toTeamName || newTeam?.name
            })
          }
        } else {
          // 沒有 action 字段（舊格式），回退到原有邏輯
          // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
          // 🔧 FIX: Normalize at boundary - WebSocket JSON may send string IDs
          if (conversationId) {
            const status = data?.status as string | undefined
            const assignedTeamId = normalizeTeamId(data?.assignedTeamId)
            const assignedTeamName = data?.assignedTeamName as string | undefined

            const updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'assignedTeam'>> = {}
            if (status) updates.status = status as Conversation['status']
            if (assignedTeamId !== undefined) {
              updates.assignedTeamId = assignedTeamId
              if (assignedTeamId) {
                updates.assignedTeam = {
                  id: assignedTeamId,
                  name: assignedTeamName || `Team ${assignedTeamId}`,
                  description: null
                }
              } else {
                updates.assignedTeam = undefined
              }
            }

            if (Object.keys(updates).length > 0) {
              updateConversationStatus(conversationId, updates)
              lastUpdateTime.value = new Date()
              console.log(`✅ [ConversationsStore] Legacy transfer update for ${conversationId}`)
            } else {
              pollConversations()
            }
          } else {
            pollConversations()
          }
        }
        break
      }

      case 'conversations_update': {
        // 批量更新，使用輪詢獲取完整數據
        console.log('📥 [ConversationsStore] Batch update, using polling')
        lastUpdateTime.value = new Date()
        pollConversations()
        break
      }

      case 'message_updated':
      case 'message_deleted': {
        // 訊息更新/刪除，觸發輪詢以同步最新狀態
        lastUpdateTime.value = new Date()
        pollConversations()
        break
      }

      default:
        console.warn('[ConversationsStore] Unhandled message type:', message.type)
    }
  }

  /**
   * 轮询对话数据（HTTP 备份机制）
   */
  const pollConversations = async () => {
    try {
      const response = await conversationApi.list({
        page: 1,
        pageSize: 50
      })

      if (response.success && response.data) {
        const conversationList = Array.isArray(response.data)
          ? response.data
          : response.data.items || []

        // 使用智能增量更新
        updateConversationsIncrementally(conversationList, true)
        lastUpdateTime.value = new Date()

        // 更新统计信息
        stats.value = {
          total: conversationList.length,
          open: conversationList.filter(c =>
            c.status === CONVERSATION_STATUS.PENDING ||
            c.status === CONVERSATION_STATUS.ACTIVE
          ).length,
          assigned: conversationList.filter(c =>
            c.status === CONVERSATION_STATUS.IN_PROGRESS
          ).length,
          closed: conversationList.filter(c =>
            c.status === CONVERSATION_STATUS.CLOSED ||
            c.status === CONVERSATION_STATUS.RESOLVED
          ).length,
          unreadCount: conversationList.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        }
      }

    } catch (err) {
      console.error('❌ [ConversationsStore] Polling failed:', err)
      error.value = '数据同步失败'
    }
  }


  // ═══════════════════════════════════════════════════════════════════
  // 公共 API
  // ═══════════════════════════════════════════════════════════════════

  // ✅ 方案 B 阶段 3: 使用全局 WebSocket Store 的新实现
  // 🆕 LIFF 預通知：清理超時的 pending 對話
  // 用戶掃碼但未加好友的情況下，60 秒後自動清理
  const cleanupStalePendingConversations = () => {
    const now = Date.now()
    const staleIndices: number[] = []

    conversations.value.forEach((conv, index) => {
      const metadata = (conv as any)?._liffMetadata
      if (metadata?.isPending && metadata?.scannedAt) {
        if (now - metadata.scannedAt > PENDING_CONVERSATION_TTL) {
          staleIndices.push(index)
        }
      }
    })

    if (staleIndices.length > 0) {
      // 反向移除以避免索引錯位
      staleIndices.reverse().forEach(index => {
        const removed = conversations.value[index]
        conversations.value.splice(index, 1)
        console.log(`🧹 [ConversationsStore] Cleaned up stale pending conversation`, {
          conversationId: (removed as any)?.id,
          lineUserId: (removed as any)?._liffMetadata?.lineUserId?.substring(0, 10) + '...',
          age: `${Math.round((now - ((removed as any)?._liffMetadata?.scannedAt || 0)) / 1000)}s`
        })
      })
      updateStatsFromConversations()
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🆕 Background Sync 機制 (Optimistic UI + Background Sync 模式)
  // 確保即使 WebSocket 事件丟失，也能在 30 秒內同步到最新狀態
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 啟動背景同步定時器
   * 每 30 秒自動同步一次對話列表
   */
  const startBackgroundSync = () => {
    if (backgroundSyncInterval) {
      console.log('⏰ [ConversationsStore] Background sync already running, skipping')
      return
    }

    backgroundSyncInterval = setInterval(async () => {
      // 只在頁面可見時執行同步
      if (!isPageVisible) {
        console.log('⏸️ [ConversationsStore] Page hidden, skipping background sync')
        return
      }

      console.log('🔄 [ConversationsStore] Background sync triggered (30s interval)')
      await pollConversations()
    }, BACKGROUND_SYNC_INTERVAL)

    console.log('⏰ [ConversationsStore] Started background sync timer (30s interval)')
  }

  /**
   * 停止背景同步定時器
   */
  const stopBackgroundSync = () => {
    if (backgroundSyncInterval) {
      clearInterval(backgroundSyncInterval)
      backgroundSyncInterval = null
      console.log('⏰ [ConversationsStore] Stopped background sync timer')
    }
  }

  /**
   * 處理頁面可見性變化
   * 頁面隱藏時暫停同步，頁面可見時立即同步並恢復定時器
   */
  const handleVisibilityChange = () => {
    const wasVisible = isPageVisible
    isPageVisible = document.visibilityState === 'visible'

    if (isPageVisible && !wasVisible) {
      // 頁面從隱藏變為可見，立即觸發一次同步
      console.log('👁️ [ConversationsStore] Page became visible, triggering immediate sync')
      pollConversations()
    } else if (!isPageVisible && wasVisible) {
      console.log('👁️ [ConversationsStore] Page became hidden, pausing sync')
    }
  }

  /**
   * 觸發重連後同步
   * 當 WebSocket 重新連接後，立即同步數據以捕獲錯過的事件
   */
  const triggerReconnectionSync = async () => {
    console.log('🔌 [ConversationsStore] Reconnection detected, triggering immediate sync')
    await pollConversations()
  }

  const initializeRealtime = async () => {
    // 🆕 FIX: 防止重複訂閱 - 如果已經訂閱過，直接返回
    if (conversationsSubscriptionId) {
      console.log(`✅ [ConversationsStore] Already subscribed to conversations (ID: ${conversationsSubscriptionId.substring(0, 8)}), skipping`)
      return
    }

    console.log('🚀 [ConversationsStore] Initializing real-time sync (Phase B3)...')

    updating.value = true

    // 确保全局 WebSocket 已连接
    if (!wsStore.isConnected) {
      console.log('📡 [ConversationsStore] Connecting to global WebSocket...')
      await wsStore.connect()
    }

    // 订阅 conversations channel
    conversationsSubscriptionId = wsStore.subscribe('conversations', (message) => {
      console.log('📩 [ConversationsStore] Received message on conversations channel:', {
        type: message.type,
        conversationId: message.conversationId,
        action: (message.data as Record<string, unknown>)?.action
      })
      handleRealtimeUpdate(message)
    })

    // 🆕 LIFF 預通知：啟動 pending 對話清理定時器
    if (!pendingConversationCleanupInterval) {
      pendingConversationCleanupInterval = setInterval(
        cleanupStalePendingConversations,
        PENDING_CLEANUP_INTERVAL
      )
      console.log('🕐 [ConversationsStore] Started pending conversation cleanup timer (30s interval)')
    }

    // 🆕 Background Sync: 啟動背景同步機制
    startBackgroundSync()

    // 🆕 Background Sync: 監聽頁面可見性變化
    document.addEventListener('visibilitychange', handleVisibilityChange)
    console.log('👁️ [ConversationsStore] Added visibility change listener')

    updating.value = false

    console.log(`✅ [ConversationsStore] Subscribed to conversations (ID: ${conversationsSubscriptionId?.substring(0, 8)})`)
  }

  const cleanup = () => {
    console.log('🛑 [ConversationsStore] Cleaning up real-time sync...')

    // 取消订阅
    if (conversationsSubscriptionId) {
      wsStore.unsubscribe(conversationsSubscriptionId)
      conversationsSubscriptionId = null
      console.log('✅ [ConversationsStore] Unsubscribed from conversations')
    }

    // 🆕 LIFF 預通知：停止 pending 對話清理定時器
    if (pendingConversationCleanupInterval) {
      clearInterval(pendingConversationCleanupInterval)
      pendingConversationCleanupInterval = null
      console.log('🕐 [ConversationsStore] Stopped pending conversation cleanup timer')
    }

    // 🆕 Background Sync: 停止背景同步
    stopBackgroundSync()

    // 🆕 Background Sync: 移除頁面可見性監聽
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    console.log('👁️ [ConversationsStore] Removed visibility change listener')

    // 清理状态
    error.value = null
    updating.value = false
  }

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
    syncStatus, // ✅ 阶段 2: 暴露 WebSocket 连接状态
    transferredConversation, // 🆕 轉移狀態追蹤

    // Computed
    allMessages,
    unreadConversations,
    // Note: assignedToMeConversations removed - individual assignment is no longer supported
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
    closeConversation,
    reopenConversation,
    markAsRead,
    loadMore,
    loadMoreConversations,
    refresh,
    refreshConversations,
    silentRefresh,
    clearMessages,
    setConversations,
    clearError,
    clearTransferredState, // 🆕 清除轉移狀態

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

    // 🆕 Background Sync (Optimistic UI + Background Sync 模式)
    triggerReconnectionSync,

    // 🚀 Real-time direct updates (Phase B4)
    updateConversationFromWebSocketMessage,
    updateConversationStatus,
    moveConversationToTop,
    updateStatsFromConversations
  }
})