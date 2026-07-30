<template>
  <div class="vrt-row">
    <template v-if="mode === 'variants'">
      <button
        v-for="variant in VARIANTS"
        :key="variant"
        :class="['btn', variant]"
        type="button"
      >
        {{ LABELS[variant] }}
      </button>
      <button
        class="btn"
        type="button"
      >
        Base only
      </button>
    </template>

    <template v-else-if="mode === 'sizes'">
      <button
        class="btn btn-primary btn-sm"
        type="button"
      >
        Small
      </button>
      <button
        class="btn btn-primary"
        type="button"
      >
        Default
      </button>
      <button
        class="btn btn-primary btn-lg"
        type="button"
      >
        Large
      </button>
      <button
        class="btn btn-secondary btn-sm"
        type="button"
      >
        Small
      </button>
      <button
        class="btn btn-ghost btn-lg"
        type="button"
      >
        Large ghost
      </button>
    </template>

    <template v-else-if="mode === 'disabled'">
      <button
        v-for="variant in VARIANTS"
        :key="variant"
        :class="['btn', variant]"
        type="button"
        disabled
      >
        {{ LABELS[variant] }}
      </button>
    </template>

    <template v-else>
      <button
        class="btn btn-primary"
        type="button"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        新增團隊
      </button>
      <button
        class="btn btn-secondary btn-sm"
        type="button"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        更多
      </button>
      <button
        class="btn btn-danger btn-lg"
        type="button"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        刪除
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Screenshot fixture for the global button system.
 *
 * The `.btn*` classes are defined ONCE, in `frontend/src/style.css`; there is no
 * Vue component that owns them, so a harness-local fixture is the only way to
 * put them under a pixel gate. This file deliberately has NO `<style>` block —
 * `scripts/check-scoped-btn.ts` forbids redefining these classes anywhere but
 * style.css, and the whole point is to screenshot the canonical definition.
 */

interface Props {
  mode: 'variants' | 'sizes' | 'disabled' | 'with-icon'
}

defineProps<Props>()

const VARIANTS = [
  'btn-primary',
  'btn-secondary',
  'btn-success',
  'btn-warning',
  'btn-danger',
  'btn-ghost',
] as const

type Variant = (typeof VARIANTS)[number]

const LABELS: Record<Variant, string> = {
  'btn-primary': 'Primary',
  'btn-secondary': 'Secondary',
  'btn-success': 'Success',
  'btn-warning': 'Warning',
  'btn-danger': 'Danger',
  'btn-ghost': 'Ghost',
}
</script>
