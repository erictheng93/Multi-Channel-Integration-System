<template>
  <nav
    class="pagination"
    aria-label="分頁"
  >
    <span class="pagination__info">
      {{ infoText }}
    </span>
    <div class="pagination__buttons">
      <button
        class="btn btn-secondary btn-sm pagination__btn"
        :disabled="currentPage <= 1 || loading"
        @click="onPrev"
      >
        <ChevronLeftIcon :size="16" />
        <span>{{ prevLabel }}</span>
      </button>
      <button
        class="btn btn-secondary btn-sm pagination__btn"
        :disabled="currentPage >= totalPages || loading"
        @click="onNext"
      >
        <span>{{ nextLabel }}</span>
        <ChevronRightIcon :size="16" />
      </button>
    </div>
  </nav>
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
  return `\u7B2C ${props.currentPage} \u9801\uFF0C\u5171 ${props.totalPages} \u9801\uFF08${props.totalRecords.toLocaleString('zh-TW')} \u7B46\u8A18\u9304\uFF09`
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.pagination__info {
  margin-right: auto;
}

.pagination__buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .pagination__info {
    flex-basis: 100%;
  }
}
</style>
