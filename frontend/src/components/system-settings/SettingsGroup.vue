<!--
  SettingsGroup.vue

  Titled group of settings rows: caption above, one card holding the rows, optional note below.
-->

<template>
  <section
    class="settings-group"
    :class="{ 'is-danger': danger }"
  >
    <div
      v-if="title"
      class="group-head"
    >
      <h2 class="group-title">
        {{ title }}
      </h2>
      <slot name="action" />
    </div>
    <article class="ui-card">
      <slot />
    </article>
    <p
      v-if="$slots.note"
      class="group-note"
    >
      <slot name="note" />
    </p>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  /** Destructive group: red caption and extra space above it */
  danger?: boolean
}>()
</script>

<style scoped>
.group-head {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding-right: 6px;
}

.group-head :deep(a) {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-accent);
  text-decoration: none;
}

.group-title {
  margin: 0;
  padding: 0 6px 8px 16px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ui-ink-2);
}

/* 22px stack gap + 18px = 40px above a danger zone */
.settings-group.is-danger {
  margin-top: 18px;
}
.settings-group.is-danger .group-title {
  color: var(--ui-red-ink);
}

.group-note {
  margin: 0;
  padding: 8px 16px 0;
  font-size: 13px;
  color: var(--ui-muted);
}
</style>
