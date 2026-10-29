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
            <label
              class="field-label"
              for="conv-filter-platform"
            >平台</label>
            <select
              id="conv-filter-platform"
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
            <label
              class="field-label"
              for="conv-filter-status"
            >狀態</label>
            <select
              id="conv-filter-status"
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
            <label
              class="field-label"
              for="conv-filter-team"
            >負責人</label>
            <select
              id="conv-filter-team"
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
  pending: '待處理',
  closed: '已結案'
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
/* Search well + collapsible filter panel, restyled with --ui-* tokens (behaviour unchanged) */
.conversation-filters {
  min-width: 0;
}

.filter-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: var(--ui-r-control);
  background: var(--ui-surface-2);
  box-shadow: inset 0 0 0 0.5px var(--ui-sep);
  cursor: pointer;
  user-select: none;
  transition: box-shadow var(--ui-dur) var(--ui-ease), background var(--ui-dur) var(--ui-ease);
}

.filter-trigger:hover {
  background: color-mix(in srgb, var(--ui-fill) 55%, var(--ui-surface-2));
}

.is-expanded .filter-trigger {
  background: var(--ui-surface);
  box-shadow: inset 0 0 0 1px var(--ui-accent), 0 0 0 4px var(--ui-accent-soft);
}

.trigger-left {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.trigger-icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--ui-faint);
}

.is-expanded .trigger-icon {
  color: var(--ui-accent);
}

.trigger-placeholder {
  overflow: hidden;
  font-size: 14px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  padding: 6px 0;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 180px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
  font-size: 12px;
}

.pill-label {
  flex: none;
  font-weight: 500;
  opacity: 0.75;
}

.pill-value {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-right {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--ui-ink);
  color: var(--ui-surface);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.badge-clear {
  width: 10px;
  height: 10px;
}

.trigger-stats {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 12.5px;
  color: var(--ui-muted);
}

.trigger-stats .stat-num {
  font-weight: 700;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.trigger-stats.unread .stat-num {
  color: var(--ui-accent);
}

.trigger-chevron {
  width: 16px;
  height: 16px;
  color: var(--ui-faint);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.trigger-chevron.rotated {
  transform: rotate(180deg);
}

/* Expandable panel */
.filter-panel-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.3s var(--ui-ease), opacity 0.25s ease;
}

.filter-panel-wrapper.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
}

.filter-panel {
  min-height: 0;
  padding: 0 2px;
  overflow: hidden;
}

.filter-panel-wrapper.expanded .filter-panel {
  padding-top: 14px;
  overflow: visible;
}

.panel-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.panel-field--grow {
  flex: 1;
}

.panel-field--time {
  flex: none;
}

.relative {
  position: relative;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.field-input,
.field-select,
.field-tag-btn {
  display: flex;
  align-items: center;
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--ui-r-control);
  background: var(--ui-surface-2);
  box-shadow: inset 0 0 0 0.5px var(--ui-sep);
  font-size: 13.5px;
  color: var(--ui-ink);
  transition: box-shadow var(--ui-dur) var(--ui-ease), background var(--ui-dur) var(--ui-ease);
}

.field-select {
  padding-right: 30px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}

.field-input::placeholder {
  color: var(--ui-faint);
}

.field-input:focus,
.field-select:focus,
.field-tag-btn:focus-visible {
  outline: none;
  background-color: var(--ui-surface);
  box-shadow: inset 0 0 0 1px var(--ui-accent), 0 0 0 4px var(--ui-accent-soft);
}

.field-tag-btn {
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.field-tag-btn.active {
  color: var(--ui-accent);
  font-weight: 600;
}

.field-tag-btn svg {
  flex: none;
  width: 14px;
  height: 14px;
  margin-left: auto;
  transition: transform var(--ui-dur) var(--ui-ease);
}

.field-tag-btn svg.rotate-180 {
  transform: rotate(180deg);
}

.tag-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 50;
  min-width: 220px;
  max-height: 280px;
  padding: 6px;
  overflow-y: auto;
  border-radius: 14px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
  animation: dropdown-pop 0.2s var(--ui-ease);
}

.tag-dropdown-empty,
.tag-dropdown-clear {
  padding: 9px 12px;
  font-size: 13px;
  color: var(--ui-muted);
}

.tag-dropdown-clear {
  cursor: pointer;
  color: var(--ui-accent);
  font-weight: 600;
}

.tag-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--ui-ink-2);
  cursor: pointer;
}

.tag-dropdown-item:hover {
  background: var(--ui-fill);
}

.tag-dropdown-item.selected {
  color: var(--ui-ink);
  font-weight: 600;
}

.tag-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.tag-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-check {
  width: 14px;
  height: 14px;
  color: var(--ui-accent);
}

@keyframes dropdown-pop {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

/* Time presets: capsule segment */
.time-presets {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  width: fit-content;
  padding: 2px;
  border-radius: 10px;
  background: var(--ui-fill);
}

.time-btn {
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
  white-space: nowrap;
  cursor: pointer;
}

.time-btn.active {
  background: var(--ui-sel-bg);
  color: var(--ui-ink);
  font-weight: 600;
  box-shadow: var(--ui-shadow-pill);
}

.date-clear-btn {
  align-self: flex-start;
  height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
  cursor: pointer;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 2px;
}

.footer-count {
  font-size: 12.5px;
  color: var(--ui-muted);
}

.footer-clear {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ui-red-ink);
  cursor: pointer;
}

.footer-clear svg {
  width: 13px;
  height: 13px;
}

@media (min-width: 769px) {
  .panel-row {
    flex-direction: row;
    align-items: flex-end;
  }

  .panel-field {
    width: auto;
  }
}

@media (max-width: 480px) {
  .trigger-stats {
    display: none;
  }
}
</style>
