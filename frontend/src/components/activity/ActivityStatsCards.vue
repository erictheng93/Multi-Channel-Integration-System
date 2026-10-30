<template>
  <div
    v-if="loading || overview !== null"
    class="stats-grid"
    aria-label="活動概覽（管理員）"
  >
    <RingLead
      kicker="總活動"
      :value="overview ? overview.totalActivities.toLocaleString('zh-TW') : ''"
      unit="筆"
      :meaning="meaning"
      :busy="loading || overview === null"
    >
      <ul
        v-if="highlights.length > 0 && !loading"
        class="highlights"
      >
        <li
          v-for="item in highlights"
          :key="item.label"
        >
          <span>{{ item.label }}</span>
          <b>{{ item.text }}</b>
        </li>
      </ul>
      <template
        v-if="bars.length > 0 && !loading"
        #visual
      >
        <LeadBars
          :summary="`${periodLabel}每日活動數`"
          :bars="bars"
          :height="104"
          :caption="lowNote"
        />
      </template>
    </RingLead>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityOverview } from '@/api/activities'
import { isActivityRestoreEnabled } from '@/config/runtime'
import RingLead from '@/components/lead/RingLead.vue'
import LeadBars, { type LeadBar } from '@/components/lead/LeadBars.vue'

const props = defineProps<{
  overview: ActivityOverview | null
  loading: boolean
}>()

/** The restorable count only means something while the restore feature is on. */
const showRestorable = isActivityRestoreEnabled()

const periodLabel = computed(() => (props.overview ? `近 ${props.overview.period.days} 天` : ''))

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** One bar per day of the period; the busiest day is the subject, the rest sit back */
const bars = computed<LeadBar[]>(() => {
  const daily = props.overview?.dailyStats ?? []
  const max = Math.max(0, ...daily.map(d => d.count))
  if (max === 0) { return [] }
  return daily.map((d) => {
    const day = new Date(`${d.date}T00:00:00`)
    const weekday = Number.isNaN(day.getTime()) ? '' : `週${WEEKDAYS[day.getDay()]}`
    return {
      key: d.date,
      label: weekday || d.date.slice(5).replace('-', '/'),
      value: d.count,
      display: d.count.toLocaleString('en-US'),
      current: d.count === max
    }
  })
})

/** Two plain facts the bars do not print: the latest day and the daily average of the period */
const highlights = computed(() => {
  const overview = props.overview
  if (!overview || overview.totalActivities <= 0) { return [] }
  const daily = overview.dailyStats
  if (daily.length === 0) { return [] }
  const latest = daily[daily.length - 1]
  const today = new Date()
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const average = Math.round(daily.reduce((sum, d) => sum + d.count, 0) / daily.length)
  return [
    { label: latest?.date === key ? '今天' : '最近一天', text: `${(latest?.count ?? 0).toLocaleString('en-US')} 筆` },
    { label: '日均', text: `${average.toLocaleString('en-US')} 筆` },
  ]
})

/** Say why a bar is nearly empty: name the quietest day when it is far below the daily average */
const lowNote = computed(() => {
  const daily = props.overview?.dailyStats ?? []
  if (daily.length < 3) { return '' }
  const average = daily.reduce((sum, d) => sum + d.count, 0) / daily.length
  const low = daily.reduce((a, b) => (b.count < a.count ? b : a))
  if (average <= 0 || low.count >= average * 0.4) { return '' }
  const day = new Date(`${low.date}T00:00:00`)
  const name = Number.isNaN(day.getTime()) ? low.date : `週${WEEKDAYS[day.getDay()]}`
  return `${name}僅 ${low.count.toLocaleString('en-US')} 筆，約為日均的 ${Math.round((low.count / average) * 100)}%。`
})

const meaning = computed(() => {
  const overview = props.overview
  if (!overview) { return '' }
  const parts = [`${periodLabel.value} · ${overview.activeUserCount} 位成員`]
  if (showRestorable) { parts.push(`${overview.restorableCount} 筆可還原`) }
  return parts.join(' · ')
})
</script>


<style scoped>
/* Reset the legacy global .stats-grid (styles/variables.css) */
.stats-grid {
  display: block;
  margin: 0;
  padding: 0;
}
.stats-grid :deep(.lb-slot) {
  box-shadow: inset 0 -1px 0 var(--ui-sep);
}
.stats-grid :deep(.lb-col.has-current:not(.is-current) .lb-bar) {
  opacity: 0.82;
}
.stats-grid :deep(.lb-label) {
  color: var(--ui-ink-2);
}
.highlights {
  display: grid;
  gap: 6px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.highlights li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: 14px;
}
.highlights span {
  min-width: 4.5em;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}
.highlights b {
  font-weight: 600;
  color: var(--ui-ink);
}
</style>
