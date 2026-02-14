/**
 * 🚀 Cloudflare Query Plugin for Pinia
 *
 * 結合 TanStack Query 概念與 Cloudflare 生態系統
 * 提供多租戶隔離、容錯機制、Edge 優化
 *
 * 核心特性:
 * - ✅ 自動租戶隔離 (基於 currentTeamId)
 * - ✅ KV 緩存持久化 (stale-while-revalidate)
 * - ✅ 重試機制 (exponential backoff)
 * - ✅ 多層降級策略
 * - ✅ Edge 環境優化
 */

import type { PiniaPluginContext } from 'pinia'
import { useAuthStore } from '@/stores/auth'

// Cloudflare KV Namespace type (for frontend compatibility)
type KVNamespace = {
  get(_key: string, _options?: string): Promise<unknown>
  put(_key: string, _value: string, _options?: { expirationTtl?: number }): Promise<void>
}

// ==================== 型別定義 ====================

interface QueryConfigInterface<T = unknown> {
  /** 查詢唯一標識 (自動添加 teamId prefix) */
  queryKey: string[]
  /** 查詢函數 */
  queryFn: () => Promise<T>
  /** 數據新鮮時間 (毫秒) - 在此時間內使用緩存 */
  staleTime?: number
  /** 緩存時間 (秒) - KV 過期時間 */
  cacheTime?: number
  /** 重試次數 */
  retry?: number
  /** 重試延遲函數 (exponential backoff) */
  retryDelay?: (_attempt: number) => number
  /** 是否啟用 stale-while-revalidate */
  revalidateOnStale?: boolean
  /** 是否在開發環境打印日誌 */
  verbose?: boolean
}

export type QueryConfig<T = unknown> = QueryConfigInterface<T>

interface CachedData<T = unknown> {
  data: T
  timestamp: number
  teamId: string
  queryKey: string
}

interface QueryMetrics {
  hits: number
  misses: number
  errors: number
  revalidations: number
  averageLatency: number
}

// ==================== KV Persister ====================

class CloudflareKVPersister {
  private metrics = new Map<string, QueryMetrics>()

  constructor(
    private _kvNamespace: KVNamespace | null,
    private _verbose: boolean = false
  ) {}

  private getMetrics(key: string): QueryMetrics {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        hits: 0,
        misses: 0,
        errors: 0,
        revalidations: 0,
        averageLatency: 0
      })
    }
    const metrics = this.metrics.get(key)
    if (!metrics) {
      throw new Error(`Metrics not found for key: ${key}`)
    }
    return metrics
  }

  private updateLatency(key: string, latency: number) {
    const metrics = this.getMetrics(key)
    const count = metrics.hits + metrics.misses
    metrics.averageLatency = (metrics.averageLatency * count + latency) / (count + 1)
  }

  async get<T>(key: string): Promise<CachedData<T> | null> {
    if (!this._kvNamespace) {
      this.log('KV namespace not available, skipping cache')
      return null
    }

    const start = performance.now()

    try {
      const cached = await this._kvNamespace.get(key, 'json')
      const latency = performance.now() - start

      if (cached) {
        const metrics = this.getMetrics(key)
        metrics.hits++
        this.updateLatency(key, latency)
        this.log(`[KV Hit] ${key} (${latency.toFixed(2)}ms)`, cached)
        return cached as CachedData<T>
      }

      const metrics = this.getMetrics(key)
      metrics.misses++
      this.updateLatency(key, latency)
      this.log(`[KV Miss] ${key} (${latency.toFixed(2)}ms)`)
      return null
    } catch (error) {
      const metrics = this.getMetrics(key)
      metrics.errors++
      console.error('[KV Error] Failed to get:', key, error)
      return null
    }
  }

  async set<T>(
    key: string,
    data: CachedData<T>,
    options: { expirationTtl: number }
  ): Promise<void> {
    if (!this._kvNamespace) {
      this.log('KV namespace not available, skipping cache write')
      return
    }

    try {
      await this._kvNamespace.put(
        key,
        JSON.stringify(data),
        { expirationTtl: options.expirationTtl }
      )
      this.log(`[KV Write] ${key} (TTL: ${options.expirationTtl}s)`)

      // 同時寫入 stale 緩存 (更長的 TTL，用於降級)
      await this._kvNamespace.put(
        `${key}:stale`,
        JSON.stringify(data),
        { expirationTtl: options.expirationTtl * 10 } // 10x TTL
      )
    } catch (error) {
      console.error('[KV Error] Failed to set:', key, error)
    }
  }

  async getStale<T>(key: string): Promise<CachedData<T> | null> {
    if (!this._kvNamespace) {return null}

    try {
      const stale = await this._kvNamespace.get(`${key}:stale`, 'json')
      if (stale) {
        this.log(`[KV Stale] ${key}`)
        return stale as CachedData<T>
      }
      return null
    } catch (error) {
      console.error('[KV Error] Failed to get stale:', key, error)
      return null
    }
  }

  getMetricsReport(): Record<string, QueryMetrics> {
    const report: Record<string, QueryMetrics> = {}
    this.metrics.forEach((metrics, key) => {
      report[key] = { ...metrics }
    })
    return report
  }

  private log(message: string, data?: unknown) {
    if (this._verbose) {
      if (data) {
        console.log(message, data)
      } else {
        console.log(message)
      }
    }
  }
}

// ==================== Query Executor ====================

class CloudflareQueryExecutor {
  constructor(
    private _persister: CloudflareKVPersister,
    private _verbose: boolean = false
  ) {}

  async execute<T>(config: QueryConfig<T>, teamId: string): Promise<T> {
    const {
      queryKey,
      queryFn,
      staleTime = 5000,
      cacheTime = 300,
      retry = 3,
      retryDelay = (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      revalidateOnStale = true
    } = config

    const fullKey = this.buildKey(teamId, queryKey)

    // 步驟 1: 檢查 KV 緩存
    const cached = await this._persister.get<T>(fullKey)

    if (cached && this.isFresh(cached, staleTime)) {
      this.log(`[Fresh Cache] ${fullKey}`)
      return cached.data
    }

    if (cached && revalidateOnStale) {
      // Stale-while-revalidate: 返回舊數據，背景更新
      this.log(`[Stale Cache] ${fullKey}, revalidating in background`)
      this.revalidateInBackground(fullKey, config, teamId)
      return cached.data
    }

    // 步驟 2: 執行查詢 (帶重試)
    let attempt = 0
    let lastError: unknown

    while (attempt <= retry) {
      try {
        this.log(`[Query Execute] ${fullKey} (attempt ${attempt + 1}/${retry + 1})`)
        const start = performance.now()

        const data = await queryFn()

        const latency = performance.now() - start
        this.log(`[Query Success] ${fullKey} (${latency.toFixed(2)}ms)`)

        // 步驟 3: 寫入 KV 緩存
        await this._persister.set(
          fullKey,
          {
            data,
            timestamp: Date.now(),
            teamId,
            queryKey: queryKey.join(':')
          },
          { expirationTtl: cacheTime }
        )

        return data
      } catch (error) {
        lastError = error
        attempt++

        if (attempt <= retry) {
          const delay = retryDelay(attempt)
          this.log(`[Query Error] ${fullKey}, retrying in ${delay}ms`, error)
          await this.sleep(delay)
        }
      }
    }

    // 步驟 4: 所有重試失敗，嘗試降級策略
    this.log(`[Query Failed] ${fullKey}, attempting degradation`)

    // 嘗試返回 stale cache
    const stale = await this._persister.getStale<T>(fullKey)
    if (stale) {
      console.warn(`[Degraded Mode] Using stale cache for ${fullKey}`, {
        age: Date.now() - stale.timestamp,
        error: lastError
      })
      return stale.data
    }

    // 完全失敗
    console.error(`[Query Catastrophic Failure] ${fullKey}`, lastError)
    throw lastError
  }

  private buildKey(teamId: string, queryKey: string[]): string {
    return ['team', teamId, ...queryKey].join(':')
  }

  private isFresh(cached: CachedData, staleTime: number): boolean {
    return Date.now() - cached.timestamp < staleTime
  }

  private async revalidateInBackground<T>(
    key: string,
    config: QueryConfig<T>,
    teamId: string
  ): Promise<void> {
    // 背景重新驗證，不阻塞當前請求
    setTimeout(async () => {
      try {
        this.log(`[Background Revalidation] ${key}`)
        const data = await config.queryFn()

        await this._persister.set(
          key,
          {
            data,
            timestamp: Date.now(),
            teamId,
            queryKey: config.queryKey.join(':')
          },
          { expirationTtl: config.cacheTime || 300 }
        )

        this.log(`[Revalidation Success] ${key}`)
      } catch (error) {
        console.warn(`[Revalidation Failed] ${key}`, error)
      }
    }, 0)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private log(message: string, data?: unknown) {
    if (this._verbose) {
      if (data) {
        console.log(message, data)
      } else {
        console.log(message)
      }
    }
  }
}

// ==================== Pinia Plugin ====================

export interface CloudflareQueryPluginOptions {
  /** Cloudflare KV Namespace (在前端可能為 null，後端通過 API 訪問) */
  kvNamespace?: KVNamespace
  /** 是否在開發環境打印詳細日誌 */
  verbose?: boolean
}

export function createCloudflareQueryPlugin(options: CloudflareQueryPluginOptions = {}) {
  const { kvNamespace, verbose = import.meta.env.DEV } = options

  // 在前端，KV 訪問通過 API proxy
  const persister = new CloudflareKVPersister(kvNamespace || null, verbose)
  const executor = new CloudflareQueryExecutor(persister, verbose)

  return ({ store }: PiniaPluginContext) => {
    // 注入 $cloudflareQuery 方法到每個 store
    store.$cloudflareQuery = async <T = unknown>(config: QueryConfig<T>): Promise<T> => {
      // 獲取當前租戶 ID
      const authStore = useAuthStore()
      const teamId = authStore.currentAgent?.primaryTeamId

      if (!teamId) {
        throw new Error('[CloudflareQuery] No active team context')
      }

      // 執行查詢
      return await executor.execute(config, String(teamId))
    }

    // 注入性能指標方法
    store.$queryMetrics = () => {
      return persister.getMetricsReport()
    }

    if (verbose) {
      console.log(`[CloudflareQuery] Plugin installed on store: ${store.$id}`)
    }
  }
}

// ==================== TypeScript 擴展 ====================

declare module 'pinia' {
  export interface PiniaCustomProperties {
    /** 執行 Cloudflare-optimized 查詢 */
    $cloudflareQuery: <T = unknown>(_config: QueryConfig<T>) => Promise<T>
    /** 獲取查詢性能指標 */
    $queryMetrics: () => Record<string, QueryMetrics>
  }
}

// ==================== 導出 ====================

export type { CachedData, QueryMetrics }
export { CloudflareKVPersister, CloudflareQueryExecutor }
