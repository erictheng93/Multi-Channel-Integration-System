<!--
  LeadMeter.vue

  A purpose-built lead graphic: a short list of named rows, each with one or two horizontal
  bars scaled to a shared maximum and the number at the end of the bar. It carries comparisons
  a ring cannot (volume per channel, quota used, latency per service).

    <LeadMeter
      summary="各頻道訊息量"
      :legend="[{ label: '客戶來訊', tone: 'blue' }, { label: '客服發送', tone: 'indigo' }]"
      :rows="[{ key: 'a', label: 'LINE', lines: [{ value: 214, tone: 'blue' }, { value: 167, tone: 'indigo' }] }]"
    />

  Rules
  - Every width is value / max over all lines (or `max`), so rows compare to each other.
  - A line's `display` replaces the formatted value (units, a dash for no data); value <= 0 draws no fill.
  - One image for assistive tech (role="img") that lists each row and line.
-->
<template>
  <figure
    class="lead-meter"
    role="img"
    :aria-label="ariaLabel"
  >
    <ul
      v-if="legend.length"
      class="lm-legend"
      aria-hidden="true"
    >
      <li
        v-for="item in legend"
        :key="item.label"
        :class="`is-${item.tone}`"
      >
        <i />{{ item.label }}
      </li>
    </ul>
    <ul class="lm-rows">
      <li
        v-for="row in drawn"
        :key="row.key"
        class="lm-row"
      >
        <div class="lm-name">
          <span>{{ row.label }}</span>
          <small v-if="row.sub">{{ row.sub }}</small>
        </div>
        <div
          v-for="(line, i) in row.lines"
          :key="i"
          class="lm-line"
          :class="line.tone ? `is-${line.tone}` : ''"
        >
          <span class="lm-track"><span
            class="lm-fill"
            :style="{ width: shown ? line.pct : '0%' }"
          /></span>
          <b class="lm-n">{{ line.display }}</b>
        </div>
      </li>
    </ul>
  </figure>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LeadTone } from './LeadBars.vue'

export interface MeterLine {
  value: number
  display?: string
  tone?: LeadTone
}

export interface MeterRow {
  key: string
  label: string
  sub?: string
  lines: readonly MeterLine[]
}

const props = withDefaults(defineProps<{
  rows: readonly MeterRow[]
  legend?: readonly { label: string, tone: LeadTone }[]
  max?: number
  summary?: string
}>(), {
  legend: () => [],
  max: 0,
  summary: '',
})

const ceiling = computed(() => props.max > 0
  ? props.max
  : Math.max(1, ...props.rows.flatMap(r => r.lines.map(l => l.value))))

const drawn = computed(() => props.rows.map(row => ({
  ...row,
  lines: row.lines.map(l => ({
    ...l,
    display: l.display ?? l.value.toLocaleString('en-US'),
    pct: l.value <= 0 ? '0%' : `${Math.max(3, Math.round((l.value / ceiling.value) * 100))}%`,
  })),
})))

const ariaLabel = computed(() =>
  `${props.summary ? `${props.summary}：` : ''}${drawn.value.map(r => `${r.label} ${r.lines.map(l => l.display).join(' / ')}`).join('；')}`)

const shown = ref(false)
let frame = 0
onMounted(() => { frame = window.requestAnimationFrame(() => { shown.value = true }) })
onBeforeUnmount(() => { window.cancelAnimationFrame(frame) })
</script>

<style scoped>
.lead-meter {
  width: 100%;
  min-width: 0;
  margin: 0;
}

.lm-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.lm-legend li {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.lm-legend i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--lm-c, var(--section-hue));
}

.lm-rows {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lm-row {
  display: grid;
  gap: 6px;
}

.lm-name {
  display: flex;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink);
}

.lm-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lm-name small {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.lm-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.is-good { --lm-c: var(--ui-green); }
.is-warn { --lm-c: var(--ui-orange); }
.is-bad { --lm-c: var(--ui-red); }
.is-blue { --lm-c: var(--ui-blue); }
.is-indigo { --lm-c: var(--ui-indigo); }
.is-muted { --lm-c: var(--ui-faint); }

.lm-track {
  display: block;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.lm-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--lm-c, var(--section-hue));
  transition: width 300ms ease-out;
}

.lm-n {
  min-width: 44px;
  font: 600 14px / 1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--ui-ink);
}

@media (prefers-reduced-motion: reduce) {
  .lm-fill {
    transition: none;
  }
}
</style>
