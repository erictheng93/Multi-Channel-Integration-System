<template>
  <div class="pagination-section">
    <div class="pagination-info">
      顯示 {{ startItem }} - {{ endItem }} 共 {{ pagination.total }} 項
    </div>
    <div class="pagination-controls">
      <button
        class="pagination-btn"
        :disabled="!pagination.hasPrev"
        @click="$emit('change-page', pagination.page - 1)"
      >
        ← 上一頁
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
        class="pagination-btn"
        :disabled="!pagination.hasNext"
        @click="$emit('change-page', pagination.page + 1)"
      >
        下一頁 →
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
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
}

.pagination-info {
  color: #6b7280;
  font-size: 0.9rem;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

.page-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.page-btn:hover {
  background: #f3f4f6;
}

.page-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

@media (max-width: 768px) {
  .pagination-section {
    flex-direction: column;
    gap: 1rem;
  }

  .pagination-controls {
    flex-wrap: wrap;
  }
}
</style>
