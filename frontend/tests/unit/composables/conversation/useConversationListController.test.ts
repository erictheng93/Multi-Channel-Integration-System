/**
 * Unit Tests for useConversationListController Composable
 *
 * @module tests/unit/composables/conversation/useConversationListController.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { Conversation } from '@/types'

// ===== Test Data =====

const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    userId: 'user-1',
    status: 'active',
    lastMessageAt: '2024-01-03T10:00:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-03T10:00:00Z',
    unreadCount: 3,
    lastMessage: { content: 'hello world' } as any
  },
  {
    id: 'conv-2',
    userId: 'user-2',
    status: 'pending',
    lastMessageAt: '2024-01-02T10:00:00Z',
    createdAt: '2024-01-02T10:00:00Z',
    updatedAt: '2024-01-02T10:00:00Z',
    unreadCount: 0,
    lastMessage: { content: 'goodbye' } as any
  }
] as Conversation[]

// ===== Mock Dependencies =====

// Mock vue-router
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mockRouterPush,
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn()
  })),
  useRoute: vi.fn(() => ({
    path: '/',
    params: {},
    query: {}
  }))
}))

// Mock useAuth
const mockCurrentAgent = ref({ id: 'agent-1', name: 'Test Agent', role: 'admin' })
vi.mock('@/composables', () => ({
  useAuth: vi.fn(() => ({
    currentAgent: mockCurrentAgent,
    isAuthenticated: ref(true),
    isAdmin: ref(true)
  }))
}))

// Mock conversations store
const mockStoreConversations = ref<Conversation[]>(mockConversations)
const mockLoadWithCache = vi.fn().mockResolvedValue({ fresh: true })
const mockRefreshConversations = vi.fn().mockResolvedValue(undefined)
const mockLoadMore = vi.fn().mockResolvedValue(undefined)
const mockSetConversations = vi.fn()
const mockSetActiveFilters = vi.fn()
const mockCanLoadMore = ref(true)
const mockPagination = { total: 2, page: 1, pageSize: 20 }

vi.mock('@/stores/conversations', () => ({
  useConversationsStore: vi.fn(() => ({
    conversations: mockStoreConversations.value,
    loadWithCache: mockLoadWithCache,
    refreshConversations: mockRefreshConversations,
    loadMore: mockLoadMore,
    setConversations: mockSetConversations,
    setActiveFilters: mockSetActiveFilters,
    canLoadMore: mockCanLoadMore.value,
    pagination: mockPagination
  }))
}))

// Mock useConversationFilters
const mockFilters = ref({})
const mockGetApiFilters = vi.fn().mockReturnValue({ status: 'active' })
vi.mock('@/composables/conversation/useConversationFilters', () => ({
  useConversationFilters: vi.fn(() => ({
    filters: mockFilters,
    selectedTagIds: ref([]),
    hasActiveFilters: ref(false),
    updateFilter: vi.fn(),
    updateTagFilter: vi.fn(),
    toggleTagFilter: vi.fn(),
    clearTagFilter: vi.fn(),
    clearAllFilters: vi.fn(),
    resetToDefaults: vi.fn(),
    getApiFilters: mockGetApiFilters
  }))
}))

// Mock useConversationSort
const mockApplySortToConversations = vi.fn((convos: Conversation[]) => [...convos])
vi.mock('@/composables/conversation/useConversationSort', () => ({
  useConversationSort: vi.fn(() => ({
    sortBy: ref('updatedAt'),
    sortOrder: ref('desc'),
    updateSort: vi.fn(),
    toggleSortOrder: vi.fn(),
    sortFieldLabel: ref('更新时间'),
    applySortToConversations: mockApplySortToConversations
  }))
}))

// Mock useConversationCache
const mockGetCachedData = vi.fn().mockResolvedValue(null)
const mockSetCachedData = vi.fn().mockResolvedValue(undefined)
const mockInvalidateCache = vi.fn().mockResolvedValue(undefined)
const mockGenerateCacheKey = vi.fn().mockReturnValue('cache-key-1')
vi.mock('@/composables/conversation/useConversationCache', () => ({
  useConversationCache: vi.fn(() => ({
    cacheHitRate: ref(0),
    cacheHits: ref(0),
    cacheMisses: ref(0),
    getCachedData: mockGetCachedData,
    setCachedData: mockSetCachedData,
    invalidateCache: mockInvalidateCache,
    clearAllCache: vi.fn(),
    generateCacheKey: mockGenerateCacheKey,
    resetStats: vi.fn()
  }))
}))

// Mock error handler
vi.mock('@/utils/error-handler', () => ({
  translateError: vi.fn((_err: unknown, defaultMsg?: string) => defaultMsg || 'error')
}))

// Mock cacheManager
vi.mock('@/services/cacheManager', () => ({
  conversationCache: {
    invalidateAll: vi.fn()
  }
}))

// Mock toast
const mockToastError = vi.fn()
const mockToastWarning = vi.fn()
vi.mock('@/composables/useToast', () => ({
  default: {
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
    success: vi.fn(),
    info: vi.fn()
  }
}))

// Mock timestamp util
vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2024-01-01T00:00:00Z')
}))

import { useConversationListController } from '@/composables/conversation/useConversationListController'

describe('useConversationListController', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStoreConversations.value = mockConversations
    mockCanLoadMore.value = true
    mockPagination.total = 2
    mockGetCachedData.mockResolvedValue(null)
    mockLoadWithCache.mockResolvedValue({ fresh: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should initialize isLoading as false', () => {
      const controller = useConversationListController()
      expect(controller.isLoading.value).toBe(false)
    })

    it('should initialize isRefreshing as false', () => {
      const controller = useConversationListController()
      expect(controller.isRefreshing.value).toBe(false)
    })

    it('should initialize loadingMore as false', () => {
      const controller = useConversationListController()
      expect(controller.loadingMore.value).toBe(false)
    })

    it('should initialize currentPage as 1', () => {
      const controller = useConversationListController()
      expect(controller.currentPage.value).toBe(1)
    })

    it('should initialize pageSize as 20', () => {
      const controller = useConversationListController()
      expect(controller.pageSize.value).toBe(20)
    })

    it('should initialize total as 0', () => {
      const controller = useConversationListController()
      expect(controller.total.value).toBe(0)
    })

    it('should initialize selectedConversationId as null', () => {
      const controller = useConversationListController()
      expect(controller.selectedConversationId.value).toBeNull()
    })

    it('should initialize loadError as null', () => {
      const controller = useConversationListController()
      expect(controller.loadError.value).toBeNull()
    })

    it('should initialize hasNetworkError as false', () => {
      const controller = useConversationListController()
      expect(controller.hasNetworkError.value).toBe(false)
    })
  })

  describe('sub-composables', () => {
    it('should expose filters composable', () => {
      const controller = useConversationListController()
      expect(controller.filters).toBeDefined()
      expect(controller.filters.filters).toBeDefined()
    })

    it('should expose sort composable', () => {
      const controller = useConversationListController()
      expect(controller.sort).toBeDefined()
      expect(controller.sort.sortBy).toBeDefined()
    })

    it('should expose cache composable', () => {
      const controller = useConversationListController()
      expect(controller.cache).toBeDefined()
      expect(controller.cache.getCachedData).toBeDefined()
    })
  })

  describe('computed properties', () => {
    it('should compute totalPages correctly', () => {
      const controller = useConversationListController()
      controller.total.value = 50
      controller.pageSize.value = 20

      expect(controller.totalPages.value).toBe(3)
    })

    it('should compute totalConversations from total', () => {
      const controller = useConversationListController()
      controller.total.value = 42

      expect(controller.totalConversations.value).toBe(42)
    })

    it('should compute unreadCount from store conversations', () => {
      const controller = useConversationListController()
      // mockStoreConversations has conv-1 with unreadCount: 3 and conv-2 with unreadCount: 0
      expect(controller.unreadCount.value).toBe(1) // 1 conversation has unread > 0
    })
  })

  describe('loadConversations', () => {
    it('should set isLoading during load', async () => {
      const controller = useConversationListController()

      await controller.loadConversations()

      // After load completes, isLoading should be false
      expect(controller.isLoading.value).toBe(false)
    })

    it('should call getApiFilters with current agent id', async () => {
      const controller = useConversationListController()

      await controller.loadConversations()

      expect(mockGetApiFilters).toHaveBeenCalledWith('agent-1')
    })

    it('should call generateCacheKey', async () => {
      const controller = useConversationListController()

      await controller.loadConversations()

      expect(mockGenerateCacheKey).toHaveBeenCalled()
    })

    it('should load from API when no cached data', async () => {
      mockGetCachedData.mockResolvedValue(null)
      const controller = useConversationListController()

      await controller.loadConversations()

      expect(mockLoadWithCache).toHaveBeenCalled()
    })

    it('should use cached data when available', async () => {
      mockGetCachedData.mockResolvedValue(mockConversations)
      const controller = useConversationListController()

      await controller.loadConversations()

      expect(mockSetConversations).toHaveBeenCalledWith(mockConversations)
      expect(controller.total.value).toBe(2)
    })

    it('should clear error state on success', async () => {
      const controller = useConversationListController()
      controller.loadError.value = 'previous error'
      controller.hasNetworkError.value = true

      await controller.loadConversations()

      expect(controller.loadError.value).toBeNull()
      expect(controller.hasNetworkError.value).toBe(false)
    })

    it('should handle load failure', async () => {
      mockGetCachedData.mockResolvedValue(null)
      mockLoadWithCache.mockRejectedValueOnce(new Error('network error'))
      const controller = useConversationListController()

      await controller.loadConversations()

      expect(controller.loadError.value).toBeDefined()
      expect(controller.hasNetworkError.value).toBe(true)
      expect(controller.isLoading.value).toBe(false)
    })

    it('should show toast on load failure', async () => {
      mockGetCachedData.mockResolvedValue(null)
      mockLoadWithCache.mockRejectedValueOnce(new Error('network error'))
      const controller = useConversationListController()

      await controller.loadConversations()

      expect(mockToastError).toHaveBeenCalled()
    })
  })

  describe('refresh', () => {
    it('should set isRefreshing during refresh', async () => {
      const controller = useConversationListController()

      await controller.refresh()

      expect(controller.isRefreshing.value).toBe(false)
    })

    it('should reset currentPage to 1', async () => {
      const controller = useConversationListController()
      controller.currentPage.value = 3

      await controller.refresh()

      expect(controller.currentPage.value).toBe(1)
    })

    it('should invalidate cache', async () => {
      const controller = useConversationListController()

      await controller.refresh()

      expect(mockInvalidateCache).toHaveBeenCalled()
    })

    it('should call refreshConversations on store', async () => {
      const controller = useConversationListController()

      await controller.refresh()

      expect(mockRefreshConversations).toHaveBeenCalled()
    })

    it('should update cache after refresh', async () => {
      const controller = useConversationListController()

      await controller.refresh()

      expect(mockSetCachedData).toHaveBeenCalled()
    })

    it('should clear error state on successful refresh', async () => {
      const controller = useConversationListController()
      controller.loadError.value = 'old error'
      controller.hasNetworkError.value = true

      await controller.refresh()

      expect(controller.loadError.value).toBeNull()
      expect(controller.hasNetworkError.value).toBe(false)
    })

    it('should handle refresh failure', async () => {
      mockRefreshConversations.mockRejectedValueOnce(new Error('refresh fail'))
      const controller = useConversationListController()

      await controller.refresh()

      expect(controller.loadError.value).toBeDefined()
      expect(controller.isRefreshing.value).toBe(false)
    })
  })

  describe('loadMore', () => {
    it('should call store.loadMore', async () => {
      const controller = useConversationListController()

      await controller.loadMore()

      expect(mockLoadMore).toHaveBeenCalled()
    })

    it('should not load when canLoadMore is false', async () => {
      mockCanLoadMore.value = false
      // Need to re-create since canLoadMore is read at creation time
      const controller = useConversationListController()

      await controller.loadMore()

      expect(mockLoadMore).not.toHaveBeenCalled()
    })

    it('should not load when already loading more', async () => {
      const controller = useConversationListController()
      controller.loadingMore.value = true

      await controller.loadMore()

      expect(mockLoadMore).not.toHaveBeenCalled()
    })

    it('should set loadingMore during load', async () => {
      let resolveLoadMore: () => void
      mockLoadMore.mockImplementationOnce(() => new Promise<void>((r) => { resolveLoadMore = r }))
      const controller = useConversationListController()

      const promise = controller.loadMore()
      expect(controller.loadingMore.value).toBe(true)

      resolveLoadMore!()
      await promise

      expect(controller.loadingMore.value).toBe(false)
    })

    it('should handle loadMore failure gracefully', async () => {
      mockLoadMore.mockRejectedValueOnce(new Error('load more failed'))
      const controller = useConversationListController()

      await controller.loadMore()

      expect(controller.loadingMore.value).toBe(false)
      expect(mockToastError).toHaveBeenCalled()
    })
  })

  describe('selectConversation', () => {
    it('should set selectedConversationId', () => {
      const controller = useConversationListController()
      const conversation = mockConversations[0]

      controller.selectConversation(conversation)

      expect(controller.selectedConversationId.value).toBe('conv-1')
    })

    it('should navigate to conversation detail', () => {
      const controller = useConversationListController()
      const conversation = mockConversations[0]

      controller.selectConversation(conversation)

      expect(mockRouterPush).toHaveBeenCalledWith('/conversations/conv-1')
    })
  })

  describe('changePage', () => {
    it('should update currentPage and reload', async () => {
      const controller = useConversationListController()
      controller.total.value = 100

      controller.changePage(3)

      expect(controller.currentPage.value).toBe(3)
    })

    it('should not change page when page is less than 1', () => {
      const controller = useConversationListController()
      controller.currentPage.value = 1

      controller.changePage(0)

      expect(controller.currentPage.value).toBe(1)
    })

    it('should not change page when page exceeds totalPages', () => {
      const controller = useConversationListController()
      controller.total.value = 20
      controller.pageSize.value = 20
      // totalPages = 1

      controller.changePage(5)

      expect(controller.currentPage.value).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('should reset all state', () => {
      const controller = useConversationListController()

      // Set some state
      controller.isLoading.value = true
      controller.isRefreshing.value = true
      controller.loadingMore.value = true
      controller.currentPage.value = 5
      controller.selectedConversationId.value = 'conv-1'
      controller.loadError.value = 'error'
      controller.hasNetworkError.value = true

      controller.cleanup()

      expect(controller.isLoading.value).toBe(false)
      expect(controller.isRefreshing.value).toBe(false)
      expect(controller.loadingMore.value).toBe(false)
      expect(controller.currentPage.value).toBe(1)
      expect(controller.selectedConversationId.value).toBeNull()
      expect(controller.loadError.value).toBeNull()
      expect(controller.hasNetworkError.value).toBe(false)
    })
  })

  describe('initialize', () => {
    it('should load conversations', async () => {
      const controller = useConversationListController()

      await controller.initialize()

      expect(mockLoadWithCache).toHaveBeenCalled()
    })

    it('should sync filters to store', async () => {
      const controller = useConversationListController()

      await controller.initialize()

      expect(mockSetActiveFilters).toHaveBeenCalled()
    })
  })

  describe('return interface', () => {
    it('should return all expected properties and methods', () => {
      const controller = useConversationListController()

      // Sub-composables
      expect(controller).toHaveProperty('filters')
      expect(controller).toHaveProperty('sort')
      expect(controller).toHaveProperty('cache')

      // State refs
      expect(controller).toHaveProperty('isLoading')
      expect(controller).toHaveProperty('isRefreshing')
      expect(controller).toHaveProperty('loadingMore')
      expect(controller).toHaveProperty('currentPage')
      expect(controller).toHaveProperty('pageSize')
      expect(controller).toHaveProperty('total')
      expect(controller).toHaveProperty('selectedConversationId')
      expect(controller).toHaveProperty('loadError')
      expect(controller).toHaveProperty('hasNetworkError')

      // Computed
      expect(controller).toHaveProperty('conversations')
      expect(controller).toHaveProperty('totalPages')
      expect(controller).toHaveProperty('totalConversations')
      expect(controller).toHaveProperty('unreadCount')
      expect(controller).toHaveProperty('canLoadMore')

      // Methods
      expect(controller).toHaveProperty('initialize')
      expect(controller).toHaveProperty('loadConversations')
      expect(controller).toHaveProperty('refresh')
      expect(controller).toHaveProperty('loadMore')
      expect(controller).toHaveProperty('selectConversation')
      expect(controller).toHaveProperty('changePage')
      expect(controller).toHaveProperty('cleanup')
    })
  })
})
