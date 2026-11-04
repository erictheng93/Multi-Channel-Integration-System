<!--
  LeadSpark.vue

  A purpose-built lead graphic: a line over real samples with the latest point marked, the range
  written out and the time span under it. Used where the story is a trend (connections over the
  last hour), not a ratio.

    <LeadSpark summary="已註冊連線" :values="[22, 24, 30, 38]" unit="條" start-label="1 小時前" end-label="現在" />

  Rules
  - Needs at least 2 values; with fewer it renders nothing (no invented line).
  - y runs min..max of the real samples; the range is printed (low / high).
  - role="img" with an aria-label stating latest, low and high.
-->
<template>
  <figure
    v-if="values.length >= 2"
    class="lead-spark"
    role="img"
    :aria-label="ariaLabel"
  >
    <div class="ls-plot">
      <span class="ls-hi">{{ high }}</span>
      <span class="ls-lo">{{ low }}</span>
      <svg
        class="ls-svg"
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <line
          class="ls-grid"
          x1="0"
          x2="300"
          y1="1"
          y2="1"
        />
        <line
          class="ls-grid"
          x1="0"
          x2="300"
          y1="50"
          y2="50"
        />
        <line
          class="ls-grid"
          x1="0"
          x2="300"
          y1="99"
          y2="99"
        />
        <path
          class="ls-area"
          :d="areaPath"
        />
        <path
          class="ls-line"
          :d="linePath"
        />
      </svg>
      <span
        class="ls-dot"
        :style="{ left: `${lastPoint.x}%`, top: `${lastPoint.y}%` }"
      />
    </div>
    <figcaption class="ls-axis">
      <span>{{ startLabel }}</span>
      <span>{{ endLabel }}</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  values: readonly number[]
  unit?: string
  startLabel?: string
  endLabel?: string
  summary?: string
}>(), {
  unit: '',
  startLabel: '',
  endLabel: '',
  summary: '',
})

const min = computed(() => Math.min(...props.values))
const max = computed(() => Math.max(...props.values))
const fmt = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}${props.unit}`
const low = computed(() => fmt(min.value))
const high = computed(() => fmt(max.value))

const points = computed(() => {
  const span = max.value - min.value || 1
  const last = props.values.length - 1
  return props.values.map((v, i) => ({
    x: (i / last) * 100,
    y: 8 + (1 - (v - min.value) / span) * 84,
  }))
})
const lastPoint = computed(() => points.value[points.value.length - 1] ?? { x: 100, y: 50 })
const linePath = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 3).toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
const areaPath = computed(() => `${linePath.value} L300 100 L0 100 Z`)

const ariaLabel = computed(() => {
  const latest = props.values[props.values.length - 1] ?? 0
  return `${props.summary ? `${props.summary}：` : ''}目前 ${fmt(latest)}，區間最低 ${low.value}，最高 ${high.value}`
})
</script>

<style scoped>
.lead-spark {
  width: 100%;
  min-width: 0;
  margin: 0;
}

.ls-plot {
  position: relative;
  height: 112px;
  margin-left: 48px;
}

.ls-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ls-grid {
  stroke: var(--ui-sep);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.ls-area {
  fill: color-mix(in srgb, var(--section-hue) 14%, transparent);
}

.ls-line {
  fill: none;
  stroke: var(--section-hue);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.ls-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: var(--section-hue);
  box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 6px color-mix(in srgb, var(--section-hue) 22%, transparent);
}

.ls-hi,
.ls-lo {
  position: absolute;
  left: -48px;
  width: 42px;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: right;
  color: var(--ui-muted);
}

.ls-hi { top: -6px; }
.ls-lo { bottom: -6px; }

.ls-axis {
  display: flex;
  justify-content: space-between;
  margin: 12px 0 0 48px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}
</style>
