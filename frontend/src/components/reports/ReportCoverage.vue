<template>
  <section
    class="ui-lead cov"
    aria-label="這份報表涵蓋的期間"
  >
    <div class="cov-top">
      <div class="cov-text">
        <p class="cov-kicker">
          這份報表
        </p>
        <p class="cov-sentence">
          <span class="cov-pre">產生</span>
          <button
            type="button"
            class="tok"
            :class="{ 'is-open': !typeLabel }"
            @click="$emit('jump', 'type')"
          >
            {{ typeLabel || '尚未選擇類型' }}
          </button>
          <span class="cov-pre">涵蓋</span>
          <button
            type="button"
            class="tok"
            :class="{ 'is-open': !rangeLabel }"
            @click="$emit('jump', 'range')"
          >
            {{ rangeLabel || '尚未選擇期間' }}
          </button>
          <span class="cov-pre">輸出為</span>
          <button
            type="button"
            class="tok"
            @click="$emit('jump', 'format')"
          >
            {{ formatLabel }}
          </button>
        </p>
      </div>

      <p class="cov-count">
        <b>{{ span.days || '—' }}</b>
        <span v-if="span.days">天</span>
        <em class="cov-cap">{{ span.days ? `${span.from} – ${span.to}` : '選擇期間後顯示' }}</em>
      </p>
    </div>

    <figure
      class="cov-line"
      :aria-label="caption"
    >
      <div
        class="cov-track"
        role="img"
        :aria-label="caption"
      >
        <i
          v-if="line.seg"
          class="cov-seg"
          :style="{ left: line.seg.left, width: line.seg.width }"
        />
      </div>
      <div
        class="cov-axis"
        aria-hidden="true"
      >
        <span
          v-for="tick in line.ticks"
          :key="tick.left"
          class="cov-tick"
          :style="{ left: tick.left }"
        >{{ tick.label }}</span>
        <span class="cov-tick is-today">今天 {{ line.todayLabel }}</span>
      </div>
      <figcaption class="cov-key">
        <span><i class="on" />藍色段是這份報表的期間</span>
        <span>時間軸為最近 {{ line.window }} 天</span>
      </figcaption>
    </figure>
  </section>
</template>

<script setup lang="ts">
/**
 * ReportCoverage: the lead of the generate page. The request reads as one sentence (type,
 * period, format; each token jumps to its step) and the chosen period is drawn as a segment on
 * a labelled timeline that ends today, so "過去 30 天" or "上季" is a shape you can see, not a label.
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

const WINDOWS = [30, 90, 180, 365, 730, 1460]
const MAX_TICKS = 5

// The axis reaches back far enough that the segment never fills it, then names the month starts inside it
const line = computed(() => {
  const t = today.value
  const r = range.value
  const reach = r ? t - r[0] + 1 : 30
  const window = WINDOWS.find(w => w >= reach * 1.25) ?? Math.ceil(reach * 1.25)
  const start = t - window
  const pos = (n: number): number => ((n - start) / window) * 100
  const pct = (v: number): string => `${Math.min(100, Math.max(0, v)).toFixed(2)}%`

  const seg = r ? { left: `min(${pct(pos(r[0]))}, calc(100% - 8px))`, width: `max(8px, ${pct(pos(r[1] + 1) - pos(r[0]))})` } : null

  const months: Array<{ n: number; label: string }> = []
  const first = new Date(start * DAY)
  const year = first.getUTCFullYear()
  let month = first.getUTCMonth() + 1
  for (let guard = 0; guard < 60; guard += 1) {
    const day = utcDay(year, month, 1)
    if (day >= t) { break }
    const d = new Date(day * DAY)
    months.push({ n: day, label: window > 365 ? `${String(d.getUTCFullYear()).slice(2)}/${d.getUTCMonth() + 1}` : `${d.getUTCMonth() + 1} 月` })
    month += 1
  }
  const step = Math.max(1, Math.ceil(months.length / MAX_TICKS))
  // the "today" label owns the right end; a month label that close would collide with it
  const ticks = months
    .filter((_, i) => i % step === 0)
    .filter(item => pos(item.n) > 6 && pos(item.n) < 80)
    .map(item => ({ left: pct(pos(item.n)), label: item.label }))
  return { window, seg, ticks, todayLabel: fmt(t) }
})
</script>

<style scoped>
.cov {
  display: grid;
  gap: 20px;
  padding: 24px 36px 20px;
}

.cov-top {
  display: flex;
  gap: 24px 48px;
  align-items: flex-end;
  justify-content: space-between;
}

.cov-kicker {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.cov-sentence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: center;
  margin: 10px 0 0;
}

.cov-pre {
  font: 400 18px / 1.3 var(--ui-font-display);
  color: var(--ui-ink-2);
}

.cov-pre:not(:first-child) {
  margin-left: 6px;
}

.tok {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin: 0;
  padding: 4px 10px 4px 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent-ink, var(--ui-accent));
  font: 600 20px / 1.3 var(--ui-font-display);
  letter-spacing: -0.02em;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

/* a caret says the word is a choice; a tap scrolls to the step that sets it */
.tok::after {
  width: 7px;
  height: 7px;
  margin: -3px 2px 0 2px;
  border: solid currentcolor;
  border-width: 0 2px 2px 0;
  content: '';
  transform: rotate(45deg);
  opacity: 0.7;
}

.tok:hover {
  background: color-mix(in srgb, var(--ui-accent) 18%, var(--ui-surface));
}

.tok:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.tok.is-open {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.cov-count {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: baseline;
  margin: 0;
}

.cov-count b {
  font: 600 40px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.cov-count span {
  font-size: 18px;
  color: var(--ui-muted);
}

.cov-cap {
  margin-left: 10px;
  font-size: 16px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
}

.cov-line {
  display: grid;
  gap: 8px;
  margin: 0;
}

.cov-track {
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.cov-seg {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  background: var(--ui-accent);
}

.cov-axis {
  position: relative;
  height: 26px;
}

.cov-tick {
  position: absolute;
  top: 0;
  padding-top: 9px;
  font-size: 13px;
  white-space: nowrap;
  transform: translateX(-50%);
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

/* a short tick over each label ties it to the track above */
.cov-tick::before {
  position: absolute;
  top: 0;
  left: 50%;
  width: 1px;
  height: 6px;
  background: var(--ui-faint);
  content: '';
}

.cov-tick.is-today {
  right: 0;
  left: auto;
  transform: none;
  font-weight: 600;
  color: var(--ui-ink);
}

.cov-tick.is-today::before {
  right: 0;
  left: auto;
  background: var(--ui-ink);
}

.cov-key {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.cov-key span {
  display: flex;
  gap: 6px;
  align-items: center;
}

.cov-key i {
  width: 14px;
  height: 8px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.cov-key i.on {
  background: var(--ui-accent);
}

@media (max-width: 768px) {
  .cov {
    gap: 18px;
    padding: 20px;
  }

  .cov-top {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .cov-pre {
    font-size: 17px;
  }

  /* one fact per row (word, then its chip) instead of a sentence that wraps mid-phrase */
  .cov-sentence {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px 14px;
    align-items: center;
  }

  .cov-pre:not(:first-child) {
    margin-left: 0;
  }

  .tok {
    justify-self: start;
  }

  .tok {
    font-size: 18px;
  }

  .cov-count b {
    font-size: 34px;
  }

  .cov-count span {
    font-size: 18px;
  }
}
</style>
