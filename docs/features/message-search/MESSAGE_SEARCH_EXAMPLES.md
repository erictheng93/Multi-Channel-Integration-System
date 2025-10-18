
****: 1.0.0
****: 2025-10-08
****:

---


- [UI ](#ui-)
- [](#)
- [](#)
- [](#)
- [](#)

---

## UI

### 1: -

****:

****:
1.
2. ``
3. 0.3 Enter
4.

****:
```
 15 :
 ""
 "ORD123456"
 ""
 ... ( 15 )
```

**UI **:
```

 [________________] [STD] [X]


: 15
""
```

---

### 2: - AND

****: """"

****:
1. **ADV**
2. ` AND `
3. Enter

****:
```
 5 :
 ""
 ""
 " #123 "
 ... ( 5 )

:
 "" ("")
 "" ("")
```

**UI **:
```

 [ AND _______] [ADV] [X]


: 5
"" ""
```

---

### 3: -

****: ""

****:
1. **ADV**
2. `senderName:`
3. Enter

****:
```
 32 "":
 : ""
 : ""
 : ""
 ... ( 32 )

:
 : "" ()
```

---

### 4: -

****:

****:
1. **ADV**
2. `( OR ) AND senderName: NOT `
3. Enter

****:
```
 8 :
 : "..."
 : "..."
 ... ( 8 )

:
 : "" ("")
 : "" ()
```

---

### 5: -

****:

****:
1.
2.
3.
4.

****:
```
:
 1. " AND " - 5 - 2
 2. "senderName:" - 32 - 5
 3. "" - 18 - 10
 4. "content:" - 42 - 15
 5. "*" - 27 - 30

 =
```

---


### 1: API

****:

```javascript
//
import { messageIndexService } from '@/services/messageIndexService'

//
const results = messageIndexService.search('')

console.log(` ${results.length} `)
console.log(results)

// :
// 15
// [
// { id: 1, content: '', score: 0.95, ... },
// { id: 2, content: 'ORD123456', score: 0.87, ... },
// ...
// ]
```

---

### 2: API

****:

```javascript
import { messageIndexService } from '@/services/messageIndexService'

// AND
const andResults = messageIndexService.advancedSearch(' AND ')
console.log('AND :', andResults.length)

// OR
const orResults = messageIndexService.advancedSearch(' OR ')
console.log('OR :', orResults.length)

// NOT
const notResults = messageIndexService.advancedSearch(' NOT ')
console.log('NOT :', notResults.length)

//
const complexResults = messageIndexService.advancedSearch(
 '( OR ) AND NOT '
)
console.log(':', complexResults.length)
```

---

### 3:

****:

```javascript
import { messageIndexService } from '@/services/messageIndexService'

//
const messages = [
 {
 id: 1,
 content: '',
 senderName: '',
 messageType: 'text',
 attachments: []
 },
 {
 id: 2,
 content: 'ORD123456',
 senderName: '',
 messageType: 'text',
 attachments: []
 },
 // ...
]

//
const startTime = performance.now()
messageIndexService.buildIndex(messages)
const buildTime = performance.now() - startTime

console.log(` ${buildTime.toFixed(2)}ms`)
console.log(':', messageIndexService.getStats())

// :
// 18.34ms
// : {
// isReady: true,
// messageCount: 1000,
// lastBuildTime: 18.34
// }
```

---

### 4:

****:

```javascript
import { messageIndexService } from '@/services/messageIndexService'

//
const newMessage = {
 id: 1001,
 content: '',
 senderName: '',
 messageType: 'text',
 attachments: []
}

messageIndexService.addMessage(newMessage)
console.log('')

//
const updatedMessage = {
 id: 1001,
 content: '',
 senderName: '',
 messageType: 'text',
 attachments: []
}

messageIndexService.updateMessage(updatedMessage)
console.log('')

//
messageIndexService.removeMessage(1001)
console.log('')

//
const stats = messageIndexService.getStats()
console.log(':', stats.messageCount)
```

---

### 5:

****: IndexedDB

```javascript
import { indexedDBCache } from '@/services/indexedDBCache'
import { messageIndexService } from '@/services/messageIndexService'

//
const stats = await indexedDBCache.getStats()
console.log(':', stats)
// :
// {
// hasCache: true,
// messageCount: 1000,
// cacheAge: 3600000, // 1
// cacheSize: 524288, // ~512KB
// version: '1.0.0'
// }

//
const index = messageIndexService.getSerializedIndex()
const documents = messageIndexService.getDocuments()
await indexedDBCache.saveIndex(
 JSON.stringify(index),
 documents,
 1000
)
console.log('')

//
const cached = await indexedDBCache.loadIndex()
if (cached) {
 console.log(` ${cached.messageCount} `)
 messageIndexService.deserializeIndex(
 JSON.parse(cached.serializedIndex),
 cached.documents
 )
}

//
await indexedDBCache.clearCache()
console.log('')
```

---

### 6:

****:

```javascript
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

//
const startTime = performance.now()
const results = messageIndexService.search('')
const executionTime = performance.now() - startTime

searchPerformanceMonitor.recordSearch({
 query: '',
 searchType: 'basic',
 resultCount: results.length,
 executionTime: executionTime
})

//
const stats = searchPerformanceMonitor.getStats()
console.log(':', {
 : stats.totalSearches,
 : stats.avgExecutionTime.toFixed(2) + 'ms',
 P50: stats.p50ExecutionTime.toFixed(2) + 'ms',
 P95: stats.p95ExecutionTime.toFixed(2) + 'ms',
 P99: stats.p99ExecutionTime.toFixed(2) + 'ms'
})

//
const slowQueries = searchPerformanceMonitor.getSlowQueries(50)
console.log(` ${slowQueries.length} (>50ms):`)
slowQueries.forEach(q => {
 console.log(` - "${q.query}": ${q.executionTime.toFixed(2)}ms`)
})

//
const report = searchPerformanceMonitor.getPerformanceReport()
console.log(report)
```

---

### 7:

****:

```javascript
import { highlightSearchTerms } from '@/utils/searchHighlight'

//
const text = 'ORD123456'
const searchTerms = ['', '']

// HTML
const highlighted = highlightSearchTerms(text, searchTerms)
console.log(highlighted)

// :
// <mark class="search-highlight"></mark><mark class="search-highlight"></mark>
// <mark class="search-highlight"></mark>ORD123456

// Vue
<template>
 <div v-html="highlighted"></div>
</template>

<script setup>
import { computed } from 'vue'
import { highlightSearchTerms } from '@/utils/searchHighlight'

const message = ref('')
const searchQuery = ref('')

const highlighted = computed(() => {
 const terms = searchQuery.value.split(/\s+/).filter(t => t)
 return highlightSearchTerms(message.value, terms)
})
</script>
```

---

### 8:

****:

```javascript
import { paginateResults, getPage } from '@/utils/searchPagination'

//
const results = messageIndexService.search('')
console.log(` ${results.length} `)

// 20
const paginated = paginateResults(results, {
 pageSize: 20,
 currentPage: 1
})

console.log(':', paginated.pagination)
// :
// {
// currentPage: 1,
// pageSize: 20,
// totalResults: 157,
// totalPages: 8,
// hasNextPage: true,
// hasPrevPage: false,
// startIndex: 0,
// endIndex: 20
// }

console.log(':', paginated.data.length) // 20

// 2
const page2 = getPage(results, 2, 20)
console.log(' 2 :', page2.data.length) // 20

//
const lastPageNum = Math.ceil(results.length / 20)
const lastPage = getPage(results, lastPageNum, 20)
console.log(':', lastPage.data.length) // 17
```

---


### 1: -

****:

****:
```javascript
// 1.
const query = ' NOT NOT '
const results = messageIndexService.advancedSearch(query)

// 2.
const sortedResults = results.sort((a, b) =>
 new Date(b.createdAt) - new Date(a.createdAt)
)

// 3.
const paginated = paginateResults(sortedResults, {
 pageSize: 10,
 currentPage: 1
})

// 4.
searchHistoryService.addSearch(query, results.length, 'advanced')

console.log(` ${results.length} `)
console.log(':', paginated.data.slice(0, 5))
```

**UI **:
```vue
<template>
 <div class="customer-issues-panel">
 <h3> ({{ results.length }})</h3>

 <div v-for="msg in paginatedResults.data" :key="msg.id" class="issue-card">
 <div class="issue-content" v-html="highlightContent(msg)"></div>
 <div class="issue-meta">
 <span>{{ msg.senderName }}</span>
 <span>{{ formatTime(msg.createdAt) }}</span>
 </div>
 </div>

 <pagination
 :current="currentPage"
 :total="paginatedResults.pagination.totalPages"
 @change="handlePageChange"
 />
 </div>
</template>
```

---

### 2: -

****:

****:
```javascript
//
const orderSearches = {
 pending: ' AND ( OR ) NOT ( OR )',
 completed: ' AND NOT ',
 cancelled: ' AND ',
 refund: ' AND ( OR )'
}

//
const orderStats = {}
for (const [status, query] of Object.entries(orderSearches)) {
 const results = messageIndexService.advancedSearch(query)
 orderStats[status] = {
 count: results.length,
 messages: results
 }
}

console.log(':')
console.log(' :', orderStats.pending.count)
console.log(' :', orderStats.completed.count)
console.log(' :', orderStats.cancelled.count)
console.log(' :', orderStats.refund.count)

// :
// :
// : 42
// : 158
// : 23
// : 8
```

****:
```vue
<template>
 <div class="order-dashboard">
 <div class="stats-grid">
 <stat-card
 title=""
 :count="orderStats.pending.count"
 color="orange"
 @click="showOrders('pending')"
 />
 <stat-card
 title=""
 :count="orderStats.completed.count"
 color="green"
 @click="showOrders('completed')"
 />
 <stat-card
 title=""
 :count="orderStats.cancelled.count"
 color="red"
 @click="showOrders('cancelled')"
 />
 <stat-card
 title=""
 :count="orderStats.refund.count"
 color="blue"
 @click="showOrders('refund')"
 />
 </div>
 </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { messageIndexService } from '@/services/messageIndexService'

const orderStats = ref({})

const loadOrderStats = () => {
 const searches = {
 pending: ' AND ( OR ) NOT ( OR )',
 completed: ' AND NOT ',
 cancelled: ' AND ',
 refund: ' AND ( OR )'
 }

 for (const [status, query] of Object.entries(searches)) {
 const results = messageIndexService.advancedSearch(query)
 orderStats.value[status] = {
 count: results.length,
 messages: results
 }
 }
}

onMounted(() => {
 loadOrderStats()
})
</script>
```

---

### 3: -

****:

****:
```javascript
//
const bannedWords = ['', '', '', '']

//
const checkServiceQuality = async (agentName) => {
 //
 const agentMessages = messageIndexService.advancedSearch(
 `senderName:${agentName}`
 )

 //
 const violations = []

 for (const word of bannedWords) {
 const results = messageIndexService.advancedSearch(
 `senderName:${agentName} AND content:${word}`
 )

 if (results.length > 0) {
 violations.push({
 word: word,
 count: results.length,
 messages: results
 })
 }
 }

 return {
 agentName,
 totalMessages: agentMessages.length,
 violations,
 violationRate: violations.length > 0
 ? (violations.reduce((sum, v) => sum + v.count, 0) / agentMessages.length * 100).toFixed(2)
 : 0
 }
}

//
const agents = ['', '', '']
const qualityReports = await Promise.all(
 agents.map(agent => checkServiceQuality(agent))
)

console.log(':')
qualityReports.forEach(report => {
 console.log(`\n${report.agentName}:`)
 console.log(` : ${report.totalMessages}`)
 console.log(` : ${report.violationRate}%`)
 if (report.violations.length > 0) {
 console.log(' :')
 report.violations.forEach(v => {
 console.log(` - "${v.word}": ${v.count} `)
 })
 }
})
```

---

### 4: -

****:

****:
```javascript
//
const topics = {
 shipping: ['', '', '', ''],
 payment: ['', '', '', ''],
 quality: ['', '', '', ''],
 service: ['', '', '', ''],
 refund: ['', '', '', '']
}

//
const topicStats = {}

for (const [topic, keywords] of Object.entries(topics)) {
 const query = keywords.join(' OR ')
 const results = messageIndexService.search(query)

 topicStats[topic] = {
 name: topic,
 keywords: keywords,
 count: results.length,
 percentage: 0 //
 }
}

//
const total = Object.values(topicStats).reduce((sum, t) => sum + t.count, 0)
for (const topic of Object.values(topicStats)) {
 topic.percentage = ((topic.count / total) * 100).toFixed(2)
}

//
const sortedTopics = Object.values(topicStats).sort((a, b) => b.count - a.count)

console.log(':')
sortedTopics.forEach((topic, index) => {
 console.log(`${index + 1}. ${topic.name}: ${topic.count} (${topic.percentage}%)`)
})

// :
// :
// 1. shipping: 342 (28.50%)
// 2. quality: 287 (23.92%)
// 3. payment: 215 (17.92%)
// 4. service: 198 (16.50%)
// 5. refund: 158 (13.17%)
```

****:
```vue
<template>
 <div class="topic-analysis">
 <h3></h3>

 <div class="topic-chart">
 <bar-chart :data="chartData" />
 </div>

 <div class="topic-list">
 <div v-for="(topic, index) in sortedTopics" :key="topic.name" class="topic-item">
 <div class="topic-rank">{{ index + 1 }}</div>
 <div class="topic-info">
 <div class="topic-name">{{ topicNames[topic.name] }}</div>
 <div class="topic-keywords">{{ topic.keywords.join(', ') }}</div>
 </div>
 <div class="topic-stats">
 <div class="topic-count">{{ topic.count }} </div>
 <div class="topic-percentage">{{ topic.percentage }}%</div>
 </div>
 </div>
 </div>
 </div>
</template>
```

---


### 1:

****:

****:
```javascript
//
const searchCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5

const cachedSearch = (query, searchType = 'basic') => {
 const cacheKey = `${searchType}:${query}`

 //
 const cached = searchCache.get(cacheKey)
 if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
 console.log('')
 return cached.results
 }

 //
 const startTime = performance.now()
 const results = searchType === 'advanced'
 ? messageIndexService.advancedSearch(query)
 : messageIndexService.search(query)
 const executionTime = performance.now() - startTime

 //
 searchCache.set(cacheKey, {
 results,
 timestamp: Date.now()
 })

 console.log(`: ${executionTime.toFixed(2)}ms`)
 return results
}

//
const results1 = cachedSearch('') // : 8.5ms
const results2 = cachedSearch('') // : <1ms
```

---

### 2:

****:

****:
```vue
<template>
 <input
 v-model="searchQuery"
 @input="handleInput"
 placeholder="..."
 />
</template>

<script setup>
import { ref } from 'vue'
import { createDebouncedFunction } from '@/utils/debounce'
import { messageIndexService } from '@/services/messageIndexService'

const searchQuery = ref('')
const searchResults = ref([])

//
const performSearch = () => {
 if (!searchQuery.value.trim()) {
 searchResults.value = []
 return
 }

 const results = messageIndexService.search(searchQuery.value)
 searchResults.value = results
 console.log(` ${results.length} `)
}

const debouncedSearch = createDebouncedFunction(performSearch, 300)

const handleInput = () => {
 // 300ms
 debouncedSearch.debounced()
}

//
onUnmounted(() => {
 debouncedSearch.cancel()
})
</script>
```

****:
```
:
 "" (5 )
 5 ()
 : ~40ms

:
 "" (5 )
 1 ()
 : ~8ms
 : 80%
```

---

### 3:

****: 10,000+

****:
```javascript
//
const buildLargeIndex = async (messages, batchSize = 1000) => {
 console.log(` ${messages.length} `)

 const batches = []
 for (let i = 0; i < messages.length; i += batchSize) {
 batches.push(messages.slice(i, i + batchSize))
 }

 console.log(` ${batches.length} `)

 const startTime = performance.now()

 //
 messageIndexService.buildIndex(batches[0])

 //
 for (let i = 1; i < batches.length; i++) {
 batches[i].forEach(msg => {
 messageIndexService.addMessage(msg)
 })

 //
 await new Promise(resolve => setTimeout(resolve, 0))

 console.log(` ${i + 1}/${batches.length} `)
 }

 const totalTime = performance.now() - startTime
 console.log(` ${totalTime.toFixed(2)}ms`)

 return messageIndexService.getStats()
}

//
const largeMessageSet = [...] // 10,000
const stats = await buildLargeIndex(largeMessageSet, 1000)
console.log(':', stats)
```

---


### 1:

****:

****:
```javascript
// 1.
const stats = messageIndexService.getStats()
console.log(':', stats)

if (!stats.isReady) {
 console.error(' ')
 // :
 messageIndexService.buildIndex(messages)
}

if (stats.messageCount === 0) {
 console.error(' ')
 // :
}

// 2.
const testQuery = ''
const results = messageIndexService.search(testQuery)
console.log(` "${testQuery}":`, results.length)

if (results.length === 0) {
 console.warn(' ')
 // :
}

// 3.
const userQuery = ''
const userResults = messageIndexService.search(userQuery)
console.log(` "${userQuery}":`, userResults.length)

// 4.
const fuzzyResults = messageIndexService.fuzzySearch(userQuery, 1)
console.log(`:`, fuzzyResults.length)

// 5.
const allMessages = messages.filter(m =>
 m.content && m.content.includes(userQuery)
)
console.log(` "${userQuery}" :`, allMessages.length)

if (allMessages.length > userResults.length) {
 console.warn(' ')
 messageIndexService.buildIndex(messages)
}
```

---

### 2:

****:

****:
```javascript
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

// 1.
const recentMetrics = searchPerformanceMonitor.getRecentMetrics(10)
console.log(' 10 :')
recentMetrics.forEach((m, i) => {
 console.log(` ${i + 1}. "${m.query}": ${m.executionTime.toFixed(2)}ms`)
})

// 2.
const slowQueries = searchPerformanceMonitor.getSlowQueries(50)
console.log(`\n (>50ms): ${slowQueries.length} `)
slowQueries.forEach(q => {
 console.log(` - "${q.query}": ${q.executionTime.toFixed(2)}ms`)
})

// 3.
const typeStats = searchPerformanceMonitor.getSearchTypeStats()
console.log('\n:')
typeStats.forEach(stat => {
 console.log(` ${stat.type}: ${stat.avgTime.toFixed(2)}ms (${stat.count} )`)
})

// 4.
const cacheStats = await indexedDBCache.getStats()
console.log('\n:', cacheStats)

if (!cacheStats.hasCache) {
 console.warn(' ')
 // : IndexedDB
}

// 5.
const noCacheTime = performance.now()
messageIndexService.clearIndex()
messageIndexService.buildIndex(messages)
const noCacheDuration = performance.now() - noCacheTime
console.log(`\n: ${noCacheDuration.toFixed(2)}ms`)

const cached = await indexedDBCache.loadIndex()
if (cached) {
 const cacheTime = performance.now()
 messageIndexService.deserializeIndex(
 JSON.parse(cached.serializedIndex),
 cached.documents
 )
 const cacheDuration = performance.now() - cacheTime
 console.log(`: ${cacheDuration.toFixed(2)}ms`)
 console.log(`: ${(noCacheDuration / cacheDuration).toFixed(2)}x`)
}
```

---

### 3:

****:

****:
```javascript
// 1.
const stats = messageIndexService.getStats()
console.log(':', stats.messageCount)

// 2.
const perfStats = searchPerformanceMonitor.getStats()
console.log(':', perfStats.totalSearches)

if (perfStats.totalSearches > 1000) {
 console.warn(' ')
 // :
 searchPerformanceMonitor.clearMetrics()
}

// 3.
const historyStats = searchHistoryService.getStats()
console.log(':', historyStats.totalSearches)

if (historyStats.totalSearches > 100) {
 console.warn(' ')
 // : 50
}

// 4.
const cacheStats = await indexedDBCache.getStats()
console.log(':', (cacheStats.cacheSize / 1024).toFixed(2), 'KB')

if (cacheStats.cacheSize > 5 * 1024 * 1024) { // 5MB
 console.warn(' ')
 // :
 await indexedDBCache.clearCache()
}

// 5.
if (process.env.NODE_ENV === 'development' && window.gc) {
 console.log('...')
 window.gc()
}
```

---


- **UI ** - 5
- **** - 8 API
- **** - 4
- **** - 3
- **** - 3

****:
- : `MESSAGE_SEARCH_USER_GUIDE.md`
- : `MESSAGE_SEARCH_TEST_REPORT.md`
- : `MESSAGE_SEARCH_DEPLOYMENT_GUIDE.md`

****:
- : (`CLAUDE.md`)
- : GitHub
- :

---

****: 1.0.0
****: 2025-10-08
****:
