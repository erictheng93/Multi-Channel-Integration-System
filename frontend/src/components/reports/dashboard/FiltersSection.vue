<template>
  <div class="filter-section">
    <div class="filter-header">
      <h3 class="filter-title">
        🔍 篩選器
      </h3>
      <button
        v-if="hasActiveFilters"
        class="filter-reset"
        @click="$emit('reset-filters')"
      >
        清除篩選
      </button>
    </div>

    <div class="filter-controls">
      <!-- 報表類型篩選 -->
      <div class="filter-group">
        <label class="filter-label">報表類型</label>
        <select
          :value="filters.type"
          class="filter-select"
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
              {{ getReportTypeIcon(type.value as ReportType) }} {{ type.label }}
            </option>
          </optgroup>
        </select>
      </div>

      <!-- 狀態篩選 -->
      <div class="filter-group">
        <label class="filter-label">狀態</label>
        <select
          :value="filters.status"
          class="filter-select"
          @change="handleFilterChange('status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            全部狀態
          </option>
          <option value="pending">
            ⏳ 待處理
          </option>
          <option value="generating">
            ⚙️ 生成中
          </option>
          <option value="completed">
            ✅ 已完成
          </option>
          <option value="failed">
            ❌ 失敗
          </option>
          <option value="expired">
            ⏰ 已過期
          </option>
        </select>
      </div>

      <!-- 格式篩選 -->
      <div class="filter-group">
        <label class="filter-label">格式</label>
        <select
          :value="filters.format"
          class="filter-select"
          @change="handleFilterChange('format', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            全部格式
          </option>
          <option value="json">
            📄 JSON
          </option>
          <option value="csv">
            📊 CSV
          </option>
          <option value="excel">
            📗 Excel
          </option>
          <option value="pdf">
            📕 PDF
          </option>
          <option value="html">
            🌐 HTML
          </option>
        </select>
      </div>

      <!-- 日期範圍篩選 -->
      <div class="filter-group">
        <label class="filter-label">建立時間</label>
        <div class="date-filters">
          <input
            :value="filters.startDate"
            type="date"
            class="filter-date"
            @change="handleFilterChange('startDate', ($event.target as HTMLInputElement).value)"
          >
          <span class="date-separator">至</span>
          <input
            :value="filters.endDate"
            type="date"
            class="filter-date"
            @change="handleFilterChange('endDate', ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>

      <!-- 搜尋 -->
      <div class="filter-group">
        <label class="filter-label">搜尋</label>
        <div class="search-input-wrapper">
          <input
            :value="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜尋報表標題..."
            @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          >
          <div class="search-icon">
            🔍
          </div>
        </div>
      </div>
    </div>
  </div>
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
.filter-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.filter-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.filter-reset {
  color: #6b7280;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: underline;
}

.filter-reset:hover {
  color: #374151;
}

.filter-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.filter-select,
.filter-date,
.search-input {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.filter-select:focus,
.filter-date:focus,
.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.date-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-separator {
  color: #6b7280;
  font-size: 0.9rem;
}

.search-input-wrapper {
  position: relative;
}

.search-input {
  width: 100%;
  padding-right: 2.5rem;
}

.search-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
}

@media (max-width: 768px) {
  .filter-controls {
    grid-template-columns: 1fr;
  }
}
</style>
