/**
 * 對話緩存工具
 * 用於存儲對話的元數據，優化骨架屏顯示
 */

interface ConversationMetadata {
  messageCount: number
  lastMessageTime: string
  lastVisited: string
}

const CACHE_KEY = 'conversation_metadata_cache'
const MAX_CACHE_SIZE = 50 // 最多緩存 50 個對話

class ConversationCache {
  private cache: Map<string, ConversationMetadata>

  constructor() {
    this.cache = new Map()
    this.loadFromStorage()
  }

  /**
   * 從 localStorage 加載緩存
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(CACHE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.cache = new Map(Object.entries(data))
      }
    } catch (error) {
      console.error('Failed to load conversation cache:', error)
    }
  }

  /**
   * 保存緩存到 localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.cache)
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save conversation cache:', error)
    }
  }

  /**
   * 獲取對話元數據
   */
  get(conversationId: string): ConversationMetadata | null {
    return this.cache.get(conversationId) || null
  }

  /**
   * 更新對話元數據
   */
  set(conversationId: string, metadata: Partial<ConversationMetadata>): void {
    const existing = this.cache.get(conversationId) || {
      messageCount: 0,
      lastMessageTime: new Date().toISOString(),
      lastVisited: new Date().toISOString()
    }

    const updated = {
      ...existing,
      ...metadata,
      lastVisited: new Date().toISOString()
    }

    this.cache.set(conversationId, updated)

    // 如果緩存過大，移除最舊的條目
    if (this.cache.size > MAX_CACHE_SIZE) {
      const oldestKey = this.getOldestKey()
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.saveToStorage()
  }

  /**
   * 獲取最舊的緩存鍵
   */
  private getOldestKey(): string | null {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, metadata] of this.cache.entries()) {
      const visitTime = new Date(metadata.lastVisited).getTime()
      if (visitTime < oldestTime) {
        oldestTime = visitTime
        oldestKey = key
      }
    }

    return oldestKey
  }

  /**
   * 獲取估計的消息數量（用於骨架屏）
   * 限制在 3-10 之間
   */
  getEstimatedMessageCount(conversationId: string): number {
    const metadata = this.get(conversationId)
    if (!metadata || metadata.messageCount === 0) {
      return 5 // 默認 5 條
    }

    // 限制在 3-10 之間
    return Math.min(10, Math.max(3, metadata.messageCount))
  }

  /**
   * 清除所有緩存
   */
  clear(): void {
    this.cache.clear()
    localStorage.removeItem(CACHE_KEY)
  }
}

export const conversationCache = new ConversationCache()
