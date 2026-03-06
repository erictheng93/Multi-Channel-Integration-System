<!--
  Conversation Filters Component - v2 Two-Row Layout

  對話列表篩選器組件 — 雙排佈局版

  Row 1: 客戶搜尋、平台、狀態、負責人、標籤
  Row 2: 最後訊息搜尋、更新時間（快捷+自訂）、統計數據
-->
<template>
  <div class="conversation-filters">
    <!-- Row 1: Primary filters -->
    <div class="filter-row">
      <div class="filter-group flex-1">
        <!-- Customer Name Search -->
        <div class="filter-item filter-search">
          <label class="filter-label">客戶搜尋</label>
          <input
            v-model="localCustomerName"
            type="text"
            class="filter-input"
            placeholder="輸入客戶名稱..."
          >
        </div>

        <!-- Platform Filter -->
        <div class="filter-item">
          <label class="filter-label">平台篩選</label>
          <select
            :value="filters.platform"
            class="form-select"
            @change="onFilterChange('platform', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              所有平台
            </option>
            <option value="line">
              LINE
            </option>
            <option value="facebook">
              Facebook
            </option>
            <option value="instagram">
              Instagram
            </option>
            <option value="whatsapp">
              WhatsApp
            </option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="filter-item">
          <label class="filter-label">狀態篩選</label>
          <select
            :value="filters.status"
            class="form-select"
            @change="onFilterChange('status', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              所有狀態
            </option>
            <option value="active">
              進行中
            </option>
            <option value="assigned">
              已指派
            </option>
            <option value="pending">
              待處理
            </option>
          </select>
        </div>

        <!-- Team Filter (renamed to 負責人) -->
        <div class="filter-item">
          <label class="filter-label">負責人</label>
          <select
            :value="filters.teamId || ''"
            class="form-select"
            @change="onFilterChange('teamId', ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
          >
            <option value="">
              全部
            </option>
            <option value="0">
              未指派
            </option>
          </select>
        </div>

        <!-- Tag Filter -->
        <div class="filter-item relative">
          <label class="filter-label">標籤篩選</label>
          <div class="relative">
            <button
              class="tag-filter-btn"
              :class="{ 'has-selection': selectedTagIds.length > 0 }"
              @click="showTagDropdown = !showTagDropdown"
            >
              <span v-if="selectedTagIds.length === 0">選擇標籤</span>
              <span v-else>已選 {{ selectedTagIds.length }} 個</span>
              <svg
                class="w-4 h-4 ml-auto transition-transform duration-200"
                :class="{ 'rotate-180': showTagDropdown }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <!-- Tag dropdown -->
            <div
              v-if="showTagDropdown"
              class="tag-filter-dropdown"
            >
              <div
                v-if="availableTags.length === 0"
                class="p-4 text-center text-gray-500 text-sm"
              >
                暫無可用標籤
              </div>
              <div
                v-for="tag in availableTags"
                v-else
                :key="tag.id"
                class="flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors hover:bg-gray-50"
                :class="{ 'bg-primary-50': selectedTagIds.includes(tag.id) }"
                @click="toggleTag(tag.id)"
              >
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: tag.color }"
                />
                <span class="flex-1 text-sm text-gray-800">{{ tag.name }}</span>
                <svg
                  v-if="selectedTagIds.includes(tag.id)"
                  class="w-4 h-4 text-primary-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div
                v-if="selectedTagIds.length > 0"
                class="py-3 px-4 text-center text-red-600 text-sm cursor-pointer border-t border-gray-200 hover:bg-red-50 transition-colors"
                @click="clearTags"
              >
                清除篩選
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Advanced filters -->
    <div class="filter-row mt-3">
      <div class="filter-group flex-1">
        <!-- Last Message Search -->
        <div class="filter-item filter-search">
          <label class="filter-label">最後訊息</label>
          <input
            v-model="localLastMessageSearch"
            type="text"
            class="filter-input"
            placeholder="搜尋最後訊息內容..."
          >
        </div>

        <!-- Update Time Range -->
        <div class="filter-item">
          <label class="filter-label">更新時間</label>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="preset in timePresets"
              :key="preset.label"
              class="time-preset-btn"
              :class="{ active: activeTimePreset === preset.label }"
              @click="applyTimePreset(preset)"
            >
              {{ preset.label }}
            </button>
            <button
              class="time-preset-btn"
              :class="{ active: activeTimePreset === 'custom' }"
              @click="showCustomDateRange = !showCustomDateRange"
            >
              自訂
            </button>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="flex gap-6 items-center flex-shrink-0 lg:justify-center sm:flex-col sm:gap-3">
        <div class="flex flex-col items-center text-center">
          <span class="text-2xl font-bold text-primary-600 leading-none">{{ totalConversations }}</span>
          <span class="text-xs text-gray-600 font-medium mt-1">總對話</span>
        </div>
        <div class="flex flex-col items-center text-center">
          <span class="text-2xl font-bold text-primary-600 leading-none">{{ unreadCount }}</span>
          <span class="text-xs text-gray-600 font-medium mt-1">未讀</span>
        </div>
      </div>
    </div>

    <!-- Custom Date Range Picker (collapsible) -->
    <div
      v-if="showCustomDateRange"
      class="filter-row mt-3"
    >
      <div class="filter-group">
        <div class="filter-item">
          <label class="filter-label">開始日期</label>
          <input
            :value="filters.updatedAfter ? filters.updatedAfter.substring(0, 10) : ''"
            type="date"
            class="form-select"
            @change="onDateChange('updatedAfter', ($event.target as HTMLInputElement).value)"
          >
        </div>
        <div class="filter-item">
          <label class="filter-label">結束日期</label>
          <input
            :value="filters.updatedBefore ? filters.updatedBefore.substring(0, 10) : ''"
            type="date"
            class="form-select"
            @change="onDateChange('updatedBefore', ($event.target as HTMLInputElement).value)"
          >
        </div>
        <button
          class="text-sm text-red-500 hover:text-red-700 self-end pb-2"
          @click="clearDateRange"
        >
          清除日期
        </button>
      </div>
    </div>

    <!-- Active Filters Summary + Clear All -->
    <div
      v-if="hasActiveFilters"
      class="mt-3 flex items-center gap-2"
    >
      <span class="text-xs text-gray-500">{{ activeFilterCount }} 個篩選條件</span>
      <button
        class="text-xs text-red-500 hover:text-red-700 hover:underline"
        @click="clearAll"
      >
        清除所有篩選
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { ConversationFilters } from '@/types'

export interface Tag {
  id: number
  name: string
  color: string
}

export interface ConversationFiltersProps {
  /** 篩選條件 */
  filters: ConversationFilters
  /** 可用標籤列表 */
  availableTags?: Tag[]
  /** 總對話數 */
  totalConversations?: number
  /** 未讀數 */
  unreadCount?: number
}

const props = withDefaults(defineProps<ConversationFiltersProps>(), {
  totalConversations: 0,
  unreadCount: 0,
  availableTags: () => []
})

const emit = defineEmits<{
  'update:filter': [key: keyof ConversationFilters, value: string | number | undefined]
  'update:tag-filter': [tagIds: number[]]
  'toggle:tag': [tagId: number]
  'clear:tags': []
  'clear:all': []
}>()

// State
const showTagDropdown = ref(false)
const showCustomDateRange = ref(false)
const activeTimePreset = ref<string | null>(null)

// Debounced local state for text inputs
const localCustomerName = ref(props.filters.customerName || '')
const localLastMessageSearch = ref(props.filters.lastMessageSearch || '')

// Time presets
const timePresets = [
  { label: '今天', daysAgo: 0 },
  { label: '近7天', daysAgo: 7 },
  { label: '近30天', daysAgo: 30 }
]

// Computed
const selectedTagIds = computed(() => props.filters.tagIds || [])

const hasActiveFilters = computed(() => {
  return (
    (props.filters.status !== '' && props.filters.status !== undefined) ||
    (props.filters.platform !== '' && props.filters.platform !== undefined) ||
    props.filters.teamId !== undefined ||
    (props.filters.tagIds !== undefined && props.filters.tagIds.length > 0) ||
    (props.filters.customerName !== undefined && props.filters.customerName.trim() !== '') ||
    (props.filters.lastMessageSearch !== undefined && props.filters.lastMessageSearch.trim() !== '') ||
    (props.filters.updatedAfter !== undefined && props.filters.updatedAfter !== '') ||
    (props.filters.updatedBefore !== undefined && props.filters.updatedBefore !== '')
  )
})

const activeFilterCount = computed(() => {
  let count = 0
  if (props.filters.status) {count++}
  if (props.filters.platform) {count++}
  if (props.filters.teamId !== undefined) {count++}
  if (props.filters.tagIds && props.filters.tagIds.length > 0) {count++}
  if (props.filters.customerName?.trim()) {count++}
  if (props.filters.lastMessageSearch?.trim()) {count++}
  if (props.filters.updatedAfter || props.filters.updatedBefore) {count++}
  return count
})

// Debounce timers
let customerNameTimer: ReturnType<typeof setTimeout> | null = null
let lastMessageTimer: ReturnType<typeof setTimeout> | null = null

// Watch local text inputs with debounce
watch(localCustomerName, (val) => {
  if (customerNameTimer) {clearTimeout(customerNameTimer)}
  customerNameTimer = setTimeout(() => {
    emit('update:filter', 'customerName', val.trim() || undefined)
  }, 300)
})

watch(localLastMessageSearch, (val) => {
  if (lastMessageTimer) {clearTimeout(lastMessageTimer)}
  lastMessageTimer = setTimeout(() => {
    emit('update:filter', 'lastMessageSearch', val.trim() || undefined)
  }, 300)
})

// Sync from parent when filters are cleared externally
watch(() => props.filters.customerName, (val) => {
  if ((val || '') !== localCustomerName.value) {
    localCustomerName.value = val || ''
  }
})

watch(() => props.filters.lastMessageSearch, (val) => {
  if ((val || '') !== localLastMessageSearch.value) {
    localLastMessageSearch.value = val || ''
  }
})

// Cleanup timers
onUnmounted(() => {
  if (customerNameTimer) {clearTimeout(customerNameTimer)}
  if (lastMessageTimer) {clearTimeout(lastMessageTimer)}
})

/**
 * 處理篩選變化 (non-text inputs)
 */
function onFilterChange(key: keyof ConversationFilters, value: string | number | undefined) {
  emit('update:filter', key, value || undefined)
}

/**
 * 套用時間快捷選項
 */
function applyTimePreset(preset: { label: string; daysAgo: number }) {
  activeTimePreset.value = preset.label
  showCustomDateRange.value = false

  const now = new Date()
  if (preset.daysAgo === 0) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    emit('update:filter', 'updatedAfter', startOfToday.toISOString())
  } else {
    const daysAgo = new Date(now.getTime() - preset.daysAgo * 24 * 60 * 60 * 1000)
    emit('update:filter', 'updatedAfter', daysAgo.toISOString())
  }
  emit('update:filter', 'updatedBefore', undefined)
}

/**
 * 處理自訂日期變化
 */
function onDateChange(key: 'updatedAfter' | 'updatedBefore', value: string) {
  activeTimePreset.value = 'custom'
  if (!value) {
    emit('update:filter', key, undefined)
    return
  }
  if (key === 'updatedAfter') {
    emit('update:filter', key, new Date(`${value  }T00:00:00`).toISOString())
  } else {
    emit('update:filter', key, new Date(`${value  }T23:59:59`).toISOString())
  }
}

/**
 * 清除日期範圍
 */
function clearDateRange() {
  activeTimePreset.value = null
  showCustomDateRange.value = false
  emit('update:filter', 'updatedAfter', undefined)
  emit('update:filter', 'updatedBefore', undefined)
}

/**
 * 切換標籤
 */
function toggleTag(tagId: number) {
  emit('toggle:tag', tagId)
}

/**
 * 清除標籤篩選
 */
function clearTags() {
  emit('clear:tags')
  showTagDropdown.value = false
}

/**
 * 清除所有篩選
 */
function clearAll() {
  activeTimePreset.value = null
  showCustomDateRange.value = false
  localCustomerName.value = ''
  localLastMessageSearch.value = ''
  emit('clear:all')
}
</script>

<style scoped>
.conversation-filters {
  @apply px-6 py-4 bg-white;
}

.filter-row {
  @apply flex items-end gap-6 lg:flex-col lg:items-stretch lg:gap-4;
}

.filter-group {
  @apply flex gap-4 md:flex-col md:gap-3 flex-wrap items-end;
}

.filter-item {
  @apply flex flex-col gap-1 md:w-full;
}

.filter-label {
  @apply text-xs font-medium text-gray-700 uppercase tracking-wider;
}

.filter-search {
  @apply min-w-[160px];
}

.filter-input {
  @apply py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800;
  @apply transition-all outline-none;
}

.filter-input:focus {
  @apply border-primary-600 ring-2 ring-primary-100;
}

.filter-input::placeholder {
  @apply text-gray-400;
}

/* Time preset buttons */
.time-preset-btn {
  @apply px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200;
  @apply bg-white text-gray-600 cursor-pointer transition-all;
}

.time-preset-btn:hover {
  @apply border-primary-400 text-primary-600;
}

.time-preset-btn.active {
  @apply bg-primary-50 border-primary-600 text-primary-600;
}

/* Tag Filter Button */
.tag-filter-btn {
  @apply flex items-center gap-2 py-2 px-3 bg-white border border-gray-200;
  @apply rounded-lg text-sm text-gray-600 cursor-pointer transition-all min-w-[120px];
}

.tag-filter-btn:hover {
  @apply border-primary-600 text-primary-600;
}

.tag-filter-btn.has-selection {
  @apply bg-primary-50 border-primary-600 text-primary-600;
}

/* Tag Filter Dropdown */
.tag-filter-dropdown {
  @apply absolute z-50 min-w-[200px] max-h-[300px] overflow-y-auto;
  @apply bg-white border border-gray-200 rounded-xl shadow-xl;
  top: calc(100% + 0.5rem);
  left: 0;
  animation: dropdown-appear 0.2s ease-out;
}

@keyframes dropdown-appear {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
