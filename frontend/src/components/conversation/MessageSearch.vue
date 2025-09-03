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
            placeholder="搜索消息內容..."
            class="search-input"
            @input="handleSearch"
            @keydown="handleKeydown"
          >
          <button
            v-if="searchQuery"
            class="clear-button"
            @click="clearSearch"
          >
            <XIcon />
          </button>
        </div>
        
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { SearchIcon, XIcon } from '@/components/icons'
import type { Message } from '@/types'

interface SearchFilters {
  messageType: string
  senderType: string  
  dateRange: string
}

interface Props {
  messages: Message[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'search-results': [results: Message[]]
  'search-clear': []
}>()

// 狀態
const isExpanded = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement>()

const filters = ref<SearchFilters>({
  messageType: '',
  senderType: '',
  dateRange: ''
})

// 計算屬性
const hasActiveFilters = computed(() => {
  return filters.value.messageType || filters.value.senderType || filters.value.dateRange
})

const searchResults = computed(() => {
  if (!searchQuery.value.trim() && !hasActiveFilters.value) {
    return []
  }

  return props.messages.filter(message => {
    // 文本搜索
    const matchesText = !searchQuery.value.trim() || 
      message.content.toLowerCase().includes(searchQuery.value.toLowerCase())

    // 消息類型過濾
    const matchesType = !filters.value.messageType || 
      message.messageType === filters.value.messageType

    // 發送者類型過濾
    const matchesSender = !filters.value.senderType || 
      message.senderType === filters.value.senderType

    // 日期範圍過濾
    const matchesDate = matchesDateRange(message)

    return matchesText && matchesType && matchesSender && matchesDate
  })
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

const handleSearch = () => {
  emit('search-results', searchResults.value)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
  }
}

const clearSearch = () => {
  searchQuery.value = ''
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
  clearFilters()
  emit('search-clear')
}

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
  margin-bottom: var(--space-4);
}

.search-trigger {
  display: flex;
  justify-content: center;
}

.search-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--gray-100);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  color: var(--gray-600);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.search-button:hover {
  background: var(--gray-200);
  color: var(--gray-800);
}

.search-expanded {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
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

/* 響應式設計 */
@media (max-width: 768px) {
  .search-expanded {
    padding: var(--space-3);
  }

  .search-filters {
    gap: var(--space-2);
  }

  .filter-group {
    min-width: 100px;
  }

  .filter-select,
  .clear-filters {
    font-size: 0.8125rem;
  }
}

@media (max-width: 640px) {
  .search-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    min-width: auto;
  }
}
</style>