<!--
  RingLead.vue

  The one lead object of a "Service Rings" page that is not the dashboard: a compact elevated card
  with the single number that matters on the left and ServiceRings (graphic + legend) on the right.
  It exists so the team and system pages share one lead instead of nine hand-rolled heroes.

    <RingLead kicker="目前在線" value="5" unit="位" meaning="共 7 位啟用中的成員"
              summary="在線成員" :rings="rings" />

  Rules
  - Rings only for ratios the page really has. With no rings the card is the number alone.
  - The number tone is semantic (good / warn / bad / none), never decorative.
  - Compact on purpose: 24px / 32px padding, number 48px, rings 140px, so the first list starts
    inside the first screen.

  Slots
    default   extra line(s) under the meaning (links, chips)
    actions   a button under the number (e.g. "run check")
    rings     replaces the ServiceRings (e.g. a bespoke 30-day strip)
-->
<template>
  <article
    class="ui-lead rl"
    :class="{ 'has-rings': hasRings }"
  >
    <div class="rl-main">
      <div class="rl-kicker">
        {{ kicker }}
      </div>
      <div
        class="rl-num"
        :class="tone ? `is-${tone}` : ''"
        :aria-busy="busy || undefined"
      >
        <span
          v-if="busy"
          class="rl-skel"
          aria-hidden="true"
        />
        <template v-else>
          {{ value }}<small v-if="unit">{{ unit }}</small>
        </template>
      </div>
      <p
        v-if="meaning"
        class="rl-meaning"
      >
        {{ meaning }}
      </p>
      <slot />
      <div
        v-if="$slots.actions"
        class="rl-actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <div
      v-if="hasRings || $slots.rings"
      class="rl-rings"
    >
      <slot name="rings">
        <ServiceRings
          :summary="summary"
          :rings="rings"
          :size="size"
          :center-value="centerValue"
          :center-label="centerLabel"
        />
      </slot>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ServiceRings, { type ServiceRing } from '@/components/ui/ServiceRings.vue'

const props = withDefaults(defineProps<{
  kicker: string
  value: string | number
  unit?: string
  meaning?: string
  tone?: 'good' | 'warn' | 'bad' | 'none' | ''
  rings?: readonly ServiceRing[]
  summary?: string
  size?: number
  centerValue?: string | number
  centerLabel?: string
  busy?: boolean
}>(), {
  unit: '',
  meaning: '',
  tone: '',
  rings: () => [],
  summary: '',
  size: 144,
  centerValue: undefined,
  centerLabel: '',
  busy: false,
})

const hasRings = computed(() => props.rings.length > 0)
</script>

<style scoped>
.rl {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px 40px;
  align-items: center;
  padding: 24px 32px;
}

.rl.has-rings,
.rl:has(.rl-rings) {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.rl-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.rl-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.rl-num {
  margin-top: 4px;
  font: 600 56px / 1.05 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.rl-num small {
  margin-left: 6px;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.rl-num.is-good {
  color: var(--ui-green-ink);
}

.rl-num.is-warn {
  color: var(--ui-orange-ink);
}

.rl-num.is-bad {
  color: var(--ui-red-ink);
}

.rl-num.is-none {
  color: var(--ui-faint);
}

.rl-skel {
  display: inline-block;
  width: 96px;
  height: 44px;
  border-radius: 10px;
  background: var(--ui-fill);
}

.rl-meaning {
  margin: 6px 0 0;
  font-size: 15px;
  line-height: 1.4;
  color: var(--ui-ink-2);
}

.rl-actions {
  margin-top: 14px;
}

.rl-rings {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  padding-left: 40px;
}

.rl-rings :deep(.service-rings) {
  gap: 32px;
}

/* hairline between the number and the rings */
.rl-rings::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

@media (max-width: 1024px) {
  .rl {
    gap: 16px 28px;
    padding: 22px 24px;
  }

  .rl-rings {
    padding-left: 28px;
  }
}

@media (max-width: 768px) {
  .rl,
  .rl.has-rings,
  .rl:has(.rl-rings) {
    grid-template-columns: minmax(0, 1fr);
    padding: 20px;
  }

  .rl-rings {
    justify-content: flex-start;
    padding: 16px 0 0;
    --sr-fit: 120px;
  }

  .rl-rings::before {
    top: 0;
    right: 0;
    bottom: auto;
    left: 0;
    width: auto;
    height: 0.5px;
  }

  .rl-num {
    font-size: 44px;
  }
}
</style>

<style>
/* A page that wears a RingLead also gets readable group labels (the foundation's 13px muted label
   was the most criticised detail of the pilot). Local to pages that opt in with .rl-page. */
.ui-page.rl-page .ui-group-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}
</style>
