/**
 * 全局预加载服务
 * 用于在应用启动时预加载常用数据，提升用户体验
 *
 * 功能：
 * - 团队列表预加载和缓存
 * - 用户列表预加载和缓存
 * - 智能 TTL 过期管理
 * - 自动清理过期缓存
 */

import { teamApi } from '@/api/team'

// Team type (inline definition based on API response)
export interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
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

class PreloadService {
  private cache = new Map<string, CacheEntry<unknown>>()
  private initialized = false
  private initPromise: Promise<void> | null = null

  /**
   * 初始化预加载服务
   * 在应用启动时调用，预加载所有必要数据
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._doInit()
    return this.initPromise
  }

  private async _doInit(): Promise<void> {
    console.log('🚀 [PreloadService] Initializing preload service...')
    const startTime = performance.now()

    try {
      // 并行预加载所有数据
      await Promise.allSettled([
        this.preloadTeams(),
        // 可以添加更多预加载项
        // this.preloadUsers(),
      ])

      const duration = performance.now() - startTime
      console.log(`✅ [PreloadService] Initialization completed in ${duration.toFixed(2)}ms`)
      this.initialized = true
    } catch (error) {
      console.error('❌ [PreloadService] Initialization failed:', error)
      throw error
    }
  }

  /**
   * 预加载团队列表
   */
  async preloadTeams(): Promise<Team[]> {
    const cacheKey = 'teams'
    const cached = this.cache.get(cacheKey) as CacheEntry<Team[]> | undefined

    // 检查缓存是否有效
    if (cached && this.isCacheValid(cached)) {
      console.log('⚡ [PreloadService] Teams loaded from cache')
      return cached.data
    }

    console.log('🔄 [PreloadService] Fetching teams from API...')
    try {
      const response = await teamApi.getTeams(true) // 只获取活跃团队

      if (response.success && response.data) {
        const teams = response.data

        // 存入缓存
        this.cache.set(cacheKey, {
          data: teams,
          timestamp: Date.now(),
          ttl: 30 * 60 * 1000  // 30分钟 TTL (优化: 延长缓存时间，减少 API 调用频率)
        })

        console.log(`✅ [PreloadService] ${teams.length} teams cached`)
        return teams
      } else {
        console.error('❌ [PreloadService] Failed to load teams:', response.error)
        return []
      }
    } catch (error) {
      console.error('❌ [PreloadService] Teams API error:', error)
      return []
    }
  }

  /**
   * 获取团队列表（同步方法）
   * 🚀 Stale-While-Revalidate 策略：
   * - 如果缓存有效，立即返回
   * - 如果缓存过期但存在，返回旧数据并后台刷新
   * - 如果缓存不存在，返回空数组并触发后台加载
   */
  getTeams(): Team[] {
    const cached = this.cache.get('teams') as CacheEntry<Team[]> | undefined

    // 情况1: 缓存有效，直接返回
    if (cached && this.isCacheValid(cached)) {
      return cached.data
    }

    // 情况2: 缓存过期但存在数据 - Stale-While-Revalidate
    if (cached && !this.isCacheValid(cached)) {
      console.log('⚡ [PreloadService] Using stale cache while revalidating...')
      // 后台刷新，不阻塞当前请求
      this.preloadTeams().catch(err => {
        console.error('❌ [PreloadService] Background refresh failed:', err)
      })
      // 立即返回过期的数据，用户无感知
      return cached.data
    }

    // 情况3: 缓存不存在，触发后台加载
    console.log('🔄 [PreloadService] No cache found, loading teams in background...')
    this.preloadTeams().catch(err => {
      console.error('❌ [PreloadService] Background load failed:', err)
    })

    return []
  }

  /**
   * 确保团队数据已加载
   * 如果数据不存在或已过期，立即加载
   */
  async ensureTeamsLoaded(): Promise<Team[]> {
    const cached = this.cache.get('teams') as CacheEntry<Team[]> | undefined

    if (cached && this.isCacheValid(cached)) {
      return cached.data
    }

    return this.preloadTeams()
  }

  /**
   * 手动刷新团队数据
   */
  async refreshTeams(): Promise<Team[]> {
    console.log('🔄 [PreloadService] Manual refresh of teams...')
    this.cache.delete('teams')
    return this.preloadTeams()
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid<T>(entry: CacheEntry<T>): boolean {
    const now = Date.now()
    return now - entry.timestamp < entry.ttl
  }

  /**
   * 清理过期缓存
   * 定期调用以释放内存
   */
  cleanup(): void {
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isCacheValid(entry)) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [PreloadService] Cleaned ${cleaned} expired cache entries`)
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cache.clear()
    this.initialized = false
    this.initPromise = null
    console.log('🗑️ [PreloadService] All cache cleared')
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    }
  }

  /**
   * 预热缓存
   * 在用户可能需要数据之前就开始加载
   */
  async warmup(): Promise<void> {
    console.log('🔥 [PreloadService] Warming up cache...')
    await this.init()
  }
}

// 导出单例实例
export const preloadService = new PreloadService()
