import type { Ref } from 'vue'
import type { Conversation, ConversationFilters, PaginatedResponse } from '@/types'
import { conversationApi } from '@/api/conversations'
import { conversationCache, cacheManager } from '@/services/cacheManager'
import { hasConversationChanged } from './helpers'

export interface CacheStrategyDeps {
  conversations: Ref<Conversation[]>
  loading: Ref<boolean>
  updating: Ref<boolean>
  error: Ref<string | null>
  filters: Ref<ConversationFilters>
  pagination: Ref<{
    page: number
    pageSize: number
    total: number
    totalPages: number
  }>
  handleError: (_err: unknown, _defaultMessage: string) => void
  updateConversationsIncrementally: (_newConversations: Conversation[], _logChanges?: boolean) => void
  /** 获取当前用户 ID（用于缓存键隔离，防止跨用户数据污染） */
  getCurrentUserId: () => string | undefined
}

export function createCacheStrategy(deps: CacheStrategyDeps) {
  const {
    conversations,
    loading,
    updating,
    filters,
    pagination,
    handleError,
    updateConversationsIncrementally,
    getCurrentUserId
  } = deps

  // Optimistic update - immediate UI update, background API sync
  const optimisticUpdateConversation = async (
    id: string,
    updates: Partial<Conversation>,
    apiCall?: () => Promise<{ data?: Conversation }>
  ) => {
    console.log(`[ConversationsStore] Optimistic update for conversation ${id}:`, updates)

    // 1. Immediate local state update
    const index = conversations.value.findIndex(c => c.id === id)
    if (index !== -1) {
      const originalConversation = { ...conversations.value[index] }
      conversations.value[index] = { ...originalConversation, ...updates } as Conversation

      // 2. Update cache
      conversationCache.setConversation(conversations.value[index])

      // 3. Background API call
      if (apiCall) {
        try {
          const result = await apiCall()
          console.log(`[ConversationsStore] API sync completed for ${id}`)

          // 4. Update with API result if different
          if (result?.data && hasConversationChanged(conversations.value[index], result.data)) {
            conversations.value[index] = result.data
            conversationCache.setConversation(result.data)
          }

          return { success: true, data: conversations.value[index] }
        } catch (err) {
          console.error(`[ConversationsStore] API sync failed for ${id}, rolling back:`, err)

          // 5. Rollback on error
          conversations.value[index] = originalConversation as Conversation
          conversationCache.setConversation(originalConversation as Conversation)

          handleError(err, '更新對話失敗')
          return { success: false, error: err, rollback: true }
        }
      }

      return { success: true, data: conversations.value[index] }
    }

    console.warn(`[ConversationsStore] Conversation ${id} not found for optimistic update`)
    return { success: false, error: 'Conversation not found', rollback: false }
  }

  // Smart cache loading - load from cache first, background update
  const loadWithCache = async (cacheFilters: ConversationFilters = {}, page = 1) => {
    console.log(`[ConversationsStore] Smart cache loading with filters:`, cacheFilters)

    // 1. Load from cache immediately (包含 userId 防止跨用戶數據污染)
    const cached = conversationCache.getConversationList(cacheFilters, getCurrentUserId())
    if (cached.data) {
      console.log(`[ConversationsStore] Cache hit, showing ${cached.data.length} cached conversations`)
      conversations.value = cached.data

      if (!cached.needsUpdate) {
        console.log(`[ConversationsStore] Cache is fresh, no API call needed`)
        return { fromCache: true, fresh: true }
      }
    }

    // 2. Background update (even with cache)
    const wasFromCache = !!cached.data
    if (wasFromCache) {
      updating.value = true
    } else {
      loading.value = true
    }

    try {
      console.log(`[ConversationsStore] ${wasFromCache ? 'Background' : 'Initial'} API call`)

      const cleanFilters: Record<string, unknown> = {}
      if (cacheFilters.status) { cleanFilters.status = cacheFilters.status }
      if (cacheFilters.platform) { cleanFilters.platform = cacheFilters.platform }
      if (cacheFilters.teamId) { cleanFilters.teamId = cacheFilters.teamId }
      if (cacheFilters.customerName) { cleanFilters.customerName = cacheFilters.customerName }
      if (cacheFilters.updatedAfter) { cleanFilters.updatedAfter = cacheFilters.updatedAfter }
      if (cacheFilters.updatedBefore) { cleanFilters.updatedBefore = cacheFilters.updatedBefore }

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

        // 3. Smart update
        if (wasFromCache) {
          updateConversationsIncrementally(conversationList, true)
        } else {
          conversations.value = conversationList
        }

        // 4. Update cache (包含 userId 防止跨用戶數據污染)
        conversationCache.setConversationList(conversationList, cacheFilters, getCurrentUserId())
        pagination.value = paginationData

        console.log(`[ConversationsStore] ${wasFromCache ? 'Background update' : 'Initial load'} completed`)
        return { fromCache: wasFromCache, fresh: true, count: conversationList.length }
      }

    } catch (err) {
      console.error(`[ConversationsStore] Smart cache loading failed:`, err)
      if (!wasFromCache) {
        handleError(err, '載入對話失敗')
      }
      return { fromCache: wasFromCache, fresh: false, error: err }
    } finally {
      loading.value = false
      updating.value = false
    }

    return { fromCache: false, fresh: false }
  }

  // Preload next page
  const preloadNextPage = async () => {
    const nextPage = pagination.value.page + 1
    if (nextPage > pagination.value.totalPages) { return }

    console.log(`[ConversationsStore] Preloading page ${nextPage}`)

    try {
      await cacheManager.prefetch(`conversations:page:${nextPage}`, async () => {
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
    } catch (err) {
      console.warn(`[ConversationsStore] Preload failed for page ${nextPage}:`, err)
    }
  }

  // Intelligent preload of adjacent conversation messages
  const preloadAdjacentConversationMessages = async (currentConversationId: string) => {
    console.log(`[ConversationsStore] Starting intelligent preload for adjacent conversations`)

    const currentIndex = conversations.value.findIndex(c => c.id === currentConversationId)
    if (currentIndex === -1) {
      console.warn(`[ConversationsStore] Current conversation not found in list`)
      return
    }

    const adjacentConversations: string[] = []

    if (currentIndex > 0) {
      const prevConv = conversations.value[currentIndex - 1]
      if (prevConv?.id) {
        adjacentConversations.push(prevConv.id)
      }
    }

    if (currentIndex < conversations.value.length - 1) {
      const nextConv = conversations.value[currentIndex + 1]
      if (nextConv?.id) {
        adjacentConversations.push(nextConv.id)
      }
    }

    console.log(`[ConversationsStore] Preloading ${adjacentConversations.length} adjacent conversations`)

    const doPreload = () => {
      adjacentConversations.forEach(async (convId) => {
        if (!convId) { return }
        try {
          await cacheManager.prefetch(`conversation:messages:${convId}`, async () => {
            const { messageApi } = await import('@/api/message')
            const response = await messageApi.listPaginated(convId, {
              page: 1,
              pageSize: 10
            })
            return response.data
          })
          console.log(`[ConversationsStore] Preloaded messages for conversation ${convId}`)
        } catch (err) {
          console.warn(`[ConversationsStore] Failed to preload ${convId}:`, err)
        }
      })
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => doPreload())
    } else {
      setTimeout(() => doPreload(), 1000)
    }
  }

  return {
    optimisticUpdateConversation,
    loadWithCache,
    preloadNextPage,
    preloadAdjacentConversationMessages
  }
}
