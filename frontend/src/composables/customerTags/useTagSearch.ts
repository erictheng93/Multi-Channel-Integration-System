/**
 * Tag Search Composable
 *
 * Manages tag search and filtering with debounced input.
 * Integrates with tag cache service for optimal performance.
 *
 * @module composables/customerTags/useTagSearch
 */

import { ref, watch } from 'vue'
import type { Tag } from '@/types/tag'
import { tagCacheService } from '@/services/tagCacheService'

/**
 * Store interface for tag search
 */
interface TagSearchStoreInterface {
  tags: Tag[]
  fetchTags: () => Promise<unknown>
}

/**
 * Tag search and filtering logic
 *
 * Features:
 * - Debounced search (300ms delay)
 * - Cache integration for performance
 * - Filtered results computation
 *
 * @param store - Tags Pinia store
 * @param onLoadStart - Callback when loading starts
 * @param onLoadEnd - Callback when loading ends
 * @returns Search state and methods
 */
export function useTagSearch(
  store: TagSearchStoreInterface,
  onLoadStart: () => void,
  onLoadEnd: () => void
) {
  // ==================== State ====================

  const searchQuery = ref('')
  let debounceTimer: number | null = null

  // ==================== Methods ====================

  /**
   * Load tags from API
   * Uses cache service for optimal performance
   */
  const loadTags = async () => {
    try {
      console.log('📦 [TagSearch] Loading tags...')

      // Check cache first
      const cachedTags = tagCacheService.getAllTags()
      if (cachedTags.length > 0) {
        store.tags = cachedTags
        console.log(`✅ [TagSearch] Loaded ${cachedTags.length} tags from cache`)
        return
      }

      // Fetch from API if cache is empty
      await store.fetchTags()
      console.log(`✅ [TagSearch] Loaded ${store.tags.length} tags from API`)
    } catch (error) {
      console.error('❌ [TagSearch] Failed to load tags:', error)
      throw error
    }
  }

  /**
   * Debounced search handler
   * Delays search execution to avoid excessive API calls
   *
   * @param query - Search query string
   */
  const debouncedSearch = (query: string) => {
    // Clear existing timer
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer)
    }

    // Set new timer
    debounceTimer = window.setTimeout(() => {
      performSearch(query)
    }, 300) as unknown as number
  }

  /**
   * Execute search
   * Filters tags based on search query
   *
   * @param query - Search query string
   */
  const performSearch = async (query: string) => {
    const trimmedQuery = query.trim().toLowerCase()

    console.log(`🔍 [TagSearch] Searching for: "${trimmedQuery}"`)

    if (!trimmedQuery) {
      // Empty query - show all tags
      await loadTags()
      return
    }

    onLoadStart()

    try {
      // Filter tags by name or description
      const allTags = tagCacheService.getAllTags()
      const filtered = allTags.filter(tag => {
        const nameMatch = tag.name.toLowerCase().includes(trimmedQuery)
        const descMatch = tag.description?.toLowerCase().includes(trimmedQuery)
        return nameMatch || descMatch
      })

      store.tags = filtered
      console.log(`✅ [TagSearch] Found ${filtered.length} matching tags`)
    } catch (error) {
      console.error('❌ [TagSearch] Search failed:', error)
    } finally {
      onLoadEnd()
    }
  }

  /**
   * Clear search and reload all tags
   */
  const clearSearch = async () => {
    searchQuery.value = ''
    await loadTags()
    console.log('🧹 [TagSearch] Search cleared')
  }

  // ==================== Watchers ====================

  /**
   * Watch search query and trigger debounced search
   */
  watch(searchQuery, (newQuery) => {
    debouncedSearch(newQuery)
  })

  // ==================== Cleanup ====================

  /**
   * Cleanup debounce timer
   */
  const cleanup = () => {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  // ==================== Return Interface ====================

  return {
    searchQuery,
    loadTags,
    clearSearch,
    cleanup
  }
}
