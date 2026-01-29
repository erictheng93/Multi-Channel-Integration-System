# API

****: 1.0.0
****: 2025-10-08
****:

---


- [](#)
 - [MessageIndexService](#messageindexservice)
 - [IndexedDBCacheService](#indexeddbcacheservice)
 - [SearchPerformanceMonitor](#searchperformancemonitor)
 - [SearchHistoryService](#searchhistoryservice)
- [](#)
 - [Search Highlight](#search-highlight)
 - [Search Pagination](#search-pagination)
 - [Debounce](#debounce)
- [](#)
- [](#)

---


### MessageIndexService

 Lunr.js


```typescript
import { messageIndexService } from '@/services/messageIndexService'
```


##### `buildIndex(messages: Message[]): void`


****:
- `messages` (Message[]):

****: `void`

****:
```typescript
const messages = [
 {
 id: 1,
 content: '',
 senderName: '',
 messageType: 'text',
 attachments: []
 },
 // ...
]

messageIndexService.buildIndex(messages)
console.log('')
```

****:
- 1,000 : ~10ms
- 10,000 : ~25ms

****:
-
-
-

---

##### `search(query: string): Message[]`


****:
- `query` (string):

****: `Message[]` -

****:
```typescript
const results = messageIndexService.search('')
console.log(` ${results.length} `)

//
results.forEach(msg => {
 console.log(` ${msg.id}: ${msg.content} (: ${msg.score})`)
})
```

****:
-
- TF-IDF
- (content: 3x, senderName: 2x)
-

****: <10ms

---

##### `advancedSearch(query: string): Message[]`


****:
- `query` (string):

****: `Message[]` -

****:
- `AND` -
- `OR` -
- `NOT` -
- `()` -
- `field:value` -
- `*` -

****:
```typescript
// AND
const andResults = messageIndexService.advancedSearch(' AND ')

// OR
const orResults = messageIndexService.advancedSearch(' OR ')

// NOT
const notResults = messageIndexService.advancedSearch(' NOT ')

//
const complexResults = messageIndexService.advancedSearch(
 '( OR ) AND '
)

//
const fieldResults = messageIndexService.advancedSearch('content:')

//
const wildcardResults = messageIndexService.advancedSearch('*')
```

****: <15ms

---

##### `fuzzySearch(query: string, fuzziness: number = 1): Message[]`


****:
- `query` (string):
- `fuzziness` (number): (0-2) 1

****: `Message[]` -

****:
```typescript
// 1 1
const results = messageIndexService.fuzzySearch('', 1)
// ""

// 2 2
const results2 = messageIndexService.fuzzySearch('ordr', 2)
// "order"
```

****: <20ms

****:
-
-
-

---

##### `addMessage(message: Message): void`


****:
- `message` (Message):

****: `void`

****:
```typescript
const newMessage = {
 id: 1001,
 content: '',
 senderName: '',
 messageType: 'text',
 attachments: []
}

messageIndexService.addMessage(newMessage)
console.log('')
```

****: <1ms

****:

---

##### `updateMessage(message: Message): void`


****:
- `message` (Message):

****: `void`

****:
```typescript
const updatedMessage = {
 id: 1001,
 content: '',
 senderName: '',
 messageType: 'text',
 attachments: []
}

messageIndexService.updateMessage(updatedMessage)
console.log('')
```

****: <2ms

****:

---

##### `removeMessage(messageId: number): void`


****:
- `messageId` (number): ID

****: `void`

****:
```typescript
messageIndexService.removeMessage(1001)
console.log('')
```

****: <1ms

---

##### `clearIndex(): void`


****:

****: `void`

****:
```typescript
messageIndexService.clearIndex()
console.log('')
```

****:
-
-
-

---

##### `getStats(): IndexStats`


****:

****: `IndexStats`

```typescript
interface IndexStats {
 isReady: boolean //
 messageCount: number //
 lastBuildTime: number //
}
```

****:
```typescript
const stats = messageIndexService.getStats()
console.log(':', {
 : stats.isReady,
 : stats.messageCount,
 : `${stats.lastBuildTime.toFixed(2)}ms`
})
```

---

##### `getSerializedIndex(): object`


****:

****: `object` - Lunr.js

****:
```typescript
const index = messageIndexService.getSerializedIndex()
const serialized = JSON.stringify(index)

// localStorage
localStorage.setItem('searchIndex', serialized)
```

---

##### `deserializeIndex(serializedIndex: object, documents: Record<string, unknown>): void`


****:
- `serializedIndex` (object):
- `documents` (Record<string, unknown>):

****: `void`

****:
```typescript
const serialized = localStorage.getItem('searchIndex')
const index = JSON.parse(serialized)
const documents = JSON.parse(localStorage.getItem('documents'))

messageIndexService.deserializeIndex(index, documents)
console.log('')
```

---

### IndexedDBCacheService

IndexedDB


```typescript
import { indexedDBCache } from '@/services/indexedDBCache'
```


##### `saveIndex(serializedIndex: string, documents: Record<string, unknown>, messageCount: number): Promise<void>`

 IndexedDB

****:
- `serializedIndex` (string): JSON
- `documents` (Record<string, unknown>):
- `messageCount` (number):

****: `Promise<void>`

****:
```typescript
const index = messageIndexService.getSerializedIndex()
const documents = messageIndexService.getDocuments()
const stats = messageIndexService.getStats()

await indexedDBCache.saveIndex(
 JSON.stringify(index),
 documents,
 stats.messageCount
)
console.log('')
```

****:
```typescript
try {
 await indexedDBCache.saveIndex(serialized, docs, count)
} catch (error) {
 if (error.name === 'QuotaExceededError') {
 console.error('')
 await indexedDBCache.clearCache()
 }
}
```

---

##### `loadIndex(): Promise<CachedIndex | null>`

 IndexedDB

****:

****: `Promise<CachedIndex | null>`

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

****:
```typescript
const cached = await indexedDBCache.loadIndex()

if (cached) {
 console.log(` ${cached.messageCount} `)

 messageIndexService.deserializeIndex(
 JSON.parse(cached.serializedIndex),
 cached.documents
 )
} else {
 console.log('')
 messageIndexService.buildIndex(messages)
}
```

---

##### `isCacheValid(): Promise<boolean>`


****:

****: `Promise<boolean>`

****:
-
- <7
-

****:
```typescript
const isValid = await indexedDBCache.isCacheValid()

if (isValid) {
 console.log('')
 const cached = await indexedDBCache.loadIndex()
 // ...
} else {
 console.log('')
 messageIndexService.buildIndex(messages)
}
```

---

##### `clearCache(): Promise<void>`


****:

****: `Promise<void>`

****:
```typescript
await indexedDBCache.clearCache()
console.log('')
```

---

##### `getStats(): Promise<CacheStats>`


****:

****: `Promise<CacheStats>`

```typescript
interface CacheStats {
 hasCache: boolean //
 messageCount: number //
 cacheAge: number //
 cacheSize: number //
 version: string //
}
```

****:
```typescript
const stats = await indexedDBCache.getStats()

console.log(':', {
 : stats.hasCache,
 : stats.messageCount,
 : `${Math.floor(stats.cacheAge / 1000)} `,
 : `${(stats.cacheSize / 1024).toFixed(2)} KB`,
 : stats.version
})
```

---

### SearchPerformanceMonitor


```typescript
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'
```


##### `recordSearch(metric: Omit<SearchMetric, 'timestamp'>): void`


****:
- `metric` (Omit<SearchMetric, 'timestamp'>):

```typescript
interface SearchMetric {
 query: string //
 searchType: 'basic' | 'advanced' | 'fuzzy' //
 resultCount: number //
 executionTime: number //
 timestamp: number //
}
```

****:
```typescript
const startTime = performance.now()
const results = messageIndexService.search('')
const executionTime = performance.now() - startTime

searchPerformanceMonitor.recordSearch({
 query: '',
 searchType: 'basic',
 resultCount: results.length,
 executionTime: executionTime
})
```

****:
- >50ms

---

##### `getStats(): PerformanceStats`


****:

****: `PerformanceStats`

```typescript
interface PerformanceStats {
 totalSearches: number //
 avgExecutionTime: number //
 minExecutionTime: number //
 maxExecutionTime: number //
 p50ExecutionTime: number // P50
 p95ExecutionTime: number // P95
 p99ExecutionTime: number // P99
 slowestQueries: Array<{ // 10
 query: string
 executionTime: number
 resultCount: number
 }>
 searchTypeDistribution: { //
 basic: number
 advanced: number
 fuzzy: number
 }
}
```

****:
```typescript
const stats = searchPerformanceMonitor.getStats()

console.log(':', {
 : stats.totalSearches,
 : `${stats.avgExecutionTime.toFixed(2)}ms`,
 P50: `${stats.p50ExecutionTime.toFixed(2)}ms`,
 P95: `${stats.p95ExecutionTime.toFixed(2)}ms`,
 P99: `${stats.p99ExecutionTime.toFixed(2)}ms`
})
```

---

##### `getSlowQueries(threshold: number = 50): SearchMetric[]`


****:
- `threshold` (number): 50

****: `SearchMetric[]`

****:
```typescript
const slowQueries = searchPerformanceMonitor.getSlowQueries(50)

console.log(` ${slowQueries.length} :`)
slowQueries.forEach(q => {
 console.log(` - "${q.query}": ${q.executionTime.toFixed(2)}ms`)
})
```

---

##### `getPerformanceReport(): string`


****:

****: `string` - Markdown

****:
```typescript
const report = searchPerformanceMonitor.getPerformanceReport()
console.log(report)

// :
// #
//
// ##
// - : 156
// - : 8.42ms
// ...
```

---

##### `clearMetrics(): void`


****:

****: `void`

****:
```typescript
searchPerformanceMonitor.clearMetrics()
console.log('')
```

---

##### `exportMetrics(): string`

 JSON

****:

****: `string` - JSON

****:
```typescript
const json = searchPerformanceMonitor.exportMetrics()
console.log('')

//
const blob = new Blob([json], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'search-performance.json'
a.click()
```

---

### SearchHistoryService


```typescript
import { searchHistoryService } from '@/services/searchHistoryService'
```


##### `addSearch(query: string, resultCount: number, searchType: 'basic' | 'advanced'): void`


****:
- `query` (string):
- `resultCount` (number):
- `searchType` ('basic' | 'advanced'):

****: `void`

****:
```typescript
searchHistoryService.addSearch('', 15, 'basic')
console.log('')
```

****:
-
- 50
- localStorage

---

##### `getRecentSearches(limit: number = 10): SearchHistory[]`


****:
- `limit` (number): 10

****: `SearchHistory[]`

```typescript
interface SearchHistory {
 query: string
 resultCount: number
 searchType: 'basic' | 'advanced'
 timestamp: number
 frequency: number
}
```

****:
```typescript
const recent = searchHistoryService.getRecentSearches(5)

console.log(' 5 :')
recent.forEach((h, i) => {
 console.log(` ${i + 1}. "${h.query}" - ${h.resultCount} `)
})
```

---

##### `getSuggestions(partialQuery: string, limit: number = 5): SearchHistory[]`


****:
- `partialQuery` (string):
- `limit` (number): 5

****: `SearchHistory[]`

****:
```typescript
// ""
const suggestions = searchHistoryService.getSuggestions('', 5)

console.log(':')
suggestions.forEach(s => {
 console.log(` - "${s.query}"`)
})

// :
// - ""
// - " AND "
// - " NOT "
```

---

##### `clearHistory(): void`


****:

****: `void`

****:
```typescript
searchHistoryService.clearHistory()
console.log('')
```

---


### Search Highlight


```typescript
import { highlightSearchTerms } from '@/utils/searchHighlight'
```

#### `highlightSearchTerms(text: string, searchTerms: string[]): string`


****:
- `text` (string):
- `searchTerms` (string[]):

****: `string` - `<mark>` HTML

****:
```typescript
const text = ''
const terms = ['', '']

const highlighted = highlightSearchTerms(text, terms)
console.log(highlighted)

// :
// <mark class="search-highlight"></mark><mark class="search-highlight"></mark>
```

** Vue **:
```vue
<template>
 <div v-html="highlightedText"></div>
</template>

<script setup>
import { computed } from 'vue'
import { highlightSearchTerms } from '@/utils/searchHighlight'

const message = ref('')
const searchQuery = ref(' ')

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


```typescript
import {
 paginateResults,
 getPage,
 generatePageNumbers
} from '@/utils/searchPagination'
```

#### `paginateResults<T>(results: T[], config?: PaginationConfig): PaginatedResults<T>`


****:
- `results` (T[]):
- `config` (PaginationConfig):

```typescript
interface PaginationConfig {
 pageSize?: number // 20
 currentPage?: number // 1
 totalResults?: number // results.length
}
```

****: `PaginatedResults<T>`

```typescript
interface PaginatedResults<T> {
 data: T[] //
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

****:
```typescript
const results = messageIndexService.search('')
const paginated = paginateResults(results, {
 pageSize: 20,
 currentPage: 1
})

console.log(':', paginated.pagination)
console.log(':', paginated.data.length)
```

---

#### `getPage<T>(results: T[], pageNumber: number, pageSize: number): PaginatedResults<T>`


****:
- `results` (T[]):
- `pageNumber` (number): 1
- `pageSize` (number):

****: `PaginatedResults<T>`

****:
```typescript
const page1 = getPage(results, 1, 20)
const page2 = getPage(results, 2, 20)
```

---

### Debounce


```typescript
import {
 debounce,
 throttle,
 createDebouncedFunction
} from '@/utils/debounce'
```

#### `debounce<T>(fn: T, delay: number, immediate?: boolean): (...args: Parameters<T>) => void`


****:
- `fn` (T):
- `delay` (number):
- `immediate` (boolean): false

****:

****:
```typescript
const search = (query: string) => {
 console.log(':', query)
 const results = messageIndexService.search(query)
 return results
}

const debouncedSearch = debounce(search, 300)

//
debouncedSearch('')
debouncedSearch('')
debouncedSearch('')

// 300ms
```

---

#### `createDebouncedFunction<T>(fn: T, delay: number): { debounced, cancel, flush }`


****:
- `fn` (T):
- `delay` (number):

****: `debounced`, `cancel`, `flush`

****:
```typescript
const { debounced, cancel, flush } = createDebouncedFunction(search, 300)

//
debounced('')

//
cancel()

//
flush()
```

** Vue **:
```vue
<script setup>
import { onUnmounted } from 'vue'
import { createDebouncedFunction } from '@/utils/debounce'

const performSearch = () => {
 //
}

const debouncedSearch = createDebouncedFunction(performSearch, 300)

const handleInput = () => {
 debouncedSearch.debounced()
}

//
onUnmounted(() => {
 debouncedSearch.cancel()
})
</script>
```

---


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


### IndexedDB

```typescript
try {
 await indexedDBCache.saveIndex(serialized, docs, count)
} catch (error) {
 if (error.name === 'QuotaExceededError') {
 console.error('')
 await indexedDBCache.clearCache()
 } else if (error.name === 'InvalidStateError') {
 console.error('IndexedDB ')
 //
 } else {
 console.error('IndexedDB :', error)
 }
}
```


```typescript
try {
 const results = messageIndexService.search(query)
} catch (error) {
 console.error(':', error)
 //
 return []
}
```


```typescript
try {
 messageIndexService.buildIndex(messages)
} catch (error) {
 console.error(':', error)
 //
 messageIndexService.clearIndex()
 messageIndexService.buildIndex(messages)
}
```

---


### 1.

```typescript
// :
onMounted(async () => {
 //
 const cached = await indexedDBCache.loadIndex()

 if (cached && await indexedDBCache.isCacheValid()) {
 messageIndexService.deserializeIndex(
 JSON.parse(cached.serializedIndex),
 cached.documents
 )
 } else {
 //
 messageIndexService.buildIndex(messages.value)

 //
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

### 2.

```typescript
// : +
const performSearch = () => {
 if (!searchQuery.value.trim()) {
 searchResults.value = []
 return
 }

 const startTime = performance.now()
 const results = messageIndexService.search(searchQuery.value)
 const executionTime = performance.now() - startTime

 searchResults.value = results

 //
 searchPerformanceMonitor.recordSearch({
 query: searchQuery.value,
 searchType: 'basic',
 resultCount: results.length,
 executionTime
 })

 //
 searchHistoryService.addSearch(
 searchQuery.value,
 results.length,
 'basic'
 )
}

const debouncedSearch = createDebouncedFunction(performSearch, 300)
```

### 3.

```typescript
// :
watch(() => messages.value, (newMessages, oldMessages) => {
 if (newMessages.length > oldMessages.length) {
 //
 const newMsg = newMessages[newMessages.length - 1]
 messageIndexService.addMessage(newMsg)
 }
})
```

---


| | | |
|------|----------|----------|
| (1k) | <10ms | ~8ms |
| (10k) | <25ms | ~20ms |
| | <10ms | ~6ms |
| | <15ms | ~12ms |
| | <20ms | ~14ms |
| | <5ms | ~4ms |
| | <2ms | ~1ms |


| | | |
|--------|----------|----------|
| 1k | ~50KB | ~2MB |
| 10k | ~500KB | ~15MB |
| 100k | ~5MB | ~120MB |

---


| | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| | 120+ | 120+ | 17+ | 120+ |
| IndexedDB | 120+ | 120+ | 17+ | 120+ |
| Web Worker | 120+ | 120+ | 17+ | 120+ |
| localStorage | 120+ | 120+ | 17+ | 120+ |

****: IndexedDB

---


- : `MESSAGE_SEARCH_USER_GUIDE.md`
- : `MESSAGE_SEARCH_EXAMPLES.md`
- : `MESSAGE_SEARCH_TEST_REPORT.md`
- : `MESSAGE_SEARCH_DEPLOYMENT_GUIDE.md`

---

****: 1.0.0
****: 2025-10-08
****:
