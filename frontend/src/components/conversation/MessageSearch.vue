<template>
  <div class="message-search">
    <div
      v-if="!isExpanded"
      class="search-trigger"
    >
      <button
        class="search-button"
        @click="isExpanded = true"
      >
        <SearchIcon />
        <span>搜索消息</span>
      </button>
    </div>

    <div
      v-else
      class="search-expanded"
    >
      <div class="search-input-row">
        <div class="search-input-wrapper">
          <SearchIcon class="search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            :placeholder="isAdvancedMode ? '高級搜索 (支持 AND, OR, NOT, *)' : '搜索消息內容...'"
            class="search-input"
            @input="handleSearch"
            @keydown="handleKeydown"
            @focus="updateSuggestions"
          >
          <button
            v-if="searchQuery"
            class="clear-button"
            @click="clearSearch"
          >
            <XIcon />
          </button>

          <!-- 搜索建議下拉菜單 -->
          <div
            v-if="showSuggestions && searchSuggestions.length > 0"
            class="search-suggestions"
          >
            <div
              v-for="(suggestion, index) in searchSuggestions"
              :key="index"
              class="suggestion-item"
              @click="applySuggestion(suggestion)"
            >
              <SearchIcon class="suggestion-icon" />
              <span>{{ suggestion }}</span>
            </div>
          </div>
        </div>

        <button
          class="mode-toggle"
          :class="{ active: isAdvancedMode }"
          :title="isAdvancedMode ? '切換到普通搜索' : '切換到高級搜索'"
          @click="toggleAdvancedMode"
        >
          {{ isAdvancedMode ? 'ADV' : 'STD' }}
        </button>

        <button
          class="remote-search-button"
          :disabled="!canRemoteSearch || isRemoteSearching"
          @click="searchRemoteHistory"
        >
          {{ isRemoteSearching ? '搜尋中...' : '搜尋完整歷史' }}
        </button>

        <button
          class="close-search"
          @click="closeSearch"
        >
          <XIcon />
        </button>
      </div>

      <div class="search-filters">
        <div class="filter-group">
          <label class="filter-label">類型</label>
          <select
            v-model="filters.messageType"
            class="filter-select"
            @change="handleSearch"
          >
            <option value="">
              全部
            </option>
            <option value="text">
              文本
            </option>
            <option value="image">
              圖片
            </option>
            <option value="file">
              文件
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">發送者</label>
          <select
            v-model="filters.senderType"
            class="filter-select"
            @change="handleSearch"
          >
            <option value="">
              全部
            </option>
            <option value="customer">
              客戶
            </option>
            <option value="agent">
              客服
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">日期</label>
          <select
            v-model="filters.dateRange"
            class="filter-select"
            @change="handleSearch"
          >
            <option value="">
              全部
            </option>
            <option value="today">
              今天
            </option>
            <option value="week">
              本週
            </option>
            <option value="month">
              本月
            </option>
          </select>
        </div>

        <button
          v-if="hasActiveFilters"
          class="clear-filters"
          @click="clearFilters"
        >
          清除過濾
        </button>
      </div>

      <div
        v-if="searchResults.length > 0"
        class="search-results-info"
      >
        找到 {{ searchResults.length }} 條消息
        <span
          v-if="remoteVisibleCount > 0"
          class="history-badge"
        >
          歷史 {{ remoteVisibleCount }}
        </span>
      </div>

      <div
        v-else-if="searchQuery.trim() && !remoteSearched && !isRemoteSearching"
        class="remote-search-hint"
      >
        本地無結果，按 Enter 搜尋完整歷史
      </div>

      <div
        v-if="remoteLimitReached"
        class="remote-search-hint"
      >
        僅顯示前 50 筆，請縮小關鍵字
      </div>

      <div
        v-if="remoteSearchError"
        class="remote-search-error"
      >
        {{ remoteSearchError }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { SearchIcon, XIcon } from '@/components/icons'
import type { Message } from '@/types'
import { messageApi } from '@/api/message'
import { messageIndexService } from '@/services/messageIndexService'
import { searchHistoryService } from '@/services/searchHistoryService'
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'
import { createDebouncedFunction } from '@/utils/debounce'

interface SearchFilters {
  messageType: string
  senderType: string  
  dateRange: string
}

interface Props {
  messages: Message[]
  conversationId?: string
  autoExpand?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoExpand: false
})

const emit = defineEmits<{
  'search-results': [results: Message[]]
  'search-clear': []
}>()

// 狀態
const isExpanded = ref(props.autoExpand)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement>()
const isAdvancedMode = ref(false)
const showSuggestions = ref(false)
const searchSuggestions = ref<string[]>([])
const remoteResults = ref<Message[]>([])
const isRemoteSearching = ref(false)
const remoteSearched = ref(false)
const remoteSearchError = ref('')
const remoteLimitReached = ref(false)

// Watch autoExpand prop changes
watch(() => props.autoExpand, (newVal) => {
  if (newVal) {
    isExpanded.value = true
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

const filters = ref<SearchFilters>({
  messageType: '',
  senderType: '',
  dateRange: ''
})

// 計算屬性
const hasActiveFilters = computed(() => {
  return filters.value.messageType || filters.value.senderType || filters.value.dateRange
})

const canRemoteSearch = computed(() => {
  return Boolean(props.conversationId?.trim() && searchQuery.value.trim())
})

const localSearchResults = computed(() => {
  if (!searchQuery.value.trim() && !hasActiveFilters.value) {
    return []
  }

  // 根據模式選擇搜索方法
  return searchQuery.value.trim()
    ? (isAdvancedMode.value
        ? messageIndexService.advancedSearch(searchQuery.value)
        : messageIndexService.search(searchQuery.value))
    : props.messages
})

const remoteOnlyResultIds = computed(() => {
  const localIds = new Set(localSearchResults.value.map(message => message.id))
  return new Set(remoteResults.value.filter(message => !localIds.has(message.id)).map(message => message.id))
})

const markRemoteResult = (message: Message): Message => ({
  ...message,
  metadata: {
    ...message.metadata,
    searchSource: 'remote-history'
  }
})

const searchResults = computed(() => {
  if (!searchQuery.value.trim() && !hasActiveFilters.value) {
    return []
  }

  const localIds = new Set(localSearchResults.value.map(message => message.id))
  let results = [
    ...localSearchResults.value,
    ...remoteResults.value.filter(message => !localIds.has(message.id)).map(markRemoteResult)
  ]

  // 應用額外的過濾條件
  // 消息類型過濾
  if (filters.value.messageType) {
    results = results.filter(m => m.messageType === filters.value.messageType)
  }

  // 發送者類型過濾
  if (filters.value.senderType) {
    results = results.filter(m => matchesSenderType(m))
  }

  // 日期範圍過濾
  if (filters.value.dateRange) {
    results = results.filter(m => matchesDateRange(m))
  }

  return results.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
})

const remoteVisibleCount = computed(() => {
  return searchResults.value.filter(message => remoteOnlyResultIds.value.has(message.id)).length
})

// 方法
const matchesDateRange = (message: Message): boolean => {
  if (!filters.value.dateRange) {
    return true
  }

  const messageDate = new Date(message.createdAt)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filters.value.dateRange) {
    case 'today':
      return messageDate >= today
    case 'week': {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      return messageDate >= weekAgo
    }
    case 'month': {
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      return messageDate >= monthAgo
    }
    default:
      return true
  }
}

const matchesSenderType = (message: Message): boolean => {
  if (filters.value.senderType === 'customer') {
    return message.senderType === 'customer' || message.senderType === 'user'
  }
  return message.senderType === filters.value.senderType
}

const getDateRangeFrom = (): string | undefined => {
  if (!filters.value.dateRange) {
    return undefined
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filters.value.dateRange) {
    case 'today':
      return today.toISOString()
    case 'week':
      return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'month':
      return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return undefined
  }
}

const clearRemoteSearch = () => {
  remoteResults.value = []
  remoteSearched.value = false
  remoteSearchError.value = ''
  remoteLimitReached.value = false
}

const searchRemoteHistory = async () => {
  const query = searchQuery.value.trim()
  const conversationId = props.conversationId?.trim()

  if (!query || !conversationId || isRemoteSearching.value) {
    return
  }

  isRemoteSearching.value = true
  remoteResults.value = []
  remoteLimitReached.value = false
  remoteSearched.value = false
  remoteSearchError.value = ''

  try {
    const response = await messageApi.search(conversationId, query, filters.value.messageType || undefined, {
      senderType: filters.value.senderType || undefined,
      from: getDateRangeFrom()
    })

    remoteSearched.value = true

    if (!response.success) {
      remoteSearchError.value = response.error || '搜尋完整歷史失敗'
      return
    }

    remoteResults.value = response.data || []
    remoteLimitReached.value = remoteResults.value.length === 50
  } catch (error) {
    remoteSearched.value = true
    remoteSearchError.value = error instanceof Error ? error.message : '搜尋完整歷史失敗'
  } finally {
    isRemoteSearching.value = false
  }
}

// 實際執行搜索的函數
const performSearch = () => {
  const startTime = performance.now()
  const results = searchResults.value
  const searchTime = performance.now() - startTime

  emit('search-results', results)

  // 保存搜索歷史（僅當有查詢時）
  if (searchQuery.value.trim()) {
    searchHistoryService.addSearch(
      searchQuery.value,
      results.length,
      isAdvancedMode.value ? 'advanced' : 'basic'
    )

    // 記錄性能指標
    searchPerformanceMonitor.recordSearch({
      query: searchQuery.value,
      searchType: isAdvancedMode.value ? 'advanced' : 'basic',
      resultCount: results.length,
      executionTime: searchTime
    })
  }

  // 隱藏建議
  showSuggestions.value = false
}

// 創建防抖搜索函數 (300ms 延遲)
const debouncedSearch = createDebouncedFunction(performSearch, 300)

// 處理搜索（對外暴露的接口）
const handleSearch = () => {
  // 使用防抖搜索
  debouncedSearch.debounced()
}

// 組件卸載時取消待執行的搜索
onUnmounted(() => {
  debouncedSearch.cancel()
})

// 更新搜索建議
const updateSuggestions = () => {
  if (searchQuery.value.trim()) {
    searchSuggestions.value = searchHistoryService.getSuggestions(searchQuery.value, 5)
    showSuggestions.value = searchSuggestions.value.length > 0
  } else {
    // 顯示最近搜索
    searchSuggestions.value = searchHistoryService.getRecentSearches(5).map(item => item.query)
    showSuggestions.value = searchSuggestions.value.length > 0
  }
}

// 應用建議
const applySuggestion = (suggestion: string) => {
  searchQuery.value = suggestion
  showSuggestions.value = false
  handleSearch()
}

// 切換高級搜索模式
const toggleAdvancedMode = () => {
  isAdvancedMode.value = !isAdvancedMode.value
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    searchRemoteHistory()
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  clearRemoteSearch()
  handleSearch()
}

const clearFilters = () => {
  filters.value = {
    messageType: '',
    senderType: '',
    dateRange: ''
  }
  handleSearch()
}

const closeSearch = () => {
  isExpanded.value = false
  searchQuery.value = ''
  clearRemoteSearch()
  clearFilters()
  emit('search-clear')
}

watch(searchQuery, () => {
  clearRemoteSearch()
})

// 監聽搜索結果變化
watch(searchResults, (newResults) => {
  emit('search-results', newResults)
})

// 展開後聚焦輸入框
watch(isExpanded, async (expanded) => {
  if (expanded) {
    await nextTick()
    searchInputRef.value?.focus()
  }
})

// 暴露方法
defineExpose({
  focus: () => {
    isExpanded.value = true
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  },
  close: closeSearch
})
</script>

<style scoped>
.message-search {
  margin-bottom: var(--space-2);
  position: relative;
  z-index: 10;
}

.search-trigger {
  display: flex;
  justify-content: center;
  padding: var(--space-3) 0;
}

.search-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-lg);
  color: var(--gray-600);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.search-button:hover {
  background: rgba(255, 255, 255, 0.95);
  color: var(--primary-600);
  border-color: var(--primary-300);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.search-expanded {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-4);
  margin: var(--space-2) 0;
}

.search-input-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  width: 16px;
  height: 16px;
  color: var(--gray-400);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3) var(--space-2) 40px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.clear-button {
  position: absolute;
  right: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: var(--gray-400);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.clear-button:hover {
  background: var(--gray-100);
  color: var(--gray-600);
}

.close-search {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--gray-300);
  background: white;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.close-search:hover {
  background: var(--gray-50);
  color: var(--gray-700);
}

.mode-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid var(--gray-300);
  background: white;
  color: var(--gray-600);
  cursor: pointer;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.mode-toggle:hover {
  background: var(--gray-50);
  color: var(--gray-800);
  border-color: var(--gray-400);
}

.mode-toggle.active {
  background: var(--primary-50);
  color: var(--primary-700);
  border-color: var(--primary-300);
}

.mode-toggle.active:hover {
  background: var(--primary-100);
  border-color: var(--primary-400);
}

.remote-search-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112px;
  height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid transparent;
  background: var(--primary-50);
  color: var(--primary-700);
  cursor: pointer;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.remote-search-button:hover:not(:disabled) {
  background: var(--primary-100);
  color: var(--primary-800);
}

.remote-search-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: var(--space-1);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.suggestion-item:hover {
  background: var(--gray-50);
}

.suggestion-item:not(:last-child) {
  border-bottom: 1px solid var(--gray-100);
}

.suggestion-icon {
  width: 14px;
  height: 14px;
  color: var(--gray-400);
  flex-shrink: 0;
}

.suggestion-item span {
  flex: 1;
  font-size: 0.875rem;
  color: var(--gray-700);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 120px;
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-700);
}

.filter-select {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: white;
  color: var(--gray-700);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.clear-filters {
  padding: var(--space-1) var(--space-2);
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-md);
  color: var(--red-600);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clear-filters:hover {
  background: var(--red-100);
  border-color: var(--red-300);
}

.search-results-info {
  margin-top: var(--space-3);
  padding: var(--space-2);
  background: var(--blue-50);
  border: 1px solid var(--blue-200);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--blue-700);
  text-align: center;
}

.history-badge {
  display: inline-flex;
  align-items: center;
  margin-left: var(--space-2);
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: white;
  color: var(--blue-700);
  font-size: 0.75rem;
  font-weight: 600;
}

.remote-search-hint,
.remote-search-error {
  margin-top: var(--space-3);
  padding: var(--space-2);
  border-radius: 999px;
  font-size: 0.8125rem;
  text-align: center;
}

.remote-search-hint {
  background: var(--gray-50);
  color: var(--gray-600);
}

.remote-search-error {
  background: var(--red-50);
  color: var(--red-700);
}

/* 響應式設計 */
@media (max-width: 768px) {
  .search-trigger {
    padding: var(--space-2) 0;
  }
  
  .search-button {
    padding: var(--space-2) var(--space-3);
    font-size: 0.8125rem;
  }

  .search-expanded {
    padding: var(--space-3);
    margin: var(--space-1) 0;
  }

  .search-input-row {
    gap: var(--space-1);
  }

  .search-input {
    font-size: 0.8125rem;
  }

  .close-search {
    width: 28px;
    height: 28px;
  }

  .remote-search-button {
    min-width: auto;
    padding: 0 var(--space-2);
    font-size: 0.75rem;
  }

  .search-filters {
    gap: var(--space-2);
  }

  .filter-group {
    min-width: 80px;
  }

  .filter-select,
  .clear-filters {
    font-size: 0.75rem;
    padding: var(--space-1);
  }
}

@media (max-width: 640px) {
  .search-button {
    font-size: 0.75rem;
    padding: var(--space-1) var(--space-3);
  }

  .search-expanded {
    padding: var(--space-2);
  }

  .search-filters {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .filter-group {
    min-width: auto;
    width: 100%;
  }

  .filter-select {
    width: 100%;
  }
}
</style>
