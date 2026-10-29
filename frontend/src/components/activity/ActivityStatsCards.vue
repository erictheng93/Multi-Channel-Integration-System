<template>
  <div
    v-if="loading || overview !== null"
    class="stats-grid"
    :class="{ 'stats-grid--three': !showRestorable }"
    aria-label="活動概覽（管理員）"
  >
    <template v-if="loading">
      <div
        v-for="i in skeletonCount"
        :key="i"
        class="ui-card ui-kpi stat-card stat-card--skeleton"
      >
        <div class="skeleton-label shimmer" />
        <div class="skeleton-value shimmer" />
        <div class="skeleton-subtitle shimmer" />
      </div>
    </template>
    <template v-else-if="overview !== null">
      <article
        v-for="card in cards"
        :key="card.key"
        class="ui-card ui-kpi stat-card"
      >
        <div class="ui-kpi-top stat-card__top">
          <span
            class="ui-kpi-ico"
            :style="{ background: card.soft, color: card.ink }"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path :d="card.icon" /></svg>
          </span>
          <span class="stat-label">{{ card.label }}</span>
        </div>
        <div
          class="stat-value"
          :class="card.compact ? 'stat-value--text' : 'ui-kpi-value'"
        >
          {{ card.value }}<small v-if="card.unit">{{ card.unit }}</small>
        </div>
        <div class="ui-kpi-foot stat-subtitle">
          <span>{{ card.subtitle }}</span>
          <span
            v-if="card.key === 'total' && bars.length > 0"
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
        </div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityOverview } from '@/api/activities'
import { isActivityRestoreEnabled } from '@/config/runtime'
import { getActionLabel, getRoleLabel } from './utils'

const props = defineProps<{
  overview: ActivityOverview | null
  loading: boolean
}>()

/** The restorable count only means something while the restore feature is on. */
const showRestorable = isActivityRestoreEnabled()
const skeletonCount = showRestorable ? 4 : 3

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

interface StatCard {
  key: string
  label: string
  value: string | number
  unit?: string
  compact?: boolean
  subtitle: string
  soft: string
  ink: string
  icon: string
}

const cards = computed<StatCard[]>(() => {
  const overview = props.overview
  if (!overview) { return [] }
  const topUser = overview.topUsers[0]
  const total = overview.totalActivities
  const list: StatCard[] = [
    {
      key: 'total',
      label: '總活動',
      value: total.toLocaleString('zh-TW'),
      subtitle: periodLabel.value,
      soft: 'var(--ui-accent-soft)',
      ink: 'var(--ui-accent)',
      icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
    },
    {
      key: 'users',
      label: '最活躍成員',
      value: topUser ? topUser.user_name : '—',
      compact: true,
      subtitle: topUser
        ? `${topUser.count.toLocaleString('zh-TW')} 筆 · ${getRoleLabel(topUser.user_role)}`
        : '此期間沒有活動',
      soft: 'var(--ui-green-soft)',
      ink: 'var(--ui-green-ink)',
      icon: 'M2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'
    },
    {
      key: 'action',
      label: '最常見操作',
      value: topAction.value ? topAction.value.label : '—',
      compact: true,
      subtitle: topAction.value && total > 0
        ? `${topAction.value.count.toLocaleString('zh-TW')} 筆，佔 ${Math.round((topAction.value.count / total) * 100)}%`
        : '此期間沒有活動',
      soft: 'var(--ui-indigo-soft)',
      ink: 'var(--ui-indigo)',
      icon: 'm22 2-7 20-4-9-9-4Z'
    }
  ]
  if (showRestorable) {
    list.push({
      key: 'restorable',
      label: '可還原',
      value: overview.restorableCount,
      unit: '筆',
      subtitle: '期限內、尚未還原的操作',
      soft: 'var(--ui-orange-soft)',
      ink: 'var(--ui-orange-ink)',
      icon: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'
    })
  }
  return list
})
</script>

<style scoped>
/* Reset the legacy global .stats-grid / .stat-card (styles/variables.css) */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 0;
}
.stat-card {
  align-items: stretch;
  gap: 10px;
  padding: 18px 20px 16px;
  border: 0;
  border-radius: var(--ui-r-card);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-card);
  text-align: left;
}
.stat-card:hover {
  transform: none;
  box-shadow: var(--ui-shadow-card);
}
.stats-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-value--text {
  display: flex;
  align-items: center;
  min-height: 34px;
  overflow: hidden;
  font: 600 22px / 1.15 var(--ui-font-display);
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 84px;
  height: 26px;
  margin-left: auto;
}
.bars i {
  flex: 1;
  min-height: 3px;
  border-radius: 2px 2px 0 0;
  background: color-mix(in srgb, var(--ui-accent) 30%, transparent);
}
.bars i.hi {
  background: var(--ui-accent);
}

/* Skeleton */
.skeleton-label,
.skeleton-value,
.skeleton-subtitle {
  border-radius: 6px;
  background: var(--ui-fill);
}
.skeleton-label {
  width: 60%;
  height: 12px;
}
.skeleton-value {
  width: 40%;
  height: 28px;
}
.skeleton-subtitle {
  width: 50%;
  height: 12px;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
.shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}

@media (max-width: 1280px) {
  .stats-grid,
  .stats-grid--three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 480px) {
  .bars {
    display: none;
  }
  .stat-value--text {
    font-size: 18px;
  }
}
</style>
