<!--
  Conversation Filters Component - Collapsible Command Bar

  Collapsed: compact search-style bar with active filter pills + stats
  Expanded: full filter panel with smooth reveal animation
-->
<template>
  <div
    class="conversation-filters"
    :class="{ 'is-expanded': isExpanded }"
  >
    <!-- Collapsed Trigger Bar -->
    <div
      class="filter-trigger"
      @click="toggleExpand"
    >
      <div class="trigger-left">
        <!-- Search Icon -->
        <svg
          class="trigger-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle
            cx="11"
            cy="11"
            r="8"
          />
          <path d="m21 21-4.3-4.3" />
        </svg>

        <!-- Prompt text or active filter pills -->
        <div
          v-if="!hasActiveFilters"
          class="trigger-placeholder"
        >
          搜尋與篩選對話...
        </div>
        <div
          v-else
          class="filter-pills"
        >
          <span
            v-if="filters.customerName?.trim()"
            class="filter-pill"
          >
            <span class="pill-label">客戶</span>
            <span class="pill-value">{{ filters.customerName }}</span>
          </span>
          <span
            v-if="filters.platform"
            class="filter-pill"
          >
            <span class="pill-label">平台</span>
            <span class="pill-value">{{ platformLabels[filters.platform] || filters.platform }}</span>
          </span>
          <span
            v-if="filters.status"
            class="filter-pill"
          >
            <span class="pill-label">狀態</span>
            <span class="pill-value">{{ statusLabels[filters.status] || filters.status }}</span>
          </span>
          <span
            v-if="filters.teamId !== undefined"
            class="filter-pill"
          >
            <span class="pill-label">負責人</span>
            <span class="pill-value">{{ filters.teamId === 0 ? '未指派' : '已指派' }}</span>
          </span>
          <span
            v-if="selectedTagIds.length > 0"
            class="filter-pill"
          >
            <span class="pill-label">標籤</span>
            <span class="pill-value">{{ selectedTagIds.length }} 個</span>
          </span>
          <span
            v-if="filters.updatedAfter || filters.updatedBefore"
            class="filter-pill"
          >
            <span class="pill-label">時間</span>
            <span class="pill-value">{{ activeTimePreset || '自訂' }}</span>
          </span>
          <span
            v-if="filters.lastMessageSearch?.trim()"
            class="filter-pill"
          >
            <span class="pill-label">訊息</span>
            <span class="pill-value">{{ filters.lastMessageSearch }}</span>
          </span>
        </div>
      </div>

      <div class="trigger-right">
        <!-- Active filter badge -->
        <span
          v-if="activeFilterCount > 0"
          class="filter-badge"
          title="清除所有篩選"
          @click.stop="clearAll"
        >
          {{ activeFilterCount }}
          <svg
            class="badge-clear"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>

        <!-- Stats -->
        <div class="trigger-stats">
          <span class="stat-num">{{ totalConversations }}</span>
          <span class="stat-label">對話</span>
        </div>
        <div
          v-if="unreadCount > 0"
          class="trigger-stats unread"
        >
          <span class="stat-num">{{ unreadCount }}</span>
          <span class="stat-label">未讀</span>
        </div>

        <!-- Expand chevron -->
        <svg
          class="trigger-chevron"
          :class="{ rotated: isExpanded }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>

    <!-- Expandable Filter Panel -->
    <div
      class="filter-panel-wrapper"
      :class="{ expanded: isExpanded }"
    >
      <div class="filter-panel">
        <!-- Row 1: Search + Dropdowns -->
        <div class="panel-row">
          <div class="panel-field panel-field--grow">
            <label class="field-label">客戶搜尋</label>
            <input
              ref="customerSearchInput"
              v-model="localCustomerName"
              type="text"
              class="field-input"
              placeholder="輸入客戶名稱..."
            >
          </div>

          <div class="panel-field">
            <label class="field-label">平台</label>
            <select
              :value="filters.platform"
              class="field-select"
              @change="onFilterChange('platform', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">
                全部
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

          <div class="panel-field">
            <label class="field-label">狀態</label>
            <select
              :value="filters.status"
              class="field-select"
              @change="onFilterChange('status', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">
                全部
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

          <div class="panel-field">
            <label class="field-label">負責人</label>
            <select
              :value="filters.teamId ?? ''"
              class="field-select"
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
        </div>

        <!-- Row 2: Tags + Last Message + Time Range -->
        <div class="panel-row">
          <!-- Tag Filter -->
          <div class="panel-field relative">
            <label class="field-label">標籤</label>
            <div class="relative">
              <button
                class="field-tag-btn"
                :class="{ active: selectedTagIds.length > 0 }"
                @click="showTagDropdown = !showTagDropdown"
              >
                <span v-if="selectedTagIds.length === 0">選擇標籤</span>
                <span v-else>已選 {{ selectedTagIds.length }} 個</span>
                <svg
                  class="w-3.5 h-3.5 ml-auto transition-transform duration-200"
                  :class="{ 'rotate-180': showTagDropdown }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <div
                v-if="showTagDropdown"
                class="tag-dropdown"
              >
                <div
                  v-if="availableTags.length === 0"
                  class="tag-dropdown-empty"
                >
                  暫無可用標籤
                </div>
                <div
                  v-for="tag in availableTags"
                  v-else
                  :key="tag.id"
                  class="tag-dropdown-item"
                  :class="{ selected: selectedTagIds.includes(tag.id) }"
                  @click="toggleTag(tag.id)"
                >
                  <div
                    class="tag-dot"
                    :style="{ backgroundColor: tag.color }"
                  />
                  <span class="tag-name">{{ tag.name }}</span>
                  <svg
                    v-if="selectedTagIds.includes(tag.id)"
                    class="tag-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div
                  v-if="selectedTagIds.length > 0"
                  class="tag-dropdown-clear"
                  @click="clearTags"
                >
                  清除標籤篩選
                </div>
              </div>
            </div>
          </div>

          <div class="panel-field panel-field--grow">
            <label class="field-label">最後訊息</label>
            <input
              v-model="localLastMessageSearch"
              type="text"
              class="field-input"
              placeholder="搜尋最後訊息內容..."
            >
          </div>

          <div class="panel-field panel-field--time">
            <label class="field-label">更新時間</label>
            <div class="time-presets">
              <button
                v-for="preset in timePresets"
                :key="preset.label"
                class="time-btn"
                :class="{ active: activeTimePreset === preset.label }"
                @click="applyTimePreset(preset)"
              >
                {{ preset.label }}
              </button>
              <button
                class="time-btn"
                :class="{ active: activeTimePreset === 'custom' }"
                @click="showCustomDateRange = !showCustomDateRange"
              >
                自訂
              </button>
            </div>
          </div>
        </div>

        <!-- Custom Date Range (conditional) -->
        <div
          v-if="showCustomDateRange"
          class="panel-row panel-row--dates"
        >
          <div class="panel-field">
            <label class="field-label">開始日期</label>
            <input
              :value="filters.updatedAfter ? filters.updatedAfter.substring(0, 10) : ''"
              type="date"
              class="field-input"
              @change="onDateChange('updatedAfter', ($event.target as HTMLInputElement).value)"
            >
          </div>
          <div class="panel-field">
            <label class="field-label">結束日期</label>
            <input
              :value="filters.updatedBefore ? filters.updatedBefore.substring(0, 10) : ''"
              type="date"
              class="field-input"
              @change="onDateChange('updatedBefore', ($event.target as HTMLInputElement).value)"
            >
          </div>
          <button
            class="date-clear-btn"
            @click="clearDateRange"
          >
            清除日期
          </button>
        </div>

        <!-- Footer: Clear all -->
        <div
          v-if="hasActiveFilters"
          class="panel-footer"
        >
          <span class="footer-count">{{ activeFilterCount }} 個篩選條件啟用中</span>
          <button
            class="footer-clear"
            @click="clearAll"
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            清除所有
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { ConversationFilters } from '@/types'

export interface Tag {
  id: number
  name: string
  color: string
}

export interface ConversationFiltersProps {
  /** Current filter state */
  filters: ConversationFilters
  /** Available tags for dropdown */
  availableTags?: Tag[]
  /** Total conversation count */
  totalConversations?: number
  /** Unread count */
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

// UI State
const isExpanded = ref(false)
const showTagDropdown = ref(false)
const showCustomDateRange = ref(false)
const activeTimePreset = ref<string | null>(null)
const customerSearchInput = ref<HTMLInputElement | null>(null)

// Debounced local state for text inputs
const localCustomerName = ref(props.filters.customerName || '')
const localLastMessageSearch = ref(props.filters.lastMessageSearch || '')

// Label maps for pills
const platformLabels: Record<string, string> = {
  line: 'LINE',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp'
}

const statusLabels: Record<string, string> = {
  active: '進行中',
  assigned: '已指派',
  pending: '待處理'
}

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

// Toggle expand/collapse
function toggleExpand() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    nextTick(() => {
      customerSearchInput.value?.focus()
    })
  }
}

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

// Close tag dropdown on click outside
function handleClickOutside(e: MouseEvent) {
  if (showTagDropdown.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.panel-field.relative')) {
      showTagDropdown.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

// Cleanup timers and listeners
onUnmounted(() => {
  if (customerNameTimer) {clearTimeout(customerNameTimer)}
  if (lastMessageTimer) {clearTimeout(lastMessageTimer)}
  document.removeEventListener('click', handleClickOutside)
})

function onFilterChange(key: keyof ConversationFilters, value: string | number | undefined) {
  emit('update:filter', key, value || undefined)
}

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

function onDateChange(key: 'updatedAfter' | 'updatedBefore', value: string) {
  activeTimePreset.value = 'custom'
  if (!value) {
    emit('update:filter', key, undefined)
    return
  }
  if (key === 'updatedAfter') {
    emit('update:filter', key, new Date(`${value}T00:00:00`).toISOString())
  } else {
    emit('update:filter', key, new Date(`${value}T23:59:59`).toISOString())
  }
}

function clearDateRange() {
  activeTimePreset.value = null
  showCustomDateRange.value = false
  emit('update:filter', 'updatedAfter', undefined)
  emit('update:filter', 'updatedBefore', undefined)
}

function toggleTag(tagId: number) {
  emit('toggle:tag', tagId)
}

function clearTags() {
  emit('clear:tags')
  showTagDropdown.value = false
}

function clearAll() {
  activeTimePreset.value = null
  showCustomDateRange.value = false
  showTagDropdown.value = false
  localCustomerName.value = ''
  localLastMessageSearch.value = ''
  emit('clear:all')
}
</script>

<style scoped>
@reference "../../style.css";
/* ─── Container ─── */
.conversation-filters {
  @apply bg-white border-b border-gray-100;
}

/* ─── Collapsed Trigger Bar ─── */
.filter-trigger {
  @apply flex items-center gap-3 px-5 py-3 cursor-pointer select-none;
  @apply transition-colors duration-200;
}

.filter-trigger:hover {
  @apply bg-gray-50/70;
}

.is-expanded .filter-trigger {
  @apply bg-gray-50/50 border-b border-gray-100;
}

.trigger-left {
  @apply flex items-center gap-3 flex-1 min-w-0;
}

.trigger-icon {
  @apply text-gray-400 flex-shrink-0;
  width: 18px;
  height: 18px;
}

.is-expanded .trigger-icon {
  @apply text-primary-500;
}

.trigger-placeholder {
  @apply text-sm text-gray-400 truncate;
}

/* ─── Filter Pills (collapsed summary) ─── */
.filter-pills {
  @apply flex items-center gap-1.5 flex-wrap min-w-0;
}

.filter-pill {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs;
  @apply bg-primary-50 text-primary-700 border border-primary-100;
  max-width: 160px;
}

.pill-label {
  @apply text-primary-400 font-medium flex-shrink-0;
}

.pill-value {
  @apply truncate font-medium;
}

/* ─── Trigger Right Side ─── */
.trigger-right {
  @apply flex items-center gap-3 flex-shrink-0;
}

.filter-badge {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold;
  @apply bg-primary-600 text-white cursor-pointer;
  @apply transition-all duration-200;
}

.filter-badge:hover {
  @apply bg-danger-500;
}

.badge-clear {
  @apply w-3 h-3 opacity-0;
  @apply transition-opacity duration-150;
}

.filter-badge:hover .badge-clear {
  @apply opacity-100;
}

.trigger-stats {
  @apply flex items-baseline gap-1;
}

.stat-num {
  @apply text-sm font-bold text-gray-700 tabular-nums;
}

.stat-label {
  @apply text-xs text-gray-400;
}

.trigger-stats.unread .stat-num {
  @apply text-primary-600;
}

.trigger-chevron {
  @apply w-4 h-4 text-gray-400 flex-shrink-0;
  @apply transition-transform duration-300 ease-out;
}

.trigger-chevron.rotated {
  transform: rotate(180deg);
}

/* ─── Expandable Panel (CSS grid collapse) ─── */
.filter-panel-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.25s ease;
  opacity: 0;
}

.filter-panel-wrapper.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
}

.filter-panel {
  overflow: hidden;
  @apply px-5 pt-4 pb-3;
  @apply bg-gradient-to-b from-gray-50/80 to-white;
}

/* Allow dropdowns to overflow once the panel is fully expanded */
.filter-panel-wrapper.expanded .filter-panel {
  overflow: visible;
}

/* ─── Panel Rows ─── */
.panel-row {
  @apply flex flex-col items-stretch gap-3 mb-3;
  @apply md:flex-row md:items-end;
}

.panel-row--dates {
  @apply md:items-end;
}

/* ─── Panel Fields ─── */
.panel-field {
  @apply flex flex-col gap-1 min-w-0 w-full;
  @apply md:w-auto;
}

.panel-field--grow {
  @apply flex-1;
}

.panel-field--time {
  @apply flex-shrink-0;
}

.field-label {
  @apply text-[11px] font-semibold text-gray-500 uppercase tracking-widest;
}

.field-input {
  @apply h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800;
  @apply transition-all duration-200 outline-hidden;
}

.field-input:focus {
  @apply border-primary-400 ring-2 ring-primary-100 bg-white;
}

.field-input::placeholder {
  @apply text-gray-400;
}

.field-select {
  @apply h-9 px-3 pr-8 bg-white border border-gray-200 rounded-lg text-sm text-gray-700;
  @apply transition-all duration-200 outline-hidden cursor-pointer appearance-none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.25em 1.25em;
}

.field-select:focus {
  @apply border-primary-400 ring-2 ring-primary-100;
}

/* ─── Tag Filter ─── */
.field-tag-btn {
  @apply flex items-center gap-2 h-9 px-3 bg-white border border-gray-200;
  @apply rounded-lg text-sm text-gray-600 cursor-pointer transition-all duration-200;
  min-width: 120px;
}

.field-tag-btn:hover {
  @apply border-primary-400 text-primary-600;
}

.field-tag-btn.active {
  @apply bg-primary-50 border-primary-400 text-primary-600;
}

.tag-dropdown {
  @apply absolute z-50 min-w-[220px] max-h-[280px] overflow-y-auto;
  @apply bg-white border border-gray-200 rounded-xl shadow-lg;
  top: calc(100% + 6px);
  left: 0;
  animation: dropdown-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dropdown-pop {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tag-dropdown-empty {
  @apply py-6 text-center text-gray-400 text-sm;
}

.tag-dropdown-item {
  @apply flex items-center gap-3 py-2.5 px-4 cursor-pointer;
  @apply transition-colors duration-150;
}

.tag-dropdown-item:hover {
  @apply bg-gray-50;
}

.tag-dropdown-item.selected {
  @apply bg-primary-50;
}

.tag-dot {
  @apply w-2.5 h-2.5 rounded-full flex-shrink-0;
}

.tag-name {
  @apply flex-1 text-sm text-gray-700;
}

.tag-check {
  @apply w-4 h-4 text-primary-600 flex-shrink-0;
}

.tag-dropdown-clear {
  @apply py-2.5 px-4 text-center text-danger-500 text-xs font-medium cursor-pointer;
  @apply border-t border-gray-100 transition-colors duration-150;
}

.tag-dropdown-clear:hover {
  @apply bg-danger-50;
}

/* ─── Time Presets ─── */
.time-presets {
  @apply flex items-center gap-1.5;
}

.time-btn {
  @apply h-9 px-3 text-xs font-medium rounded-lg border border-gray-200;
  @apply bg-white text-gray-600 cursor-pointer transition-all duration-200;
}

.time-btn:hover {
  @apply border-primary-400 text-primary-600;
}

.time-btn.active {
  @apply bg-primary-50 border-primary-500 text-primary-600;
}

/* ─── Date Clear ─── */
.date-clear-btn {
  @apply self-end h-9 px-3 text-xs text-danger-500 font-medium;
  @apply rounded-lg border border-transparent cursor-pointer;
  @apply transition-colors duration-200;
}

.date-clear-btn:hover {
  @apply text-danger-600 bg-danger-50 border-danger-100;
}

/* ─── Panel Footer ─── */
.panel-footer {
  @apply flex items-center justify-between pt-3 mt-1 border-t border-gray-100;
}

.footer-count {
  @apply text-xs text-gray-400;
}

.footer-clear {
  @apply inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium;
  @apply text-danger-500 rounded-lg cursor-pointer;
  @apply transition-all duration-200;
}

.footer-clear:hover {
  @apply bg-danger-50 text-danger-600;
}

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .filter-trigger {
    @apply px-4 py-2.5;
  }

  .filter-panel {
    @apply px-4;
  }

  .filter-pills {
    @apply hidden;
  }

  .time-presets {
    @apply flex-wrap;
  }
}

@media (max-width: 480px) {
  .trigger-stats {
    @apply hidden;
  }

  .panel-row--dates {
    @apply flex-col items-stretch;
  }

  .date-clear-btn {
    @apply self-start;
  }
}
</style>
