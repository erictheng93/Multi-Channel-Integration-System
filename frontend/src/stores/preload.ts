/**
 * usePreloadStore - Pinia Store for Global Preloading
 *
 * 🎯 Purpose: Centralized reactive state management for preloaded data
 *
 * Key Features:
 * - Full Vue reactivity via Pinia (computed properties auto-track changes)
 * - TTL-based caching with automatic expiration
 * - Stale-While-Revalidate strategy for optimal UX
 * - Singleton pattern with Pinia store composition
 * - DevTools integration for debugging
 *
 * Migration Note:
 * This store replaces the internal caching logic of preloadService.
 * The preloadService remains as a facade for backward compatibility.
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import { teamApi } from '@/api/team'

// ============================================================================
// Types
// ============================================================================

export interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
  lineUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CacheStats {
  size: number
  entries: string[]
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY_TEAMS = 'teams'
const DEFAULT_TTL = 30 * 60 * 1000 // 30 minutes

// ============================================================================
// Store Definition
// ============================================================================

export const usePreloadStore = defineStore('preload', () => {
  // ===========================================================================
  // State
  // ===========================================================================

  /**
   * Teams data using shallowRef for performance
   * - shallowRef: Only tracks .value changes, not deep array mutations
   * - This is optimal for array replacements (not in-place modifications)
   */
  const teams = shallowRef<Team[]>([])

  /**
   * Cache metadata tracking
   * - Stores timestamp and TTL for expiration checking
   */
  const teamsCache = ref<CacheEntry<Team[]> | null>(null)

  /**
   * Loading and initialization state
   */
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)

  /**
   * Pending promise for deduplication of concurrent requests
   */
  let initPromise: Promise<void> | null = null
  let loadPromise: Promise<Team[]> | null = null

  // ===========================================================================
  // Computed Properties (Fully Reactive)
  // ===========================================================================

  /**
   * Check if teams cache is valid (not expired)
   */
  const isTeamsCacheValid = computed(() => {
    if (!teamsCache.value) return false
    const now = Date.now()
    return now - teamsCache.value.timestamp < teamsCache.value.ttl
  })

  /**
   * Check if teams cache exists (even if expired)
   */
  const hasTeamsCache = computed(() => teamsCache.value !== null)

  /**
   * Cache statistics for debugging
   */
  const cacheStats = computed<CacheStats>(() => {
    const entries: string[] = []
    if (teamsCache.value) {
      entries.push(CACHE_KEY_TEAMS)
    }
    return {
      size: entries.length,
      entries
    }
  })

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Check if a cache entry is valid (internal helper)
   */
  function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
    if (!entry) return false
    const now = Date.now()
    return now - entry.timestamp < entry.ttl
  }

  /**
   * Fetch teams from API and update cache
   */
  async function fetchTeamsFromApi(): Promise<Team[]> {
    console.log('🔄 [PreloadStore] Fetching teams from API...')
    try {
      const response = await teamApi.getTeams(true) // includeInactive

      if (response.success && response.data) {
        const fetchedTeams = response.data

        // Update cache
        teamsCache.value = {
          data: fetchedTeams,
          timestamp: Date.now(),
          ttl: DEFAULT_TTL
        }

        // Update reactive ref (triggers Vue computed recalculation)
        teams.value = fetchedTeams

        console.log(`✅ [PreloadStore] ${fetchedTeams.length} teams cached`)
        return fetchedTeams
      } else {
        console.error('❌ [PreloadStore] Failed to load teams:', response.error)
        error.value = response.error || 'Failed to load teams'
        return []
      }
    } catch (err) {
      console.error('❌ [PreloadStore] Teams API error:', err)
      error.value = (err as Error).message || 'API error'
      return []
    }
  }

  // ===========================================================================
  // Actions (Public API)
  // ===========================================================================

  /**
   * Initialize the preload store
   * - Loads all required data
   * - Idempotent: Multiple calls won't trigger multiple loads
   */
  async function init(): Promise<void> {
    if (initialized.value) {
      return
    }

    if (initPromise) {
      return initPromise
    }

    initPromise = _doInit()
    return initPromise
  }

  async function _doInit(): Promise<void> {
    console.log('🚀 [PreloadStore] Initializing...')
    const startTime = performance.now()

    try {
      loading.value = true
      error.value = null

      // Parallel preload all data
      await Promise.allSettled([
        preloadTeams()
        // Future: preloadUsers(), preloadSettings(), etc.
      ])

      const duration = performance.now() - startTime
      console.log(`✅ [PreloadStore] Initialization completed in ${duration.toFixed(2)}ms`)
      initialized.value = true
    } catch (err) {
      console.error('❌ [PreloadStore] Initialization failed:', err)
      error.value = (err as Error).message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Preload teams data
   * - Checks cache validity before fetching
   * - Returns cached data if valid
   */
  async function preloadTeams(): Promise<Team[]> {
    // Return cached data if valid
    if (teamsCache.value && isCacheValid(teamsCache.value)) {
      console.log('⚡ [PreloadStore] Teams loaded from cache')
      // Ensure reactive ref is in sync
      if (teams.value !== teamsCache.value.data) {
        teams.value = teamsCache.value.data
      }
      return teamsCache.value.data
    }

    // Deduplicate concurrent requests
    if (loadPromise) {
      return loadPromise
    }

    loadPromise = fetchTeamsFromApi()
    try {
      return await loadPromise
    } finally {
      loadPromise = null
    }
  }

  /**
   * Get teams (synchronous)
   * - Implements Stale-While-Revalidate strategy
   * - Returns current data immediately, refreshes in background if stale
   *
   * ⚠️ Key Reactivity Feature:
   * Returns teams.value (shallowRef) so Vue computed can track changes
   */
  function getTeams(): Team[] {
    // Case 1: Cache valid - return immediately
    if (teamsCache.value && isCacheValid(teamsCache.value)) {
      // Ensure ref is synced
      if (teams.value !== teamsCache.value.data) {
        teams.value = teamsCache.value.data
      }
      return teams.value
    }

    // Case 2: Cache expired but has data - Stale-While-Revalidate
    if (teamsCache.value && !isCacheValid(teamsCache.value)) {
      console.log('⚡ [PreloadStore] Using stale cache while revalidating...')
      // Background refresh
      preloadTeams().catch(err => {
        console.error('❌ [PreloadStore] Background refresh failed:', err)
      })
      // Return stale data via reactive ref
      if (teams.value !== teamsCache.value.data) {
        teams.value = teamsCache.value.data
      }
      return teams.value
    }

    // Case 3: No cache - trigger background load
    console.log('🔄 [PreloadStore] No cache found, loading teams in background...')
    preloadTeams().catch(err => {
      console.error('❌ [PreloadStore] Background load failed:', err)
    })

    // Return empty array via reactive ref (will update when load completes)
    return teams.value
  }

  /**
   * Ensure teams are loaded (async)
   * - Waits for data to be available
   * - Returns actual data, not empty array
   */
  async function ensureTeamsLoaded(): Promise<Team[]> {
    if (teamsCache.value && isCacheValid(teamsCache.value)) {
      return teamsCache.value.data
    }
    return preloadTeams()
  }

  /**
   * Force refresh teams
   * - Clears cache and fetches fresh data
   */
  async function refreshTeams(): Promise<Team[]> {
    console.log('🔄 [PreloadStore] Manual refresh of teams...')
    teamsCache.value = null
    return preloadTeams()
  }

  /**
   * Warmup cache
   * - Alias for init() for API compatibility
   */
  async function warmup(): Promise<void> {
    console.log('🔥 [PreloadStore] Warming up cache...')
    await init()
  }

  /**
   * Cleanup expired cache entries
   */
  function cleanup(): void {
    let cleaned = 0

    if (teamsCache.value && !isCacheValid(teamsCache.value)) {
      teamsCache.value = null
      teams.value = []
      cleaned++
    }

    if (cleaned > 0) {
      console.log(`🧹 [PreloadStore] Cleaned ${cleaned} expired cache entries`)
    }
  }

  /**
   * Clear all cache and reset state
   */
  function clearAll(): void {
    teamsCache.value = null
    teams.value = []
    initialized.value = false
    initPromise = null
    loadPromise = null
    error.value = null
    console.log('🗑️ [PreloadStore] All cache cleared')
  }

  /**
   * Get cache statistics
   */
  function getCacheStats(): CacheStats {
    return cacheStats.value
  }

  /**
   * Pinia reset action
   */
  function $reset(): void {
    clearAll()
  }

  // ===========================================================================
  // Return Public API
  // ===========================================================================

  return {
    // State (reactive)
    teams,
    loading,
    initialized,
    error,

    // Computed
    isTeamsCacheValid,
    hasTeamsCache,
    cacheStats,

    // Actions
    init,
    preloadTeams,
    getTeams,
    ensureTeamsLoaded,
    refreshTeams,
    warmup,
    cleanup,
    clearAll,
    getCacheStats,
    $reset
  }
})
