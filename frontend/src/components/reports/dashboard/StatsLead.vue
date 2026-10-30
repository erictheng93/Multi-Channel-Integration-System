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
    </div>

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
      <div
        class="week"
        role="img"
        :aria-label="`近 7 天產出：${week.map(d => `${d.label} ${d.count} 份`).join('，')}`"
      >
        <p class="week-h">
          近 7 天產出 <b>{{ weekTotal }}</b> 份
        </p>
        <svg
          class="spark"
          viewBox="0 0 280 56"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            class="spark-area"
            :d="sparkArea"
          />
          <path
            class="spark-line"
            :d="sparkLine"
          />
        </svg>
        <div class="week-axis">
          <span>{{ week[0]?.label }}</span>
          <span>今天</span>
        </div>
      </div>
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
  const counts = new Map<string, number>()
  for (const report of props.reports) {
    const key = dayKey.format(new Date(report.createdAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const now = Date.now()
  const days = Array.from({ length: 7 }, (_, i) => {
    const at = new Date(now - (6 - i) * 864e5)
    const key = dayKey.format(at)
    return { key, label: dayLabel.format(at), count: counts.get(key) ?? 0, today: i === 6 }
  })
  const max = Math.max(1, ...days.map(d => d.count))
  return days.map(d => ({ ...d, h: d.count ? `${Math.max(8, Math.round((d.count / max) * 100))}%` : '3px' }))
})

const weekTotal = computed(() => week.value.reduce((sum, d) => sum + d.count, 0))
const sparkPoints = computed(() => {
  const max = Math.max(1, ...week.value.map(d => d.count))
  return week.value.map((d, i) => [Math.round((i / 6) * 280), Math.round(50 - (d.count / max) * 44)] as const)
})
const sparkLine = computed(() => sparkPoints.value.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '))
const sparkArea = computed(() => `${sparkLine.value} L280 56 L0 56 Z`)

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
  gap: 20px 40px;
  align-items: center;
  padding: 24px 40px;
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

.week {
  display: grid;
  gap: 6px;
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

.spark {
  display: block;
  width: 100%;
  height: 56px;
}

.spark-line {
  fill: none;
  stroke: var(--ui-accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.spark-area {
  fill: var(--ui-accent-soft);
}

.week-axis {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
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
  position: relative;
  display: grid;
  gap: 14px;
  min-width: 0;
}

.lead-status::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -20px;
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

  .lead-status::before {
    display: none;
  }

  .lead-meaning {
    font-size: 14px;
  }
}
</style>
