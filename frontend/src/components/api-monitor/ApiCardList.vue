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
      <span
        v-if="scaleMs"
        class="only-xl"
      >P95 長度（豎線為 500 ms）</span>
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
      :scale-ms="scaleMs"
      @toggle="$emit('toggle-card', ep.id)"
    />
    <div
      v-if="total !== undefined"
      class="count-line"
    >
      顯示 {{ endpoints.length }} / {{ total }} 個端點<template v-if="scaleMs">
        <span class="only-xl-inline"> · 條長為 P95，每列共用 0 – {{ scaleLabel }} 刻度，豎線為 500 ms 警戒線</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiEndpoint } from '@/types/api-monitor'
import ApiCard from './ApiCard.vue'
import ApiEmptyState from './ApiEmptyState.vue'

const props = defineProps<{
  endpoints: ApiEndpoint[]
  /** Shared right-hand end of the latency band, ms; omit to hide the band */
  scaleMs?: number
  expandedCard: string | null
  /** Endpoint count before filtering, for the footer line */
  total?: number
}>()

defineEmits<{
  (_e: 'toggle-card', _id: string): void
}>()

const scaleLabel = computed(() => {
  const ms = props.scaleMs ?? 0
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
})
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

.only-wide,
.only-xl,
.only-xl-inline {
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

  .ep-head span:nth-child(n + 4):nth-child(-n + 7):not(.only-xl) {
    text-align: right;
  }
}

@media (min-width: 1281px) {
  .ep-head:has(.only-xl) {
    grid-template-columns: 52px 250px minmax(0, 1fr) 190px 80px 80px 100px 16px;
  }

  .only-xl {
    display: block;
  }

  .only-xl-inline {
    display: inline;
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
