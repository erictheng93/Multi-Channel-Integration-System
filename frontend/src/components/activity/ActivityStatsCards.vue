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
import { getActionLabel } from './utils'

const props = defineProps<{
  overview: ActivityOverview | null
  loading: boolean
}>()

/** The restorable count only means something while the restore feature is on. */
const showRestorable = isActivityRestoreEnabled()

const topAction = computed(() => {
  if (!props.overview) { return null }
  const entries = Object.entries(props.overview.actionStats)
  if (entries.length === 0) { return null }
  const [name, count] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { label: getActionLabel(name), count }
})

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

/** The two named facts the old rings carried, now as plain lines under the number */
const highlights = computed(() => {
  const overview = props.overview
  if (!overview || overview.totalActivities <= 0) { return [] }
  const list: { label: string, text: string }[] = []
  const topUser = overview.topUsers[0]
  if (topUser) { list.push({ label: '最活躍', text: `${topUser.user_name} · ${topUser.count.toLocaleString('en-US')} 筆` }) }
  if (topAction.value) { list.push({ label: '最常見', text: `${topAction.value.label} · ${topAction.value.count.toLocaleString('en-US')} 筆` }) }
  return list
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
  min-width: 3.5em;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}
.highlights b {
  font-weight: 600;
  color: var(--ui-ink);
}
</style>
