<template>
  <section
    class="rf"
    aria-label="篩選報表"
  >
    <div class="rf-bar">
      <div class="rf-search">
        <svg
          class="rf-search-ico"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><circle
          cx="11"
          cy="11"
          r="7"
        /><path d="m21 21-4.3-4.3" /></svg>
        <input
          id="rf-q"
          :value="searchQuery"
          type="search"
          class="ui-input rf-search-input"
          placeholder="搜尋報表標題"
          aria-label="搜尋報表標題"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </div>

      <div
        ref="wrap"
        class="rf-pop"
      >
        <button
          type="button"
          class="btn btn-secondary rf-btn"
          :aria-expanded="open"
          aria-controls="rf-panel"
          @click="open = !open"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          篩選
          <span
            v-if="activeCount > 0"
            class="rf-count"
          >{{ activeCount }}</span>
        </button>

        <div
          v-if="open"
          class="rf-backdrop"
          aria-hidden="true"
          @click="open = false"
        />
        <div
          v-if="open"
          id="rf-panel"
          class="rf-panel"
          role="dialog"
          aria-label="篩選條件"
        >
          <div class="rf-grip" />
          <div class="rf-grid">
            <div class="ui-field">
              <label for="rf-type">報表類型</label>
              <select
                id="rf-type"
                :value="filters.type"
                class="ui-select"
                @change="handleFilterChange('type', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">
                  全部類型
                </option>
                <optgroup
                  v-for="group in groupedReportTypes"
                  :key="group.category"
                  :label="group.title"
                >
                  <option
                    v-for="type in group.types"
                    :key="type.value"
                    :value="type.value"
                  >
                    {{ type.label }}
                  </option>
                </optgroup>
              </select>
            </div>

            <div class="ui-field">
              <label for="rf-status">狀態</label>
              <select
                id="rf-status"
                :value="filters.status"
                class="ui-select"
                @change="handleFilterChange('status', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">
                  全部狀態
                </option>
                <option
                  v-for="(label, value) in STATUS_LABELS"
                  :key="value"
                  :value="value"
                >
                  {{ label }}
                </option>
              </select>
            </div>

            <div class="ui-field">
              <label for="rf-format">格式</label>
              <select
                id="rf-format"
                :value="filters.format"
                class="ui-select"
                @change="handleFilterChange('format', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">
                  全部格式
                </option>
                <option value="json">
                  JSON
                </option>
                <option value="csv">
                  CSV
                </option>
              </select>
            </div>
          </div>

          <div class="rf-range">
            <span
              id="rf-range-label"
              class="rf-range-label"
            >建立時間</span>
            <div
              class="rf-presets"
              role="group"
              aria-labelledby="rf-range-label"
            >
              <button
                v-for="preset in PRESETS"
                :key="preset.key"
                type="button"
                class="ui-chip"
                :aria-pressed="range === preset.key"
                @click="pickPreset(preset.key)"
              >
                {{ preset.label }}
              </button>
              <button
                type="button"
                class="ui-chip"
                :aria-pressed="range === 'custom'"
                @click="pickCustom"
              >
                自訂
              </button>
            </div>
            <div
              v-if="range === 'custom'"
              class="rf-dates"
            >
              <input
                :value="filters.startDate"
                type="date"
                class="ui-input"
                aria-label="建立時間開始"
                @change="handleFilterChange('startDate', ($event.target as HTMLInputElement).value)"
              >
              <span class="rf-to">至</span>
              <input
                :value="filters.endDate"
                type="date"
                class="ui-input"
                aria-label="建立時間結束"
                @change="handleFilterChange('endDate', ($event.target as HTMLInputElement).value)"
              >
            </div>
          </div>

          <div class="rf-foot">
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="!hasActiveFilters"
              @click="$emit('reset-filters')"
            >
              重設
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="open = false"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>

    <ul
      v-if="chips.length > 0"
      class="rf-chips"
      aria-label="目前篩選條件"
    >
      <li
        v-for="chip in chips"
        :key="chip.key"
      >
        <button
          type="button"
          class="ui-chip rf-chip"
          :aria-label="`移除篩選：${chip.label}`"
          @click="chip.remove()"
        >
          {{ chip.label }}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            aria-hidden="true"
          ><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </li>
      <li>
        <button
          type="button"
          class="ui-link rf-clear"
          @click="$emit('reset-filters')"
        >
          清除全部
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/**
 * FiltersSection Component
 *
 * Search field plus one 篩選 button. The button opens the full filter set as a popover on
 * desktop and a bottom sheet on phones; active filters are echoed as removable chips.
 *
 * @emits update:filters - 筛选条件更新
 * @emits update:searchQuery - 搜索关键词更新
 * @emits reset-filters - 重置所有筛选
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ReportListQuery, ReportType } from '@/types/reports'

export interface FiltersSectionProps {
  /** 筛选条件 */
  filters: ReportListQuery
  /** 搜索关键词 */
  searchQuery: string
  /** 是否有活动的筛选条件 */
  hasActiveFilters: boolean
  /** 分组的报表类型 */
  groupedReportTypes: Array<{
    category: string
    title: string
    types: Array<{ value: string; label: string }>
  }>
  /** 获取报表类型图标的方法 */
  getReportTypeIcon: (_type: ReportType) => string
}

const props = defineProps<FiltersSectionProps>()

const emit = defineEmits<{
  'update:filters': [filters: ReportListQuery]
  'update:searchQuery': [query: string]
  'reset-filters': []
}>()

const STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  generating: '生成中',
  completed: '已完成',
  failed: '失敗',
  expired: '已過期'
}

type RangeKey = 'all' | 'today' | '7d' | '30d' | 'custom'
const PRESETS: Array<{ key: Exclude<RangeKey, 'custom'>; label: string; days: number | null }> = [
  { key: 'all', label: '全部時間', days: null },
  { key: 'today', label: '今天', days: 1 },
  { key: '7d', label: '近 7 天', days: 7 },
  { key: '30d', label: '近 30 天', days: 30 }
]

const open = ref(false)
const customPicked = ref(false)
const wrap = ref<HTMLElement | null>(null)

function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function presetDates(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  return { start: toIso(start), end: toIso(end) }
}

const range = computed<RangeKey>(() => {
  const { startDate, endDate } = props.filters
  if (!startDate && !endDate) {
    return customPicked.value ? 'custom' : 'all'
  }
  for (const preset of PRESETS) {
    if (preset.days === null) { continue }
    const dates = presetDates(preset.days)
    if (startDate === dates.start && endDate === dates.end) { return preset.key }
  }
  return 'custom'
})

function emitFilters(patch: Partial<Record<keyof ReportListQuery, string | undefined>>) {
  emit('update:filters', { ...props.filters, ...patch } as ReportListQuery)
}

function pickPreset(key: Exclude<RangeKey, 'custom'>) {
  customPicked.value = false
  const preset = PRESETS.find(item => item.key === key)
  if (!preset || preset.days === null) {
    emitFilters({ startDate: undefined, endDate: undefined })
    return
  }
  const dates = presetDates(preset.days)
  emitFilters({ startDate: dates.start, endDate: dates.end })
}

function pickCustom() {
  customPicked.value = true
}

function handleFilterChange(key: keyof ReportListQuery, value: string) {
  emitFilters({ [key]: value === '' ? undefined : value })
}

const activeCount = computed(() => {
  let n = 0
  if (props.filters.type) { n++ }
  if (props.filters.status) { n++ }
  if (props.filters.format) { n++ }
  if (props.filters.startDate || props.filters.endDate) { n++ }
  return n
})

function shortDate(iso: string): string {
  return iso.slice(5).replace('-', '/')
}

const chips = computed(() => {
  const list: Array<{ key: string; label: string; remove: () => void }> = []
  const { type, status, format, startDate, endDate } = props.filters
  if (type) {
    const label = props.groupedReportTypes.flatMap(g => g.types).find(t => t.value === type)?.label ?? String(type)
    list.push({ key: 'type', label, remove: () => emitFilters({ type: undefined }) })
  }
  if (status) {
    list.push({ key: 'status', label: STATUS_LABELS[String(status)] ?? String(status), remove: () => emitFilters({ status: undefined }) })
  }
  if (format) {
    list.push({ key: 'format', label: String(format).toUpperCase(), remove: () => emitFilters({ format: undefined }) })
  }
  if (startDate || endDate) {
    const preset = PRESETS.find(p => p.key === range.value)
    const label = preset ? preset.label : `${startDate ? shortDate(startDate) : '…'} – ${endDate ? shortDate(endDate) : '…'}`
    list.push({
      key: 'date',
      label,
      remove: () => {
        customPicked.value = false
        emitFilters({ startDate: undefined, endDate: undefined })
      }
    })
  }
  return list
})

function onDocumentPointer(event: MouseEvent) {
  if (open.value && wrap.value && !wrap.value.contains(event.target as globalThis.Node)) {
    open.value = false
  }
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointer)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointer)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.rf {
  display: grid;
  gap: 10px;
}

.rf-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rf-search {
  position: relative;
  flex: 1 1 auto;
  max-width: 460px;
}

.rf-search-ico {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--ui-muted);
  pointer-events: none;
  translate: 0 -50%;
}

.rf-search-input {
  padding-left: 36px;
}

.rf-pop {
  position: relative;
}

.rf-btn {
  gap: 6px;
}

.rf-btn svg {
  width: 16px;
  height: 16px;
}

.rf-count {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  place-items: center;
  border-radius: 999px;
  background: var(--ui-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.rf-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  display: grid;
  gap: 16px;
  width: min(520px, calc(100vw - 48px));
  padding: 18px 20px 16px;
  border-radius: var(--ui-r-card);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised), 0 0 0 0.5px var(--ui-sep);
}

.rf-backdrop,
.rf-grip {
  display: none;
}

.rf-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.rf-range {
  display: grid;
  gap: 8px;
}

.rf-range-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.rf-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rf-dates {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.rf-to {
  font-size: 13px;
  color: var(--ui-muted);
}

.rf-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.rf-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rf-chip svg {
  width: 12px;
  height: 12px;
  color: var(--ui-muted);
}

.rf-clear {
  padding: 0 4px;
  border: 0;
  background: none;
}

@media (max-width: 768px) {
  .rf-search {
    max-width: none;
  }

  .rf-pop {
    position: static;
  }

  .rf-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: block;
    background: rgb(0 0 0 / 0.28);
  }

  .rf-panel {
    position: fixed;
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 91;
    width: auto;
    max-height: 85vh;
    max-height: 85dvh;
    padding: 8px 20px calc(16px + env(safe-area-inset-bottom));
    overflow-y: auto;
    border-radius: 24px 24px 0 0;
  }

  .rf-grip {
    display: block;
    width: 36px;
    height: 5px;
    margin: 0 auto 6px;
    border-radius: 999px;
    background: var(--ui-fill-strong);
  }

  .rf-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .rf-foot .btn {
    flex: 1;
  }
}
</style>
