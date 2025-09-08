// 智能快取管理服務 - 實現樂觀更新和快取策略
// 目標：零等待的用戶體驗

import { ref } from 'vue'
import type { Conversation, ConversationFilters } from '@/types'

// 快取項目接口
interface CacheItem<T> {
  data: T
  timestamp: number
  version: number
  filters?: ConversationFilters
  etag?: string
}

// 快取配置
interface CacheConfig {
  maxAge: number        // 最大快取時間（毫秒）
  maxSize: number       // 最大快取項目數量
  staleWhileRevalidate: number  // 後台更新閾值
  compression: boolean  // 是否啟用壓縮
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxAge: 5 * 60 * 1000,     // 5分鐘
  maxSize: 50,               // 最多50個快取項目
  staleWhileRevalidate: 30 * 1000, // 30秒後後台更新
  compression: true
}

export class CacheManager {
  private cache = new Map<string, CacheItem<unknown>>()
  private config: CacheConfig
  private accessTimes = new Map<string, number>()
  
  // 響應式狀態
  public cacheHitRate = ref(0)
  public cacheSize = ref(0)
  public stats = ref({
    hits: 0,
    misses: 0,
    evictions: 0,
    compressionRatio: 0
  })

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    this.setupCleanupInterval()
    this.loadFromPersistentStorage()
  }

  // 生成快取鍵
  private generateKey(prefix: string, params: Record<string, unknown> = {}): string {
    const cleanParams = this.cleanObject(params) as Record<string, unknown>
    const paramsStr = Object.keys(cleanParams).length > 0 
      ? JSON.stringify(cleanParams, Object.keys(cleanParams).sort())
      : ''
    return `${prefix}:${paramsStr}`
  }

  // 清理對象中的 undefined 值
  private cleanObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObject(item))
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null) {
          cleaned[key] = this.cleanObject(value)
        }
      }
      return cleaned
    }
    
    return obj
  }

  // 壓縮數據
  private compress(data: unknown): string {
    if (!this.config.compression) {return JSON.stringify(data)}
    
    try {
      const jsonStr = JSON.stringify(data)
      // 簡化壓縮：移除多餘空白和重複字符
      return jsonStr
        .replace(/\s+/g, ' ')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
    } catch {
      return JSON.stringify(data)
    }
  }

  // 解壓縮數據
  private decompress(data: string): unknown {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  // 檢查項目是否過期
  private isExpired(item: CacheItem<unknown>): boolean {
    return Date.now() - item.timestamp > this.config.maxAge
  }

  // 檢查項目是否需要後台更新
  private needsRevalidation(item: CacheItem<unknown>): boolean {
    return Date.now() - item.timestamp > this.config.staleWhileRevalidate
  }

  // LRU 淘汰策略
  private evictLRU() {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.accessTimes.delete(oldestKey)
      this.stats.value.evictions++
      console.log(`🗑️ [CacheManager] Evicted LRU item: ${oldestKey}`)
    }
  }

  // 設置快取項目
  set<T>(key: string, data: T, options?: { filters?: ConversationFilters; etag?: string }): void {
    // 如果快取已滿，淘汰最少使用的項目
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU()
    }

    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      version: 1,
      filters: options?.filters,
      etag: options?.etag
    }

    this.cache.set(key, cacheItem)
    this.accessTimes.set(key, Date.now())
    this.updateStats()

    // 持久化到 localStorage
    this.saveToPersistentStorage(key, cacheItem)
    
    console.log(`💾 [CacheManager] Cached ${key}, size: ${this.cache.size}`)
  }

  // 獲取快取項目
  get<T>(key: string): { data: T | null; isStale: boolean; needsUpdate: boolean } {
    const item = this.cache.get(key) as CacheItem<T> | undefined

    if (!item) {
      this.stats.value.misses++
      this.updateStats()
      return { data: null, isStale: false, needsUpdate: true }
    }

    // 更新訪問時間
    this.accessTimes.set(key, Date.now())

    // 檢查是否過期
    if (this.isExpired(item)) {
      this.cache.delete(key)
      this.accessTimes.delete(key)
      this.stats.value.misses++
      this.updateStats()
      return { data: null, isStale: true, needsUpdate: true }
    }

    this.stats.value.hits++
    const needsUpdate = this.needsRevalidation(item)
    this.updateStats()

    console.log(`🎯 [CacheManager] Cache ${needsUpdate ? 'hit (stale)' : 'hit'}: ${key}`)
    
    return {
      data: item.data,
      isStale: needsUpdate,
      needsUpdate
    }
  }

  // 樂觀更新：立即返回預期結果，後台同步
  optimisticUpdate<T>(key: string, updateFn: (_current: T | null) => T): T {
    const current = this.get<T>(key)
    const optimisticData = updateFn(current.data)
    
    // 立即更新快取
    this.set(key, optimisticData)
    
    console.log(`⚡ [CacheManager] Optimistic update: ${key}`)
    return optimisticData
  }

  // 快取失效處理
  invalidate(pattern: string | RegExp): number {
    let invalidatedCount = 0
    
    for (const key of this.cache.keys()) {
      const shouldInvalidate = typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key)
        
      if (shouldInvalidate) {
        this.cache.delete(key)
        this.accessTimes.delete(key)
        this.removePersistentStorage(key)
        invalidatedCount++
      }
    }

    this.updateStats()
    console.log(`🗑️ [CacheManager] Invalidated ${invalidatedCount} cache entries`)
    return invalidatedCount
  }

  // 清理過期項目
  cleanup(): number {
    let cleanedCount = 0
    const now = Date.now()

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.config.maxAge) {
        this.cache.delete(key)
        this.accessTimes.delete(key)
        this.removePersistentStorage(key)
        cleanedCount++
      }
    }

    this.updateStats()
    if (cleanedCount > 0) {
      console.log(`🧹 [CacheManager] Cleaned ${cleanedCount} expired items`)
    }
    return cleanedCount
  }

  // 預熱快取
  async prefetch<T>(key: string, dataLoader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key)
    
    if (cached.data && !cached.needsUpdate) {
      return cached.data
    }

    try {
      const data = await dataLoader()
      this.set(key, data)
      console.log(`🔥 [CacheManager] Prefetched: ${key}`)
      return data
    } catch (error) {
      console.error(`❌ [CacheManager] Prefetch failed for ${key}:`, error)
      throw error
    }
  }

  // 批量快取操作
  setMany<T>(entries: Array<{ key: string; data: T; options?: Partial<{ ttl: number; version: number; filters: ConversationFilters }> }>): void {
    entries.forEach(({ key, data, options }) => {
      this.set(key, data, options)
    })
    console.log(`📦 [CacheManager] Batch cached ${entries.length} items`)
  }

  // 更新統計資訊
  private updateStats() {
    const totalRequests = this.stats.value.hits + this.stats.value.misses
    this.cacheHitRate.value = totalRequests > 0 
      ? (this.stats.value.hits / totalRequests) * 100 
      : 0
    this.cacheSize.value = this.cache.size
  }

  // 持久化存儲
  private saveToPersistentStorage(key: string, item: CacheItem<unknown>) {
    try {
      const persistKey = `cache_${key}`
      const compressed = this.compress(item)
      localStorage.setItem(persistKey, compressed)
    } catch (error) {
      console.warn(`[CacheManager] Failed to persist ${key}:`, error)
    }
  }

  // 從持久化存儲載入
  private loadFromPersistentStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cache_')) {
          const cacheKey = key.substring(6)
          const data = localStorage.getItem(key)
          if (data) {
            const item = this.decompress(data) as CacheItem<unknown>
            if (item && typeof item === 'object' && 'timestamp' in item && !this.isExpired(item)) {
              this.cache.set(cacheKey, item)
              this.accessTimes.set(cacheKey, item.timestamp)
            } else {
              localStorage.removeItem(key)
            }
          }
        }
      }
      console.log(`💿 [CacheManager] Loaded ${this.cache.size} items from storage`)
    } catch (error) {
      console.warn('[CacheManager] Failed to load from storage:', error)
    }
  }

  // 從持久化存儲移除
  private removePersistentStorage(key: string) {
    try {
      localStorage.removeItem(`cache_${key}`)
    } catch (error) {
      console.warn(`[CacheManager] Failed to remove ${key} from storage:`, error)
    }
  }

  // 設置清理定時器
  private setupCleanupInterval() {
    // 每5分鐘清理一次過期項目
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  // 獲取快取統計
  getStats() {
    return {
      size: this.cache.size,
      hitRate: this.cacheHitRate.value,
      stats: this.stats.value,
      config: this.config
    }
  }

  // 清空所有快取
  clear(): void {
    this.cache.clear()
    this.accessTimes.clear()
    this.stats.value = { hits: 0, misses: 0, evictions: 0, compressionRatio: 0 }
    
    // 清理持久化存儲
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cache_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('[CacheManager] Failed to clear storage:', error)
    }
    
    this.updateStats()
    console.log('🧹 [CacheManager] Cache cleared')
  }
}

// 創建單例實例
export const cacheManager = new CacheManager()

// 專門用於對話的快取工具
export const conversationCache = {
  // 對話列表快取
  getConversationList: (filters: ConversationFilters = {}) => {
    const key = cacheManager['generateKey']('conversations', filters as Record<string, unknown>)
    return cacheManager.get<Conversation[]>(key)
  },

  setConversationList: (conversations: Conversation[], filters: ConversationFilters = {}) => {
    const key = cacheManager['generateKey']('conversations', filters as Record<string, unknown>)
    cacheManager.set(key, conversations, { filters })
  },

  // 單個對話快取
  getConversation: (id: string) => {
    return cacheManager.get<Conversation>(`conversation:${id}`)
  },

  setConversation: (conversation: Conversation) => {
    cacheManager.set(`conversation:${conversation.id}`, conversation)
  },

  // 樂觀更新對話狀態
  optimisticUpdateConversation: (id: string, updates: Partial<Conversation>) => {
    return cacheManager.optimisticUpdate<Conversation>(
      `conversation:${id}`,
      (current) => current ? { ...current, ...updates } : updates as Conversation
    )
  },

  // 失效相關快取
  invalidateConversation: (id: string) => {
    cacheManager.invalidate(`conversation:${id}`)
    cacheManager.invalidate('conversations') // 也失效列表快取
  },

  invalidateAll: () => {
    cacheManager.invalidate('conversation')
  }
}