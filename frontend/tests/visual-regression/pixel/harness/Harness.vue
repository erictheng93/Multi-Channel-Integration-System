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

    <!--
      SOURCE-COVERAGE PROBE.

      `tracking-[0.3125em]` is an arbitrary-value Tailwind utility that appears
      nowhere in `src/`, so it can only be generated if the compiler is scanning
      this harness directory for candidates:
        v3 - via the widened `content` in `tailwind.harness.config.js`
        v4 - via `@source`, injected into `src/style.css` in memory by
             `vite.harness.config.ts` (and, today, also by v4's automatic
             source detection)
      If that coverage is ever lost, the utility is purged and the computed
      `letter-spacing` falls back to `normal`, which the
      `design system CSS is actually applied` guard asserts against.

      Deliberately OUTSIDE every `[data-vrt-state]` container: screenshots
      target those stages individually, so this element cannot appear in — or
      invalidate — any baseline PNG.
    -->
    <div
      class="vrt-probe"
      data-vrt-source-probe
    >
      <span class="tracking-[0.3125em]">source probe</span>
    </div>
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
