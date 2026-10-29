<template>
  <div class="chart-root">
    <div class="legend">
      <div
        class="legend-group"
        role="group"
        aria-label="期間"
      >
        <span><i class="cur" />本期 {{ fmt(data.totals.current) }}</span>
        <span><i class="prev" />上期 {{ fmt(data.totals.previous) }}</span>
      </div>
      <div
        v-if="channels.length > 0"
        class="legend-group legend-channels"
        role="group"
        aria-label="渠道"
      >
        <span
          v-for="ch in channels"
          :key="ch.key"
          class="split"
        >
          <span
            class="ui-ch"
            :class="ch.cls"
          ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>
          {{ ch.label }} {{ fmt(ch.total) }}
        </span>
      </div>
    </div>

    <div
      ref="wrap"
      class="chart-wrap"
    >
      <svg
        class="chart"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="ariaLabel"
      >
        <defs>
          <linearGradient
            id="volFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0"
              stop-color="var(--ui-accent)"
              stop-opacity=".18"
            />
            <stop
              offset="1"
              stop-color="var(--ui-accent)"
              stop-opacity="0"
            />
          </linearGradient>
        </defs>
        <g class="grid">
          <line
            v-for="t in ticks"
            :key="t.y"
            :x1="X0"
            :x2="X1"
            :y1="t.y"
            :y2="t.y"
          />
        </g>
        <text
          v-for="t in yLabelTicks"
          :key="`l${t.y}`"
          :x="X0 - 10"
          :y="t.y + 4"
          text-anchor="end"
        >{{ fmt(t.value) }}</text>

        <path
          :d="previousPath"
          fill="none"
          stroke="var(--ui-faint)"
          stroke-width="1.5"
          stroke-dasharray="4 4"
        />
        <path
          :d="areaPath"
          fill="url(#volFill)"
        />
        <path
          :d="currentPath"
          fill="none"
          stroke="var(--ui-accent)"
          stroke-width="2.2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <circle
          v-if="lastPoint"
          :cx="lastPoint.x"
          :cy="lastPoint.y"
          r="4.5"
          fill="var(--ui-surface)"
          stroke="var(--ui-accent)"
          stroke-width="2.2"
        />
        <g v-if="lastPoint">
          <rect
            class="tip"
            :x="tipX"
            y="0"
            width="80"
            height="26"
            rx="8"
          />
          <text
            :x="tipX + 40"
            y="17"
            text-anchor="middle"
            class="tip-text"
          >今天 {{ fmt(lastPoint.value) }}</text>
        </g>

        <!-- Hover/focus targets: native tooltip with the exact day value -->
        <circle
          v-for="p in points"
          :key="p.date"
          :cx="p.x"
          :cy="p.y"
          r="9"
          fill="transparent"
        >
          <title>{{ p.date }}：{{ fmt(p.value) }} 則客戶訊息</title>
        </circle>

        <text
          v-for="l in xLabels"
          :key="l.x"
          :x="l.x"
          :y="H - 6"
          :text-anchor="l.anchor"
        >{{ l.text }}</text>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MessageVolumeData } from '@/api/dashboard'

const props = defineProps<{ data: MessageVolumeData }>()

// The plot is drawn in real pixels: the wrapper's measured size is the viewBox, so axis text keeps
// its 11px size on a phone and the chart fills whatever height its card gives it.
const wrap = ref<HTMLElement | null>(null)
const W = ref(780)
const H = ref(360)
let observer: globalThis.ResizeObserver | null = null

const measure = (): void => {
  const el = wrap.value
  if (!el) { return }
  const cs = window.getComputedStyle(el)
  const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  if (w > 0) { W.value = Math.round(w) }
  if (h > 0) { H.value = Math.round(h) }
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && wrap.value) {
    observer = new window.ResizeObserver(measure)
    observer.observe(wrap.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

const compact = computed(() => W.value < 480)
const X0 = computed(() => (compact.value ? 6 : 44))
const X1 = computed(() => W.value - 16)
const Y_BASE = computed(() => H.value - 28)
const Y_TOP = 34

const fmt = (n: number): string => n.toLocaleString('en-US')

const maxValue = computed(() => {
  const all = [...props.data.current, ...props.data.previous].map((d) => d.total)
  // An all-zero series still gets a readable 0/10/20/30 axis
  return Math.max(30, ...all)
})

// "Nice" 3-interval axis: yMax = step * 3
const yMax = computed(() => {
  const s = maxValue.value / 3
  const mag = Math.pow(10, Math.floor(Math.log10(s)))
  const norm = s / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  return Math.max(3, Math.round(step * 3))
})

const yOf = (v: number): number => Y_BASE.value - (v / yMax.value) * (Y_BASE.value - Y_TOP)

const ticks = computed(() => [0, 1, 2, 3].map((i) => {
  const value = Math.round((yMax.value / 3) * i)
  return { value, y: yOf(value) }
}))

// No y labels on a phone: the grid and the "today" tooltip carry the scale
const yLabelTicks = computed(() => (compact.value ? [] : ticks.value))

const xOf = (i: number, n: number): number =>
  n <= 1 ? X1.value : X0.value + (i * (X1.value - X0.value)) / (n - 1)

const toPoints = (rows: { date: string; total: number }[]) =>
  rows.map((d, i) => ({ date: d.date, value: d.total, x: xOf(i, rows.length), y: yOf(d.total) }))

const points = computed(() => toPoints(props.data.current))
const previousPoints = computed(() => toPoints(props.data.previous))

const line = (pts: { x: number; y: number }[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

const currentPath = computed(() => line(points.value))
const previousPath = computed(() => line(previousPoints.value))
const areaPath = computed(() => points.value.length === 0
  ? ''
  : `${currentPath.value} L${X1.value} ${Y_BASE.value} L${X0.value} ${Y_BASE.value} Z`)

const lastPoint = computed(() => points.value[points.value.length - 1] ?? null)
const tipX = computed(() => (lastPoint.value ? Math.min(lastPoint.value.x - 48, W.value - 84) : 0))

type Anchor = 'start' | 'middle' | 'end'
const xLabels = computed(() => {
  const rows = props.data.current
  const n = rows.length
  const label = (i: number): string => i === n - 1 ? '今天' : (rows[i]?.date ?? '').slice(5).replace('-', '/')
  if (compact.value) {
    // Three ticks: first, middle, today
    const idx = n <= 2 ? [...new Set([0, n - 1])] : [0, Math.round((n - 1) / 2), n - 1]
    return idx.map((i, k): { x: number; text: string; anchor: Anchor } => ({
      x: xOf(i, n),
      text: label(i),
      anchor: k === 0 ? 'start' : k === idx.length - 1 ? 'end' : 'middle'
    }))
  }
  const every = n <= 7 ? 1 : Math.ceil(n / 7)
  const out: { x: number; text: string; anchor: Anchor }[] = []
  rows.forEach((_, i) => {
    const isLast = i === n - 1
    // Keep the last label (今天) and skip a neighbour that would collide with it
    if (isLast || (i % every === 0 && n - 1 - i >= every)) {
      out.push({ x: xOf(i, n), text: label(i), anchor: isLast ? 'end' : i === 0 ? 'start' : 'middle' })
    }
  })
  return out
})

const channels = computed(() => {
  const sum = (key: 'line' | 'facebook' | 'other') => props.data.current.reduce((acc, d) => acc + d[key], 0)
  return [
    { key: 'line', label: 'LINE', total: sum('line'), cls: 'ui-ch-line' },
    { key: 'facebook', label: 'Messenger', total: sum('facebook'), cls: 'ui-ch-fb' }
  ].filter((c) => c.total > 0)
})

const ariaLabel = computed(() =>
  `近 ${props.data.days} 天每日客戶訊息數，本期共 ${fmt(props.data.totals.current)} 則，上期 ${fmt(props.data.totals.previous)} 則`)
</script>

<style scoped>
/* Fills the height its card gives it; the plot never drops below a readable minimum */
.chart-root {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
  align-items: center;
  padding: 0 22px 6px;
  font-size: 13px;
  color: var(--ui-muted);
}

.legend-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
}

/* Period legend and channel legend are two groups: a hairline divides them */
.legend-channels {
  padding-left: 24px;
  border-left: 1px solid var(--ui-sep);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i.cur {
  width: 10px;
  height: 3px;
  border-radius: 2px;
  background: var(--ui-accent);
}

.legend i.prev {
  width: 10px;
  height: 0;
  border-top: 2px dashed var(--ui-faint);
}

.chart-wrap {
  position: relative;
  flex: 1;
  min-height: 300px;
  padding: 4px 22px 18px;
}

.chart {
  position: absolute;
  top: 4px;
  left: 22px;
  display: block;
  overflow: visible;
}

.chart text {
  fill: var(--ui-muted);
  font: 500 11px var(--ui-font-ui);
  font-variant-numeric: tabular-nums;
}

.chart .grid line {
  stroke: var(--ui-sep);
}

.chart .tip {
  fill: var(--ui-surface);
  filter: drop-shadow(0 4px 12px rgb(0 0 0 / 12%));
}

.chart .tip-text {
  fill: var(--ui-ink);
  font-weight: 600;
}

@media (max-width: 768px) {
  .legend {
    padding: 0 16px 6px;
  }

  .legend-channels {
    padding-left: 0;
    border-left: 0;
  }

  .chart-wrap {
    min-height: 230px;
    padding: 4px 16px 14px;
  }

  .chart {
    left: 16px;
  }
}
</style>
