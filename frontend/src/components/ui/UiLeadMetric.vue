<!--
  UiLeadMetric.vue

  The page's ONE lead number: a large light numeral with its unit and a one-line meaning,
  set over the hero abrasive disc (see DiscRing variant="hero"). This is the product's
  signature moment; every data page that has a headline figure uses it exactly once.

    <UiLeadMetric
      label="待回覆"
      :value="9"
      unit="件"
      meaning="客戶來訊後尚無客服回覆"
      tone="orange"
    />

  Rules
  - Only ONE per page. It is the lead number, not another KPI tile (those stay `.ui-kpi`).
  - Real data only: pass `value = null` while loading or when unavailable (it renders a quiet
    skeleton while `loading`, else an em dash). Never pass a placeholder number.
  - The component has no card of its own: drop it into a `.ui-card`, a card panel or a plain
    column. It fills its container's width, clips its disc to its own box and keeps all text
    clear of the art (the disc is cropped by the corner, never behind the caption).
  - Type: numeral uses `--ui-t-lead` (64px, 56px on phones) at weight 300, tabular;
    label 13px / 600 ink-2; meaning 13px muted. See "type scale" in style.css.

  Props
    label    short name of the metric (also the accessible name of the group)
    value    number | string | null  the numeral (numbers are localised with thousands separators)
    unit     unit set small beside the numeral (件, 分, %)
    meaning  one line of what the number means (wraps on phones, never truncated)
    tone     'accent' | 'orange' | 'green' | 'red' | 'ink'  tints the wash and the disc (default accent)
    loading  show a skeleton instead of the numeral
    dim      de-emphasise (value reads faint, disc turns neutral): use for a quiet 0

  Slots
    label    replaces the label text (e.g. a label plus an info button)
    default  extra content under the meaning (a link, a pill, a caption)
-->

<template>
  <div
    class="ui-lead"
    :class="[`is-${tone}`, { 'is-dim': dim, 'is-word': isWord }]"
    role="group"
    :aria-label="label"
  >
    <!-- the art layer clips the disc; the root does not, so a tooltip in the label can escape -->
    <div
      class="ui-lead-art"
      aria-hidden="true"
    >
      <DiscRing
        class="ui-lead-disc"
        variant="hero"
        :tone="dim ? 'muted' : discTone"
        :size="360"
        fade="soft"
        spin
        :spin-seconds="240"
      />
    </div>
    <div class="ui-lead-body">
      <div class="ui-lead-label">
        <slot name="label">
          {{ label }}
        </slot>
      </div>
      <div
        class="ui-lead-value"
        :aria-busy="loading || undefined"
      >
        <span
          v-if="loading"
          class="ui-lead-sk"
        />
        <template v-else>
          <span class="ui-lead-num">{{ shown }}</span><span
            v-if="unit && value !== null"
            class="ui-lead-unit"
          >{{ unit }}</span>
        </template>
      </div>
      <p
        v-if="meaning"
        class="ui-lead-meaning"
      >
        {{ meaning }}
      </p>
      <div
        v-if="$slots.default"
        class="ui-lead-extra"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DiscRing from './DiscRing.vue'

const props = withDefaults(defineProps<{
  label: string
  value: number | string | null
  unit?: string
  meaning?: string
  tone?: 'accent' | 'orange' | 'green' | 'red' | 'ink'
  loading?: boolean
  dim?: boolean
}>(), {
  unit: '',
  meaning: '',
  tone: 'accent',
  loading: false,
  dim: false,
})

const discTone = computed(() => props.tone)
/** A verdict word (正常, 部分降級) rather than a figure: Latin digits sit well at weight 300, CJK strokes do not */
const isWord = computed(() => typeof props.value === 'string' && /[^\d.,\s—-]/.test(props.value))
const shown = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') {
    return '—'
  }
  return typeof props.value === 'number' ? props.value.toLocaleString('en-US') : props.value
})
</script>

<style scoped>
.ui-lead {
  --ui-lead-tint: var(--ui-accent-soft);
  position: relative;
  isolation: isolate;
  display: flex;
  min-width: 0;
  /* fills a grid cell that stretches it, so the numeral sits on the card's floor, never mid-card */
  height: 100%;
  min-height: 188px;
  background: linear-gradient(160deg, var(--ui-lead-tint), transparent 70%);
}

.ui-lead.is-orange {
  --ui-lead-tint: var(--ui-orange-soft);
}

.ui-lead.is-green {
  --ui-lead-tint: var(--ui-green-soft);
}

.ui-lead.is-red {
  --ui-lead-tint: var(--ui-red-soft);
}

.ui-lead.is-ink {
  --ui-lead-tint: var(--ui-fill);
}

.ui-lead-art {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

/* The disc is centred exactly on the card's top-right corner: a clean quarter-disc that bleeds off the
   card's own edge (the art layer clips it), never a ring sliced mid-way beside text */
.ui-lead-disc {
  position: absolute;
  top: -180px;
  right: -180px;
  opacity: 0.85;
}

.ui-lead-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  justify-content: flex-end;
  min-width: 0;
  padding: 22px;
}

.ui-lead-label {
  display: flex;
  /* label rides the top edge, numeral and meaning sit on the floor: a stretched card never has a floating middle */
  margin-bottom: auto;
  gap: 4px;
  align-items: center;
  font-size: var(--ui-t-meta);
  font-weight: 600;
  color: var(--ui-ink-2);
}

.ui-lead-value {
  display: flex;
  align-items: baseline;
  min-height: var(--ui-t-lead);
  font-family: var(--ui-font-display);
  font-size: var(--ui-t-lead);
  font-weight: var(--ui-w-lead);
  line-height: 1;
  letter-spacing: var(--ui-track-lead);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.ui-lead.is-word .ui-lead-value {
  font-size: var(--ui-t-lead-word, 48px);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ui-lead.is-dim .ui-lead-value {
  color: var(--ui-faint);
}

.ui-lead-unit {
  margin-left: 6px;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.ui-lead-meaning {
  margin: 0;
  font-size: var(--ui-t-meta);
  line-height: 1.5;
  color: var(--ui-muted);
}

.ui-lead-extra {
  margin-top: 6px;
}

.ui-lead-sk {
  display: block;
  width: 120px;
  height: 52px;
  border-radius: 12px;
  background: var(--ui-fill);
  animation: ui-lead-pulse 1.4s ease-in-out infinite;
}

@keyframes ui-lead-pulse {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-lead-sk {
    animation: none;
  }
}

@media (max-width: 768px) {
  .ui-lead {
    min-height: 0;
  }

  .ui-lead-disc {
    top: -180px;
    right: -180px;
  }

  .ui-lead-value {
    min-height: var(--ui-t-lead-sm);
    font-size: var(--ui-t-lead-sm);
  }

  .ui-lead.is-word .ui-lead-value {
    font-size: 40px;
  }
}
</style>
