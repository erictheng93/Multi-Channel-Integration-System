<template>
  <div
    v-if="pagination.totalPages > 1"
    class="pagination-section"
  >
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
 * 分页控制组件
 *
 * @emits change-page - 切换页码
 */

import { computed } from 'vue'

export interface PaginationControlsProps {
  /**
   * 分页信息
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
   * 可见的页码列表
   */
  visiblePages: number[]
}

const props = defineProps<PaginationControlsProps>()

defineEmits<{
  'change-page': [page: number]
}>()

/**
 * 起始项编号
 */
const startItem = computed(() => {
  return (props.pagination.page - 1) * props.pagination.pageSize + 1
})

/**
 * 结束项编号
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
