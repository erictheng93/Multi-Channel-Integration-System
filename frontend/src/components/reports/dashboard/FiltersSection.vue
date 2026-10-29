<template>
  <section class="ui-card filter-section">
    <div class="ui-card-head">
      <h3 class="ui-card-title filter-title">
        篩選
      </h3>
      <div class="ui-card-end">
        <button
          v-if="hasActiveFilters"
          type="button"
          class="ui-link filter-reset"
          @click="$emit('reset-filters')"
        >
          重設
        </button>
      </div>
    </div>
    <div class="filter-controls">
      <div class="ui-field filter-group">
        <label for="rf-type">報表類型</label>
        <select
          id="rf-type"
          :value="filters.type"
          class="ui-select filter-select"
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

      <div class="ui-field filter-group">
        <label for="rf-status">狀態</label>
        <select
          id="rf-status"
          :value="filters.status"
          class="ui-select filter-select"
          @change="handleFilterChange('status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            全部狀態
          </option>
          <option value="pending">
            待處理
          </option>
          <option value="generating">
            生成中
          </option>
          <option value="completed">
            已完成
          </option>
          <option value="failed">
            失敗
          </option>
          <option value="expired">
            已過期
          </option>
        </select>
      </div>

      <div class="ui-field filter-group">
        <label for="rf-format">格式</label>
        <select
          id="rf-format"
          :value="filters.format"
          class="ui-select filter-select"
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

      <div class="ui-field filter-group filter-group--date">
        <label for="rf-from">建立時間</label>
        <div class="date-filters">
          <input
            id="rf-from"
            :value="filters.startDate"
            type="date"
            class="ui-input filter-date"
            @change="handleFilterChange('startDate', ($event.target as HTMLInputElement).value)"
          >
          <span class="date-separator">至</span>
          <input
            :value="filters.endDate"
            type="date"
            class="ui-input filter-date"
            aria-label="建立時間結束"
            @change="handleFilterChange('endDate', ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>

      <div class="ui-field filter-group">
        <label for="rf-q">搜尋</label>
        <div class="search-input-wrapper">
          <input
            id="rf-q"
            :value="searchQuery"
            type="text"
            class="ui-input search-input"
            placeholder="報表標題"
            @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          >
          <span class="search-icon" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * FiltersSection Component
 *
 * 报表筛选控制面板
 *
 * @emits update:filters - 筛选条件更新
 * @emits update:searchQuery - 搜索关键词更新
 * @emits reset-filters - 重置所有筛选
 */

import type { ReportListQuery, ReportType } from '@/types/reports'

export interface FiltersSectionProps {
  /**
   * 筛选条件
   */
  filters: ReportListQuery

  /**
   * 搜索关键词
   */
  searchQuery: string

  /**
   * 是否有活动的筛选条件
   */
  hasActiveFilters: boolean

  /**
   * 分组的报表类型
   */
  groupedReportTypes: Array<{
    category: string
    title: string
    types: Array<{ value: string; label: string }>
  }>

  /**
   * 获取报表类型图标的方法
   */
  getReportTypeIcon: (_type: ReportType) => string
}

const props = defineProps<FiltersSectionProps>()

const emit = defineEmits<{
  'update:filters': [filters: ReportListQuery]
  'update:searchQuery': [query: string]
  'reset-filters': []
}>()

/**
 * 处理筛选条件变更
 */
function handleFilterChange(key: keyof ReportListQuery, value: string) {
  const newFilters = { ...props.filters } as Record<string, unknown>
  if (value === '') {
    newFilters[key] = undefined
  } else {
    // Type-safe assignment based on ReportListQuery interface
    newFilters[key] = value
  }
  emit('update:filters', newFilters as ReportListQuery)
}
</script>

<style scoped>
.filter-controls {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
  padding: 4px 22px 20px;
}

.filter-group {
  grid-column: span 2;
  min-width: 0;
}

.filter-group--date {
  grid-column: span 3;
}

.filter-group:last-child {
  grid-column: span 3;
}

.date-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* Native date inputs and selects have a wide intrinsic width; let them shrink with the column */
.date-filters .filter-date {
  flex: 1 1 0;
  min-width: 0;
}

.filter-select,
.search-input {
  min-width: 0;
}

.date-separator {
  font-size: 12.5px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .filter-controls {
    /* minmax(0, …) not 1fr: a bare 1fr column cannot shrink below its widest control */
    grid-template-columns: minmax(0, 1fr);
    padding: 4px 16px 16px;
  }

  .filter-group,
  .filter-group--date,
  .filter-group:last-child {
    grid-column: auto;
  }
}
</style>
