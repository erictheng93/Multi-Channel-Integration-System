/**
 * Tag Search Composable
 *
 * Manages tag search and filtering using Vue reactive computed derivation.
 * Filters tags client-side from store data — never overwrites store.tags.
 *
 * @module composables/customerTags/useTagSearch
 */

import { ref, computed } from 'vue'
import type { Tag } from '@/types/tag'
import { useDebounce } from '@/composables/useDebounce'
import { tagCacheService } from '@/services/tagCacheService'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useTagSearch')

/**
 * Store interface for tag search
 */
interface TagSearchStoreInterface {
  tags: Tag[]
  fetchTags: () => Promise<unknown>
}

/**
 * Tag search and filtering logic (computed derivation pattern)
 *
 * Features:
 * - Debounced search (300ms) via useDebounce composable
 * - Computed filteredTags derived from store.tags (no mutation)
 * - Clear search restores full list automatically (zero-cost)
 *
 * @param store - Tags Pinia store
 * @returns Search state and methods
 */
export function useTagSearch(store: TagSearchStoreInterface) {
  // ==================== Search State ====================

  const searchQuery = ref('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const isSearching = computed(() => debouncedSearch.value.trim().length > 0)

  // ==================== Computed Filtering ====================

  /**
   * Filtered tags derived from store.tags
   * Reactively updates when store.tags or search query changes
   * Never mutates the original store data
   */
  const filteredTags = computed(() => {
    const query = debouncedSearch.value.trim().toLowerCase()
    if (!query) {return store.tags}
    return store.tags.filter(tag => {
      const nameMatch = tag.name.toLowerCase().includes(query)
      const descMatch = tag.description?.toLowerCase().includes(query)
      return nameMatch || descMatch
    })
  })

  // ==================== Data Loading ====================

  /**
   * Load tags from API into store
   * Uses cache service for optimal performance
   *
   * @param forceRefresh - When true, bypasses cache and fetches fresh data from API.
   * Used by WebSocket real-time updates to ensure stale cache
   * doesn't prevent updated counts from appearing.
   */
  const loadTags = async (forceRefresh = false) => {
    try {
      frontendLogger.debug(`[TagSearch] Loading tags...${forceRefresh ? ' (force refresh)' : ''}`)

      if (forceRefresh) {
        // Invalidate cache and fetch fresh data from API
        const freshTags = await tagCacheService.refreshTags()
        store.tags = freshTags
        frontendLogger.debug(`[TagSearch] Force-refreshed ${freshTags.length} tags from API`)
        return
      }

      // Check cache first
      const cachedTags = tagCacheService.getAllTags()
      if (cachedTags.length > 0) {
        store.tags = cachedTags
        frontendLogger.debug(`[TagSearch] Loaded ${cachedTags.length} tags from cache`)
        return
      }

      // Fetch from API if cache is empty
      await store.fetchTags()
      frontendLogger.debug(`[TagSearch] Loaded ${store.tags.length} tags from API`)
    } catch (error) {
      console.error('[TagSearch] Failed to load tags:', error)
      throw error
    }
  }

  // ==================== Actions ====================

  /**
   * Clear search query — filteredTags automatically restores to full list
   */
  const clearSearch = () => {
    searchQuery.value = ''
  }

  // ==================== Return Interface ====================

  return {
    searchQuery,
    debouncedSearch,
    isSearching,
    filteredTags,
    loadTags,
    clearSearch,
    cleanup: () => { /* No manual timer to clean up — useDebounce handles it */ }
  }
}
