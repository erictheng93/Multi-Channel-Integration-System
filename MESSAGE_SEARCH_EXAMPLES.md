# 消息搜索功能實用示例

**版本**: 1.0.0
**最後更新**: 2025-10-08
**目標讀者**: 開發者、系統集成人員、高級用戶

---

## 📚 目錄

- [UI 使用示例](#ui-使用示例)
- [編程接口示例](#編程接口示例)
- [實際業務場景](#實際業務場景)
- [性能優化示例](#性能優化示例)
- [故障排查示例](#故障排查示例)

---

## 🖥️ UI 使用示例

### 示例 1: 基礎搜索 - 查找訂單消息

**場景**: 客服需要查找與訂單相關的所有消息

**步驟**:
1. 打開會話詳情頁面
2. 在搜索框中輸入 `訂單`
3. 等待 0.3 秒自動搜索（或按 Enter）
4. 查看高亮顯示的結果

**預期結果**:
```
找到 15 條消息:
  ✓ "您的訂單已發貨"
  ✓ "訂單號：ORD123456"
  ✓ "關於訂單的問題"
  ... (共 15 條)
```

**UI 截圖說明**:
```
┌─────────────────────────────────────┐
│ 🔍 [訂單________________] [STD] [X] │
└─────────────────────────────────────┘
        ↓
搜索結果: 15 條消息匹配
"訂單" 字詞會以黃色背景高亮顯示
```

---

### 示例 2: 高級搜索 - 使用 AND 運算符

**場景**: 查找同時包含"訂單"和"完成"的消息

**步驟**:
1. 點擊 **ADV** 按鈕切換到高級模式
2. 輸入 `訂單 AND 完成`
3. 按 Enter 執行搜索

**預期結果**:
```
找到 5 條消息:
  ✓ "您的訂單已完成"
  ✓ "訂單處理完成，感謝您"
  ✓ "訂單 #123 配送完成"
  ... (共 5 條)

不匹配:
  ✗ "訂單正在處理中" (無"完成")
  ✗ "配送已完成" (無"訂單")
```

**UI 截圖說明**:
```
┌─────────────────────────────────────┐
│ 🔍 [訂單 AND 完成_______] [ADV] [X] │
└─────────────────────────────────────┘
        ↓
搜索結果: 5 條消息匹配
"訂單" 和 "完成" 都會高亮
```

---

### 示例 3: 字段搜索 - 查找特定客服的消息

**場景**: 檢查客服"小王"的回復質量

**步驟**:
1. 切換到 **ADV** 模式
2. 輸入 `senderName:小王`
3. 按 Enter

**預期結果**:
```
找到 32 條消息（所有由"小王"發送的消息）:
  ✓ 小王: "您好，很高興為您服務"
  ✓ 小王: "您的訂單已發貨"
  ✓ 小王: "請問還有其他問題嗎？"
  ... (共 32 條)

不匹配:
  ✗ 客戶張三: "請問小王在嗎？" (發送者不是小王)
```

---

### 示例 4: 組合搜索 - 複雜條件

**場景**: 查找客服關於退款的回復，但排除已處理的

**步驟**:
1. 切換到 **ADV** 模式
2. 輸入 `(退款 OR 取消) AND senderName:客服 NOT 已處理`
3. 按 Enter

**預期結果**:
```
找到 8 條消息:
  ✓ 客服小李: "關於您的退款申請..."
  ✓ 客服小王: "訂單取消後退款..."
  ... (共 8 條)

不匹配:
  ✗ 客服小李: "您的退款已處理完畢" (有"已處理")
  ✗ 客戶張三: "我要退款" (發送者不是客服)
```

---

### 示例 5: 搜索歷史 - 快速重複搜索

**場景**: 需要重複執行之前的搜索

**步驟**:
1. 點擊搜索框
2. 查看自動顯示的搜索歷史
3. 點擊需要的歷史記錄
4. 自動填充並執行搜索

**搜索歷史示例**:
```
最近搜索:
  1. "訂單 AND 完成" - 5 條結果 - 2 分鐘前 ⭐⭐⭐
  2. "senderName:小王" - 32 條結果 - 5 分鐘前 ⭐⭐
  3. "退款" - 18 條結果 - 10 分鐘前 ⭐
  4. "content:問題" - 42 條結果 - 15 分鐘前
  5. "配送*" - 27 條結果 - 30 分鐘前

⭐ = 使用頻率
```

---

## 💻 編程接口示例

### 示例 1: 基礎搜索 API

**場景**: 在控制台中執行基礎搜索

```javascript
// 導入索引服務
import { messageIndexService } from '@/services/messageIndexService'

// 執行搜索
const results = messageIndexService.search('訂單')

console.log(`找到 ${results.length} 條結果`)
console.log(results)

// 輸出示例:
// 找到 15 條結果
// [
//   { id: 1, content: '您的訂單已發貨', score: 0.95, ... },
//   { id: 2, content: '訂單號：ORD123456', score: 0.87, ... },
//   ...
// ]
```

---

### 示例 2: 高級搜索 API

**場景**: 使用布爾運算符進行複雜搜索

```javascript
import { messageIndexService } from '@/services/messageIndexService'

// 使用 AND 運算符
const andResults = messageIndexService.advancedSearch('訂單 AND 完成')
console.log('AND 搜索結果:', andResults.length)

// 使用 OR 運算符
const orResults = messageIndexService.advancedSearch('退款 OR 取消')
console.log('OR 搜索結果:', orResults.length)

// 使用 NOT 運算符
const notResults = messageIndexService.advancedSearch('問題 NOT 解決')
console.log('NOT 搜索結果:', notResults.length)

// 組合運算符
const complexResults = messageIndexService.advancedSearch(
  '(訂單 OR 產品) AND 完成 NOT 取消'
)
console.log('複雜搜索結果:', complexResults.length)
```

---

### 示例 3: 構建索引

**場景**: 手動構建或重建搜索索引

```javascript
import { messageIndexService } from '@/services/messageIndexService'

// 準備消息數據
const messages = [
  {
    id: 1,
    content: '您的訂單已發貨',
    senderName: '客服小王',
    messageType: 'text',
    attachments: []
  },
  {
    id: 2,
    content: '訂單號：ORD123456',
    senderName: '系統',
    messageType: 'text',
    attachments: []
  },
  // ... 更多消息
]

// 構建索引
const startTime = performance.now()
messageIndexService.buildIndex(messages)
const buildTime = performance.now() - startTime

console.log(`索引構建完成，耗時 ${buildTime.toFixed(2)}ms`)
console.log('索引統計:', messageIndexService.getStats())

// 輸出示例:
// 索引構建完成，耗時 18.34ms
// 索引統計: {
//   isReady: true,
//   messageCount: 1000,
//   lastBuildTime: 18.34
// }
```

---

### 示例 4: 增量更新索引

**場景**: 新消息到達時更新索引，無需重建

```javascript
import { messageIndexService } from '@/services/messageIndexService'

// 添加新消息
const newMessage = {
  id: 1001,
  content: '新訂單已創建',
  senderName: '系統',
  messageType: 'text',
  attachments: []
}

messageIndexService.addMessage(newMessage)
console.log('新消息已添加到索引')

// 更新現有消息
const updatedMessage = {
  id: 1001,
  content: '訂單已確認',
  senderName: '系統',
  messageType: 'text',
  attachments: []
}

messageIndexService.updateMessage(updatedMessage)
console.log('消息已更新')

// 刪除消息
messageIndexService.removeMessage(1001)
console.log('消息已從索引移除')

// 驗證索引狀態
const stats = messageIndexService.getStats()
console.log('當前消息數:', stats.messageCount)
```

---

### 示例 5: 緩存管理

**場景**: 管理 IndexedDB 緩存

```javascript
import { indexedDBCache } from '@/services/indexedDBCache'
import { messageIndexService } from '@/services/messageIndexService'

// 檢查緩存狀態
const stats = await indexedDBCache.getStats()
console.log('緩存統計:', stats)
// 輸出:
// {
//   hasCache: true,
//   messageCount: 1000,
//   cacheAge: 3600000, // 1小時
//   cacheSize: 524288,  // ~512KB
//   version: '1.0.0'
// }

// 保存索引到緩存
const index = messageIndexService.getSerializedIndex()
const documents = messageIndexService.getDocuments()
await indexedDBCache.saveIndex(
  JSON.stringify(index),
  documents,
  1000
)
console.log('索引已保存到緩存')

// 從緩存加載
const cached = await indexedDBCache.loadIndex()
if (cached) {
  console.log(`從緩存加載了 ${cached.messageCount} 條消息的索引`)
  messageIndexService.deserializeIndex(
    JSON.parse(cached.serializedIndex),
    cached.documents
  )
}

// 清除緩存
await indexedDBCache.clearCache()
console.log('緩存已清除')
```

---

### 示例 6: 性能監控

**場景**: 監控和分析搜索性能

```javascript
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

// 記錄搜索性能
const startTime = performance.now()
const results = messageIndexService.search('訂單')
const executionTime = performance.now() - startTime

searchPerformanceMonitor.recordSearch({
  query: '訂單',
  searchType: 'basic',
  resultCount: results.length,
  executionTime: executionTime
})

// 獲取性能統計
const stats = searchPerformanceMonitor.getStats()
console.log('性能統計:', {
  總搜索次數: stats.totalSearches,
  平均執行時間: stats.avgExecutionTime.toFixed(2) + 'ms',
  P50: stats.p50ExecutionTime.toFixed(2) + 'ms',
  P95: stats.p95ExecutionTime.toFixed(2) + 'ms',
  P99: stats.p99ExecutionTime.toFixed(2) + 'ms'
})

// 獲取慢查詢
const slowQueries = searchPerformanceMonitor.getSlowQueries(50)
console.log(`檢測到 ${slowQueries.length} 個慢查詢 (>50ms):`)
slowQueries.forEach(q => {
  console.log(`  - "${q.query}": ${q.executionTime.toFixed(2)}ms`)
})

// 導出性能報告
const report = searchPerformanceMonitor.getPerformanceReport()
console.log(report)
```

---

### 示例 7: 搜索結果高亮

**場景**: 在搜索結果中高亮關鍵詞

```javascript
import { highlightSearchTerms } from '@/utils/searchHighlight'

// 準備文本和搜索詞
const text = '您的訂單已發貨，訂單號：ORD123456'
const searchTerms = ['訂單', '發貨']

// 生成高亮 HTML
const highlighted = highlightSearchTerms(text, searchTerms)
console.log(highlighted)

// 輸出:
// 您的<mark class="search-highlight">訂單</mark>已<mark class="search-highlight">發貨</mark>，
// <mark class="search-highlight">訂單</mark>號：ORD123456

// 在 Vue 組件中使用
<template>
  <div v-html="highlighted"></div>
</template>

<script setup>
import { computed } from 'vue'
import { highlightSearchTerms } from '@/utils/searchHighlight'

const message = ref('您的訂單已發貨')
const searchQuery = ref('訂單')

const highlighted = computed(() => {
  const terms = searchQuery.value.split(/\s+/).filter(t => t)
  return highlightSearchTerms(message.value, terms)
})
</script>
```

---

### 示例 8: 搜索結果分頁

**場景**: 對大量搜索結果進行分頁

```javascript
import { paginateResults, getPage } from '@/utils/searchPagination'

// 執行搜索
const results = messageIndexService.search('訂單')
console.log(`找到 ${results.length} 條結果`)

// 分頁結果（每頁 20 條）
const paginated = paginateResults(results, {
  pageSize: 20,
  currentPage: 1
})

console.log('分頁信息:', paginated.pagination)
// 輸出:
// {
//   currentPage: 1,
//   pageSize: 20,
//   totalResults: 157,
//   totalPages: 8,
//   hasNextPage: true,
//   hasPrevPage: false,
//   startIndex: 0,
//   endIndex: 20
// }

console.log('當前頁數據:', paginated.data.length) // 20 條

// 獲取第 2 頁
const page2 = getPage(results, 2, 20)
console.log('第 2 頁:', page2.data.length) // 20 條

// 獲取最後一頁
const lastPageNum = Math.ceil(results.length / 20)
const lastPage = getPage(results, lastPageNum, 20)
console.log('最後一頁:', lastPage.data.length) // 17 條
```

---

## 🏢 實際業務場景

### 場景 1: 客服工作台 - 快速查找客戶問題

**業務需求**: 客服需要快速找到未解決的客戶問題

**解決方案**:
```javascript
// 1. 搜索未解決的問題
const query = '問題 NOT 解決 NOT 已處理'
const results = messageIndexService.advancedSearch(query)

// 2. 按時間排序（最新的在前）
const sortedResults = results.sort((a, b) =>
  new Date(b.createdAt) - new Date(a.createdAt)
)

// 3. 分頁顯示
const paginated = paginateResults(sortedResults, {
  pageSize: 10,
  currentPage: 1
})

// 4. 記錄搜索歷史
searchHistoryService.addSearch(query, results.length, 'advanced')

console.log(`找到 ${results.length} 個未解決的問題`)
console.log('最新問題:', paginated.data.slice(0, 5))
```

**UI 實現**:
```vue
<template>
  <div class="customer-issues-panel">
    <h3>未解決問題 ({{ results.length }})</h3>

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

### 場景 2: 訂單管理 - 追蹤訂單狀態

**業務需求**: 管理員需要查看所有訂單相關消息並按狀態分類

**解決方案**:
```javascript
// 定義訂單狀態搜索
const orderSearches = {
  pending: '訂單 AND (待處理 OR 處理中) NOT (完成 OR 取消)',
  completed: '訂單 AND 完成 NOT 取消',
  cancelled: '訂單 AND 取消',
  refund: '訂單 AND (退款 OR 退貨)'
}

// 執行所有搜索
const orderStats = {}
for (const [status, query] of Object.entries(orderSearches)) {
  const results = messageIndexService.advancedSearch(query)
  orderStats[status] = {
    count: results.length,
    messages: results
  }
}

console.log('訂單統計:')
console.log('  待處理:', orderStats.pending.count)
console.log('  已完成:', orderStats.completed.count)
console.log('  已取消:', orderStats.cancelled.count)
console.log('  退款中:', orderStats.refund.count)

// 輸出示例:
// 訂單統計:
//   待處理: 42
//   已完成: 158
//   已取消: 23
//   退款中: 8
```

**儀表板實現**:
```vue
<template>
  <div class="order-dashboard">
    <div class="stats-grid">
      <stat-card
        title="待處理訂單"
        :count="orderStats.pending.count"
        color="orange"
        @click="showOrders('pending')"
      />
      <stat-card
        title="已完成訂單"
        :count="orderStats.completed.count"
        color="green"
        @click="showOrders('completed')"
      />
      <stat-card
        title="已取消訂單"
        :count="orderStats.cancelled.count"
        color="red"
        @click="showOrders('cancelled')"
      />
      <stat-card
        title="退款中訂單"
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
    pending: '訂單 AND (待處理 OR 處理中) NOT (完成 OR 取消)',
    completed: '訂單 AND 完成 NOT 取消',
    cancelled: '訂單 AND 取消',
    refund: '訂單 AND (退款 OR 退貨)'
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

### 場景 3: 質量監控 - 分析客服回復質量

**業務需求**: 質量主管需要檢查客服回復中是否包含禁用詞

**解決方案**:
```javascript
// 定義禁用詞列表
const bannedWords = ['不知道', '不清楚', '不管', '隨便']

// 檢查每個客服的回復
const checkServiceQuality = async (agentName) => {
  // 獲取該客服的所有消息
  const agentMessages = messageIndexService.advancedSearch(
    `senderName:${agentName}`
  )

  // 檢查是否包含禁用詞
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

// 檢查所有客服
const agents = ['小王', '小李', '小張']
const qualityReports = await Promise.all(
  agents.map(agent => checkServiceQuality(agent))
)

console.log('質量檢查報告:')
qualityReports.forEach(report => {
  console.log(`\n${report.agentName}:`)
  console.log(`  總消息數: ${report.totalMessages}`)
  console.log(`  違規率: ${report.violationRate}%`)
  if (report.violations.length > 0) {
    console.log('  違規詞語:')
    report.violations.forEach(v => {
      console.log(`    - "${v.word}": ${v.count} 次`)
    })
  }
})
```

---

### 場景 4: 數據分析 - 熱門話題識別

**業務需求**: 產品經理想了解客戶最關心的話題

**解決方案**:
```javascript
// 定義話題關鍵詞
const topics = {
  shipping: ['配送', '物流', '發貨', '送達'],
  payment: ['支付', '付款', '價格', '費用'],
  quality: ['質量', '品質', '瑕疵', '損壞'],
  service: ['客服', '服務', '態度', '回復'],
  refund: ['退款', '退貨', '換貨', '賠償']
}

// 統計每個話題的消息數量
const topicStats = {}

for (const [topic, keywords] of Object.entries(topics)) {
  const query = keywords.join(' OR ')
  const results = messageIndexService.search(query)

  topicStats[topic] = {
    name: topic,
    keywords: keywords,
    count: results.length,
    percentage: 0 // 稍後計算
  }
}

// 計算百分比
const total = Object.values(topicStats).reduce((sum, t) => sum + t.count, 0)
for (const topic of Object.values(topicStats)) {
  topic.percentage = ((topic.count / total) * 100).toFixed(2)
}

// 按數量排序
const sortedTopics = Object.values(topicStats).sort((a, b) => b.count - a.count)

console.log('熱門話題分析:')
sortedTopics.forEach((topic, index) => {
  console.log(`${index + 1}. ${topic.name}: ${topic.count} 條 (${topic.percentage}%)`)
})

// 輸出示例:
// 熱門話題分析:
// 1. shipping: 342 條 (28.50%)
// 2. quality: 287 條 (23.92%)
// 3. payment: 215 條 (17.92%)
// 4. service: 198 條 (16.50%)
// 5. refund: 158 條 (13.17%)
```

**可視化實現**:
```vue
<template>
  <div class="topic-analysis">
    <h3>客戶關注話題分析</h3>

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
          <div class="topic-count">{{ topic.count }} 條</div>
          <div class="topic-percentage">{{ topic.percentage }}%</div>
        </div>
      </div>
    </div>
  </div>
</template>
```

---

## ⚡ 性能優化示例

### 示例 1: 使用緩存加速重複搜索

**場景**: 用戶頻繁搜索相同的關鍵詞

**優化方案**:
```javascript
// 創建搜索緩存
const searchCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 分鐘

const cachedSearch = (query, searchType = 'basic') => {
  const cacheKey = `${searchType}:${query}`

  // 檢查緩存
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('從緩存返回結果')
    return cached.results
  }

  // 執行搜索
  const startTime = performance.now()
  const results = searchType === 'advanced'
    ? messageIndexService.advancedSearch(query)
    : messageIndexService.search(query)
  const executionTime = performance.now() - startTime

  // 保存到緩存
  searchCache.set(cacheKey, {
    results,
    timestamp: Date.now()
  })

  console.log(`搜索執行時間: ${executionTime.toFixed(2)}ms`)
  return results
}

// 使用示例
const results1 = cachedSearch('訂單') // 執行搜索: 8.5ms
const results2 = cachedSearch('訂單') // 從緩存返回: <1ms
```

---

### 示例 2: 防抖搜索輸入

**場景**: 用戶快速輸入時避免頻繁觸發搜索

**優化方案**:
```vue
<template>
  <input
    v-model="searchQuery"
    @input="handleInput"
    placeholder="搜索消息..."
  />
</template>

<script setup>
import { ref } from 'vue'
import { createDebouncedFunction } from '@/utils/debounce'
import { messageIndexService } from '@/services/messageIndexService'

const searchQuery = ref('')
const searchResults = ref([])

// 創建防抖搜索函數
const performSearch = () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  const results = messageIndexService.search(searchQuery.value)
  searchResults.value = results
  console.log(`找到 ${results.length} 條結果`)
}

const debouncedSearch = createDebouncedFunction(performSearch, 300)

const handleInput = () => {
  // 300ms 後執行搜索
  debouncedSearch.debounced()
}

// 清理
onUnmounted(() => {
  debouncedSearch.cancel()
})
</script>
```

**效果**:
```
無防抖:
  輸入 "訂單" (5 個字符)
  → 觸發 5 次搜索 (每個字符一次)
  → 總耗時: ~40ms

有防抖:
  輸入 "訂單" (5 個字符)
  → 僅觸發 1 次搜索 (輸入完成後)
  → 總耗時: ~8ms
  → 性能提升: 80%
```

---

### 示例 3: 分批構建大索引

**場景**: 需要索引 10,000+ 條消息

**優化方案**:
```javascript
// 分批構建索引
const buildLargeIndex = async (messages, batchSize = 1000) => {
  console.log(`開始構建索引，共 ${messages.length} 條消息`)

  const batches = []
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize))
  }

  console.log(`分為 ${batches.length} 批處理`)

  const startTime = performance.now()

  // 構建第一批（初始化索引）
  messageIndexService.buildIndex(batches[0])

  // 增量添加其餘批次
  for (let i = 1; i < batches.length; i++) {
    batches[i].forEach(msg => {
      messageIndexService.addMessage(msg)
    })

    // 每批之後讓出主線程
    await new Promise(resolve => setTimeout(resolve, 0))

    console.log(`完成第 ${i + 1}/${batches.length} 批`)
  }

  const totalTime = performance.now() - startTime
  console.log(`索引構建完成，總耗時 ${totalTime.toFixed(2)}ms`)

  return messageIndexService.getStats()
}

// 使用示例
const largeMessageSet = [...] // 10,000 條消息
const stats = await buildLargeIndex(largeMessageSet, 1000)
console.log('索引統計:', stats)
```

---

## 🔧 故障排查示例

### 示例 1: 診斷搜索無結果問題

**場景**: 用戶報告搜索沒有返回預期結果

**排查步驟**:
```javascript
// 1. 檢查索引狀態
const stats = messageIndexService.getStats()
console.log('索引狀態:', stats)

if (!stats.isReady) {
  console.error('❌ 索引未就緒')
  // 解決: 重建索引
  messageIndexService.buildIndex(messages)
}

if (stats.messageCount === 0) {
  console.error('❌ 索引中沒有消息')
  // 解決: 檢查消息數據源
}

// 2. 測試基礎搜索
const testQuery = '測試'
const results = messageIndexService.search(testQuery)
console.log(`測試搜索 "${testQuery}":`, results.length)

if (results.length === 0) {
  console.warn('⚠️ 測試搜索無結果')
  // 可能原因: 索引未包含測試數據
}

// 3. 檢查搜索詞
const userQuery = '訂單'
const userResults = messageIndexService.search(userQuery)
console.log(`用戶搜索 "${userQuery}":`, userResults.length)

// 4. 嘗試模糊搜索
const fuzzyResults = messageIndexService.fuzzySearch(userQuery, 1)
console.log(`模糊搜索結果:`, fuzzyResults.length)

// 5. 檢查原始數據
const allMessages = messages.filter(m =>
  m.content && m.content.includes(userQuery)
)
console.log(`原始數據包含 "${userQuery}" 的消息:`, allMessages.length)

if (allMessages.length > userResults.length) {
  console.warn('⚠️ 索引可能不完整，需要重建')
  messageIndexService.buildIndex(messages)
}
```

---

### 示例 2: 性能問題診斷

**場景**: 搜索響應緩慢

**排查步驟**:
```javascript
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

// 1. 檢查最近的搜索性能
const recentMetrics = searchPerformanceMonitor.getRecentMetrics(10)
console.log('最近 10 次搜索:')
recentMetrics.forEach((m, i) => {
  console.log(`  ${i + 1}. "${m.query}": ${m.executionTime.toFixed(2)}ms`)
})

// 2. 識別慢查詢
const slowQueries = searchPerformanceMonitor.getSlowQueries(50)
console.log(`\n慢查詢 (>50ms): ${slowQueries.length} 個`)
slowQueries.forEach(q => {
  console.log(`  - "${q.query}": ${q.executionTime.toFixed(2)}ms`)
})

// 3. 分析搜索類型性能
const typeStats = searchPerformanceMonitor.getSearchTypeStats()
console.log('\n各類搜索性能:')
typeStats.forEach(stat => {
  console.log(`  ${stat.type}: 平均 ${stat.avgTime.toFixed(2)}ms (${stat.count} 次)`)
})

// 4. 檢查緩存狀態
const cacheStats = await indexedDBCache.getStats()
console.log('\n緩存狀態:', cacheStats)

if (!cacheStats.hasCache) {
  console.warn('⚠️ 緩存未命中，每次都重建索引')
  // 解決: 檢查 IndexedDB 可用性
}

// 5. 測試緩存性能
const noCacheTime = performance.now()
messageIndexService.clearIndex()
messageIndexService.buildIndex(messages)
const noCacheDuration = performance.now() - noCacheTime
console.log(`\n無緩存構建時間: ${noCacheDuration.toFixed(2)}ms`)

const cached = await indexedDBCache.loadIndex()
if (cached) {
  const cacheTime = performance.now()
  messageIndexService.deserializeIndex(
    JSON.parse(cached.serializedIndex),
    cached.documents
  )
  const cacheDuration = performance.now() - cacheTime
  console.log(`緩存加載時間: ${cacheDuration.toFixed(2)}ms`)
  console.log(`性能提升: ${(noCacheDuration / cacheDuration).toFixed(2)}x`)
}
```

---

### 示例 3: 內存泄漏檢查

**場景**: 應用運行一段時間後變慢

**排查步驟**:
```javascript
// 1. 檢查索引大小
const stats = messageIndexService.getStats()
console.log('當前索引消息數:', stats.messageCount)

// 2. 檢查性能監控數據大小
const perfStats = searchPerformanceMonitor.getStats()
console.log('性能監控記錄數:', perfStats.totalSearches)

if (perfStats.totalSearches > 1000) {
  console.warn('⚠️ 性能監控數據過多，建議清理')
  // 解決: 清除舊數據
  searchPerformanceMonitor.clearMetrics()
}

// 3. 檢查搜索歷史大小
const historyStats = searchHistoryService.getStats()
console.log('搜索歷史記錄數:', historyStats.totalSearches)

if (historyStats.totalSearches > 100) {
  console.warn('⚠️ 搜索歷史過多')
  // 解決: 限制在 50 條（自動處理）
}

// 4. 檢查緩存大小
const cacheStats = await indexedDBCache.getStats()
console.log('緩存大小:', (cacheStats.cacheSize / 1024).toFixed(2), 'KB')

if (cacheStats.cacheSize > 5 * 1024 * 1024) { // 5MB
  console.warn('⚠️ 緩存過大')
  // 解決: 清除並重建
  await indexedDBCache.clearCache()
}

// 5. 強制垃圾回收（僅在開發環境）
if (process.env.NODE_ENV === 'development' && window.gc) {
  console.log('執行垃圾回收...')
  window.gc()
}
```

---

## 📚 總結

本文檔提供了消息搜索功能的完整實用示例，涵蓋：

- ✅ **UI 使用示例** - 5 個常見用戶操作場景
- ✅ **編程接口示例** - 8 個 API 使用示例
- ✅ **業務場景** - 4 個實際業務應用
- ✅ **性能優化** - 3 個優化技巧
- ✅ **故障排查** - 3 個診斷方法

**相關文檔**:
- 用戶指南: `MESSAGE_SEARCH_USER_GUIDE.md`
- 測試報告: `MESSAGE_SEARCH_TEST_REPORT.md`
- 部署指南: `MESSAGE_SEARCH_DEPLOYMENT_GUIDE.md`

**獲取幫助**:
- 技術問題: 查看項目文檔 (`CLAUDE.md`)
- 更多示例: GitHub 倉庫
- 反饋建議: 產品團隊

---

**版本**: 1.0.0
**最後更新**: 2025-10-08
**維護者**: 技術團隊
