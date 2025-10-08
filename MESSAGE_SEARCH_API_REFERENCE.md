# 消息搜索 API 參考文檔

**版本**: 1.0.0
**最後更新**: 2025-10-08
**目標讀者**: 前端開發者、系統集成工程師

---

## 📚 目錄

- [核心服務](#核心服務)
  - [MessageIndexService](#messageindexservice)
  - [IndexedDBCacheService](#indexeddbcacheservice)
  - [SearchPerformanceMonitor](#searchperformancemonitor)
  - [SearchHistoryService](#searchhistoryservice)
- [工具函數](#工具函數)
  - [Search Highlight](#search-highlight)
  - [Search Pagination](#search-pagination)
  - [Debounce](#debounce)
- [類型定義](#類型定義)
- [錯誤處理](#錯誤處理)

---

## 核心服務

### MessageIndexService

全文搜索索引服務，基於 Lunr.js 實現。

#### 導入

```typescript
import { messageIndexService } from '@/services/messageIndexService'
```

#### 方法

##### `buildIndex(messages: Message[]): void`

構建搜索索引。

**參數**:
- `messages` (Message[]): 消息數組

**返回**: `void`

**示例**:
```typescript
const messages = [
  {
    id: 1,
    content: '您的訂單已發貨',
    senderName: '客服小王',
    messageType: 'text',
    attachments: []
  },
  // ... 更多消息
]

messageIndexService.buildIndex(messages)
console.log('索引構建完成')
```

**性能**:
- 1,000 條消息: ~10ms
- 10,000 條消息: ~25ms

**注意事項**:
- 會清除現有索引
- 阻塞主線程執行
- 建議在組件初始化時調用

---

##### `search(query: string): Message[]`

執行基礎搜索。

**參數**:
- `query` (string): 搜索關鍵詞

**返回**: `Message[]` - 匹配的消息數組，按相關性排序

**示例**:
```typescript
const results = messageIndexService.search('訂單')
console.log(`找到 ${results.length} 條結果`)

// 每個結果包含原始消息和相關性評分
results.forEach(msg => {
  console.log(`消息 ${msg.id}: ${msg.content} (評分: ${msg.score})`)
})
```

**搜索特性**:
- 分詞搜索
- TF-IDF 相關性排序
- 字段加權 (content: 3x, senderName: 2x)
- 自動去除停用詞

**性能**: <10ms

---

##### `advancedSearch(query: string): Message[]`

執行高級搜索（支持布爾運算符和字段搜索）。

**參數**:
- `query` (string): 高級搜索語法

**返回**: `Message[]` - 匹配的消息數組

**支持的語法**:
- `AND` - 並且運算符
- `OR` - 或運算符
- `NOT` - 排除運算符
- `()` - 分組
- `field:value` - 字段搜索
- `*` - 通配符

**示例**:
```typescript
// AND 運算符
const andResults = messageIndexService.advancedSearch('訂單 AND 完成')

// OR 運算符
const orResults = messageIndexService.advancedSearch('退款 OR 取消')

// NOT 運算符
const notResults = messageIndexService.advancedSearch('問題 NOT 解決')

// 組合運算符
const complexResults = messageIndexService.advancedSearch(
  '(訂單 OR 產品) AND 完成'
)

// 字段搜索
const fieldResults = messageIndexService.advancedSearch('content:訂單')

// 通配符搜索
const wildcardResults = messageIndexService.advancedSearch('產品*')
```

**性能**: <15ms

---

##### `fuzzySearch(query: string, fuzziness: number = 1): Message[]`

執行模糊搜索（容錯搜索）。

**參數**:
- `query` (string): 搜索關鍵詞
- `fuzziness` (number): 模糊度 (0-2)，默認 1

**返回**: `Message[]` - 匹配的消息數組

**示例**:
```typescript
// 容錯度為 1（允許 1 個字符差異）
const results = messageIndexService.fuzzySearch('訂単', 1)
// 會匹配 "訂單"

// 容錯度為 2（允許 2 個字符差異）
const results2 = messageIndexService.fuzzySearch('ordr', 2)
// 會匹配 "order"
```

**性能**: <20ms

**使用場景**:
- 拼寫錯誤
- 輸入法錯誤
- 模糊匹配

---

##### `addMessage(message: Message): void`

增量添加新消息到索引。

**參數**:
- `message` (Message): 要添加的消息

**返回**: `void`

**示例**:
```typescript
const newMessage = {
  id: 1001,
  content: '新訂單已創建',
  senderName: '系統',
  messageType: 'text',
  attachments: []
}

messageIndexService.addMessage(newMessage)
console.log('消息已添加到索引')
```

**性能**: <1ms

**優勢**: 無需重建整個索引

---

##### `updateMessage(message: Message): void`

更新索引中的現有消息。

**參數**:
- `message` (Message): 更新後的消息

**返回**: `void`

**示例**:
```typescript
const updatedMessage = {
  id: 1001,
  content: '訂單已確認',
  senderName: '系統',
  messageType: 'text',
  attachments: []
}

messageIndexService.updateMessage(updatedMessage)
console.log('消息已更新')
```

**性能**: <2ms

**內部實現**: 先移除舊消息，再添加新消息

---

##### `removeMessage(messageId: number): void`

從索引中移除消息。

**參數**:
- `messageId` (number): 消息 ID

**返回**: `void`

**示例**:
```typescript
messageIndexService.removeMessage(1001)
console.log('消息已從索引移除')
```

**性能**: <1ms

---

##### `clearIndex(): void`

清除整個索引。

**參數**: 無

**返回**: `void`

**示例**:
```typescript
messageIndexService.clearIndex()
console.log('索引已清除')
```

**使用場景**:
- 重置搜索
- 切換會話
- 調試

---

##### `getStats(): IndexStats`

獲取索引統計信息。

**參數**: 無

**返回**: `IndexStats`

```typescript
interface IndexStats {
  isReady: boolean      // 索引是否就緒
  messageCount: number  // 索引中的消息數量
  lastBuildTime: number // 上次構建耗時（毫秒）
}
```

**示例**:
```typescript
const stats = messageIndexService.getStats()
console.log('索引狀態:', {
  就緒: stats.isReady,
  消息數: stats.messageCount,
  構建耗時: `${stats.lastBuildTime.toFixed(2)}ms`
})
```

---

##### `getSerializedIndex(): object`

獲取序列化的索引對象（用於緩存）。

**參數**: 無

**返回**: `object` - Lunr.js 索引對象

**示例**:
```typescript
const index = messageIndexService.getSerializedIndex()
const serialized = JSON.stringify(index)

// 保存到 localStorage
localStorage.setItem('searchIndex', serialized)
```

---

##### `deserializeIndex(serializedIndex: object, documents: Record<string, unknown>): void`

從序列化數據恢復索引。

**參數**:
- `serializedIndex` (object): 序列化的索引
- `documents` (Record<string, unknown>): 文檔映射

**返回**: `void`

**示例**:
```typescript
const serialized = localStorage.getItem('searchIndex')
const index = JSON.parse(serialized)
const documents = JSON.parse(localStorage.getItem('documents'))

messageIndexService.deserializeIndex(index, documents)
console.log('索引已恢復')
```

---

### IndexedDBCacheService

IndexedDB 持久化緩存服務。

#### 導入

```typescript
import { indexedDBCache } from '@/services/indexedDBCache'
```

#### 方法

##### `saveIndex(serializedIndex: string, documents: Record<string, unknown>, messageCount: number): Promise<void>`

保存索引到 IndexedDB。

**參數**:
- `serializedIndex` (string): 序列化的索引 JSON 字符串
- `documents` (Record<string, unknown>): 文檔映射
- `messageCount` (number): 消息數量

**返回**: `Promise<void>`

**示例**:
```typescript
const index = messageIndexService.getSerializedIndex()
const documents = messageIndexService.getDocuments()
const stats = messageIndexService.getStats()

await indexedDBCache.saveIndex(
  JSON.stringify(index),
  documents,
  stats.messageCount
)
console.log('索引已保存到緩存')
```

**錯誤處理**:
```typescript
try {
  await indexedDBCache.saveIndex(serialized, docs, count)
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    console.error('存儲空間不足')
    await indexedDBCache.clearCache()
  }
}
```

---

##### `loadIndex(): Promise<CachedIndex | null>`

從 IndexedDB 加載索引。

**參數**: 無

**返回**: `Promise<CachedIndex | null>`

```typescript
interface CachedIndex {
  id: string
  serializedIndex: string
  documents: Record<string, unknown>
  messageCount: number
  timestamp: number
  version: string
}
```

**示例**:
```typescript
const cached = await indexedDBCache.loadIndex()

if (cached) {
  console.log(`從緩存加載了 ${cached.messageCount} 條消息的索引`)

  messageIndexService.deserializeIndex(
    JSON.parse(cached.serializedIndex),
    cached.documents
  )
} else {
  console.log('緩存未命中，需要重建索引')
  messageIndexService.buildIndex(messages)
}
```

---

##### `isCacheValid(): Promise<boolean>`

檢查緩存是否有效。

**參數**: 無

**返回**: `Promise<boolean>`

**驗證規則**:
- 緩存存在
- 未過期（<7 天）
- 版本匹配

**示例**:
```typescript
const isValid = await indexedDBCache.isCacheValid()

if (isValid) {
  console.log('緩存有效，可以使用')
  const cached = await indexedDBCache.loadIndex()
  // ... 使用緩存
} else {
  console.log('緩存無效，需要重建')
  messageIndexService.buildIndex(messages)
}
```

---

##### `clearCache(): Promise<void>`

清除所有緩存。

**參數**: 無

**返回**: `Promise<void>`

**示例**:
```typescript
await indexedDBCache.clearCache()
console.log('緩存已清除')
```

---

##### `getStats(): Promise<CacheStats>`

獲取緩存統計信息。

**參數**: 無

**返回**: `Promise<CacheStats>`

```typescript
interface CacheStats {
  hasCache: boolean       // 是否有緩存
  messageCount: number    // 緩存的消息數量
  cacheAge: number        // 緩存年齡（毫秒）
  cacheSize: number       // 緩存大小（字節）
  version: string         // 緩存版本
}
```

**示例**:
```typescript
const stats = await indexedDBCache.getStats()

console.log('緩存統計:', {
  有緩存: stats.hasCache,
  消息數: stats.messageCount,
  年齡: `${Math.floor(stats.cacheAge / 1000)} 秒`,
  大小: `${(stats.cacheSize / 1024).toFixed(2)} KB`,
  版本: stats.version
})
```

---

### SearchPerformanceMonitor

搜索性能監控服務。

#### 導入

```typescript
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'
```

#### 方法

##### `recordSearch(metric: Omit<SearchMetric, 'timestamp'>): void`

記錄搜索性能指標。

**參數**:
- `metric` (Omit<SearchMetric, 'timestamp'>): 搜索指標（不含時間戳）

```typescript
interface SearchMetric {
  query: string                              // 搜索詞
  searchType: 'basic' | 'advanced' | 'fuzzy' // 搜索類型
  resultCount: number                        // 結果數量
  executionTime: number                      // 執行時間（毫秒）
  timestamp: number                          // 時間戳（自動添加）
}
```

**示例**:
```typescript
const startTime = performance.now()
const results = messageIndexService.search('訂單')
const executionTime = performance.now() - startTime

searchPerformanceMonitor.recordSearch({
  query: '訂單',
  searchType: 'basic',
  resultCount: results.length,
  executionTime: executionTime
})
```

**慢查詢檢測**:
- 執行時間 >50ms 會自動警告

---

##### `getStats(): PerformanceStats`

獲取性能統計信息。

**參數**: 無

**返回**: `PerformanceStats`

```typescript
interface PerformanceStats {
  totalSearches: number          // 總搜索次數
  avgExecutionTime: number       // 平均執行時間
  minExecutionTime: number       // 最小執行時間
  maxExecutionTime: number       // 最大執行時間
  p50ExecutionTime: number       // P50 百分位數
  p95ExecutionTime: number       // P95 百分位數
  p99ExecutionTime: number       // P99 百分位數
  slowestQueries: Array<{        // 最慢的 10 個查詢
    query: string
    executionTime: number
    resultCount: number
  }>
  searchTypeDistribution: {      // 搜索類型分佈
    basic: number
    advanced: number
    fuzzy: number
  }
}
```

**示例**:
```typescript
const stats = searchPerformanceMonitor.getStats()

console.log('性能統計:', {
  總搜索: stats.totalSearches,
  平均: `${stats.avgExecutionTime.toFixed(2)}ms`,
  P50: `${stats.p50ExecutionTime.toFixed(2)}ms`,
  P95: `${stats.p95ExecutionTime.toFixed(2)}ms`,
  P99: `${stats.p99ExecutionTime.toFixed(2)}ms`
})
```

---

##### `getSlowQueries(threshold: number = 50): SearchMetric[]`

獲取慢查詢列表。

**參數**:
- `threshold` (number): 慢查詢閾值（毫秒），默認 50

**返回**: `SearchMetric[]`

**示例**:
```typescript
const slowQueries = searchPerformanceMonitor.getSlowQueries(50)

console.log(`檢測到 ${slowQueries.length} 個慢查詢:`)
slowQueries.forEach(q => {
  console.log(`  - "${q.query}": ${q.executionTime.toFixed(2)}ms`)
})
```

---

##### `getPerformanceReport(): string`

獲取格式化的性能報告。

**參數**: 無

**返回**: `string` - Markdown 格式的報告

**示例**:
```typescript
const report = searchPerformanceMonitor.getPerformanceReport()
console.log(report)

// 輸出示例:
// # 搜索性能報告
//
// ## 總體統計
// - 總搜索次數: 156
// - 平均執行時間: 8.42ms
// ...
```

---

##### `clearMetrics(): void`

清除所有性能指標。

**參數**: 無

**返回**: `void`

**示例**:
```typescript
searchPerformanceMonitor.clearMetrics()
console.log('性能指標已清除')
```

---

##### `exportMetrics(): string`

導出性能指標為 JSON。

**參數**: 無

**返回**: `string` - JSON 字符串

**示例**:
```typescript
const json = searchPerformanceMonitor.exportMetrics()
console.log('性能指標已導出')

// 保存到文件
const blob = new Blob([json], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'search-performance.json'
a.click()
```

---

### SearchHistoryService

搜索歷史管理服務。

#### 導入

```typescript
import { searchHistoryService } from '@/services/searchHistoryService'
```

#### 方法

##### `addSearch(query: string, resultCount: number, searchType: 'basic' | 'advanced'): void`

添加搜索記錄到歷史。

**參數**:
- `query` (string): 搜索詞
- `resultCount` (number): 結果數量
- `searchType` ('basic' | 'advanced'): 搜索類型

**返回**: `void`

**示例**:
```typescript
searchHistoryService.addSearch('訂單', 15, 'basic')
console.log('搜索已添加到歷史')
```

**行為**:
- 自動去重（相同搜索詞會更新時間戳）
- 限制 50 條（超過會刪除最舊的）
- 保存到 localStorage

---

##### `getRecentSearches(limit: number = 10): SearchHistory[]`

獲取最近的搜索記錄。

**參數**:
- `limit` (number): 返回數量，默認 10

**返回**: `SearchHistory[]`

```typescript
interface SearchHistory {
  query: string
  resultCount: number
  searchType: 'basic' | 'advanced'
  timestamp: number
  frequency: number
}
```

**示例**:
```typescript
const recent = searchHistoryService.getRecentSearches(5)

console.log('最近 5 次搜索:')
recent.forEach((h, i) => {
  console.log(`  ${i + 1}. "${h.query}" - ${h.resultCount} 條結果`)
})
```

---

##### `getSuggestions(partialQuery: string, limit: number = 5): SearchHistory[]`

根據部分輸入獲取搜索建議。

**參數**:
- `partialQuery` (string): 部分搜索詞
- `limit` (number): 返回數量，默認 5

**返回**: `SearchHistory[]`

**示例**:
```typescript
// 用戶輸入 "訂"
const suggestions = searchHistoryService.getSuggestions('訂', 5)

console.log('搜索建議:')
suggestions.forEach(s => {
  console.log(`  - "${s.query}"`)
})

// 可能輸出:
// - "訂單"
// - "訂單 AND 完成"
// - "訂單 NOT 取消"
```

---

##### `clearHistory(): void`

清除所有搜索歷史。

**參數**: 無

**返回**: `void`

**示例**:
```typescript
searchHistoryService.clearHistory()
console.log('搜索歷史已清除')
```

---

## 工具函數

### Search Highlight

搜索結果高亮工具。

#### 導入

```typescript
import { highlightSearchTerms } from '@/utils/searchHighlight'
```

#### `highlightSearchTerms(text: string, searchTerms: string[]): string`

在文本中高亮搜索詞。

**參數**:
- `text` (string): 原始文本
- `searchTerms` (string[]): 搜索詞數組

**返回**: `string` - 包含 `<mark>` 標籤的 HTML 字符串

**示例**:
```typescript
const text = '您的訂單已發貨'
const terms = ['訂單', '發貨']

const highlighted = highlightSearchTerms(text, terms)
console.log(highlighted)

// 輸出:
// 您的<mark class="search-highlight">訂單</mark>已<mark class="search-highlight">發貨</mark>
```

**在 Vue 中使用**:
```vue
<template>
  <div v-html="highlightedText"></div>
</template>

<script setup>
import { computed } from 'vue'
import { highlightSearchTerms } from '@/utils/searchHighlight'

const message = ref('您的訂單已發貨')
const searchQuery = ref('訂單 發貨')

const highlightedText = computed(() => {
  const terms = searchQuery.value.split(/\s+/).filter(t => t)
  return highlightSearchTerms(message.value, terms)
})
</script>

<style>
.search-highlight {
  background-color: yellow;
  font-weight: bold;
}
</style>
```

---

### Search Pagination

搜索結果分頁工具。

#### 導入

```typescript
import {
  paginateResults,
  getPage,
  generatePageNumbers
} from '@/utils/searchPagination'
```

#### `paginateResults<T>(results: T[], config?: PaginationConfig): PaginatedResults<T>`

對結果進行分頁。

**參數**:
- `results` (T[]): 結果數組
- `config` (PaginationConfig): 分頁配置（可選）

```typescript
interface PaginationConfig {
  pageSize?: number      // 每頁數量，默認 20
  currentPage?: number   // 當前頁碼，默認 1
  totalResults?: number  // 總結果數，默認 results.length
}
```

**返回**: `PaginatedResults<T>`

```typescript
interface PaginatedResults<T> {
  data: T[]              // 當前頁數據
  pagination: {
    currentPage: number
    pageSize: number
    totalResults: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
    startIndex: number
    endIndex: number
  }
}
```

**示例**:
```typescript
const results = messageIndexService.search('訂單')
const paginated = paginateResults(results, {
  pageSize: 20,
  currentPage: 1
})

console.log('分頁信息:', paginated.pagination)
console.log('當前頁數據:', paginated.data.length)
```

---

#### `getPage<T>(results: T[], pageNumber: number, pageSize: number): PaginatedResults<T>`

獲取指定頁的數據。

**參數**:
- `results` (T[]): 結果數組
- `pageNumber` (number): 頁碼（從 1 開始）
- `pageSize` (number): 每頁數量

**返回**: `PaginatedResults<T>`

**示例**:
```typescript
const page1 = getPage(results, 1, 20)
const page2 = getPage(results, 2, 20)
```

---

### Debounce

防抖和節流工具。

#### 導入

```typescript
import {
  debounce,
  throttle,
  createDebouncedFunction
} from '@/utils/debounce'
```

#### `debounce<T>(fn: T, delay: number, immediate?: boolean): (...args: Parameters<T>) => void`

創建防抖函數。

**參數**:
- `fn` (T): 原始函數
- `delay` (number): 延遲時間（毫秒）
- `immediate` (boolean): 是否立即執行，默認 false

**返回**: 防抖後的函數

**示例**:
```typescript
const search = (query: string) => {
  console.log('搜索:', query)
  const results = messageIndexService.search(query)
  return results
}

const debouncedSearch = debounce(search, 300)

// 快速調用多次
debouncedSearch('訂')
debouncedSearch('訂單')
debouncedSearch('訂單查詢')

// 僅最後一次會執行（300ms 後）
```

---

#### `createDebouncedFunction<T>(fn: T, delay: number): { debounced, cancel, flush }`

創建可控制的防抖函數。

**參數**:
- `fn` (T): 原始函數
- `delay` (number): 延遲時間（毫秒）

**返回**: 包含 `debounced`, `cancel`, `flush` 的對象

**示例**:
```typescript
const { debounced, cancel, flush } = createDebouncedFunction(search, 300)

// 調用防抖函數
debounced('訂單')

// 取消待執行的調用
cancel()

// 立即執行待執行的調用
flush()
```

**在 Vue 中使用**:
```vue
<script setup>
import { onUnmounted } from 'vue'
import { createDebouncedFunction } from '@/utils/debounce'

const performSearch = () => {
  // 搜索邏輯
}

const debouncedSearch = createDebouncedFunction(performSearch, 300)

const handleInput = () => {
  debouncedSearch.debounced()
}

// 組件卸載時取消
onUnmounted(() => {
  debouncedSearch.cancel()
})
</script>
```

---

## 類型定義

### Message

```typescript
interface Message {
  id: number
  content: string
  senderName: string
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video'
  attachments?: Array<{
    name: string
    url: string
    type: string
  }>
  createdAt: string
  [key: string]: any
}
```

### IndexDocument

```typescript
interface IndexDocument {
  id: string
  content: string
  senderName: string
  attachments: string
  messageType: string
}
```

### SearchMetric

```typescript
interface SearchMetric {
  query: string
  searchType: 'basic' | 'advanced' | 'fuzzy'
  resultCount: number
  executionTime: number
  timestamp: number
}
```

### SearchHistory

```typescript
interface SearchHistory {
  query: string
  resultCount: number
  searchType: 'basic' | 'advanced'
  timestamp: number
  frequency: number
}
```

### CachedIndex

```typescript
interface CachedIndex {
  id: string
  serializedIndex: string
  documents: Record<string, unknown>
  messageCount: number
  timestamp: number
  version: string
}
```

---

## 錯誤處理

### IndexedDB 錯誤

```typescript
try {
  await indexedDBCache.saveIndex(serialized, docs, count)
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    console.error('存儲空間不足')
    await indexedDBCache.clearCache()
  } else if (error.name === 'InvalidStateError') {
    console.error('IndexedDB 不可用（可能是私密模式）')
    // 降級到內存緩存
  } else {
    console.error('IndexedDB 錯誤:', error)
  }
}
```

### 搜索錯誤

```typescript
try {
  const results = messageIndexService.search(query)
} catch (error) {
  console.error('搜索失敗:', error)
  // 返回空結果
  return []
}
```

### 索引構建錯誤

```typescript
try {
  messageIndexService.buildIndex(messages)
} catch (error) {
  console.error('索引構建失敗:', error)
  // 清除並重試
  messageIndexService.clearIndex()
  messageIndexService.buildIndex(messages)
}
```

---

## 最佳實踐

### 1. 索引構建

```typescript
// ✅ 推薦: 在組件初始化時構建
onMounted(async () => {
  // 先嘗試從緩存加載
  const cached = await indexedDBCache.loadIndex()

  if (cached && await indexedDBCache.isCacheValid()) {
    messageIndexService.deserializeIndex(
      JSON.parse(cached.serializedIndex),
      cached.documents
    )
  } else {
    // 緩存未命中，重建索引
    messageIndexService.buildIndex(messages.value)

    // 保存到緩存
    const index = messageIndexService.getSerializedIndex()
    const docs = messageIndexService.getDocuments()
    await indexedDBCache.saveIndex(
      JSON.stringify(index),
      docs,
      messages.value.length
    )
  }
})
```

### 2. 搜索執行

```typescript
// ✅ 推薦: 使用防抖 + 性能監控
const performSearch = () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  const startTime = performance.now()
  const results = messageIndexService.search(searchQuery.value)
  const executionTime = performance.now() - startTime

  searchResults.value = results

  // 記錄性能
  searchPerformanceMonitor.recordSearch({
    query: searchQuery.value,
    searchType: 'basic',
    resultCount: results.length,
    executionTime
  })

  // 記錄歷史
  searchHistoryService.addSearch(
    searchQuery.value,
    results.length,
    'basic'
  )
}

const debouncedSearch = createDebouncedFunction(performSearch, 300)
```

### 3. 增量更新

```typescript
// ✅ 推薦: 新消息到達時增量更新
watch(() => messages.value, (newMessages, oldMessages) => {
  if (newMessages.length > oldMessages.length) {
    // 添加新消息
    const newMsg = newMessages[newMessages.length - 1]
    messageIndexService.addMessage(newMsg)
  }
})
```

---

## 性能指標

### 目標性能

| 操作 | 目標時間 | 實際時間 |
|------|----------|----------|
| 索引構建 (1k) | <10ms | ~8ms |
| 索引構建 (10k) | <25ms | ~20ms |
| 基礎搜索 | <10ms | ~6ms |
| 高級搜索 | <15ms | ~12ms |
| 模糊搜索 | <20ms | ~14ms |
| 緩存加載 | <5ms | ~4ms |
| 增量更新 | <2ms | ~1ms |

### 內存使用

| 數據量 | 索引大小 | 內存占用 |
|--------|----------|----------|
| 1k 消息 | ~50KB | ~2MB |
| 10k 消息 | ~500KB | ~15MB |
| 100k 消息 | ~5MB | ~120MB |

---

## 瀏覽器兼容性

| 功能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| 基礎搜索 | ✅ 120+ | ✅ 120+ | ✅ 17+ | ✅ 120+ |
| IndexedDB | ✅ 120+ | ✅ 120+ | ✅ 17+ | ✅ 120+ |
| Web Worker | ✅ 120+ | ✅ 120+ | ✅ 17+ | ✅ 120+ |
| localStorage | ✅ 120+ | ✅ 120+ | ✅ 17+ | ✅ 120+ |

**私密模式**: IndexedDB 自動降級為內存緩存

---

## 相關文檔

- 用戶指南: `MESSAGE_SEARCH_USER_GUIDE.md`
- 實用示例: `MESSAGE_SEARCH_EXAMPLES.md`
- 測試報告: `MESSAGE_SEARCH_TEST_REPORT.md`
- 部署指南: `MESSAGE_SEARCH_DEPLOYMENT_GUIDE.md`

---

**版本**: 1.0.0
**最後更新**: 2025-10-08
**維護者**: 技術團隊
