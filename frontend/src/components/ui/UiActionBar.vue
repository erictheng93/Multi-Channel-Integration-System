<!--
  UiActionBar.vue

  Primary actions of a form or flow (save, send, generate, ...).
  - Desktop: an ordinary right-aligned row; put it at the end of the form or card.
  - Phone (<= 768px): pinned to the bottom of the scrolling page, full bleed, with a frosted
    surface and safe-area padding, so the main action never scrolls out of reach. Buttons grow
    to share the width (44px touch targets).

    <UiActionBar label="儲存設定">
      <button class="btn btn-secondary" :disabled="!dirty" @click="reset">還原</button>
      <button class="btn btn-primary" :disabled="!dirty || saving" @click="save">儲存變更</button>
    </UiActionBar>

  Place it as a direct child of the page root (`.ui-page`) so sticky positioning is relative
  to the page scroller. Keep the primary button last (right / bottom of the thumb).

  Props
    label  accessible name of the toolbar (default 操作)
-->

<template>
  <div
    class="ui-action-bar"
    role="toolbar"
    :aria-label="label"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label?: string
}>(), {
  label: '操作',
})
</script>
