/**
 * 搜索性能監控服務
 * 記錄和分析搜索性能指標
 */

export interface SearchMetric {
  query: string
  searchType: 'basic' | 'advanced' | 'fuzzy'
  resultCount: number
  executionTime: number
  timestamp: number
}

export interface PerformanceStats {
  totalSearches: number
  avgExecutionTime: number
  minExecutionTime: number
  maxExecutionTime: number
  p50ExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number
  slowestQueries: Array<{
    query: string
    executionTime: number
    resultCount: number
  }>
  searchTypeDistribution: {
    basic: number
    advanced: number
    fuzzy: number
  }
}

const MAX_METRICS = 1000 // 最多保存的指標數量
const SLOW_QUERY_THRESHOLD = 50 // 慢查詢閾值（毫秒）

/**
 * 搜索性能監控服務類
 */
export class SearchPerformanceMonitor {
  private metrics: SearchMetric[] = []
  private isEnabled = true

  /**
   * 記錄搜索指標
   */
  recordSearch(metric: Omit<SearchMetric, 'timestamp'>): void {
    if (!this.isEnabled) {
      return
    }

    const fullMetric: SearchMetric = {
      ...metric,
      timestamp: Date.now()
    }

    this.metrics.push(fullMetric)

    // 限制指標數量
    if (this.metrics.length > MAX_METRICS) {
      this.metrics = this.metrics.slice(-MAX_METRICS)
    }

    // 記錄慢查詢
    if (metric.executionTime > SLOW_QUERY_THRESHOLD) {
      console.warn(
        `⚠️ [SearchPerf] 慢查詢檢測: "${metric.query}" 耗時 ${metric.executionTime.toFixed(2)}ms`
      )
    }
  }

  /**
   * 獲取性能統計
   */
  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalSearches: 0,
        avgExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        p50ExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
        slowestQueries: [],
        searchTypeDistribution: {
          basic: 0,
          advanced: 0,
          fuzzy: 0
        }
      }
    }

    const executionTimes = this.metrics.map(m => m.executionTime).sort((a, b) => a - b)
    const totalSearches = this.metrics.length

    // 計算平均值
    const avgExecutionTime =
      executionTimes.reduce((sum, time) => sum + time, 0) / totalSearches

    // 計算百分位數
    const p50Index = Math.floor(totalSearches * 0.5)
    const p95Index = Math.floor(totalSearches * 0.95)
    const p99Index = Math.floor(totalSearches * 0.99)

    // 找出最慢的查詢
    const slowestQueries = [...this.metrics]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10)
      .map(m => ({
        query: m.query,
        executionTime: m.executionTime,
        resultCount: m.resultCount
      }))

    // 計算搜索類型分佈
    const searchTypeDistribution = this.metrics.reduce(
      (acc, m) => {
        acc[m.searchType]++
        return acc
      },
      { basic: 0, advanced: 0, fuzzy: 0 }
    )

    return {
      totalSearches,
      avgExecutionTime,
      minExecutionTime: executionTimes[0] || 0,
      maxExecutionTime: executionTimes[totalSearches - 1] || 0,
      p50ExecutionTime: executionTimes[p50Index] || 0,
      p95ExecutionTime: executionTimes[p95Index] || 0,
      p99ExecutionTime: executionTimes[p99Index] || 0,
      slowestQueries,
      searchTypeDistribution
    }
  }

  /**
   * 獲取最近的搜索記錄
   */
  getRecentMetrics(limit: number = 50): SearchMetric[] {
    return this.metrics.slice(-limit)
  }

  /**
   * 獲取慢查詢列表
   */
  getSlowQueries(threshold: number = SLOW_QUERY_THRESHOLD): SearchMetric[] {
    return this.metrics.filter(m => m.executionTime > threshold)
  }

  /**
   * 獲取搜索類型統計
   */
  getSearchTypeStats(): {
    type: 'basic' | 'advanced' | 'fuzzy'
    count: number
    avgTime: number
  }[] {
    const typeGroups = this.metrics.reduce((acc, m) => {
      if (!acc[m.searchType]) {
        acc[m.searchType] = []
      }
      const group = acc[m.searchType]
      if (group) {
        group.push(m.executionTime)
      }
      return acc
    }, {} as Record<string, number[]>)

    return Object.entries(typeGroups).map(([type, times]) => ({
      type: type as 'basic' | 'advanced' | 'fuzzy',
      count: times.length,
      avgTime: times.reduce((sum, t) => sum + t, 0) / times.length
    }))
  }

  /**
   * 清除所有指標
   */
  clearMetrics(): void {
    this.metrics = []
    console.log('🗑️ [SearchPerf] 指標已清除')
  }

  /**
   * 啟用/禁用監控
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    console.log(`${enabled ? '✅' : '❌'} [SearchPerf] 監控已${enabled ? '啟用' : '禁用'}`)
  }

  /**
   * 導出指標為 JSON
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        metrics: this.metrics,
        stats: this.getStats(),
        exportedAt: new Date().toISOString()
      },
      null,
      2
    )
  }

  /**
   * 導入指標
   */
  importMetrics(json: string): boolean {
    try {
      const data = JSON.parse(json)
      if (Array.isArray(data.metrics)) {
        this.metrics = data.metrics.slice(-MAX_METRICS)
        console.log(`📥 [SearchPerf] 已導入 ${this.metrics.length} 條指標`)
        return true
      }
      return false
    } catch (error) {
      console.error('❌ [SearchPerf] 導入失敗:', error)
      return false
    }
  }

  /**
   * 獲取性能報告
   */
  getPerformanceReport(): string {
    const stats = this.getStats()

    return `
# 搜索性能報告

## 總體統計
- 總搜索次數: ${stats.totalSearches}
- 平均執行時間: ${stats.avgExecutionTime.toFixed(2)}ms
- 最小執行時間: ${stats.minExecutionTime.toFixed(2)}ms
- 最大執行時間: ${stats.maxExecutionTime.toFixed(2)}ms

## 百分位數
- P50: ${stats.p50ExecutionTime.toFixed(2)}ms
- P95: ${stats.p95ExecutionTime.toFixed(2)}ms
- P99: ${stats.p99ExecutionTime.toFixed(2)}ms

## 搜索類型分佈
- 基礎搜索: ${stats.searchTypeDistribution.basic}
- 高級搜索: ${stats.searchTypeDistribution.advanced}
- 模糊搜索: ${stats.searchTypeDistribution.fuzzy}

## 最慢的查詢 (Top 10)
${stats.slowestQueries
  .map(
    (q, i) =>
      `${i + 1}. "${q.query}" - ${q.executionTime.toFixed(2)}ms (${q.resultCount} 條結果)`
  )
  .join('\n')}
    `.trim()
  }
}

/**
 * 單例實例
 */
export const searchPerformanceMonitor = new SearchPerformanceMonitor()

/**
 * 默認導出
 */
export default searchPerformanceMonitor
