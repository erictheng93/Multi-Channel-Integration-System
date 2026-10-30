<!--
  WsLineChart.vue
  One single-axis history chart for the WebSocket monitor. Every series shares the one y scale, so a
  reader never has to decide which axis a line belongs to. Null samples break the line (a gap is
  never drawn as zero). The newest value is printed on the line's end marker, and optional
  threshold lines carry their own label.
-->
<template>
  <svg
    v-if="drawn.some(s => s.count > 0)"
    class="ws-chart"
    :viewBox="`0 0 ${geom.width} ${geom.height}`"
    role="img"
    :aria-label="chartLabel"
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
        opacity="0.1"
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
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WsMetricsPointDto, WsMetricsRange } from '@/api/presence'
import { niceMax, xFor, yFor, xTicks, yTicks, type ChartGeometry } from '@/utils/ws-metrics-chart'

export interface WsChartSeries {
  key: string
  color: string
  pick: (_point: WsMetricsPointDto) => number | null
  /** Fill under the line (single-series charts only) */
  area?: boolean
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

const yAxis = computed(() => yTicks(maxValue.value, undefined, props.geom))
const xAxis = computed(() => xTicks(props.from, props.to, props.range, props.xCount ?? 5, props.geom))
const refLines = computed(() => (props.refs ?? [])
  .filter(r => r.value <= maxValue.value)
  .map(r => ({ label: r.label, pos: r1(yFor(r.value, maxValue.value, props.geom)) })))
</script>

<style scoped>
.ws-chart {
  display: block;
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
