<!--
  WsLineChart.vue
  One single-axis history chart for the WebSocket monitor. Every series shares the one y scale, so a
  reader never has to decide which axis a line belongs to. Null samples break the line (a gap is
  never drawn as zero). The newest value is printed on the line's end marker, and optional
  threshold lines carry their own label.
-->
<template>
  <div
    v-if="drawn.some(s => s.count > 0)"
    class="ws-chart-wrap"
  >
    <svg
      ref="svgEl"
      class="ws-chart"
      :viewBox="`0 0 ${geom.width} ${geom.height}`"
      role="img"
      :aria-label="chartLabel"
      @pointermove="onMove"
      @pointerdown="onMove"
      @pointerleave="hover = null"
      @pointercancel="hover = null"
    >
      <g class="g">
        <line
          v-for="tick in yAxis"
          :key="`g${tick.pos}`"
          :x1="geom.left"
          :x2="geom.right"
          :y1="tick.pos"
          :y2="tick.pos"
        />
      </g>
      <g text-anchor="end">
        <text
          v-for="tick in yAxis"
          :key="`y${tick.pos}`"
          :x="geom.left - 8"
          :y="tick.pos + 4"
        >{{ tick.label }}</text>
      </g>
      <g text-anchor="middle">
        <text
          v-for="tick in xAxis"
          :key="`x${tick.pos}`"
          :x="tick.pos"
          :y="geom.bottom + 22"
        >{{ tick.label }}</text>
      </g>
      <g
        v-for="line in refLines"
        :key="line.label"
      >
        <line
          class="ref"
          :x1="geom.left"
          :x2="geom.right"
          :y1="line.pos"
          :y2="line.pos"
        />
        <text
          class="ref-label"
          text-anchor="end"
          :x="geom.right"
          :y="line.pos - 5"
        >{{ line.label }}</text>
      </g>
      <template
        v-for="s in drawn"
        :key="s.key"
      >
        <path
          v-for="(d, i) in s.areas"
          :key="`a${i}`"
          :d="d"
          :fill="s.color"
          :opacity="drawn.length > 1 ? 0.07 : 0.1"
        />
        <path
          v-for="(d, i) in s.lines"
          :key="`l${i}`"
          :d="d"
          fill="none"
          :stroke="s.color"
          stroke-width="2.4"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          v-for="(dot, i) in s.dots"
          :key="`d${i}`"
          :cx="dot.x"
          :cy="dot.y"
          r="2.6"
          :fill="s.color"
        />
      </template>
      <template
        v-for="s in drawn"
        :key="`end${s.key}`"
      >
        <circle
          v-if="s.last"
          :cx="s.last.x"
          :cy="s.last.y"
          r="4.5"
          :fill="s.color"
          stroke="var(--ui-surface)"
          stroke-width="2"
        />
      </template>
      <g v-if="hoverView">
        <line
          class="guide"
          :x1="hoverView.x"
          :x2="hoverView.x"
          :y1="geom.top"
          :y2="geom.bottom"
        />
        <circle
          v-for="d in hoverView.dots"
          :key="d.key"
          :cx="hoverView.x"
          :cy="d.y"
          r="4.5"
          :fill="d.color"
          stroke="var(--ui-surface)"
          stroke-width="2"
        />
      </g>
    </svg>
    <div
      v-if="hoverView"
      class="tip"
      :class="{ 'is-left': hoverView.flip }"
      :style="{ left: hoverView.leftPct + '%' }"
      aria-hidden="true"
    >
      <span class="tip-time">{{ hoverView.time }}</span>
      <span
        v-for="d in hoverView.dots"
        :key="d.key"
        class="tip-row"
      ><i :style="{ background: d.color }" />{{ d.label }}<b>{{ d.text }}</b></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WsMetricsPointDto, WsMetricsRange } from '@/api/presence'
import { niceMax, xFor, yFor, xTicks, yTicks, type ChartGeometry } from '@/utils/ws-metrics-chart'

export interface WsChartSeries {
  key: string
  color: string
  pick: (_point: WsMetricsPointDto) => number | null
  /** Fill under the line */
  area?: boolean
  /** Name shown in the hover tooltip */
  label?: string
  /** Decimals for the tooltip value */
  digits?: number
  /** Unit printed after the tooltip value */
  unit?: string
}

const props = defineProps<{
  points: WsMetricsPointDto[]
  from: number
  to: number
  range: WsMetricsRange
  series: WsChartSeries[]
  geom: ChartGeometry
  chartLabel: string
  /** Horizontal reference lines (for example a latency target); one that sits above the data's axis is left out so it never flattens the series */
  refs?: Array<{ value: number; label: string }>
  /** Number of x labels (fewer on a phone) */
  xCount?: number
}>()

const r1 = (n: number) => Math.round(n * 10) / 10

const maxValue = computed(() => {
  const all: number[] = []
  for (const s of props.series) {
    for (const p of props.points) {
      const v = s.pick(p)
      if (v !== null && Number.isFinite(v)) { all.push(v) }
    }
  }
  return niceMax(Math.max(1, ...all))
})

const drawn = computed(() => props.series.map((s) => {
  const runs: Array<Array<{ x: number; y: number }>> = []
  let cur: Array<{ x: number; y: number }> = []
  let count = 0
  for (const p of props.points) {
    const v = s.pick(p)
    if (v === null || !Number.isFinite(v)) {
      if (cur.length > 0) { runs.push(cur); cur = [] }
      continue
    }
    count += 1
    cur.push({ x: r1(xFor(p.ts, props.from, props.to, props.geom)), y: r1(yFor(v, maxValue.value, props.geom)) })
  }
  if (cur.length > 0) { runs.push(cur) }
  const path = (run: Array<{ x: number; y: number }>) => run.map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x} ${q.y}`).join(' ')
  const lastRun = runs[runs.length - 1]
  return {
    key: s.key,
    color: s.color,
    count,
    lines: runs.filter(r => r.length > 1).map(path),
    areas: s.area
      ? runs.filter(r => r.length > 1).map(r => `${path(r)} L${r[r.length - 1]?.x} ${props.geom.bottom} L${r[0]?.x} ${props.geom.bottom}Z`)
      : [],
    dots: runs.filter(r => r.length === 1).map(r => r[0] as { x: number; y: number }),
    last: lastRun ? (lastRun[lastRun.length - 1] ?? null) : null,
  }
}))

const svgEl = ref<Element | null>(null)
const hover = ref<number | null>(null)

/** Nearest sample (by x) that has a value in any series; the guide, markers and tooltip follow it */
function onMove(event: { clientX: number }) {
  const el = svgEl.value
  if (!el) { return }
  const rect = el.getBoundingClientRect()
  if (rect.width === 0) { return }
  const x = ((event.clientX - rect.left) / rect.width) * props.geom.width
  let best: number | null = null
  let bestDist = Infinity
  props.points.forEach((p, i) => {
    if (!props.series.some(s => { const v = s.pick(p); return v !== null && Number.isFinite(v) })) { return }
    const d = Math.abs(xFor(p.ts, props.from, props.to, props.geom) - x)
    if (d < bestDist) { bestDist = d; best = i }
  })
  hover.value = best
}

const timeFmt = computed(() => new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  ...(props.range === '24h' || props.range === '7d' ? { month: 'numeric', day: 'numeric' } : {}),
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}))

const hoverView = computed(() => {
  const i = hover.value
  const p = i === null ? undefined : props.points[i]
  if (!p) { return null }
  const x = r1(xFor(p.ts, props.from, props.to, props.geom))
  const dots = props.series.flatMap((s) => {
    const v = s.pick(p)
    if (v === null || !Number.isFinite(v)) { return [] }
    const text = `${v.toFixed(s.digits ?? 0)}${s.unit ? ` ${s.unit}` : ''}`
    return [{ key: s.key, color: s.color, y: r1(yFor(v, maxValue.value, props.geom)), label: s.label ?? '', text }]
  })
  const leftPct = (x / props.geom.width) * 100
  return { x, dots, leftPct, flip: leftPct > 62, time: timeFmt.value.format(new Date(p.ts)) }
})

const yAxis = computed(() => yTicks(maxValue.value, undefined, props.geom))
const xAxis = computed(() => xTicks(props.from, props.to, props.range, props.xCount ?? 5, props.geom))
const refLines = computed(() => (props.refs ?? [])
  .filter(r => r.value <= maxValue.value)
  .map(r => ({ label: r.label, pos: r1(yFor(r.value, maxValue.value, props.geom)) })))
</script>

<style scoped>
.ws-chart-wrap {
  position: relative;
}

.ws-chart {
  display: block;
  touch-action: pan-y;
  width: 100%;
  height: auto;
  overflow: visible;
}

.ws-chart text {
  fill: var(--ui-muted);
  font: 500 12px var(--ui-font-ui);
  font-variant-numeric: tabular-nums;
}

.ws-chart .g line {
  stroke: var(--ui-sep);
}

.ws-chart .ref {
  stroke: var(--ui-faint);
  stroke-dasharray: 4 4;
}

.ws-chart .ref-label {
  fill: var(--ui-ink-2);
  font-size: 12px;
}
</style>

<style scoped>
.ws-chart .guide {
  stroke: var(--ui-faint);
  stroke-width: 1;
}

.tip {
  position: absolute;
  top: 4px;
  z-index: 2;
  display: grid;
  gap: 2px;
  min-width: 112px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
  font-size: 13px;
  color: var(--ui-ink-2);
  pointer-events: none;
  transform: translateX(12px);
}

.tip.is-left {
  transform: translateX(calc(-100% - 12px));
}

.tip-time {
  font-weight: 600;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.tip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tip-row i {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tip-row b {
  margin-left: auto;
  padding-left: 12px;
  font-weight: 600;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}
</style>
