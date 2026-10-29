<!--
  SettingsRow.vue

  iOS-Settings style row: label and hint on the left, control (default slot) on the right.
  Stacks on phones. Consecutive rows get a hairline separator.
-->

<template>
  <div
    class="srow"
    :class="{ 'is-danger': danger }"
  >
    <div class="srow-l">
      <label
        v-if="forId"
        class="srow-t"
        :for="forId"
      >{{ label }}</label>
      <div
        v-else
        class="srow-t"
      >
        {{ label }}
      </div>
      <div
        v-if="hint"
        class="srow-h"
      >
        {{ hint }}
      </div>
    </div>
    <div
      class="srow-c"
      :class="{ end }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
  forId?: string
  danger?: boolean
  /** Right-align the control (buttons) instead of stretching it */
  end?: boolean
}>()
</script>

<style scoped>
.srow {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 64px;
  padding: 14px 22px;
}

.srow + .srow::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

.srow-l {
  flex: 1;
  min-width: 0;
}

.srow-t {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ui-ink);
}

.is-danger .srow-t {
  color: var(--ui-red-ink);
}

.srow-h {
  margin-top: 1px;
  font-size: 13px;
  color: var(--ui-muted);
}

.srow-c {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  width: min(340px, 100%);
}

.srow-c.end {
  justify-content: flex-end;
}

.srow-c :deep(.btn) {
  flex: none;
}

@media (max-width: 768px) {
  .srow {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px 18px;
  }

  .srow-c {
    width: 100%;
  }

  .srow-c.end {
    justify-content: flex-start;
  }

  .srow + .srow::before {
    left: 18px;
  }
}
</style>
