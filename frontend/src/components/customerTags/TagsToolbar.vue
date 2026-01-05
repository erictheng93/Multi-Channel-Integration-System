<template>
  <div class="toolbar-section">
    <!-- Search Box -->
    <div class="search-box">
      <SearchIcon class="search-icon" />
      <input
        v-model="localSearchQuery"
        type="text"
        class="search-input"
        placeholder="搜尋標籤名稱或描述..."
        @input="$emit('update:search-query', localSearchQuery)"
      >
    </div>

    <!-- Toolbar Actions -->
    <div class="toolbar-actions">
      <!-- Bulk Actions (shown when tags are selected) -->
      <div
        v-if="hasSelection"
        class="selection-indicator"
      >
        <span class="selection-count">已選擇 {{ selectionCount }} 個標籤</span>
        <button
          class="btn btn-danger btn-sm"
          @click="$emit('bulk-delete')"
        >
          <TrashIcon />
          <span>批量刪除</span>
        </button>
        <button
          class="btn btn-secondary btn-sm"
          @click="$emit('clear-selection')"
        >
          <XIcon />
          <span>取消選擇</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { SearchIcon, TrashIcon, XIcon } from '@/components/icons'

const props = defineProps<{
  searchQuery: string
  hasSelection: boolean
  selectionCount: number
}>()

defineEmits<{
  'update:search-query': [value: string]
  'bulk-delete': []
  'clear-selection': []
}>()

const localSearchQuery = ref(props.searchQuery)

watch(() => props.searchQuery, (newValue) => {
  localSearchQuery.value = newValue
})
</script>

<style scoped>
.toolbar-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
  padding: var(--space-4);
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  max-width: 400px;
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
  transition: all var(--transition-fast);
}

.search-box:focus-within {
  background: white;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  width: 20px;
  height: 20px;
  color: var(--gray-400);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--gray-900);
  font-size: 0.9375rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--gray-400);
}

.toolbar-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.selection-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--primary-50);
  border-radius: var(--radius-lg);
  border: 1px solid var(--primary-200);
}

.selection-count {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--primary-700);
  white-space: nowrap;
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
  white-space: nowrap;
}

.btn-sm {
  padding: var(--space-1-5) var(--space-3);
  font-size: 0.8125rem;
}

.btn-danger {
  background: var(--red-500);
  color: white;
}

.btn-danger:hover {
  background: var(--red-600);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}

.btn svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 768px) {
  .toolbar-section {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .toolbar-actions {
    justify-content: flex-start;
  }

  .selection-indicator {
    flex-wrap: wrap;
  }
}
</style>
