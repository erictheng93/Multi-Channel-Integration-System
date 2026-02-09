/**
 * Conversation List Controller Composable
 *
 * 主协调器，负责整合所有子 composables 并管理对话列表的完整生命周期
 *
 * @module composables/conversation/useConversationListController
 *
 * @example
 * ```ts
 * const controller = useConversationListController()
 *
 * // 初始化
 * await controller.initialize()
 *
 * // 载入对话
 * await controller.loadConversations()
 *
 * // 刷新
 * await controller.refresh()
 * ```
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import { useConversationFilters } from './useConversationFilters'
import { useConversationSort } from './useConversationSort'
import { useConversationCache } from './useConversationCache'
import type { Conversation } from '@/types'
import { translateError } from '@/utils/error-handler'
import { conversationCache as storeLevelCache } from '@/services/cacheManager'
import toast from '@/composables/useToast'

export interface ConversationListControllerComposable {
  // 子 Composables
  filters: ReturnType<typeof useConversationFilters>
  sort: ReturnType<typeof useConversationSort>
  cache: ReturnType<typeof useConversationCache>

  // 状态
  isLoading: Ref<boolean>
  isRefreshing: Ref<boolean>
  loadingMore: Ref<boolean>
  currentPage: Ref<number>
  pageSize: Ref<number>
  total: Ref<number>
  selectedConversationId: Ref<string | null>
  loadError: Ref<string | null>
  hasNetworkError: Ref<boolean>

  // 计算属性
  conversations: Ref<Conversation[]>
  totalPages: Ref<number>
  totalConversations: Ref<number>
  unreadCount: Ref<number>
  canLoadMore: Ref<boolean>

  // 方法
  initialize: () => Promise<void>
  loadConversations: () => Promise<void>
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  selectConversation: (conversation: Conversation) => void
  changePage: (page: number) => void
  cleanup: () => void
}

/**
 * 最大重试次数
 */
const MAX_RETRY_COUNT = 3

/**
 * 使用对话列表控制器
 *
 * @returns {ConversationListControllerComposable} 控制器实例
 */
export function useConversationListController(): ConversationListControllerComposable {
  const router = useRouter()
  const { currentAgent } = useAuth()
  const conversationsStore = useConversationsStore()

  // 初始化子 composables
  const filters = useConversationFilters()
  const sort = useConversationSort()
  const cache = useConversationCache()

  // 状态
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const loadingMore = ref(false)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const selectedConversationId = ref<string | null>(null)
  const loadError = ref<string | null>(null)
  const hasNetworkError = ref(false)
  const retryCount = ref(0)

  // 计算属性 - 直接使用 Pinia Store 的 conversations（修復排序未生效的問題）
  // 原本透過 useConversations() → useAsyncData({ immediate: false }) 鏈路，
  // 因為 execute() 從未被呼叫，data 永遠是 null，導致排序無法套用
  const conversations = computed(() => {
    const storeData = conversationsStore.conversations

    // 应用客户端排序（updatedAt DESC - 最新處理的對話排在最上面）
    if (storeData && storeData.length > 0) {
      return sort.applySortToConversations(storeData)
    }

    return storeData || []
  })

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
  const totalConversations = computed(() => total.value)
  const unreadCount = computed(() => {
    const storeData = conversationsStore.conversations
    return storeData
      ? storeData.filter((c: Conversation) => c.unreadCount && c.unreadCount > 0).length
      : 0
  })
  const canLoadMore = computed(() => conversationsStore.canLoadMore)

  /**
   * 载入对话列表
   *
   * @async
   * @throws {Error} 载入失败时抛出错误
   */
  async function loadConversations(): Promise<void> {
    console.log('🚀 [Controller] Loading conversations')
    isLoading.value = true
    loadError.value = null

    try {
      // 准备 API 筛选参数
      const apiFilters = filters.getApiFilters(currentAgent.value?.id)

      // 生成缓存键
      const cacheKey = cache.generateCacheKey(filters.filters.value, currentPage.value)

      // 先尝试从缓存获取
      const cachedData = await cache.getCachedData(cacheKey)
      if (cachedData && cachedData.length > 0) {
        console.log('✨ [Controller] Using cached data')
        conversationsStore.setConversations(cachedData)
        total.value = cachedData.length

        // 背景刷新缓存
        refreshCacheInBackground(apiFilters, cacheKey)
      } else {
        // 从 API 载入
        const result = await conversationsStore.loadWithCache(apiFilters, currentPage.value)

        if (result?.fresh) {
          total.value = conversationsStore.pagination.total

          // 设置缓存
          await cache.setCachedData(cacheKey, conversations.value)
        }
      }

      // 清除错误状态
      loadError.value = null
      hasNetworkError.value = false
      retryCount.value = 0
    } catch (error) {
      console.error('[Controller] Load conversations failed:', error)
      handleLoadError(error)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 背景刷新缓存
   *
   * @param {Record<string, unknown>} apiFilters - API 筛选参数
   * @param {string} cacheKey - 缓存键
   * @private
   */
  async function refreshCacheInBackground(
    _apiFilters: Record<string, unknown>,
    cacheKey: string
  ): Promise<void> {
    try {
      // 🔧 使用 refreshConversations (直接 API 呼叫) 而非 loadWithCache
      // loadWithCache 可能從 store cacheManager 返回 stale 資料，覆蓋 controller 快取的正確資料
      await conversationsStore.refreshConversations()

      total.value = conversationsStore.pagination.total
      await cache.setCachedData(cacheKey, conversations.value)
      console.log('🔄 [Controller] Background cache refresh completed')
    } catch (error) {
      console.warn('[Controller] Background refresh failed:', error)
    }
  }

  /**
   * 处理载入错误
   *
   * @param {unknown} error - 错误对象
   * @private
   */
  function handleLoadError(error: unknown): void {
    const errorMessage = translateError(error, '载入对话失败')
    loadError.value = errorMessage
    hasNetworkError.value = true

    // 显示错误提示
    toast.error(errorMessage, undefined, {
      duration: 5000,
      actionText: '重试',
      onAction: () => {
        if (retryCount.value < MAX_RETRY_COUNT) {
          retryCount.value++
          loadConversations()
        } else {
          toast.warning('已达最大重试次数，请稍后再试')
        }
      }
    })

    // 生产环境错误记录
    if (import.meta.env.PROD) {
      console.error('[Controller] Production error:', {
        error,
        filters: filters.filters.value,
        page: currentPage.value,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * 刷新对话列表
   *
   * @async
   */
  async function refresh(): Promise<void> {
    console.log('🔄 [Controller] Manual refresh triggered')
    isRefreshing.value = true
    currentPage.value = 1

    try {
      // 🔧 使兩層快取同時失效，避免 stale 資料覆蓋 fresh 資料
      await cache.invalidateCache()       // Layer 1: Controller localStorage 快取
      storeLevelCache.invalidateAll()     // Layer 2: Store cacheManager 快取

      // 🔧 直接從 API 重新載入（不再呼叫 loadConversations 避免被快取覆蓋）
      await conversationsStore.refreshConversations()

      // 更新分頁資訊
      total.value = conversationsStore.pagination.total

      // 更新 Controller 快取（存入已排序的資料）
      const cacheKey = cache.generateCacheKey(filters.filters.value, currentPage.value)
      await cache.setCachedData(cacheKey, conversations.value)

      // 清除错误状态
      loadError.value = null
      hasNetworkError.value = false
      retryCount.value = 0
    } catch (error) {
      console.error('[Controller] Refresh failed:', error)
      handleLoadError(error)
    } finally {
      isRefreshing.value = false
    }
  }

  /**
   * 载入更多对话
   *
   * @async
   */
  async function loadMore(): Promise<void> {
    if (!canLoadMore.value || loadingMore.value) {
      return
    }

    console.log('📄 [Controller] Loading more conversations')
    loadingMore.value = true

    try {
      await conversationsStore.loadMore()
      total.value = conversationsStore.pagination.total
    } catch (error) {
      console.error('[Controller] Load more failed:', error)
      const errorMessage = translateError(error, '载入更多对话失败')
      toast.error(errorMessage)
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * 选择对话并导航
   *
   * @param {Conversation} conversation - 对话对象
   */
  function selectConversation(conversation: Conversation): void {
    selectedConversationId.value = conversation.id
    router.push(`/conversations/${conversation.id}`)
  }

  /**
   * 切换分页
   *
   * @param {number} page - 目标页码
   */
  function changePage(page: number): void {
    if (page < 1 || page > totalPages.value) {
      return
    }
    currentPage.value = page
    loadConversations()
  }

  /**
   * 初始化控制器
   *
   * @async
   */
  async function initialize(): Promise<void> {
    console.log('🚀 [Controller] Initializing')

    // 载入初始数据
    await loadConversations()

    // 监听筛选变化
    watch(
      () => filters.filters.value,
      () => {
        currentPage.value = 1
        loadConversations()
      },
      { deep: true }
    )

    console.log('✅ [Controller] Initialized')
  }

  /**
   * 清理资源
   */
  function cleanup(): void {
    console.log('🛑 [Controller] Cleaning up')
    // 重置状态
    isLoading.value = false
    isRefreshing.value = false
    loadingMore.value = false
    currentPage.value = 1
    selectedConversationId.value = null
    loadError.value = null
    hasNetworkError.value = false
    retryCount.value = 0
  }

  return {
    // 子 composables
    filters,
    sort,
    cache,

    // 状态
    isLoading,
    isRefreshing,
    loadingMore,
    currentPage,
    pageSize,
    total,
    selectedConversationId,
    loadError,
    hasNetworkError,

    // 计算属性
    conversations,
    totalPages,
    totalConversations,
    unreadCount,
    canLoadMore,

    // 方法
    initialize,
    loadConversations,
    refresh,
    loadMore,
    selectConversation,
    changePage,
    cleanup
  }
}
