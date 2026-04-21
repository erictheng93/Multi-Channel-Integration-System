/**
 * 全局预加载服务 (Backward Compatibility Facade)
 *
 * Purpose: Maintains backward compatibility while delegating to Pinia store
 *
 * Architecture:
 * - This service acts as a facade over usePreloadStore
 * - All caching logic has been moved to the Pinia store
 * - Existing code using preloadService continues to work unchanged
 *
 * Migration Path:
 * - Phase 1:  Tests written for preloadService
 * - Phase 2:  usePreloadStore created with full functionality
 * - Phase 3:  preloadService delegates to store (current)
 * - Phase 4: Gradually migrate consumers to use store directly
 *
 * Usage:
 * - Existing code: `preloadService.getTeams()` (still works)
 * - New code: `const store = usePreloadStore(); store.getTeams()` (recommended)
 */

import { shallowRef, watch, type ShallowRef, type WatchStopHandle } from 'vue'
import { storeToRefs } from 'pinia'
import { usePreloadStore, type Team } from '@/stores/preload'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('preloadService')

// Re-export Team type for backward compatibility
export type { Team }

/**
 * PreloadService Facade
 *
 * Delegates all operations to usePreloadStore while maintaining
 * the original API signature for backward compatibility.
 */
class PreloadService {
  /**
   * Lazy-initialized store reference
   * - Pinia stores require the app to be created first
   * - We use lazy initialization to avoid early access errors
   */
  private _store: ReturnType<typeof usePreloadStore> | null = null

  /**
   * Watch stop handle for cleanup
   */
  private _watchStopHandle: WatchStopHandle | null = null

  /**
   * Get the Pinia store instance (lazy initialization)
   */
  private get store(): ReturnType<typeof usePreloadStore> {
    if (!this._store) {
      try {
        this._store = usePreloadStore()
        // Setup auto-sync watcher when store is first accessed
        this.setupAutoSync()
      } catch (err) {
        // This can happen if called before Pinia is installed
        console.warn('[PreloadService] Store not available yet, using fallback')
        throw err
      }
    }
    return this._store
  }

  /**
   * 響應式團隊數據引用 (Backward Compatibility)
   *
   * Sync Strategy:
   * - This ref auto-syncs with store.teams via Vue watch
   * - Existing code using `preloadService.teamsRef` continues to work
   * - For new code, use `usePreloadStore().teams` directly
   */
  public readonly teamsRef: ShallowRef<Team[]> = shallowRef<Team[]>([])

  /**
   * Setup auto-sync watcher to keep teamsRef in sync with store.teams
   * Uses storeToRefs to get the actual ref for proper Vue reactivity tracking
   */
  private setupAutoSync(): void {
    if (this._watchStopHandle || !this._store) {return}

    // Use storeToRefs to get the actual ShallowRef from the store
    // This is necessary because Pinia auto-unwraps refs when accessed via store.property
    const { teams: storeTeamsRef } = storeToRefs(this._store)

    this._watchStopHandle = watch(
      storeTeamsRef,
      (newTeams) => {
        if (newTeams !== undefined && this.teamsRef.value !== newTeams) {
          this.teamsRef.value = newTeams
        }
      },
      { immediate: true, flush: 'sync' } // Use sync flush for immediate updates
    )
  }

  /**
   * Internal sync helper - syncs teamsRef with store (manual sync)
   */
  private syncTeamsRef(): void {
    try {
      const storeTeams = this.store.teams
      if (this.teamsRef.value !== storeTeams) {
        this.teamsRef.value = storeTeams
      }
    } catch {
      // Store not available yet - teamsRef stays empty
    }
  }

  /**
   * 初始化预加载服务
   * Delegates to: usePreloadStore().init()
   */
  async init(): Promise<void> {
    await this.store.init()
    this.syncTeamsRef()
  }

  /**
   * 预加载团队列表
   * Delegates to: usePreloadStore().preloadTeams()
   */
  async preloadTeams(): Promise<Team[]> {
    const teams = await this.store.preloadTeams()
    this.syncTeamsRef()
    return teams
  }

  /**
   * 获取团队列表（同步方法）
   * Implements Stale-While-Revalidate strategy
   *
   * Delegates to: usePreloadStore().getTeams()
   *
   * 響應式整合:
   * - Returns teamsRef.value for Vue computed tracking
   * - When store updates, getTeams() will return updated data
   */
  getTeams(): Team[] {
    try {
      const teams = this.store.getTeams()
      // Sync teamsRef for backward compatibility
      if (this.teamsRef.value !== teams) {
        this.teamsRef.value = teams
      }
      return this.teamsRef.value
    } catch {
      // Store not available - return current teamsRef value
      return this.teamsRef.value
    }
  }

  /**
   * 确保团队数据已加载
   * Delegates to: usePreloadStore().ensureTeamsLoaded()
   */
  async ensureTeamsLoaded(): Promise<Team[]> {
    const teams = await this.store.ensureTeamsLoaded()
    this.syncTeamsRef()
    return teams
  }

  /**
   * 手动刷新团队数据
   * Delegates to: usePreloadStore().refreshTeams()
   */
  async refreshTeams(): Promise<Team[]> {
    frontendLogger.debug('[PreloadService] Manual refresh of teams...')
    const teams = await this.store.refreshTeams()
    this.syncTeamsRef()
    return teams
  }

  /**
   * 清理过期缓存
   * Delegates to: usePreloadStore().cleanup()
   */
  cleanup(): void {
    this.store.cleanup()
    this.syncTeamsRef()
  }

  /**
   * 清除所有缓存
   * Delegates to: usePreloadStore().clearAll()
   */
  clearAll(): void {
    // Stop the watcher first
    if (this._watchStopHandle) {
      this._watchStopHandle()
      this._watchStopHandle = null
    }

    try {
      this.store.clearAll()
    } catch {
      // Store not available - just clear local ref
    }
    this.teamsRef.value = []
    this._store = null // Reset store reference
    frontendLogger.debug('[PreloadService] All cache cleared and teamsRef reset')
  }

  /**
   * 获取缓存统计信息
   * Delegates to: usePreloadStore().getCacheStats()
   */
  getCacheStats(): { size: number; entries: string[] } {
    try {
      return this.store.getCacheStats()
    } catch {
      return { size: 0, entries: [] }
    }
  }

  /**
   * 预热缓存
   * Delegates to: usePreloadStore().warmup()
   */
  async warmup(): Promise<void> {
    frontendLogger.debug('[PreloadService] Warming up cache...')
    await this.store.warmup()
    this.syncTeamsRef()
  }
}

// 导出单例实例
export const preloadService = new PreloadService()
