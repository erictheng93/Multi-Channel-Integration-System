<template>
  <article class="ui-lead lead auto-reply-stats">
    <!-- The state of the line right now, and the three figures behind it -->
    <div class="lead-main">
      <div
        class="hours-state"
        :class="noSchedule ? 'is-none' : isBusinessHours ? 'is-open' : 'is-closed'"
      >
        <span class="hours-dot" />
        <strong class="hours-label">{{ noSchedule ? '未設定營業時間' : isBusinessHours ? '營業中' : '非營業時間' }}</strong>
      </div>
      <p
        v-if="hoursNote"
        class="hours-note"
      >
        {{ hoursNote }}
      </p>

      <dl class="lead-facts">
        <div class="fact fact-main">
          <dt>今日自動回覆</dt>
          <dd>
            <b class="lead-num">{{ todayReplies.toLocaleString('en-US') }}<small>則</small></b>
            <span
              v-if="hasCompare"
              class="fact-sub"
            >
              <span
                class="ui-delta"
                :class="delta >= 0 ? 'ui-delta-up' : 'ui-delta-down'"
              >{{ deltaText }}</span>
              比昨天同時段的 {{ yesterdaySameTime }} 則
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
            <span class="fact-sub">{{ (todayFailed ?? 0) > 0 ? `${todayFailed} 則失敗` : '沒有失敗' }}</span>
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
      </dl>
    </div>

    <!-- Signature: the week as a timetable. One row per weekday, the green bar is the opening window,
         the dark line is now, and the blue ticks are the replies already sent today. -->
    <div
      v-if="week"
      class="lead-week"
    >
      <div class="week-head">
        <h2>本週營業時間</h2>
        <span
          v-if="week.ticks.length > 0"
          class="week-key"
        ><i />每條藍線是今天已自動回覆的一則，共 {{ week.ticks.length }} 則</span>
      </div>
      <div
        class="week"
        role="img"
        :aria-label="week.label"
      >
        <ol class="week-rows">
          <li
            v-for="row in week.rows"
            :key="row.day"
            class="wrow"
            :class="{ 'is-today': row.today, 'is-off': !row.open }"
          >
            <span class="wday">{{ row.name }}</span>
            <span class="wtrack">
              <span
                v-if="row.open"
                class="wopen"
                :style="{ left: row.left + '%', width: row.width + '%' }"
              />
              <i
                v-for="(t, i) in row.today ? week.ticks : []"
                :key="i"
                class="wtick"
                :style="{ left: t + '%' }"
              />
            </span>
            <span class="wtime">{{ row.open ? `${row.startText}–${row.endText}` : '休息' }}</span>
          </li>
        </ol>
        <div
          class="week-scale"
          aria-hidden="true"
        >
          <span
            v-for="h in HOURS"
            :key="h"
            :style="{ left: (h / 24) * 100 + '%' }"
          >{{ String(h).padStart(2, '0') }}</span>
        </div>
        <div
          class="week-now"
          aria-hidden="true"
        >
          <i :style="{ left: week.now + '%' }"><b>現在 {{ week.nowText }}</b></i>
        </div>
      </div>
    </div>
    <div
      v-else
      class="lead-week lead-empty"
    >
      <h2>本週營業時間</h2>
      <p>還沒有設定營業時間，所有時段都會視為營業中。設定後，非營業時間規則才會生效。</p>
      <button
        type="button"
        class="btn btn-secondary"
        @click="emit('open-schedules')"
      >
        設定營業時間
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AutoReplyBusinessHours } from '@/api/autoReply'

export interface WeekPlan {
  /** Monday first; open = the day has an active schedule */
  days: Array<{ day: number; open: boolean; start: number; end: number }>
  /** Weekday (0 = Sunday) and minute of the day, in the schedule's timezone */
  today: number
  now: number
  /** Minutes of the day (team timezone) at which replies were sent today */
  replies: number[]
}

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
  weekPlan?: WeekPlan | null
}>()

const emit = defineEmits<{ 'open-schedules': [] }>()

const HOURS = [0, 6, 12, 18, 24]
const NAMES: Record<number, string> = { 0: '週日', 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六' }
const pad = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const pct = (m: number) => Math.min(100, Math.max(0, (m / 1440) * 100))

const week = computed(() => {
  const plan = props.weekPlan
  if (!plan || plan.days.length === 0) { return null }
  const rows = plan.days.map((d) => {
    const usable = d.open && d.end > d.start
    return {
      day: d.day,
      name: NAMES[d.day] ?? '',
      today: d.day === plan.today,
      open: usable,
      left: pct(d.start),
      width: pct(d.end) - pct(d.start),
      startText: pad(d.start),
      endText: pad(d.end),
    }
  })
  const label = `本週營業時間：${rows.map(r => `${r.name}${r.open ? `${r.startText} 到 ${r.endText}` : '休息'}`).join('，')}。現在 ${pad(plan.now)}。`
  return { rows, now: pct(plan.now), nowText: pad(plan.now), ticks: plan.replies.map(pct), label }
})

// No schedule saved yet: neither open nor closed is true, so say so
const noSchedule = computed(() => !!props.businessHours && !props.businessHours.hasSchedule)

const delta = computed(() => props.todayReplies - (props.yesterdaySameTime ?? 0))
const deltaText = computed(() => {
  if (delta.value === 0) { return '持平' }
  return `${delta.value > 0 ? '+' : '-'}${Math.abs(delta.value)}`
})
const hasCompare = computed(() => props.yesterdaySameTime !== null && props.yesterdaySameTime !== undefined)

const DAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

const hoursNote = computed(() => {
  const hours = props.businessHours
  if (!hours || !hours.hasSchedule) { return '' }
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
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 20px 44px;
  align-items: stretch;
  padding: 28px 36px;
}

.lead-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.hours-state {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hours-dot {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.hours-label {
  font: 600 30px / 1.15 var(--ui-font-display);
  letter-spacing: -0.02em;
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

.hours-note {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ui-ink-2);
}

.lead-facts {
  display: grid;
  gap: 0;
  margin: 20px 0 0;
}

.fact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 14px;
  align-items: baseline;
  padding: 12px 0;
  border-top: 0.5px solid var(--ui-sep);
}

.fact dt {
  grid-column: 1 / -1;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-muted);
}

.fact dd {
  display: contents;
  margin: 0;
}

.fact b {
  font: 600 26px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.fact b small {
  margin-left: 3px;
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.fact-main b {
  font-size: 40px;
}

.fact-sub {
  font-size: 14px;
  color: var(--ui-ink-2);
  text-align: right;
}

.pips {
  display: flex;
  gap: 3px;
  grid-column: 1 / -1;
  margin-top: 4px;
}

.pips i {
  flex: 1;
  height: 8px;
  max-width: 18px;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.pips i.on {
  background: var(--section-hue);
}

/* ---- the week timetable ---- */
.lead-week {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-left: 44px;
}

.lead-week::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.week-head {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: baseline;
  justify-content: space-between;
}

.week-head h2,
.lead-empty h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.week-key {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.week-key i,
.wtick {
  background: var(--ui-accent);
}

.week-key i {
  width: 3px;
  height: 12px;
  border-radius: 2px;
}

.week {
  --label: 52px;
  --times: 104px;
  position: relative;
  flex: 1;
  margin-top: 40px;
}

.week-rows {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wrow {
  display: grid;
  grid-template-columns: var(--label) minmax(0, 1fr) var(--times);
  align-items: center;
  min-height: 36px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.wrow.is-today {
  background: var(--ui-fill);
  color: var(--ui-ink);
  font-weight: 600;
}

.wday {
  padding-left: 10px;
}

.wtrack {
  position: relative;
  height: 14px;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.wrow.is-today .wtrack {
  background: var(--ui-surface);
}

.wopen {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  background: var(--ui-green);
}

.wtick {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--ui-surface);
}

.wtime {
  padding-right: 10px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--ui-muted);
}

.wrow.is-today .wtime {
  color: var(--ui-ink);
}

.week-scale {
  position: relative;
  height: 20px;
  margin: 8px var(--times) 0 var(--label);
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.week-scale span {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}

.week-scale span:first-child {
  transform: none;
}

.week-scale span:last-child {
  transform: translateX(-100%);
}

/* now: one line through all seven rows, its label parked above them */
.week-now {
  position: absolute;
  top: 0;
  right: var(--times);
  bottom: 28px;
  left: var(--label);
  pointer-events: none;
}

.week-now i {
  position: absolute;
  top: -8px;
  bottom: -4px;
  width: 2px;
  margin-left: -1px;
  border-radius: 2px;
  background: var(--ui-ink);
}

.week-now b {
  position: absolute;
  top: -26px;
  left: 50%;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--ui-ink);
  font-size: 13px;
  font-weight: 600;
  font-style: normal;
  color: var(--ui-surface);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transform: translateX(-50%);
}

.lead-empty {
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
}

.lead-empty p {
  max-width: 420px;
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

@media (max-width: 1024px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 24px 24px 26px;
  }

  .lead-week {
    padding-left: 0;
  }

  .lead-week::before {
    display: none;
  }

  .lead-facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 24px;
  }

  .fact {
    grid-template-columns: minmax(0, 1fr);
  }

  .fact-sub {
    text-align: left;
  }
}

@media (max-width: 768px) {
  .lead {
    gap: 18px;
    padding: 20px 16px 22px;
  }

  .hours-label {
    font-size: 26px;
  }

  /* the timetable below already shows when the day closes */
  .hours-note {
    display: none;
  }

  .wrow {
    min-height: 32px;
  }

  .lead-facts {
    gap: 0 12px;
    margin-top: 14px;
  }

  .fact b,
  .fact-main b {
    font-size: 24px;
  }

  .fact dt {
    font-size: 13px;
    white-space: nowrap;
  }

  .fact-sub {
    font-size: 13px;
  }

  .week {
    --label: 40px;
    --times: 84px;
  }

  .wday {
    padding-left: 6px;
  }

  .wtime {
    padding-right: 6px;
  }

  .pips i {
    max-width: 11px;
  }
}
</style>
