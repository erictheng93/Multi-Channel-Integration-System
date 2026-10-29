<!--
  SettingsGroup.vue

  Titled group of settings rows: caption above, one card holding the rows, optional note below.
-->

<template>
  <section class="settings-group">
    <h2
      v-if="title"
      class="group-title"
    >
      {{ title }}
    </h2>
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
}>()
</script>

<style scoped>
.group-title {
  margin: 0;
  padding: 0 8px 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ui-muted);
}

.group-note {
  margin: 0;
  padding: 8px 8px 0;
  font-size: 12.5px;
  color: var(--ui-muted);
}
</style>
