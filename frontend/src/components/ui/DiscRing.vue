<!--
  DiscRing.vue

  The product's one visual idea: the concentric rings and rim grain of an abrasive disc
  (the login page, the 404, empty states, the dashboard hero, the health-check hero).

  Use it with restraint:
  - decorative only (aria-hidden); never carries data and never sits behind body text
  - subtle: it is drawn in a token colour at low opacity and fades out towards its edge
  - slow or still: `spin` turns it once per `spinSeconds`; reduced-motion users get a still disc

  Usage
    <div class="hero">
      <DiscRing class="hero-disc" tone="accent" :size="220" spin />   // position it yourself
      <strong class="hero-number">42</strong>
    </div>

  Props
    size         px number or any CSS length (default '100%': fills its box)
    tone         'accent' | 'ink' | 'muted' | 'red' | 'green' (colour token; default accent)
    spin         rotate slowly (default false)
    spinSeconds  seconds per turn when spinning (default 120)
    grain        draw the rim grain ticks (default true; drop it below ~120px)
    fade         radial mask strength: 'soft' keeps the rim visible, 'strong' dissolves it
                 (default 'soft')

  Position and opacity are the caller's job (class / style); the root is an inline SVG.
-->

<template>
  <svg
    class="ui-disc"
    :class="[`is-${tone}`, `fade-${fade}`, { 'is-spinning': spin }]"
    :style="rootStyle"
    viewBox="0 0 640 640"
    aria-hidden="true"
    focusable="false"
  >
    <g class="ui-disc-spin">
      <g>
        <circle
          v-for="ring in DISC_RINGS"
          :key="ring.r"
          class="ui-disc-ring"
          cx="320"
          cy="320"
          :r="ring.r"
          :stroke-width="ring.w"
          :opacity="ring.o"
        />
      </g>
      <g
        v-if="grain"
        class="ui-disc-grain"
      >
        <line
          v-for="(tick, i) in DISC_GRAIN"
          :key="i"
          :x1="tick.x1"
          :y1="tick.y1"
          :x2="tick.x2"
          :y2="tick.y2"
          stroke-width="1"
          :opacity="tick.o"
        />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DISC_GRAIN, DISC_RINGS } from './disc-ring-geometry'

const props = withDefaults(defineProps<{
  size?: number | string
  tone?: 'accent' | 'ink' | 'muted' | 'red' | 'green'
  spin?: boolean
  spinSeconds?: number
  grain?: boolean
  fade?: 'soft' | 'strong'
}>(), {
  size: '100%',
  tone: 'accent',
  spin: false,
  spinSeconds: 120,
  grain: true,
  fade: 'soft',
})

const rootStyle = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return { width: size, height: size, '--ui-disc-turn': `${props.spinSeconds}s` }
})
</script>

<style scoped>
.ui-disc {
  display: block;
  flex: none;
  color: var(--ui-accent);
  pointer-events: none;
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 66%, transparent 82%);
  mask-image: radial-gradient(circle at 50% 50%, #000 66%, transparent 82%);
}

.ui-disc.fade-strong {
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 38%, transparent 70%);
  mask-image: radial-gradient(circle at 50% 50%, #000 38%, transparent 70%);
}

.ui-disc.is-ink {
  color: var(--ui-ink);
}

.ui-disc.is-muted {
  color: var(--ui-muted);
}

.ui-disc.is-red {
  color: var(--ui-red);
}

.ui-disc.is-green {
  color: var(--ui-green);
}

.ui-disc-ring {
  fill: none;
  stroke: currentColor;
}

.ui-disc-grain line {
  stroke: currentColor;
  stroke-linecap: round;
}

.ui-disc-spin {
  transform-origin: 320px 320px;
}

.ui-disc.is-spinning .ui-disc-spin {
  animation: ui-disc-turn var(--ui-disc-turn, 120s) linear infinite;
}

@keyframes ui-disc-turn {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-disc.is-spinning .ui-disc-spin {
    animation: none;
  }
}
</style>
