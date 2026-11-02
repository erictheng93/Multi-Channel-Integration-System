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
      summary="活動分布"
      :rings="rings"
      :size="144"
    >
      <span
        v-if="bars.length > 0 && !loading"
        class="bars"
        role="img"
        :aria-label="barsLabel"
      >
        <i
          v-for="bar in bars"
          :key="bar.date"
          :class="{ hi: bar.hi }"
          :style="{ height: bar.height }"
        />
      </span>
    </RingLead>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityOverview } from '@/api/activities'
import { isActivityRestoreEnabled } from '@/config/runtime'
import RingLead from '@/components/lead/RingLead.vue'
import type { ServiceRing } from '@/components/ui/ServiceRings.vue'
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

const BAR_MAX_PX = 26
const bars = computed(() => {
  const daily = props.overview?.dailyStats ?? []
  const max = Math.max(0, ...daily.map(d => d.count))
  if (max === 0) { return [] }
  return daily.map(d => ({
    date: d.date,
    hi: d.count === max,
    height: `${Math.max(3, Math.round((d.count / max) * BAR_MAX_PX))}px`
  }))
})

const barsLabel = computed(() => {
  const daily = props.overview?.dailyStats ?? []
  const peak = daily.reduce((a, b) => (b.count > a.count ? b : a), { date: '', count: 0 })
  return `${periodLabel.value}每日活動數，${peak.date.slice(5).replace('-', '/')} 最多 ${peak.count} 筆`
})

const rings = computed<ServiceRing[]>(() => {
  const overview = props.overview
  const total = overview?.totalActivities ?? 0
  if (!overview || total <= 0) { return [] }
  const list: ServiceRing[] = []
  const topUser = overview.topUsers[0]
  if (topUser) {
    list.push({ label: `最活躍：${topUser.user_name}`, value: topUser.count, total, of: '筆', hue: 'var(--section-hue)' })
  }
  if (topAction.value) {
    list.push({ label: `最常見：${topAction.value.label}`, value: topAction.value.count, total, of: '筆', hue: 'var(--ui-blue)' })
  }
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
.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 140px;
  height: 28px;
  margin-top: 14px;
}
.bars i {
  flex: 1;
  min-height: 3px;
  border-radius: 2px 2px 0 0;
  background: color-mix(in srgb, var(--section-hue) 30%, transparent);
}
.bars i.hi {
  background: var(--section-hue);
}
</style>
