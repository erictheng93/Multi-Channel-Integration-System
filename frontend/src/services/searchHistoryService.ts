/**
 * 搜索歷史記錄服務
 * 管理用戶的搜索歷史，支持持久化存儲
 */

export interface SearchHistoryItem {
  /**
   * 搜索查詢字符串
   */
  query: string

  /**
   * 搜索時間戳
   */
  timestamp: number

  /**
   * 搜索結果數量
   */
  resultCount?: number

  /**
   * 搜索類型（普通搜索或高級搜索）
   */
  type?: 'basic' | 'advanced'
}

export interface SearchHistoryStats {
  /**
   * 總搜索次數
   */
  totalSearches: number

  /**
   * 最近搜索次數（24小時內）
   */
  recentSearches: number

  /**
   * 熱門搜索詞
   */
  topQueries: Array<{
    query: string
    count: number
  }>
}

const STORAGE_KEY = 'message_search_history'
const MAX_HISTORY_ITEMS = 50
const MAX_DISPLAY_ITEMS = 10

/**
 * 搜索歷史服務類
 */
export class SearchHistoryService {
  private history: SearchHistoryItem[] = []

  constructor() {
    this.loadFromStorage()
  }

  /**
   * 添加搜索記錄
   * @param query - 搜索查詢
   * @param resultCount - 結果數量
   * @param type - 搜索類型
   */
  addSearch(
    query: string,
    resultCount?: number,
    type: 'basic' | 'advanced' = 'basic'
  ): void {
    if (!query || !query.trim()) {
      return
    }

    const trimmedQuery = query.trim()

    // 移除重複的搜索（保留最新的）
    this.history = this.history.filter(item => item.query !== trimmedQuery)

    // 添加新記錄
    this.history.unshift({
      query: trimmedQuery,
      timestamp: Date.now(),
      resultCount,
      type
    })

    // 限制歷史記錄數量
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS)
    }

    this.saveToStorage()

    console.log(`[SearchHistory] 已添加: "${trimmedQuery}" (${resultCount ?? '?'} 條結果)`)
  }

  /**
   * 獲取最近搜索記錄
   * @param limit - 返回數量限制
   * @returns 搜索記錄數組
   */
  getRecentSearches(limit: number = MAX_DISPLAY_ITEMS): SearchHistoryItem[] {
    return this.history.slice(0, limit)
  }

  /**
   * 獲取所有搜索記錄
   * @returns 所有搜索記錄
   */
  getAllSearches(): SearchHistoryItem[] {
    return [...this.history]
  }

  /**
   * 根據關鍵詞搜索歷史記錄
   * @param keyword - 搜索關鍵詞
   * @returns 匹配的搜索記錄
   */
  searchHistory(keyword: string): SearchHistoryItem[] {
    if (!keyword || !keyword.trim()) {
      return this.getRecentSearches()
    }

    const lowerKeyword = keyword.toLowerCase()
    return this.history.filter(item =>
      item.query.toLowerCase().includes(lowerKeyword)
    )
  }

  /**
   * 刪除指定的搜索記錄
   * @param query - 要刪除的查詢
   */
  removeSearch(query: string): void {
    this.history = this.history.filter(item => item.query !== query)
    this.saveToStorage()
    console.log(`[SearchHistory] 已刪除: "${query}"`)
  }

  /**
   * 清空所有搜索記錄
   */
  clearHistory(): void {
    this.history = []
    this.saveToStorage()
    console.log('[SearchHistory] 已清空所有歷史記錄')
  }

  /**
   * 獲取搜索統計信息
   * @returns 統計信息
   */
  getStats(): SearchHistoryStats {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    // 計算最近24小時的搜索
    const recentSearches = this.history.filter(
      item => item.timestamp > oneDayAgo
    ).length

    // 計算熱門搜索詞
    const queryCount = new Map<string, number>()
    this.history.forEach(item => {
      const count = queryCount.get(item.query) || 0
      queryCount.set(item.query, count + 1)
    })

    const topQueries = Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalSearches: this.history.length,
      recentSearches,
      topQueries
    }
  }

  /**
   * 獲取熱門搜索詞
   * @param limit - 返回數量限制
   * @returns 熱門搜索詞數組
   */
  getPopularSearches(limit: number = 5): Array<{
    query: string
    count: number
  }> {
    const stats = this.getStats()
    return stats.topQueries.slice(0, limit)
  }

  /**
   * 檢查是否有搜索歷史
   * @returns 是否有歷史記錄
   */
  hasHistory(): boolean {
    return this.history.length > 0
  }

  /**
   * 從 localStorage 加載歷史記錄
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          this.history = parsed
          console.log(`[SearchHistory] 已加載 ${this.history.length} 條歷史記錄`)
        }
      }
    } catch (error) {
      console.error('[SearchHistory] 加載歷史記錄失敗:', error)
      this.history = []
    }
  }

  /**
   * 保存歷史記錄到 localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history))
    } catch (error) {
      console.error('[SearchHistory] 保存歷史記錄失敗:', error)
      // 如果存儲失敗（如配額已滿），嘗試清理舊記錄
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[SearchHistory] 存儲配額已滿，清理舊記錄')
        this.history = this.history.slice(0, Math.floor(MAX_HISTORY_ITEMS / 2))
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history))
        } catch (retryError) {
          console.error('[SearchHistory] 重試保存失敗:', retryError)
        }
      }
    }
  }

  /**
   * 導出搜索歷史為 JSON
   * @returns JSON 字符串
   */
  exportToJSON(): string {
    return JSON.stringify(this.history, null, 2)
  }

  /**
   * 從 JSON 導入搜索歷史
   * @param json - JSON 字符串
   * @returns 是否成功
   */
  importFromJSON(json: string): boolean {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        this.history = parsed.slice(0, MAX_HISTORY_ITEMS)
        this.saveToStorage()
        console.log(`[SearchHistory] 已導入 ${this.history.length} 條記錄`)
        return true
      } else {
        console.error('[SearchHistory] 無效的 JSON 格式')
        return false
      }
    } catch (error) {
      console.error('[SearchHistory] 導入失敗:', error)
      return false
    }
  }

  /**
   * 獲取搜索建議
   * 基於歷史記錄提供搜索建議
   * @param partial - 部分查詢字符串
   * @param limit - 建議數量限制
   * @returns 建議的搜索詞
   */
  getSuggestions(partial: string, limit: number = 5): string[] {
    if (!partial || !partial.trim()) {
      // 如果沒有輸入，返回最近的搜索
      return this.getRecentSearches(limit).map(item => item.query)
    }

    const lowerPartial = partial.toLowerCase()

    // 查找以輸入開頭的搜索詞
    const startsWith = this.history
      .filter(item => item.query.toLowerCase().startsWith(lowerPartial))
      .map(item => item.query)

    // 查找包含輸入的搜索詞
    const contains = this.history
      .filter(
        item =>
          !item.query.toLowerCase().startsWith(lowerPartial) &&
          item.query.toLowerCase().includes(lowerPartial)
      )
      .map(item => item.query)

    // 合併並去重
    const suggestions = [...new Set([...startsWith, ...contains])]

    return suggestions.slice(0, limit)
  }
}

/**
 * 單例實例
 */
export const searchHistoryService = new SearchHistoryService()

/**
 * 默認導出
 */
export default searchHistoryService
