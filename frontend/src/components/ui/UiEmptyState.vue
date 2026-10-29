<!--
  UiEmptyState.vue

  The one empty / error / "nothing yet" block. A 48px tinted art tile sits on a faint
  abrasive-disc ring, then a 15px title, a 13px body and an optional action.

    <UiEmptyState title="尚無備份檔" description="按「立即備份到雲端」建立第一份備份。">
      <template #icon><svg viewBox="0 0 24 24">...</svg></template>
      <template #action><button class="btn btn-primary btn-sm">立即備份</button></template>
    </UiEmptyState>

  Props
    title        15px heading (omit for a text-only state)
    description  13px body; or use the default slot for richer content
    compact      tighter padding, no disc (inside small cards, popovers, tables)
    tone         art tile tint: 'neutral' (default) | 'accent' | 'orange' | 'red' | 'green'

  Slots
    icon     the glyph in the tile (a 24x24 outline svg using currentColor); omit for no tile
    default  body content, replaces `description`
    action   buttons

  Extra classes / attributes fall through to the root `.ui-empty` element, so a page can
  size it (`class="rule-list__empty"`) without re-implementing it.
-->

<template>
  <div
    class="ui-empty"
    :class="{ 'ui-empty-compact': compact }"
  >
    <div
      v-if="$slots.icon"
      class="ui-empty-stage"
      aria-hidden="true"
    >
      <DiscRing
        v-if="!compact"
        class="ui-empty-disc"
        :size="112"
        :tone="discTone"
        :grain="false"
      />
      <div
        class="ui-empty-art"
        :class="`is-${tone}`"
      >
        <slot name="icon" />
      </div>
    </div>
    <h3 v-if="title">
      {{ title }}
    </h3>
    <p v-if="description || $slots.default">
      <slot>{{ description }}</slot>
    </p>
    <div
      v-if="$slots.action"
      class="ui-empty-actions"
    >
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DiscRing from './DiscRing.vue'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  compact?: boolean
  tone?: 'neutral' | 'accent' | 'orange' | 'red' | 'green'
}>(), {
  title: '',
  description: '',
  compact: false,
  tone: 'neutral',
})

// DiscRing has no orange tone: neutral and orange tiles sit on a muted ring
const discTone = computed(() => (props.tone === 'neutral' || props.tone === 'orange' ? 'muted' : props.tone))
</script>
