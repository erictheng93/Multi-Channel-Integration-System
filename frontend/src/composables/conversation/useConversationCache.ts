/**
 * Conversation Cache Composable
 *
 * 负责管理对话列表的 KV 缓存逻辑
 *
 * @module composables/conversation/useConversationCache
 *
 * @example
 * ```ts
 * const { getCachedData, setCachedData, invalidateCache, cacheHitRate } = useConversationCache()
 *
 * // 获取缓存数据
 * const cached = await getCachedData('conversation-list')
 *
 * // 设置缓存
 * await setCachedData('conversation-list', conversations)
 * ```
 */

import { ref, computed, type Ref } from 'vue'
import type { Conversation, ConversationFilters } from '@/types'

export interface CacheEntry<T = unknown> {
  /** 缓存数据 */
  data: T
  /** 缓存时间戳 */
  timestamp: number
  /** 过期时间（毫秒） */
  ttl: number
}

export interface ConversationCacheComposable {
  /** 缓存命中率（百分比） */
  cacheHitRate: Ref<number>
  /** 缓存命中次数 */
  cacheHits: Ref<number>
  /** 缓存未命中次数 */
  cacheMisses: Ref<number>
  /** 获取缓存数据 */
  getCachedData: (_key: string) => Promise<Conversation[] | null>
  /** 设置缓存数据 */
  setCachedData: (_key: string, _data: Conversation[], _ttl?: number) => Promise<void>
  /** 使缓存失效 */
  invalidateCache: (_key?: string) => Promise<void>
  /** 清除所有缓存 */
  clearAllCache: () => Promise<void>
  /** 生成缓存键（包含 userId 防止跨用户污染） */
  generateCacheKey: (_filters: ConversationFilters, _page: number, _userId?: string) => string
  /** 重置统计数据 */
  resetStats: () => void
}

/**
 * 默认 TTL（5 分钟）
 */
const DEFAULT_TTL = 5 * 60 * 1000

/**
 * 缓存键前缀
 */
const CACHE_PREFIX = 'conversation-list'

/**
 * 使用对话缓存功能
 *
 * @returns {ConversationCacheComposable} 缓存相关的状态和方法
 */
export function useConversationCache(): ConversationCacheComposable {
  // 统计状态
  const cacheHits = ref(0)
  const cacheMisses = ref(0)

  // 计算属性：缓存命中率
  const cacheHitRate = computed(() => {
    const total = cacheHits.value + cacheMisses.value
    if (total === 0) {return 0}
    return (cacheHits.value / total) * 100
  })

  /**
   * 生成缓存键（包含 userId 防止跨用户数据污染）
   *
   * @param {ConversationFilters} filters - 筛选条件
   * @param {number} page - 页码
   * @param {string} userId - 当前用户 ID（安全隔离）
   * @returns {string} 缓存键
   *
   * @example
   * const key = generateCacheKey({ status: 'open' }, 1, 'agent-123')
   * // 'conversation-list:user=agent-123:status=open:page=1'
   */
  function generateCacheKey(filters: ConversationFilters, page: number, userId?: string): string {
    const filterParts: string[] = []

    // userId MUST be first to ensure cache isolation between users
    if (userId) {filterParts.push(`user=${userId}`)}
    if (filters.status) {filterParts.push(`status=${filters.status}`)}
    if (filters.platform) {filterParts.push(`platform=${filters.platform}`)}
    // Note: Individual assignment (assignedTo) removed - use teamId instead
    if (filters.teamId) {filterParts.push(`team=${filters.teamId}`)}
    if (filters.tagIds && filters.tagIds.length > 0) {
      filterParts.push(`tags=${filters.tagIds.join(',')}`)
    }

    const filterStr = filterParts.length > 0 ? `:${filterParts.join(':')}` : ''
    return `${CACHE_PREFIX}${filterStr}:page=${page}`
  }

  /**
   * 获取缓存数据
   *
   * @param {string} key - 缓存键
   * @returns {Promise<Conversation[] | null>} 缓存的对话列表或 null
   *
   * @example
   * const cached = await getCachedData('conversation-list:page=1')
   */
  async function getCachedData(key: string): Promise<Conversation[] | null> {
    try {
      const cached = localStorage.getItem(key)
      if (!cached) {
        cacheMisses.value++
        return null
      }

      const entry: CacheEntry<Conversation[]> = JSON.parse(cached)
      const now = Date.now()

      // 检查是否过期
      if (now - entry.timestamp > entry.ttl) {
        localStorage.removeItem(key)
        cacheMisses.value++
        return null
      }

      cacheHits.value++
      console.log(`✨ [Cache] Hit for key: ${key}`)
      return entry.data
    } catch (error) {
      console.warn('[Cache] Failed to get cached data:', error)
      cacheMisses.value++
      return null
    }
  }

  /**
   * 设置缓存数据
   *
   * @param {string} key - 缓存键
   * @param {Conversation[]} data - 对话列表数据
   * @param {number} ttl - 过期时间（毫秒，默认 5 分钟）
   *
   * @example
   * await setCachedData('conversation-list:page=1', conversations, 300000)
   */
  async function setCachedData(
    key: string,
    data: Conversation[],
    ttl: number = DEFAULT_TTL
  ): Promise<void> {
    try {
      const entry: CacheEntry<Conversation[]> = {
        data,
        timestamp: Date.now(),
        ttl
      }
      localStorage.setItem(key, JSON.stringify(entry))
      console.log(`💾 [Cache] Set cache for key: ${key}`)
    } catch (error) {
      console.warn('[Cache] Failed to set cached data:', error)
      // 如果存储失败（可能是因为空间不足），清除旧缓存
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        await clearAllCache()
      }
    }
  }

  /**
   * 使缓存失效
   *
   * @param {string} key - 缓存键（可选，不提供则清除所有对话缓存）
   *
   * @example
   * await invalidateCache('conversation-list:page=1')
   * await invalidateCache() // 清除所有对话缓存
   */
  async function invalidateCache(key?: string): Promise<void> {
    try {
      if (key) {
        localStorage.removeItem(key)
        console.log(`🗑️ [Cache] Invalidated cache for key: ${key}`)
      } else {
        // 清除所有对话缓存
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
        keys.forEach(k => localStorage.removeItem(k))
        console.log(`🗑️ [Cache] Invalidated all conversation caches (${keys.length} keys)`)
      }
    } catch (error) {
      console.warn('[Cache] Failed to invalidate cache:', error)
    }
  }

  /**
   * 清除所有缓存
   *
   * @example
   * await clearAllCache()
   */
  async function clearAllCache(): Promise<void> {
    try {
      localStorage.clear()
      console.log('🗑️ [Cache] Cleared all cache')
    } catch (error) {
      console.warn('[Cache] Failed to clear cache:', error)
    }
  }

  /**
   * 重置统计数据
   *
   * @example
   * resetStats()
   */
  function resetStats(): void {
    cacheHits.value = 0
    cacheMisses.value = 0
  }

  return {
    cacheHitRate,
    cacheHits,
    cacheMisses,
    getCachedData,
    setCachedData,
    invalidateCache,
    clearAllCache,
    generateCacheKey,
    resetStats
  }
}
