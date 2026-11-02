<template>
  <section
    class="ui-lead cov"
    aria-label="這份報表涵蓋的期間"
  >
    <div class="cov-text">
      <p class="cov-kicker">
        這份報表
      </p>
      <ul class="cov-sentence">
        <li>
          <span class="cov-pre">產生</span>
          <button
            type="button"
            class="tok"
            :class="{ 'is-open': !typeLabel }"
            @click="$emit('jump', 'type')"
          >
            {{ typeLabel || '尚未選擇類型' }}
          </button>
        </li>
        <li>
          <span class="cov-pre">涵蓋</span>
          <button
            type="button"
            class="tok"
            :class="{ 'is-open': !rangeLabel }"
            @click="$emit('jump', 'range')"
          >
            {{ rangeLabel || '尚未選擇期間' }}
          </button>
        </li>
        <li>
          <span class="cov-pre">輸出為</span>
          <button
            type="button"
            class="tok"
            @click="$emit('jump', 'format')"
          >
            {{ formatLabel }}
          </button>
        </li>
      </ul>
    </div>

    <figure
      class="cov-grid-wrap"
      :aria-label="caption"
    >
      <div class="cov-count">
        <b>{{ span.days || '—' }}</b>
        <span>{{ span.days ? '天' : '' }}</span>
        <em class="cov-cap">{{ span.days ? `${span.from} – ${span.to}` : '選擇期間後，涵蓋的日子會亮起' }}</em>
      </div>
      <div
        class="cov-grid"
        role="img"
        :aria-label="caption"
        :style="{ '--weeks': weeks.count }"
      >
        <span
          v-for="m in weeks.months"
          :key="m.col"
          class="cov-m"
          :style="{ gridColumn: `${m.col} / span 3` }"
        >{{ m.label }}</span>
        <i
          v-for="cell in weeks.cells"
          :key="cell.n"
          class="cov-c"
          :class="{ on: cell.on, today: cell.today }"
          :style="{ gridColumn: cell.col, gridRow: cell.row }"
        />
      </div>
    </figure>
  </section>
</template>

<script setup lang="ts">
/**
 * ReportCoverage: the lead of the generate page. The request reads as one sentence (type,
 * period, format; each token jumps to its step) and the chosen period is drawn on a week
 * calendar ending today, so "過去 30 天" or "上季" is a shape you can see, not a label.
 */
import { computed } from 'vue'
import type { ReportTimeRange } from '@/types/reports'

const props = defineProps<{
  typeLabel: string
  timeRange: ReportTimeRange | ''
  startDate: string
  endDate: string
  rangeLabel: string
  formatLabel: string
}>()

defineEmits<{ jump: [step: 'type' | 'range' | 'format'] }>()

const DAY = 864e5
const OFFSET = 8 * 36e5 // Asia/Taipei
const dayNo = (ms: number): number => Math.floor((ms + OFFSET) / DAY)
const utcDay = (y: number, m: number, d: number): number => Math.floor(Date.UTC(y, m, d) / DAY)
const fmt = (n: number): string => {
  const d = new Date(n * DAY)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

const today = computed(() => dayNo(Date.now()))

// [from, to] as day numbers, or null while the range is unknown
const range = computed<[number, number] | null>(() => {
  const t = today.value
  const now = new Date(Date.now() + OFFSET)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  switch (props.timeRange) {
    case 'last_24_hours': return [t - 1, t]
    case 'last_7_days': return [t - 7, t]
    case 'last_30_days': return [t - 30, t]
    case 'last_90_days': return [t - 90, t]
    case 'current_month': return [utcDay(y, m, 1), t]
    case 'last_month': return [utcDay(y, m - 1, 1), utcDay(y, m, 1) - 1]
    case 'current_quarter': return [utcDay(y, Math.floor(m / 3) * 3, 1), t]
    case 'last_quarter': return [utcDay(y, Math.floor(m / 3) * 3 - 3, 1), utcDay(y, Math.floor(m / 3) * 3, 1) - 1]
    case 'current_year': return [utcDay(y, 0, 1), t]
    case 'last_year': return [utcDay(y - 1, 0, 1), utcDay(y, 0, 1) - 1]
    case 'custom': {
      if (!props.startDate || !props.endDate) { return null }
      const a = Math.floor(Date.parse(`${props.startDate}T00:00:00Z`) / DAY)
      const b = Math.floor(Date.parse(`${props.endDate}T00:00:00Z`) / DAY)
      return Number.isNaN(a) || Number.isNaN(b) || a > b ? null : [a, b]
    }
    default: return null
  }
})

const span = computed(() => {
  const r = range.value
  return r ? { days: r[1] - r[0] + 1, from: fmt(r[0]), to: fmt(r[1]) } : { days: 0, from: '', to: '' }
})

const caption = computed(() => (span.value.days ? `涵蓋 ${span.value.from} 至 ${span.value.to}，共 ${span.value.days} 天` : '尚未選擇期間'))

// Monday-first week columns ending with this week; wider when the period reaches further back
const weeks = computed(() => {
  const t = today.value
  const dow = (n: number): number => (n + 3) % 7
  const r = range.value
  const reach = r ? t - r[0] : 0
  const count = Math.min(60, Math.max(13, Math.ceil(reach / 7) + 2))
  const start = t - dow(t) - (count - 1) * 7
  const cells: Array<{ n: number; col: number; row: number; on: boolean; today: boolean }> = []
  const months: Array<{ col: number; label: string }> = []
  let lastMonth = -1
  for (let col = 0; col < count; col += 1) {
    const monday = start + col * 7
    const mo = new Date(monday * DAY).getUTCMonth()
    if (mo !== lastMonth) {
      if (months.length === 0 || col - (months[months.length - 1]?.col ?? 0) >= 3) { months.push({ col: col + 1, label: `${mo + 1} 月` }) }
      lastMonth = mo
    }
    for (let row = 0; row < 7; row += 1) {
      const n = monday + row
      if (n > t) { continue }
      cells.push({ n, col: col + 1, row: row + 2, on: !!r && n >= r[0] && n <= r[1], today: n === t })
    }
  }
  return { count, cells, months }
})
</script>

<style scoped>
.cov {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px 56px;
  align-items: center;
  padding: 28px 36px;
}

.cov-kicker {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.cov-sentence {
  display: grid;
  gap: 10px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.cov-sentence li {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.cov-pre {
  flex: none;
  width: 3.4em;
  font: 400 22px / 1.3 var(--ui-font-display);
  color: var(--ui-ink-2);
}

.tok {
  display: inline;
  margin: 0;
  padding: 2px 10px;
  border: 0;
  border-radius: 12px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
  font: 600 28px / 1.3 var(--ui-font-display);
  letter-spacing: -0.02em;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.tok:hover {
  background: color-mix(in srgb, var(--ui-accent) 14%, var(--ui-surface));
}

.tok.is-open {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.cov-grid-wrap {
  display: grid;
  gap: 10px;
  margin: 0;
}

.cov-count {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.cov-count b {
  font: 600 44px / 1 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}

.cov-count span {
  font-size: 18px;
  color: var(--ui-muted);
}

.cov-grid {
  display: grid;
  grid-template-columns: repeat(var(--weeks), 27px);
  grid-template-rows: 18px repeat(7, 27px);
  gap: 3px;
  max-width: 100%;
}

.cov-m {
  grid-row: 1;
  font-size: 13px;
  white-space: nowrap;
  color: var(--ui-muted);
}

.cov-c {
  display: block;
  border-radius: 6px;
  background: var(--ui-fill);
}

.cov-c.on {
  background: var(--ui-accent);
}

.cov-c.today {
  box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 3.5px var(--ui-ink);
}

.cov-cap {
  margin-left: auto;
  font-size: 15px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
}

@media (max-width: 1280px) {
  .cov {
    grid-template-columns: minmax(0, 1fr);
  }

  .cov-grid-wrap {
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 20px;
    align-items: center;
  }

  .cov-count {
    flex-wrap: wrap;
    max-width: 84px;
  }

  .cov-cap {
    flex: 1 0 100%;
    margin: 0;
    font-size: 14px;
  }
}

@media (max-width: 768px) {
  .cov {
    gap: 14px;
    padding: 20px;
  }

  .cov-pre {
    font-size: 18px;
  }

  .tok {
    font-size: 22px;
  }

  .cov-grid {
    grid-template-columns: repeat(var(--weeks), minmax(0, 1fr));
    grid-template-rows: 16px repeat(7, auto);
    gap: 2px;
  }

  .cov-c {
    aspect-ratio: 1;
    border-radius: 4px;
  }

  .cov-count b {
    font-size: 34px;
  }
}
</style>
