<template>
  <div class="pagination-section">
    <div class="pagination-info">
      顯示 {{ startItem }} - {{ endItem }} 共 {{ pagination.total }} 項
    </div>
    <div class="pagination-controls">
      <button
        class="btn btn-secondary btn-sm pagination-btn"
        :disabled="!pagination.hasPrev"
        @click="$emit('change-page', pagination.page - 1)"
      >
        上一頁
      </button>
      <div class="page-numbers">
        <button
          v-for="page in visiblePages"
          :key="page"
          class="page-btn"
          :class="{ 'active': page === pagination.page }"
          @click="$emit('change-page', page)"
        >
          {{ page }}
        </button>
      </div>
      <button
        class="btn btn-secondary btn-sm pagination-btn"
        :disabled="!pagination.hasNext"
        @click="$emit('change-page', pagination.page + 1)"
      >
        下一頁
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PaginationControls Component
 *
 * Shared pagination UI component
 *
 * @emits change-page - Page number change
 */

import { computed } from 'vue'

export interface PaginationControlsProps {
  /**
   * Pagination state
   */
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }

  /**
   * Visible page numbers
   */
  visiblePages: number[]
}

const props = defineProps<PaginationControlsProps>()

defineEmits<{
  'change-page': [page: number]
}>()

/**
 * Start item number
 */
const startItem = computed(() => {
  return (props.pagination.page - 1) * props.pagination.pageSize + 1
})

/**
 * End item number
 */
const endItem = computed(() => {
  return Math.min(props.pagination.page * props.pagination.pageSize, props.pagination.total)
})
</script>

<style scoped>
.pagination-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 22px;
}

.pagination-info {
  font-size: 12.5px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.page-btn:hover {
  background: var(--ui-fill);
}

.page-btn.active {
  background: var(--ui-ink);
  color: var(--ui-surface);
  font-weight: 600;
}

@media (max-width: 768px) {
  .pagination-section {
    padding: 12px 16px;
  }

  .page-btn,
  .pagination-btn {
    min-width: 44px;
    min-height: 44px;
  }

  .page-numbers {
    display: none;
  }
}
</style>
