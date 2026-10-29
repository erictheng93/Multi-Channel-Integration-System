<template>
  <div class="auto-reply-stats">
    <div class="ui-kpi-grid">
      <div class="ui-card ui-kpi stat-card stat-card--rules">
        <div class="ui-kpi-top">
          <span class="ui-kpi-ico ico-blue"><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M13 2 3 14h9l-1 8 10-12h-9Z" /></svg></span>
          <span class="stat-label">啟用規則數</span>
        </div>
        <div class="ui-kpi-value stat-value">
          {{ activeRules }}<small v-if="totalRules !== undefined">/ {{ totalRules }}</small>
        </div>
        <div
          v-if="totalRules !== undefined && totalRules > activeRules"
          class="ui-kpi-foot"
        >
          {{ totalRules - activeRules }} 條已停用
        </div>
      </div>

      <div class="ui-card ui-kpi stat-card stat-card--replies">
        <div class="ui-kpi-top">
          <span class="ui-kpi-ico ico-green"><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /></svg></span>
          <span class="stat-label">今日回覆數</span>
        </div>
        <div class="ui-kpi-value stat-value">
          {{ todayReplies }}
        </div>
        <div
          v-if="yesterdaySameTime !== null && yesterdaySameTime !== undefined"
          class="ui-kpi-foot"
        >
          <span
            class="ui-delta"
            :class="delta >= 0 ? 'ui-delta-up' : 'ui-delta-down'"
          >{{ deltaText }}</span>
          比昨天同時段
        </div>
      </div>

      <div class="ui-card ui-kpi stat-card stat-card--hours">
        <div class="ui-kpi-top">
          <span class="ui-kpi-ico ico-orange"><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="12"
            r="9"
          /><path d="M12 7v5l3 2" /></svg></span>
          <span class="stat-label">營業狀態</span>
        </div>
        <div>
          <span
            class="ui-pill ui-pill-dot hours-pill stat-value"
            :class="noSchedule ? [] : isBusinessHours ? ['ui-pill-green', 'text-amber'] : ['ui-pill-red', 'text-red']"
          >{{ noSchedule ? '未設定' : isBusinessHours ? '營業中' : '非營業時間' }}</span>
        </div>
        <div
          v-if="hoursNote"
          class="ui-kpi-foot hours-foot"
        >
          {{ hoursNote }}
        </div>
      </div>

      <div class="ui-card ui-kpi stat-card stat-card--rate">
        <div class="ui-kpi-top">
          <span class="ui-kpi-ico ico-indigo"><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="12"
            r="9"
          /><path d="m8 12.5 3 3 5-6" /></svg></span>
          <span class="stat-label">成功率</span>
        </div>
        <div class="ui-kpi-value stat-value">
          <template v-if="successRate === null || successRate === undefined">
            —
          </template>
          <template v-else>
            {{ successRate }}%
          </template>
        </div>
        <div class="ui-kpi-foot">
          <template v-if="successRate === null || successRate === undefined">
            今天尚無回覆紀錄
          </template>
          <template v-else>
            {{ todayReplies }} 則成功 · {{ todayFailed ?? 0 }} 則失敗
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AutoReplyBusinessHours } from '@/api/autoReply'

const props = defineProps<{
  activeRules: number
  todayReplies: number
  isBusinessHours: boolean
  /** Percent (0-100) from the server; null when nothing was attempted today */
  successRate: number | null
  totalRules?: number
  todayFailed?: number
  /** Replies sent yesterday up to the same time of day; null when unknown */
  yesterdaySameTime?: number | null
  businessHours?: AutoReplyBusinessHours | null
}>()

// No schedule saved yet: neither open nor closed is true, so say so
const noSchedule = computed(() => !!props.businessHours && !props.businessHours.hasSchedule)

const delta = computed(() => props.todayReplies - (props.yesterdaySameTime ?? 0))
const deltaText = computed(() => {
  if (delta.value === 0) { return '持平' }
  return `${delta.value > 0 ? '+' : '-'}${Math.abs(delta.value)}`
})

const DAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

const hoursNote = computed(() => {
  const hours = props.businessHours
  if (!hours) { return '' }
  if (!hours.hasSchedule) { return '尚未設定營業時間' }
  if (hours.isOpen) {
    return hours.closesAt ? `今天營業至 ${hours.closesAt}，之後套用非營業規則` : ''
  }
  if (hours.opensAt) {
    return `下次營業 ${DAY_LABELS[hours.opensAt.dayOfWeek] ?? ''} ${hours.opensAt.time}`
  }
  return ''
})
</script>

<style scoped>
/* The business-hours caption is a full sentence: let it wrap instead of truncating on phones */
@media (max-width: 768px) {
  .hours-foot.ui-kpi-foot {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }
}

/* Neutralise the legacy global .stat-card (centered flex row, border, hover lift) */
.stat-card {
  align-items: stretch;
  gap: 10px;
  padding: 18px 20px 16px;
  border: 0;
  box-shadow: var(--ui-shadow-card);
  transform: none;
}

.stat-card:hover {
  box-shadow: var(--ui-shadow-card);
  transform: none;
}

.ico-blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.ico-green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.ico-orange {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.ico-indigo {
  background: var(--ui-indigo-soft);
  color: var(--ui-indigo);
}

.hours-pill {
  height: 26px;
  padding: 0 12px;
  font-size: 13px;
}
</style>
