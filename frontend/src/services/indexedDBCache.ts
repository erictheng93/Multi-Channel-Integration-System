/**
 * IndexedDB 緩存服務
 * 用於持久化消息索引，避免每次頁面加載都重新構建
 */

/* global indexedDB, IDBDatabase, IDBOpenDBRequest */

interface CachedIndex {
  id: string
  serializedIndex: string
  documents: Record<string, unknown>
  messageCount: number
  timestamp: number
  version: string
}

interface CacheMetadata {
  messageCount: number
  timestamp: number
  version: string
}

const DB_NAME = 'MessageIndexCache'
const DB_VERSION = 1
const STORE_NAME = 'indexes'
const INDEX_KEY = 'message_index_v1'
const CACHE_VERSION = '1.0.0'
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000 // 7 天

/**
 * IndexedDB 緩存服務類
 */
export class IndexedDBCacheService {
  private db: IDBDatabase | null = null
  private isInitialized = false

  /**
   * 初始化數據庫
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('[IndexedDBCache] 打開數據庫失敗:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        console.log('[IndexedDBCache] 數據庫已打開')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 創建對象存儲
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          objectStore.createIndex('timestamp', 'timestamp', { unique: false })
          console.log('[IndexedDBCache] 對象存儲已創建')
        }
      }
    })
  }

  /**
   * 保存索引到緩存
   */
  async saveIndex(
    serializedIndex: string,
    documents: Record<string, unknown>,
    messageCount: number
  ): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('數據庫未初始化')
    }

    const db = this.db

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const cacheData: CachedIndex = {
        id: INDEX_KEY,
        serializedIndex,
        documents,
        messageCount,
        timestamp: Date.now(),
        version: CACHE_VERSION
      }

      const request = store.put(cacheData)

      request.onsuccess = () => {
        console.log(`[IndexedDBCache] 索引已保存: ${messageCount} 條消息`)
        resolve()
      }

      request.onerror = () => {
        console.error('[IndexedDBCache] 保存索引失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 從緩存加載索引
   */
  async loadIndex(): Promise<CachedIndex | null> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('數據庫未初始化')
    }

    const db = this.db

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(INDEX_KEY)

      request.onsuccess = () => {
        const cachedData = request.result as CachedIndex | undefined

        if (!cachedData) {
          console.log('[IndexedDBCache] 緩存未找到')
          resolve(null)
          return
        }

        // 檢查緩存是否過期
        const age = Date.now() - cachedData.timestamp
        if (age > MAX_CACHE_AGE) {
          console.warn(`[IndexedDBCache] 緩存已過期 (${Math.floor(age / (24 * 60 * 60 * 1000))} 天)`)
          this.clearCache().catch(console.error)
          resolve(null)
          return
        }

        // 檢查版本
        if (cachedData.version !== CACHE_VERSION) {
          console.warn(`[IndexedDBCache] 緩存版本不匹配 (${cachedData.version} vs ${CACHE_VERSION})`)
          this.clearCache().catch(console.error)
          resolve(null)
          return
        }

        console.log(`[IndexedDBCache] 索引已加載: ${cachedData.messageCount} 條消息 (${Math.floor(age / 1000)}秒前)`)
        resolve(cachedData)
      }

      request.onerror = () => {
        console.error('[IndexedDBCache] 加載索引失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取緩存元數據
   */
  async getCacheMetadata(): Promise<CacheMetadata | null> {
    const cached = await this.loadIndex()
    if (!cached) {
      return null
    }

    return {
      messageCount: cached.messageCount,
      timestamp: cached.timestamp,
      version: cached.version
    }
  }

  /**
   * 檢查緩存是否有效
   */
  async isCacheValid(currentMessageCount: number): Promise<boolean> {
    const metadata = await this.getCacheMetadata()

    if (!metadata) {
      return false
    }

    // 檢查消息數量是否匹配
    if (metadata.messageCount !== currentMessageCount) {
      console.log(`[IndexedDBCache] 消息數量不匹配 (緩存: ${metadata.messageCount}, 當前: ${currentMessageCount})`)
      return false
    }

    // 檢查緩存年齡
    const age = Date.now() - metadata.timestamp
    if (age > MAX_CACHE_AGE) {
      console.log(`[IndexedDBCache] 緩存已過期 (${Math.floor(age / (24 * 60 * 60 * 1000))} 天)`)
      return false
    }

    return true
  }

  /**
   * 清除緩存
   */
  async clearCache(): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('數據庫未初始化')
    }

    const db = this.db

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(INDEX_KEY)

      request.onsuccess = () => {
        console.log('[IndexedDBCache] 緩存已清除')
        resolve()
      }

      request.onerror = () => {
        console.error('[IndexedDBCache] 清除緩存失敗:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 獲取緩存大小估算
   */
  async getCacheSize(): Promise<number> {
    const cached = await this.loadIndex()
    if (!cached) {
      return 0
    }

    // 估算大小（字節）
    const indexSize = new Blob([cached.serializedIndex]).size
    const documentsSize = new Blob([JSON.stringify(cached.documents)]).size

    return indexSize + documentsSize
  }

  /**
   * 獲取緩存統計信息
   */
  async getStats(): Promise<{
    hasCache: boolean
    messageCount: number
    cacheAge: number
    cacheSize: number
    version: string
  }> {
    const metadata = await this.getCacheMetadata()

    if (!metadata) {
      return {
        hasCache: false,
        messageCount: 0,
        cacheAge: 0,
        cacheSize: 0,
        version: CACHE_VERSION
      }
    }

    const cacheAge = Date.now() - metadata.timestamp
    const cacheSize = await this.getCacheSize()

    return {
      hasCache: true,
      messageCount: metadata.messageCount,
      cacheAge,
      cacheSize,
      version: metadata.version
    }
  }

  /**
   * 關閉數據庫連接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isInitialized = false
      console.log('[IndexedDBCache] 數據庫已關閉')
    }
  }
}

/**
 * 單例實例
 */
export const indexedDBCache = new IndexedDBCacheService()

/**
 * 默認導出
 */
export default indexedDBCache
