<!--
  ActivityStatsCards.vue
  Signature of the activity page (admins): the period as a row of day tiles, shaded by how busy that day was
  (a week heat calendar, one tile per day of dailyStats). The busiest day carries a ring, a day far below
  the average is orange and named. The sentence above gives the total, the members and the restorable count.
  Nothing is invented: every figure is the overview's totalActivities / activeUserCount / restorableCount / dailyStats.
-->
<template>
  <article
    v-if="loading || overview !== null"
    class="ui-lead wk"
    aria-label="活動概覽（管理員）"
    :aria-busy="loading || overview === null || undefined"
  >
    <header class="wk-head">
      <h2 class="wk-title">
        {{ periodLabel || '活動概覽' }}
      </h2>
      <p
        v-if="overview && !loading"
        class="wk-sum"
      >
        <b>{{ overview.totalActivities.toLocaleString('zh-TW') }}</b> 筆操作<span
          v-for="part in meaning"
          :key="part"
          class="wk-part"
        >{{ part }}</span>
      </p>
    </header>

    <ol
      v-if="days.length > 0 && !loading"
      class="wk-days"
      :class="{ 'is-many': days.length > 10 }"
      :aria-label="`${periodLabel}每日活動數`"
    >
      <li
        v-for="day in days"
        :key="day.key"
        class="wk-day"
        :class="{ 'is-peak': day.peak, 'is-low': day.low, 'is-today': day.today }"
        :style="{ '--lv': day.level }"
      >
        <span class="wk-wd">{{ day.label }}</span>
        <b class="wk-n">{{ day.count.toLocaleString('en-US') }}</b>
        <span class="wk-date">{{ day.date }}</span>
        <span
          v-if="day.peak || day.low"
          class="wk-flag"
        >{{ day.peak ? '最忙' : '偏少' }}</span>
      </li>
    </ol>
    <div
      v-else-if="loading"
      class="wk-skel"
      aria-hidden="true"
    />
    <div
      v-if="days.length > 0 && !loading"
      class="wk-foot"
    >
      <p class="wk-note">
        {{ note || '顏色越深代表當天操作越多。' }}
      </p>
      <span
        class="wk-scale"
        aria-hidden="true"
      >少<i /><i /><i /><i /><i />多</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityOverview } from '@/api/activities'
import { isActivityRestoreEnabled } from '@/config/runtime'

const props = defineProps<{
  overview: ActivityOverview | null
  loading: boolean
}>()

/** The restorable count only means something while the restore feature is on. */
const showRestorable = isActivityRestoreEnabled()

const periodLabel = computed(() => (props.overview ? `近 ${props.overview.period.days} 天` : ''))

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const average = computed(() => {
  const daily = props.overview?.dailyStats ?? []
  return daily.length > 0 ? daily.reduce((sum, d) => sum + d.count, 0) / daily.length : 0
})

/** One tile per day; level is the day's share of the busiest day (0 to 1) and drives the shade */
const days = computed(() => {
  const daily = props.overview?.dailyStats ?? []
  const max = Math.max(0, ...daily.map(d => d.count))
  if (max === 0) { return [] }
  const todayKey = dayKey(new Date())
  return daily.map((d) => {
    const day = new Date(`${d.date}T00:00:00`)
    const valid = !Number.isNaN(day.getTime())
    return {
      key: d.date,
      label: d.date === todayKey ? '今天' : (valid ? `週${WEEKDAYS[day.getDay()]}` : d.date.slice(5)),
      date: valid ? `${day.getMonth() + 1}/${day.getDate()}` : d.date.slice(5).replace('-', '/'),
      count: d.count,
      level: Number((d.count / max).toFixed(3)),
      peak: d.count === max,
      low: d.count < average.value * 0.4,
      today: d.date === todayKey
    }
  })
})

/** Say why a tile is flagged: name the quietest day when it is far below the daily average */
const note = computed(() => {
  const daily = props.overview?.dailyStats ?? []
  if (daily.length < 3) { return '' }
  const avg = average.value
  const low = daily.reduce((a, b) => (b.count < a.count ? b : a))
  if (avg <= 0 || low.count >= avg * 0.4) { return '' }
  const day = new Date(`${low.date}T00:00:00`)
  const name = Number.isNaN(day.getTime()) ? low.date : `週${WEEKDAYS[day.getDay()]}`
  return `顏色越深代表當天操作越多。${name}僅 ${low.count.toLocaleString('en-US')} 筆，約為日均的 ${Math.round((low.count / avg) * 100)}%。`
})

const meaning = computed<string[]>(() => {
  const overview = props.overview
  if (!overview) { return [] }
  const parts = [`${overview.activeUserCount} 位成員`]
  if (showRestorable) { parts.push(`${overview.restorableCount} 筆可還原`) }
  if (average.value > 0) { parts.push(`日均 ${Math.round(average.value).toLocaleString('en-US')} 筆`) }
  return parts
})
</script>

<style scoped>
.wk {
  display: grid;
  gap: 16px;
  padding: 22px 28px 20px;
}

.wk-head {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  align-items: baseline;
}

.wk-title {
  margin: 0;
  font: 600 19px / 1.3 var(--ui-font-display);
  letter-spacing: -0.015em;
}

.wk-sum {
  margin: 0;
  font-size: 14px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.wk-part {
  white-space: nowrap;
}

.wk-part::before {
  margin: 0 8px;
  content: '·';
}

.wk-sum b {
  font: 600 17px var(--ui-font-display);
  color: var(--ui-ink);
}

/* tiles: weekday, count, date; the shade is the day's share of the busiest day */
.wk-days {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  grid-auto-flow: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wk-days.is-many {
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  grid-auto-flow: row;
}

.wk-day {
  position: relative;
  display: grid;
  gap: 2px;
  justify-items: center;
  align-content: start;
  padding: 14px 6px 12px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--ui-green) calc(var(--lv) * 30%), var(--ui-surface-2));
  text-align: center;
}

.wk-day.is-peak {
  box-shadow: 0 0 0 2px var(--ui-green-ink);
}

/* a quiet day is plain, not alarming: the flag names it, colour stays for the shade scale */
.wk-day.is-low {
  background: var(--ui-surface-2);
}

.wk-wd {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.wk-day.is-today .wk-wd {
  color: var(--ui-ink);
}

.wk-n {
  font: 600 28px / 1.2 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.wk-date {
  font-size: 13px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.wk-flag {
  margin-top: 4px;
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--ui-surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.wk-day.is-low .wk-flag {
  color: var(--ui-ink-2);
}

.wk-day.is-peak .wk-flag {
  color: var(--ui-green-ink);
}

.wk-skel {
  height: 112px;
  border-radius: 18px;
  background: var(--ui-fill);
}

.wk-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  align-items: center;
  justify-content: space-between;
}

.wk-note {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.wk-scale {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 13px;
  color: var(--ui-muted);
}

.wk-scale i {
  width: 18px;
  height: 12px;
  border-radius: 4px;
}

.wk-scale i:nth-of-type(1) { background: color-mix(in srgb, var(--ui-green) 6%, var(--ui-surface-2)); }
.wk-scale i:nth-of-type(2) { background: color-mix(in srgb, var(--ui-green) 12%, var(--ui-surface-2)); }
.wk-scale i:nth-of-type(3) { background: color-mix(in srgb, var(--ui-green) 18%, var(--ui-surface-2)); }
.wk-scale i:nth-of-type(4) { background: color-mix(in srgb, var(--ui-green) 24%, var(--ui-surface-2)); }
.wk-scale i:nth-of-type(5) { background: color-mix(in srgb, var(--ui-green) 30%, var(--ui-surface-2)); }

@media (max-width: 768px) {
  .wk {
    gap: 14px;
    padding: 18px 14px 16px;
  }

  .wk-head {
    padding: 0 4px;
  }

  .wk-days {
    gap: 5px;
  }

  .wk-day {
    padding: 10px 0 8px;
    border-radius: 14px;
  }

  .wk-n {
    font-size: 19px;
  }

  .wk-date,
  .wk-part:last-child {
    display: none;
  }

  .wk-flag {
    padding: 0 6px;
  }

  .wk-note {
    padding: 0 4px;
  }
}
</style>
