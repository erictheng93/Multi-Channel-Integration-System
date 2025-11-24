
# Performance Optimization Guide

## ****

### 1. **Cloudflare Workers **

#### ****
```typescript
//
const criticalModules = {
 messageRecallService: () => import('./services/message-recall-service'),
 fileStorageService: () => import('./utils/file-storage'),
 authService: () => import('./services/auth-service')
}

// Module Worker
export default {
 async fetch(request: Request, env: Bindings) {
 //
 }
}
```

#### ****
```typescript
//
export class OptimizedHandler {
 private cache = new Map<string, unknown>()

 // WeakMap
 private weakCache = new WeakMap()

 //
 private cleanupCache() {
 if (this.cache.size > 1000) {
 const entries = Array.from(this.cache.entries())
 entries.slice(0, 500).forEach(([key]) => this.cache.delete(key))
 }
 }
}
```

### 2. ** (D1)**

#### ****
```sql
--
CREATE INDEX idx_conversations_status_priority
ON conversations(status, priority, created_at);

CREATE INDEX idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_pending_messages_status_scheduled
ON pending_messages(status, scheduled_send_time);

--
CREATE INDEX idx_media_files_conversation
ON media_files(conversation_id, created_at DESC);

CREATE INDEX idx_media_files_platform_type
ON media_files(platform, message_type, created_at DESC);
```

#### ****
```typescript
//
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

### 3. **KV **

#### ****
```typescript
class OptimizedKVCache {
 private localCache = new Map<string, { data: unknown; expires: number }>()

 async get(key: string, ttl = 300): Promise<unknown> {
 // 1.
 const local = this.localCache.get(key)
 if (local && local.expires > Date.now()) {
 return local.data
 }

 // 2. KV
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
 //
 this.localCache.set(key, {
 data: value,
 expires: Date.now() + ttl * 1000
 })

 // KV
 await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl })
 }
}
```

### 4. **R2 **

#### ****
```typescript
class OptimizedFileStorage {
 // multipart upload
 async uploadLargeFile(file: ArrayBuffer, key: string) {
 const chunkSize = 5 * 1024 * 1024 // 5MB chunks

 if (file.byteLength <= chunkSize) {
 return this.env.R2_BUCKET.put(key, file)
 }

 //
 const multipart = await this.env.R2_BUCKET.createMultipartUpload(key)
 const parts = []

 for (let i = 0; i < file.byteLength; i += chunkSize) {
 const chunk = file.slice(i, i + chunkSize)
 const part = await multipart.uploadPart(parts.length + 1, chunk)
 parts.push(part)
 }

 return multipart.complete(parts)
 }

 // URL Worker
 async generatePresignedUploadUrl(filename: string, contentType: string) {
 const key = `uploads/${Date.now()}-${filename}`

 // R2 URL
 const presignedUrl = await this.env.R2_BUCKET.createPresignedUrl(
 'PUT',
 key,
 { expiresIn: 3600 } // 1
 )

 return { presignedUrl, key }
 }
}
```

## ****

### 1. ****
```typescript
//
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

//
const DelayedMessageSender = defineAsyncComponent({
 loader: () => import('./message/DelayedMessageSender.vue'),
 loadingComponent: LoadingSpinner,
 errorComponent: ErrorComponent,
 delay: 200,
 timeout: 3000
})
```

### 2. ****
```typescript
// Pinia
export const useConversationsStore = defineStore('conversations', () => {
 const conversations = ref<Conversation[]>([])
 const cache = new Map<string, Conversation>()

 //
 const openConversations = computed(() =>
 conversations.value.filter(c => c.status === 'open')
 )

 //
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
 paths: ['conversations'] //
 }
})
```

### 3. ****
```typescript
// API
class OptimizedApiClient {
 private cache = new Map<string, Promise<unknown>>()
 private pendingRequests = new Map<string, Promise<unknown>>()

 async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
 const key = `${endpoint}-${JSON.stringify(options)}`

 //
 if (this.cache.has(key) && !options.skipCache) {
 return this.cache.get(key) as Promise<T>
 }

 //
 if (this.pendingRequests.has(key)) {
 return this.pendingRequests.get(key) as Promise<T>
 }

 //
 const request = this.makeRequest<T>(endpoint, options)
 this.pendingRequests.set(key, request)

 try {
 const result = await request

 //
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

//
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

### 4. ****
```typescript
//
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

## ****

### 1. **WebSocket **
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
 }, 30000) // 30
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

### 2. ****
```typescript
// Durable Objects
export class MessageScheduler {
 private scheduledMessages = new Map<string, NodeJS.Timeout>()

 async scheduleMessage(messageId: string, delayMs: number) {
 //
 this.cancelMessage(messageId)

 // alarm APIDurable Objects
 const alarm = Date.now() + delayMs
 await this.storage.setAlarm(alarm)
 await this.storage.put(`message:${messageId}`, { messageId, alarm })

 //
 const timeout = setTimeout(() => {
 this.processScheduledMessage(messageId)
 }, delayMs)

 this.scheduledMessages.set(messageId, timeout)
 }

 async alarm() {
 // Durable Objects alarm
 const messages = await this.storage.list({ prefix: 'message:' })
 for (const [key, value] of messages) {
 const { messageId } = value as { messageId: string }
 await this.processScheduledMessage(messageId)
 await this.storage.delete(key)
 }
 }
}
```

## ****

### 1. ****
```typescript
//
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

 // 100
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

//
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

### 2. ****
```typescript
// Worker
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

// CPU
function monitorCPUTime() {
 const start = performance.now()

 return () => {
 const duration = performance.now() - start
 if (duration > 100) { // 100ms
 console.warn(`Long running operation: ${duration.toFixed(2)}ms`)
 }
 return duration
 }
}
```

## ****

### ** (1-2)**
1. **** -
2. **KV ** -
3. **** -
4. **API ** -

### ** (1)**
1. **Durable Objects ** -
2. **R2 URL** - Worker
3. **** -
4. **WebSocket ** -

### ** (3)**
1. **CDN ** -
2. **** -
3. **AI ** -
4. **** -

## ****

| | | | |
|------|------|------|----------|
| API | ~200ms | <100ms | KV + |
| | ~2s | <1s | + CDN |
| | ~5MB/s | >10MB/s | URL + |
| | ~50MB | <30MB | + |
| | ~100 | >500 | + |

---

****