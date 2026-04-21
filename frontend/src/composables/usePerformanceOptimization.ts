import { ref, computed, shallowRef, type ComputedRef } from 'vue'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('usePerformanceOptimization')

/**
 * 快取鍵類型
 */
type CacheKey = string | number

/**
 * 快取項目
 */
interface CacheItem<T> {
  value: T
  timestamp: number
  hitCount: number
}

/**
 * 性能優化選項
 */
interface PerformanceOptions {
  // 快取時間 (毫秒)
  cacheTimeout?: number
  // 最大快取項目數
  maxCacheSize?: number
  // 是否啟用性能監控
  enableProfiling?: boolean
}

export interface PerformanceOptimizer {
  // 快取的計算屬性
  cachedComputed: <T>(
    _getter: () => T,
    _key: CacheKey,
    _options?: { timeout?: number }
  ) => ComputedRef<T>

  // 懶加載的計算屬性
  lazyComputed: <T>(
    _getter: () => T,
    _defaultValue: T
  ) => {
    value: ComputedRef<T>
    load: () => void
    isLoaded: ComputedRef<boolean>
  }

  // 防抖的計算屬性
  debouncedComputed: <T>(
    _getter: () => T,
    _delay: number
  ) => ComputedRef<T>

  // 記憶化函數
  memoize: <TArgs extends readonly unknown[], TReturn>(
    _fn: (..._args: TArgs) => TReturn,
    _keyGenerator?: (..._args: TArgs) => string
  ) => (..._args: TArgs) => TReturn

  // 清理快取
  clearCache: (_key?: CacheKey) => void

  // 獲取快取統計
  getCacheStats: () => {
    size: number
    hitRate: number
    totalHits: number
    totalMisses: number
  }
}

/**
 * 性能優化 composable
 * 提供快取、懶加載和記憶化功能
 */
export function usePerformanceOptimization(
  options: PerformanceOptions = {}
): PerformanceOptimizer {
  const {
    cacheTimeout = 5 * 60 * 1000, // 5分鐘預設快取時間
    maxCacheSize = 50,
    enableProfiling = false
  } = options

  // 快取存儲
  const cache = new Map<CacheKey, CacheItem<unknown>>()
  const totalHits = ref(0)
  const totalMisses = ref(0)

  // 清理過期快取
  const cleanupExpiredCache = () => {
    const now = Date.now()
    for (const [key, item] of cache.entries()) {
      if (now - item.timestamp > cacheTimeout) {
        cache.delete(key)
      }
    }
  }

  // 限制快取大小
  const enforceCacheLimit = () => {
    if (cache.size > maxCacheSize) {
      // 刪除最少使用的項目
      const entries = Array.from(cache.entries())
      entries.sort((a, b) => a[1].hitCount - b[1].hitCount)
      const toDelete = entries.slice(0, cache.size - maxCacheSize)
      toDelete.forEach(([key]) => cache.delete(key))
    }
  }

  // 快取的計算屬性
  const cachedComputed = <T>(
    getter: () => T,
    key: CacheKey,
    itemOptions: { timeout?: number } = {}
  ): ComputedRef<T> => {
    const timeout = itemOptions.timeout || cacheTimeout

    return computed(() => {
      const now = Date.now()
      const cached = cache.get(key)

      // 檢查快取是否有效
      if (cached && (now - cached.timestamp) < timeout) {
        cached.hitCount++
        totalHits.value++
        if (enableProfiling) {
          frontendLogger.debug(`Cache hit for key: ${key}`)
        }
        return cached.value as T
      }

      // 計算新值
      totalMisses.value++
      if (enableProfiling) {
        frontendLogger.debug(`Cache miss for key: ${key}`)
      }

      const value = getter()
      cache.set(key, {
        value,
        timestamp: now,
        hitCount: 1
      })

      // 清理和限制快取
      cleanupExpiredCache()
      enforceCacheLimit()

      return value
    })
  }

  // 懶加載的計算屬性
  const lazyComputed = <T>(
    getter: () => T,
    defaultValue: T
  ) => {
    const isLoaded = ref(false)
    const storedValue = shallowRef<T>(defaultValue)

    const load = () => {
      if (!isLoaded.value) {
        storedValue.value = getter()
        isLoaded.value = true
      }
    }

    const value = computed(() => storedValue.value)

    return {
      value: value as ComputedRef<T>,
      load,
      isLoaded: computed(() => isLoaded.value)
    }
  }

  // 防抖的計算屬性
  const debouncedComputed = <T>(
    getter: () => T,
    delay: number
  ): ComputedRef<T> => {
    const debouncedValue = ref<T>()
    const hasInitialValue = ref(false)
    let timeoutId: number | null = null

    return computed(() => {
      // 清除之前的計時器
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }

      // 設置新的計時器
      timeoutId = window.setTimeout(() => {
        debouncedValue.value = getter()
        hasInitialValue.value = true
        timeoutId = null
      }, delay)

      // 第一次調用時立即返回值
      if (!hasInitialValue.value) {
        const initialValue = getter()
        debouncedValue.value = initialValue
        hasInitialValue.value = true
        return initialValue
      }

      return debouncedValue.value as T
    })
  }

  // 記憶化函數
  const memoize = <TArgs extends readonly unknown[], TReturn>(
    fn: (..._args: TArgs) => TReturn,
    keyGenerator?: (..._args: TArgs) => string
  ) => {
    const memoCache = new Map<string, TReturn>()

    return (..._args: TArgs): TReturn => {
      const key = keyGenerator ? keyGenerator(..._args) : JSON.stringify(_args)

      if (memoCache.has(key)) {
        totalHits.value++
        const cachedResult = memoCache.get(key)
        if (cachedResult !== undefined) {
          return cachedResult
        }
      }

      totalMisses.value++
      const result = fn(..._args)
      memoCache.set(key, result)
      return result
    }
  }

  // 清理快取
  const clearCache = (key?: CacheKey) => {
    if (key !== undefined) {
      cache.delete(key)
    } else {
      cache.clear()
    }
  }

  // 獲取快取統計
  const getCacheStats = () => {
    const total = totalHits.value + totalMisses.value
    return {
      size: cache.size,
      hitRate: total > 0 ? totalHits.value / total : 0,
      totalHits: totalHits.value,
      totalMisses: totalMisses.value
    }
  }

  return {
    cachedComputed,
    lazyComputed,
    debouncedComputed,
    memoize,
    clearCache,
    getCacheStats
  }
}