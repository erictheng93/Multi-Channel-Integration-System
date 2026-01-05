<template>
  <section
    class="filters-section"
    role="search"
    aria-label="通知篩選選項"
  >
    <div class="filters-row">
      <!-- Type Filter -->
      <div class="filter-group">
        <label class="filter-label">類型</label>
        <select
          :model-value="selectedType"
          class="filter-select"
          @change="$emit('update:selectedType', ($event.target as HTMLSelectElement).value); $emit('apply-filters')"
        >
          <option value="">
            全部類型
          </option>
          <option
            v-for="type in notificationTypes"
            :key="type.value"
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select>
      </div>

      <!-- Priority Filter -->
      <div class="filter-group">
        <label class="filter-label">優先級</label>
        <select
          :model-value="selectedPriority"
          class="filter-select"
          @change="$emit('update:selectedPriority', ($event.target as HTMLSelectElement).value); $emit('apply-filters')"
        >
          <option value="">
            全部優先級
          </option>
          <option
            v-for="priority in priorities"
            :key="priority.value"
            :value="priority.value"
          >
            {{ priority.label }}
          </option>
        </select>
      </div>

      <!-- Read Status Filter -->
      <div class="filter-group">
        <label class="filter-label">狀態</label>
        <div class="filter-tabs">
          <button
            class="filter-tab"
            :class="{ active: selectedReadStatus === undefined }"
            @click="$emit('update:selectedReadStatus', undefined); $emit('apply-filters')"
          >
            全部
          </button>
          <button
            class="filter-tab"
            :class="{ active: selectedReadStatus === false }"
            @click="$emit('update:selectedReadStatus', false); $emit('apply-filters')"
          >
            <span class="tab-badge" />
            未讀
          </button>
          <button
            class="filter-tab"
            :class="{ active: selectedReadStatus === true }"
            @click="$emit('update:selectedReadStatus', true); $emit('apply-filters')"
          >
            已讀
          </button>
        </div>
      </div>

      <!-- Clear Filters -->
      <button
        v-if="hasActiveFilters"
        class="btn btn-ghost btn-sm"
        @click="$emit('clear-filters')"
      >
        <XIcon />
        清除篩選
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { XIcon } from '@/components/icons'

defineProps<{
  selectedType: string
  selectedPriority: string
  selectedReadStatus: boolean | undefined
  hasActiveFilters: boolean
  notificationTypes: Array<{ value: string; label: string }>
  priorities: Array<{ value: string; label: string }>
}>()

defineEmits<{
  'update:selectedType': [value: string]
  'update:selectedPriority': [value: string]
  'update:selectedReadStatus': [value: boolean | undefined]
  'apply-filters': []
  'clear-filters': []
}>()
</script>

<style scoped>
/* Filters */
.filters-section {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: white;
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
}

.filters-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
}

.filter-select {
  min-width: 160px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
  font-size: 0.875rem;
  color: var(--gray-900);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-select:hover {
  border-color: var(--gray-400);
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.filter-tabs {
  display: flex;
  background: var(--gray-100);
  border-radius: var(--radius-lg);
  padding: 4px;
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-tab:hover {
  color: var(--gray-900);
}

.filter-tab.active {
  background: white;
  color: var(--primary-700);
  box-shadow: var(--shadow-sm);
}

.tab-badge {
  width: 6px;
  height: 6px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-ghost {
  background: transparent;
  color: var(--gray-600);
}

.btn-ghost:hover {
  background: var(--gray-100);
}

.btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: 0.8125rem;
}

.btn svg {
  width: 18px;
  height: 18px;
}

/* Responsive */
@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    width: 100%;
  }

  .filter-tabs {
    width: 100%;
    justify-content: center;
  }
}
</style>
