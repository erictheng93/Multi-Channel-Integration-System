<!--
  LeadBars.vue

  A purpose-built lead graphic: one vertical bar per real value (a day, a service, an endpoint),
  the value on top, a label underneath. It replaces the ring where the ring would only repeat
  the number beside it.

    <LeadBars summary="近 7 天操作" :bars="[{ key: 'd1', label: '10/24', value: 120, current: true }]" />

  Rules
  - Heights are value / max (or `max`), never decorative; a zero value draws a hairline, not a bar.
  - `tone` colours a bar semantically (good / warn / bad / blue / indigo); no tone = the section hue.
  - `current` marks the one bar the page is about (full colour); the rest sit back at a tint.
  - One image for assistive tech: role="img" with an aria-label that lists every value.
  - Grows from the baseline on mount (300ms ease-out); reduced motion draws it at height.
-->
<template>
  <figure
    class="lead-bars"
    role="img"
    :aria-label="ariaLabel"
    :style="{ '--lb-h': `${height}px` }"
  >
    <div
      class="lb-grid"
      :style="{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }"
    >
      <div
        v-for="bar in drawn"
        :key="bar.key"
        class="lb-col"
        :class="[bar.tone ? `is-${bar.tone}` : '', { 'is-current': bar.current, 'has-current': hasCurrent }]"
      >
        <span class="lb-val">{{ bar.display }}</span>
        <span class="lb-slot">
          <span
            class="lb-bar"
            :class="{ 'is-zero': bar.value <= 0 }"
            :style="{ height: shown ? bar.pct : '0%' }"
          />
        </span>
        <span class="lb-label">{{ bar.label }}</span>
      </div>
    </div>
    <figcaption
      v-if="caption"
      class="lb-caption"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export type LeadTone = 'good' | 'warn' | 'bad' | 'blue' | 'indigo' | 'muted'

export interface LeadBar {
  key: string
  label: string
  value: number
  display?: string
  tone?: LeadTone
  current?: boolean
}

const props = withDefaults(defineProps<{
  bars: readonly LeadBar[]
  max?: number
  height?: number
  summary?: string
  caption?: string
}>(), {
  max: 0,
  height: 112,
  summary: '',
  caption: '',
})

const ceiling = computed(() => props.max > 0 ? props.max : Math.max(1, ...props.bars.map(b => b.value)))
const hasCurrent = computed(() => props.bars.some(b => b.current))
const drawn = computed(() => props.bars.map(b => ({
  ...b,
  display: b.display ?? b.value.toLocaleString('en-US'),
  pct: b.value <= 0 ? '2px' : `${Math.max(6, Math.round((b.value / ceiling.value) * 100))}%`,
})))
const ariaLabel = computed(() =>
  `${props.summary ? `${props.summary}：` : ''}${drawn.value.map(b => `${b.label} ${b.display}`).join('；')}`)

const shown = ref(false)
let frame = 0
onMounted(() => { frame = window.requestAnimationFrame(() => { shown.value = true }) })
onBeforeUnmount(() => { window.cancelAnimationFrame(frame) })
</script>

<style scoped>
.lead-bars {
  --lb-fill: var(--section-hue);
  width: 100%;
  min-width: 0;
  margin: 0;
}

.lb-grid {
  display: grid;
  gap: 10px;
  align-items: start;
}

.lb-col {
  --lb-c: var(--lb-fill);
  display: grid;
  grid-template-rows: auto var(--lb-h) auto;
  gap: 6px;
  justify-items: center;
  min-width: 0;
}

.lb-col.is-good { --lb-c: var(--ui-green); }
.lb-col.is-warn { --lb-c: var(--ui-orange); }
.lb-col.is-bad { --lb-c: var(--ui-red); }
.lb-col.is-blue { --lb-c: var(--ui-blue); }
.lb-col.is-indigo { --lb-c: var(--ui-indigo); }
.lb-col.is-muted { --lb-c: var(--ui-faint); }

.lb-val {
  font: 600 14px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
  white-space: nowrap;
}

.lb-slot {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: var(--lb-h);
}

.lb-bar {
  display: block;
  width: min(100%, 36px);
  min-height: 2px;
  border-radius: 8px 8px 3px 3px;
  background: var(--lb-c);
  transition: height 300ms ease-out;
}

/* when one bar is the subject the others sit back */
.lb-col.has-current:not(.is-current) .lb-bar {
  opacity: 0.38;
}

.lb-bar.is-zero {
  height: 2px;
  border-radius: 2px;
  background: var(--ui-fill-strong);
}

.lb-label {
  max-width: 100%;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
  text-align: center;
  color: var(--ui-muted);
  overflow-wrap: break-word;
}

.lb-col.is-current .lb-label {
  color: var(--ui-ink);
  font-weight: 600;
}

.lb-caption {
  margin-top: 10px;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (prefers-reduced-motion: reduce) {
  .lb-bar {
    transition: none;
  }
}
</style>
