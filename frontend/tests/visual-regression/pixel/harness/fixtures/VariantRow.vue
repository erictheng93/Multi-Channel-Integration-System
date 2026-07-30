<template>
  <div :class="direction === 'col' ? 'vrt-col' : 'vrt-row'">
    <component
      :is="component"
      v-for="(variant, index) in variants"
      :key="index"
      v-bind="variant"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Renders one real component several times with different props, so a single
 * screenshot can pin down a whole prop axis (every status, every size, every
 * platform) instead of spawning one baseline PNG per permutation.
 *
 * Only used for small, self-contained components. Anything with its own layout
 * weight (cards, panels) gets its own state so a diff points at one thing.
 */
import type { Component } from 'vue'

interface Props {
  component: Component
  variants: readonly Record<string, unknown>[]
  direction?: 'row' | 'col'
}

withDefaults(defineProps<Props>(), {
  direction: 'row',
})
</script>
