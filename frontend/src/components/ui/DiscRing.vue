<!--
  DiscRing.vue

  The product's one visual idea: the concentric rings and rim grain of an abrasive disc
  (the login page, the 404, empty states, the lead-metric hero, the health-check hero).

  Use it with restraint:
  - decorative only (aria-hidden); never carries data and never sits behind body text
  - drawn in a token colour; the hero variant is meant to be seen, the line variant is a whisper
  - slow or still: `spin` turns it once per `spinSeconds`; reduced-motion users get a still disc

  Usage
    <div class="hero">
      <DiscRing class="hero-disc" variant="hero" :size="360" spin />   // position it yourself
      <strong class="hero-number">42</strong>
    </div>

  Props
    size         px number or any CSS length (default '100%': fills its box)
    tone         'accent' | 'ink' | 'muted' | 'red' | 'green' | 'orange' (colour token; default accent)
    spin         rotate slowly (default false)
    spinSeconds  seconds per turn when spinning (default 120)
    grain        draw the rim grain ticks (default true; drop it below ~120px)
    weight       line-weight multiplier for small discs where hairlines read too faint
                 (default 1: 1px rings; pass 1.5 below ~150px)
    fade         radial mask strength: 'soft' keeps the rim visible, 'strong' dissolves it
                 (default 'soft')
    arc          0..1 share drawn as a clockwise arc on the outer ring (hero only; null = none)
    variant      'line' (default) = hairline rings, for empty states and small art.
                 'hero' = the signature disc: heavier gradient-stroked bond rings, two
                 filled abrasive bands, an arbor-hole hub and a long radial grain rim. It is
                 meant to be SEEN (about 10-14% ink on light), so crop it deliberately with the
                 container (overflow hidden) and keep body text off it. Used by UiLeadMetric,
                 the login brand column, the 404 and the health hero.

  Position and opacity are the caller's job (class / style); the root is an inline SVG.
-->

<template>
  <svg
    class="ui-disc"
    :class="[`is-${tone}`, `fade-${fade}`, `is-${variant}`, { 'is-spinning': spin }]"
    :style="rootStyle"
    viewBox="0 0 640 640"
    aria-hidden="true"
    focusable="false"
  >
    <defs v-if="variant === 'hero'">
      <linearGradient
        :id="`${uid}-stroke`"
        gradientUnits="userSpaceOnUse"
        x1="40"
        y1="40"
        x2="600"
        y2="600"
      >
        <stop
          offset="0"
          class="ui-disc-stop-a"
        />
        <stop
          offset="1"
          class="ui-disc-stop-b"
        />
      </linearGradient>
      <radialGradient
        :id="`${uid}-wash`"
        cx="320"
        cy="320"
        r="320"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0"
          class="ui-disc-stop-a"
          stop-opacity="0.1"
        />
        <stop
          offset="0.7"
          class="ui-disc-stop-b"
          stop-opacity="0.035"
        />
        <stop
          offset="1"
          class="ui-disc-stop-b"
          stop-opacity="0"
        />
      </radialGradient>
    </defs>
    <g class="ui-disc-spin">
      <template v-if="variant === 'hero'">
        <circle
          cx="320"
          cy="320"
          r="300"
          :fill="`url(#${uid}-wash)`"
        />
        <!-- abrasive bands: two filled annuli, the mass of the disc -->
        <circle
          v-for="band in DISC_HERO_BANDS"
          :key="band.r"
          class="ui-disc-band"
          cx="320"
          cy="320"
          :r="band.r"
          :stroke-width="band.w"
          :stroke-opacity="band.o"
          :stroke="`url(#${uid}-stroke)`"
        />
        <circle
          v-for="ring in DISC_HERO_RINGS"
          :key="`h${ring.r}`"
          class="ui-disc-ring"
          cx="320"
          cy="320"
          :r="ring.r"
          :style="{ stroke: `url(#${uid}-stroke)`, strokeWidth: `calc(${ring.w} * var(--ui-disc-weight, 1) * 1px)` }"
          :opacity="ring.o"
        />
        <!-- polishing sweep: a bright arc that turns with the disc, the one moving highlight -->
        <path
          class="ui-disc-sweep"
          :d="DISC_HERO_SWEEP"
          :style="{ stroke: `url(#${uid}-stroke)` }"
        />
        <!-- data arc: a share of the outer ring, clockwise from twelve o'clock -->
        <template v-if="arc !== null && arc !== undefined">
          <circle
            class="ui-disc-arc-track"
            cx="320"
            cy="320"
            r="276"
          />
          <circle
            v-if="arc > 0"
            class="ui-disc-arc"
            cx="320"
            cy="320"
            r="276"
            pathLength="100"
            :stroke-dasharray="`${Math.min(1, Math.max(0, arc)) * 100} 100`"
          />
        </template>
        <!-- arbor hole -->
        <circle
          class="ui-disc-hub"
          cx="320"
          cy="320"
          r="30"
        />
      </template>
      <g v-else>
        <circle
          v-for="ring in DISC_RINGS"
          :key="ring.r"
          class="ui-disc-ring"
          cx="320"
          cy="320"
          :r="ring.r"
          :style="{ strokeWidth: `calc(${ring.w} * var(--ui-disc-weight, 1) * 1px)` }"
          :opacity="ring.o"
        />
      </g>
      <g
        v-if="grain"
        class="ui-disc-grain"
      >
        <line
          v-for="(tick, i) in grainTicks"
          :key="i"
          :x1="tick.x1"
          :y1="tick.y1"
          :x2="tick.x2"
          :y2="tick.y2"
          :style="{ strokeWidth: `calc(${variant === 'hero' ? 1.6 : 1} * var(--ui-disc-weight, 1) * 1px)` }"
          :opacity="tick.o"
        />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { DISC_GRAIN, DISC_HERO_BANDS, DISC_HERO_SWEEP, DISC_HERO_GRAIN, DISC_HERO_RINGS, DISC_RINGS } from './disc-ring-geometry'

const props = withDefaults(defineProps<{
  size?: number | string
  tone?: 'accent' | 'ink' | 'muted' | 'red' | 'green' | 'orange'
  spin?: boolean
  spinSeconds?: number
  grain?: boolean
  fade?: 'soft' | 'strong'
  weight?: number
  variant?: 'line' | 'hero'
  arc?: number | null
}>(), {
  size: '100%',
  tone: 'accent',
  spin: false,
  spinSeconds: 120,
  grain: true,
  fade: 'soft',
  weight: undefined,
  variant: 'line',
  arc: null,
})

// Gradient ids must be unique per instance (several discs can share one page)
const uid = `disc${useId()}`
const grainTicks = computed(() => (props.variant === 'hero' ? DISC_HERO_GRAIN : DISC_GRAIN))

const rootStyle = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: size,
    height: size,
    '--ui-disc-turn': `${props.spinSeconds}s`,
    ...(props.weight === undefined ? {} : { '--ui-disc-weight': String(props.weight) }),
  }
})
</script>

<style scoped>
.ui-disc {
  --ui-disc-a: var(--ui-accent);
  --ui-disc-b: var(--ui-indigo);
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

/* hero: the rim is the signature, so the mask only trims the very edge */
.ui-disc.is-hero {
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 84%, transparent 100%);
  mask-image: radial-gradient(circle at 50% 50%, #000 84%, transparent 100%);
}

.ui-disc.is-hero.fade-strong {
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 52%, transparent 94%);
  mask-image: radial-gradient(circle at 50% 50%, #000 52%, transparent 94%);
}

.ui-disc.is-ink {
  --ui-disc-a: var(--ui-ink);
  --ui-disc-b: var(--ui-muted);
  color: var(--ui-ink);
}

.ui-disc.is-muted {
  --ui-disc-a: var(--ui-muted);
  --ui-disc-b: var(--ui-faint);
  color: var(--ui-muted);
}

.ui-disc.is-red {
  --ui-disc-a: var(--ui-red);
  --ui-disc-b: var(--ui-orange);
  color: var(--ui-red);
}

.ui-disc.is-green {
  --ui-disc-a: var(--ui-green);
  --ui-disc-b: var(--ui-teal);
  color: var(--ui-green);
}

.ui-disc.is-orange {
  --ui-disc-a: var(--ui-orange);
  --ui-disc-b: var(--ui-red);
  color: var(--ui-orange);
}

.ui-disc-stop-a {
  stop-color: var(--ui-disc-a);
}

.ui-disc-stop-b {
  stop-color: var(--ui-disc-b);
}

.ui-disc-ring {
  fill: none;
  stroke: currentColor;
  /* hairlines stay 1px at any size (the viewBox is 640 wide, so a scaled stroke would vanish) */
  vector-effect: non-scaling-stroke;
}

.ui-disc-band {
  fill: none;
}

.ui-disc-sweep {
  fill: none;
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-opacity: 0.9;
  vector-effect: non-scaling-stroke;
}

.ui-disc-arc-track,
.ui-disc-arc {
  fill: none;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.ui-disc-arc-track {
  stroke: var(--ui-disc-a);
  stroke-opacity: 0.18;
  stroke-width: 3;
}

.ui-disc-arc {
  stroke: var(--ui-disc-a);
  stroke-width: 3.5;
  transform: rotate(-90deg);
  transform-origin: 320px 320px;
}

.ui-disc-hub {
  fill: none;
  stroke: var(--ui-disc-a);
  stroke-width: 2;
  stroke-opacity: 0.5;
  vector-effect: non-scaling-stroke;
}

.ui-disc-grain line {
  stroke: currentColor;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.ui-disc.is-hero .ui-disc-grain line {
  stroke: var(--ui-disc-a);
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
