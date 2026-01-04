<template>
  <div class="api-filter">
    <div class="filter-group">
      <label>狀態:</label>
      <select v-model="localFilters.status">
        <option value="all">
          全部
        </option>
        <option value="healthy">
          正常
        </option>
        <option value="warning">
          警告
        </option>
        <option value="error">
          錯誤
        </option>
      </select>
    </div>

    <div class="filter-group">
      <label>分類:</label>
      <select v-model="localFilters.category">
        <option value="all">
          全部
        </option>
        <option value="system">
          系統
        </option>
        <option value="auth">
          認證
        </option>
        <option value="conversation">
          對話
        </option>
        <option value="customer">
          客戶
        </option>
        <option value="team">
          團隊
        </option>
      </select>
    </div>

    <div class="filter-group">
      <input
        v-model="localFilters.search"
        type="text"
        placeholder="搜索API端點..."
        class="search-input"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { FilterState } from '@/types/api-monitor'

interface Props {
  modelValue: FilterState
}

interface Emits {
  (_e: 'update:modelValue', _value: FilterState): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localFilters = reactive<FilterState>({
  status: props.modelValue.status,
  category: props.modelValue.category,
  search: props.modelValue.search
})

// Watch for changes and emit
watch(localFilters, (newValue) => {
  emit('update:modelValue', { ...newValue })
}, { deep: true })

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  localFilters.status = newValue.status
  localFilters.category = newValue.category
  localFilters.search = newValue.search
}, { deep: true })
</script>

<style scoped>
.api-filter {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  white-space: nowrap;
}

.filter-group select,
.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  background: white;
  transition: all 0.2s;
  outline: none;
}

.filter-group select {
  min-width: 120px;
  cursor: pointer;
}

.filter-group select:focus,
.search-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.filter-group select:hover {
  border-color: #667eea;
}

.search-input {
  min-width: 200px;
  flex: 1;
}

.search-input::placeholder {
  color: #9ca3af;
}

/* Responsive */
@media (max-width: 768px) {
  .api-filter {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .filter-group {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }

  .filter-group select,
  .search-input {
    min-width: auto;
    width: 100%;
  }
}
</style>
