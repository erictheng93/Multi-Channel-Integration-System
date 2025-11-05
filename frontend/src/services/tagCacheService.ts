/**
 * 标签缓存服务
 * 专门用于标签数据的预加载和缓存管理
 *
 * 功能：
 * - 标签列表预加载和缓存
 * - 智能 TTL 过期管理
 * - 乐观更新支持
 */

import { getTags, type Tag } from '@/api/tags'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class TagCacheService {
  private cache = new Map<string, CacheEntry<unknown>>()
  private initialized = false
  private initPromise: Promise<void> | null = null

  /**
   * 初始化标签缓存服务
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
    console.log('🏷️ [TagCacheService] Initializing tag cache service...')
    const startTime = performance.now()

    try {
      await this.preloadTags()

      const duration = performance.now() - startTime
      console.log(`✅ [TagCacheService] Initialization completed in ${duration.toFixed(2)}ms`)
      this.initialized = true
    } catch (error) {
      console.error('❌ [TagCacheService] Initialization failed:', error)
      throw error
    }
  }

  /**
   * 预加载标签列表
   */
  async preloadTags(): Promise<Tag[]> {
    const cacheKey = 'tags'
    const cached = this.cache.get(cacheKey) as CacheEntry<Tag[]> | undefined

    // 检查缓存是否有效
    if (cached && this.isCacheValid(cached)) {
      console.log('⚡ [TagCacheService] Tags loaded from cache')
      return cached.data
    }

    console.log('🔄 [TagCacheService] Fetching tags from API...')
    try {
      const response = await getTags({ pageSize: 100 })

      if (response.success && response.data) {
        const tags = response.data

        // 存入缓存
        this.cache.set(cacheKey, {
          data: tags,
          timestamp: Date.now(),
          ttl: 3 * 60 * 1000  // 3分钟 TTL (标签变化较频繁)
        })

        console.log(`✅ [TagCacheService] ${tags.length} tags cached`)
        return tags
      } else {
        console.error('❌ [TagCacheService] Failed to load tags: Invalid response')
        return []
      }
    } catch (error) {
      console.error('❌ [TagCacheService] Tags API error:', error)
      return []
    }
  }

  /**
   * 获取所有标签（同步方法）
   * 如果缓存中没有数据，返回空数组并触发后台加载
   */
  getAllTags(): Tag[] {
    const cached = this.cache.get('tags') as CacheEntry<Tag[]> | undefined

    if (cached && this.isCacheValid(cached)) {
      return cached.data
    }

    // 缓存失效或不存在，触发后台刷新
    if (!cached || !this.isCacheValid(cached)) {
      console.log('🔄 [TagCacheService] Cache expired, refreshing tags in background...')
      this.preloadTags().catch(err => {
        console.error('❌ [TagCacheService] Background refresh failed:', err)
      })
    }

    // 返回过期的缓存数据（如果有）或空数组
    return cached?.data || []
  }

  /**
   * 确保标签数据已加载
   */
  async ensureTagsLoaded(): Promise<Tag[]> {
    const cached = this.cache.get('tags') as CacheEntry<Tag[]> | undefined

    if (cached && this.isCacheValid(cached)) {
      return cached.data
    }

    return this.preloadTags()
  }

  /**
   * 手动刷新标签数据
   */
  async refreshTags(): Promise<Tag[]> {
    console.log('🔄 [TagCacheService] Manual refresh of tags...')
    this.cache.delete('tags')
    return this.preloadTags()
  }

  /**
   * 乐观添加新标签到缓存
   * 用于创建标签后立即更新UI
   */
  optimisticAddTag(tag: Tag): void {
    const cached = this.cache.get('tags') as CacheEntry<Tag[]> | undefined

    if (cached) {
      const updatedTags = [tag, ...cached.data]
      this.cache.set('tags', {
        ...cached,
        data: updatedTags,
        timestamp: Date.now()  // 更新时间戳
      })
      console.log('⚡ [TagCacheService] Tag added optimistically:', tag.name)
    }
  }

  /**
   * 从缓存中移除标签（乐观更新）
   */
  optimisticRemoveTag(tagId: number): void {
    const cached = this.cache.get('tags') as CacheEntry<Tag[]> | undefined

    if (cached) {
      const updatedTags = cached.data.filter(t => t.id !== tagId)
      this.cache.set('tags', {
        ...cached,
        data: updatedTags,
        timestamp: Date.now()
      })
      console.log('⚡ [TagCacheService] Tag removed optimistically:', tagId)
    }
  }

  /**
   * 更新缓存中的标签（乐观更新）
   */
  optimisticUpdateTag(updatedTag: Tag): void {
    const cached = this.cache.get('tags') as CacheEntry<Tag[]> | undefined

    if (cached) {
      const updatedTags = cached.data.map(t =>
        t.id === updatedTag.id ? updatedTag : t
      )
      this.cache.set('tags', {
        ...cached,
        data: updatedTags,
        timestamp: Date.now()
      })
      console.log('⚡ [TagCacheService] Tag updated optimistically:', updatedTag.name)
    }
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
      console.log(`🧹 [TagCacheService] Cleaned ${cleaned} expired cache entries`)
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cache.clear()
    this.initialized = false
    this.initPromise = null
    console.log('🗑️ [TagCacheService] All cache cleared')
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; entries: string[]; tagCount: number } {
    const cached = this.cache.get('tags') as CacheEntry<Tag[]> | undefined
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      tagCount: cached?.data.length || 0
    }
  }
}

// 导出单例实例
export const tagCacheService = new TagCacheService()

// 导出类型
export type { Tag }
