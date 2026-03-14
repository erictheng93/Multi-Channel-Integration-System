/**
 * useTagSearch Composable — Unit Tests
 *
 * Tests the computed derivation search pattern:
 * - Debounced search query (300ms)
 * - filteredTags computed (never mutates store)
 * - Case-insensitive name + description matching
 * - loadTags with cache / API fallback / force refresh
 * - clearSearch restores full list
 *
 * @module composables/customerTags/useTagSearch.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, reactive } from 'vue'
import type { Tag } from '@/types/tag'

// ---------------------------------------------------------------------------
// Mock tagCacheService
// ---------------------------------------------------------------------------

const mockGetAllTags = vi.fn<() => Tag[]>().mockReturnValue([])
const mockRefreshTags = vi.fn<() => Promise<Tag[]>>().mockResolvedValue([])

vi.mock('@/services/tagCacheService', () => ({
  tagCacheService: {
    getAllTags: (...args: unknown[]) => mockGetAllTags(...(args as [])),
    refreshTags: (...args: unknown[]) => mockRefreshTags(...(args as [])),
  },
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useTagSearch } from './useTagSearch'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    name: 'VIP',
    color: '#FF5733',
    isActive: true,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    conversationCount: 5,
    customerCount: 3,
    ...overrides,
  }
}

function createMockStore(initialTags: Tag[] = []) {
  return reactive({
    tags: initialTags,
    fetchTags: vi.fn().mockResolvedValue({ data: initialTags }),
  })
}

/**
 * Flush the 300ms debounce timer by advancing fake timers.
 * Needs nextTick before AND after to ensure Vue processes the
 * watcher callback (which schedules setTimeout) and then the
 * computed re-evaluation.
 */
async function flushDebounce() {
  await nextTick() // let Vue watcher schedule setTimeout
  vi.advanceTimersByTime(300) // fire the setTimeout
  await nextTick() // let computed re-evaluate
}

/**
 * Create useTagSearch and flush the initial debounce
 * (useDebounce watch has { immediate: true } which schedules a timer on creation)
 */
async function createSearch(store: ReturnType<typeof createMockStore>) {
  const search = useTagSearch(store)
  await flushDebounce()
  return search
}

// ===========================================================================
// Tests
// ===========================================================================

describe('useTagSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // Initial State
  // =========================================================================

  describe('initial state', () => {
    it('searchQuery starts as empty string', () => {
      const store = createMockStore()
      const search = useTagSearch(store)
      expect(search.searchQuery.value).toBe('')
    })

    it('isSearching starts as false', () => {
      const store = createMockStore()
      const search = useTagSearch(store)
      expect(search.isSearching.value).toBe(false)
    })

    it('filteredTags returns all store tags when not searching', () => {
      const tags = [makeTag({ id: 1, name: 'VIP' }), makeTag({ id: 2, name: 'Priority' })]
      const store = createMockStore(tags)
      const search = useTagSearch(store)
      expect(search.filteredTags.value).toEqual(tags)
    })

    it('filteredTags returns empty when store has no tags', () => {
      const store = createMockStore([])
      const search = useTagSearch(store)
      expect(search.filteredTags.value).toEqual([])
    })
  })

  // =========================================================================
  // Filtering Logic
  // =========================================================================

  describe('filtering', () => {
    function getSampleTags() {
      return [
        makeTag({ id: 1, name: 'VIP Customer', description: 'High value clients' }),
        makeTag({ id: 2, name: 'Top Tier', description: 'Urgent support needed' }),
        makeTag({ id: 3, name: 'New User', description: 'Recently registered' }),
        makeTag({ id: 4, name: 'Enterprise', description: undefined }),
      ]
    }

    it('filters by name (case-insensitive)', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      search.searchQuery.value = 'vip'
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(1)
      expect(search.filteredTags.value[0]!.name).toBe('VIP Customer')
    })

    it('filters by description (case-insensitive)', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      search.searchQuery.value = 'urgent'
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(1)
      expect(search.filteredTags.value[0]!.name).toBe('Top Tier')
    })

    it('matches partial strings', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      search.searchQuery.value = 'ente'
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(1)
      expect(search.filteredTags.value[0]!.name).toBe('Enterprise')
    })

    it('handles undefined description gracefully', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      search.searchQuery.value = 'enterprise'
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(1)
      expect(search.filteredTags.value[0]!.id).toBe(4)
    })

    it('returns empty array when no match', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      search.searchQuery.value = 'nonexistent'
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(0)
    })

    it('matches by name OR description', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      // 'new' matches "New User" by name and "Recently registered" does not
      search.searchQuery.value = 'new'
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(1)
      expect(search.filteredTags.value[0]!.name).toBe('New User')
    })

    it('returns all tags when query is whitespace only', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      search.searchQuery.value = ' '
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(4)
    })

    it('matches mixed case queries', async () => {
      const store = createMockStore(getSampleTags())
      const search = await createSearch(store)

      search.searchQuery.value = 'VIP'
      await flushDebounce()
      expect(search.filteredTags.value).toHaveLength(1)

      search.searchQuery.value = 'Vip'
      await flushDebounce()
      expect(search.filteredTags.value).toHaveLength(1)
    })
  })

  // =========================================================================
  // Debounce Behavior
  // =========================================================================

  describe('debounce', () => {
    it('does not filter immediately on keystroke', async () => {
      const tags = [makeTag({ id: 1, name: 'VIP' }), makeTag({ id: 2, name: 'Other' })]
      const store = createMockStore(tags)
      const search = useTagSearch(store)

      search.searchQuery.value = 'vip'
      await nextTick()

      // Before debounce: filteredTags still has all tags
      expect(search.filteredTags.value).toHaveLength(2)
    })

    it('filters after 300ms debounce', async () => {
      const tags = [makeTag({ id: 1, name: 'VIP' }), makeTag({ id: 2, name: 'Other' })]
      const store = createMockStore(tags)
      const search = useTagSearch(store)

      search.searchQuery.value = 'vip'
      await nextTick()

      // Advance 299ms — not yet triggered
      vi.advanceTimersByTime(299)
      await nextTick()
      expect(search.filteredTags.value).toHaveLength(2)

      // Advance 1ms more — now triggered
      vi.advanceTimersByTime(1)
      await nextTick()
      expect(search.filteredTags.value).toHaveLength(1)
    })

    it('isSearching updates only after debounce', async () => {
      const store = createMockStore([makeTag()])
      const search = useTagSearch(store)

      search.searchQuery.value = 'test'
      await nextTick()
      expect(search.isSearching.value).toBe(false)

      await flushDebounce()
      expect(search.isSearching.value).toBe(true)
    })

    it('consolidates rapid keystrokes into one filter', async () => {
      const tags = [
        makeTag({ id: 1, name: 'VIP Customer' }),
        makeTag({ id: 2, name: 'Other' }),
      ]
      const store = createMockStore(tags)
      const search = useTagSearch(store)

      // Simulate rapid typing: v → vi → vip
      search.searchQuery.value = 'v'
      await nextTick()
      vi.advanceTimersByTime(100)

      search.searchQuery.value = 'vi'
      await nextTick()
      vi.advanceTimersByTime(100)

      search.searchQuery.value = 'vip'
      await nextTick()

      // Still showing all tags (debounce not settled)
      expect(search.filteredTags.value).toHaveLength(2)

      // Now flush the final debounce
      await flushDebounce()
      expect(search.filteredTags.value).toHaveLength(1)
      expect(search.filteredTags.value[0]!.name).toBe('VIP Customer')
    })
  })

  // =========================================================================
  // Store Immutability
  // =========================================================================

  describe('store immutability', () => {
    it('never mutates store.tags during filtering', async () => {
      const tags = [makeTag({ id: 1, name: 'VIP' }), makeTag({ id: 2, name: 'Other' })]
      const store = createMockStore(tags)
      const search = await createSearch(store)

      search.searchQuery.value = 'vip'
      await flushDebounce()

      // filteredTags returns a subset
      expect(search.filteredTags.value).toHaveLength(1)
      // Original store.tags is untouched
      expect(store.tags).toHaveLength(2)
    })

    it('reactively updates when store.tags changes', async () => {
      const store = createMockStore([makeTag({ id: 1, name: 'VIP' })])
      const search = await createSearch(store)

      expect(search.filteredTags.value).toHaveLength(1)

      // Simulate store adding more tags (e.g. from WebSocket)
      store.tags = [
        makeTag({ id: 1, name: 'VIP' }),
        makeTag({ id: 2, name: 'Priority' }),
        makeTag({ id: 3, name: 'New' }),
      ]

      // No search active — should reflect new store data
      expect(search.filteredTags.value).toHaveLength(3)
    })
  })

  // =========================================================================
  // clearSearch
  // =========================================================================

  describe('clearSearch', () => {
    it('resets searchQuery to empty string', async () => {
      const store = createMockStore([makeTag()])
      const search = await createSearch(store)

      search.searchQuery.value = 'test'
      await flushDebounce()
      expect(search.isSearching.value).toBe(true)

      search.clearSearch()
      expect(search.searchQuery.value).toBe('')
    })

    it('restores full tag list after debounce', async () => {
      const tags = [makeTag({ id: 1, name: 'VIP' }), makeTag({ id: 2, name: 'Other' })]
      const store = createMockStore(tags)
      const search = await createSearch(store)

      // Search to filter
      search.searchQuery.value = 'vip'
      await flushDebounce()
      expect(search.filteredTags.value).toHaveLength(1)

      // Clear and flush debounce
      search.clearSearch()
      await flushDebounce()

      expect(search.filteredTags.value).toHaveLength(2)
      expect(search.isSearching.value).toBe(false)
    })
  })

  // =========================================================================
  // loadTags
  // =========================================================================

  describe('loadTags', () => {
    it('loads from cache when available', async () => {
      const cachedTags = [makeTag({ id: 1, name: 'Cached' })]
      mockGetAllTags.mockReturnValue(cachedTags)

      const store = createMockStore()
      const search = useTagSearch(store)

      await search.loadTags()

      expect(mockGetAllTags).toHaveBeenCalled()
      expect(store.fetchTags).not.toHaveBeenCalled()
      expect(store.tags).toEqual(cachedTags)
    })

    it('falls back to API when cache is empty', async () => {
      mockGetAllTags.mockReturnValue([])

      const store = createMockStore()
      const search = useTagSearch(store)

      await search.loadTags()

      expect(mockGetAllTags).toHaveBeenCalled()
      expect(store.fetchTags).toHaveBeenCalled()
    })

    it('force refresh bypasses cache and calls refreshTags', async () => {
      const freshTags = [makeTag({ id: 1, name: 'Fresh' })]
      mockRefreshTags.mockResolvedValue(freshTags)

      const store = createMockStore()
      const search = useTagSearch(store)

      await search.loadTags(true)

      expect(mockRefreshTags).toHaveBeenCalled()
      expect(mockGetAllTags).not.toHaveBeenCalled()
      expect(store.tags).toEqual(freshTags)
    })

    it('throws on API error', async () => {
      mockGetAllTags.mockReturnValue([])

      const store = createMockStore()
      store.fetchTags = vi.fn().mockRejectedValue(new Error('Network error'))

      const search = useTagSearch(store)

      await expect(search.loadTags()).rejects.toThrow('Network error')
    })

    it('throws on force refresh error', async () => {
      mockRefreshTags.mockRejectedValue(new Error('Refresh failed'))

      const store = createMockStore()
      const search = useTagSearch(store)

      await expect(search.loadTags(true)).rejects.toThrow('Refresh failed')
    })
  })

  // =========================================================================
  // cleanup
  // =========================================================================

  describe('cleanup', () => {
    it('cleanup is a no-op function', () => {
      const store = createMockStore()
      const search = useTagSearch(store)
      // Should not throw
      expect(() => search.cleanup()).not.toThrow()
    })
  })
})
