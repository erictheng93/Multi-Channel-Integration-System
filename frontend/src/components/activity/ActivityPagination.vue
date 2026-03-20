<template>
  <div class="pagination">
    <span class="pagination__info">
      {{ infoText }}
    </span>
    <div class="pagination__buttons">
      <button
        class="pagination__btn"
        :disabled="currentPage <= 1 || loading"
        @click="onPrev"
      >
        <ChevronLeftIcon :size="16" />
        <span>{{ prevLabel }}</span>
      </button>
      <button
        class="pagination__btn"
        :disabled="currentPage >= totalPages || loading"
        @click="onNext"
      >
        <span>{{ nextLabel }}</span>
        <ChevronRightIcon :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'

const props = defineProps<{
  currentPage: number
  totalPages: number
  totalRecords: number
  loading: boolean
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()

const infoText = computed(() => {
  return `\u7B2C ${props.currentPage} \u9801\uFF0C\u5171 ${props.totalPages} \u9801 (${props.totalRecords} \u7B46\u8A18\u9304)`
})

const prevLabel = computed(() => '\u4E0A\u4E00\u9801')
const nextLabel = computed(() => '\u4E0B\u4E00\u9801')

function onPrev() {
  if (props.currentPage > 1) {
    emit('page-change', props.currentPage - 1)
  }
}

function onNext() {
  if (props.currentPage < props.totalPages) {
    emit('page-change', props.currentPage + 1)
  }
}
</script>

<style scoped>
.pagination {
  background: #F2F2F7;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.pagination__info {
  font-size: 14px;
  color: #8E8E93;
}

.pagination__buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 9999px;
  background: #FFFFFF;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #1C1C1E;
  cursor: pointer;
  transition: opacity 150ms ease-out, box-shadow 150ms ease-out;
}

.pagination__btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
}

.pagination__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
