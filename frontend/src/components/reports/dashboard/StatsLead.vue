<template>
  <article
    class="ui-lead lead"
    role="group"
    aria-label="本月報表"
    :aria-busy="!loaded || undefined"
  >
    <div class="lead-main">
      <div class="lead-kicker">
        本月報表
      </div>
      <div
        class="lead-num"
        :class="{ 'is-dim': loaded && stats.thisMonthGenerated === 0 }"
      >
        {{ loaded ? stats.thisMonthGenerated.toLocaleString('en-US') : '—' }}<small>份</small>
      </div>
      <div class="lead-meaning">
        累計 {{ stats.totalReports.toLocaleString('en-US') }} 份，<b>完成率 {{ completionRate }}%</b>
      </div>
      <button
        v-if="stats.failedReports > 0"
        type="button"
        class="ui-link action-link"
        @click="$emit('show-failed-reports')"
      >
        查看 {{ stats.failedReports }} 份失敗的報表
      </button>
      <div
        v-if="stats.totalReports > 0"
        class="lead-status"
      >
        <div
          class="st-bar"
          role="img"
          :aria-label="rows.map(r => `${r.label} ${r.value} 份`).join('，')"
        >
          <span
            v-for="row in rows"
            :key="row.label"
            :style="{ flexGrow: row.value, background: row.hue }"
          />
        </div>
        <ul
          class="st-legend"
          aria-label="報表狀態"
        >
          <li
            v-for="row in rows"
            :key="row.label"
          >
            <i :style="{ background: row.hue }" />
            <span class="st-label">{{ row.label }}</span>
            <b>{{ row.value }}</b>
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="stats.totalReports > 0"
      class="week"
      role="img"
      :aria-label="`近 7 天產出：${week.map(d => `${d.label} ${d.count} 份`).join('，')}`"
    >
      <p class="week-h">
        近 7 天產出 <b>{{ weekTotal }}</b> 份
      </p>
      <ul
        class="week-bars"
        aria-hidden="true"
      >
        <li
          v-for="day in week"
          :key="day.key"
          :class="{ today: day.today }"
        >
          <span class="wb-n">{{ day.count || '' }}</span>
          <span
            class="wb-track"
            :class="{ 'is-zero': !day.count }"
          >
            <i
              v-for="seg in day.segs"
              :key="seg.tone"
              :class="seg.tone"
              :style="{ height: seg.h }"
            />
          </span>
          <span class="wb-d">{{ day.label }}</span>
        </li>
      </ul>
    </div>
  </article>
</template>

<script setup lang="ts">
/**
 * StatsLead: the page's lead object. The month figure is the headline; the bars are the
 * completed / processing / failed count as one bar each, taken from the same summary.
 */
import { computed } from 'vue'
import type { DashboardStats, ReportBase } from '@/types/reports'

const props = withDefaults(defineProps<{
  stats: DashboardStats
  loaded: boolean
  reports?: ReportBase[]
}>(), { reports: () => [] })

defineEmits<{
  'show-failed-reports': []
}>()

const completionRate = computed(() => {
  if (props.stats.totalReports === 0) {
    return 0
  }
  return Math.round((props.stats.completedReports / props.stats.totalReports) * 100)
})

// Reports created per day over the last 7 days, from the loaded list (Asia/Taipei days)
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })
const dayLabel = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' })
const week = computed(() => {
  type Tally = { done: number; run: number; fail: number }
  const counts = new Map<string, Tally>()
  for (const report of props.reports) {
    const key = dayKey.format(new Date(report.createdAt))
    const tally = counts.get(key) ?? { done: 0, run: 0, fail: 0 }
    if (report.status === 'failed') { tally.fail += 1 } else if (report.status === 'generating' || report.status === 'pending') { tally.run += 1 } else { tally.done += 1 }
    counts.set(key, tally)
  }
  const now = Date.now()
  const days = Array.from({ length: 7 }, (_, i) => {
    const at = new Date(now - (6 - i) * 864e5)
    const key = dayKey.format(at)
    const t = counts.get(key) ?? { done: 0, run: 0, fail: 0 }
    return { key, label: dayLabel.format(at), count: t.done + t.run + t.fail, t, today: i === 6 }
  })
  const max = Math.max(1, ...days.map(d => d.count))
  return days.map(d => ({
    key: d.key,
    label: d.label,
    count: d.count,
    today: d.today,
    segs: ([['done', d.t.done], ['run', d.t.run], ['fail', d.t.fail]] as const)
      .filter(([, n]) => n > 0)
      .map(([tone, n]) => ({ tone, h: `${(n / max) * 100}%` }))
  }))
})

const weekTotal = computed(() => week.value.reduce((sum, d) => sum + d.count, 0))

const rows = computed(() => {
  const total = Math.max(props.stats.totalReports, 1)
  const row = (label: string, value: number, hue: string) => ({
    label,
    value,
    hue,
    width: value > 0 ? `${Math.max(4, Math.round((value / total) * 100))}%` : '0%',
  })
  return [
    row('已完成', props.stats.completedReports, 'var(--ui-green)'),
    row('處理中', props.stats.pendingReports, 'var(--ui-orange)'),
    row('失敗', props.stats.failedReports, 'var(--ui-red)'),
  ]
})
</script>

<style scoped>
.lead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px 48px;
  align-items: center;
  padding: 28px 40px;
}

.lead:not(:has(.lead-status)) {
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
  color: var(--ui-ink-2);
}

.lead-num {
  margin-top: 4px;
  font: 600 56px / 1.05 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.lead-num.is-dim {
  color: var(--ui-muted);
}

.lead-num small {
  margin-left: 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.lead-meaning b {
  font-weight: 600;
  color: var(--ui-ink);
}

.week-h {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.week-h b {
  font: 600 18px var(--ui-font-display);
  color: var(--ui-ink);
}

.week-bars {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.week-bars li {
  display: grid;
  grid-template-rows: 20px 110px auto;
  gap: 6px;
  justify-items: center;
}

.wb-n {
  font: 600 15px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
}

.today .wb-n {
  color: var(--ui-ink);
}

.wb-track {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  width: 100%;
  max-width: 44px;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
}

.wb-track i {
  display: block;
  width: 100%;
  min-height: 10px;
  border-radius: 6px;
}

.wb-track .done {
  background: var(--ui-green);
}

.wb-track .run {
  background: var(--ui-orange);
}

.wb-track .fail {
  background: var(--ui-red);
}

.wb-track.is-zero {
  position: relative;
}

.wb-track.is-zero::after {
  position: absolute;
  right: 30%;
  bottom: 0;
  left: 30%;
  height: 3px;
  border-radius: 2px;
  background: var(--ui-fill-strong);
  content: '';
}

.wb-d {
  font-size: 13px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.today .wb-d {
  font-weight: 700;
  color: var(--ui-ink);
}

.lead-meaning {
  margin-top: 6px;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.action-link {
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 14px;
}

.lead-status {
  display: grid;
  gap: 12px;
  width: 100%;
  margin-top: 20px;
}

.week {
  position: relative;
  display: grid;
  gap: 10px;
  min-width: 0;
}

.week::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -24px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.st-bar {
  display: flex;
  gap: 3px;
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
}

.st-bar span {
  flex-basis: 0;
  min-width: 0;
}

.st-bar span[style*='flex-grow: 0'] {
  display: none;
}

.st-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.st-legend li {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.st-legend i {
  align-self: center;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.st-label {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.st-legend b {
  font: 600 20px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .lead-num {
    font-size: 48px;
  }

  .week::before {
    display: none;
  }

  .week-bars {
    gap: 6px;
  }

  .week-bars li {
    grid-template-rows: auto 64px auto;
  }

  .lead-status {
    margin-top: 16px;
  }

  .lead-meaning {
    font-size: 14px;
  }
}
</style>
