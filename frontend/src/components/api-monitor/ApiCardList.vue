<template>
  <div>
    <div
      v-if="endpoints.length > 0"
      class="ep-head"
      aria-hidden="true"
    >
      <span class="hide-m">方法</span>
      <span>端點</span>
      <span class="only-wide">說明</span>
      <span>P95</span>
      <span class="hide-m">成功率</span>
      <span class="hide-m">請求數</span>
      <span />
    </div>
    <ApiEmptyState
      v-if="endpoints.length === 0"
      title="沒有符合的端點"
      message="調整狀態、分類或搜尋條件再試一次。"
    />
    <ApiCard
      v-for="ep in endpoints"
      :key="ep.id"
      :endpoint="ep"
      :expanded="expandedCard === ep.id"
      @toggle="$emit('toggle-card', ep.id)"
    />
    <div
      v-if="total !== undefined"
      class="count-line"
    >
      顯示 {{ endpoints.length }} / {{ total }} 個端點
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiEndpoint } from '@/types/api-monitor'
import ApiCard from './ApiCard.vue'
import ApiEmptyState from './ApiEmptyState.vue'

defineProps<{
  endpoints: ApiEndpoint[]
  expandedCard: string | null
  /** Endpoint count before filtering, for the footer line */
  total?: number
}>()

defineEmits<{
  (_e: 'toggle-card', _id: string): void
}>()
</script>

<style scoped>
.ep-head {
  display: grid;
  grid-template-columns: 52px minmax(260px, 1.25fr) repeat(3, minmax(0, 1fr)) 16px;
  gap: 12px;
  padding: 8px 22px;
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.count-line {
  padding: 14px 22px 18px;
  font-size: 13px;
  color: var(--ui-muted);
}

.only-wide {
  display: none;
}

/* desktop: the description gets its own column, so a row is one line and the numbers sit in a tight block */
@media (min-width: 1025px) {
  .ep-head {
    grid-template-columns: 52px 290px minmax(0, 1fr) 90px 90px 110px 16px;
  }

  .only-wide {
    display: block;
  }

  .ep-head span:nth-child(n + 4):nth-child(-n + 6) {
    text-align: right;
  }
}

@media (max-width: 768px) {
  /* the phone row labels its own numbers, so no column header */
  .ep-head {
    display: none;
  }

  .count-line {
    padding: 14px 16px 18px;
  }
}
</style>
