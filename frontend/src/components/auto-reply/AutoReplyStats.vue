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
      v-if="hasFacts"
      class="lead-side"
    >
      <dl class="lead-facts">
        <div
          v-if="hasCompare"
          class="fact"
        >
          <dt>昨天同時段</dt>
          <dd>
            <b>{{ yesterdaySameTime }}<small> 則</small></b>
            <span class="sub">{{ deltaSub }}</span>
          </dd>
        </div>
        <div
          v-if="totalRules !== undefined && totalRules > 0"
          class="fact"
        >
          <dt>啟用規則</dt>
          <dd>
            <b>{{ activeRules }}<small> / {{ totalRules }} 條</small></b>
            <span
              class="pips"
              role="img"
              :aria-label="`啟用 ${activeRules} 條，共 ${totalRules} 條`"
            >
              <i
                v-for="n in Math.min(totalRules, 12)"
                :key="n"
                :class="{ on: n <= activeRules }"
              />
            </span>
          </dd>
        </div>
        <div
          v-if="successRate !== null && successRate !== undefined"
          class="fact"
        >
          <dt>回覆成功率</dt>
          <dd>
            <b>{{ successRate }}<small>%</small></b>
            <span class="sub">{{ (todayFailed ?? 0) > 0 ? `${todayFailed} 則失敗` : '沒有失敗' }}</span>
          </dd>
        </div>
      </dl>
    </div>
  </article>
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

const hasCompare = computed(() => props.yesterdaySameTime !== null && props.yesterdaySameTime !== undefined)
const deltaSub = computed(() => {
  if (delta.value === 0) { return '與今天持平' }
  return delta.value > 0 ? `今天多 ${delta.value} 則` : `今天少 ${Math.abs(delta.value)} 則`
})

const hasFacts = computed(() =>
  (props.totalRules !== undefined && props.totalRules > 0)
  || (props.yesterdaySameTime !== null && props.yesterdaySameTime !== undefined)
  || (props.successRate !== null && props.successRate !== undefined),
)

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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 20px 40px;
  align-items: center;
  padding: 24px 40px;
}

.lead:not(:has(.lead-side)) {
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

.lead-side {
  position: relative;
  display: grid;
  gap: 22px;
  min-width: 0;
}

.lead-side::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -20px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.lead-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 24px;
  margin: 0;
}

.fact dt {
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-muted);
}

.fact dd {
  display: grid;
  gap: 8px;
  margin: 6px 0 0;
}

.fact b {
  font: 600 32px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.fact b small {
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.sub {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.pips {
  display: flex;
  gap: 3px;
}

.pips i {
  flex: 1;
  height: 8px;
  max-width: 14px;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.pips i.on {
  background: var(--section-hue);
}

@media (max-width: 1024px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .lead-side::before {
    display: none;
  }
}

@media (max-width: 768px) {
  .lead-num {
    font-size: 48px;
  }

  /* three compact facts in one row instead of a stacked comparison */
  .lead-facts {
    gap: 14px 12px;
  }

  .fact b {
    font-size: 24px;
  }

  .fact dt {
    font-size: 13px;
    white-space: nowrap;
  }

  .sub {
    font-size: 13px;
  }

  .pips i {
    max-width: 9px;
    height: 6px;
  }
}
</style>
