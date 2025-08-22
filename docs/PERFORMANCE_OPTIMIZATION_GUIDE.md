# 效能調優指南
# Performance Optimization Guide

## 📊 **整體架構效能調優**

### 1. **Cloudflare Workers 優化**

#### **冷啟動優化**
```typescript
// 預載入關鍵模組
const criticalModules = {
  messageRecallService: () => import('./services/message-recall-service'),
  fileStorageService: () => import('./utils/file-storage'),
  authService: () => import('./services/auth-service')
}

// 使用 Module Worker 格式
export default {
  async fetch(request: Request, env: Bindings) {
    // 實現
  }
}
```

#### **記憶體使用優化**
```typescript
// 避免大物件在全域範圍
export class OptimizedHandler {
  private cache = new Map<string, unknown>()
  
  // 使用 WeakMap 避免記憶體洩漏
  private weakCache = new WeakMap()
  
  // 定期清理快取
  private cleanupCache() {
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries())
      entries.slice(0, 500).forEach(([key]) => this.cache.delete(key))
    }
  }
}
```

### 2. **資料庫效能優化 (D1)**

#### **查詢優化**
```sql
-- 建立複合索引
CREATE INDEX idx_conversations_status_priority 
ON conversations(status, priority, created_at);

CREATE INDEX idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_pending_messages_status_scheduled 
ON pending_messages(status, scheduled_send_time);

-- 檔案相關索引
CREATE INDEX idx_media_files_conversation 
ON media_files(conversation_id, created_at DESC);

CREATE INDEX idx_media_files_platform_type 
ON media_files(platform, message_type, created_at DESC);
```

#### **批次操作優化**
```typescript
// 批次插入訊息
async function batchInsertMessages(messages: Message[]) {
  const batchSize = 100
  const batches = []
  
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize))
  }
  
  for (const batch of batches) {
    const sql = `INSERT INTO messages (${columns}) VALUES ${
      batch.map(() => `(${placeholders})`).join(',')
    }`
    await db.prepare(sql).bind(...batch.flat()).run()
  }
}
```

### 3. **KV 存儲優化**

#### **快取策略**
```typescript
class OptimizedKVCache {
  private localCache = new Map<string, { data: unknown; expires: number }>()
  
  async get(key: string, ttl = 300): Promise<unknown> {
    // 1. 檢查本地快取
    const local = this.localCache.get(key)
    if (local && local.expires > Date.now()) {
      return local.data
    }
    
    // 2. 從 KV 獲取
    const data = await this.kv.get(key)
    if (data) {
      this.localCache.set(key, {
        data: JSON.parse(data),
        expires: Date.now() + ttl * 1000
      })
    }
    
    return data ? JSON.parse(data) : null
  }
  
  async set(key: string, value: unknown, ttl = 3600): Promise<void> {
    // 更新本地快取
    this.localCache.set(key, {
      data: value,
      expires: Date.now() + ttl * 1000
    })
    
    // 寫入 KV
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl })
  }
}
```

### 4. **R2 存儲優化**

#### **檔案上傳優化**
```typescript
class OptimizedFileStorage {
  // 使用 multipart upload 處理大檔案
  async uploadLargeFile(file: ArrayBuffer, key: string) {
    const chunkSize = 5 * 1024 * 1024 // 5MB chunks
    
    if (file.byteLength <= chunkSize) {
      return this.env.R2_BUCKET.put(key, file)
    }
    
    // 分塊上傳大檔案
    const multipart = await this.env.R2_BUCKET.createMultipartUpload(key)
    const parts = []
    
    for (let i = 0; i < file.byteLength; i += chunkSize) {
      const chunk = file.slice(i, i + chunkSize)
      const part = await multipart.uploadPart(parts.length + 1, chunk)
      parts.push(part)
    }
    
    return multipart.complete(parts)
  }
  
  // 預簽名 URL 減少 Worker 負載
  async generatePresignedUploadUrl(filename: string, contentType: string) {
    const key = `uploads/${Date.now()}-${filename}`
    
    // 使用 R2 預簽名 URL
    const presignedUrl = await this.env.R2_BUCKET.createPresignedUrl(
      'PUT',
      key,
      { expiresIn: 3600 } // 1小時有效
    )
    
    return { presignedUrl, key }
  }
}
```

## 🚀 **前端效能優化**

### 1. **程式碼分割與懶載入**
```typescript
// 路由層級的程式碼分割
const routes = [
  {
    path: '/dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/conversations',
    component: () => import('../views/Conversations.vue')
  },
  {
    path: '/files',
    component: () => import('../views/FileManagement.vue')
  }
]

// 組件層級的懶載入
const DelayedMessageSender = defineAsyncComponent({
  loader: () => import('./message/DelayedMessageSender.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})
```

### 2. **狀態管理優化**
```typescript
// 使用 Pinia 持久化插件
export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Conversation[]>([])
  const cache = new Map<string, Conversation>()
  
  // 記憶化計算
  const openConversations = computed(() => 
    conversations.value.filter(c => c.status === 'open')
  )
  
  // 防抖搜尋
  const debouncedSearch = debounce(async (query: string) => {
    const results = await searchConversations(query)
    conversations.value = results
  }, 300)
  
  return {
    conversations,
    openConversations,
    searchConversations: debouncedSearch
  }
}, {
  persist: {
    key: 'conversations-cache',
    storage: sessionStorage,
    paths: ['conversations'] // 只持久化特定狀態
  }
})
```

### 3. **網路請求優化**
```typescript
// API 快取與重複請求消除
class OptimizedApiClient {
  private cache = new Map<string, Promise<unknown>>()
  private pendingRequests = new Map<string, Promise<unknown>>()
  
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const key = `${endpoint}-${JSON.stringify(options)}`
    
    // 檢查快取
    if (this.cache.has(key) && !options.skipCache) {
      return this.cache.get(key) as Promise<T>
    }
    
    // 檢查進行中的請求
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>
    }
    
    // 發起新請求
    const request = this.makeRequest<T>(endpoint, options)
    this.pendingRequests.set(key, request)
    
    try {
      const result = await request
      
      // 快取成功的回應
      if (options.cacheTtl && options.cacheTtl > 0) {
        this.cache.set(key, Promise.resolve(result))
        setTimeout(() => this.cache.delete(key), options.cacheTtl * 1000)
      }
      
      return result
    } finally {
      this.pendingRequests.delete(key)
    }
  }
}

// 請求批次化
class BatchRequestManager {
  private batches = new Map<string, {
    requests: Array<{ resolve: Function; reject: Function; params: unknown }>
    timer: NodeJS.Timeout
  }>()
  
  batchRequest<T>(type: string, params: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.batches.has(type)) {
        this.batches.set(type, {
          requests: [],
          timer: setTimeout(() => this.processBatch(type), 100)
        })
      }
      
      this.batches.get(type)!.requests.push({ resolve, reject, params })
    })
  }
  
  private async processBatch(type: string) {
    const batch = this.batches.get(type)
    if (!batch) return
    
    this.batches.delete(type)
    
    try {
      const results = await this.executeBatch(type, batch.requests.map(r => r.params))
      batch.requests.forEach((request, index) => {
        request.resolve(results[index])
      })
    } catch (error) {
      batch.requests.forEach(request => {
        request.reject(error)
      })
    }
  }
}
```

### 4. **虛擬滾動優化**
```typescript
// 大列表虛擬滾動
export function useVirtualList<T>(
  items: Ref<T[]>,
  itemHeight: number,
  containerHeight: number
) {
  const scrollTop = ref(0)
  const startIndex = computed(() => Math.floor(scrollTop.value / itemHeight))
  const endIndex = computed(() => 
    Math.min(
      items.value.length - 1,
      startIndex.value + Math.ceil(containerHeight / itemHeight) + 1
    )
  )
  
  const visibleItems = computed(() => 
    items.value.slice(startIndex.value, endIndex.value + 1)
  )
  
  const offsetY = computed(() => startIndex.value * itemHeight)
  const totalHeight = computed(() => items.value.length * itemHeight)
  
  return {
    visibleItems,
    offsetY,
    totalHeight,
    scrollTop
  }
}
```

## 🔄 **即時功能優化**

### 1. **WebSocket 連線優化**
```typescript
class OptimizedWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private messageQueue: unknown[] = []
  private heartbeatInterval: NodeJS.Timeout | null = null
  
  connect(url: string) {
    this.ws = new WebSocket(url)
    
    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.flushMessageQueue()
      this.startHeartbeat()
    }
    
    this.ws.onclose = () => {
      this.stopHeartbeat()
      this.reconnect()
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }
  
  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      
      setTimeout(() => {
        this.connect(this.ws?.url || '')
      }, delay)
    }
  }
  
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // 30秒心跳
  }
  
  send(message: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }
  
  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.send(message)
    }
  }
}
```

### 2. **延遲訊息優化**
```typescript
// 使用 Durable Objects 處理延遲訊息
export class MessageScheduler {
  private scheduledMessages = new Map<string, NodeJS.Timeout>()
  
  async scheduleMessage(messageId: string, delayMs: number) {
    // 清除現有排程
    this.cancelMessage(messageId)
    
    // 使用 alarm API（Durable Objects）
    const alarm = Date.now() + delayMs
    await this.storage.setAlarm(alarm)
    await this.storage.put(`message:${messageId}`, { messageId, alarm })
    
    // 本地排程作為後備
    const timeout = setTimeout(() => {
      this.processScheduledMessage(messageId)
    }, delayMs)
    
    this.scheduledMessages.set(messageId, timeout)
  }
  
  async alarm() {
    // Durable Objects alarm 觸發
    const messages = await this.storage.list({ prefix: 'message:' })
    for (const [key, value] of messages) {
      const { messageId } = value as { messageId: string }
      await this.processScheduledMessage(messageId)
      await this.storage.delete(key)
    }
  }
}
```

## 📈 **監控與分析**

### 1. **效能監控**
```typescript
// 自定義效能監控
class PerformanceMonitor {
  private metrics = new Map<string, number[]>()
  
  startTimer(operation: string): () => void {
    const start = performance.now()
    
    return () => {
      const duration = performance.now() - start
      this.recordMetric(operation, duration)
    }
  }
  
  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const values = this.metrics.get(name)!
    values.push(value)
    
    // 保持最近 100 次記錄
    if (values.length > 100) {
      values.shift()
    }
  }
  
  getMetrics(name: string) {
    const values = this.metrics.get(name) || []
    return {
      count: values.length,
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99)
    }
  }
  
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[index] || 0
  }
}

// 使用範例
const monitor = new PerformanceMonitor()

async function optimizedApiCall() {
  const timer = monitor.startTimer('api-call')
  
  try {
    const result = await fetch('/api/data')
    return result
  } finally {
    timer()
  }
}
```

### 2. **資源使用監控**
```typescript
// Worker 記憶體使用監控
function monitorMemoryUsage() {
  if ('performance' in globalThis && 'memory' in performance) {
    const memory = (performance as any).memory
    
    console.log({
      usedJSMemory: `${(memory.usedJSMemory / 1024 / 1024).toFixed(2)} MB`,
      totalJSMemory: `${(memory.totalJSMemory / 1024 / 1024).toFixed(2)} MB`,
      jsMemoryLimit: `${(memory.jsMemoryLimit / 1024 / 1024).toFixed(2)} MB`
    })
  }
}

// CPU 使用時間監控
function monitorCPUTime() {
  const start = performance.now()
  
  return () => {
    const duration = performance.now() - start
    if (duration > 100) { // 超過 100ms 的操作
      console.warn(`Long running operation: ${duration.toFixed(2)}ms`)
    }
    return duration
  }
}
```

## 🎯 **具體優化建議**

### **短期優化 (1-2週)**
1. **資料庫索引優化** - 建立複合索引
2. **KV 快取策略** - 實現多層快取
3. **前端程式碼分割** - 路由層級分割
4. **API 批次化** - 減少請求數量

### **中期優化 (1個月)**
1. **Durable Objects 整合** - 處理狀態管理
2. **R2 預簽名 URL** - 減少 Worker 負載
3. **虛擬滾動** - 優化大列表性能
4. **WebSocket 優化** - 實現連線池

### **長期優化 (3個月)**
1. **CDN 最佳化** - 全球內容分發
2. **微服務架構** - 功能模組化
3. **AI 輔助優化** - 智能快取預測
4. **邊緣運算** - 就近處理請求

## 📊 **效能指標目標**

| 指標 | 目前 | 目標 | 優化方案 |
|------|------|------|----------|
| API 響應時間 | ~200ms | <100ms | KV快取 + 索引優化 |
| 頁面載入時間 | ~2s | <1s | 程式碼分割 + CDN |
| 檔案上傳速度 | ~5MB/s | >10MB/s | 預簽名URL + 並行上傳 |
| 記憶體使用 | ~50MB | <30MB | 物件池 + 快取清理 |
| 併發處理能力 | ~100 | >500 | 非同步處理 + 佇列優化 |

---

**持續監控與調優**：建議每週檢視效能指標，每月進行一次深度優化評估。