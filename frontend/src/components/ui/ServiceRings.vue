<!--
  ServiceRings.vue

  The product's signature graphic: Fitness-style concentric, round-capped arcs on faint
  tracks, one ring per real ratio, with a legend of the numbers beside it. It replaces the
  decorative DiscRing as the lead visual of a page.

    <ServiceRings
      summary="待回覆概況"
      :rings="[
        { label: '待回覆', value: 9, total: 23, of: '處理中', hue: 'var(--ui-orange)' },
        { label: '今日已結案', value: 31, total: 54, of: '今日對話', hue: 'var(--ui-green)' },
      ]"
      center-value="9"
      center-label="待回覆"
    />

  Rules
  - 1 to 3 rings (extra entries are ignored). The first is the outermost and the most important.
  - Values come from data the page already loaded; a ring is value / total, clamped to 0..1.
  - Always drawn complete inside its own box (never cropped by a parent edge).
  - The whole figure is one image for assistive tech: role="img" with an aria-label that states
    every value, so the visible legend is not read twice.
  - Fill animates once on mount (300ms ease-out). prefers-reduced-motion: drawn at its value.

  Props
    rings        { label, value, total, hue?, of?, display? }[]
                   hue      any CSS colour (default cycles section hue / green / orange)
                   of       text after "/ total" in the legend (e.g. '處理中')
                   display  replaces `value` in the legend when the number needs formatting
    size         px of the square graphic (default 168)
    summary      aria-label prefix naming what the rings describe
    centerValue / centerLabel   optional text inside the innermost ring (or use the #center slot)
    stacked      legend under the graphic instead of beside it (narrow boxes)
-->

<template>
  <figure
    class="service-rings"
    :class="{ 'is-stacked': stacked }"
    role="img"
    :aria-label="ariaLabel"
  >
    <div
      class="sr-graphic"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <svg
        class="sr-svg"
        :viewBox="`0 0 ${size} ${size}`"
        aria-hidden="true"
        focusable="false"
      >
        <g
          v-for="ring in drawn"
          :key="ring.index"
        >
          <circle
            class="sr-track"
            :cx="size / 2"
            :cy="size / 2"
            :r="ring.radius"
            :stroke-width="layout.stroke"
            :style="{ stroke: ring.hue }"
          />
          <circle
            class="sr-arc"
            :class="{ 'is-empty': ring.arc === 0 }"
            :cx="size / 2"
            :cy="size / 2"
            :r="ring.radius"
            :stroke-width="layout.stroke"
            :stroke-dasharray="`${shown ? ring.arc : 0} ${ring.circumference}`"
            :transform="`rotate(-90 ${size / 2} ${size / 2})`"
            :style="{ stroke: ring.hue }"
          />
        </g>
      </svg>
      <div
        v-if="$slots.center || centerValue !== undefined"
        class="sr-center"
        :style="{ width: `${inner * 2}px`, height: `${inner * 2}px` }"
      >
        <slot name="center">
          <strong class="sr-center-value">{{ centerValue }}</strong>
          <span
            v-if="centerLabel"
            class="sr-center-label"
          >{{ centerLabel }}</span>
        </slot>
      </div>
    </div>

    <ul class="sr-legend">
      <li
        v-for="ring in drawn"
        :key="ring.index"
        class="sr-item"
      >
        <span
          class="sr-dot"
          :style="{ background: ring.hue }"
        />
        <span class="sr-label">{{ ring.label }}</span>
        <span class="sr-num">
          <strong>{{ ring.display }}</strong>
          <small v-if="ring.total > 0">/ {{ ring.total.toLocaleString('en-US') }}{{ ring.of ? ` ${ring.of}` : '' }}</small>
        </span>
      </li>
    </ul>
  </figure>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  arcLength,
  innerRadius,
  ringCircumference,
  ringFraction,
  ringRadius,
  type RingLayout,
} from './service-rings-geometry'

export interface ServiceRing {
  label: string
  value: number
  total: number
  hue?: string
  of?: string
  display?: string
}

const props = withDefaults(defineProps<{
  rings: readonly ServiceRing[]
  size?: number
  summary?: string
  centerValue?: string | number
  centerLabel?: string
  stacked?: boolean
}>(), {
  size: 168,
  summary: '',
  centerValue: undefined,
  centerLabel: '',
  stacked: false,
})
const MAX_RINGS = 3
const DEFAULT_HUES = ['var(--section-hue)', 'var(--ui-green)', 'var(--ui-orange)'] as const

const used = computed(() => props.rings.slice(0, MAX_RINGS))

// Thinner strokes when three rings share the box, so the centre stays usable
const layout = computed<RingLayout>(() => {
  const count = used.value.length
  const stroke = Math.round(props.size * (count >= 3 ? 0.105 : count === 2 ? 0.125 : 0.15))
  return { size: props.size, stroke, gap: Math.max(3, Math.round(stroke * 0.22)) }
})

const inner = computed(() => innerRadius(used.value.length, layout.value))

const drawn = computed(() => used.value.map((ring, index) => {
  const radius = ringRadius(index, layout.value)
  const fraction = ringFraction(ring.value, ring.total)
  return {
    index,
    label: ring.label,
    total: ring.total,
    of: ring.of,
    display: ring.display ?? ring.value.toLocaleString('en-US'),
    hue: ring.hue ?? DEFAULT_HUES[index] ?? DEFAULT_HUES[0],
    radius,
    circumference: ringCircumference(radius),
    arc: arcLength(fraction, radius),
  }
}))

const ariaLabel = computed(() => {
  const parts = used.value.map((ring) => {
    const total = ring.total > 0 ? `，共 ${ring.total.toLocaleString('en-US')}${ring.of ? ` ${ring.of}` : ''}` : ''
    return `${ring.label} ${ring.display ?? ring.value.toLocaleString('en-US')}${total}`
  })
  return `${props.summary ? `${props.summary}：` : ''}${parts.join('；')}`
})

// Fill from empty on mount: the arcs start at 0 and transition to their length on the next frame
const shown = ref(false)
let frame = 0
onMounted(() => {
  frame = window.requestAnimationFrame(() => { shown.value = true })
})
onBeforeUnmount(() => { window.cancelAnimationFrame(frame) })
</script>

<style scoped>
.service-rings {
  display: flex;
  align-items: center;
  gap: 28px;
  margin: 0;
}
.service-rings.is-stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}
.sr-graphic {
  position: relative;
  flex: none;
}
.sr-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.sr-track {
  fill: none;
  opacity: 0.16;
}
.sr-arc {
  fill: none;
  stroke-linecap: round;
  transition: stroke-dasharray 300ms ease-out;
}
/* A zero share draws nothing: a round cap on a zero-length dash would leave a dot */
.sr-arc.is-empty {
  visibility: hidden;
}
.sr-center {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  text-align: center;
  line-height: 1.1;
}
.sr-center-value {
  font: 600 28px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}
.sr-center-label {
  margin-top: 3px;
  font-size: 12px;
  color: var(--ui-muted);
}

.sr-legend {
  display: grid;
  flex: 1;
  gap: 14px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sr-item {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  grid-template-areas:
    'dot label'
    '. num';
  column-gap: 10px;
  row-gap: 1px;
  align-items: center;
}
.sr-dot {
  grid-area: dot;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.sr-label {
  grid-area: label;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}
.sr-num {
  grid-area: num;
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sr-num strong {
  font: 600 26px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  color: var(--ui-ink);
}
.sr-num small {
  font-size: 13px;
  color: var(--ui-muted);
}

@media (prefers-reduced-motion: reduce) {
  .sr-arc {
    transition: none;
  }
}
</style>
