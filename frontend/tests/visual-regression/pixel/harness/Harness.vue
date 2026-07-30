<template>
  <div class="vrt-grid">
    <article
      v-for="state in VRT_STATES"
      :key="state.id"
      class="vrt-case"
    >
      <!-- Label sits OUTSIDE the screenshot target so editing it never
           invalidates a baseline PNG. -->
      <div class="vrt-case-label">
        {{ state.group }} / {{ state.id }} — {{ state.label }}
      </div>
      <section
        class="vrt-stage"
        :data-vrt-state="state.id"
        :data-vrt-surface="surfaceOf(state.id)"
        :style="{ width: `${widthOf(state.id)}px` }"
      >
        <component
          :is="rendererOf(state.id).component"
          v-bind="rendererOf(state.id).props"
        />
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
/**
 * The harness page: every covered component state, each inside its own
 * fixed-width, individually addressable `[data-vrt-state]` container.
 *
 * The Playwright spec screenshots those containers one at a time rather than
 * the whole page, which means:
 *   - adding or reordering a state cannot invalidate other baselines
 *   - the page scroll position and total page height are irrelevant
 *   - each failure names exactly one component state
 */
import { VRT_STATES, type VrtStateId } from '../state-ids'
import { VRT_RENDERERS, type VrtStateRender } from './states'

function rendererOf(id: VrtStateId): VrtStateRender {
  return VRT_RENDERERS[id]
}

function widthOf(id: VrtStateId): number {
  return VRT_RENDERERS[id].width
}

function surfaceOf(id: VrtStateId): 'gray' | 'white' {
  return VRT_RENDERERS[id].surface ?? 'gray'
}
</script>
