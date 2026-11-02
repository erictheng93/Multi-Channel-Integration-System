<template>
  <article class="ui-lead lead auto-reply-stats">
    <div class="lead-main">
      <div class="lead-kicker">
        今日自動回覆
      </div>
      <div class="lead-num">
        {{ todayReplies.toLocaleString('en-US') }}<small>則</small>
      </div>
      <div
        v-if="yesterdaySameTime !== null && yesterdaySameTime !== undefined"
        class="lead-meaning"
      >
        <span
          class="ui-delta"
          :class="delta >= 0 ? 'ui-delta-up' : 'ui-delta-down'"
        >{{ deltaText }}</span>
        比昨天同時段
      </div>

      <div
        class="hours-state"
        :class="noSchedule ? 'is-none' : isBusinessHours ? 'is-open' : 'is-closed'"
      >
        <span class="hours-dot" />
        <strong class="hours-label">{{ noSchedule ? '未設定' : isBusinessHours ? '營業中' : '非營業時間' }}</strong>
        <span
          v-if="hoursNote"
          class="hours-note"
        >{{ hoursNote }}</span>
      </div>
    </div>

    <div
      v-if="rings.length > 0"
      class="lead-rings"
    >
      <ServiceRings
        summary="自動回覆概況"
        :rings="rings"
        :size="148"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ServiceRings, { type ServiceRing } from '@/components/ui/ServiceRings.vue'
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

// Two real ratios: rules switched on / all rules, and replies that succeeded / attempted today
const rings = computed<ServiceRing[]>(() => {
  const list: ServiceRing[] = []
  if (props.totalRules !== undefined && props.totalRules > 0) {
    list.push({ label: '啟用規則', value: props.activeRules, total: props.totalRules, of: '條規則', hue: 'var(--section-hue)' })
  }
  if (props.successRate !== null && props.successRate !== undefined) {
    const failed = props.todayFailed ?? 0
    list.push({ label: '今日回覆成功', value: props.todayReplies, total: props.todayReplies + failed, of: '則', hue: 'var(--ui-green)' })
  }
  return list
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
.lead {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 20px 40px;
  align-items: center;
  padding: 24px 40px;
}

.lead:not(:has(.lead-rings)) {
  grid-template-columns: minmax(0, 1fr);
}

.lead-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.lead-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.lead-num {
  margin-top: 4px;
  font: 600 56px / 1.05 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.lead-num small {
  margin-left: 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.lead-meaning {
  margin-top: 4px;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.hours-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  margin-top: 16px;
  font-size: 14px;
}

.hours-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.hours-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-muted);
}

.hours-note {
  color: var(--ui-muted);
}

.hours-state.is-open .hours-dot {
  background: var(--ui-green);
}

.hours-state.is-open .hours-label {
  color: var(--ui-green-ink);
}

.hours-state.is-closed .hours-dot {
  background: var(--ui-red);
}

.hours-state.is-closed .hours-label {
  color: var(--ui-red-ink);
}

.lead-rings {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.lead-rings::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -20px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

@media (max-width: 1024px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .lead-rings {
    justify-content: flex-start;
  }

  .lead-rings::before {
    display: none;
  }
}

@media (max-width: 768px) {
  .lead-num {
    font-size: 48px;
  }
}
</style>
